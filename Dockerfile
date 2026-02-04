# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for PDF processing and general utilities
RUN apt-get update && apt-get install -y \
    build-essential \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Create directories for uploads and snapshots (will be used as fallback)
RUN mkdir -p uploads snapshots

# Expose port (Render will provide PORT env var)
EXPOSE 8000

# Command to run uvicorn
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
