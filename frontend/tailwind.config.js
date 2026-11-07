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
          50: '#FDF2F3',
          100: '#FBE6E7',
          200: '#F6C1C4',
          300: '#EE949A',
          400: '#DE5761',
          500: '#B91C2C', // Primary red
          600: '#8F1724', // Dark red
          700: '#75131E',
          800: '#5C0F17',
          900: '#3D0A0F',
          primary: '#B91C2C',
          dark: '#8F1724',
        },
        surface: {
          light: '#F7F8FA',
          white: '#FFFFFF',
        },
        ink: {
          main: '#20252B',
          secondary: '#69717D',
          muted: '#9DA4AE',
        },
        line: {
          border: '#E6E8EC',
        },
        status: {
          success: '#18794E',
          warning: '#A15C07',
          error: '#B42318',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
        'modal': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      }
    },
  },
  plugins: [],
}
