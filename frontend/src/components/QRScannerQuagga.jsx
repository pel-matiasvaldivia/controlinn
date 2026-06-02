import React, { useEffect, useRef } from 'react';
import Quagga from 'quagga';
import './QRScannerQuagga.css';

const QRScannerQuagga = ({ onSuccess, onError, onClose }) => {
  const scannerRef = useRef(null);

  useEffect(() => {
    Quagga.init({
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: scannerRef.current,
        constraints: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment"
        },
      },
      locator: {
        patchSize: "medium",
        halfSample: true
      },
      numOfWorkers: navigator.hardwareConcurrency || 4,
      decoder: {
        readers: ["qr_reader"] // Solo QR para DNI según guía
      },
      locate: true,
      frequency: 10
    }, (err) => {
      if (err) {
        console.error(err);
        if (onError) onError(err);
        return;
      }
      Quagga.start();
    });

    Quagga.onDetected(handleDetected);

    return () => {
      Quagga.offDetected(handleDetected);
      Quagga.stop();
    };
  }, []);

  const handleDetected = (result) => {
    if (!result || !result.codeResult) return;
    
    const rawData = result.codeResult.code;
    console.log('[QUAGGA] Detectado:', rawData);

    const parsedData = parseDNIData(rawData);
    if (parsedData && onSuccess) {
      onSuccess(parsedData);
    }
  };

  /**
   * Parseo de datos del DNI Argentino (Formato URL o Delimitado)
   */
  const parseDNIData = (text) => {
    try {
      // Reutilizamos lógica de parseo del proyecto
      if (text.includes('dni=')) {
        const urlParams = new URLSearchParams(text.split('?')[1]);
        return {
          dni: urlParams.get('dni'),
          apellido: (urlParams.get('apellido') || '').toUpperCase(),
          nombre: (urlParams.get('nombre') || '').toUpperCase(),
          sexo: urlParams.get('sexo'),
          fecha_nacimiento: urlParams.get('nacimiento')
        };
      }
      // Otros formatos...
      return { dni: text, raw: text }; // Fallback
    } catch (e) {
      return null;
    }
  };

  return (
    <div className="quagga-modal-overlay">
      <div className="quagga-modal-container">
        <div className="quagga-header">
          <h3>Escanear QR del DNI</h3>
          <button onClick={onClose} className="quagga-close-btn">&times;</button>
        </div>
        <div ref={scannerRef} className="quagga-viewport">
          {/* Quagga insertará el video aquí */}
          <div className="quagga-guide-overlay"></div>
        </div>
        <div className="quagga-footer">
          <p>Encuadre el código QR del dorso del DNI</p>
        </div>
      </div>
    </div>
  );
};

export default QRScannerQuagga;
