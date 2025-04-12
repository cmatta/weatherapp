# generate_frame.py

import asyncio
from playwright.async_api import async_playwright
from PIL import Image
import io
from inky.inky_uc8159 import Inky # For Inky Impression 7.3" v3 (ACeP)

# --- Configuration ---
# URL of your running weather app (adjust if running elsewhere, e.g., Kubernetes service URL)
APP_URL = "http://localhost:3001" 
# Inky Impression 7.3" dimensions
WIDTH = 800
HEIGHT = 480
# Inky Impression 7.3" 7-Color Palette (Black, White, Red, Yellow, Blue, Green, Orange)
# RGB values
INKY_PALETTE_RGB = [
    (0, 0, 0),        # Black
    (255, 255, 255),  # White
    (255, 0, 0),      # Red
    (255, 255, 0),    # Yellow
    (0, 0, 255),      # Blue
    (0, 255, 0),      # Green
    (255, 128, 0),    # Orange 
    # Add other colors from the palette if needed, padding to 256 for PIL
]
OUTPUT_FILENAME = "inky_frame.png" # Where to save the processed image

# Create the PIL palette structure (requires flattening and padding to 768 bytes)
# Flatten the RGB tuples
flat_palette = [value for color in INKY_PALETTE_RGB for value in color]
# Pad with black (or last color) if palette has fewer than 256 colors
padding = [0] * (768 - len(flat_palette)) 
PIL_PALETTE = flat_palette + padding

# --- Functions ---

async def capture_screenshot(url: str, width: int, height: int) -> bytes:
    """Captures a screenshot of the web page."""
    async with async_playwright() as p:
        # Use chromium, but firefox or webkit could also work
        browser = await p.chromium.launch() 
        page = await browser.new_page()
        # Set viewport size *before* navigation to match the Inky display
        await page.set_viewport_size({"width": width, "height": height})
        print(f"Navigating to {url}...")
        # Increase timeout if the page takes longer to load/render
        await page.goto(url, wait_until="networkidle", timeout=60000) 
        # Optional: Wait for a specific element if needed to ensure full render
        # await page.locator('#tide-chart-container').wait_for(timeout=10000) 
        print("Taking screenshot...")
        screenshot_bytes = await page.screenshot()
        await browser.close()
        print("Screenshot captured.")
        return screenshot_bytes

def process_image(image_bytes: bytes, width: int, height: int, palette: list) -> Image.Image:
    """Resizes and converts the image to the Inky palette using dithering."""
    print("Processing image...")
    img = Image.open(io.BytesIO(image_bytes))

    # Ensure image is RGB before palette conversion
    if img.mode != 'RGB':
        img = img.convert('RGB')
        
    # Create a palette image for quantization
    palette_img = Image.new('P', (1, 1))
    palette_img.putpalette(palette) # Use the pre-calculated PIL_PALETTE

    # Resize if necessary (though viewport should match) - use LANCZOS for better quality
    if img.size != (width, height):
        print(f"Resizing image from {img.size} to ({width}, {height})...")
        img = img.resize((width, height), Image.Resampling.LANCZOS)

    # Quantize to the Inky palette using Floyd-Steinberg dithering
    print("Quantizing image to Inky palette with dithering...")
    # IMPORTANT: quantize expects the palette image, not the raw palette list
    img_converted = img.quantize(palette=palette_img, dither=Image.Dither.FLOYDSTEINBERG) 
    # Convert back to RGB for saving/displaying (optional, but good for viewing the result)
    # img_rgb_quantized = img_converted.convert('RGB') 
    print("Image processing complete.")
    # Return the palettized image directly if needed for sending raw data later
    return img_converted 

# --- Main Execution ---

async def main():
    screenshot_data = await capture_screenshot(APP_URL, WIDTH, HEIGHT)
    processed_image = process_image(screenshot_data, WIDTH, HEIGHT, PIL_PALETTE)
    
    print("Initializing Inky display...")
    try:
        # Note: Ensure your display is connected correctly (SPI must be enabled)
        inky_display = Inky()
        
        print("Sending image to Inky display...")
        # The image is already palettized ('P' mode) by process_image
        inky_display.set_image(processed_image)
        
        print("Updating Inky display (this may take a while)...")
        inky_display.show()
        print("Inky display update complete.")

    except Exception as e:
        print(f"Error interacting with Inky display: {e}")
        print("Please ensure the Inky library is installed correctly, SPI is enabled, and the display is connected.")

if __name__ == "__main__":
    # Ensure the weather app is running at APP_URL before executing
    print("Starting frame generation...")
    asyncio.run(main())
    print("Frame generation finished.")
