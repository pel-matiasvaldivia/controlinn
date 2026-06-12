import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Camera, X, Check, ArrowRight, UserPlus, AlertCircle } from 'lucide-react';

export default function QRScanner() {
  const { registerPersonAccess, error, successMsg, setError, clearMessages, sectors } = useStore();
  
  const [scanning, setScanning] = useState(false);
  const [scannedPerson, setScannedPerson] = useState(null);
  const [accessType, setAccessType] = useState('ENTRADA'); // 'ENTRADA' | 'SALIDA'
  const [manualMode, setManualMode] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Formulario manual
  const [manualForm, setManualForm] = useState({
    dni: '',
    first_name: '',
    last_name: '',
    plate: '',
    origin: '',
    destination: '',
    visitor_type: 'CLIENTE',
    reason: '',
    mechanic_code: ''
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
    if (!scannedPerson || submitting) return;
    setSubmitting(true);
    
    const success = await registerPersonAccess(
      scannedPerson.dni,
      accessType,
      scannedPerson
    );
    
    setSubmitting(false);
    if (success) {
      setScannedPerson(null);
    }
  };

  // Enviar formulario manual
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (manualForm.visitor_type !== 'MECANICO' && !manualForm.dni) {
      alert('Por favor complete el DNI.');
      return;
    }
    if (!manualForm.first_name || !manualForm.last_name) {
      alert('Por favor complete el nombre y apellido.');
      return;
    }

    if (submitting) return;
    setSubmitting(true);

    const success = await registerPersonAccess(
      manualForm.dni,
      accessType,
      manualForm
    );

    setSubmitting(false);

    if (success) {
      setManualMode(false);
      setManualForm({
        dni: '',
        first_name: '',
        last_name: '',
        plate: '',
        origin: '',
        destination: '',
        visitor_type: 'CLIENTE',
        reason: '',
        mechanic_code: ''
      });
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
            <h3 className="text-xl font-bold text-brand-text flex items-center gap-2">
              <Check className="w-6 h-6 text-brand-success" />
              <span>DNI Detectado</span>
            </h3>
            <button
              onClick={() => setScannedPerson(null)}
              className="p-1 text-brand-muted hover:text-brand-danger rounded-lg hover:bg-brand-bg transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-base mb-6 bg-brand-bg p-4 rounded-xl border border-brand-border shadow-inner">
            <div>
              <span className="text-brand-muted text-xs font-bold uppercase tracking-wider">Apellido</span>
              <p className="font-bold text-brand-text text-lg">{scannedPerson.last_name}</p>
            </div>
            <div>
              <span className="text-brand-muted text-xs font-bold uppercase tracking-wider">Nombre</span>
              <p className="font-bold text-brand-text text-lg">{scannedPerson.first_name}</p>
            </div>
            <div>
              <span className="text-brand-muted text-xs font-bold uppercase tracking-wider">DNI</span>
              <p className="font-mono font-black text-brand-primary text-xl">{scannedPerson.dni}</p>
            </div>
            <div>
              <span className="text-brand-muted text-xs font-bold uppercase tracking-wider">Sexo</span>
              <p className="font-bold text-brand-text text-lg">{scannedPerson.gender}</p>
            </div>
          </div>
            {scannedPerson.birth_date && (
              <div className="col-span-2">
                <span className="text-brand-muted text-xs font-bold uppercase tracking-wider">Fecha de Nacimiento</span>
                <p className="font-bold text-brand-text text-lg">{scannedPerson.birth_date}</p>
              </div>
            )}

          {/* Selector de tipo de acceso */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setAccessType('ENTRADA')}
              className={`flex-1 py-4 font-bold rounded-xl border transition text-base ${
                accessType === 'ENTRADA'
                  ? 'bg-brand-success border-brand-success text-white shadow-md'
                  : 'bg-brand-bg border-brand-border text-brand-muted hover:bg-slate-100'
              }`}
            >
              ENTRADA
            </button>
            <button
              onClick={() => setAccessType('SALIDA')}
              className={`flex-1 py-4 font-bold rounded-xl border transition text-base ${
                accessType === 'SALIDA'
                  ? 'bg-brand-warning border-brand-warning text-white shadow-md'
                  : 'bg-brand-bg border-brand-border text-brand-muted hover:bg-slate-100'
              }`}
            >
              SALIDA
            </button>
          </div>

          <button
            onClick={handleConfirmAccess}
            disabled={submitting}
            className="w-full py-4 bg-brand-primary hover:bg-blue-600 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition"
          >
            <span>{submitting ? 'PROCESANDO...' : 'CONFIRMAR REGISTRO'}</span>
            {!submitting && <ArrowRight className="w-5 h-5" />}
          </button>
        </div>
      )}

      {/* Formulario Manual */}
      {manualMode && (
        <form onSubmit={handleManualSubmit} className="bg-brand-card p-6 rounded-2xl border border-brand-border shadow-lg">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-xl font-bold text-brand-text">Ingreso Manual</h3>
          </div>

          <div className="flex flex-col gap-5">
            {/* Selector de Tipo de Visitante */}
            <div className="flex bg-brand-border/30 p-1 rounded-xl mb-2">
              <button
                type="button"
                onClick={() => setManualForm({ ...manualForm, visitor_type: 'CLIENTE' })}
                className={`flex-1 py-2 font-bold rounded-lg text-xs transition ${
                  manualForm.visitor_type === 'CLIENTE'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-brand-muted hover:text-brand-text'
                }`}
              >
                CLIENTE
              </button>
              <button
                type="button"
                onClick={() => setManualForm({ ...manualForm, visitor_type: 'PROVEEDOR' })}
                className={`flex-1 py-2 font-bold rounded-lg text-xs transition ${
                  manualForm.visitor_type === 'PROVEEDOR'
                    ? 'bg-brand-warning text-white shadow-sm'
                    : 'text-brand-muted hover:text-brand-text'
                }`}
              >
                PROVEEDOR
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualForm({ ...manualForm, visitor_type: 'MECANICO' });
                  setAccessType('SALIDA'); // Default para personal es SALIDA
                }}
                className={`flex-1 py-2 font-bold rounded-lg text-xs transition ${
                  manualForm.visitor_type === 'MECANICO'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-brand-muted hover:text-brand-text'
                }`}
              >
                PERSONAL
              </button>
            </div>

            {/* Selector de Mecánico por Código */}
            {manualForm.visitor_type === 'MECANICO' && (
              <div className="flex flex-col gap-2 p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-2xl animate-in zoom-in-95 duration-200">
                <label className="block text-brand-primary text-xs font-black uppercase tracking-widest pl-1">Selección por Código Único</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-white border-2 border-brand-primary/30 focus:border-brand-primary focus:outline-none rounded-xl text-brand-primary font-black text-xl tracking-widest placeholder:text-brand-primary/30"
                  placeholder="INGRESE CÓDIGO (Eje: M01)"
                  value={manualForm.mechanic_code}
                  onChange={(e) => {
                    const code = e.target.value.toUpperCase();
                    const state = useStore.getState();
                    const found = state.knownMechanics.find(m => m.code === code);
                    if (found) {
                      setManualForm({
                        ...manualForm,
                        mechanic_code: code,
                        first_name: found.name,
                        last_name: found.surname
                      });
                    } else {
                      setManualForm({ ...manualForm, mechanic_code: code });
                    }
                  }}
                />
                {manualForm.mechanic_code && !useStore.getState().knownMechanics.find(m => m.code === manualForm.mechanic_code) && (
                  <p className="text-[10px] text-brand-muted font-bold italic pl-1">Código no encontrado. Ingrese datos manualmente debajo.</p>
                )}
                {useStore.getState().knownMechanics.find(m => m.code === manualForm.mechanic_code) && (
                  <div className="flex flex-col gap-1 pl-1 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2">
                       <Check className="w-4 h-4 text-brand-success" />
                       <p className="text-xs font-bold text-brand-success uppercase">Identificado: {useStore.getState().knownMechanics.find(m => m.code === manualForm.mechanic_code).surname}, {useStore.getState().knownMechanics.find(m => m.code === manualForm.mechanic_code).name}</p>
                    </div>
                    <div className="flex items-center gap-2 pl-6">
                       <span className="text-[10px] font-black text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full uppercase">SECTOR: {useStore.getState().knownMechanics.find(m => m.code === manualForm.mechanic_code).sector || 'SIN ASIGNAR'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {manualForm.visitor_type !== 'MECANICO' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-brand-muted text-sm font-bold uppercase tracking-wide mb-1.5 px-1">DNI del Visitante *</label>
                <input
                  type="text"
                  pattern="\d{7,9}"
                  maxLength="9"
                  required
                  className="w-full px-4 py-3.5 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-brand-text font-mono text-xl tracking-widest"
                  placeholder="Ej: 28543593"
                  value={manualForm.dni}
                  onChange={(e) => {
                    const dniChar = e.target.value;
                    const state = useStore.getState();
                    const existing = state.persons.find(p => p.dni === dniChar);
                    
                    if (existing) {
                      setManualForm({ 
                        ...manualForm, 
                        dni: dniChar,
                        first_name: existing.first_name,
                        last_name: existing.last_name
                      });
                    } else {
                      setManualForm({ ...manualForm, dni: dniChar });
                    }
                  }}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-brand-muted text-xs font-bold uppercase tracking-wide mb-1 px-1">Apellido *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3.5 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-brand-text uppercase font-semibold text-base"
                  placeholder="SOSA"
                  value={manualForm.last_name}
                  onChange={(e) => setManualForm({ ...manualForm, last_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-brand-muted text-xs font-bold uppercase tracking-wide mb-1 px-1">Nombre *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3.5 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-brand-text uppercase font-semibold text-base"
                  placeholder="MARIA"
                  value={manualForm.first_name}
                  onChange={(e) => setManualForm({ ...manualForm, first_name: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-brand-muted text-xs font-bold uppercase tracking-wide mb-1 px-1">Patente Vehículo (Persona)</label>
              <input
                type="text"
                className="w-full px-4 py-3.5 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-brand-text uppercase tracking-widest font-mono text-lg"
                placeholder="Patente actual..."
                value={manualForm.plate}
                onChange={(e) => setManualForm({ ...manualForm, plate: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-brand-muted text-xs font-bold uppercase tracking-wide mb-1 px-1">
                  {manualForm.visitor_type === 'PROVEEDOR' ? 'Empresa' : 'Procedencia'}
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3.5 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-brand-text text-base"
                  placeholder={manualForm.visitor_type === 'PROVEEDOR' ? 'Nombre de la empresa' : '¿De dónde viene?'}
                  value={manualForm.origin}
                  onChange={(e) => setManualForm({ ...manualForm, origin: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-brand-muted text-xs font-bold uppercase tracking-wide mb-1 px-1">Destino</label>
                <select
                  className="w-full px-4 py-3.5 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-brand-text text-base font-medium"
                  value={manualForm.destination}
                  onChange={(e) => setManualForm({ ...manualForm, destination: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  {(manualForm.visitor_type === 'MECANICO' ? useStore.getState().mechanicDestinations : sectors).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {manualForm.visitor_type === 'PROVEEDOR' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-brand-muted text-xs font-bold uppercase tracking-wide mb-1 px-1">Motivo / Razón de Visita *</label>
                <textarea
                  required
                  rows="2"
                  className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-brand-text text-base resize-none"
                  placeholder="Ej: Entrega de mercadería, Mantenimiento, etc..."
                  value={manualForm.reason}
                  onChange={(e) => setManualForm({ ...manualForm, reason: e.target.value })}
                />
              </div>
            )}

            {/* Selector de Acceso */}
            <div>
              <label className="block text-brand-muted text-xs font-bold uppercase tracking-wide mb-2 px-1">Tipo de Movimiento</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setAccessType('ENTRADA')}
                  className={`flex-1 py-4 font-bold rounded-xl border transition text-base ${
                    accessType === 'ENTRADA'
                      ? 'bg-brand-success border-brand-success text-white shadow-md'
                      : 'bg-brand-bg border-brand-border text-brand-muted'
                  }`}
                >
                  ENTRADA
                </button>
                <button
                  type="button"
                  onClick={() => setAccessType('SALIDA')}
                  className={`flex-1 py-4 font-bold rounded-xl border transition text-base ${
                    accessType === 'SALIDA'
                      ? 'bg-brand-warning border-brand-warning text-white shadow-md'
                      : 'bg-brand-bg border-brand-border text-brand-muted'
                  }`}
                >
                  SALIDA
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-brand-primary hover:bg-blue-600 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 mt-2 transition"
            >
              <span>{submitting ? 'PROCESANDO...' : 'REGISTRAR ACCESO'}</span>
              {!submitting && <ArrowRight className="w-5 h-5" />}
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
