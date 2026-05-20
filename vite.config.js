import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/-Accounting/', // ⚠️ 這行是新增的，前後都要有斜線！
})
