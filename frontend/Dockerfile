FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

# Copiar el código fuente
COPY . .

EXPOSE 3001

CMD ["sh", "-c", "npm install && npm run dev"]
