/** Palette ispirata al logo Pallacanestro Don Bosco Livorno. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: '#060D1F', // sfondo app
        surface: { DEFAULT: '#0D1B3A', 2: '#132651', 3: '#18306A' }, // card e pannelli
        navy: '#002855', // header e tab bar
        brand: { DEFAULT: '#EE3239', dark: '#C9252B', soft: '#EE323926' }, // rosso primario
        accent: { DEFAULT: '#1976D2', light: '#4A9BEA', soft: '#1976D229' }, // azzurro secondario
        ink: { DEFAULT: '#E8ECF4', muted: '#9AA6BF', faint: '#5E6B88' }, // testo
        line: '#1E2D52', // bordi sottili
        ok: '#2BB673',
        warn: '#F5A524',
        danger: '#FF5A5F',
      },
      fontFamily: {
        sans: ['Barlow', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Barlow', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 2px #1976D2, 0 0 18px 2px rgba(25,118,210,.45)',
        'glow-red': '0 0 0 2px #EE3239, 0 0 18px 2px rgba(238,50,57,.40)',
        card: '0 6px 24px -10px rgba(0,0,0,.6)',
      },
      borderRadius: { '4xl': '2rem' },
      transitionTimingFunction: { spring: 'cubic-bezier(.2,.9,.3,1.15)', out: 'cubic-bezier(.2,.9,.3,1)' },
    },
  },
  plugins: [],
};
