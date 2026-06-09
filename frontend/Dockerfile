# --- ETAPA 1: BUILD ---
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# --- ETAPA 2: PRODUCTION ---
FROM node:18-alpine AS runtime

WORKDIR /app

# Instalar un servidor estático ligero
RUN npm install -g serve

# Copiar solo la carpeta de construcción
COPY --from=builder /app/dist ./dist

EXPOSE 3001

# Servir la aplicación en el puerto 3001 para que Nginx pueda proxearlo
CMD ["serve", "-s", "dist", "-l", "3001"]
