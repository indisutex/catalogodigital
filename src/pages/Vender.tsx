import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getEffectivePrice } from '../context/CartContext';
import type { BuyerType } from '../context/CartContext';
import type { Producto } from '../types';
import { DEPARTAMENTOS_COLOMBIA } from '../data/colombiaData';
import { etiqueta, codigo, compartirImagen, copiarTexto, urlWhatsAppGrupo, totalUnidades, enviarAlCliente, descargarImagen, textoCliente, textoRecordatorioPago, textoDespacho, urlWhatsAppCliente } from '../lib/fichaPedido';
import type { PedidoVista } from '../lib/fichaPedido';
import { estadoDe, lineaTiempo } from '../lib/trazabilidadPedido';
import type { GrupoPago } from '../lib/trazabilidadPedido';
import { compressImage } from '../lib/imageCompression';
import { iaDisponible, leerConIA, prepararImagen, armarRevision, MAX_CAPTURAS } from '../lib/leerPedido';
import type { ImagenIA, IaRevision, IaLinea } from '../lib/leerPedido';

interface Asesor { id: string; nombre: string; telefono: string; tenant_id: string; foto_url?: string | null }

interface Config {
  nombre_negocio?: string;
  logo_url?: string;
  color_primario?: string;
  whatsapp?: string;
  direccion?: string;
  metodos_pago?: string;
  descuento_promocional?: number;
  descuento_mayor_carrito_activo?: boolean;
}

interface Linea { key: string; prod: Producto; talla: string; opcion: string; estampado: string; cantidad: number }

const FONT = "'Poppins', 'Inter', sans-serif";
const SESION = 'vender_asesor';
const MAX_PEDIDOS_ABIERTOS = 8;

const FORM_VACIO = { nombre: '', telefono: '', cedula: '', email: '', recepcion: 'domicilio', pago: 'transferencia', depto: '', ciudad: '', direccion: '', barrio: '', nota: '' };
type FormCliente = typeof FORM_VACIO;
interface Borrador { id: string; lineas: Linea[]; f: FormCliente }
const nuevoBorrador = (): Borrador => ({ id: `b${Date.now()}${Math.random().toString(36).slice(2, 6)}`, lineas: [], f: { ...FORM_VACIO } });

const peso = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
const soloDigitos = (s?: string | null) => (s || '').replace(/\D/g, '');
const primerTel = (t: string) => soloDigitos((t || '').split(/[,;/]/)[0]).slice(-10);
const tierDe = (u: number, activo: boolean): BuyerType => (!activo ? 'detal' : u >= 50 ? '50_unidades' : u >= 6 ? 'mayorista' : 'detal');


function parseTallas(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  if (typeof v !== 'string' || !v.trim()) return [];
  return v.split(/[,;|]/).map(x => x.trim()).filter(Boolean);
}

function parseFam(v: unknown): any | null {
  if (!v) return null;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
  return typeof v === 'object' ? v : null;
}

const esFamiliar = (p: Producto) => Boolean(p.es_producto_familiar || p.categoria === 'familiar' || p.precios_familia);

function opcionesDe(p: Producto): { clave: string; texto: string }[] {
  const fam = parseFam(p.precios_familia);
  if (esFamiliar(p) && fam) {
    const det = fam.precios_detallados || fam.precios_tallas || {};
    const off = new Set<string>(fam.opciones_deshabilitadas || []);
    const claves = Object.keys(det).filter(k => !off.has(k) && !(det[k] && typeof det[k] === 'object' && det[k].deshabilitado));
    if (claves.length) return claves.map(k => ({ clave: k, texto: etiqueta(k) }));
  }
  const t = parseTallas(p.tallas);
  return (t.length ? t : ['']).map(k => ({ clave: k, texto: k || 'Cantidad' }));
}

