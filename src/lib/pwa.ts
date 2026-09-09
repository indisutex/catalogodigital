/**
 * Utility to dynamically update PWA icons and manifest based on the active Tenant / Store branding.
 * Allows each company (Majestic, Saramantha, Lucerito, Mayoristas, etc.) to have its own PWA icon & app name 
 * when the user clicks "Instalar aplicación" on Desktop or Mobile.
 */
export function updatePWAManifestAndIcons(
  logoUrl?: string | null, 
  storeName?: string | null, 
  themeColor?: string | null,
  tenantSlug?: string | null
) {
  try {
    const name = storeName?.trim() || 'Catálogo Digital';
    const icon = logoUrl?.trim() || '/indisutex-logo.png';
    const activeColor = themeColor?.trim() || '#6366f1';

    // 1. Update <meta name="theme-color"> tag in <head>
    let metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      document.head.appendChild(metaTheme);
    }
    metaTheme.content = activeColor;

    // 2. Update Favicon (<link rel="icon">)
    let faviconEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!faviconEl) {
      faviconEl = document.createElement('link');
      faviconEl.rel = 'icon';
      document.head.appendChild(faviconEl);
    }
    faviconEl.type = 'image/png';
    faviconEl.href = icon;

    // 3. Update Apple Touch Icon (<link rel="apple-touch-icon">)
    let appleIconEl = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!appleIconEl) {
      appleIconEl = document.createElement('link');
      appleIconEl.rel = 'apple-touch-icon';
      document.head.appendChild(appleIconEl);
    }
    appleIconEl.href = icon;

    // 3.1 Update Apple Web App Title
    let appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitle) {
      appleTitle = document.createElement('meta');
      appleTitle.name = 'apple-mobile-web-app-title';
      document.head.appendChild(appleTitle);
    }
    appleTitle.content = name;

    // Normalize slug for multi-tenant PWA isolation (e.g. /lucerito, /sublimados_majestic, /saramantha)
    const cleanSlug = tenantSlug?.trim().replace(/^\/+|\/+$/g, '') || '';

    // 4. Update manifest link with query params so Service Worker & backend serve the exact isolated manifest with proper start_url
    const manifestParams = new URLSearchParams();
    if (cleanSlug) manifestParams.set('tenant', cleanSlug);
    manifestParams.set('name', name);
    manifestParams.set('color', activeColor);
    manifestParams.set('icon', icon);
    const manifestUrl = `/manifest.json?${manifestParams.toString()}`;

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
