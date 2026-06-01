const { createWorker } = require('tesseract.js');

let worker = null;

/**
 * Inicializa el worker de Tesseract si no existe.
 */
async function getWorker() {
  if (!worker) {
    console.log('[OCR-SERVICE] Inicializando worker persistente...');
    const { createWorker } = require('tesseract.js');
    // En v4+, la inicialización explícita suele ser más estable para workers persistentes
    worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -',
    });
  }
  return worker;
}

/**
 * Procesa una imagen en buffer para detectar patentes.
 * @param {Buffer} imageBuffer Buffer de la imagen capturada.
 * @returns {Promise<Object>} Resultado del OCR con la patente detectada y confianza.
 */
async function detectLicensePlate(imageBuffer) {
  if (!imageBuffer) {
    throw new Error('No se proveyó ninguna imagen para el análisis OCR.');
  }

  try {
    const ocrWorker = await getWorker();
    
    console.log('[OCR-SERVICE] Procesando imagen...');
    const { data: { text, confidence } } = await ocrWorker.recognize(imageBuffer);
    
    console.log(`[OCR-SERVICE] Texto reconocido: "${text.trim()}" (Confianza: ${confidence}%)`);

    // Procesar y normalizar el texto extraído
    const detectedPlate = extractArgentinePlate(text);

    return {
      success: !!detectedPlate,
      plate: detectedPlate || null,
      rawText: text.trim(),
      confidence: confidence
    };
  } catch (err) {
    console.error('[OCR-SERVICE] Error en reconocimiento OCR:', err);
    // Si falla, reseteamos el worker por si quedó en estado corrupto
    if (worker) {
      try { await worker.terminate(); } catch(e) {}
      worker = null;
    }
    throw err;
  }
}

/**
 * Busca y extrae una patente argentina en el texto crudo.
 * Patente clásica: 3 letras + 3 números (AAA 123)
 * Patente Mercosur: 2 letras + 3 números + 2 letras (AA 123 BB)
 * @param {string} text Texto crudo
 */
function extractArgentinePlate(text) {
  if (!text) return null;

  // Limpiar caracteres, dejar letras y números en mayúsculas
  const cleanText = text.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // 1. Intentar buscar patente Mercosur (Ej: AA123BB)
  // Expresión regular: 2 letras + 3 números + 2 letras
  const mercosurMatch = cleanText.match(/[A-Z]{2}\d{3}[A-Z]{2}/);
  if (mercosurMatch) {
    const raw = mercosurMatch[0];
    // Retornamos formateado: AA 123 BB
    return `${raw.substring(0,2)} ${raw.substring(2,5)} ${raw.substring(5,7)}`;
  }

  // 2. Intentar buscar patente Clásica (Ej: AAA123)
  // Expresión regular: 3 letras + 3 números
  const classicMatch = cleanText.match(/[A-Z]{3}\d{3}/);
  if (classicMatch) {
    const raw = classicMatch[0];
    // Retornamos formateado: AAA 123
    return `${raw.substring(0,3)} ${raw.substring(3,6)}`;
  }

  // 3. Búsqueda flexible en caso de que falte alguna letra o número (por ejemplo, si OCR falló levemente)
  // Si encontramos cualquier secuencia alfanumérica de 6 o 7 caracteres que se parezca a una patente
  // Por ejemplo, "AA123B" o "A123BB"
  const genericMatch = cleanText.match(/[A-Z0-9]{6,7}/);
  if (genericMatch) {
    // Si tiene 7 caracteres, asumimos formato Mercosur
    const raw = genericMatch[0];
    if (raw.length === 7) {
      return `${raw.substring(0,2)} ${raw.substring(2,5)} ${raw.substring(5,7)}`;
    } else if (raw.length === 6) {
      return `${raw.substring(0,3)} ${raw.substring(3,6)}`;
    }
  }

  return null;
}

module.exports = {
  detectLicensePlate,
  extractArgentinePlate
};
