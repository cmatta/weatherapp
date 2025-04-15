# /home/pi/weatherframe/display_on_pi.py

from inky.inky_uc8159 import Inky
from PIL import Image
import os
import time

# --- Configuration ---
# Path where the NFS share is mounted on the Pi Zero
NFS_MOUNT_PATH = "/mnt/weatherframe"  # <<< CHANGE THIS TO YOUR ACTUAL MOUNT POINT
IMAGE_FILENAME = "inky_frame.png"
IMAGE_FULL_PATH = os.path.join(NFS_MOUNT_PATH, IMAGE_FILENAME)
CHECK_INTERVAL_SECONDS = 10 # How often to check for a new image file if not found initially
MAX_WAIT_SECONDS = 300 # Max time to wait for the image file to appear (5 minutes)

def display_image():
    print(f"Looking for image file: {IMAGE_FULL_PATH}")
    
    start_time = time.time()
    image_found = False
    while time.time() - start_time < MAX_WAIT_SECONDS:
        if os.path.exists(IMAGE_FULL_PATH):
            print("Image file found.")
            image_found = True
            break
        else:
            print(f"Image not found, checking again in {CHECK_INTERVAL_SECONDS}s...")
            time.sleep(CHECK_INTERVAL_SECONDS)
            
    if not image_found:
        print(f"Error: Image file not found at {IMAGE_FULL_PATH} after waiting {MAX_WAIT_SECONDS}s. Exiting.")
        return

    try:
        print("Loading image from NFS share...")
        # Open the image using Pillow
        img = Image.open(IMAGE_FULL_PATH)
        
        # Optional: Verify image size (should be 800x480)
        if img.size != (800, 480):
             print(f"Warning: Image size is {img.size}, expected (800, 480).")
             # Optionally resize, but ideally the generator script ensures the correct size
             # img = img.resize((800, 480))

        # Note: The image is already palettized ('P' mode). 
        # The Inky library expects this format.

        print("Initializing Inky display...")
        # Saturation can be adjusted (0.0 to 1.0) if colors look off
        inky_display = Inky() 
        
        print("Sending image to Inky display...")
        inky_display.set_image(img)
        
        print("Updating Inky display (this may take a while)...")
        inky_display.show()
        print("Inky display update complete.")

    except FileNotFoundError:
        print(f"Error: Image file suddenly disappeared from {IMAGE_FULL_PATH}")
    except Exception as e:
        print(f"An error occurred: {e}")
        print("Please ensure the Inky library is installed, SPI is enabled, the display is connected,")
        print(f"and the NFS mount point '{NFS_MOUNT_PATH}' is correct and accessible.")

if __name__ == "__main__":
    display_image()
