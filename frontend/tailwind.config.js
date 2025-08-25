/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: '#8A7B8A',
        light: '#D8D7D7',
        muted: '#5A5A5A',
        grayish: '#9C9C9C',
      },
      fontFamily: {
        poppins: ['Poppins','serif'],
        montserratAlt: ['"Montserrat Alternates"','serif']
      }
    },
  },
  plugins: [],
}
