import { defineConfig } from 'vitepress';

const base = (typeof process !== 'undefined' && (process as any).env && (process as any).env.DOCS_BASE) || '/';

export default defineConfig({
  title: 'Three RoveMaps Camera Controls',
  description: 'RoveMaps GL JS-compatible camera controls for Three.js',
  base,
  themeConfig: {
    nav: [
      { text: 'Overview', link: '/' },
      { text: 'Quick Start', link: '/QuickStart' },
      { text: 'API', link: '/API' },
      { text: 'Handlers', link: '/Handlers' },
      { text: 'SSR & Next', link: '/SSR-Next' },
      { text: 'Examples', link: '/Examples' },
      { text: 'Demo', link: '/demo/' },
    ],
    sidebar: [
      { text: 'Overview', link: '/' },
      { text: 'Quick Start', link: '/QuickStart' },
      { text: 'API Reference', link: '/API' },
      { text: 'Handlers', link: '/Handlers' },
      { text: 'SSR & Next.js', link: '/SSR-Next' },
      { text: 'Examples', link: '/Examples' },
    ],
    footer: { message: 'MIT Licensed' }
  }
});
