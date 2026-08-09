import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Faltan las credenciales de Supabase en el archivo .env');
}

export const getTenantId = () => {
  // First check URL path (slug)
  const pathname = window.location.pathname.replace(/^\/+/g, '').trim();
  const firstPart = pathname.split('/')[0].toLowerCase();
  
  const systemRoutes = [
    'admin', 'superadmin', 'pago', 'guia', 'menu', 'dist', 
    'assets', 'api', 'sw.js', 'manifest.json', 'products', 
    'orders', 'favicon.ico', 'robots.txt'
  ];
  
  if (firstPart && !systemRoutes.includes(firstPart)) {
    const normalised = firstPart.replace(/-/g, '_');
    setTenantId(normalised);
    return normalised;
  }

  // Then check URL params
  const urlParams = new URLSearchParams(window.location.search);
  const urlTenant = urlParams.get('tienda');
  if (urlTenant) {
    const normalised = urlTenant.replace(/-/g, '_');
    setTenantId(normalised);
    return normalised;
  }
  
  // Then check localStorage
  const stored = localStorage.getItem('tenant_id');
  if (stored) return stored;
  
  // Fallback to default
  return import.meta.env.VITE_TENANT_ID || 'sublimados_majestic';
};

export const setTenantId = (id: string) => {
  localStorage.setItem('tenant_id', id);
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
