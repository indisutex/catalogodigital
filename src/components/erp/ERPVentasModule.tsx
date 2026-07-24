import React, { useState, useEffect, useCallback } from 'react';
import { ERPVentasService, type ERPResumenFinanciero, type ERPEgreso } from '../../lib/erpVentasService';
import type { Pedido } from '../../types';
import './ERPVentasModule.css';
import {
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Plus,
  RefreshCw,
  Download,
  BarChart2,
  ClipboardList,
  CreditCard,
  AlertCircle,
  Star,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  tenantId: string;
}

const CATEGORIAS_EGRESO = [
  'Arriendo', 'Servicios Públicos', 'Nómina y Salarios', 'Transporte y Envíos',
  'Marketing y Publicidad', 'Comisiones Asesores', 'Compra de Mercancía',
  'Suministros de Oficina', 'Mantenimiento', 'Impuestos', 'Otro'
];

const METODOS_PAGO = ['Efectivo', 'Transferencia Bancaria', 'Nequi', 'Daviplata', 'Tarjeta Débito', 'Tarjeta Crédito'];

const estadoClass = (e?: string) => {
  switch ((e || '').toLowerCase()) {
    case 'aprobado': return 'estado-aprobado';
    case 'pagado': return 'estado-pagado';
    case 'enviado': return 'estado-enviado';
    case 'entregado': return 'estado-entregado';
    default: return 'estado-pendiente';
  }
};

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

