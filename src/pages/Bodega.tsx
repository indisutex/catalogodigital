import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

interface Tienda { id: string; nombre: string; color: string; logo?: string }

interface Conteo {
  id: string;
  tenant_id: string;
  referencia: string;
  producto_nombre: string | null;
  talla: string;
  color: string;
  ubicacion: string;
  cantidad: number;
  contado_por: string | null;
  updated_at: string;
}

interface Cierre {
  id: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  enviado_por: string | null;
  enviado_at: string;
  total_lineas: number;
  total_unidades: number;
  detalle: Omit<Conteo, 'id'>[];
  resuelto_por: string | null;
  resuelto_at: string | null;
  nota: string | null;
}

interface ProductoRef {
  referencia: string;
  nombre: string;
  imagen_url: string | null;
  tallas: string[];
  categoria: string;
}

const FONT = "'Poppins', 'Inter', sans-serif";
const LOGO_BASE = 'https://dowbsbxvxjzjjhyqmyfr.supabase.co/storage/v1/object/public/archivos/';
const TIENDAS_BASE: Tienda[] = [
  { id: 'sublimados_majestic', nombre: 'Sublimados Majestic', color: '#f50081', logo: LOGO_BASE + 'logo_1788193731295.webp' },
  { id: 'lucerito', nombre: 'Pijamas Lucerito', color: '#a855f7', logo: LOGO_BASE + 'logo_1788197445120.webp' },
  { id: 'saramantha', nombre: 'Saramantha', color: '#ff0fdf', logo: LOGO_BASE + 'logo_1788197423178.webp' },
  { id: 'lovely', nombre: 'Lovely', color: '#d561ff', logo: LOGO_BASE + 'logo_1788197761050.webp' }
];
const CIERRE_TENANT = 'general';
// Cuentas que no se cuentan en bodega (super administrador y negocios que no son de la bodega)
const NO_TIENDAS = ['indisutex', 'default', 'superadmin', 'mamamia'];

function parseTallas(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  if (typeof v !== 'string' || !v.trim()) return [];
  const t = v.trim();
  if (t.startsWith('[')) {
    try { return (JSON.parse(t) as unknown[]).map(x => String(x).trim()).filter(Boolean); } catch { /* sigue */ }
  }
  return t.split(/[,;|]/).map(x => x.trim()).filter(Boolean);
}

// Trae todas las filas de una consulta (Supabase entrega máximo 1000 por petición)
async function traerTodo<T>(armar: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const todo: T[] = [];
  for (let desde = 0; desde < 20000; desde += 1000) {
    const { data, error } = await armar(desde, desde + 999);
    if (error || !Array.isArray(data)) break;
    todo.push(...(data as T[]));
    if (data.length < 1000) break;
  }
  return todo;
}

