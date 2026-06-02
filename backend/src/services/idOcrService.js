const { createWorker } = require('tesseract.js');

let worker = null;

async function getWorker() {
  if (!worker) {
    worker = await createWorker();
    await worker.loadLanguage('spa+eng');
    await worker.initialize('spa+eng');
    
    // Para DNIs necesitamos letras y números
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -/.',
    });
  }
  return worker;
}

/**
 * Procesa una imagen para extraer datos de DNI o Licencia.
 */
async function detectIdCard(imageBuffer) {
  if (!imageBuffer) throw new Error('Imagen requerida');

  try {
    const ocrWorker = await getWorker();
    const { data: { text, confidence } } = await ocrWorker.recognize(imageBuffer);
    
    console.log(`[ID-OCR] Texto reconocido (Confianza: ${confidence}%):`, text);

    const extractedData = parseIdData(text);

    return {
      success: !!(extractedData.dni || extractedData.last_name),
      data: extractedData,
      rawText: text,
      confidence
    };
  } catch (err) {
    console.error('[ID-OCR] Error:', err);
    if (worker) {
      try { await worker.terminate(); } catch(e) {}
      worker = null;
    }
    throw err;
  }
}

/**
 * Intento de parseo de datos de DNI Argentino Moderno / Licencia
 */
function parseIdData(text) {
  const lines = text.split('\n').map(l => l.trim().toUpperCase()).filter(l => l.length > 2);
  
  let data = {
    first_name: null,
    last_name: null,
    dni: null,
    birth_date: null
  };

  // 1. DNI (Secuencia de 7 u 8 dígitos)
  const dniMatch = text.match(/\b\d{1,2}\.?\d{3}\.?\d{3}\b/);
  if (dniMatch) {
    data.dni = dniMatch[0].replace(/\./g, '');
  }

  // 2. Fecha de nacimiento (DD/MM/AAAA o DD-MM-AAAA)
  const dateMatch = text.match(/\b(\d{2})[/-](\d{2})[/-](\d{4})\b/);
  if (dateMatch) {
    data.birth_date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  }

  // 3. Nombres y Apellidos
  // En DNI moderno suele haber etiquetas como "APELLIDO/SURNAME" y "NOMBRE/GIVEN NAMES"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Apellido
    if (line.includes('APELLIDO') && i + 1 < lines.length) {
      // Tomamos la siguiente línea que no tenga etiquetas
      const next = lines[i+1];
      if (!next.includes('/') && !next.includes('NOMBRE')) {
        data.last_name = next;
      }
    }
    
    // Nombre
    if (line.includes('NOMBRE') && i + 1 < lines.length) {
      const next = lines[i+1];
      if (!next.includes('/') && !next.includes('APELLIDO')) {
        data.first_name = next;
      }
    }
  }

  // Fallback si no se encontró por etiquetas (búsqueda heurística)
  if (!data.last_name || !data.first_name) {
    // A veces los datos están en líneas consecutivas sin etiquetas claras
    // Buscamos líneas que solo tengan letras
    const alphaLines = lines.filter(l => /^[A-Z\s]{3,}$/.test(l) && !l.includes('REPUBLICA') && !l.includes('ARGENTINA'));
    if (alphaLines.length >= 2) {
      if (!data.last_name) data.last_name = alphaLines[0];
      if (!data.first_name) data.first_name = alphaLines[1];
    }
  }

  return data;
}

module.exports = {
  detectIdCard
};
