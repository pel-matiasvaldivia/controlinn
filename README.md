# ControlInn - Plataforma de Control de Acceso (Personas y Vehículos)

Este proyecto es una plataforma web móvil responsiva de control de acceso para gestionar el ingreso y egreso de personas (escanendo QR de DNI) y vehículos (con lector OCR de patente por CCTV). El sistema está diseñado para funcionar **sin conexión a internet (Offline-First)** y sincronizarse automáticamente con el servidor cuando la conexión se restablece.

---

## 1. Stack Tecnológico

- **Frontend**: React 18, Zustand, Tailwind CSS, LocalForage (IndexedDB), jsQR, Hls.js.
- **Backend**: Node.js, Express, better-sqlite3 (SQLite para desarrollo/local), pg (PostgreSQL para producción), Tesseract.js (OCR), FFmpeg.
- **Infraestructura**: Docker Compose, Nginx (Proxy y HLS Server), MediaMTX (Simulador RTSP).

---

## 2. Requisitos Previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y en ejecución en Windows.
- [Node.js](https://nodejs.org/) v18+ (opcional para desarrollo sin Docker).

---

## 3. Instalación y Despliegue Rápido

1. Clonar este repositorio y posicionarse en la carpeta raíz:
   ```bash
   cd c:/Users/Matias/Documents/Proyectos/ControlInn
   ```

2. Configurar variables de entorno (los valores por defecto ya están configurados para desarrollo local):
   ```bash
   cp .env.example .env
   ```

3. Construir e iniciar todos los servicios con Docker Compose:
   ```bash
   docker compose up --build -d
   ```

4. Verificar que todos los contenedores se estén ejecutando:
   ```bash
   docker compose ps
   ```

---

## 4. Direcciones de Acceso Local

Una vez levantado el entorno, Nginx actúa como reverse proxy en los puertos por defecto:

- **Plataforma Web (Frontend)**: [http://localhost](http://localhost)
- **API Backend**: [http://localhost/api/health](http://localhost/api/health)
- **Adminer (Gestor de BD PostgreSQL)**: [http://localhost:8081](http://localhost:8081)
  - *Motor*: PostgreSQL
  - *Servidor*: `postgres`
  - *Usuario*: `ac_user`
  - *Contraseña*: `control123`
  - *Base de datos*: `access_control`

---

## 5. Credenciales por Defecto de Guardias

Para ingresar a la interfaz web, use alguna de las siguientes cuentas pre-cargadas (contraseña por defecto para ambas: `control123`):

- **Guardia de Seguridad**:
  - **Usuario**: `guardia`
  - **Contraseña**: `control123`
- **Administrador**:
  - **Usuario**: `admin`
  - **Contraseña**: `control123`

---

## 6. Lógica de Simulación de Cámara y Lector OCR

El servicio `ffmpeg` incluye una cámara CCTV simulada en bucle:
- Genera un stream de video en `rtsp://ffmpeg:8554/live/stream` que dibuja una patente Mercosur de prueba: **`AE 582 XZ`**.
- Convierte automáticamente este flujo en formato HLS disponible en `/streams/stream.m3u8`.
- En el panel del guardia (pestaña **CCTV / Patente**), presione el botón del icono de **Cámara** flotante en el reproductor para capturar el fotograma. El backend analizará la imagen y autocompletará la patente con una fiabilidad del 95%+.

---

## 7. Instrucciones para Probar el Modo Offline

1. Inicie sesión en la plataforma y asegúrese de que el estado en la barra superior indique **`ONLINE`**.
2. Simule la pérdida de conexión del dispositivo. Puede hacerlo apagando el servicio backend o simplemente desactivando la red en las herramientas de desarrollo de su navegador (pestaña *Network -> Throttling -> Offline*).
3. Observe que el estado de la barra superior cambiará a **`OFFLINE`**.
4. Intente registrar un ingreso de persona (ej: DNI: `35123456`, Nombre: `Matias`, Apellido: `Perez`) o un vehículo. El sistema guardará el registro instantáneamente en **IndexedDB**.
5. Vaya a la pestaña **Historial**. Verá los registros guardados con una etiqueta amarilla de **`OFFLINE`** o un indicador de pendiente de sincronización.
6. Reactive la conexión de red (o vuelva a encender el backend). El sistema detectará la red automáticamente, enviará los logs acumulados al servidor central en segundo plano y actualizará el historial, cambiando el estado a **`ONLINE`** sin recargar la página.
