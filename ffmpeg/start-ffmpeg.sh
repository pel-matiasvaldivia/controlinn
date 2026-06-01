#!/bin/sh

echo "Iniciando simulador de CCTV RTSP y transcodificador HLS..."

# Crear directorio de streams si no existe
mkdir -p /app/streams

# 1. Iniciar MediaMTX (servidor RTSP) en segundo plano
./mediamtx &
MEDIAMTX_PID=$!

# Esperar a que el servidor RTSP esté listo
sleep 2

# 2. Iniciar generador de stream RTSP simulado en segundo plano
# Dibuja un fondo gris oscuro y un cuadro blanco tipo "patente" con el texto 'AE 582 XZ' legible para el OCR
echo "Iniciando emulación de cámara RTSP con patente 'AE 582 XZ'..."
ffmpeg -re -f lavfi -i color=c=0x1a1a2e:s=640x480:r=25 \
  -vf "drawbox=x=120:y=190:w=400:h=100:color=white:t=fill,drawtext=fontfile=/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf:text='AE 582 XZ':x=(w-text_w)/2:y=210:fontsize=64:fontcolor=0x111111" \
  -c:v libx264 -preset superfast -tune zerolatency \
  -f rtsp -rtsp_transport tcp rtsp://localhost:8554/live/stream &
STREAM_GEN_PID=$!

# 3. Iniciar transcodificación de RTSP a HLS en bucle para tolerancia a fallos
echo "Iniciando transcodificación RTSP -> HLS..."
(
  while true; do
    ffmpeg -rtsp_transport tcp -i ${RTSP_URL:-rtsp://localhost:8554/live/stream} \
      -c:v copy \
      -f hls \
      -hls_time 2 \
      -hls_list_size 5 \
      -hls_flags delete_segments \
      -hls_segment_filename '/app/streams/stream_%03d.ts' \
      /app/streams/stream.m3u8
    echo "El transcodificador se detuvo. Reiniciando en 2 segundos..."
    sleep 2
  done
) &
TRANSCODER_PID=$!

# Función para limpiar procesos al salir
cleanup() {
  echo "Deteniendo procesos..."
  kill $MEDIAMTX_PID
  kill $STREAM_GEN_PID
  kill $TRANSCODER_PID
  exit 0
}

trap cleanup INT TERM

# Mantener el script en ejecución
wait
