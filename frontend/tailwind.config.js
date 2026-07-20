/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Warm amber/brown theme for family memories
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          // Numeric scale derived from the olive --primary hue; used widely
          // across the app (avatars, chips, logo tiles)
          50: "hsl(80 30% 96%)",
          100: "hsl(80 28% 90%)",
          200: "hsl(80 28% 80%)",
          300: "hsl(80 28% 66%)",
          400: "hsl(80 28% 54%)",
          500: "hsl(80 28% 42%)",
          600: "hsl(80 30% 36%)",
          700: "hsl(80 32% 29%)",
          800: "hsl(80 34% 23%)",
          900: "hsl(80 36% 17%)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Warm cream tones used for page backgrounds
        warm: {
          50: "hsl(40 33% 97%)",
          100: "hsl(40 30% 93%)",
        },
        // Memory layer colors
        memory: {
          working: "hsl(var(--memory-working))",
          episodic: "hsl(var(--memory-episodic))",
          semantic: "hsl(var(--memory-semantic))",
          procedural: "hsl(var(--memory-procedural))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "consolidate": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(0.95)", opacity: "0.8" },
          "100%": { transform: "scale(1)", opacity: "1", backgroundColor: "hsl(var(--memory-semantic))" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.3s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "consolidate": "consolidate 0.5s ease-in-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
