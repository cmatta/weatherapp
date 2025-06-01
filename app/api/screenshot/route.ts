import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const width = parseInt(searchParams.get('width') || '800');
    const height = parseInt(searchParams.get('height') || '480');
    
    // Get the base URL for the screenshot
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    // Launch browser
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Set viewport size for e-ink display
    await page.setViewportSize({ width, height });
    
    // Navigate to the main page
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    
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
    
    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false
    });
    
    await browser.close();
    
    // Return PNG with appropriate headers
    return new NextResponse(screenshot, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Screenshot error:', error);
    return NextResponse.json(
      { error: 'Failed to generate screenshot' },
      { status: 500 }
    );
  }
}