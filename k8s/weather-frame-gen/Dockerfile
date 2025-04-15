# Use the official Playwright image which includes browsers and dependencies
# Using focal (Ubuntu 20.04) as a base often works well
FROM mcr.microsoft.com/playwright/python:v1.48.0-focal

# Set the working directory inside the container
WORKDIR /app

# Install Pillow and any potential system dependencies it might need 
# (Playwright base image should have most common ones)
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     libjpeg-dev zlib1g-dev libtiff-dev libopenjp2-7-dev \
#  && rm -rf /var/lib/apt/lists/* 
# (Commented out: Playwright base image *might* already have these, try without first)

# Install Python dependencies. Explicitly include playwright just in case.
RUN pip install playwright Pillow

# Copy the script into the container
COPY generate_frame.py .

# Create the default output directory (will be overridden by NFS mount)
RUN mkdir /output

# Command to run the script when the container starts
# Pass the APP_URL via environment variable in Kubernetes deployment/cronjob spec
CMD ["python", "generate_frame.py"]
