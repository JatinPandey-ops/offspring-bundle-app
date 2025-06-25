# Use Node.js 20 (Debian slim)
FROM node:20-slim

# Install OpenSSL and optional build tools
RUN apt-get update && apt-get install -y openssl build-essential

# Set working directory
WORKDIR /app

# Add runtime environment variables
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=production

# Copy package files first for caching
COPY package.json package-lock.json* ./

# Fix rollup native module issue by ensuring fresh install
RUN rm -rf node_modules && npm install

# Copy remaining files
COPY . .

# Generate Prisma client and build Remix
RUN npx prisma generate && npm run build

# Optional: Recreate .env inside container (only if your app needs it this way)
RUN echo "DATABASE_URL=$DATABASE_URL" > .env

# Expose port
EXPOSE 3000

# Start app
CMD ["npm", "run", "docker-start"]
