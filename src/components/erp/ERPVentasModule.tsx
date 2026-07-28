import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ERPVentasService, type ERPResumenFinanciero, type ERPEgreso } from '../../lib/erpVentasService';
import type { Pedido, Asesor } from '../../types';
import './ERPVentasModule.css';
import { ERPTesoreriaService, type ERPCuentaBancaria } from '../../lib/erpTesoreriaService';

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
  FileText,
  Eye,
  Printer,
  X,
  User,
  Phone,
  MapPin,
  Calendar
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
  const [cuentasTesoreria, setCuentasTesoreria] = useState<ERPCuentaBancaria[]>([]);
  const [metodosPagoList, setMetodosPagoList] = useState<string[]>(METODOS_PAGO);
  const [asesoresList, setAsesoresList] = useState<Asesor[]>([]);

  // Filtros de ventas por origen y asesor
  const [origenFilter, setOrigenFilter] = useState<'todos' | 'pos' | 'catalogo'>('todos');
  const [asesorFilter, setAsesorFilter] = useState<string>('todos');

  // Modal para ver factura detallada de un pedido
  const [selectedVentaModal, setSelectedVentaModal] = useState<Pedido | null>(null);

  const [showEgresoModal, setShowEgresoModal] = useState(false);
  const [egresoForm, setEgresoForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    categoria: 'Transporte y Envíos',
    concepto: '',
    proveedor_nombre: '',
    monto: '',
    metodo_pago: 'Efectivo',
    cuenta_id: '',
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
      const [res, vent, egr, top, ctas] = await Promise.all([
        ERPVentasService.fetchResumenFinanciero(tenantId),
        ERPVentasService.fetchVentasReales(tenantId, desde, hasta),
        ERPVentasService.fetchEgresos(tenantId, desde, hasta),
        ERPVentasService.fetchTopProductos(tenantId),
        ERPTesoreriaService.fetchCuentas(tenantId).catch(() => [])
      ]);
      setResumen(res);
      setVentas(vent);
      setEgresos(egr);
      setTopProductos(top);
      setCuentasTesoreria(ctas);

      // Cargar asesores de la tienda
      try {
        const { data: asData } = await supabase.from('asesores').select('*').eq('tenant_id', tenantId);
        if (asData) setAsesoresList(asData);
      } catch (_) {}

      // Cargar métodos de pago de la configuración del negocio
      try {
        const { data: configObj } = await supabase.from('configuracion').select('metodos_pago').eq('tenant_id', tenantId).maybeSingle();
        if (configObj?.metodos_pago) {
          const raw = typeof configObj.metodos_pago === 'string' ? JSON.parse(configObj.metodos_pago) : configObj.metodos_pago;
          if (Array.isArray(raw)) {
            const customList: string[] = raw.map((m: any) => {
              if (typeof m === 'string') return m;
              return m.banco ? `${m.banco}${m.tipo ? ` (${m.tipo})` : ''}${m.numero ? ` - ${m.numero}` : ''}` : null;
            }).filter((m): m is string => Boolean(m));
            if (customList.length > 0) {
              setMetodosPagoList(Array.from(new Set([...customList, ...METODOS_PAGO])));
            }
          }
        }
      } catch (_) {}
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId, desde, hasta]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Resolver nombre de Asesor y Canal (POS / Catálogo)
  const getVentaAsesorInfo = (v: Pedido) => {
    const isPos = v.origen === 'pos' || (Boolean(v.linea_whatsapp) && v.linea_whatsapp.startsWith('pos'));
    let asesorNombre = '';
    if (v.linea_whatsapp && v.linea_whatsapp.startsWith('pos_')) {
      asesorNombre = v.linea_whatsapp.replace('pos_', '');
    } else if (v.linea_whatsapp === 'pos') {
      asesorNombre = 'Caja Directa';
    } else if (v.linea_whatsapp) {
      const matched = asesoresList.find(a => a.telefono === v.linea_whatsapp);
      asesorNombre = matched ? matched.nombre : `Línea ${v.linea_whatsapp}`;
    } else {
      asesorNombre = 'Caja General';
    }
    return { isPos, asesorNombre };
  };

  const filteredVentas = ventas.filter(v => {
    const info = getVentaAsesorInfo(v);
    if (origenFilter === 'pos' && !info.isPos) return false;
    if (origenFilter === 'catalogo' && info.isPos) return false;
    if (asesorFilter !== 'todos' && info.asesorNombre.toLowerCase() !== asesorFilter.toLowerCase()) return false;
    return true;
  });

  const exportarVentasExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredVentas.map(v => {
      const info = getVentaAsesorInfo(v);
      return {
        Fecha: v.created_at?.split('T')[0],
        'No. Pedido': v.id.substring(0, 8).toUpperCase(),
        Cliente: v.cliente_nombre,
        Teléfono: v.cliente_telefono,
        Ciudad: v.ciudad,
        Canal: info.isPos ? 'POS' : 'Catálogo Digital',
        Asesor: info.asesorNombre,
        Total: v.total,
        Estado: v.estado || 'aprobado'
      };
    }));
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
          <h1><TrendingUp size={28} color="var(--primary-color, #6366f1)" /> Ventas, Facturación y Rendimiento Comercial</h1>
          <p>Supervisión comercial de ventas reales y pedidos facturados</p>
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
          <p className="erp-kpi-label"><TrendingDown size={14} /> Gastos de Operación</p>
          <h2 className="erp-kpi-value">{resumen ? fmt(resumen.totalEgresosMes) : '...'}</h2>
          <p className="erp-kpi-sub">{egresos.length} egresos registrados</p>
          <span className="erp-kpi-today" style={{ background: '#fee2e2', color: '#b91c1c' }}>
            Hoy: {resumen ? fmt(resumen.totalEgresosHoy) : '-'}
          </span>
        </div>

        <div className="erp-kpi-card utilidad">
          <p className="erp-kpi-label"><DollarSign size={14} /> Utilidad Bruta Mes</p>
          <h2 className="erp-kpi-value" style={{ color: (resumen?.utilidadMes ?? 0) >= 0 ? '#059669' : '#dc2626' }}>
            {resumen ? fmt(resumen.utilidadMes) : '...'}
          </h2>
          <p className="erp-kpi-sub">Ventas − Gastos directos</p>
          <span className="erp-kpi-today" style={{ background: '#d1fae5', color: '#065f46' }}>
            Hoy: {resumen ? fmt(resumen.utilidadHoy) : '-'}
          </span>
        </div>

        <div className="erp-kpi-card pedidos">
          <p className="erp-kpi-label"><ShoppingBag size={14} /> Ticket Promedio</p>
          <h2 className="erp-kpi-value">{resumen ? fmt(resumen.ticketPromedio) : '...'}</h2>
          <p className="erp-kpi-sub">Valor promedio por venta</p>
          <span className="erp-kpi-today" style={{ background: '#e0f2fe', color: '#0369a1' }}>
            Total {ventas.length} pedidos
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="erp-ventas-tabs">
        <button className={`erp-ventas-tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          <BarChart2 size={16} /> Dashboard Comercial
        </button>
        <button className={`erp-ventas-tab ${tab === 'ventas' ? 'active' : ''}`} onClick={() => setTab('ventas')}>
          <ClipboardList size={16} /> Pedidos & Facturas Reales
        </button>
        <button className={`erp-ventas-tab ${tab === 'egresos' ? 'active' : ''}`} onClick={() => setTab('egresos')}>
          <CreditCard size={16} /> Egresos de Operación
        </button>
        <button className={`erp-ventas-tab ${tab === 'productos' ? 'active' : ''}`} onClick={() => setTab('productos')}>
          <Star size={16} /> Ranking de Productos
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
          <div className="erp-panel-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <h3>🛍️ Historial de Ventas</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="erp-filtros" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Filtro Origen */}
                <select
                  value={origenFilter}
                  onChange={e => setOrigenFilter(e.target.value as any)}
                  style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', background: 'white' }}
                >
                  <option value="todos">🌐 Todos los Canales</option>
                  <option value="pos">💻 Ventas POS</option>
                  <option value="catalogo">📱 Catálogo Digital</option>
                </select>

                {/* Filtro Asesor */}
                <select
                  value={asesorFilter}
                  onChange={e => setAsesorFilter(e.target.value)}
                  style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', background: 'white' }}
                >
                  <option value="todos">👥 Todos los Asesores</option>
                  <option value="caja directa">🏪 Caja Directa / POS</option>
                  {asesoresList.map(a => (
                    <option key={a.id} value={a.nombre}>👤 {a.nombre}</option>
                  ))}
                </select>

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
          ) : filteredVentas.length === 0 ? (
            <div className="erp-empty">
              <Package size={48} />
              <p>No hay ventas registradas con los filtros seleccionados en este periodo.</p>
            </div>
          ) : (
            <table className="erp-ventas-table">
              <thead>
                <tr>
                  <th># Pedido</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Ciudad</th>
                  <th>Canal / Asesor</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredVentas.map(v => {
                  const info = getVentaAsesorInfo(v);
                  return (
                    <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedVentaModal(v)}>
                      <td><strong style={{ fontFamily: 'monospace', color: '#6366f1' }}>{v.id.substring(0, 8).toUpperCase()}</strong></td>
                      <td>{v.created_at?.split('T')[0]}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{v.cliente_nombre}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{v.cliente_telefono}</div>
                      </td>
                      <td>{v.ciudad}</td>
                      <td>
                        <span style={{
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          padding: '0.25rem 0.65rem',
                          borderRadius: '12px',
                          background: info.isPos ? '#ede9fe' : '#e0f2fe',
                          color: info.isPos ? '#6d28d9' : '#0369a1',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}>
                          {info.isPos ? '💻 POS' : '📱 Catálogo'} ({info.asesorNombre})
                        </span>
                      </td>
                      <td>
                        <span className={`erp-estado-badge ${estadoClass(v.estado)}`}>
                          {v.estado || 'Aprobado'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1rem', color: '#059669' }}>
                        {fmt(v.total)}
                      </td>
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <button className="erp-btn-sm erp-btn-detail" onClick={() => setSelectedVentaModal(v)}>
                          <Eye size={14} /> Ver Factura
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, padding: '0.9rem 1rem', background: '#f8fafc', color: '#0f172a', fontSize: '0.88rem' }}>
                    TOTAL PERIODO ({filteredVentas.length} ventas):
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: '#6366f1', background: '#f8fafc', padding: '0.9rem 1rem' }}>
                    {fmt(filteredVentas.reduce((s, v) => s + Number(v.total), 0))}
                  </td>
                  <td style={{ background: '#f8fafc' }}></td>
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
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="erp-filtros">
                <label style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Desde:</label>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
                <label style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Hasta:</label>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
              </div>
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
              <p>No hay gastos registrados en el periodo seleccionado.<br />Registra tus gastos: arriendo, servicios, transporte, comisiones, etc.</p>
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
                    {metodosPagoList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                {cuentasTesoreria.length > 0 && (
                  <div>
                    <label className="erp-form-label">Descontar de Cuenta / Caja:</label>
                    <select className="erp-select" value={egresoForm.cuenta_id} onChange={e => setEgresoForm({ ...egresoForm, cuenta_id: e.target.value })}>
                      <option value="">-- No descontar de caja --</option>
                      {cuentasTesoreria.map(cta => (
                        <option key={cta.id} value={cta.id}>
                          {cta.nombre} ({cta.tipo} - Saldo: {fmt(cta.saldo_actual)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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

      {/* ── Modal: Factura Completa de Venta / Pedido ── */}
      {selectedVentaModal && (
        <div className="erp-modal-bg" onClick={() => setSelectedVentaModal(null)}>
          <div className="erp-factura-modal" onClick={e => e.stopPropagation()}>
            <div className="erp-factura-header">
              <div>
                <span className="erp-factura-badge">FACTURA DE VENTA</span>
                <h2>Pedido #{selectedVentaModal.id.substring(0, 8).toUpperCase()}</h2>
                <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                  <Calendar size={14} /> {selectedVentaModal.created_at?.split('T')[0]} {selectedVentaModal.created_at?.includes('T') ? `· ${selectedVentaModal.created_at?.split('T')[1]?.substring(0, 5)}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className={`erp-estado-badge ${estadoClass(selectedVentaModal.estado)}`}>
                  {selectedVentaModal.estado || 'Aprobado'}
                </span>
                <button className="erp-factura-close" onClick={() => setSelectedVentaModal(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Datos del Cliente */}
            <div className="erp-factura-cliente-card">
              <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.9rem', color: '#334155', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <User size={16} color="#6366f1" /> Información del Cliente
              </h4>
              <div className="erp-factura-cliente-grid">
                <div><strong>Nombre:</strong> {selectedVentaModal.cliente_nombre || 'Cliente General'}</div>
                <div><strong>Teléfono:</strong> <Phone size={12} style={{ verticalAlign: 'middle' }} /> {selectedVentaModal.cliente_telefono || '-'}</div>
                <div><strong>Ciudad:</strong> <MapPin size={12} style={{ verticalAlign: 'middle' }} /> {selectedVentaModal.ciudad || '-'}</div>
                <div><strong>Dirección:</strong> {selectedVentaModal.direccion || '-'}</div>
                {selectedVentaModal.envio_metodo && <div><strong>Método Envío:</strong> {selectedVentaModal.envio_metodo}</div>}
                {selectedVentaModal.numero_guia && <div><strong>No. Guía:</strong> {selectedVentaModal.numero_guia}</div>}
              </div>
            </div>

            {/* Tabla de Productos del Pedido */}
            <h4 style={{ margin: '1.25rem 0 0.5rem', fontSize: '0.95rem', color: '#0f172a', fontWeight: 800 }}>📦 Detalle de Productos</h4>
            <table className="erp-ventas-table erp-factura-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Variante / Talla</th>
                  <th style={{ textAlign: 'center' }}>Cant.</th>
                  <th style={{ textAlign: 'right' }}>Precio Unit.</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  try {
                    const items = Array.isArray(selectedVentaModal.productos)
                      ? selectedVentaModal.productos
                      : JSON.parse((selectedVentaModal as any).productos || '[]');

                    if (!items || items.length === 0) {
                      return <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>No hay detalle de productos en este pedido</td></tr>;
                    }

                    return items.map((prod: any, idx: number) => {
                      const qty = Number(prod.cantidad || prod.quantity || 1);
                      const price = Number(prod.precio || prod.price || 0);
                      const img = prod.imagen || prod.image || '';
                      const talla = prod.talla || prod.size || '';
                      const estampado = prod.estampado || '';

                      return (
                        <tr key={idx}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              {img && (
                                <img src={img} alt="" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                              )}
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{prod.nombre || prod.name || 'Producto'}</span>
                            </div>
                          </td>
                          <td>
                            {talla && <span className="erp-factura-tag">Talla: {talla}</span>}
                            {estampado && <span className="erp-factura-tag">Est: {estampado}</span>}
                            {!talla && !estampado && <span style={{ color: '#94a3b8' }}>-</span>}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{qty}</td>
                          <td style={{ textAlign: 'right' }}>{fmt(price)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{fmt(price * qty)}</td>
                        </tr>
                      );
                    });
                  } catch (e) {
                    return <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>Error al procesar los productos del pedido</td></tr>;
                  }
                })()}
              </tbody>
            </table>

            {/* Resumen Final */}
            <div className="erp-factura-totales">
              <div>
                {selectedVentaModal.pantallazo_url && (
                  <div style={{ marginTop: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: '0 0 0.25rem 0' }}>📎 Comprobante de Pago Adjunto:</p>
                    <a href={selectedVentaModal.pantallazo_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.82rem', color: '#6366f1', fontWeight: 700, textDecoration: 'underline' }}>
                      Abrir comprobante completo ↗
                    </a>
                  </div>
                )}
              </div>
              <div className="erp-factura-box-total">
                <div className="erp-factura-row">
                  <span>Subtotal Productos:</span>
                  <strong>{fmt(selectedVentaModal.total)}</strong>
                </div>
                <div className="erp-factura-row-grand">
                  <span>TOTAL FACTURA:</span>
                  <span>{fmt(selectedVentaModal.total)}</span>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <button className="erp-btn erp-btn-ghost" onClick={() => window.print()}>
                <Printer size={15} /> Imprimir / Guardar PDF
              </button>
              <button className="erp-btn erp-btn-primary-v" onClick={() => setSelectedVentaModal(null)}>
                Cerrar Factura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

