import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tràmit Economistes',
    short_name: 'Tràmit',
    description: 'Gestió interna de Tràmit Economistes',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2272A3',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['business', 'productivity'],
    lang: 'ca',
  }
}
