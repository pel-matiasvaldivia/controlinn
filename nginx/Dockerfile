FROM nginx:1.25-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Crear el directorio para los streams HLS
RUN mkdir -p /var/www/streams && chmod -R 755 /var/www/streams

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