export const ERPVentasModule: React.FC<Props> = ({ tenantId }) => {
  const [tab, setTab] = useState<'dashboard' | 'ventas' | 'egresos' | 'productos'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [resumen, setResumen] = useState<ERPResumenFinanciero | null>(null);
  const [ventas, setVentas] = useState<Pedido[]>([]);
  const [egresos, setEgresos] = useState<ERPEgreso[]>([]);
  const [topProductos, setTopProductos] = useState<{ nombre: string; cantidad: number; total: number }[]>([]);

  const [showEgresoModal, setShowEgresoModal] = useState(false);
  const [egresoForm, setEgresoForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    categoria: 'Transporte y Envíos',
    concepto: '',
    proveedor_nombre: '',
    monto: '',
    metodo_pago: 'Efectivo',
    notas: ''
  });

  // Filtros de fecha
  const now = new Date();
  const [desde, setDesde] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
  const [hasta, setHasta] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, vent, egr, top] = await Promise.all([
        ERPVentasService.fetchResumenFinanciero(tenantId),
        ERPVentasService.fetchVentasReales(tenantId, desde, hasta),
        ERPVentasService.fetchEgresos(tenantId, desde, hasta),
        ERPVentasService.fetchTopProductos(tenantId)
      ]);
      setResumen(res);
      setVentas(vent);
      setEgresos(egr);
      setTopProductos(top);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId, desde, hasta]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleGuardarEgreso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!egresoForm.concepto || !egresoForm.monto) return;
    try {
      await ERPVentasService.registrarEgreso({
        tenant_id: tenantId,
        fecha: egresoForm.fecha,
        categoria: egresoForm.categoria,
        concepto: egresoForm.concepto,
        proveedor_nombre: egresoForm.proveedor_nombre,
        monto: Number(egresoForm.monto),
        metodo_pago: egresoForm.metodo_pago,
        notas: egresoForm.notas
      });
      setShowEgresoModal(false);
      setEgresoForm({ fecha: new Date().toISOString().split('T')[0], categoria: 'Transporte y Envíos', concepto: '', proveedor_nombre: '', monto: '', metodo_pago: 'Efectivo', notas: '' });
      loadAll();
    } catch (err: any) { alert(err.message); }
  };

  const exportarVentasExcel = () => {
    const ws = XLSX.utils.json_to_sheet(ventas.map(v => ({
      Fecha: v.created_at?.split('T')[0],
      'No. Pedido': v.id.substring(0, 8).toUpperCase(),
      Cliente: v.cliente_nombre,
      Teléfono: v.cliente_telefono,
      Ciudad: v.ciudad,
      Total: v.total,
      Estado: v.estado || 'aprobado'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
    XLSX.writeFile(wb, `Ventas_${tenantId}_${desde}_${hasta}.xlsx`);
  };

  const exportarEgresosExcel = () => {
    const ws = XLSX.utils.json_to_sheet(egresos.map(eg => ({
      Fecha: eg.fecha,
      Categoría: eg.categoria,
      Concepto: eg.concepto,
      Proveedor: eg.proveedor_nombre || '-',
      Monto: eg.monto,
      'Método de Pago': eg.metodo_pago
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Egresos');
    XLSX.writeFile(wb, `Egresos_${tenantId}_${desde}_${hasta}.xlsx`);
  };

  // Máximo de ventas para escalar las barras
  const maxBar = resumen ? Math.max(...resumen.ventasPorDia.map(v => v.total_ventas), 1) : 1;

  return (
    <div className="erp-ventas-container">
      {/* Encabezado */}
      <div className="erp-ventas-header">
        <div>
          <h1><TrendingUp size={28} color="var(--primary-color, #6366f1)" /> Ventas, Ingresos y Egresos</h1>
          <p>Control financiero completo · Ventas reales desde tus pedidos aprobados</p>
        </div>
        <button className="erp-btn erp-btn-ghost" onClick={loadAll}>
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="erp-kpi-grid">
        <div className="erp-kpi-card ventas">
          <p className="erp-kpi-label"><TrendingUp size={14} /> Ventas del Mes</p>
          <h2 className="erp-kpi-value">{resumen ? fmt(resumen.totalVentasMes) : '...'}</h2>
          <p className="erp-kpi-sub">{resumen?.pedidosMes ?? 0} pedidos aprobados</p>
          <span className="erp-kpi-today" style={{ background: '#ede9fe', color: '#6d28d9' }}>
            Hoy: {resumen ? fmt(resumen.totalVentasHoy) : '-'}
          </span>
        </div>

        <div className="erp-kpi-card gastos">
          <p className="erp-kpi-label"><TrendingDown size={14} /> Gastos del Mes</p>
          <h2 className="erp-kpi-value">{resumen ? fmt(resumen.totalEgresosMes) : '...'}</h2>
          <p className="erp-kpi-sub">{egresos.length} registros de egreso</p>
          <span className="erp-kpi-today" style={{ background: '#fee2e2', color: '#b91c1c' }}>
            Hoy: {resumen ? fmt(resumen.totalEgresosHoy) : '-'}
          </span>
        </div>

        <div className="erp-kpi-card utilidad">
          <p className="erp-kpi-label"><DollarSign size={14} /> Ganancia del Mes</p>
          <h2 className="erp-kpi-value" style={{ color: (resumen?.utilidadMes ?? 0) >= 0 ? '#059669' : '#dc2626' }}>
            {resumen ? fmt(resumen.utilidadMes) : '...'}
          </h2>
          <p className="erp-kpi-sub">Ventas − Gastos registrados</p>
          <span className="erp-kpi-today" style={{ background: '#d1fae5', color: '#065f46' }}>
            Hoy: {resumen ? fmt(resumen.utilidadHoy) : '-'}
          </span>
        </div>

        <div className="erp-kpi-card pedidos">
          <p className="erp-kpi-label"><ShoppingBag size={14} /> Ticket Promedio</p>
          <h2 className="erp-kpi-value">{resumen ? fmt(resumen.ticketPromedio) : '...'}</h2>
          <p className="erp-kpi-sub">Por pedido este mes</p>
          <span className="erp-kpi-today" style={{ background: '#fef3c7', color: '#92400e' }}>
            Hoy: {resumen?.pedidosHoy ?? 0} pedidos
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="erp-ventas-tabs">
        <button className={`erp-ventas-tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          <BarChart2 size={16} /> Gráfico del Mes
        </button>
        <button className={`erp-ventas-tab ${tab === 'ventas' ? 'active' : ''}`} onClick={() => setTab('ventas')}>
          <ClipboardList size={16} /> Historial de Ventas
        </button>
        <button className={`erp-ventas-tab ${tab === 'egresos' ? 'active' : ''}`} onClick={() => setTab('egresos')}>
          <CreditCard size={16} /> Gastos y Egresos
        </button>
        <button className={`erp-ventas-tab ${tab === 'productos' ? 'active' : ''}`} onClick={() => setTab('productos')}>
          <Star size={16} /> Top Productos
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '12px', padding: '1rem', display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* ── Tab: Dashboard Gráfico ── */}
      {tab === 'dashboard' && (
        <div className="erp-panel">
          <div className="erp-panel-header">
            <h3>📊 Ventas Diarias del Mes</h3>
            <div className="erp-filtros">
              <label style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Desde:</label>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
              <label style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Hasta:</label>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>Cargando datos de ventas...</p>
          ) : resumen && resumen.ventasPorDia.length > 0 ? (
            <>
              <div className="erp-bar-chart">
                {resumen.ventasPorDia.map(dia => (
                  <div key={dia.fecha} className="erp-bar-item" title={`${dia.fecha}: ${fmt(dia.total_ventas)}`}>
                    <div
                      className="erp-bar-fill"
                      style={{ height: `${Math.max(4, (dia.total_ventas / maxBar) * 90)}px` }}
                    />
                    <span className="erp-bar-label">{dia.fecha.split('-')[2]}</span>
                  </div>
                ))}
              </div>

              <table className="erp-ventas-table" style={{ marginTop: '1.5rem' }}>
                <thead>
                  <tr>
                    <th>📅 Fecha</th>
                    <th># Pedidos</th>
                    <th>Ticket Promedio</th>
                    <th style={{ textAlign: 'right' }}>Total del Día</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.ventasPorDia.slice().reverse().map(dia => (
                    <tr key={dia.fecha}>
                      <td><strong>{dia.fecha}</strong></td>
                      <td>{dia.cantidad_pedidos} pedidos</td>
                      <td>{fmt(dia.ticket_promedio)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#6366f1', fontFamily: 'Outfit, sans-serif' }}>{fmt(dia.total_ventas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div className="erp-empty">
              <BarChart2 size={48} />
              <p>No hay ventas aprobadas en el periodo seleccionado.<br />Las ventas se registran automáticamente al aprobar pedidos.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Historial de Ventas ── */}
      {tab === 'ventas' && (
        <div className="erp-panel">
          <div className="erp-panel-header">
            <h3>🛍️ Historial de Ventas</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div className="erp-filtros">
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
                <span style={{ color: '#94a3b8' }}>→</span>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
              </div>
              <button className="erp-btn erp-btn-ghost" onClick={exportarVentasExcel}>
                <Download size={15} /> Excel
              </button>
            </div>
          </div>

          {loading ? (
            <p style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>Cargando historial de ventas...</p>
          ) : ventas.length === 0 ? (
            <div className="erp-empty">
              <Package size={48} />
              <p>No hay ventas aprobadas en el periodo.<br />Si ya tienes ventas anteriores, ejecuta primero el script de migración en Supabase.</p>
            </div>
          ) : (
            <table className="erp-ventas-table">
              <thead>
                <tr>
                  <th># Pedido</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Ciudad</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map(v => (
                  <tr key={v.id}>
                    <td><strong style={{ fontFamily: 'monospace', color: '#6366f1' }}>{v.id.substring(0, 8).toUpperCase()}</strong></td>
                    <td>{v.created_at?.split('T')[0]}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{v.cliente_nombre}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{v.cliente_telefono}</div>
                    </td>
                    <td>{v.ciudad}</td>
                    <td>
                      <span className={`erp-estado-badge ${estadoClass(v.estado)}`}>
                        {v.estado || 'Aprobado'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: '#059669' }}>
                      {fmt(v.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, padding: '0.9rem 1rem', background: '#f8fafc', color: '#0f172a', fontSize: '0.88rem' }}>
                    TOTAL PERIODO ({ventas.length} pedidos):
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: '#6366f1', background: '#f8fafc', padding: '0.9rem 1rem' }}>
                    {fmt(ventas.reduce((s, v) => s + Number(v.total), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* ── Tab: Egresos / Gastos ── */}
      {tab === 'egresos' && (
        <div className="erp-panel">
          <div className="erp-panel-header">
            <h3>💸 Gastos y Egresos Operativos</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="erp-btn erp-btn-ghost" onClick={exportarEgresosExcel}>
                <Download size={15} /> Excel
              </button>
              <button className="erp-btn erp-btn-primary-v" onClick={() => setShowEgresoModal(true)}>
                <Plus size={16} /> Registrar Gasto
              </button>
            </div>
          </div>

          {loading ? (
            <p style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>Cargando gastos...</p>
          ) : egresos.length === 0 ? (
            <div className="erp-empty">
              <FileText size={48} />
              <p>No hay gastos registrados en el mes.<br />Registra tus gastos: arriendo, servicios, transporte, comisiones, etc.</p>
            </div>
          ) : (
            <table className="erp-ventas-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoría</th>
                  <th>Concepto / Detalle</th>
                  <th>Proveedor</th>
                  <th>Método Pago</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {egresos.map(eg => (
                  <tr key={eg.id}>
                    <td>{eg.fecha}</td>
                    <td><span style={{ background: '#fef3c7', color: '#b45309', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>{eg.categoria}</span></td>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{eg.concepto}</td>
                    <td style={{ color: '#64748b' }}>{eg.proveedor_nombre || '-'}</td>
                    <td>{eg.metodo_pago}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'Outfit, sans-serif', fontWeight: 800, color: '#dc2626', fontSize: '1rem' }}>
                      -{fmt(eg.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, padding: '0.9rem 1rem', background: '#fef2f2', color: '#0f172a', fontSize: '0.88rem' }}>
                    TOTAL GASTOS DEL PERIODO:
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: '#dc2626', background: '#fef2f2', padding: '0.9rem 1rem' }}>
                    -{fmt(egresos.reduce((s, e) => s + Number(e.monto), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* ── Tab: Top Productos ── */}
      {tab === 'productos' && (
        <div className="erp-panel">
          <div className="erp-panel-header">
            <h3>⭐ Productos Más Vendidos del Mes</h3>
          </div>

          {loading ? (
            <p style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>Analizando ventas...</p>
          ) : topProductos.length === 0 ? (
            <div className="erp-empty">
              <Package size={48} />
              <p>No hay datos de productos este mes.</p>
            </div>
          ) : (
            topProductos.map((prod, idx) => (
              <div key={prod.nombre} className="erp-top-producto">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    background: idx === 0 ? '#fef3c7' : idx === 1 ? '#f1f5f9' : '#f8fafc',
                    color: idx === 0 ? '#d97706' : '#64748b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '0.9rem', flexShrink: 0
                  }}>
                    #{idx + 1}
                  </span>
                  <div>
                    <div className="erp-top-producto-nombre">{prod.nombre}</div>
                    <div className="erp-top-producto-meta">{prod.cantidad} unidades vendidas</div>
                  </div>
                </div>
                <div className="erp-top-producto-total">{fmt(prod.total)}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Modal: Registrar Egreso ── */}
      {showEgresoModal && (
        <div className="erp-modal-bg">
          <div className="erp-modal-box">
            <h3>💸 Registrar Gasto / Egreso</h3>
            <form onSubmit={handleGuardarEgreso}>
              <div className="erp-egreso-grid">
                <div>
                  <label className="erp-form-label">Fecha del Gasto:</label>
                  <input type="date" className="erp-input" value={egresoForm.fecha} onChange={e => setEgresoForm({ ...egresoForm, fecha: e.target.value })} required />
                </div>
                <div>
                  <label className="erp-form-label">Categoría:</label>
                  <select className="erp-select" value={egresoForm.categoria} onChange={e => setEgresoForm({ ...egresoForm, categoria: e.target.value })}>
                    {CATEGORIAS_EGRESO.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="erp-form-label">Descripción / Concepto: *</label>
                  <input type="text" className="erp-input" required placeholder="Ej: Pago servicio de mensajería Julio..." value={egresoForm.concepto} onChange={e => setEgresoForm({ ...egresoForm, concepto: e.target.value })} />
                </div>
                <div>
                  <label className="erp-form-label">Proveedor / A quién se le pagó:</label>
                  <input type="text" className="erp-input" placeholder="Nombre del proveedor..." value={egresoForm.proveedor_nombre} onChange={e => setEgresoForm({ ...egresoForm, proveedor_nombre: e.target.value })} />
                </div>
                <div>
                  <label className="erp-form-label">Monto ($ pesos): *</label>
                  <input type="number" className="erp-input" required placeholder="0" min="1" value={egresoForm.monto} onChange={e => setEgresoForm({ ...egresoForm, monto: e.target.value })} />
                </div>
                <div>
                  <label className="erp-form-label">Método de Pago:</label>
                  <select className="erp-select" value={egresoForm.metodo_pago} onChange={e => setEgresoForm({ ...egresoForm, metodo_pago: e.target.value })}>
                    {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="erp-form-label">Notas adicionales:</label>
                  <input type="text" className="erp-input" placeholder="(Opcional)" value={egresoForm.notas} onChange={e => setEgresoForm({ ...egresoForm, notas: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="erp-btn erp-btn-ghost" onClick={() => setShowEgresoModal(false)}>Cancelar</button>
                <button type="submit" className="erp-btn erp-btn-primary-v">Guardar Gasto</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