function estampadosDe(p: Producto): string[] {
  const vistos = new Set<string>();
  return String(p.estampados || '').split(',').map(x => x.trim()).filter(x => {
    const k = x.toLowerCase();
    if (!x || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

function imagenDeEstampado(p: Producto, est: string): string | null {
  if (!est) return null;
  for (const e of p.imagenes_extra || []) {
    const [url, marca] = String(e).split('|EST:');
    if (marca && marca.trim().toLowerCase() === est.toLowerCase()) return url;
  }
  return null;
}

const itemDe = (l: Linea) => ({ ...l.prod, talla: l.talla, familia_opcion_key: l.opcion || undefined }) as unknown as Producto;

const CSS = `
.vd { min-height:100vh; background:#eef0f6; font-family:${FONT}; color:#0f172a; font-size:17px; -webkit-tap-highlight-color:transparent; }
.vd *, .vd *::before, .vd *::after { box-sizing:border-box; }
.vd button, .vd input, .vd select, .vd textarea { font-family:${FONT}; }
.vd button { cursor:pointer; border:none; }
.vd-top { background:#0b1220; color:#fff; padding:.75rem 1.1rem; display:flex; align-items:center; justify-content:space-between; gap:.6rem; position:sticky; top:0; z-index:20; }
.vd-top b { font-size:1.05rem; }
.vd-nb { background:rgba(255,255,255,.12); color:#fff; border-radius:12px; padding:.6rem 1rem; font-weight:600; font-size:.92rem; min-height:44px; }
.vd-wrap { max-width:1300px; margin:0 auto; padding:1rem; }
.vd-main { display:grid; grid-template-columns:minmax(0,1fr); gap:1rem; align-items:start; }
@media (min-width:1000px) { .vd-main { grid-template-columns:minmax(0,1.6fr) minmax(0,1fr); } .vd-side { position:sticky; top:76px; max-height:calc(100vh - 92px); overflow:auto; } }
@media (max-width:999px) { .vd-side { display:none; } .vd-side.open { display:block; position:fixed; inset:60px 0 0 0; z-index:40; border-radius:22px 22px 0 0; overflow:auto; box-shadow:0 -10px 40px rgba(15,23,42,.35); } .vd-wrap { padding-bottom:96px; } }
@media (min-width:1000px) { .vd-bar { display:none; } }
.vd-bar { display:flex; position:fixed; left:0; right:0; bottom:0; z-index:30; background:#fff; border-top:1px solid #e2e8f0; padding:.7rem 1rem; align-items:center; justify-content:space-between; gap:.8rem; }
.vd-card { background:#fff; border-radius:20px; padding:1.1rem; box-shadow:0 2px 10px rgba(15,23,42,.07); min-width:0; }
.vd-search { width:100%; padding:1rem 1.2rem; border:none; border-radius:16px; font-size:1.15rem; background:#fff; box-shadow:0 2px 10px rgba(15,23,42,.08); min-height:58px; outline:2px solid transparent; }
.vd-search:focus { outline-color:var(--c); }
.vd-cats { display:flex; gap:.5rem; overflow-x:auto; padding:.8rem 0 .2rem; }
.vd-cat { flex:none; background:#fff; border:1px solid #e1e5ef; border-radius:99px; padding:.55rem 1rem; font-weight:600; font-size:.9rem; color:#334155; min-height:44px; }
.vd-cat.on { background:var(--c); border-color:var(--c); color:var(--t); }
.vd-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:.8rem; margin-top:.9rem; }
.vd-prod { background:#fff; border-radius:18px; overflow:hidden; text-align:left; box-shadow:0 2px 10px rgba(15,23,42,.07); display:flex; flex-direction:column; position:relative; }
.vd-prod:active { transform:scale(.98); }
.vd-prod .img { aspect-ratio:1/1; background:#e2e8f0 center/cover no-repeat; }
.vd-prod .tx { padding:.55rem .7rem .75rem; }
.vd-prod .nm { font-weight:600; font-size:.88rem; line-height:1.25; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.vd-prod .rf { font-size:.72rem; color:#64748b; margin-top:2px; }
.vd-prod .en { position:absolute; top:8px; right:8px; background:var(--c); color:var(--t); border-radius:99px; padding:3px 10px; font-size:.75rem; font-weight:700; }
.vd-lbl { font-size:.74rem; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.04em; margin:1rem 0 .45rem; display:block; }
.vd-in { width:100%; min-height:52px; padding:.75rem 1rem; border-radius:14px; border:2px solid #e2e8f0; font-size:1.02rem; background:#fff; }
.vd-in:focus { outline:none; border-color:var(--c); }
.vd-step { width:48px; height:48px; border-radius:13px; background:#f1f5f9; font-size:1.5rem; font-weight:700; color:#0f172a; flex:none; }
.vd-q { width:58px; text-align:center; font-size:1.2rem; font-weight:700; border:none; background:transparent; padding:.3rem 0; }
.vd-chips { display:flex; gap:.5rem; flex-wrap:wrap; }
.vd-chip { min-height:50px; padding:.5rem 1rem; border-radius:14px; background:#f1f5f9; font-weight:600; font-size:.98rem; color:#0f172a; display:flex; align-items:center; gap:.5rem; }
.vd-chip.on { background:var(--c); color:var(--t); }
.vd-chip img { width:34px; height:34px; border-radius:8px; object-fit:cover; }
.vd-ov { position:fixed; inset:0; background:rgba(15,23,42,.55); z-index:60; display:flex; align-items:flex-end; justify-content:center; }
@media (min-width:700px) { .vd-ov { align-items:center; } }
.vd-sheet { background:#fff; width:100%; max-width:600px; border-radius:26px 26px 0 0; padding:1.2rem; max-height:94vh; overflow:auto; }
@media (min-width:700px) { .vd-sheet { border-radius:26px; } }
.vd-go { width:100%; min-height:62px; border-radius:18px; font-size:1.15rem; font-weight:700; background:var(--c); color:var(--t); }
.vd-go:disabled { opacity:.45; }
.vd-row { display:flex; align-items:center; justify-content:space-between; gap:.6rem; padding:.7rem 0; border-top:1px solid #f1f5f9; }
.vd-row:first-child { border-top:none; }
.vd-pill { display:inline-block; background:#f1f5f9; border-radius:99px; padding:2px 10px; font-size:.75rem; font-weight:600; color:#475569; margin:2px 4px 0 0; }
.vd-toast { position:fixed; left:50%; top:84px; transform:translateX(-50%); padding:.9rem 1.4rem; border-radius:16px; font-weight:600; z-index:90; box-shadow:0 8px 24px rgba(15,23,42,.3); max-width:92vw; color:#fff; }
.vd-two { display:grid; grid-template-columns:1fr 1fr; gap:.6rem; }
@media (max-width:520px) { .vd-two { grid-template-columns:1fr; } }
.vd-marcas { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:.9rem; }
.vd-marca { background:#fff; border:1px solid #e6e9f2; border-radius:20px; overflow:hidden; text-align:center; display:flex; flex-direction:column; align-items:stretch; box-shadow:0 1px 2px rgba(15,23,42,.05), 0 8px 22px rgba(15,23,42,.07); }
.vd-marca:active { transform:scale(.98); }
.vd-marca .barra { height:6px; background:var(--c); }
.vd-marca .logo { height:120px; margin:.9rem 1rem .4rem; display:flex; align-items:center; justify-content:center; }
.vd-marca .logo > * { max-width:100%; max-height:100%; }
.vd-marca .nom { font-weight:700; font-size:1.05rem; color:#0f172a; padding:0 .6rem; }
.vd-marca .cant { font-size:.8rem; color:#64748b; padding:.15rem 0 1rem; }
.vd-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:.7rem; margin-bottom:1rem; }
.vd-kpi { background:#fff; border-radius:16px; padding:.8rem 1rem; border-top:4px solid #cbd5e1; box-shadow:0 2px 10px rgba(15,23,42,.06); }
.vd-kpi b { display:block; font-size:1.7rem; line-height:1.1; }
.vd-kpi span { font-size:.74rem; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.03em; }
.vd-kpi i { display:block; font-style:normal; font-size:.85rem; color:#475569; margin-top:2px; }
.vd-envio { display:grid; gap:.6rem; margin-top:.9rem; }
.vd-wa, .vd-grupo { display:flex; align-items:center; gap:.8rem; width:100%; text-align:left; padding:.9rem 1.1rem; border-radius:18px; color:#fff; min-height:68px; }
.vd-wa { background:#16a34a; box-shadow:0 8px 18px rgba(22,163,74,.28); }
.vd-grupo { background:#4f46e5; box-shadow:0 8px 18px rgba(79,70,229,.25); }
.vd-wa:disabled, .vd-grupo:disabled { opacity:.6; }
.vd-wa b, .vd-grupo b { display:block; font-size:1.05rem; }
.vd-wa small, .vd-grupo small { display:block; opacity:.88; font-size:.78rem; margin-top:1px; }
.vd-mas { margin-top:.6rem; }
.vd-mas summary { cursor:pointer; list-style:none; display:inline-flex; align-items:center; min-height:50px; padding:.5rem 1rem; border-radius:14px; background:#f1f5f9; font-weight:600; font-size:.98rem; }
.vd-mas summary::-webkit-details-marker { display:none; }
.vd-mas[open] > div { display:grid; gap:.3rem; margin-top:.5rem; background:#f8fafc; border-radius:14px; padding:.5rem; }
.vd-mas > div button, .vd-mas > div a { text-align:left; background:#fff; border-radius:10px; padding:.7rem .9rem; min-height:46px; font-weight:600; color:#0f172a; text-decoration:none; font-size:.92rem; display:block; }
.vd-tabs { display:flex; gap:.5rem; overflow-x:auto; padding:.1rem 0 .7rem; }
.vd-tab { display:flex; align-items:center; flex:none; background:#fff; border:2px solid #e1e5ef; border-radius:14px; }
.vd-tab.on { background:var(--c); border-color:var(--c); color:var(--t); }
.vd-tab button { background:transparent; color:inherit; font-weight:600; padding:.55rem .9rem; min-height:46px; font-size:.92rem; }
.vd-tab i { font-style:normal; background:rgba(15,23,42,.14); border-radius:99px; padding:1px 8px; margin-left:6px; font-size:.75rem; }
.vd-tab-new { flex:none; min-height:50px; padding:0 1rem; border-radius:14px; background:transparent; border:2px dashed #94a3b8 !important; color:#475569; font-weight:600; }
.vd-ia { width:100%; display:flex; flex-direction:column; align-items:flex-start; gap:2px; padding:.9rem 1.2rem; margin-bottom:.8rem; border-radius:16px; color:#fff; background:linear-gradient(120deg,#4f46e5,#9333ea); box-shadow:0 8px 20px rgba(79,70,229,.3); text-align:left; }
.vd-ia span { font-weight:700; font-size:1.05rem; }
.vd-ia small { opacity:.85; font-size:.8rem; }
.vd-ia:disabled { opacity:.5; }
.vd-drop { display:flex; flex-direction:column; align-items:center; gap:.2rem; padding:1.4rem 1rem; border:3px dashed #c7d2fe; border-radius:18px; background:#f8faff; color:#3730a3; cursor:pointer; text-align:center; }
.vd-drop span { font-size:.82rem; color:#6366f1; }
.vd-thumbs { display:flex; gap:.6rem; flex-wrap:wrap; margin-top:.8rem; }
.vd-thumbs .th { position:relative; width:84px; height:112px; border-radius:12px; overflow:hidden; background:#e2e8f0; }
.vd-thumbs .th img { width:100%; height:100%; object-fit:cover; display:block; }
.vd-thumbs .th button { position:absolute; top:4px; right:4px; width:26px; height:26px; border-radius:50%; background:rgba(15,23,42,.75); color:#fff; font-size:.75rem; }
.vd-seg { display:flex; gap:.5rem; }
.vd-seg button { flex:1; min-height:52px; border-radius:14px; background:#f1f5f9; font-weight:600; color:#334155; }
.vd-seg button.on { background:var(--c); color:var(--t); }
`;

function textoSobre(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.72 ? '#1e1b4b' : '#ffffff';
}

function LogoMarca({ nombre, logo, color }: { nombre: string; logo?: string; color: string }) {
  const [fallo, setFallo] = useState(false);
  if (logo && !fallo) return <img src={logo} alt={nombre} onError={() => setFallo(true)} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />;
  return <span style={{ width: '100%', height: '100%', borderRadius: 14, background: color, color: textoSobre(color), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.6rem' }}>{nombre.trim().charAt(0).toUpperCase()}</span>;
}

export default function Vender() {
  const [asesor, setAsesor] = useState<Asesor | null>(() => {
    try { const s = localStorage.getItem(SESION); return s ? (JSON.parse(s) as Asesor) : null; } catch { return null; }
  });
  const [lista, setLista] = useState<Asesor[]>([]);
  const [elegido, setElegido] = useState<Asesor | null>(null);
  const [marca, setMarca] = useState<string | null>(null);
  const [marcas, setMarcas] = useState<Map<string, { nombre: string; color: string; logo?: string }>>(new Map());
  const [pin, setPin] = useState('');
  const [pinSesion, setPinSesion] = useState(() => { try { return localStorage.getItem(SESION + '_pin') || ''; } catch { return ''; } });
  const [pinError, setPinError] = useState('');
  const [verificando, setVerificando] = useState(false);

  const [config, setConfig] = useState<Config>({});
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [cat, setCat] = useState('todas');

  // Varios pedidos abiertos a la vez (uno por cliente). Cada uno guarda su carrito y los datos del cliente.
  const [borradores, setBorradores] = useState<Borrador[]>(() => [nuevoBorrador()]);
  const [activoId, setActivoId] = useState('');
  const activo = borradores.find(b => b.id === activoId) || borradores[0];
  const lineas = activo.lineas;
  const f = activo.f;
  const borradoresRef = useRef(borradores);
  borradoresRef.current = borradores;
  const activoRef = useRef(activo.id);
  activoRef.current = activo.id;
  const borradoresListos = useRef(false);
  const setLineas = (u: Linea[] | ((p: Linea[]) => Linea[])) => {
    const id = activo.id;
    setBorradores(bs => bs.map(b => (b.id === id ? { ...b, lineas: typeof u === 'function' ? u(b.lineas) : u } : b)));
  };
  const setF = (u: FormCliente | ((p: FormCliente) => FormCliente)) => {
    const id = activo.id;
    setBorradores(bs => bs.map(b => (b.id === id ? { ...b, f: typeof u === 'function' ? u(b.f) : u } : b)));
  };
  const [hoja, setHoja] = useState<Producto | null>(null);
  const [cants, setCants] = useState<Record<string, number>>({});
  const [est, setEst] = useState('');
  const [verPedido, setVerPedido] = useState(false);
  const [cobro, setCobro] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState<{ id: string; total: number; url: string; ficha: PedidoVista } | null>(null);
  const [vista, setVista] = useState<'nuevo' | 'lista'>('nuevo');
  const [filas, setFilas] = useState<any[]>([]);
  const [nombresAs, setNombresAs] = useState<Map<string, string>>(new Map());
  const [cargandoLista, setCargandoLista] = useState(false);
  const [soloMios, setSoloMios] = useState(true);
  const [ocupado, setOcupado] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [iaOk, setIaOk] = useState(false);
  const [iaAbierta, setIaAbierta] = useState(false);
  const [iaImgs, setIaImgs] = useState<ImagenIA[]>([]);
  const [iaTexto, setIaTexto] = useState('');
  const [iaLeyendo, setIaLeyendo] = useState(false);
  const [iaError, setIaError] = useState('');
  const [iaRev, setIaRev] = useState<IaRevision | null>(null);
  const [filtroPago, setFiltroPago] = useState<'todos' | GrupoPago>('todos');
  const [busquedaPed, setBusquedaPed] = useState('');
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);


  const color = config.color_primario || '#6366f1';
  const sobre = textoSobre(color);
  const mostrar = (tipo: 'ok' | 'error', texto: string, ms = 3200) => { setAviso({ tipo, texto }); window.setTimeout(() => setAviso(null), ms); };

  // Asesores (sin PIN) y datos de cada marca para elegir quién eres
  useEffect(() => {
    if (asesor) return;
    Promise.all([
      supabase.from('asesores').select('id,nombre,telefono,tenant_id,foto_url').order('nombre'),
      supabase.from('configuracion').select('tenant_id,nombre_negocio,color_primario,logo_url')
    ]).then(([a, c]) => {
      setLista((a.data as Asesor[]) || []);
      const m = new Map<string, { nombre: string; color: string; logo?: string }>();
      ((c.data as { tenant_id: string; nombre_negocio?: string; color_primario?: string; logo_url?: string }[]) || []).forEach(x => {
        if (x.tenant_id && !m.has(x.tenant_id)) m.set(x.tenant_id, { nombre: x.nombre_negocio || x.tenant_id, color: x.color_primario || '#6366f1', logo: x.logo_url || undefined });
      });
      setMarcas(m);
    });
  }, [asesor]);

  // Catálogo y configuración de la tienda del asesor
  useEffect(() => {
    if (!asesor) return;
    let vigente = true;
    setCargando(true);
    (async () => {
      const { data: cfg } = await supabase.from('configuracion').select('*').eq('tenant_id', asesor.tenant_id).limit(1).maybeSingle();
      const todos: Producto[] = [];
      for (let d = 0; d < 20000; d += 1000) {
        const { data, error } = await supabase.from('productos').select('*').eq('tenant_id', asesor.tenant_id).order('created_at', { ascending: false }).range(d, d + 999);
        if (error || !data) break;
        todos.push(...(data as Producto[]));
        if (data.length < 1000) break;
      }
      if (!vigente) return;
      setConfig((cfg as Config) || {});
      setProductos(todos.filter(p => !p.oculto).sort((a, b) => (a.categoria || '').localeCompare(b.categoria || '', 'es') || (a.nombre || '').localeCompare(b.nombre || '', 'es', { numeric: true })));
      setCargando(false);
    })();
    return () => { vigente = false; };
  }, [asesor]);

  useEffect(() => {
    if (!asesor || vista !== 'lista') return;
    let vigente = true;
    setCargandoLista(true);
    (async () => {
      const [ped, ases] = await Promise.all([
        supabase.from('pedidos').select('*')
          .eq('tenant_id', asesor.tenant_id).eq('origen', 'asesor').order('created_at', { ascending: false }).limit(80),
        supabase.from('asesores').select('nombre,telefono')
      ]);
      if (!vigente) return;
      const m = new Map<string, string>();
      ((ases.data as { nombre: string; telefono: string }[]) || []).forEach(a => String(a.telefono || '').split(/[,;/]/).forEach(t => { const d = soloDigitos(t).slice(-10); if (d) m.set(d, a.nombre); }));
      setNombresAs(m);
      setFilas((ped.data as any[]) || []);
      setCargandoLista(false);
    })();
    return () => { vigente = false; };
  }, [asesor, vista, listo, recarga]);

  useEffect(() => {
    if (!asesor) return;
    borradoresListos.current = false;
    try {
      const guardado = localStorage.getItem(`vender_pedidos_${asesor.id}`);
      if (guardado) {
        const d = JSON.parse(guardado) as { borradores?: Borrador[]; activoId?: string };
        if (Array.isArray(d.borradores) && d.borradores.length > 0) {
          setBorradores(d.borradores.slice(0, MAX_PEDIDOS_ABIERTOS));
          setActivoId(d.activoId && d.borradores.some(b => b.id === d.activoId) ? d.activoId : d.borradores[0].id);
        }
      }
    } catch { /* sin pedidos guardados */ }
    borradoresListos.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asesor?.id]);

  useEffect(() => {
    if (!asesor || !borradoresListos.current) return;
    try { localStorage.setItem(`vender_pedidos_${asesor.id}`, JSON.stringify({ borradores, activoId: activo.id })); } catch { /* sin almacenamiento */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borradores, activoId, asesor?.id]);

  // Al cargar el catálogo, los pedidos guardados toman los precios y datos más recientes de cada producto
  useEffect(() => {
    if (productos.length === 0) return;
    setBorradores(bs => bs.map(b => ({ ...b, lineas: b.lineas.map(l => { const p = productos.find(x => x.id === l.prod.id); return p ? { ...l, prod: p } : l; }) })));
  }, [productos]);

  function nuevoPedido() {
    if (borradoresRef.current.length >= MAX_PEDIDOS_ABIERTOS) return mostrar('error', `Máximo ${MAX_PEDIDOS_ABIERTOS} pedidos abiertos a la vez`);
    const b = nuevoBorrador();
    setBorradores([...borradoresRef.current, b]);
    setActivoId(b.id);
    setBusqueda('');
    setCobro(false);
    setVerPedido(false);
  }

  function cerrarBorrador(id: string, confirmar = true) {
    const todos = borradoresRef.current;
    const b = todos.find(x => x.id === id);
    if (!b) return;
    if (confirmar && b.lineas.length > 0 && !window.confirm('Este pedido tiene productos sin guardar. ¿Descartarlo?')) return;
    const resto = todos.filter(x => x.id !== id);
    if (resto.length === 0) {
      const n = nuevoBorrador();
      setBorradores([n]);
      setActivoId(n.id);
      return;
    }
    setBorradores(resto);
    if (id === activoRef.current) setActivoId(resto[Math.max(0, todos.findIndex(x => x.id === id) - 1)].id);
  }

  useEffect(() => {
    if (!asesor) return;
    let vigente = true;
    iaDisponible().then(ok => { if (vigente) setIaOk(ok); });
    return () => { vigente = false; };
  }, [asesor]);

  async function agregarCapturas(archivos: File[]) {
    const cupo = MAX_CAPTURAS - iaImgs.length;
    if (cupo <= 0) return setIaError(`Máximo ${MAX_CAPTURAS} capturas por lectura.`);
    setIaError('');
    try {
      const listas: ImagenIA[] = [];
      for (const a of archivos.filter(x => x.type.startsWith('image/')).slice(0, cupo)) listas.push(await prepararImagen(a));
      setIaImgs(prev => [...prev, ...listas].slice(0, MAX_CAPTURAS));
    } catch { setIaError('No se pudo procesar una de las imágenes. Prueba con otra captura.'); }
  }

  useEffect(() => {
    if (!iaAbierta || iaRev) return;
    const alPegar = (ev: ClipboardEvent) => {
      const imgs = [...(ev.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
      if (imgs.length) { ev.preventDefault(); agregarCapturas(imgs); }
    };
    window.addEventListener('paste', alPegar);
    return () => window.removeEventListener('paste', alPegar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iaAbierta, iaRev, iaImgs.length]);

  async function leerChat() {
    if (!asesor) return;
    setIaLeyendo(true);
    setIaError('');
    try {
      const catalogo = productos.map((p, i) => ({ n: i, nombre: p.nombre || '', ref: String(p.referencia || ''), cat: p.categoria || '', opciones: opcionesDe(p).map(o => o.clave).filter(Boolean), estampados: estampadosDe(p) }));
      const r = await leerConIA({ asesorId: asesor.id, pin: pinSesion, imagenes: iaImgs, texto: iaTexto, catalogo });
      setIaRev(armarRevision(r, productos, { opcionesDe, estampadosDe }));
    } catch (e) {
      setIaError(e instanceof Error ? e.message : 'No se pudo leer el chat.');
    }
    setIaLeyendo(false);
  }

  const lineaIAIncompleta = (l: IaLinea) => {
    const prod = productos.find(p => p.id === l.prodId);
    if (!prod) return true;
    const claves = opcionesDe(prod).map(o => o.clave).filter(Boolean);
    return (claves.length > 0 && !l.opcion) || (estampadosDe(prod).length > 0 && !l.estampado);
  };

  function aplicarIA() {
    if (!iaRev) return;
    const rev = iaRev;
    setLineas(prev => {
      const sig = [...prev];
      for (const l of rev.lineas) {
        const prod = productos.find(p => p.id === l.prodId);
        if (!prod) continue;
        const key = `${prod.id}|${l.opcion}|${l.estampado}`;
        const ya = sig.findIndex(x => x.key === key);
        if (ya >= 0) sig[ya] = { ...sig[ya], cantidad: sig[ya].cantidad + l.cantidad };
        else sig.push({ key, prod, talla: l.opcion, opcion: esFamiliar(prod) ? l.opcion : '', estampado: l.estampado, cantidad: l.cantidad });
      }
      return sig;
    });
    setF(prev => ({
      ...prev,
      nombre: rev.nombre || prev.nombre,
      telefono: rev.celular || prev.telefono,
      cedula: rev.cedula || prev.cedula,
      email: rev.correo || prev.email,
      recepcion: rev.recepcion || prev.recepcion,
      pago: rev.pago || prev.pago,
      depto: rev.depto || prev.depto,
      ciudad: rev.depto ? rev.ciudad : (rev.ciudad || prev.ciudad),
      direccion: rev.direccion || prev.direccion,
      barrio: rev.barrio || prev.barrio,
      nota: rev.nota ? (prev.nota ? `${prev.nota} · ${rev.nota}` : rev.nota) : prev.nota
    }));
    setIaAbierta(false);
    setIaRev(null); setIaImgs([]); setIaTexto('');
    setCobro(true);
    mostrar('ok', 'Datos cargados. Revísalos y guarda el pedido.');
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!elegido) return;
    setVerificando(true);
    setPinError('');
    const { data } = await supabase.from('asesores').select('id,nombre,telefono,tenant_id,foto_url').eq('id', elegido.id).eq('pin', pin.trim()).maybeSingle();
    setVerificando(false);
    if (!data) return setPinError('PIN incorrecto');
    try { localStorage.setItem(SESION, JSON.stringify(data)); localStorage.setItem(SESION + '_pin', pin.trim()); } catch { /* sin almacenamiento */ }
    setPinSesion(pin.trim());
    setAsesor(data as Asesor);
  }

  function salir() {
    try { localStorage.removeItem(SESION); localStorage.removeItem(SESION + '_pin'); } catch { /* sin almacenamiento */ }
    setPinSesion('');
    setAsesor(null); setElegido(null); setPin(''); setBorradores([nuevoBorrador()]); setProductos([]);
  }

  const bulkActivo = config.descuento_mayor_carrito_activo !== false;
  const promo = Number(config.descuento_promocional) || 0;
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const tier = tierDe(unidades, bulkActivo);

  // Mismo cálculo del catálogo; el precio por mayor nunca puede superar al de detal
  function precioLinea(l: Linea, t: BuyerType): number {
    const it = itemDe(l);
    const aplicado = getEffectivePrice(it, t, 0, {}, promo);
    if (t === 'detal') return aplicado;
    const detal = getEffectivePrice(it, 'detal', 0, {}, promo);
    return detal > 0 && aplicado > detal ? detal : aplicado;
  }

  const total = lineas.reduce((s, l) => s + precioLinea(l, tier) * l.cantidad, 0);
  // Solo se habla de "por mayor" si de verdad bajó el precio de algún producto
  const huboDescuento = tier !== 'detal' && lineas.some(l => precioLinea(l, tier) < getEffectivePrice(itemDe(l), 'detal', 0, {}, promo));
  const tipoCompra = huboDescuento ? (tier === '50_unidades' ? '50+ unidades' : 'Al detal (Con descuento por mayor)') : 'Al detal';
  const etiquetaTier = huboDescuento ? (tier === '50_unidades' ? 'Precio 50+ unidades' : 'Precio por mayor') : 'Precio al detal';

  const categorias = useMemo(() => {
    const m = new Map<string, number>();
    productos.forEach(p => { const c = (p.categoria || '').trim() || 'Sin categoría'; m.set(c, (m.get(c) || 0) + 1); });
    return [...m.entries()];
  }, [productos]);

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let base = productos;
    if (cat !== 'todas') base = base.filter(p => ((p.categoria || '').trim() || 'Sin categoría') === cat);
    if (q) base = base.filter(p => (p.nombre || '').toLowerCase().includes(q) || String(p.referencia || '').toLowerCase().includes(q));
    return base.slice(0, 300);
  }, [productos, busqueda, cat]);

  const enPedido = useMemo(() => {
    const m = new Map<string, number>();
    lineas.forEach(l => m.set(l.prod.id, (m.get(l.prod.id) || 0) + l.cantidad));
    return m;
  }, [lineas]);

  function abrir(p: Producto) {
    setHoja(p);
    setCants({});
    const e = estampadosDe(p);
    setEst(e.length === 1 ? e[0] : '');
  }

  function agregar() {
    if (!hoja) return;
    const opciones = opcionesDe(hoja);
    const elegidas = opciones.filter(o => (cants[o.clave] || 0) > 0);
    if (elegidas.length === 0) return mostrar('error', 'Pon la cantidad de al menos una talla');
    if (estampadosDe(hoja).length > 0 && !est) return mostrar('error', 'Elige el estampado');
    setLineas(prev => {
      const sig = [...prev];
      for (const o of elegidas) {
        const key = `${hoja.id}|${o.clave}|${est}`;
        const ya = sig.findIndex(x => x.key === key);
        const cantidad = cants[o.clave] || 0;
        if (ya >= 0) sig[ya] = { ...sig[ya], cantidad: sig[ya].cantidad + cantidad };
        else sig.push({ key, prod: hoja, talla: o.clave, opcion: esFamiliar(hoja) ? o.clave : '', estampado: est, cantidad });
      }
      return sig;
    });
    mostrar('ok', `Agregado: ${elegidas.reduce((s, o) => s + (cants[o.clave] || 0), 0)} unidades`);
    setHoja(null);
  }

  const cambiar = (key: string, d: number) => setLineas(prev => prev.flatMap(l => (l.key !== key ? [l] : l.cantidad + d <= 0 ? [] : [{ ...l, cantidad: l.cantidad + d }])));
  const quitar = (key: string) => setLineas(prev => prev.filter(l => l.key !== key));

  const ciudades = f.depto ? DEPARTAMENTOS_COLOMBIA[f.depto] || [] : [];

  // Datos para pagar por transferencia, uno por línea (se usan en el texto y en la imagen del cliente)
  function lineasPago(): string[] {
    const crudo = String(config.metodos_pago || '').split('__EXTRA_CONFIG__')[0].trim();
    if (!crudo) return [];
    try {
      const arr = JSON.parse(crudo);
      if (Array.isArray(arr)) {
        return arr.filter((m: any) => (m.banco && String(m.banco).trim()) || (m.numero && String(m.numero).trim()))
          .map((m: any) => `${String(m.banco || '').trim()}${m.tipo ? ` (${m.tipo})` : ''}: ${String(m.numero || '').trim()}`);
      }
    } catch { return [crudo]; }
    return [];
  }

  async function guardar() {
    if (!asesor) return;
    const nombre = f.nombre.trim();
    const tel = soloDigitos(f.telefono).slice(-10);
    if (!nombre) return mostrar('error', 'Falta el nombre del cliente');
    if (tel.length !== 10) return mostrar('error', 'El celular del cliente debe tener 10 dígitos');
    if (f.recepcion === 'domicilio' && (!f.depto || !f.ciudad || !f.direccion.trim())) return mostrar('error', 'Faltan departamento, ciudad o dirección');
    if (lineas.length === 0) return mostrar('error', 'El pedido está vacío');

    setGuardando(true);
    const metodoPago = f.pago === 'transferencia' ? '[ Transferencia Bancaria ]' : '[ Pago Contra Entrega ]';
    const metodoEnvio = f.recepcion === 'tienda' ? `Recoger en Tienda (${config.direccion || 'Sede Principal'})` : 'Envío a domicilio';
    const productosGuardar = lineas.map(l => {
      const precio = precioLinea(l, tier);
      const detal = getEffectivePrice(itemDe(l), 'detal', 0, {}, promo);
      return {
        ...l.prod,
        imagen_url: imagenDeEstampado(l.prod, l.estampado) || l.prod.imagen_url,
        cantidad: l.cantidad,
        talla: l.talla,
        estampado: l.estampado || undefined,
        familia_opcion_key: l.opcion || undefined,
        precio_detal: detal > 0 ? detal : precio,
        precio: precio > 0 ? precio : 0,
        precio_aplicado_mayor: tier !== 'detal',
        _metodo_pago: metodoPago,
        _metodo_envio: metodoEnvio,
        _tipo_compra: tipoCompra,
        _departamento: f.depto || ''
      };
    });

    let dir = f.recepcion === 'tienda' ? `Recoger en Tienda (${config.direccion || 'Sede Principal'})` : f.direccion.trim() + (f.barrio.trim() ? `, Barrio ${f.barrio.trim()}` : '');
    if (f.cedula.trim()) dir += ` | CC: ${f.cedula.trim()}`;
    if (f.email.trim()) dir += ` | Email: ${f.email.trim()}`;
    if (f.nota.trim()) dir += ` | Nota: ${f.nota.trim()}`;

    let payload: Record<string, unknown> = {
      cliente_nombre: nombre,
      cliente_telefono: tel,
      cliente_cedula: f.cedula.trim(),
      cliente_email: f.email.trim(),
      direccion: dir,
      ciudad: f.recepcion === 'tienda' ? (f.ciudad || 'Tienda') : (f.ciudad && f.depto && !f.ciudad.includes(f.depto) ? `${f.ciudad}, ${f.depto}` : f.ciudad),
      total,
      productos: productosGuardar,
      linea_whatsapp: primerTel(asesor.telefono),
      tenant_id: asesor.tenant_id,
      metodo_pago: metodoPago,
      metodo_envio: metodoEnvio,
      modalidad_pago: f.pago,
      metodo_recepcion: f.recepcion,
      tipo_compra: tipoCompra,
      departamento: f.depto || '',
      estado: f.pago === 'contra_entrega' ? 'contra_entrega' : 'pendiente',
      origen: 'asesor',
      historial: [{
        estado: f.pago === 'contra_entrega' ? 'contra_entrega' : 'pendiente',
        usuario: `Asesor ${asesor.nombre}`,
        fecha: new Date().toISOString(),
        accion: 'Pedido manual cargado por el asesor'
      }]
    };

    // Si la base no tiene alguna columna opcional, se quita y se reintenta
    let nuevo: { id: string } | null = null;
    let ultimoError = '';
    for (let intento = 0; intento < 8 && !nuevo; intento++) {
      const { data, error } = await supabase.from('pedidos').insert(payload).select('id').single();
      if (!error && data) { nuevo = data as { id: string }; break; }
      ultimoError = error?.message || 'Error desconocido';
      const m = /'([a-z_]+)' column/i.exec(ultimoError);
      if (m && m[1] in payload && !['cliente_nombre', 'cliente_telefono', 'total', 'productos', 'tenant_id'].includes(m[1])) {
        const { [m[1]]: _quitado, ...resto } = payload;
        payload = resto;
      } else break;
    }
    setGuardando(false);
    if (!nuevo) return mostrar('error', 'No se pudo guardar: ' + ultimoError);

    let numero: number | null = null;
    try {
      const { data: nn, error: en } = await supabase.from('pedidos').select('numero_pedido').eq('id', nuevo.id).maybeSingle();
      if (!en && nn && (nn as { numero_pedido?: number }).numero_pedido) numero = Number((nn as { numero_pedido: number }).numero_pedido);
    } catch { /* la columna del consecutivo todavía no existe */ }
    const ficha: PedidoVista = {
      id: nuevo.id, numero, estadoPago: f.pago === 'transferencia' ? 'Esperando comprobante' : 'Contra entrega · se cobra al recibir', creado: new Date().toISOString(), tienda: config.nombre_negocio || '', color, logo: config.logo_url || null,
      asesor: asesor.nombre, cliente: nombre, telefono: tel, ciudad: String(payload.ciudad || ''),
      direccion: f.recepcion === 'tienda' ? 'Recoge en tienda' : f.direccion.trim() + (f.barrio.trim() ? `, Barrio ${f.barrio.trim()}` : ''),
      pago: f.pago === 'transferencia' ? 'Transferencia' : 'Contra entrega', entrega: f.recepcion === 'tienda' ? 'Recoge en tienda' : 'Domicilio',
      tipo: tipoCompra, total, nota: f.nota.trim() || undefined, estado: String(payload.estado || ''), pagoInfo: lineasPago(),
      items: lineas.map(l => ({
        nombre: (l.prod.nombre || '').trim(), imagen: imagenDeEstampado(l.prod, l.estampado) || l.prod.imagen_url || null,
        etiqueta: l.talla ? (opcionesDe(l.prod).find(x => x.clave === l.talla)?.texto || l.talla) : '', estampado: l.estampado,
        cantidad: l.cantidad, precio: precioLinea(l, tier)
      }))
    };
    setAviso(null);
    setListo({ id: nuevo.id, total, url: urlWhatsAppCliente(ficha, textoCliente(ficha)), ficha });
    cerrarBorrador(activoRef.current, false);
    setCobro(false); setVerPedido(false);
  }

  const misNumeros = new Set((asesor?.telefono || '').split(/[,;/]/).map(t => soloDigitos(t).slice(-10)).filter(Boolean));

  function vistaDeFila(r: any): PedidoVista {
    const partes = String(r.direccion || '').split(' | ');
    const nota = partes.find(x => x.startsWith('Nota: '))?.slice(6);
    const items = (Array.isArray(r.productos) ? r.productos : []).map((p: any) => ({
      nombre: String(p.nombre || '').trim(),
      imagen: imagenDeEstampado(p as Producto, String(p.estampado || '')) || p.imagen_url || null,
      etiqueta: p.talla ? etiqueta(String(p.familia_opcion_key || p.talla)) : '',
      estampado: String(p.estampado || ''),
      cantidad: Number(p.cantidad) || 0,
      precio: Number(p.precio) || 0
    }));
    const tel = soloDigitos(r.linea_whatsapp).slice(-10);
    return {
      id: r.id, numero: r.numero_pedido ? Number(r.numero_pedido) : null, estadoPago: estadoDe(r).pago.texto, creado: r.created_at, tienda: config.nombre_negocio || '', color, logo: config.logo_url || null,
      asesor: nombresAs.get(tel) || (tel ? `Asesor ···${tel.slice(-4)}` : 'Asesor'),
      cliente: r.cliente_nombre, telefono: r.cliente_telefono, ciudad: r.ciudad || '', direccion: partes[0] || '',
      pago: r.modalidad_pago === 'contra_entrega' ? 'Contra entrega' : 'Transferencia',
      entrega: r.metodo_recepcion === 'tienda' ? 'Recoge en tienda' : 'Domicilio',
      tipo: r.tipo_compra || 'Al detal', total: Number(r.total) || 0, nota, estado: r.estado, pagoInfo: lineasPago(), items
    };
  }

  async function enviarGrupo(v: PedidoVista) {
    setOcupado('g' + v.id);
    try {
      const r = await compartirImagen(v);
      if (r === 'copiado') mostrar('ok', 'Imagen copiada. Abre el grupo en WhatsApp y pégala con Ctrl + V.', 9000);
      else if (r === 'descargado') mostrar('ok', 'Imagen descargada. Adjúntala en el grupo de WhatsApp.', 7000);
    } catch { mostrar('error', 'No se pudo crear la imagen'); }
    setOcupado('');
  }

  async function enviarCliente(v: PedidoVista) {
    setOcupado('w' + v.id);
    try {
      const r = await enviarAlCliente(v, urlWhatsAppCliente(v, textoCliente(v)), textoCliente(v));
      if (r === 'copiado') mostrar('ok', 'Se abrió el chat del cliente. Presiona Ctrl + V para pegar la imagen y envía.', 10000);
      else if (r === 'descargado') mostrar('ok', 'Imagen descargada. Adjúntala en el chat del cliente.', 8000);
    } catch { mostrar('error', 'No se pudo preparar el envío'); }
    setOcupado('');
  }

  const abrirChat = (v: PedidoVista, texto: string) => window.open(urlWhatsAppCliente(v, texto), '_blank', 'noopener');

  const iconoWA = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.27-1.38A9.9 9.9 0 1 0 12.04 2zm0 1.8a8.1 8.1 0 1 1-4.3 15l-.3-.18-3.13.82.84-3.05-.2-.32A8.1 8.1 0 0 1 12.04 3.8zm-3.1 4.1c-.17 0-.45.06-.69.32-.24.26-.9.88-.9 2.15s.92 2.5 1.05 2.67c.13.17 1.8 2.86 4.45 3.9 2.2.86 2.65.69 3.13.65.48-.04 1.55-.63 1.77-1.24.22-.61.22-1.13.15-1.24-.06-.11-.24-.17-.5-.3-.26-.13-1.55-.77-1.79-.86-.24-.09-.41-.13-.59.13-.17.26-.68.86-.83 1.04-.15.17-.3.2-.57.07-.26-.13-1.1-.4-2.1-1.3-.78-.69-1.3-1.55-1.45-1.81-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.44.09-.17.04-.33-.02-.46-.07-.13-.59-1.42-.81-1.94-.21-.5-.43-.43-.59-.44h-.5z" /></svg>
  );

  // Botones grandes y claros para enviar el pedido
  const accionesEnvio = (v: PedidoVista) => (
    <div className="vd-envio">
      <button className="vd-wa" onClick={() => enviarCliente(v)} disabled={ocupado === 'w' + v.id}>
        {iconoWA}
        <span><b>{ocupado === 'w' + v.id ? 'Preparando imagen...' : 'Enviar al cliente'}</b><small>Abre su chat con el resumen y la imagen del pedido</small></span>
      </button>
      <button className="vd-grupo" onClick={() => enviarGrupo(v)} disabled={ocupado === 'g' + v.id}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
        <span><b>{ocupado === 'g' + v.id ? 'Creando imagen...' : 'Enviar al grupo'}</b><small>Comparte la imagen del pedido con el equipo</small></span>
      </button>
    </div>
  );

  const masOpciones = (v: PedidoVista) => (
    <details className="vd-mas">
      <summary>Más opciones</summary>
      <div>
        <button onClick={async () => { const ok = await copiarTexto(v); mostrar(ok ? 'ok' : 'error', ok ? 'Texto copiado' : 'No se pudo copiar'); }}>Copiar texto del pedido</button>
        <a href={urlWhatsAppGrupo(v)} target="_blank" rel="noreferrer">Texto para el grupo (WhatsApp)</a>
        <button onClick={() => descargarImagen(v, 'cliente')}>Descargar imagen del cliente</button>
        <button onClick={() => descargarImagen(v, 'grupo')}>Descargar imagen del grupo</button>
        <button onClick={() => abrirChat(v, textoCliente(v))}>Abrir chat del cliente (solo texto)</button>
      </div>
    </details>
  );

  async function adjuntarComprobante(r: any, archivo: File) {
    if (!asesor) return;
    setOcupado('c' + r.id);
    try {
      const comp = await compressImage(archivo, 1000, 0.7);
      const nombreArchivo = `pago_${r.id}_${Date.now()}.${comp.name.split('.').pop() || 'jpg'}`;
      const { error: up } = await supabase.storage.from('archivos').upload(nombreArchivo, comp);
      if (up) throw up;
      const url = supabase.storage.from('archivos').getPublicUrl(nombreArchivo).data.publicUrl;
      const historial = [...(Array.isArray(r.historial) ? r.historial : []), {
        estado: 'comprobante_recibido', usuario: `Asesor ${asesor.nombre}`, fecha: new Date().toISOString(), accion: 'Comprobante de pago adjuntado por el asesor'
      }];
      let { error } = await supabase.from('pedidos').update({ pantallazo_url: url, historial }).eq('id', r.id);
      if (error) ({ error } = await supabase.from('pedidos').update({ pantallazo_url: url }).eq('id', r.id));
      if (error) throw error;
      mostrar('ok', 'Comprobante adjuntado. El administrador lo valida.');
      setRecarga(n => n + 1);
    } catch {
      mostrar('error', 'No se pudo adjuntar el comprobante');
    }
    setOcupado('');
  }

  const baseLista = filas
    .filter(r => !soloMios || misNumeros.has(soloDigitos(r.linea_whatsapp).slice(-10)))
    .map(r => ({ r, v: vistaDeFila(r), e: estadoDe(r) }));
  const delGrupo = (g: GrupoPago) => baseLista.filter(x => x.e.grupo === g);
  const sumaDe = (arr: typeof baseLista) => arr.reduce((t, x) => t + x.v.total, 0);
  const qPed = busquedaPed.trim().toLowerCase();
  const listaManual = baseLista.filter(x =>
    (filtroPago === 'todos' || x.e.grupo === filtroPago) &&
    (!qPed || [String(x.v.numero || ''), x.v.id.slice(0, 8), x.v.cliente, x.v.telefono, ...x.v.items.map(i => i.nombre)].some(t => String(t || '').toLowerCase().includes(qPed)))
  );
  const filtros: [('todos' | GrupoPago), string, number][] = [
    ['todos', 'Todos', baseLista.length],
    ['esperando', 'Esperando pago', delGrupo('esperando').length],
    ['validar', 'Por validar', delGrupo('validar').length],
    ['pagado', 'Pagados', delGrupo('pagado').length],
    ['contra', 'Contra entrega', delGrupo('contra').length],
    ['cancelado', 'Cancelados', delGrupo('cancelado').length]
  ];
  const fechaHora = (d: string) => new Date(d).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

  const listaJSX = (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', margin: '.2rem 0 .3rem', color: '#0f172a' }}>Pedidos solicitados manuales</h2>
      <p style={{ color: '#64748b', margin: '0 0 .9rem', fontSize: '.92rem' }}>Pedidos que los asesores cargaron a mano, con su número, estado de pago e historial.</p>

      <div className="vd-kpis">
        <div className="vd-kpi" style={{ borderTopColor: '#dc2626' }}><b>{delGrupo('esperando').length}</b><span>Esperando comprobante</span><i>{peso(sumaDe(delGrupo('esperando')))}</i></div>
        <div className="vd-kpi" style={{ borderTopColor: '#ea580c' }}><b>{delGrupo('validar').length}</b><span>Por validar</span><i>{peso(sumaDe(delGrupo('validar')))}</i></div>
        <div className="vd-kpi" style={{ borderTopColor: '#16a34a' }}><b>{delGrupo('pagado').length}</b><span>Pagados</span><i>{peso(sumaDe(delGrupo('pagado')))}</i></div>
      </div>

      <input className="vd-search" value={busquedaPed} onChange={e => setBusquedaPed(e.target.value)} placeholder="Buscar por número, cliente, celular o producto" />
      <div className="vd-cats">
        {filtros.map(([k, t, n]) => <button key={k} className={`vd-cat ${filtroPago === k ? 'on' : ''}`} onClick={() => setFiltroPago(k)}>{t} ({n})</button>)}
      </div>
      <div className="vd-seg" style={{ margin: '.6rem 0 1rem', maxWidth: 360 }}>
        <button className={soloMios ? 'on' : ''} onClick={() => setSoloMios(true)}>Solo los míos</button>
        <button className={!soloMios ? 'on' : ''} onClick={() => setSoloMios(false)}>Todos</button>
      </div>

      {cargandoLista && <p style={{ textAlign: 'center', color: '#94a3b8' }}>Cargando pedidos...</p>}
      {!cargandoLista && listaManual.length === 0 && <div className="vd-card" style={{ textAlign: 'center', color: '#94a3b8' }}>No hay pedidos con ese filtro.</div>}
      <div style={{ display: 'grid', gap: '.9rem' }}>
        {listaManual.map(({ r, v, e }) => {
          const grupos = new Map<string, { nombre: string; estampado: string; lineas: string[] }>();
          v.items.forEach(i => { const k = i.nombre + '|' + i.estampado; const g = grupos.get(k) || { nombre: i.nombre, estampado: i.estampado, lineas: [] }; g.lineas.push(`${i.etiqueta || 'Cantidad'} = ${i.cantidad}`); grupos.set(k, g); });
          const abierto = abiertoId === r.id;
          return (
            <div key={r.id} className="vd-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' }}>
                    <span style={{ background: color, color: sobre, borderRadius: 10, padding: '3px 12px', fontWeight: 700, fontSize: '.95rem' }}>{codigo(v)}</span>
                    <strong style={{ fontSize: '1.05rem' }}>{v.cliente}</strong>
                  </div>
                  <div style={{ fontSize: '.8rem', color: '#64748b', marginTop: 4 }}>{fechaHora(v.creado)} · {v.asesor}</div>
                </div>
                <strong style={{ fontSize: '1.3rem' }}>{peso(v.total)}</strong>
              </div>

              <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', margin: '.7rem 0' }}>
                <span style={{ background: e.pago.bg, color: e.pago.fg, borderRadius: 99, padding: '4px 12px', fontSize: '.78rem', fontWeight: 700 }}>Pago: {e.pago.texto}</span>
                <span style={{ background: e.envio.bg, color: e.envio.fg, borderRadius: 99, padding: '4px 12px', fontSize: '.78rem', fontWeight: 700 }}>Envío: {e.envio.texto}</span>
              </div>

              <div style={{ display: 'grid', gap: '.5rem' }}>
                {[...grupos.values()].map((g, i) => (
                  <div key={i} style={{ background: '#f8fafc', borderRadius: 14, padding: '.6rem .8rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '.92rem' }}>{g.nombre}{g.estampado ? ` · ${g.estampado}` : ''}</div>
                    <div style={{ fontSize: '.9rem', color: '#334155' }}>{g.lineas.join('  ·  ')}</div>
                  </div>
                ))}
              </div>
              <div style={{ color: '#64748b', fontSize: '.85rem', marginTop: '.6rem' }}>{totalUnidades(v)} unidades · {v.ciudad || 'Sin ciudad'} · {v.pago} · {v.telefono}</div>

              {accionesEnvio(v)}
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.6rem', alignItems: 'center' }}>
                <button className="vd-chip" onClick={() => setAbiertoId(abierto ? null : r.id)}>{abierto ? 'Ocultar historial' : 'Ver historial'}</button>
                {e.grupo === 'esperando' && (
                  <>
                    <button className="vd-chip" style={{ background: '#fee2e2' }} onClick={() => abrirChat(v, textoRecordatorioPago(v))}>Recordar pago</button>
                    <label className="vd-chip" style={{ cursor: 'pointer', background: '#fef3c7' }}>
                      {ocupado === 'c' + r.id ? 'Subiendo...' : 'Adjuntar comprobante'}
                      <input type="file" accept="image/*" hidden disabled={ocupado === 'c' + r.id} onChange={ev => { const a = ev.target.files?.[0]; if (a) adjuntarComprobante(r, a); ev.target.value = ''; }} />
                    </label>
                  </>
                )}
                {e.guia && <button className="vd-chip" style={{ background: '#e0e7ff' }} onClick={() => abrirChat(v, textoDespacho(v, e.guia))}>Avisar despacho</button>}
                {masOpciones(v)}
              </div>

              {abierto && (
                <div style={{ marginTop: '.8rem', background: '#f8fafc', borderRadius: 14, padding: '.9rem' }}>
                  <div className="vd-lbl" style={{ marginTop: 0 }}>Historial del pedido</div>
                  {lineaTiempo(r).map((ev, i) => (
                    <div key={i} style={{ display: 'flex', gap: '.7rem', padding: '.35rem 0' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, marginTop: 7, flex: 'none' }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '.92rem' }}>{ev.texto}</div>
                        <div style={{ fontSize: '.78rem', color: '#64748b' }}>{ev.fecha ? fechaHora(ev.fecha) : 'Sin fecha registrada'}{ev.usuario ? ` · ${ev.usuario}` : ''}</div>
                      </div>
                    </div>
                  ))}
                  {(r.pantallazo_url || r.evidencia_despacho_url || r.evidencia_entrega_url || e.guia) && (
                    <>
                      <div className="vd-lbl">Evidencias</div>
                      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                        {r.pantallazo_url && <a className="vd-chip" href={r.pantallazo_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Comprobante de pago</a>}
                        {r.evidencia_despacho_url && <a className="vd-chip" href={r.evidencia_despacho_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Evidencia de despacho</a>}
                        {r.evidencia_entrega_url && <a className="vd-chip" href={r.evidencia_entrega_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Evidencia de entrega</a>}
                        {e.guia && <span className="vd-chip">Guía: {e.guia}</span>}
                      </div>
                    </>
                  )}
                  <p style={{ margin: '.8rem 0 0', fontSize: '.78rem', color: '#94a3b8' }}>El pago lo valida el administrador desde el panel de Pedidos.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const raiz = { ['--c' as string]: color, ['--t' as string]: sobre };

  // ───────────── Elegir marca → asesor → PIN ─────────────
  if (!asesor) {
    const ocultas = ['indisutex', 'default', 'superadmin'];
    const porMarca = new Map<string, Asesor[]>();
    lista.forEach(a => {
      if (!a.tenant_id || ocultas.includes(a.tenant_id.toLowerCase())) return;
      porMarca.set(a.tenant_id, [...(porMarca.get(a.tenant_id) || []), a]);
    });
    const info = (id: string) => marcas.get(id) || { nombre: id.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), color: '#6366f1', logo: undefined };
    const listaMarcas = [...porMarca.keys()].sort((x, y) => info(x).nombre.localeCompare(info(y).nombre, 'es'));
    const asesoresMarca = marca ? porMarca.get(marca) || [] : [];
    const im = marca ? info(marca) : null;
    return (
      <div className="vd" style={{ ...raiz, ['--c' as string]: '#4f46e5', ['--t' as string]: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'linear-gradient(160deg,#0f172a,#312e81)' }}>
        <style>{CSS}</style>
        <div className="vd-card" style={{ width: '100%', maxWidth: marca ? 520 : 680, padding: '1.8rem 1.4rem', borderRadius: 28 }}>
          <h1 style={{ fontSize: '1.5rem', margin: '0 0 .2rem', textAlign: 'center', color: '#0f172a' }}>Nuevo pedido</h1>
          <p style={{ color: '#64748b', textAlign: 'center', margin: '0 0 1.2rem' }}>
            {elegido ? `Hola ${elegido.nombre.split(' ')[0]}, ingresa tu PIN` : marca ? 'Elige tu nombre' : '¿De qué marca eres?'}
          </p>

          {!marca && (
            <>
              {listaMarcas.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8' }}>Cargando marcas...</p>}
              <div className="vd-marcas">
                {listaMarcas.map(id => {
                  const m = info(id);
                  return (
                    <button key={id} className="vd-marca" onClick={() => setMarca(id)} style={{ ['--c' as string]: m.color }}>
                      <span className="barra" />
                      <span className="logo"><LogoMarca nombre={m.nombre} logo={m.logo} color={m.color} /></span>
                      <span className="nom">{m.nombre}</span>
                      <span className="cant">{porMarca.get(id)!.length} asesora{porMarca.get(id)!.length === 1 ? '' : 's'}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {marca && !elegido && im && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.8rem', background: '#f8fafc', borderRadius: 18, padding: '.6rem .8rem', marginBottom: '.9rem' }}>
                <span style={{ width: 52, height: 52, flex: 'none' }}><LogoMarca nombre={im.nombre} logo={im.logo} color={im.color} /></span>
                <strong style={{ fontSize: '1.15rem', flex: 1, color: '#0f172a' }}>{im.nombre}</strong>
                <button onClick={() => setMarca(null)} className="vd-nb" style={{ background: '#e2e8f0', color: '#0f172a' }}>Cambiar marca</button>
              </div>
              <div style={{ display: 'grid', gap: '.6rem', maxHeight: '55vh', overflow: 'auto' }}>
                {asesoresMarca.map(a => (
                  <button key={a.id} onClick={() => { setElegido(a); setPin(''); setPinError(''); }} style={{ display: 'flex', alignItems: 'center', gap: '.8rem', background: '#f8fafc', borderRadius: 16, padding: '.7rem .9rem', textAlign: 'left', minHeight: 68, border: '2px solid transparent' }}>
                    {a.foto_url ? <img src={a.foto_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} /> : <span style={{ width: 48, height: 48, borderRadius: '50%', background: im.color, color: textoSobre(im.color), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{a.nombre.charAt(0).toUpperCase()}</span>}
                    <strong style={{ fontSize: '1.05rem' }}>{a.nombre}</strong>
                  </button>
                ))}
              </div>
            </>
          )}

          {elegido && (
            <form onSubmit={entrar} style={{ textAlign: 'center' }}>
              <input className="vd-in" type="password" inputMode="numeric" autoFocus value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN" style={{ textAlign: 'center', letterSpacing: '.4em', fontSize: '1.7rem', minHeight: 66 }} />
              {pinError && <p style={{ color: '#dc2626', fontWeight: 600 }}>{pinError}</p>}
              <button className="vd-go" type="submit" disabled={verificando || !pin.trim()} style={{ marginTop: '1rem' }}>{verificando ? 'Verificando...' : 'Entrar'}</button>
              <button type="button" onClick={() => setElegido(null)} style={{ background: 'transparent', color: '#64748b', marginTop: '.8rem', fontWeight: 600, minHeight: 44 }}>← Volver</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ───────────── Pedido guardado ─────────────
  if (listo) {
    const fv = listo.ficha;
    return (
      <div className="vd" style={{ ...raiz, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <style>{CSS}</style>
        <div className="vd-card" style={{ width: '100%', maxWidth: 520, textAlign: 'center', padding: '1.8rem 1.3rem', borderRadius: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto .8rem', fontSize: '2rem' }}>✓</div>
          <h1 style={{ fontSize: '1.4rem', margin: '0 0 .1rem', color: '#0f172a' }}>¡Pedido guardado!</h1>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '1.5rem', color: '#0f172a' }}>{codigo(fv)} · {peso(listo.total)}</p>
          <p style={{ color: '#64748b', margin: '.2rem 0 1rem', fontSize: '.9rem' }}>{fv.cliente} · {fv.estadoPago}</p>
          <div style={{ textAlign: 'left' }}>
            <div className="vd-lbl" style={{ marginTop: 0 }}>¿Qué quieres hacer ahora?</div>
            {accionesEnvio(fv)}
            {masOpciones(fv)}
            <p style={{ color: '#94a3b8', fontSize: '.78rem', margin: '.7rem 0 0' }}>En computador, la imagen se copia sola: en WhatsApp presiona <b>Ctrl + V</b> para pegarla y envía. En celular se abre el menú de compartir.</p>
          </div>
          <button className="vd-go" onClick={() => setListo(null)} style={{ marginTop: '1rem', background: '#0f172a' }}>Hacer otro pedido</button>
          <button onClick={() => { setListo(null); setVista('lista'); }} style={{ background: 'transparent', color: '#475569', fontWeight: 600, marginTop: '.4rem', minHeight: 44 }}>Ver pedidos solicitados manuales</button>
        </div>
        {aviso && <div className="vd-toast" style={{ background: aviso.tipo === 'ok' ? '#065f46' : '#991b1b' }}>{aviso.texto}</div>}
      </div>
    );
  }

  const panel = (
    <aside className={`vd-card vd-side ${verPedido ? 'open' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '1.2rem' }}>Pedido</strong>
        <button className="vd-nb" onClick={() => setVerPedido(false)} style={{ background: '#f1f5f9', color: '#0f172a', display: verPedido ? 'block' : 'none' }}>Cerrar</button>
      </div>
      {lineas.length === 0 && <p style={{ color: '#94a3b8' }}>Toca un producto para empezar.</p>}
      {lineas.map(l => {
        const pu = precioLinea(l, tier);
        const o = opcionesDe(l.prod).find(x => x.clave === l.talla);
        return (
          <div key={l.key} className="vd-row">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '.92rem', lineHeight: 1.25 }}>{(l.prod.nombre || '').trim()}</div>
              {l.talla && <span className="vd-pill">{o ? o.texto : l.talla}</span>}
              {l.estampado && <span className="vd-pill">{l.estampado}</span>}
              <div style={{ fontSize: '.82rem', color: '#64748b' }}>{peso(pu)} c/u · <b style={{ color: '#0f172a' }}>{peso(pu * l.cantidad)}</b></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>
              <button className="vd-step" onClick={() => cambiar(l.key, -1)}>−</button>
              <span style={{ width: 34, textAlign: 'center', fontWeight: 700 }}>{l.cantidad}</span>
              <button className="vd-step" onClick={() => cambiar(l.key, 1)}>+</button>
              <button onClick={() => quitar(l.key)} aria-label="Quitar" style={{ background: 'transparent', color: '#94a3b8', width: 40, height: 40, fontSize: '1.1rem' }}>✕</button>
            </div>
          </div>
        );
      })}
      {lineas.length > 0 && (
        <>
          <div style={{ background: huboDescuento ? '#dcfce7' : '#fef3c7', color: huboDescuento ? '#166534' : '#92400e', borderRadius: 14, padding: '.7rem .9rem', margin: '.8rem 0', fontSize: '.88rem', fontWeight: 600 }}>
            {unidades} unidades · {etiquetaTier}
            {bulkActivo && unidades < 6 ? ` · con ${6 - unidades} más pasa a precio por mayor` : ''}
            {tier !== 'detal' && !huboDescuento ? ' · estos productos no tienen precio por mayor' : ''}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.8rem' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>TOTAL</span>
            <strong style={{ fontSize: '1.7rem' }}>{peso(total)}</strong>
          </div>
          <button className="vd-go" onClick={() => setCobro(true)}>Continuar con los datos del cliente</button>
        </>
      )}
    </aside>
  );

  // ───────────── Pantalla principal ─────────────
  return (
    <div className="vd" style={raiz}>
      <style>{CSS}</style>
      <header className="vd-top">
        <span style={{ display: 'flex', alignItems: 'center', gap: '.7rem', minWidth: 0 }}>
          {config.logo_url && <span style={{ width: 38, height: 38, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 3, flex: 'none' }}><img src={config.logo_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /></span>}
          <span style={{ minWidth: 0 }}><b>{config.nombre_negocio || 'Nuevo pedido'}</b><br /><span style={{ fontSize: '.75rem', opacity: .7 }}>Asesor: {asesor.nombre}</span></span>
        </span>
        <nav style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="vd-nb" onClick={() => setVista('nuevo')} style={vista === 'nuevo' ? { background: '#fff', color: '#0f172a' } : undefined}>Nuevo pedido</button>
          <button className="vd-nb" onClick={() => setVista('lista')} style={vista === 'lista' ? { background: '#fff', color: '#0f172a' } : undefined}>Pedidos solicitados manuales</button>
          <button className="vd-nb" onClick={salir}>Salir</button>
        </nav>
      </header>

      <main className="vd-wrap">
        {vista === 'lista' ? listaJSX : (
        <div className="vd-main">
          <div style={{ minWidth: 0 }}>
            <div className="vd-tabs">
              {borradores.map((b, i) => {
                const u = b.lineas.reduce((t, l) => t + l.cantidad, 0);
                const nombre = b.f.nombre.trim().split(' ')[0] || `Pedido ${i + 1}`;
                const esActivo = b.id === activo.id;
                return (
                  <div key={b.id} className={`vd-tab ${esActivo ? 'on' : ''}`}>
                    <button onClick={() => { setActivoId(b.id); setCobro(false); setVerPedido(false); }}>{nombre}{u > 0 && <i>{u}</i>}</button>
                    {(borradores.length > 1 || u > 0) && <button aria-label={`Cerrar ${nombre}`} onClick={() => cerrarBorrador(b.id)} style={{ paddingLeft: 0, opacity: .7 }}>✕</button>}
                  </div>
                );
              })}
              {borradores.length < MAX_PEDIDOS_ABIERTOS && <button className="vd-tab-new" onClick={nuevoPedido}>+ Otro pedido</button>}
            </div>
            {iaOk && (
              <button className="vd-ia" onClick={() => { setIaAbierta(true); setIaRev(null); setIaError(''); }} disabled={cargando || productos.length === 0}>
                <span>Leer chat de WhatsApp con IA</span>
                <small>Sube la captura y se llena el pedido solo</small>
              </button>
            )}
            <input className="vd-search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar producto o referencia" />
            <div className="vd-cats">
              <button className={`vd-cat ${cat === 'todas' ? 'on' : ''}`} onClick={() => setCat('todas')}>Todas ({productos.length})</button>
              {categorias.map(([c, n]) => <button key={c} className={`vd-cat ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c} ({n})</button>)}
            </div>
            {cargando && <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '2rem' }}>Cargando catálogo...</p>}
            <div className="vd-grid">
              {resultados.map(p => (
                <button key={p.id} className="vd-prod" onClick={() => abrir(p)}>
                  <div className="img" style={p.imagen_url ? { backgroundImage: `url("${p.imagen_url}")` } : undefined} />
                  {(enPedido.get(p.id) || 0) > 0 && <span className="en">{enPedido.get(p.id)}</span>}
                  <div className="tx"><div className="nm">{p.nombre}</div>{p.referencia && <div className="rf">{p.referencia}</div>}</div>
                </button>
              ))}
            </div>
          </div>
          {panel}
        </div>
        )}
      </main>

      {vista === 'nuevo' && <div className="vd-bar">
        <div><div style={{ fontSize: '.8rem', color: '#64748b' }}>{unidades} unidades</div><strong style={{ fontSize: '1.3rem' }}>{peso(total)}</strong></div>
        <button className="vd-go" style={{ width: 'auto', padding: '0 1.6rem', minHeight: 54 }} onClick={() => setVerPedido(true)} disabled={lineas.length === 0}>Ver pedido</button>
      </div>}

      {/* Ventana del producto */}
      {hoja && (() => {
        const opciones = opcionesDe(hoja);
        const ests = estampadosDe(hoja);
        const imagen = imagenDeEstampado(hoja, est) || hoja.imagen_url;
        const suma = opciones.reduce((s, o) => s + (cants[o.clave] || 0), 0);
        return (
          <div className="vd-ov" onClick={() => setHoja(null)}>
            <div className="vd-sheet" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', gap: '.9rem', alignItems: 'center' }}>
                <div style={{ width: 84, height: 84, borderRadius: 16, background: '#e2e8f0 center/cover no-repeat', backgroundImage: imagen ? `url("${imagen}")` : undefined, flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.2 }}>{hoja.nombre}</div>
                  <div style={{ color: '#64748b', fontSize: '.85rem' }}>{hoja.referencia || hoja.categoria}</div>
                </div>
                <button onClick={() => setHoja(null)} aria-label="Cerrar" className="vd-step">✕</button>
              </div>

              {ests.length > 0 && (
                <>
                  <span className="vd-lbl">Estampado</span>
                  <div className="vd-chips">
                    {ests.map(e => { const im = imagenDeEstampado(hoja, e); return (
                      <button key={e} className={`vd-chip ${est === e ? 'on' : ''}`} onClick={() => setEst(e)}>{im && <img src={im} alt="" />}{e}</button>
                    ); })}
                  </div>
                </>
              )}

              <span className="vd-lbl">{esFamiliar(hoja) ? 'Cantidad por persona / talla' : 'Cantidad por talla'}</span>
              {opciones.map(o => {
                const pr = getEffectivePrice({ ...hoja, talla: o.clave, familia_opcion_key: esFamiliar(hoja) ? o.clave : undefined } as unknown as Producto, 'detal', 0, {}, promo);
                const q = cants[o.clave] || 0;
                return (
                  <div key={o.clave || 'u'} className="vd-row">
                    <div><div style={{ fontWeight: 600 }}>{o.texto}</div><div style={{ fontSize: '.8rem', color: '#64748b' }}>{pr > 0 ? `${peso(pr)} al detal` : 'Sin precio'}</div></div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button className="vd-step" onClick={() => setCants(c => ({ ...c, [o.clave]: Math.max(0, (c[o.clave] || 0) - 1) }))}>−</button>
                      <input className="vd-q" type="number" inputMode="numeric" min={0} value={q || ''} placeholder="0" onChange={e => setCants(c => ({ ...c, [o.clave]: Math.max(0, parseInt(e.target.value, 10) || 0) }))} />
                      <button className="vd-step" onClick={() => setCants(c => ({ ...c, [o.clave]: (c[o.clave] || 0) + 1 }))}>+</button>
                    </div>
                  </div>
                );
              })}

              <button className="vd-go" onClick={agregar} disabled={suma === 0} style={{ marginTop: '1rem' }}>{suma > 0 ? `Agregar ${suma} al pedido` : 'Agregar al pedido'}</button>
            </div>
          </div>
        );
      })()}

      {/* Datos del cliente */}
      {cobro && (
        <div className="vd-ov" onClick={() => setCobro(false)}>
          <div className="vd-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '1.3rem' }}>Datos del cliente</strong>
              <button onClick={() => setCobro(false)} className="vd-step" aria-label="Cerrar">✕</button>
            </div>
            <span className="vd-lbl">Cliente</span>
            <div className="vd-two">
              <input className="vd-in" placeholder="Nombre completo *" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} />
              <input className="vd-in" placeholder="Celular (10 dígitos) *" inputMode="numeric" value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} />
              <input className="vd-in" placeholder="Cédula (opcional)" inputMode="numeric" value={f.cedula} onChange={e => setF({ ...f, cedula: e.target.value })} />
              <input className="vd-in" placeholder="Correo (opcional)" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
            </div>

            <span className="vd-lbl">Entrega</span>
            <div className="vd-seg">
              <button className={f.recepcion === 'domicilio' ? 'on' : ''} onClick={() => setF({ ...f, recepcion: 'domicilio' })}>Envío a domicilio</button>
              <button className={f.recepcion === 'tienda' ? 'on' : ''} onClick={() => setF({ ...f, recepcion: 'tienda' })}>Recoge en tienda</button>
            </div>
            {f.recepcion === 'domicilio' && (
              <div className="vd-two" style={{ marginTop: '.6rem' }}>
                <select className="vd-in" value={f.depto} onChange={e => setF({ ...f, depto: e.target.value, ciudad: '' })}>
                  <option value="">Departamento *</option>
                  {Object.keys(DEPARTAMENTOS_COLOMBIA).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select className="vd-in" value={f.ciudad} onChange={e => setF({ ...f, ciudad: e.target.value })} disabled={!f.depto}>
                  <option value="">Ciudad *</option>
                  {ciudades.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input className="vd-in" placeholder="Dirección *" value={f.direccion} onChange={e => setF({ ...f, direccion: e.target.value })} />
                <input className="vd-in" placeholder="Barrio (opcional)" value={f.barrio} onChange={e => setF({ ...f, barrio: e.target.value })} />
              </div>
            )}

            <span className="vd-lbl">Forma de pago</span>
            <div className="vd-seg">
              <button className={f.pago === 'transferencia' ? 'on' : ''} onClick={() => setF({ ...f, pago: 'transferencia' })}>Transferencia</button>
              <button className={f.pago === 'contra_entrega' ? 'on' : ''} onClick={() => setF({ ...f, pago: 'contra_entrega' })}>Contra entrega</button>
            </div>

            <input className="vd-in" style={{ marginTop: '.8rem' }} placeholder="Nota del pedido (opcional)" value={f.nota} onChange={e => setF({ ...f, nota: e.target.value })} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '1rem 0 .6rem' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>{unidades} unidades · {etiquetaTier}</span>
              <strong style={{ fontSize: '1.6rem' }}>{peso(total)}</strong>
            </div>
            <button className="vd-go" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar pedido'}</button>
          </div>
        </div>
      )}

      {iaAbierta && (() => {
        const rev = iaRev;
        const setRev = (patch: Partial<IaRevision>) => setIaRev(r => (r ? { ...r, ...patch } : r));
        const cambiarLinea = (i: number, patch: Partial<IaLinea>) => setIaRev(r => (r ? { ...r, lineas: r.lineas.map((l, j) => (j === i ? { ...l, ...patch } : l)) } : r));
        const ciudadesIA = rev && rev.depto ? DEPARTAMENTOS_COLOMBIA[rev.depto] || [] : [];
        const incompletas = rev ? rev.lineas.filter(lineaIAIncompleta).length : 0;
        return (
          <div className="vd-ov" onClick={() => { if (!iaLeyendo) setIaAbierta(false); }}>
            <div className="vd-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '1.3rem' }}>{rev ? 'Revisa lo que leyó la IA' : 'Leer chat con IA'}</strong>
                <button className="vd-step" aria-label="Cerrar" onClick={() => setIaAbierta(false)} disabled={iaLeyendo}>✕</button>
              </div>

              {!rev && (
                <>
                  <p style={{ color: '#64748b', fontSize: '.92rem', margin: '.5rem 0 .8rem' }}>Sube las capturas de la conversación con el cliente, o pega su texto. La IA llena el pedido y tú lo revisas antes de guardar.</p>
                  <label className="vd-drop">
                    <input type="file" accept="image/*" multiple hidden onChange={e => { agregarCapturas([...(e.target.files || [])]); e.target.value = ''; }} />
                    <b>Toca para elegir capturas del chat</b>
                    <span>o pégalas con Ctrl + V · hasta {MAX_CAPTURAS}</span>
                  </label>
                  {iaImgs.length > 0 && (
                    <div className="vd-thumbs">
                      {iaImgs.map(im => (
                        <div key={im.id} className="th"><img src={im.vista} alt="Captura" /><button aria-label="Quitar captura" onClick={() => setIaImgs(prev => prev.filter(x => x.id !== im.id))}>✕</button></div>
                      ))}
                    </div>
                  )}
                  <span className="vd-lbl">O pega el texto del chat</span>
                  <textarea className="vd-in" rows={4} value={iaTexto} onChange={e => setIaTexto(e.target.value)} placeholder="Ej: Hola, quiero 3 pijamas de hombre única y 4 de dama..." />
                  {iaError && <p style={{ color: '#b91c1c', fontWeight: 600, margin: '.7rem 0 0' }}>{iaError}</p>}
                  <button className="vd-go" onClick={leerChat} disabled={iaLeyendo || (iaImgs.length === 0 && !iaTexto.trim())} style={{ marginTop: '1rem' }}>
                    {iaLeyendo ? 'Leyendo el chat... puede tardar unos segundos' : 'Leer con IA'}
                  </button>
                  <p style={{ color: '#94a3b8', fontSize: '.75rem', margin: '.7rem 0 0' }}>Las capturas se envían a la IA de Anthropic solo para leerlas. No se guardan en tu catálogo.</p>
                </>
              )}

              {rev && (
                <>
                  <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 14, padding: '.7rem .9rem', margin: '.6rem 0', fontSize: '.88rem', fontWeight: 600 }}>La IA puede equivocarse. Corrige lo que haga falta antes de aplicar.</div>
                  {rev.advertencias.length > 0 && (
                    <ul style={{ margin: '.4rem 0 .8rem', paddingLeft: '1.2rem', color: '#b45309', fontSize: '.88rem' }}>
                      {rev.advertencias.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  )}

                  <span className="vd-lbl">Cliente</span>
                  <div className="vd-two">
                    <input className="vd-in" placeholder="Nombre" value={rev.nombre} onChange={e => setRev({ nombre: e.target.value })} />
                    <input className="vd-in" placeholder="Celular (10 dígitos)" inputMode="numeric" value={rev.celular} onChange={e => setRev({ celular: e.target.value.replace(/\D/g, '').slice(-10) })} />
                  </div>

                  <span className="vd-lbl">Entrega y pago</span>
                  <div className="vd-seg">
                    <button className={rev.recepcion === 'domicilio' ? 'on' : ''} onClick={() => setRev({ recepcion: 'domicilio' })}>Domicilio</button>
                    <button className={rev.recepcion === 'tienda' ? 'on' : ''} onClick={() => setRev({ recepcion: 'tienda' })}>Recoge en tienda</button>
                  </div>
                  <div className="vd-two" style={{ marginTop: '.6rem' }}>
                    <select className="vd-in" value={rev.depto} onChange={e => setRev({ depto: e.target.value, ciudad: '' })}>
                      <option value="">Departamento</option>
                      {Object.keys(DEPARTAMENTOS_COLOMBIA).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select className="vd-in" value={rev.ciudad} onChange={e => setRev({ ciudad: e.target.value })} disabled={!rev.depto}>
                      <option value="">Ciudad</option>
                      {ciudadesIA.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input className="vd-in" placeholder="Dirección" value={rev.direccion} onChange={e => setRev({ direccion: e.target.value })} />
                    <input className="vd-in" placeholder="Barrio" value={rev.barrio} onChange={e => setRev({ barrio: e.target.value })} />
                  </div>
                  <div className="vd-seg" style={{ marginTop: '.6rem' }}>
                    <button className={rev.pago === 'transferencia' ? 'on' : ''} onClick={() => setRev({ pago: 'transferencia' })}>Transferencia</button>
                    <button className={rev.pago === 'contra_entrega' ? 'on' : ''} onClick={() => setRev({ pago: 'contra_entrega' })}>Contra entrega</button>
                  </div>
                  <input className="vd-in" style={{ marginTop: '.6rem' }} placeholder="Nota (opcional)" value={rev.nota} onChange={e => setRev({ nota: e.target.value })} />

                  <span className="vd-lbl">Productos que pidió</span>
                  {rev.lineas.length === 0 && <p style={{ color: '#94a3b8', margin: 0 }}>No encontré productos del catálogo en el chat.</p>}
                  {rev.lineas.map((l, i) => {
                    const prod = productos.find(p => p.id === l.prodId);
                    if (!prod) return null;
                    const opciones = opcionesDe(prod).filter(o => o.clave);
                    const ests = estampadosDe(prod);
                    const mal = lineaIAIncompleta(l) || !l.seguro;
                    return (
                      <div key={i} style={{ border: `2px solid ${mal ? '#fbbf24' : '#e2e8f0'}`, borderRadius: 16, padding: '.7rem', marginBottom: '.6rem' }}>
                        <div style={{ display: 'flex', gap: '.7rem', alignItems: 'center' }}>
                          <div style={{ width: 52, height: 52, borderRadius: 12, background: '#e2e8f0 center/cover no-repeat', backgroundImage: prod.imagen_url ? `url("${prod.imagen_url}")` : undefined, flex: 'none' }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '.92rem', lineHeight: 1.2 }}>{(prod.nombre || '').trim()}</div>
                            {l.original && <div style={{ fontSize: '.78rem', color: '#64748b', fontStyle: 'italic' }}>Cliente dijo: «{l.original}»</div>}
                          </div>
                          <button aria-label="Quitar producto" onClick={() => setRev({ lineas: rev.lineas.filter((_, j) => j !== i) })} style={{ background: 'transparent', color: '#94a3b8', width: 40, height: 40, fontSize: '1.1rem' }}>✕</button>
                        </div>
                        <div className="vd-two" style={{ marginTop: '.6rem' }}>
                          {opciones.length > 0 && (
                            <select className="vd-in" value={l.opcion} onChange={e => cambiarLinea(i, { opcion: e.target.value, seguro: true })} style={!l.opcion ? { borderColor: '#f59e0b' } : undefined}>
                              <option value="">Elige la talla / persona</option>
                              {opciones.map(o => <option key={o.clave} value={o.clave}>{o.texto}</option>)}
                            </select>
                          )}
                          {ests.length > 0 && (
                            <select className="vd-in" value={l.estampado} onChange={e => cambiarLinea(i, { estampado: e.target.value, seguro: true })} style={!l.estampado ? { borderColor: '#f59e0b' } : undefined}>
                              <option value="">Elige el estampado</option>
                              {ests.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '.5rem' }}>
                          <button className="vd-step" onClick={() => cambiarLinea(i, { cantidad: Math.max(1, l.cantidad - 1) })}>−</button>
                          <span style={{ width: 44, textAlign: 'center', fontWeight: 700, fontSize: '1.1rem' }}>{l.cantidad}</span>
                          <button className="vd-step" onClick={() => cambiarLinea(i, { cantidad: l.cantidad + 1 })}>+</button>
                        </div>
                      </div>
                    );
                  })}
                  {rev.sinIdentificar.length > 0 && (
                    <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 14, padding: '.7rem .9rem', fontSize: '.88rem', marginTop: '.4rem' }}>
                      <b>No encontré en el catálogo:</b>
                      <ul style={{ margin: '.3rem 0 0', paddingLeft: '1.1rem' }}>{rev.sinIdentificar.map((t, i) => <li key={i}>{t}</li>)}</ul>
                      <span>Agrégalos a mano buscándolos en el catálogo.</span>
                    </div>
                  )}

                  <button className="vd-go" onClick={aplicarIA} disabled={incompletas > 0 || (rev.lineas.length === 0 && !rev.nombre && !rev.celular)} style={{ marginTop: '1rem' }}>
                    {incompletas > 0 ? `Falta elegir talla o estampado en ${incompletas} producto${incompletas === 1 ? '' : 's'}` : 'Aplicar al pedido'}
                  </button>
                  <button onClick={() => setIaRev(null)} style={{ background: 'transparent', color: '#475569', fontWeight: 600, width: '100%', marginTop: '.4rem', minHeight: 46 }}>← Leer otro chat</button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {aviso && <div className="vd-toast" style={{ background: aviso.tipo === 'ok' ? '#065f46' : '#991b1b' }}>{aviso.texto}</div>}
    </div>
  );
}
