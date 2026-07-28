import React, { useState, useEffect } from 'react';
import { ERPTesoreriaService } from '../../lib/erpTesoreriaService';
import {
  ShoppingCart,
  Plus,
  Search
} from 'lucide-react';

interface Props {
  tenantId: string;
  onNavigateTab?: (tab: string) => void;
}

export const ERPComprasModule: React.FC<Props> = ({ tenantId }) => {
  const [cxpList, setCxpList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterState, setFilterState] = useState<'todos' | 'pendientes' | 'pagados'>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal nueva factura proveedor / orden de compra
  const [showCompraModal, setShowCompraModal] = useState(false);
  const [compraForm, setCompraForm] = useState({
    proveedor_nombre: '',
    concepto: '',
    numero_factura: '',
    categoria: 'Materia Prima / Textiles',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    monto_total: '',
    notas: ''
  });

  const loadComprasData = async () => {
    setLoading(true);
    try {
      const cxpData = await ERPTesoreriaService.fetchCxP(tenantId);
      setCxpList(cxpData || []);
    } catch (err) {
      console.error('Error al cargar módulo de compras:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComprasData();
  }, [tenantId]);

  // Cálculos
  const totalCxP = cxpList.reduce((sum, item) => sum + (Number(item.monto_total) || 0), 0);
  const totalPendiente = cxpList.filter(item => item.estado !== 'Pagado').reduce((sum, item) => sum + (Number(item.monto_pendiente || item.monto_total) || 0), 0);
  const totalPagado = cxpList.filter(item => item.estado === 'Pagado').reduce((sum, item) => sum + (Number(item.monto_total) || 0), 0);

  // Filtrado
  const filteredCxp = cxpList.filter(item => {
    const matchSearch = (item.proveedor_nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (item.concepto || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (item.numero_factura || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (filterState === 'pendientes') return matchSearch && item.estado !== 'Pagado';
    if (filterState === 'pagados') return matchSearch && item.estado === 'Pagado';
    return matchSearch;
  });

  // Guardar Factura de Proveedor
  const handleSaveCompra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compraForm.proveedor_nombre || !compraForm.monto_total) {
      alert('Por favor completa la información requerida.');
      return;
    }

    try {
      setLoading(true);
      await ERPTesoreriaService.crearCxP({
        tenant_id: tenantId,
        proveedor_nombre: compraForm.proveedor_nombre,
        concepto: compraForm.concepto || `Compra Factura #${compraForm.numero_factura || 'S/N'}`,
        numero_factura: compraForm.numero_factura,
        categoria: compraForm.categoria,
        fecha_emision: compraForm.fecha_emision,
        fecha_vencimiento: compraForm.fecha_vencimiento || compraForm.fecha_emision,
        monto_total: Number(compraForm.monto_total),
        monto_pagado: 0,
        estado: 'Pendiente',
        notas: compraForm.notas
      });

      alert('✅ Factura de Proveedor / Orden de Compra registrada exitosamente.');
      setShowCompraModal(false);
      setCompraForm({ proveedor_nombre: '', concepto: '', numero_factura: '', categoria: 'Materia Prima / Textiles', fecha_emision: new Date().toISOString().split('T')[0], fecha_vencimiento: '', monto_total: '', notas: '' });
      loadComprasData();
    } catch (err: any) {
      alert('Error al registrar compra: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShoppingCart size={28} color="var(--primary-color, #6366f1)" /> Módulo de Compras & Proveedores (CxP)
          </h1>
          <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.88rem' }}>
            Registro de facturas de compra, cuentas por pagar a proveedores y control de egresos
          </p>
        </div>

        <button
          onClick={() => setShowCompraModal(true)}
          className="erp-btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Plus size={16} /> Registrar Factura de Proveedor
        </button>
      </div>

      {/* Tarjetas de Métricas de Compras */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>🧾 Total Facturado Compras</span>
          <h2 style={{ fontSize: '1.8rem', color: '#0f172a', margin: '0.3rem 0 0 0', fontWeight: 800 }}>${totalCxP.toLocaleString('es-CO')}</h2>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Historico compras registrados</span>
        </div>

        <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: 800, textTransform: 'uppercase' }}>⏳ Cuentas por Pagar (Pendientes)</span>
          <h2 style={{ fontSize: '1.8rem', color: '#d97706', margin: '0.3rem 0 0 0', fontWeight: 800 }}>${totalPendiente.toLocaleString('es-CO')}</h2>
          <span style={{ fontSize: '0.75rem', color: '#b45309' }}>Saldo por abonar a proveedores</span>
        </div>

        <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 800, textTransform: 'uppercase' }}>✅ Pagado a Proveedores</span>
          <h2 style={{ fontSize: '1.8rem', color: '#16a34a', margin: '0.3rem 0 0 0', fontWeight: 800 }}>${totalPagado.toLocaleString('es-CO')}</h2>
          <span style={{ fontSize: '0.75rem', color: '#15803d' }}>Liquidado y saldado</span>
        </div>
      </div>

      {/* Tabla de Facturas de Compra */}
      <div className="erp-card-table">
        <div className="erp-table-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Buscar por proveedor, factura o concepto..."
              className="erp-search-input"
              style={{ paddingLeft: '2.4rem', width: '100%' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={() => setFilterState('todos')}
              className={`erp-btn-primary ${filterState === 'todos' ? '' : 'btn-secondary'}`}
              style={{ background: filterState === 'todos' ? '#0f172a' : '#f1f5f9', color: filterState === 'todos' ? '#fff' : '#334155' }}
            >
              Todas ({cxpList.length})
            </button>
            <button
              onClick={() => setFilterState('pendientes')}
              className="erp-btn-primary"
              style={{ background: filterState === 'pendientes' ? '#d97706' : '#fffbe6', color: filterState === 'pendientes' ? '#fff' : '#b45309', border: '1px solid #fde68a' }}
            >
              Pendientes
            </button>
            <button
              onClick={() => setFilterState('pagados')}
              className="erp-btn-primary"
              style={{ background: filterState === 'pagados' ? '#16a34a' : '#f0fdf4', color: filterState === 'pagados' ? '#fff' : '#15803d', border: '1px solid #bbf7d0' }}
            >
              Pagadas
            </button>
          </div>
        </div>

        <table className="erp-table">
          <thead>
            <tr>
              <th>Proveedor / Empresa</th>
              <th>N° Factura</th>
              <th>Categoría</th>
              <th>Fecha Emisión / Vencimiento</th>
              <th>Monto Total Factura</th>
              <th>Estado CxP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Cargando facturas de compras...</td></tr>
            ) : filteredCxp.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>No se encontraron registros de compra.</td></tr>
            ) : (
              filteredCxp.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong style={{ color: '#0f172a', display: 'block' }}>{item.proveedor_nombre}</strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{item.concepto}</span>
                  </td>
                  <td><strong>{item.numero_factura || 'S/N'}</strong></td>
                  <td>
                    <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
                      {item.categoria || 'Proveedor'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    <div>Emisión: {item.fecha_emision}</div>
                    {item.fecha_vencimiento && <div style={{ color: '#dc2626', fontWeight: 600 }}>Vence: {item.fecha_vencimiento}</div>}
                  </td>
                  <td style={{ fontWeight: 800, color: '#0f172a' }}>${Number(item.monto_total || 0).toLocaleString('es-CO')}</td>
                  <td>
                    <span
                      style={{
                        background: item.estado === 'Pagado' ? '#dcfce7' : '#fef3c7',
                        color: item.estado === 'Pagado' ? '#166534' : '#b45309',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '99px',
                        fontSize: '0.75rem',
                        fontWeight: 800
                      }}
                    >
                      {item.estado === 'Pagado' ? '✓ Pagada' : '⏳ Pendiente CxP'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Registrar Compra / Factura Proveedor */}
      {showCompraModal && (
        <div className="erp-modal-overlay">
          <div className="erp-modal-content" style={{ maxWidth: '600px' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Registrar Factura de Proveedor / Compra</h3>
            <form onSubmit={handleSaveCompra}>
              <div className="erp-form-group">
                <label>Nombre del Proveedor / Empresa:</label>
                <input
                  type="text"
                  required
                  className="erp-form-input"
                  placeholder="Ej. Distribuidora Textil S.A.S..."
                  value={compraForm.proveedor_nombre}
                  onChange={e => setCompraForm({ ...compraForm, proveedor_nombre: e.target.value })}
                />
              </div>

              <div className="erp-form-group">
                <label>Número de Factura Proveedor:</label>
                <input
                  type="text"
                  className="erp-form-input"
                  placeholder="Ej. FACT-9821"
                  value={compraForm.numero_factura}
                  onChange={e => setCompraForm({ ...compraForm, numero_factura: e.target.value })}
                />
              </div>

              <div className="erp-form-group">
                <label>Categoría del Gasto / Compra:</label>
                <select
                  className="erp-form-select"
                  value={compraForm.categoria}
                  onChange={e => setCompraForm({ ...compraForm, categoria: e.target.value })}
                >
                  <option value="Materia Prima / Textiles">Materia Prima / Textiles & Telas</option>
                  <option value="Insumos e Imprenta">Insumos de Sublimación / Confección</option>
                  <option value="Empaques y Logística">Empaques y Logística</option>
                  <option value="Servicios y Arriendo">Servicios, Arriendo y Nómina</option>
                  <option value="General">Otro Gasto General</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="erp-form-group">
                  <label>Fecha Emisión:</label>
                  <input
                    type="date"
                    required
                    className="erp-form-input"
                    value={compraForm.fecha_emision}
                    onChange={e => setCompraForm({ ...compraForm, fecha_emision: e.target.value })}
                  />
                </div>
                <div className="erp-form-group">
                  <label>Fecha Vencimiento:</label>
                  <input
                    type="date"
                    className="erp-form-input"
                    value={compraForm.fecha_vencimiento}
                    onChange={e => setCompraForm({ ...compraForm, fecha_vencimiento: e.target.value })}
                  />
                </div>
              </div>

              <div className="erp-form-group">
                <label>Monto Total Factura ($ COP):</label>
                <input
                  type="number"
                  required
                  placeholder="Ej. 450000"
                  className="erp-form-input"
                  value={compraForm.monto_total}
                  onChange={e => setCompraForm({ ...compraForm, monto_total: e.target.value })}
                />
              </div>

              <div className="erp-form-group">
                <label>Concepto / Detalle:</label>
                <input
                  type="text"
                  className="erp-form-input"
                  placeholder="Ej. Compra 50 metros tela franela..."
                  value={compraForm.concepto}
                  onChange={e => setCompraForm({ ...compraForm, concepto: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="erp-btn-primary" style={{ background: '#94a3b8' }} onClick={() => setShowCompraModal(false)}>Cancelar</button>
                <button type="submit" className="erp-btn-primary">Guardar Factura Compra</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