const PALETA = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#6366f1'];
function colorDe(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}
function nombreDe(id: string): string {
  return id.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Color de texto legible sobre el color de la tienda
function textoSobre(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.72 ? '#1e1b4b' : '#ffffff';
}

function Logo({ t, size }: { t: Tienda; size: number }) {
  const [fallo, setFallo] = useState(false);
  if (t.logo && !fallo) {
    return <img src={t.logo} alt={t.nombre} onError={() => setFallo(true)} style={{ width: size, height: size, objectFit: 'contain', display: 'block' }} />;
  }
  return (
    <span style={{ width: size, height: size, borderRadius: size / 4, background: t.color, color: textoSobre(t.color), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.45 }}>
      {t.nombre.trim().charAt(0).toUpperCase()}
    </span>
  );
}

const ICONOS: Record<string, string> = {
  caja: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3.3 7.5L12 12.3l8.7-4.8M12 12.3V21',
  buscar: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  atras: 'M15 18l-6-6 6-6',
  cerrar: 'M6 6l12 12M18 6L6 18',
  basura: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  usuario: 'M20 21a8 8 0 10-16 0M12 12a4 4 0 100-8 4 4 0 000 8z',
  flecha: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5'
};
function Ico({ n, s = 20 }: { n: keyof typeof ICONOS; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      <path d={ICONOS[n]} />
    </svg>
  );
}

const CSS = `
.bd { min-height:100vh; background:#eef0f6; font-family:${FONT}; color:#0f172a; font-size:17px; -webkit-tap-highlight-color:transparent; }
.bd *, .bd *::before, .bd *::after { box-sizing:border-box; }
.bd button, .bd input { font-family:${FONT}; }
.bd button { cursor:pointer; border:none; }
.bd-top { background:#0b1220; color:#fff; padding:.8rem 1.2rem; display:flex; align-items:center; justify-content:space-between; gap:.6rem; position:sticky; top:0; z-index:20; }
.bd-top h1 { font-size:1.2rem; margin:0; font-weight:700; display:flex; align-items:center; gap:.6rem; color:#fff; }
.bd-nav { display:flex; gap:.4rem; align-items:center; flex-wrap:wrap; }
.bd-nb { background:rgba(255,255,255,.12); color:#fff; border-radius:12px; padding:.65rem 1.1rem; font-weight:600; font-size:.95rem; min-height:46px; }
.bd-nb.on { background:#fff; color:#0f172a; }
.bd-nb.ok { background:#10b981; }
.bd-badge { background:#fbbf24; color:#78350f; font-size:.7rem; padding:2px 9px; border-radius:99px; font-weight:700; }
.bd-wrap { max-width:1240px; margin:0 auto; padding:1.2rem; }
.bd-h2 { font-size:1.5rem; font-weight:700; margin:.2rem 0 1rem; color:#0f172a; }
.bd-card h1, .bd-card h2 { color:#0f172a; }
.bd-tiles { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:1.1rem; }
.bd-tile { background:#fff; border-radius:22px; overflow:hidden; text-align:left; display:flex; flex-direction:column; border:1px solid #e6e9f2; box-shadow:0 1px 2px rgba(15,23,42,.05), 0 10px 28px rgba(15,23,42,.07); transition:transform .12s, box-shadow .12s; }
.bd-tile:active { transform:scale(.985); }
.bd-tile .bar { height:6px; background:var(--c); }
.bd-tile .logo { height:150px; display:flex; align-items:center; justify-content:center; background:linear-gradient(180deg,#fafbfe,#f1f4fa); padding:1.2rem; }
.bd-tile .info { padding:1rem 1.2rem 1.2rem; }
.bd-tile .nom { font-size:1.15rem; font-weight:700; color:#0f172a; }
.bd-tile .st { display:flex; gap:1.4rem; margin-top:.6rem; }
.bd-tile .st b { display:block; font-size:1.35rem; color:#0f172a; font-variant-numeric:tabular-nums; line-height:1.1; }
.bd-tile .st span { font-size:.72rem; color:#64748b; text-transform:uppercase; letter-spacing:.04em; font-weight:600; }
.bd-tile .cta { margin-top:1rem; background:var(--c); color:var(--t); border-radius:14px; padding:.8rem 1rem; font-weight:700; display:flex; justify-content:space-between; align-items:center; }
.bd-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:1rem; margin-bottom:1.4rem; }
.bd-kpi { background:#fff; border-radius:18px; padding:1rem 1.2rem; border:1px solid #e6e9f2; }
.bd-kpi b { display:block; font-size:1.9rem; line-height:1.1; font-variant-numeric:tabular-nums; color:#0f172a; }
.bd-kpi span { font-size:.75rem; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:.04em; }
.bd-who { display:flex; align-items:center; gap:.6rem; background:#fff; border:1px solid #e6e9f2; border-radius:16px; padding:0 1rem; color:#64748b; margin-top:1.2rem; }
.bd-who input { border:none; outline:none; flex:1; min-height:56px; font-size:1.05rem; background:transparent; }
.bd-cats { display:flex; gap:.5rem; overflow-x:auto; padding:.9rem 0 .2rem; -webkit-overflow-scrolling:touch; }
.bd-cat { flex:none; background:#fff; border:1px solid #e1e5ef; border-radius:99px; padding:.6rem 1.05rem; font-weight:600; font-size:.92rem; color:#334155; min-height:46px; }
.bd-cat i { font-style:normal; font-size:.75rem; background:#f1f5f9; border-radius:99px; padding:1px 8px; margin-left:4px; color:#64748b; }
.bd-cat.on { background:var(--c); border-color:var(--c); color:var(--t); }
.bd-cat.on i { background:rgba(255,255,255,.28); color:inherit; }
.bd-sw { position:relative; }
.bd-sw svg { position:absolute; left:1.1rem; top:50%; transform:translateY(-50%); color:#94a3b8; }
.bd-sw .bd-search { padding-left:3.2rem; }
.bd-logo-s { width:42px; height:42px; border-radius:12px; background:#fff; display:flex; align-items:center; justify-content:center; padding:4px; flex:none; }
.bd-card { background:#fff; border-radius:20px; padding:1.1rem; box-shadow:0 2px 10px rgba(15,23,42,.07); min-width:0; }
.bd-send { width:100%; min-height:64px; border-radius:18px; background:#0f172a; color:#fff; font-size:1.1rem; font-weight:700; margin-top:1.2rem; display:flex; align-items:center; justify-content:center; gap:.6rem; }
.bd-send:disabled { opacity:.45; }
.bd-split { display:grid; grid-template-columns:minmax(0,1fr); gap:1.2rem; align-items:start; }
@media (min-width:900px) { .bd-split { grid-template-columns:minmax(0,1.5fr) minmax(0,1fr); } .bd-side { position:sticky; top:84px; max-height:calc(100vh - 100px); overflow:auto; } }
.bd-search { width:100%; padding:1rem 1.2rem; border:none; border-radius:16px; font-size:1.2rem; background:#fff; box-shadow:0 2px 10px rgba(15,23,42,.08); min-height:60px; outline:2px solid transparent; }
.bd-search:focus { outline-color:var(--c,#6366f1); }
.bd-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:.8rem; margin-top:1rem; }
.bd-prod { background:#fff; border-radius:18px; overflow:hidden; text-align:left; box-shadow:0 2px 10px rgba(15,23,42,.07); position:relative; display:flex; flex-direction:column; }
.bd-prod:active { transform:scale(.98); }
.bd-prod .img { aspect-ratio:1/1; background:#e2e8f0 center/cover no-repeat; }
.bd-prod .tx { padding:.6rem .7rem .8rem; }
.bd-prod .rf { font-weight:700; font-size:.95rem; }
.bd-prod .nm { font-size:.78rem; color:#64748b; line-height:1.25; margin-top:2px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.bd-prod .hay { position:absolute; top:8px; right:8px; background:var(--c); color:var(--t); border-radius:99px; padding:3px 10px; font-size:.75rem; font-weight:700; }
.bd-nuevo { border:3px dashed #94a3b8; background:transparent; color:#475569; border-radius:18px; padding:1rem; font-weight:600; min-height:150px; }
.bd-row { display:flex; align-items:center; justify-content:space-between; gap:.6rem; padding:.8rem 0; border-top:1px solid #f1f5f9; }
.bd-row:first-child { border-top:none; }
.bd-step { width:50px; height:50px; border-radius:14px; background:#f1f5f9; font-size:1.6rem; font-weight:700; color:#0f172a; flex:none; }
.bd-q { width:74px; text-align:center; font-size:1.3rem; font-weight:700; border:none; background:transparent; padding:.3rem 0; }
.bd-pill { display:inline-block; background:#f1f5f9; border-radius:99px; padding:2px 10px; font-size:.78rem; font-weight:600; color:#475569; margin:2px 4px 0 0; }
.bd-ov { position:fixed; inset:0; background:rgba(15,23,42,.55); z-index:50; display:flex; align-items:flex-end; justify-content:center; }
@media (min-width:700px) { .bd-ov { align-items:center; } }
.bd-sheet { background:#fff; width:100%; max-width:560px; border-radius:26px 26px 0 0; padding:1.3rem; max-height:94vh; overflow:auto; }
@media (min-width:700px) { .bd-sheet { border-radius:26px; } }
.bd-lbl { font-size:.75rem; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.04em; margin:1.1rem 0 .5rem; display:block; }
.bd-chips { display:flex; gap:.5rem; flex-wrap:wrap; }
.bd-ch { min-width:68px; min-height:56px; padding:.5rem 1rem; border-radius:14px; background:#f1f5f9; font-weight:700; font-size:1.1rem; color:#0f172a; }
.bd-ch small { display:block; font-size:.65rem; font-weight:600; opacity:.7; }
.bd-in { width:100%; min-height:54px; padding:.8rem 1rem; border-radius:14px; border:2px solid #e2e8f0; font-size:1.05rem; background:#fff; }
.bd-qty { display:flex; align-items:center; gap:.6rem; }
.bd-qty .bd-step { width:68px; height:68px; font-size:2rem; }
.bd-qty input { flex:1; min-width:0; height:68px; text-align:center; font-size:2.2rem; font-weight:700; border:2px solid #e2e8f0; border-radius:16px; }
.bd-go { width:100%; min-height:64px; border-radius:18px; font-size:1.2rem; font-weight:700; margin-top:1.1rem; }
.bd-toast { position:fixed; left:50%; bottom:22px; transform:translateX(-50%); padding:.9rem 1.4rem; border-radius:16px; font-weight:600; z-index:80; box-shadow:0 8px 24px rgba(15,23,42,.3); max-width:92vw; }
.bd-env { display:grid; grid-template-columns:minmax(0,1fr); gap:.9rem; }
.bd table { width:100%; border-collapse:collapse; }
.bd th { text-align:left; padding:.5rem; color:#64748b; font-size:.7rem; text-transform:uppercase; }
.bd td { padding:.5rem; border-top:1px solid #f1f5f9; }
`;

export default function Bodega() {
  const [autenticado, setAutenticado] = useState(() => {
    try { return localStorage.getItem('bodega_auth') === 'true'; } catch { return false; }
  });
  const [esAdmin, setEsAdmin] = useState(() => {
    try { return localStorage.getItem('bodega_role') === 'admin'; } catch { return false; }
  });
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verificando, setVerificando] = useState(false);

  const [tiendas, setTiendas] = useState<Tienda[]>(TIENDAS_BASE);
  const [tienda, setTienda] = useState<string | null>(null);
  const [vista, setVista] = useState<'inicio' | 'envios'>('inicio');
  const [productos, setProductos] = useState<ProductoRef[]>([]);
  const [cargandoProd, setCargandoProd] = useState(false);
  const [conteos, setConteos] = useState<Conteo[]>([]);
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  const [contador, setContador] = useState(() => {
    try { return localStorage.getItem('bodega_contador') || ''; } catch { return ''; }
  });
  const [busqueda, setBusqueda] = useState('');
  const [cat, setCat] = useState<string>('todas');
  const [hoja, setHoja] = useState<ProductoRef | null>(null);
  const [talla, setTalla] = useState('');
  const [color, setColor] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [cant, setCant] = useState(1);
  const [guardando, setGuardando] = useState(false);

  const mostrar = (tipo: 'ok' | 'error', texto: string) => {
    setAviso({ tipo, texto });
    window.setTimeout(() => setAviso(null), 3200);
  };

  const nombreTienda = (id: string) => tiendas.find(t => t.id === id)?.nombre || id;
  const infoTienda = tiendas.find(t => t.id === tienda) || null;
  const colorTienda = infoTienda?.color || '#6366f1';

  async function cargarConteos() {
    const { data, error } = await supabase.from('bodega_conteos').select('*').order('updated_at', { ascending: false }).limit(5000);
    if (error) mostrar('error', 'No se pudo cargar. ¿Ya ejecutaste el SQL de bodega en Supabase?');
    else setConteos((data as Conteo[]) || []);
  }

  async function cargarCierres() {
    const { data } = await supabase.from('bodega_cierres').select('*').eq('tenant_id', CIERRE_TENANT).order('enviado_at', { ascending: false }).limit(100);
    setCierres((data as Cierre[]) || []);
  }

  async function cargarTodo() {
    setCargando(true);
    const [cfg, marcas] = await Promise.all([
      supabase.from('configuracion').select('tenant_id,nombre_negocio,color_primario,logo_url').then(r => (r.data as { tenant_id: string; nombre_negocio?: string; color_primario?: string; logo_url?: string }[]) || []),
      traerTodo<{ tenant_id: string }>((d, h) => supabase.from('productos').select('tenant_id').range(d, h))
    ]);
    const mapa = new Map<string, Tienda>();
    const valido = (id: string | null | undefined): id is string => !!id && !NO_TIENDAS.includes(id.toLowerCase());
    for (const c of cfg) {
      if (!valido(c.tenant_id) || mapa.has(c.tenant_id)) continue;
      mapa.set(c.tenant_id, { id: c.tenant_id, nombre: c.nombre_negocio || nombreDe(c.tenant_id), color: c.color_primario || colorDe(c.tenant_id), logo: c.logo_url || TIENDAS_BASE.find(t => t.id === c.tenant_id)?.logo });
    }
    for (const m of marcas) {
      if (!valido(m.tenant_id) || mapa.has(m.tenant_id)) continue;
      mapa.set(m.tenant_id, { id: m.tenant_id, nombre: nombreDe(m.tenant_id), color: colorDe(m.tenant_id) });
    }
    if (mapa.size) setTiendas([...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    await Promise.all([cargarConteos(), cargarCierres()]);
    setCargando(false);
  }

  useEffect(() => {
    if (autenticado) cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autenticado]);

  // Productos de la tienda abierta (todos, ordenados por categoría)
  useEffect(() => {
    if (!autenticado || !tienda) return;
    let vigente = true;
    setProductos([]);
    setCat('todas');
    setCargandoProd(true);
    traerTodo<{ referencia: string | null; nombre: string | null; imagen_url: string | null; tallas: unknown; categoria: string | null; created_at: string }>(
      (d, h) => supabase.from('productos').select('referencia,nombre,imagen_url,tallas,categoria,created_at').eq('tenant_id', tienda).order('created_at', { ascending: true }).range(d, h)
    ).then(filas => {
      if (!vigente) return;
      const usados = new Map<string, number>();
      const lista: ProductoRef[] = [];
      for (const p of filas) {
        const base = String(p.referencia || p.nombre || '').trim();
        if (!base) continue;
        const veces = (usados.get(base) || 0) + 1;
        usados.set(base, veces);
        lista.push({
          referencia: veces > 1 ? `${base} (${veces})` : base,
          nombre: (p.nombre || '').trim(),
          imagen_url: p.imagen_url,
          tallas: parseTallas(p.tallas),
          categoria: (p.categoria || '').trim() || 'Sin categoría'
        });
      }
      lista.sort((x, y) => x.categoria.localeCompare(y.categoria, 'es') || x.nombre.localeCompare(y.nombre, 'es', { numeric: true }));
      setProductos(lista);
      setCargandoProd(false);
    });
    return () => { vigente = false; };
  }, [tienda, autenticado]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setVerificando(true);
    setPinError('');
    const { data } = await supabase.from('bodega_ajustes').select('*').eq('id', 1).maybeSingle();
    const limpio = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const pinAdmin = limpio(data?.pin_admin) || '0000';
    const pinBodega = limpio(data?.pin_bodega);
    const intento = pin.trim();
    const admin = intento === pinAdmin;
    if (admin || (pinBodega !== '' && intento === pinBodega)) {
      try {
        localStorage.setItem('bodega_auth', 'true');
        localStorage.setItem('bodega_role', admin ? 'admin' : 'bodega');
      } catch { /* sin almacenamiento */ }
      setEsAdmin(admin);
      setAutenticado(true);
    } else {
      setPinError('PIN incorrecto');
    }
    setVerificando(false);
  }

  function salir() {
    try { localStorage.removeItem('bodega_auth'); localStorage.removeItem('bodega_role'); } catch { /* sin almacenamiento */ }
    setAutenticado(false);
    setEsAdmin(false);
    setTienda(null);
    setVista('inicio');
    setPin('');
  }

  const conteosTienda = useMemo(() => conteos.filter(c => c.tenant_id === tienda), [conteos, tienda]);
  const unidadesRef = useMemo(() => {
    const m = new Map<string, number>();
    conteosTienda.forEach(c => m.set(c.referencia, (m.get(c.referencia) || 0) + c.cantidad));
    return m;
  }, [conteosTienda]);

  const resumenTienda = useMemo(() => {
    const m = new Map<string, { unidades: number; lineas: number }>();
    conteos.forEach(c => {
      const r = m.get(c.tenant_id) || { unidades: 0, lineas: 0 };
      r.unidades += c.cantidad;
      r.lineas += 1;
      m.set(c.tenant_id, r);
    });
    return m;
  }, [conteos]);

  const totalUnidades = conteos.reduce((s, c) => s + c.cantidad, 0);
  const hayPendiente = cierres.some(c => c.estado === 'pendiente');
  const pendientes = cierres.filter(c => c.estado === 'pendiente').length;

  const categorias = useMemo(() => {
    const m = new Map<string, number>();
    productos.forEach(p => m.set(p.categoria, (m.get(p.categoria) || 0) + 1));
    return [...m.entries()];
  }, [productos]);

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let base = productos;
    if (cat === '__contados') base = base.filter(p => (unidadesRef.get(p.referencia) || 0) > 0);
    else if (cat !== 'todas') base = base.filter(p => p.categoria === cat);
    if (q) base = base.filter(p => p.referencia.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q));
    return base.slice(0, 300);
  }, [productos, busqueda, cat, unidadesRef]);

  const hayExacta = productos.some(p => p.referencia.toLowerCase() === busqueda.trim().toLowerCase());

  function abrirHoja(p: ProductoRef) {
    setHoja(p);
    setTalla(p.tallas.length === 1 ? p.tallas[0] : '');
    setColor('');
    setUbicacion('');
    setCant(1);
  }

  async function sumar(t: string, ref: string, nombre: string | null, tl: string, col: string, ubi: string, n: number) {
    const { error } = await supabase.rpc('bodega_sumar', {
      p_tenant: t, p_referencia: ref, p_producto: nombre, p_talla: tl,
      p_color: col, p_ubicacion: ubi, p_cantidad: n, p_por: contador.trim() || null
    });
    return error;
  }

  async function guardar() {
    if (!hoja || !tienda) return;
    if (hoja.tallas.length > 1 && !talla.trim()) return mostrar('error', 'Elige la talla');
    if (cant < 1) return mostrar('error', 'La cantidad debe ser 1 o más');
    setGuardando(true);
    const error = await sumar(tienda, hoja.referencia, hoja.nombre || null, talla.trim(), color.trim(), ubicacion.trim(), cant);
    setGuardando(false);
    if (error) return mostrar('error', 'No se pudo guardar: ' + error.message);
    mostrar('ok', `+${cant} ${hoja.referencia}${talla ? ' · ' + talla : ''}`);
    setHoja(null);
    setBusqueda('');
    cargarConteos();
  }

  async function ajustar(c: Conteo, delta: number) {
    if (c.cantidad + delta < 0) return;
    setConteos(prev => prev.map(x => (x.id === c.id ? { ...x, cantidad: x.cantidad + delta } : x)));
    const error = await sumar(c.tenant_id, c.referencia, c.producto_nombre, c.talla, c.color, c.ubicacion, delta);
    if (error) { mostrar('error', 'No se pudo actualizar'); cargarConteos(); }
  }

  async function fijar(c: Conteo, nueva: number) {
    if (Number.isNaN(nueva) || nueva < 0 || nueva === c.cantidad) return;
    setConteos(prev => prev.map(x => (x.id === c.id ? { ...x, cantidad: nueva } : x)));
    const { error } = await supabase.from('bodega_conteos').update({ cantidad: nueva, contado_por: contador.trim() || c.contado_por, updated_at: new Date().toISOString() }).eq('id', c.id);
    if (error) { mostrar('error', 'No se pudo actualizar'); cargarConteos(); }
  }

  async function eliminar(c: Conteo) {
    if (!window.confirm(`¿Quitar ${c.referencia} ${c.talla} ${c.color}?`)) return;
    const { error } = await supabase.from('bodega_conteos').delete().eq('id', c.id);
    if (error) return mostrar('error', 'No se pudo quitar');
    setConteos(prev => prev.filter(x => x.id !== c.id));
  }

  function exportar() {
    const filas = conteos.map(c => ({
      Tienda: nombreTienda(c.tenant_id), Referencia: c.referencia, Producto: c.producto_nombre || '',
      Talla: c.talla, Color: c.color, Ubicación: c.ubicacion, Cantidad: c.cantidad,
      'Contado por': c.contado_por || '', Actualizado: new Date(c.updated_at).toLocaleString('es-CO')
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bodega');
    XLSX.writeFile(wb, `bodega_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function enviarAprobacion() {
    if (conteos.length === 0) return mostrar('error', 'No hay nada para enviar');
    if (hayPendiente) return mostrar('error', 'Ya hay un conteo esperando aprobación');
    if (!window.confirm(`¿Enviar ${conteos.length} líneas (${totalUnidades} unidades, todas las tiendas) a aprobación? La lista de trabajo quedará vacía.`)) return;
    const detalle = conteos.map(({ id: _id, ...resto }) => resto);
    const { error } = await supabase.from('bodega_cierres').insert({
      tenant_id: CIERRE_TENANT, enviado_por: contador.trim() || null,
      total_lineas: conteos.length, total_unidades: totalUnidades, detalle
    });
    if (error) return mostrar('error', 'No se pudo enviar: ' + error.message);
    const ids = conteos.map(c => c.id);
    let fallo = false;
    for (let i = 0; i < ids.length; i += 100) {
      const { error: eb } = await supabase.from('bodega_conteos').delete().in('id', ids.slice(i, i + 100));
      if (eb) fallo = true;
    }
    if (fallo) mostrar('error', 'Se envió, pero no se pudo vaciar toda la lista');
    else mostrar('ok', 'Enviado. Falta la aprobación del administrador.');
    setTienda(null);
    setVista('envios');
    cargarTodo();
  }

  async function resolver(c: Cierre, estado: 'aprobado' | 'rechazado') {
    let nota: string | null = null;
    if (estado === 'rechazado') {
      nota = window.prompt('Motivo del rechazo (para que bodega sepa qué corregir):');
      if (nota === null) return;
    } else if (!window.confirm(`¿Aprobar el conteo de ${c.total_lineas} líneas y ${c.total_unidades} unidades?`)) {
      return;
    }
    const { error } = await supabase.from('bodega_cierres')
      .update({ estado, nota, resuelto_por: contador.trim() || 'Administrador', resuelto_at: new Date().toISOString() })
      .eq('id', c.id).eq('estado', 'pendiente');
    if (error) return mostrar('error', 'No se pudo guardar la decisión');
    mostrar('ok', estado === 'aprobado' ? 'Conteo aprobado' : 'Conteo rechazado');
    cargarCierres();
  }

  async function recuperar(c: Cierre) {
    if (conteos.length > 0 && !window.confirm('Ya hay líneas en la lista de trabajo. Si coinciden con las del envío rechazado, se reemplaza su cantidad. ¿Continuar?')) return;
    const ahora = new Date().toISOString();
    const { error } = await supabase.from('bodega_conteos')
      .upsert(c.detalle.map(d => ({ ...d, updated_at: ahora })), { onConflict: 'tenant_id,referencia,talla,color,ubicacion' });
    if (error) return mostrar('error', 'No se pudo recuperar: ' + error.message);
    mostrar('ok', 'Líneas recuperadas. Corrígelas y vuelve a enviar.');
    setVista('inicio');
    cargarConteos();
  }

  // ───────────── Pantalla de PIN ─────────────
  if (!autenticado) {
    return (
      <div className="bd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'linear-gradient(160deg,#0f172a,#312e81)' }}>
        <style>{CSS}</style>
        <form onSubmit={entrar} className="bd-card" style={{ width: '100%', maxWidth: 380, textAlign: 'center', padding: '2.2rem 1.6rem', borderRadius: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'center', color: '#4f46e5' }}><Ico n="caja" s={48} /></div>
          <h1 style={{ fontSize: '1.6rem', margin: '.3rem 0 .2rem' }}>Bodega</h1>
          <p style={{ color: '#64748b', margin: '0 0 1.2rem' }}>Ingresa tu PIN</p>
          <input className="bd-in" type="password" inputMode="numeric" autoFocus value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" style={{ textAlign: 'center', letterSpacing: '.4em', fontSize: '1.8rem', minHeight: 68 }} />
          {pinError && <p style={{ color: '#dc2626', fontWeight: 600, margin: '.7rem 0 0' }}>{pinError}</p>}
          <button className="bd-go" type="submit" disabled={verificando || !pin.trim()} style={{ background: '#4f46e5', color: '#fff', opacity: verificando || !pin.trim() ? 0.55 : 1 }}>
            {verificando ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    );
  }

  const enTienda = !!tienda && !!infoTienda && vista === 'inicio';

  return (
    <div className="bd" style={{ ['--c' as string]: colorTienda, ['--t' as string]: textoSobre(colorTienda) }}>
      <style>{CSS}</style>

      <header className="bd-top">
        <h1>
          {enTienda ? (
            <>
              <button className="bd-nb" onClick={() => { setTienda(null); setBusqueda(''); }} style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}><Ico n="atras" /> Tiendas</button>
              <span className="bd-logo-s"><Logo t={infoTienda!} size={34} /></span>
              <span>{infoTienda!.nombre}</span>
            </>
          ) : <span style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}><Ico n="caja" s={24} /> Bodega</span>}
          {esAdmin && <span className="bd-badge">Admin</span>}
        </h1>
        <nav className="bd-nav">
          <button className={`bd-nb ${vista === 'inicio' ? 'on' : ''}`} onClick={() => { setVista('inicio'); setTienda(null); }}>Conteo</button>
          <button className={`bd-nb ${vista === 'envios' ? 'on' : ''}`} onClick={() => setVista('envios')}>Envíos{pendientes ? ` · ${pendientes}` : ''}</button>
          <button className="bd-nb" onClick={exportar} disabled={conteos.length === 0}>Excel</button>
          <button className="bd-nb" onClick={salir}>Salir</button>
        </nav>
      </header>

      <main className="bd-wrap">
        {/* ───────────── INICIO: elegir tienda ───────────── */}
        {vista === 'inicio' && !tienda && (
          <>
            <h2 className="bd-h2">Control de bodega</h2>
            <div className="bd-kpis">
              <div className="bd-kpi"><b>{totalUnidades}</b><span>Unidades contadas</span></div>
              <div className="bd-kpi"><b>{conteos.length}</b><span>Líneas</span></div>
              <div className="bd-kpi"><b>{resumenTienda.size}<small style={{ fontSize: '1rem', color: '#94a3b8' }}> / {tiendas.length}</small></b><span>Tiendas con conteo</span></div>
              <div className="bd-kpi"><b style={{ fontSize: '1.2rem', paddingTop: '.35rem' }}>{hayPendiente ? 'En aprobación' : 'Sin envíos pendientes'}</b><span>Estado</span></div>
            </div>
            <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 .7rem' }}>Selecciona la tienda a contar</div>
            <div className="bd-tiles">
              {tiendas.map(t => {
                const r = resumenTienda.get(t.id);
                return (
                  <button key={t.id} className="bd-tile" onClick={() => { setTienda(t.id); setBusqueda(''); }} style={{ ['--c' as string]: t.color, ['--t' as string]: textoSobre(t.color) }}>
                    <div className="bar" />
                    <div className="logo"><Logo t={t} size={110} /></div>
                    <div className="info">
                      <div className="nom">{t.nombre}</div>
                      <div className="st">
                        <div><b>{r ? r.unidades : 0}</b><span>Unidades</span></div>
                        <div><b>{r ? r.lineas : 0}</b><span>Líneas</span></div>
                      </div>
                      <div className="cta"><span>Contar</span><Ico n="flecha" /></div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="bd-who">
              <Ico n="usuario" />
              <input value={contador} placeholder="Quién cuenta (nombre)" onChange={e => {
                setContador(e.target.value);
                try { localStorage.setItem('bodega_contador', e.target.value); } catch { /* sin almacenamiento */ }
              }} />
            </div>

            <button className="bd-send" onClick={enviarAprobacion} disabled={conteos.length === 0 || hayPendiente}>
              {hayPendiente ? 'Hay un conteo esperando aprobación' : <><Ico n="check" /> Terminar y enviar a aprobación</>}
            </button>
            {cargando && <p style={{ textAlign: 'center', color: '#94a3b8' }}>Cargando...</p>}
          </>
        )}

        {/* ───────────── DENTRO DE UNA TIENDA ───────────── */}
        {enTienda && (
          <div className="bd-split">
            <div style={{ minWidth: 0 }}>
              <div className="bd-sw"><Ico n="buscar" s={22} /><input className="bd-search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar referencia o nombre" autoFocus /></div>
              {productos.length > 0 && (
                <div className="bd-cats">
                  <button className={`bd-cat ${cat === 'todas' ? 'on' : ''}`} onClick={() => setCat('todas')}>Todas <i>{productos.length}</i></button>
                  <button className={`bd-cat ${cat === '__contados' ? 'on' : ''}`} onClick={() => setCat('__contados')}>Contados <i>{[...unidadesRef.values()].filter(v => v > 0).length}</i></button>
                  {categorias.map(([c, n]) => (
                    <button key={c} className={`bd-cat ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c} <i>{n}</i></button>
                  ))}
                </div>
              )}
              {cargandoProd && <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '1.5rem' }}>Cargando productos...</p>}
              <div className="bd-grid">
                {busqueda.trim() && !hayExacta && (
                  <button className="bd-nuevo" onClick={() => abrirHoja({ referencia: busqueda.trim(), nombre: '', imagen_url: null, tallas: [], categoria: 'Sin categoría' })}>
                    + Referencia nueva<br />«{busqueda.trim()}»
                  </button>
                )}
                {resultados.map(p => {
                  const hay = unidadesRef.get(p.referencia) || 0;
                  return (
                    <button key={p.referencia} className="bd-prod" onClick={() => abrirHoja(p)}>
                      <div className="img" style={p.imagen_url ? { backgroundImage: `url("${p.imagen_url}")` } : undefined} />
                      {hay > 0 && <span className="hay">{hay}</span>}
                      <div className="tx"><div className="rf">{p.referencia}</div><div className="nm">{p.nombre}</div></div>
                    </button>
                  );
                })}
              </div>
              {!cargandoProd && resultados.length === 0 && !busqueda.trim() && (
                <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>No hay productos que coincidan. Si es una referencia nueva, escríbela arriba para agregarla.</p>
              )}
            </div>

            <aside className="bd-card bd-side">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong style={{ fontSize: '1.15rem' }}>Contado en {infoTienda!.nombre}</strong>
                <span style={{ color: '#64748b', fontWeight: 600 }}>{conteosTienda.reduce((s, c) => s + c.cantidad, 0)} u.</span>
              </div>
              {conteosTienda.length === 0 && <p style={{ color: '#94a3b8', marginBottom: 0 }}>Toca un producto para empezar a sumar.</p>}
              {conteosTienda.map(c => (
                <div key={c.id} className="bd-row">
                  <div style={{ minWidth: 0 }}>
                    <strong>{c.referencia}</strong>
                    <div style={{ fontSize: '.8rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.producto_nombre}</div>
                    {c.talla && <span className="bd-pill">Talla {c.talla}</span>}
                    {c.color && <span className="bd-pill">{c.color}</span>}
                    {c.ubicacion && <span className="bd-pill">Estante {c.ubicacion}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>
                    <button className="bd-step" onClick={() => ajustar(c, -1)}>−</button>
                    <input key={c.id + ':' + c.cantidad} className="bd-q" type="number" inputMode="numeric" min={0} defaultValue={c.cantidad} onBlur={e => fijar(c, parseInt(e.target.value, 10))} />
                    <button className="bd-step" onClick={() => ajustar(c, 1)}>+</button>
                    <button onClick={() => eliminar(c)} aria-label="Quitar" style={{ background: 'transparent', color: '#94a3b8', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico n="basura" /></button>
                  </div>
                </div>
              ))}
            </aside>
          </div>
        )}

        {/* ───────────── ENVÍOS / APROBACIÓN ───────────── */}
        {vista === 'envios' && (
          <>
            <h2 className="bd-h2">Envíos a aprobación</h2>
            <div className="bd-env">
              {cierres.length === 0 && <div className="bd-card" style={{ textAlign: 'center', color: '#94a3b8' }}>Aún no se ha enviado ningún conteo.</div>}
              {cierres.map(c => (
                <div key={c.id} className="bd-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <strong>{new Date(c.enviado_at).toLocaleString('es-CO')}</strong>
                      <div style={{ fontSize: '.85rem', color: '#64748b' }}>{c.total_lineas} líneas · {c.total_unidades} unidades{c.enviado_por ? ` · ${c.enviado_por}` : ''}</div>
                    </div>
                    <span style={{ padding: '5px 14px', borderRadius: 99, fontSize: '.8rem', fontWeight: 700, background: c.estado === 'aprobado' ? '#dcfce7' : c.estado === 'rechazado' ? '#fee2e2' : '#fef3c7', color: c.estado === 'aprobado' ? '#166534' : c.estado === 'rechazado' ? '#991b1b' : '#92400e' }}>
                      {c.estado === 'pendiente' ? 'Pendiente de aprobación' : c.estado === 'aprobado' ? 'Aprobado' : 'Rechazado'}
                    </span>
                  </div>
                  {c.resuelto_at && (
                    <div style={{ fontSize: '.85rem', color: '#64748b', marginTop: '.5rem' }}>
                      {c.estado === 'aprobado' ? 'Aprobó' : 'Rechazó'}: {c.resuelto_por || 'Administrador'} · {new Date(c.resuelto_at).toLocaleString('es-CO')}{c.nota ? ` · Motivo: ${c.nota}` : ''}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '.5rem', marginTop: '.9rem', flexWrap: 'wrap' }}>
                    <button className="bd-nb" style={{ background: '#e2e8f0', color: '#0f172a' }} onClick={() => setAbierto(abierto === c.id ? null : c.id)}>{abierto === c.id ? 'Ocultar detalle' : 'Ver detalle'}</button>
                    {esAdmin && c.estado === 'pendiente' && (
                      <>
                        <button className="bd-nb" style={{ background: '#059669' }} onClick={() => resolver(c, 'aprobado')}>Aprobar</button>
                        <button className="bd-nb" style={{ background: '#dc2626' }} onClick={() => resolver(c, 'rechazado')}>Rechazar</button>
                      </>
                    )}
                    {c.estado === 'rechazado' && <button className="bd-nb" style={{ background: '#4f46e5' }} onClick={() => recuperar(c)}>Recuperar para corregir</button>}
                  </div>
                  {!esAdmin && c.estado === 'pendiente' && <p style={{ margin: '.7rem 0 0', fontSize: '.8rem', color: '#94a3b8' }}>Solo el administrador (con su PIN) puede aprobar.</p>}
                  {abierto === c.id && (
                    <div style={{ overflowX: 'auto', marginTop: '.8rem' }}>
                      <table style={{ minWidth: 460, fontSize: '.9rem' }}>
                        <thead><tr><th>Tienda</th><th>Referencia</th><th>Talla</th><th>Color</th><th style={{ textAlign: 'right' }}>Cant.</th></tr></thead>
                        <tbody>
                          {c.detalle.map((d, i) => (
                            <tr key={i}>
                              <td>{nombreTienda(d.tenant_id)}</td>
                              <td>{d.referencia}{d.producto_nombre ? ` · ${d.producto_nombre}` : ''}</td>
                              <td>{d.talla || '—'}</td><td>{d.color || '—'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{d.cantidad}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* ───────────── Ventana para sumar ───────────── */}
      {hoja && tienda && (
        <div className="bd-ov" onClick={() => setHoja(null)}>
          <div className="bd-sheet" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: '.9rem', alignItems: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: 16, background: '#e2e8f0 center/cover no-repeat', backgroundImage: hoja.imagen_url ? `url("${hoja.imagen_url}")` : undefined, flex: 'none' }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{hoja.referencia}</div>
                <div style={{ color: '#64748b', fontSize: '.9rem' }}>{hoja.nombre || 'Referencia nueva'}</div>
                <span className="bd-pill" style={{ background: colorTienda, color: textoSobre(colorTienda), display: 'inline-flex', alignItems: 'center', gap: 6 }}>{nombreTienda(tienda)}</span>
              </div>
              <button onClick={() => setHoja(null)} aria-label="Cerrar" style={{ background: '#f1f5f9', width: 46, height: 46, borderRadius: 14, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico n="cerrar" /></button>
            </div>

            <span className="bd-lbl">Talla</span>
            <div className="bd-chips">
              {hoja.tallas.map(t => {
                const ya = conteosTienda.filter(c => c.referencia === hoja.referencia && c.talla === t).reduce((s, c) => s + c.cantidad, 0);
                const on = talla === t;
                return (
                  <button key={t} className="bd-ch" onClick={() => setTalla(t)} style={on ? { background: colorTienda, color: textoSobre(colorTienda) } : undefined}>
                    {t}{ya > 0 && <small>{ya} en bodega</small>}
                  </button>
                );
              })}
              <input className="bd-in" style={{ width: 150 }} value={hoja.tallas.includes(talla) ? '' : talla} onChange={e => setTalla(e.target.value)} placeholder={hoja.tallas.length ? 'Otra talla' : 'Talla (opcional)'} />
            </div>

            <span className="bd-lbl">Cantidad a sumar</span>
            <div className="bd-qty">
              <button className="bd-step" onClick={() => setCant(c => Math.max(1, c - 1))}>−</button>
              <input type="number" inputMode="numeric" min={1} value={cant || ''} onChange={e => setCant(Math.max(0, parseInt(e.target.value, 10) || 0))} />
              <button className="bd-step" onClick={() => setCant(c => c + 1)}>+</button>
            </div>
            <div className="bd-chips" style={{ marginTop: '.6rem' }}>
              {[5, 10, 20, 50].map(n => <button key={n} className="bd-ch" style={{ flex: 1 }} onClick={() => setCant(c => c + n)}>+{n}</button>)}
            </div>

            <details style={{ marginTop: '1rem' }}>
              <summary style={{ cursor: 'pointer', color: '#475569', fontWeight: 600, padding: '.4rem 0' }}>Color o ubicación (opcional)</summary>
              <div style={{ display: 'flex', gap: '.5rem', marginTop: '.4rem' }}>
                <input className="bd-in" value={color} onChange={e => setColor(e.target.value)} placeholder="Color" />
                <input className="bd-in" value={ubicacion} onChange={e => setUbicacion(e.target.value)} placeholder="Estante" />
              </div>
            </details>

            <button className="bd-go" onClick={guardar} disabled={guardando} style={{ background: colorTienda, color: textoSobre(colorTienda), opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando...' : `Sumar ${cant} a bodega`}
            </button>
          </div>
        </div>
      )}

      {aviso && (
        <div className="bd-toast" style={{ background: aviso.tipo === 'ok' ? '#065f46' : '#991b1b', color: '#fff' }}>{aviso.texto}</div>
      )}
    </div>
  );
}
