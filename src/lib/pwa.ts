/**
 * Utility to dynamically update PWA icons and manifest based on the active Tenant / Store branding.
 * Allows each company (Majestic, Saramantha, Lucerito, Mayoristas, etc.) to have its own PWA icon & app name 
 * when the user clicks "Instalar aplicación" on Desktop or Mobile.
 */
export function updatePWAManifestAndIcons(logoUrl?: string | null, storeName?: string | null) {
  try {
    const name = storeName?.trim() || 'Catálogo Digital';
    const icon = logoUrl?.trim() || '/indisutex-logo.png';

    // 1. Update Favicon (<link rel="icon">)
    let faviconEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!faviconEl) {
      faviconEl = document.createElement('link');
      faviconEl.rel = 'icon';
      document.head.appendChild(faviconEl);
    }
    faviconEl.type = 'image/png';
    faviconEl.href = icon;

    // 2. Update Apple Touch Icon (<link rel="apple-touch-icon">)
    let appleIconEl = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!appleIconEl) {
      appleIconEl = document.createElement('link');
      appleIconEl.rel = 'apple-touch-icon';
      document.head.appendChild(appleIconEl);
    }
    appleIconEl.href = icon;

    // 3. Generate dynamic PWA Manifest using Blob URL
    const manifestData = {
      name: `${name} — Catálogo Digital`,
      short_name: name,
      description: `Catálogo Digital e Interactivo de ${name}`,
      start_url: window.location.pathname + window.location.search,
      scope: '/',
      display: 'standalone',
      orientation: 'portrait-primary',
      background_color: '#ffffff',
      theme_color: '#e91e8c',
      icons: [
        {
          src: icon,
          sizes: '192x192 512x512 1024x1024',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    };

    const stringManifest = JSON.stringify(manifestData);
    const blob = new Blob([stringManifest], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(blob);

    let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }

    if (manifestLink.href.startsWith('blob:')) {
      URL.revokeObjectURL(manifestLink.href);
    }

    manifestLink.href = manifestUrl;
  } catch (err) {
    console.error('Error updating dynamic PWA manifest:', err);
  }
}
