import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 构建成单个 index.html（file:// 双击就能开）：npm run release 再把它拷成 skill 的 assets/reader.html
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  // 划线只用文本选择器；上游 optimal-select 的包入口不完整，沿用样稿的空模块。
  resolve: { alias: { '@': path.resolve(__dirname, './src'), 'optimal-select': path.resolve(__dirname, './src/annot/optimal-select-stub.ts') } },
  // 本地开发通过同源代理连接服务；serve.py 会校验 Host 和 X-Fupan。
  server: { proxy: { '/api': { target: 'http://127.0.0.1:4330', changeOrigin: true } } },
})
