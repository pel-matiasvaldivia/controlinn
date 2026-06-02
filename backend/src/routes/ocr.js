const express = require('express');
const router = express.Router();
const multer = require('multer');
const { detectLicensePlate } = require('../services/ocrService');
const { detectIdCard } = require('../services/idOcrService');
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
router.post('/detect-plate', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    let imageBuffer;
    if (req.file) imageBuffer = req.file.buffer;
    else if (req.body.image) {
      const base64Data = req.body.image.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    }

    if (!imageBuffer) return res.status(400).json({ error: 'Imagen requerida.' });

    const ocrResult = await detectLicensePlate(imageBuffer);
    res.json(ocrResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para detectar datos de DNI/Licencia
router.post('/detect-id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    let imageBuffer;
    if (req.file) imageBuffer = req.file.buffer;
    else if (req.body.image) {
      const base64Data = req.body.image.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    }

    if (!imageBuffer) return res.status(400).json({ error: 'Imagen requerida.' });

    const ocrResult = await detectIdCard(imageBuffer);
    res.json(ocrResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
