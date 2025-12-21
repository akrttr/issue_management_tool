FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY *.py ./

# Environment variables (override in docker-compose)
ENV PORT=5001
ENV TLE_SOURCE_URL="https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
ENV NORAD_ID="25544"
ENV GS_LATITUDE="39.9334"
ENV GS_LONGITUDE="32.8597"
ENV GS_ALTITUDE="0.9"
ENV MIN_ELEVATION="10"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5001/api/health', timeout=5).raise_for_status()"

# Run application
CMD ["python", "app.py"]