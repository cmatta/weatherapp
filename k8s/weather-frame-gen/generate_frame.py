# generate_frame.py (Revised for K8s/NFS)

import asyncio
from playwright.async_api import async_playwright
from PIL import Image, ImagePalette
import io
import os # Added for path joining

# --- Configuration ---
# URL of your running weather app (e.g., [http://weatherapp-service.your-namespace.svc.cluster.local](http://weatherapp-service.your-namespace.svc.cluster.local):3000)
APP_URL = os.environ.get("APP_URL", "https://weather.matta.limo") 
WIDTH = 600
HEIGHT = 448
# Output path within the container, expected to be an NFS mount
OUTPUT_DIR = "/output" 
OUTPUT_FILENAME = os.path.join(OUTPUT_DIR, "inky_frame.png")

# Inky 7.3" 7-Color Palette (Black, White, Green, Blue, Red, Yellow, Orange)
# Correct order for inky library palette processing AND Pillow's palette format
# (R, G, B values)
INKY_PALETTE = [
    (0, 0, 0),        # Black
    (255, 255, 255),  # White
    (0, 128, 0),      # Green - Adjusted from (0, 255, 0) for better e-ink rendering potentially
    (0, 0, 255),      # Blue
    (255, 0, 0),      # Red
    (255, 255, 0),    # Yellow
    (255, 140, 0),    # Orange - Adjusted from (255, 165, 0) potentially
    # Pad to 256 colors for Pillow palette format if needed, but 7 should be fine for quantize
]

# Create a palette image for Pillow's quantize function
# Flatten the palette list
pil_palette_values = [channel for color in INKY_PALETTE for channel in color]
# Pad with zeros if necessary to reach 768 values (256 colors * 3 channels)
pil_palette_values.extend([0] * (768 - len(pil_palette_values)))

palette_img = Image.new('P', (1, 1))
# Use ImagePalette object for modern Pillow
palette_img.putpalette(ImagePalette.ImagePalette("RGB", pil_palette_values[:768]))

async def capture_screenshot(url, width, height):
    print(f"Navigating to {url}...")
    async with async_playwright() as p:
        # Use chromium as it's typically more compatible on Linux/K8s
        browser = await p.chromium.launch() 
        page = await browser.new_page()
        await page.set_viewport_size({"width": width, "height": height})

        try:
            await page.goto(url, wait_until='networkidle', timeout=60000) # Increased timeout
            print("Page loaded. Waiting for tide info...")
            # Wait for an element unique to the tide section to ensure it's rendered
            # --- Increased timeout to 60 seconds --- 
            await page.wait_for_selector('[data-testid="tide-info"]', state='visible', timeout=60000) 
            print("Tide info found. Capturing screenshot...")
            
            screenshot_bytes = await page.screenshot(type='png')
            
             # Capture console logs (optional debugging)
            page.on("console", lambda msg: print(f"Browser Console: {msg.text()}"))

        except Exception as e:
            print(f"Error during Playwright navigation/capture: {e}")
            # --- Add HTML saving on error --- 
            try:
                html_content = await page.content()
                error_file_path = os.path.join(OUTPUT_DIR, "error_page.html") 
                # Ensure output dir exists if running locally without volume
                os.makedirs(OUTPUT_DIR, exist_ok=True)
                with open(error_file_path, "w", encoding="utf-8") as f:
                    f.write(html_content)
                print(f"Saved page HTML to {error_file_path} for debugging.")
            except Exception as html_e:
                print(f"Could not save HTML content: {html_e}")
            # --- End of HTML saving --- 
            screenshot_bytes = None # Indicate failure
        finally:
            await browser.close()
            
        return screenshot_bytes

def process_image(image_bytes, width, height, palette_img_for_quantize):
    if not image_bytes:
        print("No screenshot data to process.")
        return None
        
    print("Processing image...")
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')

    # Ensure image is the correct size (optional, viewport should handle this)
    if img.size != (width, height):
        print(f"Warning: Screenshot size {img.size} doesn't match target ({width}, {height}). Resizing might affect quality.")
        img = img.resize((width, height), Image.Resampling.LANCZOS)

    # Quantize to the Inky palette using Floyd-Steinberg dithering
    print("Quantizing image to Inky palette with dithering...")
    img_converted = img.quantize(palette=palette_img_for_quantize, dither=Image.Dither.FLOYDSTEINBERG) 
    print("Image processing complete.")
    return img_converted 

async def main():
    screenshot_data = await capture_screenshot(APP_URL, WIDTH, HEIGHT)
    if screenshot_data:
        processed_image = process_image(screenshot_data, WIDTH, HEIGHT, palette_img)
        if processed_image:
            try:
                # Ensure output directory exists (important for NFS mounts)
                os.makedirs(OUTPUT_DIR, exist_ok=True) 
                
                # Save the processed image to the NFS share path
                processed_image.save(OUTPUT_FILENAME)
                print(f"Processed image saved as {OUTPUT_FILENAME}")
            except Exception as e:
                 print(f"Error saving image to {OUTPUT_FILENAME}: {e}")
    else:
        print("Failed to capture screenshot, skipping image processing and saving.")

if __name__ == "__main__":
    print("Starting screenshot generation...")
    asyncio.run(main())
    print("Script finished.")