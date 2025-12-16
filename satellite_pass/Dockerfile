FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/skyfield-data
ENV SKYFIELD_DATA_PATH=/app/skyfield-data

EXPOSE 8085

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8085/api/health')"

# Run with gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8085", "--workers", "2", "--timeout", "120", "app:app"]