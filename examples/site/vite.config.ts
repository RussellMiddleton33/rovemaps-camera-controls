import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const base = process.env.VITE_BASE || (mode === 'production' ? '/demo/' : '/');
  return {
    base,
    server: { open: true },
    resolve: {
      dedupe: ['three'],
      alias: {
        three: fileURLToPath(new URL('../../node_modules/three', import.meta.url)),
      },
    },
    optimizeDeps: {
      include: ['three'],
      exclude: ['three'],
    },
    build: {
      minify: false,
      sourcemap: true,
      target: 'es2019',
      chunkSizeWarningLimit: 1500,
    },
  };
});
