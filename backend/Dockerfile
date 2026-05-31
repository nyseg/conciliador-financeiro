FROM python:3.11-slim

# Instala Tesseract e língua portuguesa no mesmo container que vai rodar a API
# (no Render nativo, apt-get instala no build mas não persiste no runtime)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        tesseract-ocr \
        tesseract-ocr-por \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia e instala dependências Python antes do código (aproveita cache de layers)
COPY requirements.txt .
RUN pip install --no-cache-dir --prefer-binary -r requirements.txt

# Copia o restante do código
COPY . .

EXPOSE 8000

# PORT é injetado pelo Render em runtime
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
