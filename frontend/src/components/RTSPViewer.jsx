import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import apiClient from '../services/apiClient';
import { useStore } from '../store/useStore';
import { Video, Camera, Check, RefreshCw, AlertCircle, ShieldAlert } from 'lucide-react';

const CAMERAS = [
  { id: 'cam1', name: 'Portal Principal (Entrada)', url: '/streams/stream.m3u8' },
  { id: 'cam2', name: 'Portal Secundario (Salida)', url: '/streams/stream.m3u8' } // Usamos el mismo stream simulado para pruebas
];

export default function RTSPViewer() {
  const { registerVehicleAccess, registerPersonAccess, online, error, successMsg } = useStore();

  const [activeCam, setActiveCam] = useState(CAMERAS[0]);
  const [loadingOcr, setLoadingOcr] = useState(false);
  const [scanMode, setScanMode] = useState('PLATE'); // 'PLATE' | 'ID'
  const [detectedPlate, setDetectedPlate] = useState('');
  const [detectedId, setDetectedId] = useState(null);
  const [ocrConfidence, setOcrConfidence] = useState(null);
  const [accessType, setAccessType] = useState('ENTRADA'); // 'ENTRADA' | 'SALIDA'
  const [previewImage, setPreviewImage] = useState(null);
  
  // Datos del vehículo
  const [vehicleForm, setVehicleForm] = useState({
    plate: '',
    driver_name: '',
    driver_dni: '',
    vehicle_type: 'AUTO'
  });

  // Datos de la persona (para modo ID)
  const [personForm, setPersonForm] = useState({
    dni: '',
    first_name: '',
    last_name: '',
    gender: 'M',
    birth_date: ''
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const hlsRef = useRef(null);

  // Inicializar reproductor HLS
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Limpieza previa
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    // El path del stream HLS simulado en Nginx es /streams/stream.m3u8
    const streamUrl = activeCam.url;

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferSize: 0, // Minimizar latencia
        maxBufferLength: 2,
        liveSyncPosition: 1
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('[HLS] Error de red grave, intentando recuperar...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('[HLS] Error de medio grave, intentando recuperar...');
              hls.recoverMediaError();
              break;
            default:
              console.error('[HLS] Error irrecuperable.');
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Para Safari y navegadores iOS nativos
      video.src = streamUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [activeCam]);

  // Loop de detección de código de barras (PDF417) en modo ID
  useEffect(() => {
    let interval;
    if (scanMode === 'ID' && videoRef.current) {
      interval = setInterval(async () => {
        const video = videoRef.current;
        if (!video || !('BarcodeDetector' in window)) return;
        
        try {
          const detector = new window.BarcodeDetector({ formats: ['pdf417', 'qr_code'] });
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            handleBarcodeDetected(barcodes[0].rawValue);
          }
        } catch (e) {}
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [scanMode]);

  const handleBarcodeDetected = (rawText) => {
    if (!rawText) return;
    
    // Parseo básico de PDF417 Argentino (DNI/Licencia)
    const fields = rawText.split(/[@%|,]/).map(f => f.trim());
    if (fields.length >= 3) {
      let dniIndex = fields.findIndex(f => /^\d{7,9}$/.test(f));
      if (dniIndex !== -1) {
        const dni = fields[dniIndex];
        const last_name = fields[dniIndex - 3] || fields[dniIndex + 1];
        const first_name = fields[dniIndex - 2] || fields[dniIndex + 2];
        
        setPersonForm(prev => ({
          ...prev,
          dni: dni.replace(/^0+/, ''),
          last_name: last_name ? last_name.toUpperCase() : prev.last_name,
          first_name: first_name ? first_name.toUpperCase() : prev.first_name,
        }));
        setDetectedId({ dni, first_name, last_name });
      }
    }
  };

  // Capturar fotograma localmente y enviarlo al OCR correspondiente
  const handleCaptureFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setLoadingOcr(true);
    setDetectedPlate('');
    setDetectedId(null);
    setOcrConfidence(null);

    try {
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const base64Image = canvas.toDataURL('image/jpeg', 0.85);
      setPreviewImage(base64Image);

      if (!online) {
        alert('OCR no disponible sin conexión. Ingrese datos manualmente.');
        setLoadingOcr(false);
        return;
      }

      const endpoint = scanMode === 'PLATE' ? '/ocr/detect-plate' : '/ocr/detect-id';
      const response = await apiClient.post(endpoint, { image: base64Image });
      
      useStore.getState().clearMessages();
      
      if (response.data.success) {
        if (scanMode === 'PLATE') {
          setDetectedPlate(response.data.plate);
          setVehicleForm(prev => ({ ...prev, plate: response.data.plate }));
        } else {
          const idData = response.data.data;
          setDetectedId(idData);
          setPersonForm({
            dni: idData.dni || '',
            first_name: idData.first_name || '',
            last_name: idData.last_name || '',
            gender: idData.gender || 'M',
            birth_date: idData.birth_date || ''
          });
        }
        setOcrConfidence(response.data.confidence);
      } else {
        useStore.setState({ error: 'No se detectó información legible. Reintente.' });
      }
    } catch (err) {
      console.error('[CCTV] Error OCR:', err);
      useStore.setState({ error: 'Fallo en el servicio OCR.' });
    } finally {
      setLoadingOcr(false);
    }
  };

  // Enviar el registro de acceso vehicular
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (scanMode === 'PLATE') {
      if (!vehicleForm.plate) return alert('La patente es requerida.');
      const dataToSend = { ...vehicleForm, photo: previewImage };
      const success = await registerVehicleAccess(vehicleForm.plate.toUpperCase(), accessType, dataToSend);
      if (success) {
        setVehicleForm({ plate: '', driver_name: '', driver_dni: '', vehicle_type: 'AUTO' });
        setPreviewImage(null);
        setDetectedPlate('');
      }
    } else {
      if (!personForm.dni) return alert('El DNI es requerido.');
      const success = await registerPersonAccess(personForm.dni, accessType, { ...personForm, photo: previewImage });
      if (success) {
        setPersonForm({ dni: '', first_name: '', last_name: '', gender: 'M', birth_date: '' });
        setPreviewImage(null);
        setDetectedId(null);
      }
    }
    setOcrConfidence(null);
  };

  return (
    <div className="flex flex-col gap-4">
      
      {/* Selector de Modo */}
      <div className="flex bg-brand-card p-1 rounded-xl border border-brand-border">
        <button
          type="button"
          onClick={() => setScanMode('PLATE')}
          className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-2 ${
            scanMode === 'PLATE' ? 'bg-brand-primary text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Video className="w-3 h-3" />
          <span>VEHÍCULOS</span>
        </button>
        <button
          type="button"
          onClick={() => setScanMode('ID')}
          className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-2 ${
            scanMode === 'ID' ? 'bg-brand-primary text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-3 h-3" />
          <span>DNI / PERSONAS</span>
        </button>
      </div>

      {/* Selector de Cámara */}
      <div className="flex flex-col gap-1">
        <label className="text-slate-400 text-xs font-semibold">Seleccionar Cámara CCTV</label>
        <select
          value={activeCam.id}
          onChange={(e) => setActiveCam(CAMERAS.find(c => c.id === e.target.value))}
          className="w-full px-4 py-3 bg-brand-card border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-white font-medium"
        >
          {CAMERAS.map(cam => (
            <option key={cam.id} value={cam.id}>{cam.name}</option>
          ))}
        </select>
      </div>

      {/* Reproductor de Video */}
      <div className="relative w-full aspect-[4/3] max-w-md mx-auto rounded-2xl overflow-hidden border border-brand-border bg-black group">
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Overlay en vivo */}
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full text-xs font-semibold border border-white/10">
          <span className="w-2.5 h-2.5 bg-brand-danger rounded-full animate-pulse"></span>
          <span className="text-slate-200">CCTV {scanMode === 'PLATE' ? 'PATENTES' : 'DOCUMENTOS'}</span>
        </div>

        {/* Guía de encuadre para DNI */}
        {scanMode === 'ID' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-40 border-2 border-brand-primary border-dashed rounded-2xl bg-brand-primary/5 animate-pulse shadow-[0_0_20px_rgba(59,130,246,0.2)]"></div>
            <div className="absolute top-[60%] text-[10px] text-brand-primary font-bold bg-black/40 px-2 py-1 rounded">ALINEAR DOCUMENTO AQUÍ</div>
          </div>
        )}

        {/* Botón de Captura sobre el video */}
        <button
          onClick={handleCaptureFrame}
          disabled={loadingOcr}
          className="absolute bottom-4 right-4 flex items-center justify-center p-4 bg-brand-primary hover:bg-blue-600 text-white rounded-full shadow-lg hover:scale-105 transition duration-150 active:scale-95"
          title="Capturar fotograma para OCR"
        >
          {loadingOcr ? (
            <RefreshCw className="w-6 h-6 animate-spin" />
          ) : (
            <Camera className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Formulario Dinámico */}
      <form onSubmit={handleSubmit} className="bg-brand-card p-5 rounded-2xl border border-brand-border shadow-xl">
        <h3 className="text-lg font-bold text-white mb-4">
          {scanMode === 'PLATE' ? 'Registro de Vehículo' : 'Registro de Documento'}
        </h3>
        
        {/* Previsualización */}
        {previewImage && (
          <div className="mb-4 relative w-32 h-24 rounded-lg overflow-hidden border border-brand-border/60 bg-black/40">
            <img src={previewImage} className="w-full h-full object-cover" alt="Captura" />
          </div>
        )}

        <div className="flex flex-col gap-4">
          {scanMode === 'PLATE' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-slate-400 text-xs mb-1">Patente (Patente AR) *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary rounded-xl text-white font-mono font-bold uppercase tracking-wider"
                  placeholder="Ej: AA 123 BB"
                  value={vehicleForm.plate}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-slate-400 text-xs mb-1">Nombre Conductor</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-white"
                  value={vehicleForm.driver_name}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, driver_name: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-slate-400 text-xs mb-1">Nro Documento / DNI *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary rounded-xl text-white font-mono font-bold"
                  value={personForm.dni}
                  onChange={(e) => setPersonForm({ ...personForm, dni: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Apellido</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-white text-sm"
                    value={personForm.last_name}
                    onChange={(e) => setPersonForm({ ...personForm, last_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Nombre</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-white text-sm"
                    value={personForm.first_name}
                    onChange={(e) => setPersonForm({ ...personForm, first_name: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {ocrConfidence && (
            <span className="text-[10px] text-brand-success font-semibold">OCR Confianza: {ocrConfidence}%</span>
          )}

          {/* Tipo de Acceso */}
          <div>
            <label className="block text-slate-400 text-xs mb-1">Registro de Tránsito</label>
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
            <span>REGISTRAR MOVIMIENTO</span>
          </button>
        </div>
      </form>

      {/* Notificaciones */}
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
