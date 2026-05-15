import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackStart({
      client: { entry: './src/client.tsx' },
      server: { entry: './src/ssr.tsx' },
    }),
    viteReact(),
    tailwindcss(),
    command === 'build'
      ? nitro({
          config: {
            preset: process.env.NITRO_PRESET || 'aws-amplify',
            compatibilityDate: '2026-05-15',
          },
        })
      : null,
  ],
}))

export default config
