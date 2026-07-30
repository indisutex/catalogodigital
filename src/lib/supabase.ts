import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Faltan las credenciales de Supabase en el archivo .env');
}

// Mapa de dominios propios → tenant ID
// Agregar aquí cada dominio personalizado de cada cliente
const DOMAIN_TENANT_MAP: Record<string, string> = {
  'pijamasalmayor.com': 'sublimados_majestic',
  'www.pijamasalmayor.com': 'sublimados_majestic',
  // Agregar más dominios aquí cuando sea necesario:
  // 'saramantha.com': 'saramantha',
  // 'indisutex.com': 'indisutex',
};

export const getTenantId = () => {
  // 1. Primero: detectar por dominio propio (custom domain)
  const hostname = window.location.hostname.toLowerCase();
  if (DOMAIN_TENANT_MAP[hostname]) {
    const tenantFromDomain = DOMAIN_TENANT_MAP[hostname];
    setTenantId(tenantFromDomain);
    return tenantFromDomain;
  }

  // 2. Luego: detectar por ruta URL (/:tenant)
  const pathname = window.location.pathname.replace(/^\/+/g, '').trim();
  const firstPart = pathname.split('/')[0].toLowerCase();
  
  const systemRoutes = ['admin', 'superadmin', 'pago', 'menu', 'dist', 'assets', 'api', 'sw.js', 'manifest.json'];
  
  if (firstPart && !systemRoutes.includes(firstPart)) {
    const normalised = firstPart.replace(/-/g, '_');
    setTenantId(normalised);
    return normalised;
  }

  // 3. Luego: query param ?tienda=xxx
  const urlParams = new URLSearchParams(window.location.search);
  const urlTenant = urlParams.get('tienda');
  if (urlTenant) {
    const normalised = urlTenant.replace(/-/g, '_');
    setTenantId(normalised);
    return normalised;
  }
  
  // 4. Luego: localStorage
  const stored = localStorage.getItem('tenant_id');
  if (stored) return stored;
  
  // 5. Fallback al tenant por defecto
  return import.meta.env.VITE_TENANT_ID || 'sublimados_majestic';
};

export const setTenantId = (id: string) => {
  localStorage.setItem('tenant_id', id);
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
