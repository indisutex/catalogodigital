import React, { useState, useEffect, useCallback } from 'react';
import {
  ERPTesoreriaService,
  type ERPCuentaBancaria,
  type ERPMovimientoTesoreria,
  type ERPCuentaPorCobrar,
  type ERPCuentaPorPagar,
  type ERPResumenTesoreria
} from '../../lib/erpTesoreriaService';
import './ERPTesoreriaModule.css';
import {
  Landmark, Wallet, TrendingUp, TrendingDown, DollarSign,
  Plus, RefreshCw, AlertCircle, Users, ShoppingCart,
  ArrowDownCircle, ArrowUpCircle,
  CheckCircle, AlertTriangle, CreditCard, Banknote
} from 'lucide-react';

interface Props { tenantId: string; }

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const hoy = () => new Date().toISOString().split('T')[0];

const CATEGORIAS_INGRESO = ['Venta', 'Cobro Cartera', 'Anticipo Cliente', 'Préstamo Recibido', 'Devolución', 'Otro Ingreso'];
const CATEGORIAS_EGRESO  = ['Arriendo', 'Servicios Públicos', 'Nómina y Salarios', 'Pago Proveedor', 'Transporte', 'Comisiones', 'Impuestos', 'Marketing', 'Otro Egreso'];
const METODOS            = ['Efectivo', 'Transferencia Bancaria', 'Nequi', 'Daviplata', 'Tarjeta'];
const TIPOS_CUENTA       = ['Caja', 'Cuenta Ahorros', 'Cuenta Corriente', 'Billetera Digital'];
const COLORES_CUENTA     = ['#6366f1','#10b981','#0284c7','#8b5cf6','#f59e0b','#ef4444','#ec4899','#06b6d4'];

type Tab = 'resumen' | 'ingresos' | 'egresos' | 'cxc' | 'cxp' | 'cuentas';

const badgeClass = (est: string) => {
  switch (est.toLowerCase()) {
    case 'pendiente': return 'pendiente';
    case 'parcial':   return 'parcial';
    case 'pagado':    return 'pagado';
    case 'vencido':   return 'vencido';
    default:          return 'pendiente';
  }
};

