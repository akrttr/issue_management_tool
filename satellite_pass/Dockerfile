FROM python:3.12-slim

WORKDIR /app

# System deps if you need any (kept minimal here)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential net-tools  iputils-ping telnet\
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV PYTHONPATH=/app

CMD ["python", "-m", "app.api"]
