import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const base = process.env.VITE_BASE || (mode === 'production' ? '/demo/' : '/');
  return {
    base,
    server: { open: true },
  };
});
