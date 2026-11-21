/**
 * Tutti i colori di brand sono variabili CSS impostate a runtime dalla squadra attiva
 * (vedi src/theme). Qui nessun colore di brand scritto a mano: solo riferimenti alle variabili.
 * L'opacità (es. bg-brand/20) usa color-mix, così funziona anche con le variabili.
 */
const v = (name) => ({ opacityValue }) =>
  opacityValue === undefined || opacityValue === '1' || opacityValue === 1
    ? `var(--c-${name})`
    : `color-mix(in srgb, var(--c-${name}) calc(${opacityValue} * 100%), transparent)`;

const glow = (name, a) => `color-mix(in srgb, var(--c-${name}) ${a}%, transparent)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: v('bg'), // sfondo app
        surface: { DEFAULT: v('surface'), 2: v('surface-2'), 3: v('surface-3') }, // card e pannelli
        bar: v('bar'), // header e tab bar
        line: v('line'), // bordi sottili
        brand: { DEFAULT: v('brand'), strong: v('brand-strong'), text: v('brand-text') }, // accento primario
        'on-brand': v('on-brand'),
        accent: { DEFAULT: v('select'), light: v('select-text') }, // accento di selezione
        'on-accent': v('on-select'),
        // testo: fisso per leggibilità
        ink: { DEFAULT: '#E8ECF4', muted: '#9AA6BF', faint: '#5E6B88' },
        // colori funzionali, indipendenti dalla squadra
        ok: '#2BB673',
        warn: '#F5A524',
        danger: '#FF5A5F',
      },
      fontFamily: {
        sans: ['Barlow', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Barlow', 'system-ui', 'sans-serif'],
        // numeri "da tabellone" (cronometro, punteggio, INT, minuti)
        score: ['Teko', '"Barlow Condensed"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: `0 0 0 2px var(--c-select), 0 0 18px 2px ${glow('select', 45)}`,
        'glow-brand': `0 0 0 2px var(--c-brand), 0 0 18px 2px ${glow('brand', 40)}`,
        brand: `0 8px 24px -10px ${glow('brand', 80)}`,
        'brand-lg': `0 10px 30px -8px ${glow('brand', 90)}`,
        select: `0 6px 18px -6px ${glow('select', 90)}`,
        'select-sm': `0 0 14px -2px ${glow('select', 55)}`,
        card: '0 6px 24px -10px rgba(0,0,0,.6)',
      },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
};
