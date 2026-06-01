/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0B0F19',      // Fondo oscuro profundo
          card: '#151C2C',    // Tarjetas gris azuladas premium
          border: '#222F43',  // Bordes sutiles
          text: '#F3F4F6',    // Texto claro
          primary: '#3B82F6', // Azul principal de la marca
          success: '#10B981', // Verde éxito
          warning: '#F59E0B', // Naranja advertencia
          danger: '#EF4444'   // Rojo peligro
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}