// ────────────────────────────────────────────────────────────
export const ERPTesoreriaModule: React.FC<Props> = ({ tenantId }) => {
  const [tab, setTab] = useState<Tab>('resumen');
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const [resumen, setResumen]   = useState<ERPResumenTesoreria | null>(null);
  const [cuentas, setCuentas]   = useState<ERPCuentaBancaria[]>([]);
  const [movimientos, setMovimientos] = useState<ERPMovimientoTesoreria[]>([]);
  const [cxcList, setCxcList]   = useState<ERPCuentaPorCobrar[]>([]);
  const [cxpList, setCxpList]   = useState<ERPCuentaPorPagar[]>([]);

  // Modales
  const [showMovModal, setShowMovModal] = useState(false);
  const [tipoMov, setTipoMov]   = useState<'Ingreso' | 'Egreso'>('Ingreso');
  const [showCxCModal, setShowCxCModal] = useState(false);
  const [showCxPModal, setShowCxPModal] = useState(false);
  const [showCuentaModal, setShowCuentaModal] = useState(false);
  const [showAbonoModal, setShowAbonoModal] = useState<{ tipo: 'CxC' | 'CxP'; id: string; nombre: string } | null>(null);

  // Formularios
  const emptyMov = { cuenta_id: '', categoria: 'Venta', concepto: '', referencia: '', monto: '', fecha: hoy(), metodo_pago: 'Efectivo', notas: '' };
  const emptyCxC = { cliente_nombre: '', concepto: '', fecha_emision: hoy(), fecha_vencimiento: '', monto_total: '', notas: '' };
  const emptyCxP = { proveedor_nombre: '', concepto: '', numero_factura: '', categoria: 'Proveedor', fecha_emision: hoy(), fecha_vencimiento: '', monto_total: '', notas: '' };
  const emptyCuenta = { nombre: '', tipo: 'Caja', banco: '', numero_cuenta: '', saldo_inicial: '0', color: '#6366f1', cuenta_puc: '110505' };

  const [movForm, setMovForm]       = useState(emptyMov);
  const [cxcForm, setCxcForm]       = useState(emptyCxC);
  const [cxpForm, setCxpForm]       = useState(emptyCxP);
  const [cuentaForm, setCuentaForm] = useState(emptyCuenta);
  const [abonoForm, setAbonoForm]   = useState({ monto: '', metodo_pago: 'Efectivo', notas: '' });

  const loadAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [res, ctas, movs, cxc, cxp] = await Promise.all([
        ERPTesoreriaService.fetchResumen(tenantId),
        ERPTesoreriaService.fetchCuentas(tenantId),
        ERPTesoreriaService.fetchMovimientos(tenantId),
        ERPTesoreriaService.fetchCxC(tenantId),
        ERPTesoreriaService.fetchCxP(tenantId)
      ]);
      setResumen(res); setCuentas(ctas); setMovimientos(movs);
      setCxcList(cxc); setCxpList(cxp);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Guardar movimiento ──
  const handleGuardarMov = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ERPTesoreriaService.registrarMovimiento({
        tenant_id: tenantId, tipo: tipoMov,
        cuenta_id: movForm.cuenta_id, categoria: movForm.categoria,
        concepto: movForm.concepto, referencia: movForm.referencia,
        monto: Number(movForm.monto), fecha: movForm.fecha, notas: movForm.notas
      });
      setShowMovModal(false); setMovForm(emptyMov); loadAll();
    } catch (e: any) { alert(e.message); }
  };

  // ── Guardar CxC ──
  const handleGuardarCxC = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ERPTesoreriaService.crearCxC({
        tenant_id: tenantId, cliente_nombre: cxcForm.cliente_nombre,
        concepto: cxcForm.concepto, fecha_emision: cxcForm.fecha_emision,
        fecha_vencimiento: cxcForm.fecha_vencimiento || undefined,
        monto_total: Number(cxcForm.monto_total), monto_pagado: 0,
        estado: 'Pendiente', notas: cxcForm.notas
      });
      setShowCxCModal(false); setCxcForm(emptyCxC); loadAll();
    } catch (e: any) { alert(e.message); }
  };

  // ── Guardar CxP ──
  const handleGuardarCxP = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ERPTesoreriaService.crearCxP({
        tenant_id: tenantId, proveedor_nombre: cxpForm.proveedor_nombre,
        concepto: cxpForm.concepto, numero_factura: cxpForm.numero_factura || undefined,
        categoria: cxpForm.categoria, fecha_emision: cxpForm.fecha_emision,
        fecha_vencimiento: cxpForm.fecha_vencimiento || undefined,
        monto_total: Number(cxpForm.monto_total), monto_pagado: 0,
        estado: 'Pendiente', notas: cxpForm.notas
      });
      setShowCxPModal(false); setCxpForm(emptyCxP); loadAll();
    } catch (e: any) { alert(e.message); }
  };

  // ── Guardar Cuenta Bancaria ──
  const handleGuardarCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ERPTesoreriaService.crearCuenta({
        tenant_id: tenantId, nombre: cuentaForm.nombre, tipo: cuentaForm.tipo,
        banco: cuentaForm.banco, numero_cuenta: cuentaForm.numero_cuenta,
        saldo_inicial: Number(cuentaForm.saldo_inicial),
        saldo_actual: Number(cuentaForm.saldo_inicial),
        activa: true, color: cuentaForm.color, cuenta_puc: cuentaForm.cuenta_puc
      });
      setShowCuentaModal(false); setCuentaForm(emptyCuenta); loadAll();
    } catch (e: any) { alert(e.message); }
  };

  // ── Registrar Abono ──
  const handleGuardarAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAbonoModal) return;
    try {
      await ERPTesoreriaService.registrarAbono({
        tenant_id: tenantId, tipo_documento: showAbonoModal.tipo,
        documento_id: showAbonoModal.id, fecha: hoy(),
        monto: Number(abonoForm.monto), metodo_pago: abonoForm.metodo_pago,
        notas: abonoForm.notas
      });
      setShowAbonoModal(null); setAbonoForm({ monto: '', metodo_pago: 'Efectivo', notas: '' });
      loadAll();
    } catch (e: any) { alert(e.message); }
  };

  const ingresos = movimientos.filter(m => m.tipo === 'Ingreso');
  const egresos  = movimientos.filter(m => m.tipo === 'Egreso');

  return (
    <div className="teso-container">

      {/* ── Header ── */}
      <div className="teso-header">
        <div>
          <h1><Landmark size={28} color="var(--primary-color,#6366f1)" /> Tesorería, Cartera y Proveedores</h1>
          <p>Control completo de caja, bancos, cuentas por cobrar y cuentas por pagar</p>
        </div>
        <button className="teso-btn teso-btn-ghost" onClick={loadAll}><RefreshCw size={15} /> Actualizar</button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="teso-kpi-grid">
        <div className="teso-kpi caja">
          <p className="teso-kpi-label"><Wallet size={13} /> Caja</p>
          <h2 className="teso-kpi-value">{resumen ? fmt(resumen.totalCajas) : '...'}</h2>
        </div>
        <div className="teso-kpi banco">
          <p className="teso-kpi-label"><Landmark size={13} /> Bancos</p>
          <h2 className="teso-kpi-value">{resumen ? fmt(resumen.totalBancos) : '...'}</h2>
        </div>
        <div className="teso-kpi digital">
          <p className="teso-kpi-label"><CreditCard size={13} /> Nequi / Digital</p>
          <h2 className="teso-kpi-value">{resumen ? fmt(resumen.totalBilleterasDigitales) : '...'}</h2>
        </div>
        <div className="teso-kpi cobrar">
          <p className="teso-kpi-label"><TrendingUp size={13} /> Por Cobrar</p>
          <h2 className="teso-kpi-value" style={{ color: '#d97706' }}>{resumen ? fmt(resumen.cuentasPorCobrar) : '...'}</h2>
        </div>
        <div className="teso-kpi pagar">
          <p className="teso-kpi-label"><TrendingDown size={13} /> Por Pagar</p>
          <h2 className="teso-kpi-value" style={{ color: '#dc2626' }}>{resumen ? fmt(resumen.cuentasPorPagar) : '...'}</h2>
        </div>
        <div className="teso-kpi neto">
          <p className="teso-kpi-label"><DollarSign size={13} /> Disponible Total</p>
          <h2 className="teso-kpi-value" style={{ color: '#059669' }}>{resumen ? fmt(resumen.totalDisponible) : '...'}</h2>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="teso-tabs">
        {([
          ['resumen',  <Wallet size={15} />,         'Resumen de Caja'],
          ['ingresos', <ArrowDownCircle size={15} />, 'Ingresos'],
          ['egresos',  <ArrowUpCircle size={15} />,   'Egresos / Gastos'],
          ['cxc',      <Users size={15} />,            'Cartera Clientes'],
          ['cxp',      <ShoppingCart size={15} />,     'Pagos Proveedores'],
          ['cuentas',  <Landmark size={15} />,         'Mis Cuentas'],
        ] as [Tab, React.ReactNode, string][]).map(([t, icon, label]) => (
          <button key={t} className={`teso-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {icon} {label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', color:'#991b1b', borderRadius:'12px', padding:'1rem', display:'flex', gap:'.5rem', marginBottom:'1rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* ════════════════════════════════
          TAB: RESUMEN DE CAJA
      ════════════════════════════════ */}
      {tab === 'resumen' && (
        <div className="teso-panel">
          <div className="teso-panel-header">
            <h3>💰 Saldo por Cuenta</h3>
            <button className="teso-btn teso-btn-primary" onClick={() => setShowCuentaModal(true)}>
              <Plus size={15} /> Nueva Cuenta
            </button>
          </div>

          {loading ? <p style={{ color:'#94a3b8', textAlign:'center', padding:'2rem' }}>Cargando cuentas...</p> :
          cuentas.length === 0 ? (
            <div className="teso-empty">
              <Landmark size={48} />
              <p>No hay cuentas registradas. Ejecuta primero el SQL de Fase 4 en Supabase.</p>
            </div>
          ) : (
            <div className="teso-cuentas-grid">
              {cuentas.map(c => (
                <div key={c.id} className="teso-cuenta-card">
                  <div className="teso-cuenta-card-accent" style={{ background: c.color }} />
                  <p className="teso-cuenta-tipo">{c.tipo}</p>
                  <p className="teso-cuenta-nombre">{c.nombre}</p>
                  {c.banco && <p style={{ fontSize:'.78rem', color:'#64748b', margin:'0 0 .5rem' }}>{c.banco}</p>}
                  <h3 className="teso-cuenta-saldo" style={{ color: c.color }}>
                    {fmt(Number(c.saldo_actual))}
                  </h3>
                  <p className="teso-cuenta-puc">PUC: {c.cuenta_puc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════
          TAB: INGRESOS
      ════════════════════════════════ */}
      {tab === 'ingresos' && (
        <div className="teso-panel">
          <div className="teso-panel-header">
            <h3>📥 Ingresos del Mes</h3>
            <button className="teso-btn teso-btn-success" onClick={() => { setTipoMov('Ingreso'); setMovForm({ ...emptyMov, categoria: 'Venta' }); setShowMovModal(true); }}>
              <Plus size={15} /> Registrar Ingreso
            </button>
          </div>

          {loading ? <p style={{ color:'#94a3b8', textAlign:'center', padding:'2rem' }}>Cargando...</p> :
          ingresos.length === 0 ? (
            <div className="teso-empty"><ArrowDownCircle size={48} /><p>No hay ingresos registrados este mes.</p></div>
          ) : (
            <>
              <table className="teso-table">
                <thead><tr>
                  <th>Fecha</th><th>Cuenta</th><th>Categoría</th><th>Concepto</th><th>Referencia</th>
                  <th style={{ textAlign:'right' }}>Monto</th>
                </tr></thead>
                <tbody>
                  {ingresos.map(m => (
                    <tr key={m.id}>
                      <td>{m.fecha}</td>
                      <td>{cuentas.find(c => c.id === m.cuenta_id)?.nombre || '-'}</td>
                      <td><span className="teso-badge ingreso">{m.categoria}</span></td>
                      <td style={{ fontWeight:600 }}>{m.concepto}</td>
                      <td style={{ color:'#64748b', fontFamily:'monospace' }}>{m.referencia || '-'}</td>
                      <td style={{ textAlign:'right' }} className="teso-ingreso">+{fmt(m.monto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr>
                  <td colSpan={5} style={{ textAlign:'right', fontWeight:700, padding:'.9rem 1rem', background:'#f0fdf4', color:'#0f172a', fontSize:'.88rem' }}>TOTAL INGRESOS DEL MES:</td>
                  <td style={{ textAlign:'right', fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:'1.1rem', color:'#059669', background:'#f0fdf4', padding:'.9rem 1rem' }}>
                    +{fmt(ingresos.reduce((s,m) => s + Number(m.monto), 0))}
                  </td>
                </tr></tfoot>
              </table>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════
          TAB: EGRESOS
      ════════════════════════════════ */}
      {tab === 'egresos' && (
        <div className="teso-panel">
          <div className="teso-panel-header">
            <h3>📤 Egresos y Gastos del Mes</h3>
            <button className="teso-btn teso-btn-danger" onClick={() => { setTipoMov('Egreso'); setMovForm({ ...emptyMov, categoria: 'Pago Proveedor' }); setShowMovModal(true); }}>
              <Plus size={15} /> Registrar Egreso
            </button>
          </div>

          {loading ? <p style={{ color:'#94a3b8', textAlign:'center', padding:'2rem' }}>Cargando...</p> :
          egresos.length === 0 ? (
            <div className="teso-empty"><ArrowUpCircle size={48} /><p>No hay egresos registrados este mes.</p></div>
          ) : (
            <table className="teso-table">
              <thead><tr>
                <th>Fecha</th><th>Cuenta</th><th>Categoría</th><th>Concepto</th>
                <th style={{ textAlign:'right' }}>Monto</th>
              </tr></thead>
              <tbody>
                {egresos.map(m => (
                  <tr key={m.id}>
                    <td>{m.fecha}</td>
                    <td>{cuentas.find(c => c.id === m.cuenta_id)?.nombre || '-'}</td>
                    <td><span className="teso-badge egreso">{m.categoria}</span></td>
                    <td style={{ fontWeight:600 }}>{m.concepto}</td>
                    <td style={{ textAlign:'right' }} className="teso-egreso">-{fmt(m.monto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr>
                <td colSpan={4} style={{ textAlign:'right', fontWeight:700, padding:'.9rem 1rem', background:'#fef2f2', color:'#0f172a', fontSize:'.88rem' }}>TOTAL EGRESOS DEL MES:</td>
                <td style={{ textAlign:'right', fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:'1.1rem', color:'#dc2626', background:'#fef2f2', padding:'.9rem 1rem' }}>
                  -{fmt(egresos.reduce((s,m) => s + Number(m.monto), 0))}
                </td>
              </tr></tfoot>
            </table>
          )}
        </div>
      )}

      {/* ════════════════════════════════
          TAB: CxC - CARTERA CLIENTES
      ════════════════════════════════ */}
      {tab === 'cxc' && (
        <div className="teso-panel">
          <div className="teso-panel-header">
            <h3>👥 Cuentas por Cobrar (Cartera)</h3>
            <button className="teso-btn teso-btn-primary" onClick={() => setShowCxCModal(true)}>
              <Plus size={15} /> Nueva Deuda Cliente
            </button>
          </div>

          {loading ? <p style={{ color:'#94a3b8', textAlign:'center', padding:'2rem' }}>Cargando cartera...</p> :
          cxcList.length === 0 ? (
            <div className="teso-empty"><Users size={48} /><p>No hay cuentas por cobrar registradas.</p></div>
          ) : (
            <table className="teso-table">
              <thead><tr>
                <th>Cliente</th><th>Concepto</th><th>Emisión</th><th>Vencimiento</th>
                <th>Estado</th><th>Pagado</th><th>Pendiente</th><th>Acción</th>
              </tr></thead>
              <tbody>
                {cxcList.map(c => {
                  const pct = c.monto_total > 0 ? (c.monto_pagado / c.monto_total) * 100 : 0;
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight:700 }}>{c.cliente_nombre}</td>
                      <td style={{ color:'#475569' }}>{c.concepto}</td>
                      <td>{c.fecha_emision}</td>
                      <td>{c.fecha_vencimiento || '-'}</td>
                      <td><span className={`teso-badge ${badgeClass(c.estado)}`}>{c.estado}</span></td>
                      <td>
                        <div>{fmt(c.monto_pagado)}</div>
                        <div className="teso-progress">
                          <div className="teso-progress-fill" style={{ width:`${pct}%`, background:'#10b981' }} />
                        </div>
                      </td>
                      <td style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, color:'#d97706' }}>
                        {fmt(c.saldo_pendiente ?? (c.monto_total - c.monto_pagado))}
                      </td>
                      <td>
                        {c.estado !== 'Pagado' && (
                          <button className="teso-btn teso-btn-success" style={{ padding:'.35rem .8rem', fontSize:'.8rem' }}
                            onClick={() => setShowAbonoModal({ tipo:'CxC', id: c.id!, nombre: c.cliente_nombre })}>
                            <CheckCircle size={13} /> Abonar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr>
                <td colSpan={6} style={{ textAlign:'right', fontWeight:700, padding:'.9rem 1rem', background:'#fefce8', fontSize:'.88rem' }}>TOTAL PENDIENTE POR COBRAR:</td>
                <td colSpan={2} style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:'1.1rem', color:'#d97706', background:'#fefce8', padding:'.9rem 1rem' }}>
                  {fmt(cxcList.reduce((s,c) => s + Number(c.saldo_pendiente ?? (c.monto_total - c.monto_pagado)), 0))}
                </td>
              </tr></tfoot>
            </table>
          )}
        </div>
      )}

      {/* ════════════════════════════════
          TAB: CxP - PAGOS A PROVEEDORES
      ════════════════════════════════ */}
      {tab === 'cxp' && (
        <div className="teso-panel">
          <div className="teso-panel-header">
            <h3>🏭 Cuentas por Pagar (Proveedores)</h3>
            <button className="teso-btn teso-btn-danger" onClick={() => setShowCxPModal(true)}>
              <Plus size={15} /> Nueva Obligación
            </button>
          </div>

          {loading ? <p style={{ color:'#94a3b8', textAlign:'center', padding:'2rem' }}>Cargando...</p> :
          cxpList.length === 0 ? (
            <div className="teso-empty"><ShoppingCart size={48} /><p>No hay cuentas por pagar registradas.</p></div>
          ) : (
            <table className="teso-table">
              <thead><tr>
                <th>Proveedor</th><th>Concepto</th><th>No. Factura</th><th>Vencimiento</th>
                <th>Estado</th><th>Pagado</th><th>Pendiente</th><th>Acción</th>
              </tr></thead>
              <tbody>
                {cxpList.map(c => {
                  const pct = c.monto_total > 0 ? (c.monto_pagado / c.monto_total) * 100 : 0;
                  const vencido = c.fecha_vencimiento && new Date(c.fecha_vencimiento) < new Date() && c.estado !== 'Pagado';
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight:700 }}>
                        {vencido && <AlertTriangle size={14} color="#ef4444" style={{ marginRight:4 }} />}
                        {c.proveedor_nombre}
                      </td>
                      <td style={{ color:'#475569' }}>{c.concepto}</td>
                      <td style={{ fontFamily:'monospace', color:'#6366f1' }}>{c.numero_factura || '-'}</td>
                      <td style={{ color: vencido ? '#dc2626' : 'inherit', fontWeight: vencido ? 700 : 400 }}>
                        {c.fecha_vencimiento || '-'}
                      </td>
                      <td><span className={`teso-badge ${badgeClass(vencido ? 'vencido' : c.estado)}`}>{vencido ? 'Vencido' : c.estado}</span></td>
                      <td>
                        <div>{fmt(c.monto_pagado)}</div>
                        <div className="teso-progress">
                          <div className="teso-progress-fill" style={{ width:`${pct}%`, background:'#6366f1' }} />
                        </div>
                      </td>
                      <td style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, color:'#dc2626' }}>
                        {fmt(c.saldo_pendiente ?? (c.monto_total - c.monto_pagado))}
                      </td>
                      <td>
                        {c.estado !== 'Pagado' && (
                          <button className="teso-btn teso-btn-ghost" style={{ padding:'.35rem .8rem', fontSize:'.8rem' }}
                            onClick={() => setShowAbonoModal({ tipo:'CxP', id: c.id!, nombre: c.proveedor_nombre })}>
                            <Banknote size={13} /> Pagar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr>
                <td colSpan={6} style={{ textAlign:'right', fontWeight:700, padding:'.9rem 1rem', background:'#fef2f2', fontSize:'.88rem' }}>TOTAL PENDIENTE POR PAGAR:</td>
                <td colSpan={2} style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:'1.1rem', color:'#dc2626', background:'#fef2f2', padding:'.9rem 1rem' }}>
                  {fmt(cxpList.reduce((s,c) => s + Number(c.saldo_pendiente ?? (c.monto_total - c.monto_pagado)), 0))}
                </td>
              </tr></tfoot>
            </table>
          )}
        </div>
      )}

      {/* ════════════════════════════════
          TAB: CUENTAS BANCARIAS
      ════════════════════════════════ */}
      {tab === 'cuentas' && (
        <div className="teso-panel">
          <div className="teso-panel-header">
            <h3>🏦 Administrar Cuentas y Cajas</h3>
            <button className="teso-btn teso-btn-primary" onClick={() => setShowCuentaModal(true)}>
              <Plus size={15} /> Nueva Cuenta
            </button>
          </div>
          {cuentas.length === 0 ? (
            <div className="teso-empty"><Landmark size={48} /><p>No hay cuentas. Ejecuta el SQL de Fase 4 en Supabase.</p></div>
          ) : (
            <table className="teso-table">
              <thead><tr><th>Nombre</th><th>Tipo</th><th>Banco</th><th>No. Cuenta</th><th>PUC</th><th style={{ textAlign:'right' }}>Saldo</th></tr></thead>
              <tbody>
                {cuentas.map(c => (
                  <tr key={c.id}>
                    <td><span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:c.color, marginRight:8 }} /><strong>{c.nombre}</strong></td>
                    <td>{c.tipo}</td>
                    <td>{c.banco || '-'}</td>
                    <td style={{ fontFamily:'monospace' }}>{c.numero_cuenta || '-'}</td>
                    <td><span style={{ background:'#f1f5f9', padding:'.2rem .5rem', borderRadius:6, fontFamily:'monospace', fontSize:'.8rem' }}>{c.cuenta_puc}</span></td>
                    <td style={{ textAlign:'right', fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:'1.05rem', color: Number(c.saldo_actual) >= 0 ? '#059669' : '#dc2626' }}>
                      {fmt(Number(c.saldo_actual))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ════════════════════════
          MODALES
      ════════════════════════ */}

      {/* Modal Ingreso / Egreso */}
      {showMovModal && (
        <div className="teso-modal-bg">
          <div className="teso-modal">
            <h3>{tipoMov === 'Ingreso' ? '📥 Registrar Ingreso' : '📤 Registrar Egreso / Gasto'}</h3>
            <form onSubmit={handleGuardarMov}>
              <div className="teso-form-grid">
                <div>
                  <label className="teso-form-label">Fecha:</label>
                  <input type="date" className="teso-input" value={movForm.fecha} onChange={e => setMovForm({...movForm, fecha: e.target.value})} required />
                </div>
                <div>
                  <label className="teso-form-label">Cuenta / Caja:</label>
                  <select className="teso-select" value={movForm.cuenta_id} onChange={e => setMovForm({...movForm, cuenta_id: e.target.value})} required>
                    <option value="">-- Seleccionar cuenta --</option>
                    {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="teso-form-label">Categoría:</label>
                  <select className="teso-select" value={movForm.categoria} onChange={e => setMovForm({...movForm, categoria: e.target.value})}>
                    {(tipoMov === 'Ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="teso-form-label">Monto ($): *</label>
                  <input type="number" className="teso-input" required min={1} placeholder="0" value={movForm.monto} onChange={e => setMovForm({...movForm, monto: e.target.value})} />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="teso-form-label">Descripción / Concepto: *</label>
                  <input type="text" className="teso-input" required placeholder="Ej: Pago arriendo julio..." value={movForm.concepto} onChange={e => setMovForm({...movForm, concepto: e.target.value})} />
                </div>
                <div>
                  <label className="teso-form-label">Referencia (pedido, factura...):</label>
                  <input type="text" className="teso-input" placeholder="Opcional" value={movForm.referencia} onChange={e => setMovForm({...movForm, referencia: e.target.value})} />
                </div>
                <div>
                  <label className="teso-form-label">Notas:</label>
                  <input type="text" className="teso-input" placeholder="Opcional" value={movForm.notas} onChange={e => setMovForm({...movForm, notas: e.target.value})} />
                </div>
              </div>
              <div style={{ display:'flex', gap:'.75rem', justifyContent:'flex-end', marginTop:'1.5rem' }}>
                <button type="button" className="teso-btn teso-btn-ghost" onClick={() => setShowMovModal(false)}>Cancelar</button>
                <button type="submit" className={`teso-btn ${tipoMov === 'Ingreso' ? 'teso-btn-success' : 'teso-btn-danger'}`}>
                  Guardar {tipoMov}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nueva CxC */}
      {showCxCModal && (
        <div className="teso-modal-bg">
          <div className="teso-modal">
            <h3>👥 Nueva Cuenta por Cobrar</h3>
            <form onSubmit={handleGuardarCxC}>
              <div className="teso-form-grid">
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="teso-form-label">Nombre del Cliente: *</label>
                  <input type="text" className="teso-input" required placeholder="Nombre del cliente..." value={cxcForm.cliente_nombre} onChange={e => setCxcForm({...cxcForm, cliente_nombre: e.target.value})} />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="teso-form-label">Concepto / Descripción: *</label>
                  <input type="text" className="teso-input" required placeholder="Ej: Saldo pendiente pedido #..." value={cxcForm.concepto} onChange={e => setCxcForm({...cxcForm, concepto: e.target.value})} />
                </div>
                <div>
                  <label className="teso-form-label">Fecha Emisión:</label>
                  <input type="date" className="teso-input" value={cxcForm.fecha_emision} onChange={e => setCxcForm({...cxcForm, fecha_emision: e.target.value})} />
                </div>
                <div>
                  <label className="teso-form-label">Fecha Vencimiento:</label>
                  <input type="date" className="teso-input" value={cxcForm.fecha_vencimiento} onChange={e => setCxcForm({...cxcForm, fecha_vencimiento: e.target.value})} />
                </div>
                <div>
                  <label className="teso-form-label">Monto Total ($): *</label>
                  <input type="number" className="teso-input" required min={1} placeholder="0" value={cxcForm.monto_total} onChange={e => setCxcForm({...cxcForm, monto_total: e.target.value})} />
                </div>
                <div>
                  <label className="teso-form-label">Notas:</label>
                  <input type="text" className="teso-input" placeholder="Opcional" value={cxcForm.notas} onChange={e => setCxcForm({...cxcForm, notas: e.target.value})} />
                </div>
              </div>
              <div style={{ display:'flex', gap:'.75rem', justifyContent:'flex-end', marginTop:'1.5rem' }}>
                <button type="button" className="teso-btn teso-btn-ghost" onClick={() => setShowCxCModal(false)}>Cancelar</button>
                <button type="submit" className="teso-btn teso-btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nueva CxP */}
      {showCxPModal && (
        <div className="teso-modal-bg">
          <div className="teso-modal">
            <h3>🏭 Nueva Obligación con Proveedor</h3>
            <form onSubmit={handleGuardarCxP}>
              <div className="teso-form-grid">
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="teso-form-label">Nombre del Proveedor: *</label>
                  <input type="text" className="teso-input" required placeholder="Nombre o empresa..." value={cxpForm.proveedor_nombre} onChange={e => setCxpForm({...cxpForm, proveedor_nombre: e.target.value})} />
                </div>
                <div>
                  <label className="teso-form-label">Categoría:</label>
                  <select className="teso-select" value={cxpForm.categoria} onChange={e => setCxpForm({...cxpForm, categoria: e.target.value})}>
                    {['Proveedor','Arriendo','Servicios Públicos','Nómina','Impuesto','Otro'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="teso-form-label">No. Factura / Referencia:</label>
                  <input type="text" className="teso-input" placeholder="Opcional" value={cxpForm.numero_factura} onChange={e => setCxpForm({...cxpForm, numero_factura: e.target.value})} />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="teso-form-label">Concepto: *</label>
                  <input type="text" className="teso-input" required placeholder="Ej: Compra tela ref. X..." value={cxpForm.concepto} onChange={e => setCxpForm({...cxpForm, concepto: e.target.value})} />
                </div>
                <div>
                  <label className="teso-form-label">Fecha Emisión:</label>
                  <input type="date" className="teso-input" value={cxpForm.fecha_emision} onChange={e => setCxpForm({...cxpForm, fecha_emision: e.target.value})} />
                </div>
                <div>
                  <label className="teso-form-label">Fecha Vencimiento (límite pago):</label>
                  <input type="date" className="teso-input" value={cxpForm.fecha_vencimiento} onChange={e => setCxpForm({...cxpForm, fecha_vencimiento: e.target.value})} />
                </div>
                <div>
                  <label className="teso-form-label">Monto Total ($): *</label>
                  <input type="number" className="teso-input" required min={1} placeholder="0" value={cxpForm.monto_total} onChange={e => setCxpForm({...cxpForm, monto_total: e.target.value})} />
                </div>
                <div>
                  <label className="teso-form-label">Notas:</label>
                  <input type="text" className="teso-input" placeholder="Opcional" value={cxpForm.notas} onChange={e => setCxpForm({...cxpForm, notas: e.target.value})} />
                </div>
              </div>
              <div style={{ display:'flex', gap:'.75rem', justifyContent:'flex-end', marginTop:'1.5rem' }}>
                <button type="button" className="teso-btn teso-btn-ghost" onClick={() => setShowCxPModal(false)}>Cancelar</button>
                <button type="submit" className="teso-btn teso-btn-danger">Registrar Obligación</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nueva Cuenta Bancaria */}
      {showCuentaModal && (
        <div className="teso-modal-bg">
          <div className="teso-modal">
            <h3>🏦 Nueva Cuenta / Caja</h3>
            <form onSubmit={handleGuardarCuenta}>
              <div className="teso-form-grid">
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="teso-form-label">Nombre de la Cuenta: *</label>
                  <input type="text" className="teso-input" required placeholder="Ej: Bancolombia Ahorros..." value={cuentaForm.nombre} onChange={e => setCuentaForm({...cuentaForm, nombre: e.target.value})} />
                </div>
                <div>
                  <label className="teso-form-label">Tipo:</label>
                  <select className="teso-select" value={cuentaForm.tipo} onChange={e => setCuentaForm({...cuentaForm, tipo: e.target.value})}>
                    {TIPOS_CUENTA.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="teso-form-label">Banco (si aplica):</label>
                  <input type="text" className="teso-input" placeholder="Bancolombia, Davivienda..." value={cuentaForm.banco} onChange={e => setCuentaForm({...cuentaForm, banco: e.target.value})} />
                </div>
                <div>
                  <label className="teso-form-label">No. de Cuenta:</label>
                  <input type="text" className="teso-input" placeholder="Opcional" value={cuentaForm.numero_cuenta} onChange={e => setCuentaForm({...cuentaForm, numero_cuenta: e.target.value})} />
                </div>
                <div>
                  <label className="teso-form-label">Saldo Inicial ($):</label>
                  <input type="number" className="teso-input" min={0} value={cuentaForm.saldo_inicial} onChange={e => setCuentaForm({...cuentaForm, saldo_inicial: e.target.value})} />
                </div>
                <div>
                  <label className="teso-form-label">Cuenta PUC:</label>
                  <select className="teso-select" value={cuentaForm.cuenta_puc} onChange={e => setCuentaForm({...cuentaForm, cuenta_puc: e.target.value})}>
                    <option value="110505">110505 - Caja General</option>
                    <option value="110510">110510 - Caja Menor</option>
                    <option value="111005">111005 - Bancos Nacionales</option>
                    <option value="110515">110515 - Bancos Digitales</option>
                  </select>
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="teso-form-label">Color identificador:</label>
                  <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap', marginTop:'.25rem' }}>
                    {COLORES_CUENTA.map(col => (
                      <button key={col} type="button"
                        style={{ width:32, height:32, borderRadius:8, background:col, border: cuentaForm.color === col ? '3px solid #0f172a' : '2px solid transparent', cursor:'pointer' }}
                        onClick={() => setCuentaForm({...cuentaForm, color: col})}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:'.75rem', justifyContent:'flex-end', marginTop:'1.5rem' }}>
                <button type="button" className="teso-btn teso-btn-ghost" onClick={() => setShowCuentaModal(false)}>Cancelar</button>
                <button type="submit" className="teso-btn teso-btn-primary">Crear Cuenta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Abono */}
      {showAbonoModal && (
        <div className="teso-modal-bg">
          <div className="teso-modal">
            <h3>{showAbonoModal.tipo === 'CxC' ? '✅ Registrar Pago de Cliente' : '💸 Registrar Pago a Proveedor'}</h3>
            <p style={{ color:'#475569', marginBottom:'1.25rem', fontSize:'.9rem' }}>
              {showAbonoModal.tipo === 'CxC' ? '👤' : '🏭'} <strong>{showAbonoModal.nombre}</strong>
            </p>
            <form onSubmit={handleGuardarAbono}>
              <div className="teso-form-grid">
                <div>
                  <label className="teso-form-label">Monto del Abono ($): *</label>
                  <input type="number" className="teso-input" required min={1} placeholder="0"
                    value={abonoForm.monto} onChange={e => setAbonoForm({...abonoForm, monto: e.target.value})} />
                </div>
                <div>
                  <label className="teso-form-label">Método de Pago:</label>
                  <select className="teso-select" value={abonoForm.metodo_pago} onChange={e => setAbonoForm({...abonoForm, metodo_pago: e.target.value})}>
                    {METODOS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="teso-form-label">Notas:</label>
                  <input type="text" className="teso-input" placeholder="Opcional..." value={abonoForm.notas} onChange={e => setAbonoForm({...abonoForm, notas: e.target.value})} />
                </div>
              </div>
              <div style={{ display:'flex', gap:'.75rem', justifyContent:'flex-end', marginTop:'1.5rem' }}>
                <button type="button" className="teso-btn teso-btn-ghost" onClick={() => setShowAbonoModal(null)}>Cancelar</button>
                <button type="submit" className="teso-btn teso-btn-success">Registrar Pago</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
