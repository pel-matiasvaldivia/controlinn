const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const { authenticateToken } = require('../middleware/authMiddleware');

// Registrar o cambiar la URL de RTSP (opcional en runtime)
let activeRtspUrl = process.env.RTSP_STREAM_URL || 'rtsp://ffmpeg:8554/live/stream';

router.post('/stream', authenticateToken, (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'La URL de RTSP es requerida.' });
  }
  activeRtspUrl = url;
  res.json({ success: true, message: 'URL de cámara RTSP actualizada correctamente.', activeRtspUrl });
});

// Capturar fotograma en vivo desde RTSP y retornar JPEG directamente
router.get('/capture', authenticateToken, (req, res) => {
  console.log(`[RTSP-CAPTURE] Capturando fotograma desde: ${activeRtspUrl}`);

  res.setHeader('Content-Type', 'image/jpeg');

  // Spawn ffmpeg para tomar 1 frame y escribirlo en stdout en formato MJPEG
  const ffmpeg = spawn('ffmpeg', [
    '-rtsp_transport', 'tcp',
    '-y',
    '-i', activeRtspUrl,
    '-vframes', '1',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-'
  ]);

  ffmpeg.stdout.pipe(res);

  // Manejo de errores
  let errorMsg = '';
  ffmpeg.stderr.on('data', (data) => {
    errorMsg += data.toString();
  });

  ffmpeg.on('close', (code) => {
    if (code !== 0) {
      console.error(`[RTSP-CAPTURE] FFmpeg falló con código ${code}. Error: ${errorMsg}`);
      if (!res.headersSent) {
        res.status(500).json({ error: 'No se pudo conectar a la cámara RTSP para capturar el fotograma.' });
      }
    } else {
      console.log('[RTSP-CAPTURE] Captura enviada con éxito.');
    }
  });
});

module.exports = router;
