/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        bubbly: ['"Fredoka One"', 'cursive'],
        round: ['"Nunito"', 'sans-serif'],
      },
      keyframes: {
        bounce2: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        wiggle: { '0%,100%': { transform: 'rotate(-5deg)' }, '50%': { transform: 'rotate(5deg)' } },
        pop: { '0%': { transform: 'scale(0.8)', opacity: '0' }, '70%': { transform: 'scale(1.1)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        pulse2: { '0%,100%': { boxShadow: '0 0 0 0 rgba(255,200,0,0.4)' }, '50%': { boxShadow: '0 0 0 15px rgba(255,200,0,0)' } },
        float: { '0%,100%': { transform: 'translateY(0) rotate(-2deg)' }, '50%': { transform: 'translateY(-8px) rotate(2deg)' } },
        spin2: { '100%': { transform: 'rotate(360deg)' } },
      },
      animation: {
        bounce2: 'bounce2 2s ease-in-out infinite',
        wiggle: 'wiggle 1.5s ease-in-out infinite',
        pop: 'pop 0.4s ease-out',
        pulse2: 'pulse2 2s infinite',
        float: 'float 3s ease-in-out infinite',
        spin2: 'spin2 8s linear infinite',
      },
    },
  },
  plugins: [],
}
