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
          bg: '#F0F4FF',       // Fondo azul-blanco muy suave
          card: '#FFFFFF',     // Tarjetas blancas
          border: '#CBD5E1',   // Bordes gris claro
          text: '#1E293B',     // Texto oscuro legible
          muted: '#64748B',    // Texto secundario
          primary: '#2563EB',  // Azul principal
          success: '#16A34A',  // Verde éxito
          warning: '#D97706',  // Naranja advertencia
          danger: '#DC2626'    // Rojo peligro
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}
