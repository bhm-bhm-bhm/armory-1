/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "Courier New", "monospace"],
      },
      colors: {
        armory: {
          bg:      "#01080F",
          card:    "#071520",
          border:  "#1A3A52",
          blue:    "#18CFFF",
          red:     "#FF5555",
          orange:  "#FF9933",
          green:   "#00FF99",
          yellow:  "#FFD700",
          purple:  "#BB88FF",
        },
      },
    },
  },
  plugins: [],
};
