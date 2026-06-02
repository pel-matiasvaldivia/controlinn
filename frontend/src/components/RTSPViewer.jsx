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
  const { registerVehicleAccess, online, error, successMsg } = useStore();

  const [activeCam, setActiveCam] = useState(CAMERAS[0]);
  const [loadingOcr, setLoadingOcr] = useState(false);
  const [detectedPlate, setDetectedPlate] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState(null);
  const [accessType, setAccessType] = useState('ENTRADA'); // 'ENTRADA' | 'SALIDA'
  const [previewImage, setPreviewImage] = useState(null);
  
  // Datos del vehículo
  const [vehicleForm, setVehicleForm] = useState({
    plate: '',
    driver_name: '',
    driver_dni: '',
    vehicle_type: 'AUTO' // 'AUTO' | 'CAMION' | 'MOTO' | 'UTILITARIO'
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

  // Capturar fotograma localmente del elemento de Video y enviarlo a OCR en backend
  const handleCaptureFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setLoadingOcr(true);
    setDetectedPlate('');
    setOcrConfidence(null);

    try {
      const ctx = canvas.getContext('2d');
      // Dimensiones de captura basadas en el video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      // Dibujar fotograma actual
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convertir a base64 (JPEG)
      const base64Image = canvas.toDataURL('image/jpeg', 0.85);
      setPreviewImage(base64Image);

      if (!online) {
        // Modo offline: no hay OCR backend disponible
        alert('OCR no disponible sin conexión. Por favor, ingrese la patente manualmente.');
        setLoadingOcr(false);
        return;
      }

      // Enviar imagen al servicio OCR
      const response = await apiClient.post('/ocr/detect-plate', { image: base64Image });
      
      useStore.getState().clearMessages();
      
      if (response.data.success && response.data.plate) {
        setDetectedPlate(response.data.plate);
        setOcrConfidence(response.data.confidence);
        setVehicleForm(prev => ({
          ...prev,
          plate: response.data.plate
        }));
      } else {
        setDetectedPlate('');
        useStore.setState({ 
          error: `TOMA FALLIDA: No se detectó patente con claridad. Texto leído: "${response.data.rawText || 'vacío'}"` 
        });
      }
    } catch (err) {
      console.error('[CCTV] Error ejecutando OCR:', err);
      useStore.setState({ error: 'TOMA FALLIDA: Error en el servicio OCR. Ingrese la patente manualmente.' });
    } finally {
      setLoadingOcr(false);
    }
  };

  // Enviar el registro de acceso vehicular
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vehicleForm.plate) {
      alert('La patente es requerida.');
      return;
    }

    // Limpiar patente de caracteres raros excepto números y letras
    const cleanPlate = vehicleForm.plate.trim().toUpperCase();

    // Guardar imagen base64 de previsualización en el formulario si existe
    const dataToSend = {
      ...vehicleForm,
      photo: previewImage
    };

    const success = await registerVehicleAccess(cleanPlate, accessType, dataToSend);
    if (success) {
      // Limpiar formulario al guardar con éxito
      setVehicleForm({ plate: '', driver_name: '', driver_dni: '', vehicle_type: 'AUTO' });
      setPreviewImage(null);
      setDetectedPlate('');
      setOcrConfidence(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      
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
          <span className="text-slate-200">CCTV EN VIVO</span>
        </div>

        {/* Botón de Captura sobre el video */}
        <button
          onClick={handleCaptureFrame}
          disabled={loadingOcr}
          className="absolute bottom-4 right-4 flex items-center justify-center p-3 bg-brand-primary hover:bg-blue-600 text-white rounded-full shadow-lg hover:scale-105 transition duration-150 active:scale-95"
          title="Capturar fotograma para OCR"
        >
          {loadingOcr ? (
            <RefreshCw className="w-6 h-6 animate-spin" />
          ) : (
            <Camera className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Formulario de Registro de Vehículo */}
      <form onSubmit={handleSubmit} className="bg-brand-card p-5 rounded-2xl border border-brand-border shadow-xl">
        <h3 className="text-lg font-bold text-white mb-4">Registro de Vehículo</h3>
        
        {/* Previsualización del fotograma capturado */}
        {previewImage && (
          <div className="mb-4 relative w-32 h-24 rounded-lg overflow-hidden border border-brand-border/60 bg-black/40">
            <img src={previewImage} className="w-full h-full object-cover" alt="Captura" />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-1 right-1 p-0.5 bg-black/70 hover:bg-black/90 text-white rounded-full"
            >
              <span className="text-xs px-1">Quitar</span>
            </button>
          </div>
        )}

        <div className="flex flex-col gap-4">
          
          {/* Patente y Tipo de Vehículo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-xs mb-1">Patente (Patente AR) *</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-white font-mono font-bold uppercase tracking-wider placeholder:text-slate-600"
                placeholder="Ej: AA 123 BB"
                value={vehicleForm.plate}
                onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value })}
              />
              {detectedPlate && (
                <span className="text-[10px] text-brand-success font-semibold mt-1 block">
                  OCR: {detectedPlate} ({ocrConfidence}%)
                </span>
              )}
            </div>
            
            <div>
              <label className="block text-slate-400 text-xs mb-1">Tipo de Vehículo</label>
              <select
                className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-white"
                value={vehicleForm.vehicle_type}
                onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value })}
              >
                <option value="AUTO">Automóvil</option>
                <option value="CAMION">Camión</option>
                <option value="UTILITARIO">Utilitario / Van</option>
                <option value="MOTO">Motocicleta</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
          </div>

          {/* Conductor y DNI */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-xs mb-1">Nombre Conductor</label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-white placeholder:text-slate-600"
                placeholder="Ej: Juan Perez"
                value={vehicleForm.driver_name}
                onChange={(e) => setVehicleForm({ ...vehicleForm, driver_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">DNI Conductor</label>
              <input
                type="text"
                pattern="\d{7,9}"
                className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-white placeholder:text-slate-600"
                placeholder="Ej: 30123456"
                value={vehicleForm.driver_dni}
                onChange={(e) => setVehicleForm({ ...vehicleForm, driver_dni: e.target.value })}
              />
            </div>
          </div>

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
