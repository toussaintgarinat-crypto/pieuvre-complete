# ====================================================================
# Dockerfile - Pieuvre OCR (microservice d'extraction de plans)
# ====================================================================

FROM node:18-alpine

LABEL maintainer="Toussaint Garinat"
LABEL description="Pieuvre Auto - Service OCR"

WORKDIR /app

COPY pieuvre-ocr/package*.json ./
RUN npm install --production

COPY pieuvre-ocr/ ./

# Partage de la logique OCR avec l'API
RUN mkdir -p /app/services
COPY pieuvre-api/services/ocr.js /app/services/ocr.js

EXPOSE 3002

ENV PORT=3002
ENV NODE_ENV=production

CMD ["node", "server.js"]
