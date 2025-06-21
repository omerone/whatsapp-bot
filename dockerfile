# Base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy only the package files first for caching
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm install

# Install Puppeteer's Chromium dependencies
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libgbm1 \
    libpango-1.0-0 \
    libxshmfence1 \
    libglu1-mesa \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy the entire project into the container
COPY . .

# Set working directory inside the container to src
WORKDIR /app/src

# Expose the port your app uses (adjust if needed)
EXPOSE 3000

# Start with nodemon
CMD ["node", "index.js"]