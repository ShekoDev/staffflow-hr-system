/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-mode="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--sf-primary)',
          hover: 'var(--sf-primary-hover)',
          fg: 'var(--sf-primary-fg)',
        },
        accent: 'var(--sf-accent)',
        surface: {
          DEFAULT: 'var(--sf-surface)',
          alt: 'var(--sf-surface-2)',
        },
        line: 'var(--sf-border)',
        content: {
          DEFAULT: 'var(--sf-text)',
          muted: 'var(--sf-text-muted)',
        },
        success: 'var(--sf-success)',
        warning: 'var(--sf-warning)',
        danger: 'var(--sf-danger)',
      },
      borderRadius: {
        theme: 'var(--sf-radius)',
        'theme-sm': 'calc(var(--sf-radius) * 0.6)',
        'theme-lg': 'calc(var(--sf-radius) * 1.4)',
      },
      boxShadow: {
        theme: 'var(--sf-shadow)',
      },
      backdropBlur: {
        theme: 'var(--sf-surface-blur)',
      },
      fontFamily: {
        sans: ['Inter', 'Cairo', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        arabic: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(.94)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(var(--slide-from, -14px))' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(.85)', opacity: '.7' },
          '70%': { transform: 'scale(1.25)', opacity: '0' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in .35s ease-out both',
        'fade-up': 'fade-up .45s cubic-bezier(.16,1,.3,1) both',
        'scale-in': 'scale-in .28s cubic-bezier(.16,1,.3,1) both',
        'slide-in': 'slide-in .35s cubic-bezier(.16,1,.3,1) both',
        shimmer: 'shimmer 1.6s infinite',
        'spin-slow': 'spin-slow 2.4s linear infinite',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(.24,.6,.36,1) infinite',
      },
    },
  },
  plugins: [],
};
