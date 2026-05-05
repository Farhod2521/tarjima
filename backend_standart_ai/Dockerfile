FROM python:3.12-slim

WORKDIR /app

# PyMuPDF uchun kerakli sistem kutubxonalari
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmupdf-dev \
    mupdf-tools \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
