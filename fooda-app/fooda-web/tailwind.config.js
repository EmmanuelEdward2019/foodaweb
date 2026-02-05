/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Colors from the landing page design
                primary: '#ff6b35',
                secondary: '#e55a2b',
            }
        },
    },
    plugins: [],
}
