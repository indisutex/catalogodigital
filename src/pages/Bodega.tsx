import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase, getTenantId } from '../lib/supabase';

interface Conteo {
  id: string;
  referencia: string;
  producto_nombre: string | null;
  talla: string;
  color: string;
  ubicacion: string;
  cantidad: number;
  contado_por: string | null;
  updated_at: string;
}

interface ProductoRef {
  referencia: string;
  nombre: string;
}

const FONT = "'Poppins', 'Inter', sans-serif";
const ACCENT = '#6366f1';

const input: React.CSSProperties = {
  width: '100%',
  padding: '0.7rem 0.8rem',
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  fontSize: '1rem',
  fontFamily: FONT,
  boxSizing: 'border-box',
  background: '#fff'
};

const label: React.CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 600,
  color: '#64748b',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.03em'
};

export default function Bodega() {
  const tenant = getTenantId();
  const authKey = `bodega_auth_${tenant}`;

  const [autenticado, setAutenticado] = useState(() => {
    try { return localStorage.getItem(authKey) === 'true'; } catch { return false; }
  });
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verificando, setVerificando] = useState(false);

  const [conteos, setConteos] = useState<Conteo[]>([]);
  const [productos, setProductos] = useState<ProductoRef[]>([]);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [filtro, setFiltro] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [nombreContador, setNombreContador] = useState(() => {
    try { return localStorage.getItem('bodega_contador') || ''; } catch { return ''; }
  });
  const [form, setForm] = useState({ referencia: '', talla: '', color: '', ubicacion: '', cantidad: '' });

  const mostrar = (tipo: 'ok' | 'error', texto: string) => {
    setAviso({ tipo, texto });
    window.setTimeout(() => setAviso(null), 3500);
  };

  async function cargar() {
    setCargando(true);
    const { data, error } = await supabase
      .from('bodega_conteos')
      .select('*')
      .eq('tenant_id', tenant)
      .order('updated_at', { ascending: false })
      .limit(5000);
    if (error) {
      mostrar('error', 'No se pudo cargar el conteo. ¿Ya creaste la tabla en Supabase?');
    } else {
      setConteos((data as Conteo[]) || []);
    }
    const { data: prods } = await supabase
      .from('productos')
      .select('referencia,nombre')
      .eq('tenant_id', tenant)
      .not('referencia', 'is', null)
      .limit(3000);
    setProductos(((prods as ProductoRef[]) || []).filter(p => p.referencia));
    setCargando(false);
  }

  useEffect(() => {
    if (autenticado) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autenticado]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setVerificando(true);
    setPinError('');
    const { data } = await supabase
      .from('configuracion')
      .select('*')
      .eq('tenant_id', tenant)
      .limit(1)
      .maybeSingle();
    const esperados = [data?.bodega_pin, data?.admin_pin]
      .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
      .map(p => p.trim());
    if (esperados.length === 0) esperados.push('0000');
    if (esperados.includes(pin.trim())) {
      try { localStorage.setItem(authKey, 'true'); } catch { /* sin almacenamiento */ }
      setAutenticado(true);
    } else {
      setPinError('PIN incorrecto');
    }
    setVerificando(false);
  }

  function salir() {
    try { localStorage.removeItem(authKey); } catch { /* sin almacenamiento */ }
    setAutenticado(false);
    setPin('');
  }

  const nombrePorRef = useMemo(() => {
    const m = new Map<string, string>();
    productos.forEach(p => m.set(p.referencia.trim().toLowerCase(), p.nombre));
    return m;
  }, [productos]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    const referencia = form.referencia.trim();
    const cantidad = parseInt(form.cantidad, 10);
    if (!referencia) return mostrar('error', 'Escribe la referencia');
    if (Number.isNaN(cantidad) || cantidad < 0) return mostrar('error', 'La cantidad debe ser 0 o mayor');

    setGuardando(true);
    const fila = {
      tenant_id: tenant,
      referencia,
      producto_nombre: nombrePorRef.get(referencia.toLowerCase()) || null,
      talla: form.talla.trim(),
      color: form.color.trim(),
      ubicacion: form.ubicacion.trim(),
      cantidad,
      contado_por: nombreContador.trim() || null,
      updated_at: new Date().toISOString()
    };
    const existente = conteos.find(c =>
      c.referencia === fila.referencia && c.talla === fila.talla &&
      c.color === fila.color && c.ubicacion === fila.ubicacion
    );
    const { error } = await supabase
      .from('bodega_conteos')
      .upsert(fila, { onConflict: 'tenant_id,referencia,talla,color,ubicacion' });
    setGuardando(false);
    if (error) return mostrar('error', 'No se pudo guardar: ' + error.message);
    mostrar('ok', existente ? 'Esa línea ya existía: se reemplazó la cantidad' : 'Conteo guardado');
    setForm(f => ({ ...f, referencia: '', talla: '', color: '', cantidad: '' }));
    cargar();
  }

  async function cambiarCantidad(c: Conteo, nueva: number) {
    if (Number.isNaN(nueva) || nueva < 0 || nueva === c.cantidad) return;
    const previo = conteos;
    setConteos(prev => prev.map(x => (x.id === c.id ? { ...x, cantidad: nueva } : x)));
    const { error } = await supabase
      .from('bodega_conteos')
      .update({ cantidad: nueva, contado_por: nombreContador.trim() || c.contado_por, updated_at: new Date().toISOString() })
      .eq('id', c.id)
      .eq('tenant_id', tenant);
    if (error) {
      setConteos(previo);
      mostrar('error', 'No se pudo actualizar');
    }
  }

  async function eliminar(c: Conteo) {
    if (!window.confirm(`¿Eliminar la línea ${c.referencia} ${c.talla} ${c.color}?`)) return;
    const { error } = await supabase.from('bodega_conteos').delete().eq('id', c.id).eq('tenant_id', tenant);
    if (error) return mostrar('error', 'No se pudo eliminar');
    setConteos(prev => prev.filter(x => x.id !== c.id));
  }

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return conteos;
    return conteos.filter(c =>
      [c.referencia, c.producto_nombre, c.talla, c.color, c.ubicacion].some(v => (v || '').toLowerCase().includes(q))
    );
  }, [conteos, filtro]);

  const totalUnidades = visibles.reduce((s, c) => s + c.cantidad, 0);

  function exportar() {
    const filas = visibles.map(c => ({
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
    XLSX.utils.book_append_sheet(wb, ws, 'Conteo');
    XLSX.writeFile(wb, `conteo_bodega_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const pagina: React.CSSProperties = { minHeight: '100vh', background: '#f1f5f9', fontFamily: FONT, color: '#0f172a' };

  if (!autenticado) {
    return (
      <div style={{ ...pagina, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <form onSubmit={entrar} style={{ background: '#fff', padding: '2rem', borderRadius: '18px', width: '100%', maxWidth: '340px', boxShadow: '0 10px 30px rgba(15,23,42,0.12)', textAlign: 'center' }}>
          <div style={{ fontSize: '2.2rem' }}>📦</div>
          <h1 style={{ fontSize: '1.3rem', margin: '0.4rem 0 0.2rem' }}>Conteo de bodega</h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 0 }}>Ingresa el PIN para continuar</p>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="PIN"
            style={{ ...input, textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.3rem' }}
          />
          {pinError && <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: '0.6rem 0 0' }}>{pinError}</p>}
          <button type="submit" disabled={verificando || !pin.trim()} style={{ marginTop: '1rem', width: '100%', padding: '0.8rem', border: 'none', borderRadius: '12px', background: ACCENT, color: '#fff', fontWeight: 600, fontSize: '1rem', fontFamily: FONT, cursor: 'pointer', opacity: verificando || !pin.trim() ? 0.6 : 1 }}>
            {verificando ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={pagina}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', position: 'sticky', top: 0, zIndex: 5 }}>
        <strong style={{ fontSize: '1.05rem' }}>📦 Conteo de bodega</strong>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={exportar} disabled={visibles.length === 0} style={btn('#059669')}>Excel</button>
          <button onClick={salir} style={btn('#64748b')}>Salir</button>
        </div>
      </header>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem' }}>
        {aviso && (
          <div style={{ marginBottom: '0.8rem', padding: '0.7rem 1rem', borderRadius: '10px', background: aviso.tipo === 'ok' ? '#dcfce7' : '#fee2e2', color: aviso.tipo === 'ok' ? '#166534' : '#991b1b', fontSize: '0.9rem', fontWeight: 500 }}>
            {aviso.texto}
          </div>
        )}

        <form onSubmit={agregar} style={{ background: '#fff', borderRadius: '16px', padding: '1rem', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.7rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={label}>Quién cuenta</span>
              <input
                style={input}
                value={nombreContador}
                onChange={e => {
                  setNombreContador(e.target.value);
                  try { localStorage.setItem('bodega_contador', e.target.value); } catch { /* sin almacenamiento */ }
                }}
                placeholder="Tu nombre"
              />
            </div>
            <div>
              <span style={label}>Referencia *</span>
              <input style={input} list="bodega-refs" value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })} placeholder="Ej: REF-001" />
              <datalist id="bodega-refs">
                {productos.map(p => <option key={p.referencia} value={p.referencia}>{p.nombre}</option>)}
              </datalist>
            </div>
            <div>
              <span style={label}>Talla</span>
              <input style={input} value={form.talla} onChange={e => setForm({ ...form, talla: e.target.value })} placeholder="S, M, L..." />
            </div>
            <div>
              <span style={label}>Color</span>
              <input style={input} value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} placeholder="Rojo" />
            </div>
            <div>
              <span style={label}>Ubicación</span>
              <input style={input} value={form.ubicacion} onChange={e => setForm({ ...form, ubicacion: e.target.value })} placeholder="Estante A2" />
            </div>
            <div>
              <span style={label}>Cantidad *</span>
              <input style={input} type="number" inputMode="numeric" min={0} value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} placeholder="0" />
            </div>
          </div>
          {form.referencia && nombrePorRef.get(form.referencia.trim().toLowerCase()) && (
            <p style={{ margin: '0.6rem 0 0', fontSize: '0.85rem', color: '#059669' }}>✔ {nombrePorRef.get(form.referencia.trim().toLowerCase())}</p>
          )}
          <button type="submit" disabled={guardando} style={{ ...btn(ACCENT), width: '100%', marginTop: '0.9rem', padding: '0.85rem', fontSize: '1rem', opacity: guardando ? 0.6 : 1 }}>
            {guardando ? 'Guardando...' : 'Guardar conteo'}
          </button>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
            Si repites referencia + talla + color + ubicación, la cantidad se reemplaza (no se suma).
          </p>
        </form>

        <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', marginBottom: '0.7rem', flexWrap: 'wrap' }}>
          <input style={{ ...input, flex: 1, minWidth: '180px' }} placeholder="Buscar referencia, talla, color..." value={filtro} onChange={e => setFiltro(e.target.value)} />
          <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
            {visibles.length} líneas · {totalUnidades} unidades
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '640px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                <th style={th}>Referencia</th>
                <th style={th}>Talla</th>
                <th style={th}>Color</th>
                <th style={th}>Ubicación</th>
                <th style={{ ...th, textAlign: 'center' }}>Cantidad</th>
                <th style={th}>Contó</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {cargando && <tr><td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>Cargando...</td></tr>}
              {!cargando && visibles.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>Aún no hay conteos.</td></tr>
              )}
              {visibles.map(c => (
                <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={td}>
                    <strong>{c.referencia}</strong>
                    {c.producto_nombre && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.producto_nombre}</div>}
                  </td>
                  <td style={td}>{c.talla || '—'}</td>
                  <td style={td}>{c.color || '—'}</td>
                  <td style={td}>{c.ubicacion || '—'}</td>
                  <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button onClick={() => cambiarCantidad(c, c.cantidad - 1)} style={mini}>−</button>
                    <input
                      key={c.id + ':' + c.cantidad}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      defaultValue={c.cantidad}
                      onBlur={e => cambiarCantidad(c, parseInt(e.target.value, 10))}
                      style={{ width: '64px', textAlign: 'center', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', fontFamily: FONT, margin: '0 4px' }}
                    />
                    <button onClick={() => cambiarCantidad(c, c.cantidad + 1)} style={mini}>+</button>
                  </td>
                  <td style={{ ...td, color: '#64748b', fontSize: '0.8rem' }}>{c.contado_por || '—'}</td>
                  <td style={td}><button onClick={() => eliminar(c)} style={{ ...mini, color: '#dc2626' }} aria-label="Eliminar">🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

const th: React.CSSProperties = { padding: '0.7rem 0.8rem', fontWeight: 600 };
const td: React.CSSProperties = { padding: '0.6rem 0.8rem', verticalAlign: 'middle' };
const mini: React.CSSProperties = { width: '34px', height: '34px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff', fontSize: '1.1rem', cursor: 'pointer', fontFamily: FONT };
function btn(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none', borderRadius: '10px', padding: '0.5rem 0.9rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', fontFamily: FONT };
}
