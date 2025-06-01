FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
# Don't copy .env files
COPY . .
RUN rm -rf .env* 
RUN npm run build

FROM node:18-alpine
WORKDIR /app

# Install Playwright dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dbus \
    eudev \
    xvfb \
    libxrandr \
    libxcomposite \
    libxi \
    libxtst \
    libxscrnsaver \
    alsa-lib

# Tell Playwright to use the installed Chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
EXPOSE 3000
CMD ["npm", "start"]