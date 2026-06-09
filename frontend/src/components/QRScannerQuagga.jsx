import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import './QRScannerQuagga.css';

const QRScannerQuagga = ({ onSuccess, onError, onClose }) => {
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const [lastScanTime, setLastScanTime] = useState(0);
  const [scanStatus, setScanStatus] = useState('idle');

  useEffect(() => {
    if (!videoRef.current) return;

    // Configurar ZXing para que busque PDF417 y QR
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.PDF_417,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.CODE_128
    ]);

    const codeReader = new BrowserMultiFormatReader(hints);
    codeReaderRef.current = codeReader;

    const startScanning = async () => {
      try {
        const constraints = {
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };

        console.log("[SCANNER] Solicitando cámara con restricciones:", constraints);
        
        await codeReader.decodeFromConstraints(constraints, videoRef.current, (result, err) => {
          if (result) {
            handleDetected(result.getText());
          }
        });
        
        console.log("[SCANNER] Lector iniciado correctamente.");
      } catch (err) {
        console.error("[SCANNER] Error de inicialización catastrófico:", err);
        if (onError) onError(err);
      }
    };

    startScanning();

    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
  }, []);

  const handleDetected = (rawData) => {
    // Antirreboter
    const now = Date.now();
    if (now - lastScanTime < 3000) return;

    console.log('[SCANNER] Detectado:', rawData);

    // Feedback Sensorial
    provideFeedback(true);

    const parsedData = parseDNIData(rawData);
    if (parsedData && onSuccess) {
      setLastScanTime(now);
      onSuccess(parsedData);
    }
  };

  const provideFeedback = (success) => {
    if (success) {
      setScanStatus('success');
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
      const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
      audio.play().catch(e => console.warn("Audio play blocked", e));
      
      setTimeout(() => setScanStatus('idle'), 1000);
    }
  };

  const parseDNIData = (text) => {
    try {
      const fields = text.split(/[|@"]/);
      if (fields.length >= 8) {
        const dni = fields.find(f => /^\d{7,8}$/.test(f));
        return {
          dni: dni || fields[4],
          apellido: fields[1],
          nombre: fields[2],
          sexo: fields[3],
          fecha_nacimiento: fields[6],
          raw: text
        };
      }
      return { dni: text, raw: text };
    } catch (e) {
      return { dni: text, raw: text };
    }
  };

  return (
    <div className="quagga-modal-overlay">
      <div className={`quagga-modal-container ${scanStatus === 'success' ? 'border-brand-success' : ''}`}>
        <div className="quagga-header">
          <h3>Escáner DNI / Código</h3>
          <button onClick={onClose} className="quagga-close-btn">&times;</button>
        </div>
        <div className="quagga-viewport">
          <video 
            ref={videoRef} 
            className="w-full h-full object-cover"
            playsInline
          />
          <div className={`quagga-guide-overlay ${scanStatus === 'success' ? 'border-brand-success bg-brand-success/20' : ''}`}></div>
        </div>
        <div className="quagga-footer">
          <p>Apunte al código de barras al dorso del DNI</p>
        </div>
      </div>
    </div>
  );
};

export default QRScannerQuagga;
