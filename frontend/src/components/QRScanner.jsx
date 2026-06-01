import React, { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { useStore } from '../store/useStore';
import { Camera, X, Check, ArrowRight, UserPlus, AlertCircle } from 'lucide-react';

export default function QRScanner() {
  const { registerPersonAccess, error, successMsg } = useStore();
  
  const [scanning, setScanning] = useState(false);
  const [scannedPerson, setScannedPerson] = useState(null);
  const [accessType, setAccessType] = useState('ENTRADA'); // 'ENTRADA' | 'SALIDA'
  const [manualMode, setManualMode] = useState(false);
  
  // Formulario manual
  const [manualForm, setManualForm] = useState({
    dni: '',
    first_name: '',
    last_name: '',
    gender: 'M',
    birth_date: ''
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const codeReaderRef = useRef(null);

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

  // Procesar código leído (QR o PDF417 de DNI Argentino)
  const processBarcodeData = (rawText) => {
    if (!rawText) return;
    
    try {
      let dni = '';
      let lastName = '';
      let firstName = '';
      let gender = '';
      let birthDate = '';
      
      // Caso 1: Formato URL (ej. QR moderno en parte trasera de DNI)
      if (rawText.includes('?') || rawText.startsWith('http')) {
        const urlString = rawText.trim();
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
      // Caso 2: Formato estándar con separadores '@' (PDF417 y algunos QR)
      else if (rawText.includes('@')) {
        const fields = rawText.split('@');
        
        if (fields.length >= 7) {
          // Buscamos si el DNI está en la posición 4 o 1 dependiendo de la versión
          const isModern = fields[4] && /^\d{7,9}$/.test(fields[4].trim());
          
          dni = isModern ? fields[4].trim() : fields[1].trim();
          lastName = isModern ? fields[1].trim().toUpperCase() : fields[2].trim().toUpperCase();
          firstName = isModern ? fields[2].trim().toUpperCase() : fields[3].trim().toUpperCase();
          gender = isModern ? fields[3].trim().toUpperCase() : fields[4].trim().toUpperCase();
          const rawBirth = isModern ? fields[6].trim() : fields[5].trim();
          
          const dateMatch = rawBirth.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
          if (dateMatch) {
            birthDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
          }
        }
      }
      
      dni = dni.trim().replace(/^0+/, '');
      
      if (dni && /^\d{6,10}$/.test(dni) && (lastName || firstName)) {
        playBeep();
        stopCamera();
        
        setScannedPerson({
          dni,
          first_name: firstName,
          last_name: lastName,
          gender: gender || 'M',
          birth_date: birthDate,
          qrData: rawText
        });
      }
    } catch (err) {
      console.error('[SCANNER] Error procesando datos del código:', err);
    }
  };

  // Iniciar cámara
  const startCamera = async () => {
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
        
        // Inicializar ZXing BrowserMultiFormatReader
        const codeReader = new BrowserMultiFormatReader();
        codeReaderRef.current = codeReader;
        
        // Escaneo de video continuo de alto rendimiento
        codeReader.decodeFromVideoElement(videoRef.current, (result, err) => {
          if (result) {
            processBarcodeData(result.getText());
          }
          if (err && !(err.name === 'NotFoundException')) {
            console.error('[SCANNER] Error de lectura:', err);
          }
        });
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
      setManualForm({ dni: '', first_name: '', last_name: '', gender: 'M', birth_date: '' });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Botones de acción principales */}
      {!scanning && !scannedPerson && !manualMode && (
        <div className="flex flex-col gap-3">
          <button
            onClick={startCamera}
            className="flex items-center justify-center gap-3 w-full py-5 bg-brand-primary hover:bg-blue-600 active:scale-[0.98] text-white font-semibold rounded-2xl shadow-lg shadow-blue-900/30 transition duration-200"
          >
            <Camera className="w-6 h-6" />
            <span>ESCANEAR DNI (QR / BARRAS)</span>
          </button>
          
          <button
            onClick={() => setManualMode(true)}
            className="flex items-center justify-center gap-3 w-full py-4 bg-brand-card hover:bg-brand-border text-brand-text border border-brand-border font-medium rounded-2xl active:scale-[0.98] transition duration-200"
          >
            <UserPlus className="w-5 h-5 text-brand-primary" />
            <span>INGRESAR MANUALMENTE</span>
          </button>
        </div>
      )}

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
            <button
              type="button"
              onClick={() => setManualMode(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-brand-border transition"
            >
              <X className="w-5 h-5" />
            </button>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-xs mb-1">Sexo</label>
                <select
                  className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-white"
                  value={manualForm.gender}
                  onChange={(e) => setManualForm({ ...manualForm, gender: e.target.value })}
                >
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="X">No Binario / Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Fecha de Nacimiento</label>
                <input
                  type="date"
                  className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-white"
                  value={manualForm.birth_date}
                  onChange={(e) => setManualForm({ ...manualForm, birth_date: e.target.value })}
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
