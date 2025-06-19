# Base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy only the package files first for caching
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm install

# Copy the entire project into the container
COPY . .

# Set working directory inside the container to src
WORKDIR /app/src

# Expose the port your app uses (adjust if needed)
EXPOSE 3000

# Start with nodemon
CMD ["node", "index.js"]