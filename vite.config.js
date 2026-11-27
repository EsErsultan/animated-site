import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// На GitHub Pages сайт живёт по адресу /animated-site/, локально — в корне.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/animated-site/' : '/',
}))
