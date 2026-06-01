/**
 * Servicio para procesar y parsear códigos QR y códigos de barras de DNI Argentino
 */

/**
 * Parsea el string crudo escaneado de un DNI argentino.
 * El formato común es delimitado por @:
 * NroTrámite@Apellido@Nombre@Sexo@DNI@Ejemplar@FechaNacimiento@FechaEmision@CodProvincia
 * Ejemplo:
 * 00392301293@SOSA@MARIA ESTHER@F@28543593@A@16/09/1980@14/05/2012@19
 *
 * @param {string} rawText Texto leído del QR/PDF417
 * @returns {Object} Datos extraídos formateados
 */
function parseDniQr(rawText) {
  if (!rawText) {
    throw new Error('El texto del escaneo está vacío.');
  }

  let textToParse = rawText.trim();

  // Si el texto es una URL de Mi Argentina (e.g. mi.argentina.gob.ar/show-dni?data=...)
  if (textToParse.startsWith('http://') || textToParse.startsWith('https://')) {
    try {
      const url = new URL(textToParse);
      const dataParam = url.searchParams.get('data');
      if (dataParam) {
        // En algunos casos el query param está en base64 o es texto plano
        if (dataParam.includes('@')) {
          textToParse = dataParam;
        } else {
          // Decodificar Base64 si es necesario
          const decoded = Buffer.from(dataParam, 'base64').toString('utf-8');
          if (decoded.includes('@')) {
            textToParse = decoded;
          }
        }
      }
    } catch (e) {
      console.warn('[QR-SERVICE] Error intentando parsear URL de DNI:', e.message);
    }
  }

  // Dividir por el delimitador '@'
  const fields = textToParse.split('@');

  // El formato estándar suele tener al menos 8 o 9 campos
  // Formato moderno (9 campos): Tramite@Apellido@Nombre@Sexo@DNI@Ejemplar@FechaNac@FechaEmision@CodProv
  // Formato intermedio (8 campos): sin CodProv
  // Formato antiguo (a veces el DNI está en primer o segundo lugar)
  if (fields.length < 5) {
    throw new Error('El formato del código QR no coincide con un DNI argentino válido.');
  }

  let lastName = '';
  let firstName = '';
  let gender = '';
  let dni = '';
  let birthDate = null;

  // Buscamos mapear los campos inteligentemente basándonos en tipos de datos
  // ya que a veces los DNIs antiguos tienen variaciones.
  
  // En el DNI moderno de Argentina:
  // fields[1] = Apellido
  // fields[2] = Nombre
  // fields[3] = Sexo (M o F)
  // fields[4] = DNI (7 u 8 dígitos numéricos)
  // fields[6] = Fecha Nacimiento (DD/MM/YYYY)
  
  // Vamos a usar una lógica posicional común, pero con validaciones secundarias:
  if (fields[4] && /^\d{7,9}$/.test(fields[4].trim())) {
    // Formato moderno estándar
    dni = fields[4].trim();
    lastName = cleanText(fields[1]);
    firstName = cleanText(fields[2]);
    gender = fields[3].trim().toUpperCase();
    birthDate = parseDateString(fields[6]);
  } else {
    // Fallback dinámico buscando patrones
    console.log('[QR-SERVICE] Formato no estándar, buscando patrones en campos...');
    
    // Buscar DNI (secuencia de 7 a 9 números)
    const dniIndex = fields.findIndex(f => /^\d{7,9}$/.test(f.trim()));
    if (dniIndex !== -1) {
      dni = fields[dniIndex].trim();
      
      // El sexo (M/F) suele estar justo antes del DNI o después
      let genderIndex = fields.findIndex(f => /^[MF]$/i.test(f.trim()));
      if (genderIndex !== -1) {
        gender = fields[genderIndex].trim().toUpperCase();
      }
      
      // Apellido y nombres suelen preceder al sexo
      if (dniIndex > 2) {
        lastName = cleanText(fields[dniIndex - 3]);
        firstName = cleanText(fields[dniIndex - 2]);
      } else if (dniIndex > 1) {
        lastName = cleanText(fields[dniIndex - 2]);
        firstName = cleanText(fields[dniIndex - 1]);
      }
      
      // Buscar campo que sea fecha (DD/MM/YYYY o YYYY-MM-DD)
      const dateField = fields.find(f => /^\d{2}[/-]\d{2}[/-]\d{4}$/.test(f.trim()) || /^\d{4}[/-]\d{2}[/-]\d{2}$/.test(f.trim()));
      if (dateField) {
        birthDate = parseDateString(dateField);
      }
    } else {
      throw new Error('No se pudo localizar el número de DNI en el código escaneado.');
    }
  }

  if (!dni) {
    throw new Error('DNI no válido en el código escaneado.');
  }

  return {
    dni,
    firstName: firstName || 'DESCONOCIDO',
    lastName: lastName || 'DESCONOCIDO',
    gender: gender || 'N/A',
    birthDate: birthDate,
    qrData: textToParse
  };
}

// Limpia caracteres extraños y espacios
function cleanText(text) {
  if (!text) return '';
  return text.trim().toUpperCase().replace(/\s+/g, ' ');
}

// Convierte DD/MM/YYYY a YYYY-MM-DD para compatibilidad de DB
function parseDateString(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  
  // Si ya es YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  
  // Si es DD/MM/YYYY o DD-MM-YYYY
  const match = cleaned.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

module.exports = {
  parseDniQr
};
