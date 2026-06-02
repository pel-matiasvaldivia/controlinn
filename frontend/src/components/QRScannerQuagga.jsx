import React, { useEffect, useRef, useState } from 'react';
import Quagga from '@ericblade/quagga2';
import './QRScannerQuagga.css';

// Sonido de beep (Base64)
const BEEP_SOUND = "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YV9vT18KZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="; // Simplificado

const QRScannerQuagga = ({ onSuccess, onError, onClose }) => {
  const scannerRef = useRef(null);
  const [lastScanTime, setLastScanTime] = useState(0);
  const [scanStatus, setScanStatus] = useState('idle'); // 'idle' | 'success' | 'error'

  useEffect(() => {
    if (!scannerRef.current) return;

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
        // lectores: pdf417 es fundamental para DNI argentino
        readers: ["pdf417_reader", "qrcode_reader", "code_128_reader"]
      },
      locate: true,
      frequency: 10
    }, (err) => {
      if (err) {
        console.error("[QUAGGA] Initialization error:", err);
        if (onError) onError(err);
        return;
      }
      console.log("[QUAGGA] Initialization finished. Ready to start.");
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
    
    // Antirreboter (evitar múltiples escaneos inmediatos)
    const now = Date.now();
    if (now - lastScanTime < 3000) return; 

    const rawData = result.codeResult.code;
    console.log('[QUAGGA] Detectado:', rawData);

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
      // Vibración
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
      // Sonido
      const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
      audio.play().catch(e => console.warn("Audio play blocked", e));
      
      // Reset status after a moment
      setTimeout(() => setScanStatus('idle'), 1000);
    }
  };

  /**
   * Parseo de datos del DNI Argentino
   */
  const parseDNIData = (text) => {
    try {
      // Formato PDF417 Argentino (delimitado por @ o ")
      // Ejemplo: 00508655111@VALDIVIA@MATIAS@M@44123456@A@12/12/1990@12/12/2010@200
      const fields = text.split(/[|@"]/);
      if (fields.length >= 8) {
        // Lógica simplificada: buscamos el DNI (número de 7-8 dígitos)
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
        <div ref={scannerRef} className="quagga-viewport">
          {/* Quagga insertará el video aquí */}
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
