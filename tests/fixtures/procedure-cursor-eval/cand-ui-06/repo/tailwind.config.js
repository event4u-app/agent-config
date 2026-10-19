/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "brand-ink": "#1f2a44",
        "brand-sand": "#e9dfc9",
        "alert-coral": "#e8590c",
      },
      spacing: {
        gutter: "1.25rem",
        "section-gap": "4.5rem",
      },
    },
  },
  plugins: [],
};
