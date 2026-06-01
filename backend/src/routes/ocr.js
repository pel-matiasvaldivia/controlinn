const express = require('express');
const router = express.Router();
const multer = require('multer');
const { detectLicensePlate } = require('../services/ocrService');
const { authenticateToken } = require('../middleware/authMiddleware');

// Configuración de Multer para recibir imágenes en memoria
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024 // Limite de 5MB
  },
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
      return cb(new Error('Formato de imagen no soportado (use JPG, PNG, WEBP).'));
    }
    cb(undefined, true);
  }
});

// Endpoint para detectar patente en imagen
// Soporta base64 (JSON) y subida de archivos (Multipart)
router.post('/detect-plate', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    let imageBuffer;

    if (req.file) {
      // Subido por multipart
      imageBuffer = req.file.buffer;
    } else if (req.body.image) {
      // Pasado por base64
      const base64Data = req.body.image.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    }

    if (!imageBuffer) {
      return res.status(400).json({ error: 'Debe proveer una imagen en el campo "image" (archivo o base64).' });
    }

    const ocrResult = await detectLicensePlate(imageBuffer);
    
    // Devolvemos el resultado
    res.json(ocrResult);

  } catch (err) {
    console.error('[OCR-ROUTE] Error procesando OCR:', err.message);
    res.status(500).json({ error: `Fallo en el reconocimiento de patente: ${err.message}` });
  }
});

module.exports = router;
