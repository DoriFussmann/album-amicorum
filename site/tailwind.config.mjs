/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    screens: {
      sm: '480px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4E684E', // AA-safe interactive sage; decorative soft remains #7A9E7E
          soft: '#7A9E7E',
          muted: '#8FA8A0',
        },
        secondary: '#8FA8A0',
        accent: {
          DEFAULT: '#B8963E',
          moss: '#4E684E',
        },
        canvas: '#FAF8F4',
        surface: '#F3EFE8',
        cream: '#F7F3EC',
        oatmeal: '#EDE6DA',
        border: {
          DEFAULT: '#DDD8CE',
          soft: '#E8E2D6',
        },
        ink: {
          DEFAULT: '#5A5248',
          heading: '#3B3530',
          muted: '#6B6358', // darkened from guide #9E9488 for AA body contrast
        },
        success: '#4E684E',
        warning: '#C4A35A',
        error: '#B97070',
        blush: '#E8D5D0',
        teal: {
          muted: '#7A9E9A',
        },
        blue: {
          dusty: '#8A9BA8',
        },
        mushroom: '#B5A99A',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body: ['Nunito', 'Avenir', 'Helvetica Neue', 'sans-serif'],
      },
      fontSize: {
        // Major Third scale (1.250), base 16px
        xs: ['0.75rem', { lineHeight: '1.7' }], // 12
        sm: ['0.875rem', { lineHeight: '1.7' }], // 14
        base: ['1rem', { lineHeight: '1.7' }], // 16
        lg: ['1.25rem', { lineHeight: '1.4' }], // 20
        xl: ['1.5625rem', { lineHeight: '1.4' }], // 25
        '2xl': ['1.9375rem', { lineHeight: '1.2' }], // 31
        '3xl': ['2.4375rem', { lineHeight: '1.2' }], // 39
        '4xl': ['3.0625rem', { lineHeight: '1.2' }], // 49
      },
      spacing: {
        18: '4.5rem', // 72
        22: '5.5rem', // 88
        30: '7.5rem', // 120
      },
      maxWidth: {
        content: '680px',
        page: '1200px',
      },
      borderRadius: {
        pill: '100px',
        soft: '8px',
      },
      boxShadow: {
        lift: '0 8px 24px -12px rgba(59, 53, 48, 0.18)',
        soft: '0 4px 16px -8px rgba(59, 53, 48, 0.12)',
      },
      transitionDuration: {
        gentle: '280ms',
      },
    },
  },
  plugins: [],
};
