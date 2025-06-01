# /home/pi/weatherframe/display_on_pi.py
#
# This script fetches weather data images directly from the weather app's
# screenshot API endpoint and displays them on an Inky e-ink display.
# 
# No NFS mount or file sharing required - everything is done via HTTP API.

from inky.auto import auto as Inky
from PIL import Image, ImageDraw, ImageFont
import requests
import io
import time
import textwrap
from datetime import datetime

# --- Configuration ---
# Weather app API endpoint
WEATHER_API_URL = "https://weather.matta.limo/api/screenshot"  # <<< CHANGE THIS TO YOUR ACTUAL URL
SCREENSHOT_WIDTH = 800
SCREENSHOT_HEIGHT = 480
REQUEST_TIMEOUT = 30  # Timeout for HTTP request (seconds)
RETRY_ATTEMPTS = 3    # Number of retry attempts if request fails

def create_error_image(message, inky_display):
    """Create an error image with the given message to display on the Inky."""
    width, height = inky_display.resolution
    img = Image.new('P', (width, height), inky_display.WHITE)
    draw = ImageDraw.Draw(img)
    
    # Try to load a font, fall back to default if not available
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 20)
    except IOError:
        font = ImageFont.load_default()
    
    # Draw a red border
    border = 10
    draw.rectangle([(border, border), (width - border, height - border)], 
                  outline=inky_display.RED, width=2)
    
    # Add error title
    title = "ERROR: No New Image"
    title_bbox = draw.textbbox((0, 0), title, font=font)
    title_width = title_bbox[2] - title_bbox[0]
    draw.text(((width - title_width) // 2, 30), title, 
              font=font, fill=inky_display.BLACK)
    
    # Add error message with word wrap
    y_text = 70
    for line in textwrap.wrap(message, width=30):  # 30 chars per line
        line_bbox = draw.textbbox((0, 0), line, font=font)
        line_width = line_bbox[2] - line_bbox[0]
        draw.text(((width - line_width) // 2, y_text), 
                 line, font=font, fill=inky_display.BLACK)
        y_text += 30
    
    # Add timestamp
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    timestamp_bbox = draw.textbbox((0, 0), timestamp, font=font)
    timestamp_width = timestamp_bbox[2] - timestamp_bbox[0]
    draw.text((width - timestamp_width - 20, height - 40), 
             timestamp, font=font, fill=inky_display.BLACK)
    
    return img

def fetch_weather_image():
    """Fetch weather image from the API endpoint."""
    params = {
        'width': SCREENSHOT_WIDTH,
        'height': SCREENSHOT_HEIGHT
    }
    
    for attempt in range(RETRY_ATTEMPTS):
        try:
            print(f"Fetching weather image from API (attempt {attempt + 1}/{RETRY_ATTEMPTS})...")
            response = requests.get(
                WEATHER_API_URL, 
                params=params, 
                timeout=REQUEST_TIMEOUT,
                headers={'User-Agent': 'WeatherFrame-Pi/1.0'}
            )
            response.raise_for_status()
            
            # Check if response is actually an image
            content_type = response.headers.get('content-type', '')
            if not content_type.startswith('image/'):
                raise ValueError(f"Expected image, got {content_type}")
            
            print(f"Successfully fetched image ({len(response.content)} bytes)")
            return response.content
            
        except requests.exceptions.Timeout:
            print(f"Request timeout on attempt {attempt + 1}")
        except requests.exceptions.RequestException as e:
            print(f"Request failed on attempt {attempt + 1}: {e}")
        except ValueError as e:
            print(f"Invalid response on attempt {attempt + 1}: {e}")
        except Exception as e:
            print(f"Unexpected error on attempt {attempt + 1}: {e}")
        
        if attempt < RETRY_ATTEMPTS - 1:
            print("Waiting 5 seconds before retry...")
            time.sleep(5)
    
    return None

def display_image():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting display update")
    print(f"Fetching weather image from: {WEATHER_API_URL}")
    
    # Initialize Inky display
    try:
        inky_display = Inky()
    except Exception as e:
        print(f"Failed to initialize Inky display: {e}")
        return
    
    # Fetch weather image from API
    image_data = fetch_weather_image()
    if image_data is None:
        error_msg = f"Failed to fetch image from:\n{WEATHER_API_URL}\nafter {RETRY_ATTEMPTS} attempts"
        print(error_msg)
        error_img = create_error_image(error_msg, inky_display)
        inky_display.set_image(error_img)
        inky_display.show()
        return

    try:
        print("Processing downloaded image...")
        # Open the image using Pillow from bytes
        try:
            img = Image.open(io.BytesIO(image_data))
            # Load the image to verify it's complete
            img.verify()
            img = Image.open(io.BytesIO(image_data))  # Reopen after verify
        except Exception as e:
            error_msg = f"Invalid image data:\n{str(e)[:50]}..."
            print(f"Error loading image: {e}")
            error_img = create_error_image(error_msg, inky_display)
            inky_display.set_image(error_img)
            inky_display.show()
            return
        
        # Verify image size (should be 800x480)
        if img.size != (SCREENSHOT_WIDTH, SCREENSHOT_HEIGHT):
            print(f"Warning: Image size is {img.size}, expected ({SCREENSHOT_WIDTH}, {SCREENSHOT_HEIGHT})")
            print("Resizing image to fit display...")
            img = img.resize((SCREENSHOT_WIDTH, SCREENSHOT_HEIGHT), Image.Resampling.LANCZOS)

        # Keep the original image format - let Inky handle the color conversion
        print(f"Image format: {img.mode}, size: {img.size}")

        print("Sending image to Inky display...")
        inky_display.set_image(img)
        
        print("Updating Inky display (this may take a while)...")
        inky_display.show()
        print("Inky display update complete.")
        
    except Exception as e:
        error_msg = f"Unexpected error:\n{str(e)[:50]}..."
        print(f"An error occurred: {e}")
        error_img = create_error_image(error_msg, inky_display)
        inky_display.set_image(error_img)
        inky_display.show()

if __name__ == "__main__":
    display_image()
