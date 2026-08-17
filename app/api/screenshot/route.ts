import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';

const CACHE_TTL_MS = 60_000;
const MIN_DIMENSION = 100;
const MAX_DIMENSION = 2000;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 480;

interface CacheEntry {
  buffer: Buffer;
  expiresAt: number;
}

// Bounded: dimension params are attacker-controlled, so both maps must stay
// small no matter how many distinct sizes get requested, and only one Chromium
// may run at a time.
const MAX_CACHE_ENTRIES = 8;
const screenshotCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Buffer>>();
let captureQueue: Promise<unknown> = Promise.resolve();

function pruneCache(now: number) {
  for (const [key, entry] of screenshotCache) {
    if (entry.expiresAt <= now) screenshotCache.delete(key);
  }
  // Map preserves insertion order, so the first keys are the oldest.
  while (screenshotCache.size > MAX_CACHE_ENTRIES) {
    const oldest = screenshotCache.keys().next().value;
    if (oldest === undefined) break;
    screenshotCache.delete(oldest);
  }
}

function clampDimension(value: string | null, fallback: number): number {
  const parsed = parseInt(value || '', 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, parsed));
}

async function captureScreenshot(width: number, height: number): Promise<Buffer> {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = process.env.SCREENSHOT_TARGET_URL || `http://localhost:${process.env.PORT || 3000}`;

  // CHROMIUM_PATH overrides for hosts whose system Chromium lives elsewhere
  // than the Alpine container's /usr/bin/chromium-browser.
  const executablePath =
    process.env.CHROMIUM_PATH || (isProduction ? '/usr/bin/chromium-browser' : undefined);

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: isProduction ? [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ] : []
  });

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    try {
      // The chart is a lazy client-only import that mounts after the tide data
      // lands, so it is the last element to appear — waiting on tide-info alone
      // can capture a frame with a blank lower half.
      await page.waitForSelector('[data-testid="tide-chart"]', { timeout: 15000 });
    } catch {
      // Page may be showing an error state; screenshot it anyway.
    }

    if (!isProduction) {
      // Hide Next.js development indicators
      await page.addStyleTag({
        content: `
          #__next-dev-overlay-error,
          #__next-dev-overlay,
          div[data-nextjs-dialog-overlay],
          div[data-nextjs-toast],
          div[style*="position: fixed"][style*="z-index"],
          div[style*="position: fixed"][style*="bottom"],
          div[style*="position: fixed"][style*="left: 0"],
          div[style*="position: fixed"][style*="right: 0"],
          [id*="__next"],
          [class*="__next"] {
            display: none !important;
          }
          /* More specific targeting for the N logo */
          div[style*="position: fixed"]:has(svg),
          div[style*="position: fixed"]:has(img[alt*="Next"]),
          div[style*="position: fixed"]:has([title*="Next"]) {
            display: none !important;
          }
        `
      });
    }

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false
    });

    return screenshot;
  } finally {
    await browser.close();
  }
}

async function getScreenshot(width: number, height: number): Promise<{ buffer: Buffer; cacheHit: boolean }> {
  const key = `${width}x${height}`;
  const now = Date.now();
  pruneCache(now);

  const cached = screenshotCache.get(key);
  if (cached && cached.expiresAt > now) {
    return { buffer: cached.buffer, cacheHit: true };
  }

  const pending = inFlight.get(key);
  if (pending) {
    const buffer = await pending;
    return { buffer, cacheHit: true };
  }

  // Serialize captures behind a single queue so concurrent requests for
  // different sizes can't stack up Chromium processes.
  const capturePromise = captureQueue.then(
    () => captureScreenshot(width, height),
    () => captureScreenshot(width, height)
  );
  captureQueue = capturePromise.catch(() => {});
  inFlight.set(key, capturePromise);

  try {
    const buffer = await capturePromise;
    screenshotCache.set(key, { buffer, expiresAt: Date.now() + CACHE_TTL_MS });
    pruneCache(Date.now());
    return { buffer, cacheHit: false };
  } finally {
    inFlight.delete(key);
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const width = clampDimension(searchParams.get('width'), DEFAULT_WIDTH);
    const height = clampDimension(searchParams.get('height'), DEFAULT_HEIGHT);

    const { buffer, cacheHit } = await getScreenshot(width, height);
    console.log(`Screenshot request: ${width}x${height} (${cacheHit ? 'cache hit' : 'cache miss'})`);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Screenshot error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        error: 'Failed to generate screenshot',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
