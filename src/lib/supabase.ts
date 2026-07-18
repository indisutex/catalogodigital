import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Faltan las credenciales de Supabase en el archivo .env');
}

export const getTenantId = () => {
  // First check URL path (slug)
  const pathname = window.location.pathname.replace(/^\/+/g, '').trim();
  const validTenants = [
    'saramantha', 'sublimados_majestic', 'pijamas_lucerito', 
    'sublimados-majestic', 'pijamas-lucerito', 'indisutex'
  ];
  
  if (pathname && validTenants.includes(pathname.toLowerCase())) {
    const normalised = pathname.toLowerCase().replace(/-/g, '_');
    setTenantId(normalised);
    return normalised;
  }

  // Then check URL params
  const urlParams = new URLSearchParams(window.location.search);
  const urlTenant = urlParams.get('tienda');
  if (urlTenant) {
    setTenantId(urlTenant);
    return urlTenant;
  }
  
  // Then check localStorage
  const stored = localStorage.getItem('tenant_id');
  if (stored) return stored;
  
  // Fallback to env or default
  return import.meta.env.VITE_TENANT_ID || 'saramantha';
};

export const setTenantId = (id: string) => {
  localStorage.setItem('tenant_id', id);
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
