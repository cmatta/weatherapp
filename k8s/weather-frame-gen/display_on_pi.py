# /home/pi/weatherframe/display_on_pi.py

from inky.auto import auto as Inky
from PIL import Image, ImageDraw, ImageFont
import os
import time
import textwrap
from datetime import datetime, timedelta

# --- Configuration ---
# Path where the NFS share is mounted on the Pi Zero
NFS_MOUNT_PATH = "/mnt/weatherframe"  # <<< CHANGE THIS TO YOUR ACTUAL MOUNT POINT
IMAGE_FILENAME = "inky_frame.png"
IMAGE_FULL_PATH = os.path.join(NFS_MOUNT_PATH, IMAGE_FILENAME)
MAX_IMAGE_AGE_MINUTES = 60  # Consider image stale if older than this (minutes)
MAX_WAIT_SECONDS = 60  # Max time to wait for a new image file (seconds)

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

def is_image_stale(filepath, max_age_minutes):
    """Check if the image file is older than max_age_minutes."""
    try:
        mod_time = os.path.getmtime(filepath)
        file_age = datetime.now() - datetime.fromtimestamp(mod_time)
        return file_age > timedelta(minutes=max_age_minutes)
    except Exception as e:
        print(f"Error checking file age: {e}")
        return True  # Consider file stale if we can't check its age

def display_image():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting display update")
    print(f"Looking for image file: {IMAGE_FULL_PATH}")
    
    # Initialize Inky display
    try:
        inky_display = Inky()
    except Exception as e:
        print(f"Failed to initialize Inky display: {e}")
        return
    
    # Check if image exists and is not stale
    if not os.path.exists(IMAGE_FULL_PATH):
        error_msg = f"Image not found:\n{IMAGE_FULL_PATH}"
        print(error_msg)
        error_img = create_error_image(error_msg, inky_display)
        inky_display.set_image(error_img)
        inky_display.show()
        return
    
    if is_image_stale(IMAGE_FULL_PATH, MAX_IMAGE_AGE_MINUTES):
        mod_time = datetime.fromtimestamp(os.path.getmtime(IMAGE_FULL_PATH))
        error_msg = f"Stale image:\n{mod_time.strftime('%Y-%m-%d %H:%M')}\n(> {MAX_IMAGE_AGE_MINUTES} min old)"
        print(error_msg)
        error_img = create_error_image(error_msg, inky_display)
        inky_display.set_image(error_img)
        inky_display.show()
        return

    try:
        print("Loading image from NFS share...")
        # Verify file is accessible and not being written to
        try:
            # Try to open the file in read-binary mode to check accessibility
            with open(IMAGE_FULL_PATH, 'rb') as f:
                f.read(1)  # Try reading first byte to ensure file is accessible
        except (IOError, OSError) as e:
            error_msg = f"File access error:\n{str(e)}"
            print(error_msg)
            error_img = create_error_image(error_msg, inky_display)
            inky_display.set_image(error_img)
            inky_display.show()
            return

        # Open the image using Pillow
        try:
            img = Image.open(IMAGE_FULL_PATH)
            # Load the image to verify it's complete
            img.verify()
            img = Image.open(IMAGE_FULL_PATH)  # Reopen after verify
        except Exception as e:
            error_msg = f"Invalid image file:\n{str(e)[:50]}..."
            print(f"Error loading image: {e}")
            error_img = create_error_image(error_msg, inky_display)
            inky_display.set_image(error_img)
            inky_display.show()
            return
        
        # Verify image size (should be 800x480)
        if img.size != (800, 480):
            print(f"Warning: Image size is {img.size}, expected (800, 480).")
            # Optionally resize, but ideally the generator script ensures the correct size
            # img = img.resize((800, 480))

        # Note: The image is already palettized ('P' mode). 
        # The Inky display expects this format.

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
