import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          'cross-fetch': path.resolve(__dirname, 'fetch-stub.ts'),
          'cross-fetch/polyfill': path.resolve(__dirname, 'fetch-stub.ts'),
          '@supabase/node-fetch': path.resolve(__dirname, 'fetch-stub.ts'),
          'node-fetch': path.resolve(__dirname, 'fetch-stub.ts'),
          'formdata-polyfill': path.resolve(__dirname, 'fetch-stub.ts'),
          'formdata-polyfill/esm.min.js': path.resolve(__dirname, 'fetch-stub.ts')
        }
      }
    };
});
