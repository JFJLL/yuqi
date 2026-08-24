import { fileURLToPath, URL } from "node:url"

import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// 员工 H5: 独立构建产物 (dist/), 部署在 /employee/ 子路径
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/employee/",
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:9000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
})
