# --- ETAPA 1: BUILD ---
FROM node:18-alpine AS builder

# Instalar dependencias del sistema requeridas para better-sqlite3
RUN apk add --no-cache python3 make g++ gcc sqlite-dev

WORKDIR /app

COPY package*.json ./
RUN npm install

# Copiar el resto del código (solo para asegurar que si hay scripts de construcción se ejecuten)
COPY . .

# --- ETAPA 2: RUNTIME ---
FROM node:18-alpine AS runtime

# Instalar solo FFmpeg (dependencia de ejecución)
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copiar node_modules y el código desde la etapa de build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src

# Crear directorio para la base de datos sqlite si no existe
RUN mkdir -p data

EXPOSE 3000

# Por defecto corremos en modo producción (o desarrollo si se sobreescribe en compose)
CMD ["node", "src/app.js"]
