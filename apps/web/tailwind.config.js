/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: 'var(--ground)',
        'ground-2': 'var(--ground-2)',
        card: 'var(--card)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-faint': 'var(--ink-faint)',
        line: 'var(--line)',
        honey: 'var(--honey)',
        'honey-deep': 'var(--honey-deep)',
        'honey-wash': 'var(--honey-wash)',
        win: 'var(--win)',
        'win-wash': 'var(--win-wash)',
        coral: 'var(--coral)',
        pen: 'var(--pen)',
        'pen-wash': 'var(--pen-wash)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
    },
  },
  plugins: [],
};
