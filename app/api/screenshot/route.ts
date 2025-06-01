import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const width = parseInt(searchParams.get('width') || '800');
    const height = parseInt(searchParams.get('height') || '480');
    
    console.log('Screenshot request:', { width, height, env: process.env.NODE_ENV });
    
    // Get the base URL for the screenshot - use localhost in production to avoid circular calls
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = 'http://localhost:3000';
    
    console.log('Target URL:', baseUrl);
    
    // Launch browser with system Chromium in production
    console.log('Launching browser, production:', isProduction);
    
    const browser = await chromium.launch({
      executablePath: isProduction ? '/usr/bin/chromium-browser' : undefined,
      headless: true,
      args: isProduction ? [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--remote-debugging-port=9222',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ] : []
    });
    
    console.log('Browser launched successfully');
    
    console.log('Creating new page...');
    const page = await browser.newPage();
    console.log('Page created successfully');
    
    // Set viewport size for e-ink display
    console.log('Setting viewport size...');
    await page.setViewportSize({ width, height });
    console.log('Viewport size set');
    
    // Navigate to the main page
    console.log('Navigating to page...');
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log('Page navigation completed');
    
    // Wait for content to load
    console.log('Waiting for content to load...');
    await page.waitForTimeout(2000);
    console.log('Wait completed');
    
    console.log('Page loaded, hiding dev indicators...');
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
    console.log('Taking screenshot...');
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false
    });
    
    console.log('Screenshot taken, closing browser...');
    await browser.close();
    console.log('Browser closed, returning response');
    
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
    console.error('Screenshot error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      env: process.env.NODE_ENV,
      executablePath: process.env.NODE_ENV === 'production' ? '/usr/bin/chromium-browser' : 'default'
    });
    return NextResponse.json(
      { 
        error: 'Failed to generate screenshot',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}