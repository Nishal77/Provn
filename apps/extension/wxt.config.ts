import { defineConfig } from 'wxt'

export default defineConfig({
  extensionApi: 'chrome',
  modules: [],
  manifest: {
    name: 'ATTESTA ProofWork',
    description: 'See verified credentials on LinkedIn profiles — powered by ATTESTA.',
    version: '0.1.0',
    permissions: ['storage', 'identity'],
    host_permissions: [
      'https://www.linkedin.com/*',
      'https://attesta.io/*',
      'http://localhost:3000/*',
    ],
    icons: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
    action: {
      default_popup: 'popup.html',
      default_title: 'ATTESTA ProofWork',
    },
  },
})
