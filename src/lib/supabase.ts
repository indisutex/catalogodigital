import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Faltan las credenciales de Supabase en el archivo .env');
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export interface ClosestStoreInfo {
  tenant_id: string;
  name: string;
  canonicalSlug: string;
  isTypo: boolean;
  rawSlug: string;
}

export const findClosestTenant = (raw: string): ClosestStoreInfo | null => {
  if (!raw) return null;
  const clean = raw.toLowerCase().trim().replace(/-/g, '_');

  const systemRoutes = [
    'admin', 'superadmin', 'pago', 'guia', 'menu', 'dist', 
    'assets', 'api', 'sw.js', 'manifest.json', 'products', 
    'orders', 'favicon.ico', 'robots.txt'
  ];
  if (systemRoutes.includes(clean)) return null;

  const knownTargets = [
    { tenant_id: 'sublimados_majestic', name: 'Sublimados Majestic', canonicalSlug: 'sublimados_majestic', exactKeys: ['sublimados_majestic', 'sublimados', 'majestic', 'sublimados-majestic', 'sublimadosmajestic'], typoKeys: ['sublimsados_majestic', 'sublimsados', 'majestik', 'majesti'] },
    { tenant_id: 'lucerito', name: 'Pijamas Lucerito', canonicalSlug: 'lucerito', exactKeys: ['lucerito', 'pijamas_lucerito', 'pijamas-lucerito', 'pijamaslucerito'], typoKeys: ['luceritoo', 'luceritoos', 'luzerito'] },
    { tenant_id: 'saramantha', name: 'Saramantha', canonicalSlug: 'saramantha', exactKeys: ['saramantha'], typoKeys: ['saramanta', 'saramantaa', 'saramanthaa'] },
    { tenant_id: 'lovely', name: 'Lovely', canonicalSlug: 'lovely', exactKeys: ['lovely'], typoKeys: ['lovly', 'lovelly'] }
  ];

  // 1. Exact match
  for (const t of knownTargets) {
    if (t.exactKeys.includes(clean)) {
      return { tenant_id: t.tenant_id, name: t.name, canonicalSlug: t.canonicalSlug, isTypo: false, rawSlug: raw };
    }
  }

  // 2. Explicit typo match
  for (const t of knownTargets) {
    if (t.typoKeys.includes(clean)) {
      return { tenant_id: t.tenant_id, name: t.name, canonicalSlug: t.canonicalSlug, isTypo: true, rawSlug: raw };
    }
  }

  // 3. Levenshtein fuzzy match (only for close typos of the specific brand name, max distance 2)
  let bestMatch: ClosestStoreInfo | null = null;
  let minDistance = Infinity;

  for (const t of knownTargets) {
    for (const key of t.exactKeys) {
      if (Math.abs(clean.length - key.length) <= 2) {
        const dist = levenshteinDistance(clean, key);
        if (dist < minDistance && dist <= 2) {
          minDistance = dist;
          bestMatch = { tenant_id: t.tenant_id, name: t.name, canonicalSlug: t.canonicalSlug, isTypo: true, rawSlug: raw };
        }
      }
    }
  }

  return bestMatch;
};

export const normalizeTenantId = (raw: string): string => {
  if (!raw) return 'sublimados_majestic';
  const match = findClosestTenant(raw);
  if (match) return match.tenant_id;
  return raw.toLowerCase().trim().replace(/-/g, '_');
};

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
    const normalised = normalizeTenantId(firstPart);
    setTenantId(normalised);
    return normalised;
  }

  // Then check URL params
  const urlParams = new URLSearchParams(window.location.search);
  const urlTenant = urlParams.get('tienda');
  if (urlTenant) {
    const normalised = normalizeTenantId(urlTenant);
    setTenantId(normalised);
    return normalised;
  }
  
  // Then check localStorage
  const stored = localStorage.getItem('tenant_id');
  if (stored) return normalizeTenantId(stored);
  
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
