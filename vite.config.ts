import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
    resolve: { tsconfigPaths: true },
    server: {
      host: '0.0.0.0',
      port: 3200,
      strictPort: true,
      allowedHosts: true,
    },
    preview: {
      host: '0.0.0.0',
      port: 3200,
      strictPort: true,
      allowedHosts: true,
    },
    plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
  }
})
