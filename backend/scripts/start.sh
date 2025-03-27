#!/bin/bash
# Script to start the backend server with proper configuration

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if Redis is running
if command -v redis-cli > /dev/null && ! redis-cli ping > /dev/null 2>&1; then
  echo "Starting Redis server..."
  if command -v brew > /dev/null; then
    brew services start redis
  else
    echo "Redis not running. Please start Redis manually."
  fi
fi

# Kill any existing Node processes for this app
pkill -f "node.*backend" || true

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Warning: .env file not found. Creating from .env.example"
  cp .env.example .env
fi

# Start the server
echo "Starting server..."
npm run dev 