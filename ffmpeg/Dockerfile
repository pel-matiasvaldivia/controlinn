FROM alpine:3.18

# Instalar FFmpeg, fuentes tipográficas para dibujar la patente y herramientas
RUN apk add --no-cache ffmpeg ttf-dejavu wget tar

# Descargar e instalar MediaMTX (servidor RTSP/HLS ligero)
WORKDIR /app
RUN wget https://github.com/bluenviron/mediamtx/releases/download/v1.6.0/mediamtx_v1.6.0_linux_amd64.tar.gz && \
    tar -xzf mediamtx_v1.6.0_linux_amd64.tar.gz && \
    rm mediamtx_v1.6.0_linux_amd64.tar.gz

COPY start-ffmpeg.sh /app/start-ffmpeg.sh
RUN sed -i 's/\r$//' /app/start-ffmpeg.sh && chmod +x /app/start-ffmpeg.sh

ENTRYPOINT ["/app/start-ffmpeg.sh"]
