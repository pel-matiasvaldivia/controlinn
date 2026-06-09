import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Camera, X, Check, ArrowRight, UserPlus, AlertCircle } from 'lucide-react';

export default function QRScanner() {
  const { registerPersonAccess, error, successMsg, setError, clearMessages } = useStore();
  
  const [scanning, setScanning] = useState(false);
  const [scannedPerson, setScannedPerson] = useState(null);
  const [accessType, setAccessType] = useState('ENTRADA'); // 'ENTRADA' | 'SALIDA'
  const [manualMode, setManualMode] = useState(true);
  
  // Formulario manual
  const [manualForm, setManualForm] = useState({
    dni: '',
    first_name: '',
    last_name: ''
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const codeReaderRef = useRef(null);
  const nativeDetectorRef = useRef(null);

  // Reproducir un pitido de confirmación mediante Web Audio API (100% offline)
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Tono alto agradable
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 150);

      // Vibrar celular si es soportado
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    } catch (e) {
      console.warn('AudioContext no soportado:', e.message);
    }
  };

  // Procesar código leído (QR o PDF417 de DNI / Licencia de Conducir Argentina)
  const processBarcodeData = (rawText) => {
    if (!rawText) return;
    
    console.log('[SCANNER] Código detectado:', rawText);
    
    try {
      let dni = '';
      let lastName = '';
      let firstName = '';
      let gender = '';
      let birthDate = '';
      
      const cleanText = rawText.trim().replace(/\r/g, '');
      
      // Caso 1: Formato URL (ej. QR de parte trasera del DNI)
      if (cleanText.includes('?') || cleanText.startsWith('http')) {
        const urlString = cleanText;
        const urlParams = new URLSearchParams(urlString.split('?')[1] || urlString);
        
        dni = urlParams.get('dni') || '';
        lastName = (urlParams.get('apellido') || '').toUpperCase();
        firstName = (urlParams.get('nombre') || '').toUpperCase();
        gender = (urlParams.get('sexo') || '').toUpperCase();
        const rawBirth = urlParams.get('nacimiento') || urlParams.get('fechaNac') || '';
        
        if (rawBirth) {
          const dateMatch = rawBirth.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
          if (dateMatch) {
            birthDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
          } else {
            birthDate = rawBirth;
          }
        }
      } 
      // Caso 2: Formato delimitado PDF417 (DNI frente y Licencias de Conducir)
      else {
        // Dividir por cualquier delimitador común
        const fields = cleanText.split(/[@%|,]/).map(f => f.trim());
        
        if (fields.length >= 3) {
          // Encontrar DNI (número de 7 a 9 dígitos)
          let dniIndex = fields.findIndex(f => /^\d{7,9}$/.test(f));
          
          if (dniIndex === -1) {
            dniIndex = fields.findIndex(f => {
              const clean = f.replace(/^0+/, '');
              return /^\d{7,9}$/.test(clean);
            });
          }

          if (dniIndex !== -1) {
            dni = fields[dniIndex].replace(/^0+/, '');
            
            // DNI Argentino Moderno (DNI en index 4, datos anteriores)
            if (dniIndex >= 4 && fields[dniIndex - 3] && fields[dniIndex - 2]) {
              lastName = fields[dniIndex - 3].toUpperCase();
              firstName = fields[dniIndex - 2].toUpperCase();
              gender = fields[dniIndex - 1].toUpperCase();
              
              const rawBirth = fields[dniIndex + 2] || '';
              const dateMatch = rawBirth.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
              if (dateMatch) {
                birthDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
              }
            } 
            // DNI Clásico o Licencia de Conducir Argentina (DNI al inicio)
            else if (dniIndex + 2 < fields.length) {
              lastName = fields[dniIndex + 1].toUpperCase();
              firstName = fields[dniIndex + 2].toUpperCase();
              
              if (dniIndex + 3 < fields.length) {
                const sexField = fields[dniIndex + 3].toUpperCase();
                if (['M', 'F', 'X'].includes(sexField)) {
                  gender = sexField;
                }
              }
              
              // Buscar fecha de nacimiento en campos siguientes
              for (let j = dniIndex + 3; j < fields.length; j++) {
                if (fields[j]) {
                  const dateMatch = fields[j].match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
                  if (dateMatch) {
                    birthDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
                    break;
                  }
                }
              }
            }
          }
        }
      }
      
      if (dni && /^\d{6,10}$/.test(dni) && (lastName || firstName)) {
        playBeep();
        stopCamera();
        
        setScannedPerson({
          dni,
          first_name: firstName || 'DESCONOCIDO',
          last_name: lastName || 'DOCUMENTO',
          gender: gender || 'M',
          birth_date: birthDate || '',
          qrData: cleanText
        });
      } else {
        console.warn('[SCANNER] Código detectado pero no es un DNI válido:', rawText);
        clearMessages();
        setError('TOMA FALLIDA: El código escaneado no contiene un formato de DNI válido.');
      }
    } catch (err) {
      console.error('[SCANNER] Error decodificando código:', err);
      clearMessages();
      setError('TOMA FALLIDA: Error al procesar los datos del documento.');
    }
  };

  const startCamera = async () => {
    clearMessages();
    setScannedPerson(null);
    setManualMode(false);
    setScanning(true);
    
    try {
      const constraints = {
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        
        // 1. Intentar usar BarcodeDetector nativo del navegador si está disponible (Ultra rápido, acelerado por hardware)
        if ('BarcodeDetector' in window) {
          const supportedFormats = await window.BarcodeDetector.getSupportedFormats();
          if (supportedFormats.includes('qr_code') && supportedFormats.includes('pdf417')) {
            console.log('[SCANNER] Usando BarcodeDetector Nativo por Hardware!');
            const detector = new window.BarcodeDetector({ formats: ['qr_code', 'pdf417'] });
            nativeDetectorRef.current = detector;
            
            const nativeScan = async () => {
              if (!scanning || !videoRef.current) return;
              try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  processBarcodeData(barcodes[0].rawValue);
                  return;
                }
              } catch (err) {
                console.error('[SCANNER] Error en detector nativo:', err);
              }
              if (streamRef.current) {
                requestAnimationFrame(nativeScan);
              }
            };
            requestAnimationFrame(nativeScan);
            return;
          }
        }

        // 2. Si no es soportado nativo, usar ZXing cargado localmente de forma segura
        if (window.ZXing) {
          console.log('[SCANNER] Usando ZXing cargado localmente.');
          const codeReader = new window.ZXing.BrowserMultiFormatReader();
          codeReaderRef.current = codeReader;
          
          codeReader.decodeFromVideoElement(videoRef.current, (result, err) => {
            if (result) {
              processBarcodeData(result.getText());
            }
            if (err && !(err.name === 'NotFoundException')) {
              console.error('[SCANNER] Error de lectura ZXing:', err);
            }
          });
        } else {
          console.error('[SCANNER] ZXing no cargó correctamente.');
          alert('Error de inicialización: El escáner de códigos no está disponible.');
        }
      }
    } catch (err) {
      console.error('Error accediendo a la cámara:', err);
      alert('No se pudo acceder a la cámara. Asegúrese de otorgar permisos.');
      setScanning(false);
    }
  };

  // Detener cámara
  const stopCamera = () => {
    setScanning(false);
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    nativeDetectorRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Confirmar y registrar el acceso escaneado
  const handleConfirmAccess = async () => {
    if (!scannedPerson) return;
    
    const success = await registerPersonAccess(
      scannedPerson.dni,
      accessType,
      scannedPerson
    );
    
    if (success) {
      setScannedPerson(null);
    }
  };

  // Enviar formulario manual
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.dni || !manualForm.first_name || !manualForm.last_name) {
      alert('Por favor complete los campos obligatorios.');
      return;
    }

    const success = await registerPersonAccess(
      manualForm.dni,
      accessType,
      manualForm
    );

    if (success) {
      setManualMode(false);
      setManualForm({ dni: '', first_name: '', last_name: '' });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Botones de acción principales */}
      {/* El modo manual es el predeterminado y el botón de escaneo ha sido removido */}

      {/* Visor de Cámara */}
      {scanning && (
        <div className="relative w-full aspect-[4/3] max-w-md mx-auto rounded-2xl overflow-hidden border-2 border-brand-primary bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Overlay de Guía de escaneo */}
          <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none">
            <div className="flex justify-between items-center w-full">
              <span className="px-3 py-1 bg-black/70 text-xs font-semibold text-brand-primary rounded-full uppercase tracking-wider">Escaneando DNI...</span>
              <button
                onClick={stopCamera}
                className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-full pointer-events-auto active:scale-95 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Cuadro de enfoque */}
            <div className="self-center w-64 h-40 border-2 border-brand-primary border-dashed rounded-xl relative">
              <div className="absolute inset-0 bg-brand-primary/10 animate-pulse rounded-xl"></div>
            </div>
            
            <div className="text-center bg-black/60 py-2 rounded-xl text-xs text-slate-300 px-2">
              Apunte al código de barras (frente) o QR (dorso) del DNI.
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de Datos Escaneados */}
      {scannedPerson && (
        <div className="bg-brand-card p-5 rounded-2xl border border-brand-border shadow-xl">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Check className="w-5 h-5 text-brand-success" />
              <span>DNI Detectado</span>
            </h3>
            <button
              onClick={() => setScannedPerson(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-brand-border transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm mb-5 bg-brand-bg/50 p-4 rounded-xl border border-brand-border/40">
            <div>
              <span className="text-slate-400 text-xs">Apellido</span>
              <p className="font-semibold text-white">{scannedPerson.last_name}</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Nombre</span>
              <p className="font-semibold text-white">{scannedPerson.first_name}</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">DNI</span>
              <p className="font-mono font-bold text-brand-primary">{scannedPerson.dni}</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Sexo</span>
              <p className="font-semibold text-white">{scannedPerson.gender}</p>
            </div>
            {scannedPerson.birth_date && (
              <div className="col-span-2">
                <span className="text-slate-400 text-xs">Fecha de Nacimiento</span>
                <p className="font-semibold text-white">{scannedPerson.birth_date}</p>
              </div>
            )}
          </div>

          {/* Selector de tipo de acceso */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setAccessType('ENTRADA')}
              className={`flex-1 py-3 font-semibold rounded-xl border transition ${
                accessType === 'ENTRADA'
                  ? 'bg-brand-success border-brand-success text-white'
                  : 'bg-transparent border-brand-border text-slate-400 hover:text-white'
              }`}
            >
              INGRESAR (ENTRADA)
            </button>
            <button
              onClick={() => setAccessType('SALIDA')}
              className={`flex-1 py-3 font-semibold rounded-xl border transition ${
                accessType === 'SALIDA'
                  ? 'bg-brand-warning border-brand-warning text-white'
                  : 'bg-transparent border-brand-border text-slate-400 hover:text-white'
              }`}
            >
              EGRESAR (SALIDA)
            </button>
          </div>

          <button
            onClick={handleConfirmAccess}
            className="w-full py-4 bg-brand-primary hover:bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition"
          >
            <span>CONFIRMAR REGISTRO</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Formulario Manual */}
      {manualMode && (
        <form onSubmit={handleManualSubmit} className="bg-brand-card p-5 rounded-2xl border border-brand-border shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white">Ingreso Manual</h3>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-slate-400 text-xs mb-1">DNI *</label>
              <input
                type="text"
                pattern="\d{7,9}"
                maxLength="9"
                required
                className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-white font-mono"
                placeholder="Ej: 28543593"
                value={manualForm.dni}
                onChange={(e) => setManualForm({ ...manualForm, dni: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-xs mb-1">Apellido *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-white uppercase"
                  placeholder="SOSA"
                  value={manualForm.last_name}
                  onChange={(e) => setManualForm({ ...manualForm, last_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-white uppercase"
                  placeholder="MARIA"
                  value={manualForm.first_name}
                  onChange={(e) => setManualForm({ ...manualForm, first_name: e.target.value })}
                />
              </div>
            </div>


            {/* Selector de Acceso */}
            <div>
              <label className="block text-slate-400 text-xs mb-1">Tipo de Registro</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setAccessType('ENTRADA')}
                  className={`flex-1 py-3 font-semibold rounded-xl border transition ${
                    accessType === 'ENTRADA'
                      ? 'bg-brand-success border-brand-success text-white'
                      : 'bg-transparent border-brand-border text-slate-400 hover:text-white'
                  }`}
                >
                  ENTRADA
                </button>
                <button
                  type="button"
                  onClick={() => setAccessType('SALIDA')}
                  className={`flex-1 py-3 font-semibold rounded-xl border transition ${
                    accessType === 'SALIDA'
                      ? 'bg-brand-warning border-brand-warning text-white'
                      : 'bg-transparent border-brand-border text-slate-400 hover:text-white'
                  }`}
                >
                  SALIDA
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-brand-primary hover:bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 mt-2 transition"
            >
              <span>REGISTRAR ACCESO</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </form>
      )}

      {/* Mensajes de feedback */}
      {error && (
        <div className="p-4 bg-brand-danger/10 border border-brand-danger/30 rounded-xl text-brand-danger flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-brand-success/10 border border-brand-success/30 rounded-xl text-brand-success flex items-center gap-3 text-sm">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
}
