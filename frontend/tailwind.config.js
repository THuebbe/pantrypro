// frontend\tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			// Add custom focus ring color
			ringColor: {
				DEFAULT: "#22c55e", // Green-500
			},
		},
	},
	plugins: [],
};
