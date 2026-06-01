FROM node:18-alpine

# Instalar dependencias del sistema requeridas para better-sqlite3 y ffmpeg
RUN apk add --no-cache python3 make g++ gcc sqlite-dev ffmpeg

WORKDIR /app

COPY package*.json ./

RUN npm install

# Copiar el resto del código
COPY . .

EXPOSE 3000

# Por defecto corremos en modo desarrollo/hot-reload
CMD ["npm", "run", "dev"]
