import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getEffectivePrice } from '../context/CartContext';
import type { BuyerType } from '../context/CartContext';
import type { Producto } from '../types';
import { DEPARTAMENTOS_COLOMBIA } from '../data/colombiaData';

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

const peso = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
const soloDigitos = (s?: string | null) => (s || '').replace(/\D/g, '');
const primerTel = (t: string) => soloDigitos((t || '').split(/[,;/]/)[0]).slice(-10);
const tierDe = (u: number, activo: boolean): BuyerType => (!activo ? 'detal' : u >= 50 ? '50_unidades' : u >= 6 ? 'mayorista' : 'detal');

const ETIQ: Record<string, string> = {
  'Caballero Única': 'Hombre única',
  '2XL Unisex': 'Hombre extra plus (2XL)',
  'Dama Única': 'Dama única',
  'Dama Plus': 'Dama plus',
  '18': 'Talla 18'
};
const etiqueta = (k: string) => ETIQ[k] || (/^\d+\/\d+$/.test(k) ? `Niño/a ${k}` : k || 'Cantidad');

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

export default function Vender() {
  const [asesor, setAsesor] = useState<Asesor | null>(() => {
    try { const s = localStorage.getItem(SESION); return s ? (JSON.parse(s) as Asesor) : null; } catch { return null; }
  });
  const [lista, setLista] = useState<Asesor[]>([]);
  const [elegido, setElegido] = useState<Asesor | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verificando, setVerificando] = useState(false);

  const [config, setConfig] = useState<Config>({});
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [cat, setCat] = useState('todas');

  const [lineas, setLineas] = useState<Linea[]>([]);
  const [hoja, setHoja] = useState<Producto | null>(null);
  const [cants, setCants] = useState<Record<string, number>>({});
  const [est, setEst] = useState('');
  const [verPedido, setVerPedido] = useState(false);
  const [cobro, setCobro] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState<{ id: string; total: number; url: string } | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const [f, setF] = useState({ nombre: '', telefono: '', cedula: '', email: '', recepcion: 'domicilio', pago: 'transferencia', depto: '', ciudad: '', direccion: '', barrio: '', nota: '' });

  const color = config.color_primario || '#6366f1';
  const sobre = textoSobre(color);
  const mostrar = (tipo: 'ok' | 'error', texto: string) => { setAviso({ tipo, texto }); window.setTimeout(() => setAviso(null), 3200); };

  // Lista de asesores (sin PIN) para elegir el nombre
  useEffect(() => {
    if (asesor) return;
    supabase.from('asesores').select('id,nombre,telefono,tenant_id,foto_url').order('nombre').then(({ data }) => setLista((data as Asesor[]) || []));
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

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!elegido) return;
    setVerificando(true);
    setPinError('');
    const { data } = await supabase.from('asesores').select('id,nombre,telefono,tenant_id,foto_url').eq('id', elegido.id).eq('pin', pin.trim()).maybeSingle();
    setVerificando(false);
    if (!data) return setPinError('PIN incorrecto');
    try { localStorage.setItem(SESION, JSON.stringify(data)); } catch { /* sin almacenamiento */ }
    setAsesor(data as Asesor);
  }

  function salir() {
    try { localStorage.removeItem(SESION); } catch { /* sin almacenamiento */ }
    setAsesor(null); setElegido(null); setPin(''); setLineas([]); setProductos([]);
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

  function datosTransferencia(): string {
    const crudo = String(config.metodos_pago || '').split('__EXTRA_CONFIG__')[0].trim();
    if (!crudo) return '';
    try {
      const arr = JSON.parse(crudo);
      if (Array.isArray(arr)) {
        const v = arr.filter((m: any) => (m.banco && m.banco.trim()) || (m.numero && m.numero.trim()));
        if (v.length) return `\n\n💳 *DATOS PARA TRANSFERENCIA:*\n` + v.map((m: any) => `• *${m.banco}* ${m.tipo ? `(${m.tipo})` : ''}: ${m.numero}`).join('\n');
      }
    } catch { return `\n\n💳 *DATOS PARA TRANSFERENCIA:*\n${crudo}`; }
    return '';
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
      origen: 'asesor'
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

    const corto = nuevo.id.slice(0, 8);
    let msg = `Hola ${nombre}, soy ${asesor.nombre} de ${config.nombre_negocio || 'la tienda'}. Este es el resumen de tu pedido:\n\n`;
    msg += lineas.map(l => {
      const o = opcionesDe(l.prod).find(x => x.clave === l.talla);
      const detalle = [(l.prod.nombre || '').trim(), o && l.talla ? o.texto : '', l.estampado].filter(Boolean).join(' · ');
      return `• ${l.cantidad}x ${detalle} — ${peso(precioLinea(l, tier) * l.cantidad)}`;
    }).join('\n');
    msg += `\n\n*TOTAL PRODUCTOS:* ${peso(total)}\n*Tipo de compra:* ${tipoCompra}`;
    if (f.pago === 'transferencia') {
      msg += `\n*ENVÍO:* Pendiente por calcular.` + datosTransferencia();
      msg += `\n\n*Sube tu comprobante de pago aquí:* ${window.location.origin}/pago/${corto}`;
      msg += `\n\n_Por favor envía el comprobante de pago para procesar y despachar tu pedido._`;
    } else {
      msg += `\n*ENVÍO:* PAGO CONTRA ENTREGA\n\nCancela al momento de recibir tu pedido el valor de las prendas + el costo del envío.`;
    }
    setListo({ id: nuevo.id, total, url: `https://wa.me/57${tel}?text=${encodeURIComponent(msg)}` });
    setLineas([]); setCobro(false); setVerPedido(false);
    setF({ nombre: '', telefono: '', cedula: '', email: '', recepcion: 'domicilio', pago: 'transferencia', depto: '', ciudad: '', direccion: '', barrio: '', nota: '' });
  }

  const raiz = { ['--c' as string]: color, ['--t' as string]: sobre };

  // ───────────── Elegir asesor + PIN ─────────────
  if (!asesor) {
    return (
      <div className="vd" style={{ ...raiz, ['--c' as string]: '#4f46e5', ['--t' as string]: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'linear-gradient(160deg,#0f172a,#312e81)' }}>
        <style>{CSS}</style>
        <div className="vd-card" style={{ width: '100%', maxWidth: 520, padding: '1.8rem 1.4rem', borderRadius: 28 }}>
          <h1 style={{ fontSize: '1.5rem', margin: '0 0 .2rem', textAlign: 'center', color: '#0f172a' }}>Nuevo pedido</h1>
          <p style={{ color: '#64748b', textAlign: 'center', margin: '0 0 1.2rem' }}>{elegido ? `Hola ${elegido.nombre.split(' ')[0]}, ingresa tu PIN` : '¿Quién eres?'}</p>
          {!elegido && (
            <div style={{ display: 'grid', gap: '.6rem', maxHeight: '60vh', overflow: 'auto' }}>
              {lista.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8' }}>Cargando asesores...</p>}
              {lista.map(a => (
                <button key={a.id} onClick={() => { setElegido(a); setPin(''); setPinError(''); }} style={{ display: 'flex', alignItems: 'center', gap: '.8rem', background: '#f8fafc', borderRadius: 16, padding: '.7rem .9rem', textAlign: 'left', minHeight: 64 }}>
                  {a.foto_url ? <img src={a.foto_url} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} /> : <span style={{ width: 44, height: 44, borderRadius: '50%', background: '#c7d2fe', color: '#3730a3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{a.nombre.charAt(0).toUpperCase()}</span>}
                  <span><strong>{a.nombre}</strong><br /><span style={{ fontSize: '.8rem', color: '#64748b' }}>{a.tenant_id.replace(/_/g, ' ')}</span></span>
                </button>
              ))}
            </div>
          )}
          {elegido && (
            <form onSubmit={entrar} style={{ textAlign: 'center' }}>
              <input className="vd-in" type="password" inputMode="numeric" autoFocus value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN" style={{ textAlign: 'center', letterSpacing: '.4em', fontSize: '1.7rem', minHeight: 66 }} />
              {pinError && <p style={{ color: '#dc2626', fontWeight: 600 }}>{pinError}</p>}
              <button className="vd-go" type="submit" disabled={verificando || !pin.trim()} style={{ marginTop: '1rem' }}>{verificando ? 'Verificando...' : 'Entrar'}</button>
              <button type="button" onClick={() => setElegido(null)} style={{ background: 'transparent', color: '#64748b', marginTop: '.8rem', fontWeight: 600, minHeight: 44 }}>← Cambiar de asesor</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ───────────── Pedido guardado ─────────────
  if (listo) {
    return (
      <div className="vd" style={{ ...raiz, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <style>{CSS}</style>
        <div className="vd-card" style={{ width: '100%', maxWidth: 460, textAlign: 'center', padding: '2rem 1.4rem', borderRadius: 28 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '2.2rem' }}>✓</div>
          <h1 style={{ fontSize: '1.5rem', margin: '0 0 .2rem', color: '#0f172a' }}>Pedido guardado</h1>
          <p style={{ color: '#64748b', margin: 0 }}>#{listo.id.slice(0, 8).toUpperCase()} · {peso(listo.total)}</p>
          <p style={{ color: '#64748b', fontSize: '.9rem' }}>Ya aparece en el admin, en Pedidos.</p>
          <a href={listo.url} target="_blank" rel="noreferrer" className="vd-go" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: '#16a34a', color: '#fff', marginTop: '1rem' }}>Enviar resumen al cliente por WhatsApp</a>
          <button className="vd-go" onClick={() => setListo(null)} style={{ marginTop: '.7rem', background: '#0f172a' }}>Nuevo pedido</button>
        </div>
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
        <button className="vd-nb" onClick={salir}>Salir</button>
      </header>

      <main className="vd-wrap">
        <div className="vd-main">
          <div style={{ minWidth: 0 }}>
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
      </main>

      <div className="vd-bar">
        <div><div style={{ fontSize: '.8rem', color: '#64748b' }}>{unidades} unidades</div><strong style={{ fontSize: '1.3rem' }}>{peso(total)}</strong></div>
        <button className="vd-go" style={{ width: 'auto', padding: '0 1.6rem', minHeight: 54 }} onClick={() => setVerPedido(true)} disabled={lineas.length === 0}>Ver pedido</button>
      </div>

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

      {aviso && <div className="vd-toast" style={{ background: aviso.tipo === 'ok' ? '#065f46' : '#991b1b' }}>{aviso.texto}</div>}
    </div>
  );
}
