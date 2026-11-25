import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

interface Tienda { id: string; nombre: string; color: string }

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
}

const FONT = "'Poppins', 'Inter', sans-serif";
const ACCENT = '#6366f1';
const TIENDAS_BASE: Tienda[] = [
  { id: 'sublimados_majestic', nombre: 'Sublimados Majestic', color: '#f50081' },
  { id: 'lucerito', nombre: 'Pijamas Lucerito', color: '#a855f7' },
  { id: 'saramantha', nombre: 'Saramantha', color: '#ff0fdf' },
  { id: 'lovely', nombre: 'Lovely', color: '#d561ff' }
];
const CIERRE_TENANT = 'general';

function parseTallas(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  if (typeof v !== 'string' || !v.trim()) return [];
  const t = v.trim();
  if (t.startsWith('[')) {
    try { return (JSON.parse(t) as unknown[]).map(x => String(x).trim()).filter(Boolean); } catch { /* sigue */ }
  }
  return t.split(/[,;|]/).map(x => x.trim()).filter(Boolean);
}

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
  const [tienda, setTienda] = useState<string>(TIENDAS_BASE[0].id);
  const [productos, setProductos] = useState<ProductoRef[]>([]);
  const [conteos, setConteos] = useState<Conteo[]>([]);
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [vista, setVista] = useState<'conteo' | 'envios'>('conteo');
  const [abierto, setAbierto] = useState<string | null>(null);

  const [contador, setContador] = useState(() => {
    try { return localStorage.getItem('bodega_contador') || ''; } catch { return ''; }
  });
  const [busqueda, setBusqueda] = useState('');
  const [sel, setSel] = useState<{ referencia: string; nombre: string; tallas: string[] } | null>(null);
  const [talla, setTalla] = useState('');
  const [color, setColor] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [cant, setCant] = useState(1);
  const [guardando, setGuardando] = useState(false);

  const [verTienda, setVerTienda] = useState<string>('todas');
  const [filtro, setFiltro] = useState('');

  const mostrar = (tipo: 'ok' | 'error', texto: string) => {
    setAviso({ tipo, texto });
    window.setTimeout(() => setAviso(null), 3500);
  };

  const nombreTienda = (id: string) => tiendas.find(t => t.id === id)?.nombre || id;
  const colorTienda = (id: string) => tiendas.find(t => t.id === id)?.color || '#64748b';

  async function cargarConteos() {
    const { data, error } = await supabase
      .from('bodega_conteos')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(5000);
    if (error) mostrar('error', 'No se pudo cargar. ¿Ya ejecutaste el SQL de bodega en Supabase?');
    else setConteos((data as Conteo[]) || []);
  }

  async function cargarCierres() {
    const { data } = await supabase
      .from('bodega_cierres')
      .select('*')
      .eq('tenant_id', CIERRE_TENANT)
      .order('enviado_at', { ascending: false })
      .limit(100);
    setCierres((data as Cierre[]) || []);
  }

  async function cargarTodo() {
    setCargando(true);
    const { data: cfg } = await supabase.from('configuracion').select('tenant_id,nombre_negocio,color_primario');
    if (cfg && cfg.length) {
      const mapa = new Map<string, Tienda>();
      for (const c of cfg as { tenant_id: string; nombre_negocio?: string; color_primario?: string }[]) {
        if (!c.tenant_id || c.tenant_id === 'default' || mapa.has(c.tenant_id)) continue;
        mapa.set(c.tenant_id, { id: c.tenant_id, nombre: c.nombre_negocio || c.tenant_id, color: c.color_primario || '#6366f1' });
      }
      if (mapa.size) {
        const lista = [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
        setTiendas(lista);
        setTienda(prev => (lista.some(t => t.id === prev) ? prev : lista[0].id));
      }
    }
    await Promise.all([cargarConteos(), cargarCierres()]);
    setCargando(false);
  }

  useEffect(() => {
    if (autenticado) cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autenticado]);

  // Productos de la tienda elegida (para buscar por referencia o nombre)
  useEffect(() => {
    if (!autenticado) return;
    let vigente = true;
    setProductos([]);
    supabase
      .from('productos')
      .select('referencia,nombre,imagen_url,tallas')
      .eq('tenant_id', tienda)
      .not('referencia', 'is', null)
      .limit(3000)
      .then(({ data }) => {
        if (!vigente) return;
        const lista = ((data as { referencia: string; nombre: string; imagen_url: string | null; tallas: unknown }[]) || [])
          .filter(p => p.referencia && String(p.referencia).trim())
          .map(p => ({ referencia: String(p.referencia).trim(), nombre: p.nombre, imagen_url: p.imagen_url, tallas: parseTallas(p.tallas) }));
        setProductos(lista);
      });
    setSel(null);
    setBusqueda('');
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
    setVista('conteo');
    setPin('');
  }

  const sugerencias = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [];
    return productos
      .filter(p => p.referencia.toLowerCase().includes(q) || (p.nombre || '').toLowerCase().includes(q))
      .slice(0, 12);
  }, [productos, busqueda]);

  const hayExacta = productos.some(p => p.referencia.toLowerCase() === busqueda.trim().toLowerCase());

  function elegir(p: ProductoRef) {
    setSel({ referencia: p.referencia, nombre: p.nombre, tallas: p.tallas });
    setTalla(p.tallas.length === 1 ? p.tallas[0] : '');
    setBusqueda('');
    setCant(1);
  }

  async function sumar(
    t: string, ref: string, nombre: string | null, tl: string, col: string, ubi: string, n: number
  ) {
    const { error } = await supabase.rpc('bodega_sumar', {
      p_tenant: t, p_referencia: ref, p_producto: nombre, p_talla: tl,
      p_color: col, p_ubicacion: ubi, p_cantidad: n, p_por: contador.trim() || null
    });
    return error;
  }

  async function guardar() {
    if (!sel) return;
    if (sel.tallas.length > 1 && !talla.trim()) return mostrar('error', 'Elige la talla');
    if (cant < 1) return mostrar('error', 'La cantidad debe ser 1 o más');
    setGuardando(true);
    const error = await sumar(tienda, sel.referencia, sel.nombre || null, talla.trim(), color.trim(), ubicacion.trim(), cant);
    setGuardando(false);
    if (error) return mostrar('error', 'No se pudo guardar: ' + error.message);
    mostrar('ok', `+${cant} ${sel.referencia}${talla ? ' ' + talla : ''} · ${nombreTienda(tienda)}`);
    setSel(null);
    setTalla('');
    setColor('');
    setCant(1);
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
    const { error } = await supabase
      .from('bodega_conteos')
      .update({ cantidad: nueva, contado_por: contador.trim() || c.contado_por, updated_at: new Date().toISOString() })
      .eq('id', c.id);
    if (error) { mostrar('error', 'No se pudo actualizar'); cargarConteos(); }
  }

  async function eliminar(c: Conteo) {
    if (!window.confirm(`¿Eliminar ${c.referencia} ${c.talla} ${c.color} de ${nombreTienda(c.tenant_id)}?`)) return;
    const { error } = await supabase.from('bodega_conteos').delete().eq('id', c.id);
    if (error) return mostrar('error', 'No se pudo eliminar');
    setConteos(prev => prev.filter(x => x.id !== c.id));
  }

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return conteos.filter(c =>
      (verTienda === 'todas' || c.tenant_id === verTienda) &&
      (!q || [c.referencia, c.producto_nombre, c.talla, c.color, c.ubicacion].some(v => (v || '').toLowerCase().includes(q)))
    );
  }, [conteos, verTienda, filtro]);

  const totalesTienda = useMemo(() => {
    const m = new Map<string, number>();
    conteos.forEach(c => m.set(c.tenant_id, (m.get(c.tenant_id) || 0) + c.cantidad));
    return m;
  }, [conteos]);

  const totalVisible = visibles.reduce((s, c) => s + c.cantidad, 0);
  const hayPendiente = cierres.some(c => c.estado === 'pendiente');

  function exportar() {
    const filas = visibles.map(c => ({
      Tienda: nombreTienda(c.tenant_id),
      Referencia: c.referencia,
      Producto: c.producto_nombre || '',
      Talla: c.talla,
      Color: c.color,
      Ubicación: c.ubicacion,
      Cantidad: c.cantidad,
      'Contado por': c.contado_por || '',
      Actualizado: new Date(c.updated_at).toLocaleString('es-CO')
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bodega');
    XLSX.writeFile(wb, `bodega_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function enviarAprobacion() {
    if (conteos.length === 0) return mostrar('error', 'No hay nada para enviar');
    if (hayPendiente) return mostrar('error', 'Ya hay un conteo esperando aprobación');
    const unidades = conteos.reduce((s, c) => s + c.cantidad, 0);
    if (!window.confirm(`¿Enviar ${conteos.length} líneas (${unidades} unidades, todas las tiendas) a aprobación? La lista de trabajo quedará vacía.`)) return;
    const detalle = conteos.map(({ id: _id, ...resto }) => resto);
    const { error } = await supabase.from('bodega_cierres').insert({
      tenant_id: CIERRE_TENANT,
      enviado_por: contador.trim() || null,
      total_lineas: conteos.length,
      total_unidades: unidades,
      detalle
    });
    if (error) return mostrar('error', 'No se pudo enviar: ' + error.message);
    const ids = conteos.map(c => c.id);
    let fallo = false;
    for (let i = 0; i < ids.length; i += 100) {
      const { error: errBorrar } = await supabase.from('bodega_conteos').delete().in('id', ids.slice(i, i + 100));
      if (errBorrar) fallo = true;
    }
    if (fallo) mostrar('error', 'Se envió, pero no se pudo vaciar toda la lista de trabajo');
    else mostrar('ok', 'Conteo enviado. Espera la aprobación del administrador.');
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
    const { error } = await supabase
      .from('bodega_cierres')
      .update({ estado, nota, resuelto_por: contador.trim() || 'Administrador', resuelto_at: new Date().toISOString() })
      .eq('id', c.id)
      .eq('estado', 'pendiente');
    if (error) return mostrar('error', 'No se pudo guardar la decisión');
    mostrar('ok', estado === 'aprobado' ? 'Conteo aprobado' : 'Conteo rechazado');
    cargarCierres();
  }

  async function recuperar(c: Cierre) {
    if (conteos.length > 0 && !window.confirm('Ya hay líneas en la lista de trabajo. Si coinciden con las del envío rechazado, se reemplaza su cantidad. ¿Continuar?')) return;
    const ahora = new Date().toISOString();
    const filas = c.detalle.map(d => ({ ...d, updated_at: ahora }));
    const { error } = await supabase
      .from('bodega_conteos')
      .upsert(filas, { onConflict: 'tenant_id,referencia,talla,color,ubicacion' });
    if (error) return mostrar('error', 'No se pudo recuperar: ' + error.message);
    mostrar('ok', 'Líneas recuperadas. Corrígelas y vuelve a enviar.');
    setVista('conteo');
    cargarConteos();
  }

  const estilos = (
    <style>{`
      .bod { min-height:100vh; background:#f1f5f9; font-family:${FONT}; color:#0f172a; font-size:17px; }
      .bod button, .bod input { font-family:${FONT}; }
      .bod-grid { display:grid; grid-template-columns:minmax(0,1fr); gap:1rem; align-items:start; }
      @media (min-width: 860px) { .bod-grid { grid-template-columns:minmax(0,430px) minmax(0,1fr); } .bod-sticky { position:sticky; top:76px; } }
      .bod-chips { display:flex; gap:.5rem; flex-wrap:wrap; }
      .bod-chip { border:2px solid #e2e8f0; background:#fff; color:#334155; border-radius:14px; padding:.7rem 1rem; min-height:52px; font-weight:600; font-size:1rem; cursor:pointer; }
      .bod-chip small { display:block; font-weight:500; font-size:.72rem; opacity:.8; }
      .bod-big { min-height:56px; border:none; border-radius:14px; font-weight:700; font-size:1.1rem; color:#fff; cursor:pointer; width:100%; }
      .bod-step { width:60px; height:60px; border-radius:14px; border:2px solid #cbd5e1; background:#fff; font-size:1.8rem; font-weight:700; cursor:pointer; flex:none; }
      .bod-card { background:#fff; border-radius:18px; padding:1rem; box-shadow:0 2px 8px rgba(15,23,42,.06); min-width:0; }
      .bod-in { width:100%; box-sizing:border-box; padding:.85rem 1rem; border:2px solid #cbd5e1; border-radius:12px; font-size:1.05rem; background:#fff; min-height:52px; }
      .bod-lbl { display:block; font-size:.72rem; font-weight:700; color:#64748b; margin:.9rem 0 .35rem; text-transform:uppercase; letter-spacing:.03em; }
      .bod table { width:100%; border-collapse:collapse; }
      .bod th { text-align:left; padding:.6rem .6rem; color:#64748b; font-size:.7rem; text-transform:uppercase; }
      .bod td { padding:.55rem .6rem; vertical-align:middle; border-top:1px solid #f1f5f9; }
    `}</style>
  );

  if (!autenticado) {
    return (
      <div className="bod" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        {estilos}
        <form onSubmit={entrar} className="bod-card" style={{ width: '100%', maxWidth: '360px', textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2.4rem' }}>📦</div>
          <h1 style={{ fontSize: '1.4rem', margin: '.4rem 0 .2rem' }}>Bodega</h1>
          <p style={{ color: '#64748b', fontSize: '.9rem', marginTop: 0 }}>Ingresa el PIN para continuar</p>
          <input className="bod-in" type="password" inputMode="numeric" autoFocus value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN" style={{ textAlign: 'center', letterSpacing: '.3em', fontSize: '1.5rem' }} />
          {pinError && <p style={{ color: '#dc2626', margin: '.6rem 0 0' }}>{pinError}</p>}
          <button className="bod-big" type="submit" disabled={verificando || !pin.trim()} style={{ background: ACCENT, marginTop: '1rem', opacity: verificando || !pin.trim() ? 0.6 : 1 }}>
            {verificando ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    );
  }

  const pendientes = cierres.filter(c => c.estado === 'pendiente').length;

  return (
    <div className="bod">
      {estilos}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '.7rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem', position: 'sticky', top: 0, zIndex: 5 }}>
        <strong style={{ fontSize: '1.15rem' }}>
          📦 Bodega {esAdmin && <span style={{ fontSize: '.7rem', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '999px', marginLeft: '4px' }}>Admin</span>}
        </strong>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button onClick={exportar} disabled={visibles.length === 0} className="bod-chip" style={{ background: '#059669', color: '#fff', borderColor: '#059669', minHeight: '46px', padding: '.4rem 1rem' }}>Excel</button>
          <button onClick={salir} className="bod-chip" style={{ minHeight: '46px', padding: '.4rem 1rem' }}>Salir</button>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.9rem' }}>
          <button className="bod-chip" onClick={() => setVista('conteo')} style={{ flex: 1, ...(vista === 'conteo' ? { background: ACCENT, color: '#fff', borderColor: ACCENT } : {}) }}>Conteo</button>
          <button className="bod-chip" onClick={() => setVista('envios')} style={{ flex: 1, ...(vista === 'envios' ? { background: ACCENT, color: '#fff', borderColor: ACCENT } : {}) }}>
            Envíos{pendientes > 0 ? ` (${pendientes} pendiente)` : ''}
          </button>
        </div>

        {aviso && (
          <div style={{ marginBottom: '.8rem', padding: '.8rem 1rem', borderRadius: '12px', background: aviso.tipo === 'ok' ? '#dcfce7' : '#fee2e2', color: aviso.tipo === 'ok' ? '#166534' : '#991b1b', fontWeight: 600 }}>
            {aviso.texto}
          </div>
        )}

        {vista === 'envios' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: '.8rem' }}>
            {cierres.length === 0 && <div className="bod-card" style={{ textAlign: 'center', color: '#94a3b8' }}>Aún no se ha enviado ningún conteo.</div>}
            {cierres.map(c => (
              <div key={c.id} className="bod-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{new Date(c.enviado_at).toLocaleString('es-CO')}</strong>
                    <div style={{ fontSize: '.85rem', color: '#64748b' }}>{c.total_lineas} líneas · {c.total_unidades} unidades{c.enviado_por ? ` · ${c.enviado_por}` : ''}</div>
                  </div>
                  <span style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '.8rem', fontWeight: 700, background: c.estado === 'aprobado' ? '#dcfce7' : c.estado === 'rechazado' ? '#fee2e2' : '#fef3c7', color: c.estado === 'aprobado' ? '#166534' : c.estado === 'rechazado' ? '#991b1b' : '#92400e' }}>
                    {c.estado === 'pendiente' ? 'Pendiente de aprobación' : c.estado === 'aprobado' ? 'Aprobado' : 'Rechazado'}
                  </span>
                </div>
                {c.resuelto_at && (
                  <div style={{ fontSize: '.85rem', color: '#64748b', marginTop: '.4rem' }}>
                    {c.estado === 'aprobado' ? 'Aprobó' : 'Rechazó'}: {c.resuelto_por || 'Administrador'} · {new Date(c.resuelto_at).toLocaleString('es-CO')}{c.nota ? ` · Motivo: ${c.nota}` : ''}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '.5rem', marginTop: '.8rem', flexWrap: 'wrap' }}>
                  <button className="bod-chip" onClick={() => setAbierto(abierto === c.id ? null : c.id)}>{abierto === c.id ? 'Ocultar detalle' : 'Ver detalle'}</button>
                  {esAdmin && c.estado === 'pendiente' && (
                    <>
                      <button className="bod-chip" onClick={() => resolver(c, 'aprobado')} style={{ background: '#059669', color: '#fff', borderColor: '#059669' }}>Aprobar</button>
                      <button className="bod-chip" onClick={() => resolver(c, 'rechazado')} style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}>Rechazar</button>
                    </>
                  )}
                  {c.estado === 'rechazado' && <button className="bod-chip" onClick={() => recuperar(c)} style={{ background: ACCENT, color: '#fff', borderColor: ACCENT }}>Recuperar para corregir</button>}
                </div>
                {!esAdmin && c.estado === 'pendiente' && <p style={{ margin: '.6rem 0 0', fontSize: '.8rem', color: '#94a3b8' }}>Solo el administrador (con su PIN) puede aprobar.</p>}
                {abierto === c.id && (
                  <div style={{ overflowX: 'auto', marginTop: '.7rem' }}>
                    <table style={{ minWidth: '460px', fontSize: '.9rem' }}>
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
        )}

        {vista === 'conteo' && (
          <div className="bod-grid">
            {/* ── Columna izquierda: agregar mercancía ── */}
            <div className="bod-card">
              <span className="bod-lbl" style={{ marginTop: 0 }}>1 · ¿De qué tienda es?</span>
              <div className="bod-chips">
                {tiendas.map(t => (
                  <button key={t.id} className="bod-chip" onClick={() => setTienda(t.id)}
                    style={tienda === t.id ? { background: t.color, borderColor: t.color, color: '#fff' } : { borderColor: t.color }}>
                    {t.nombre}
                  </button>
                ))}
              </div>

              <span className="bod-lbl">2 · Referencia o nombre</span>
              <input className="bod-in" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Escribe para buscar..." disabled={!!sel} />
              {!sel && busqueda.trim() && (
                <div style={{ display: 'grid', gap: '.4rem', marginTop: '.5rem' }}>
                  {sugerencias.map(p => (
                    <button key={p.referencia} onClick={() => elegir(p)} style={{ display: 'flex', alignItems: 'center', gap: '.7rem', textAlign: 'left', border: '2px solid #e2e8f0', background: '#fff', borderRadius: '12px', padding: '.5rem', minHeight: '60px', cursor: 'pointer' }}>
                      {p.imagen_url ? <img src={p.imagen_url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flex: 'none' }} /> : <span style={{ width: 44, height: 44, background: '#f1f5f9', borderRadius: 8, flex: 'none' }} />}
                      <span style={{ minWidth: 0 }}><strong>{p.referencia}</strong><br /><span style={{ fontSize: '.85rem', color: '#64748b' }}>{p.nombre}</span></span>
                    </button>
                  ))}
                  {!hayExacta && (
                    <button onClick={() => elegir({ referencia: busqueda.trim(), nombre: '', imagen_url: null, tallas: [] })} style={{ border: '2px dashed #94a3b8', background: '#fff', borderRadius: '12px', padding: '.7rem', minHeight: '56px', cursor: 'pointer', color: '#475569', fontWeight: 600 }}>
                      + Usar «{busqueda.trim()}» como referencia nueva
                    </button>
                  )}
                </div>
              )}

              {sel && (
                <>
                  <div style={{ marginTop: '.7rem', padding: '.7rem .9rem', background: '#f8fafc', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.5rem' }}>
                    <span style={{ minWidth: 0 }}><strong>{sel.referencia}</strong><br /><span style={{ fontSize: '.85rem', color: '#64748b' }}>{sel.nombre || 'Referencia sin producto'} · {nombreTienda(tienda)}</span></span>
                    <button className="bod-chip" onClick={() => setSel(null)} style={{ minHeight: '44px', padding: '.3rem .8rem' }}>Cambiar</button>
                  </div>

                  <span className="bod-lbl">3 · Talla</span>
                  <div className="bod-chips">
                    {sel.tallas.map(t => (
                      <button key={t} className="bod-chip" onClick={() => setTalla(t)} style={{ minWidth: '64px', ...(talla === t ? { background: ACCENT, borderColor: ACCENT, color: '#fff' } : {}) }}>{t}</button>
                    ))}
                    <input className="bod-in" value={sel.tallas.includes(talla) ? '' : talla} onChange={e => setTalla(e.target.value)} placeholder={sel.tallas.length ? 'otra' : 'Talla (opcional)'} style={{ width: '130px' }} />
                  </div>

                  <details style={{ marginTop: '.7rem' }} open={!!(color || ubicacion)}>
                    <summary style={{ cursor: 'pointer', color: '#475569', fontWeight: 600, padding: '.4rem 0' }}>+ Color o ubicación (opcional)</summary>
                    <div style={{ display: 'flex', gap: '.5rem', marginTop: '.4rem' }}>
                      <input className="bod-in" value={color} onChange={e => setColor(e.target.value)} placeholder="Color" />
                      <input className="bod-in" value={ubicacion} onChange={e => setUbicacion(e.target.value)} placeholder="Estante" />
                    </div>
                  </details>

                  <span className="bod-lbl">4 · Cantidad a sumar</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                    <button className="bod-step" onClick={() => setCant(c => Math.max(1, c - 1))}>−</button>
                    <input className="bod-in" type="number" inputMode="numeric" min={1} value={cant} onChange={e => setCant(Math.max(0, parseInt(e.target.value, 10) || 0))} style={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 700, minHeight: '60px' }} />
                    <button className="bod-step" onClick={() => setCant(c => c + 1)}>+</button>
                  </div>
                  <div className="bod-chips" style={{ marginTop: '.5rem' }}>
                    {[5, 10, 20, 50].map(n => <button key={n} className="bod-chip" onClick={() => setCant(c => c + n)} style={{ flex: 1 }}>+{n}</button>)}
                  </div>

                  <button className="bod-big" onClick={guardar} disabled={guardando} style={{ background: '#059669', marginTop: '1rem', opacity: guardando ? 0.6 : 1 }}>
                    {guardando ? 'Guardando...' : `Sumar ${cant} a bodega`}
                  </button>
                </>
              )}

              <span className="bod-lbl">Quién cuenta</span>
              <input className="bod-in" value={contador} placeholder="Tu nombre" onChange={e => {
                setContador(e.target.value);
                try { localStorage.setItem('bodega_contador', e.target.value); } catch { /* sin almacenamiento */ }
              }} />
            </div>

            {/* ── Columna derecha: lo que hay en bodega ── */}
            <div style={{ minWidth: 0 }}>
              <div className="bod-chips" style={{ marginBottom: '.7rem' }}>
                <button className="bod-chip" onClick={() => setVerTienda('todas')} style={verTienda === 'todas' ? { background: '#0f172a', color: '#fff', borderColor: '#0f172a' } : {}}>
                  Todas<small>{[...totalesTienda.values()].reduce((a, b) => a + b, 0)} unidades</small>
                </button>
                {tiendas.map(t => (
                  <button key={t.id} className="bod-chip" onClick={() => setVerTienda(t.id)} style={verTienda === t.id ? { background: t.color, borderColor: t.color, color: '#fff' } : { borderColor: t.color }}>
                    {t.nombre}<small>{totalesTienda.get(t.id) || 0} unidades</small>
                  </button>
                ))}
              </div>
              <input className="bod-in" placeholder="Filtrar lo contado..." value={filtro} onChange={e => setFiltro(e.target.value)} style={{ marginBottom: '.7rem' }} />

              <div className="bod-card" style={{ padding: 0, overflowX: 'auto' }}>
                <table style={{ minWidth: '600px' }}>
                  <thead>
                    <tr><th>Tienda</th><th>Referencia</th><th>Talla</th><th>Color</th><th style={{ textAlign: 'center' }}>Cantidad</th><th></th></tr>
                  </thead>
                  <tbody>
                    {cargando && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>Cargando...</td></tr>}
                    {!cargando && visibles.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>Aún no hay nada contado.</td></tr>}
                    {visibles.map(c => (
                      <tr key={c.id}>
                        <td><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: colorTienda(c.tenant_id), marginRight: 6 }} />{nombreTienda(c.tenant_id)}</td>
                        <td><strong>{c.referencia}</strong>{c.producto_nombre && <div style={{ fontSize: '.78rem', color: '#64748b' }}>{c.producto_nombre}</div>}{c.ubicacion && <div style={{ fontSize: '.75rem', color: '#94a3b8' }}>📍 {c.ubicacion}</div>}</td>
                        <td>{c.talla || '—'}</td>
                        <td>{c.color || '—'}</td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button className="bod-step" style={{ width: 46, height: 46, fontSize: '1.4rem' }} onClick={() => ajustar(c, -1)}>−</button>
                          <input key={c.id + ':' + c.cantidad} type="number" inputMode="numeric" min={0} defaultValue={c.cantidad} onBlur={e => fijar(c, parseInt(e.target.value, 10))}
                            style={{ width: 70, textAlign: 'center', padding: '.5rem', margin: '0 4px', border: '2px solid #cbd5e1', borderRadius: 10, fontSize: '1.1rem', fontWeight: 700 }} />
                          <button className="bod-step" style={{ width: 46, height: 46, fontSize: '1.4rem' }} onClick={() => ajustar(c, 1)}>+</button>
                        </td>
                        <td><button onClick={() => eliminar(c)} aria-label="Eliminar" style={{ width: 46, height: 46, border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer' }}>🗑</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ color: '#64748b', fontSize: '.85rem', margin: '.6rem .2rem' }}>{visibles.length} líneas · {totalVisible} unidades</p>

              <button className="bod-big" onClick={enviarAprobacion} disabled={conteos.length === 0 || hayPendiente} style={{ background: '#0f766e', marginTop: '.4rem', opacity: conteos.length === 0 || hayPendiente ? 0.5 : 1 }}>
                {hayPendiente ? 'Hay un conteo esperando aprobación' : 'Terminar y enviar a aprobación'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
