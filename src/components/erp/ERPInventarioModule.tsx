import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ERPContabilidadService } from '../../lib/erpContabilidadService';
import {
  Package,
  Search,
  Plus,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  tenantId: string;
  onNavigateTab?: (tab: string) => void;
}

export const ERPInventarioModule: React.FC<Props> = ({ tenantId }) => {
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('todas');

  // Modal para ajuste o entrada de Kardex
  const [showAjusteModal, setShowAjusteModal] = useState(false);
  const [ajusteForm, setAjusteForm] = useState({
    producto_id: '',
    tipo: 'Entrada', // 'Entrada' | 'Salida' | 'Ajuste'
    cantidad: 1,
    motivo: 'Compra de inventario / Reabastecimiento',
    costo_unitario: ''
  });

  const loadInventario = async () => {
    setLoading(true);
    try {
      const [prodsRes, catsRes] = await Promise.all([
        supabase.from('productos').select('*').eq('tenant_id', tenantId),
        supabase.from('categorias').select('*').eq('tenant_id', tenantId).order('nombre', { ascending: true })
      ]);

      setProductos(prodsRes.data || []);
      setCategorias(catsRes.data || []);
    } catch (err) {
      console.error('Error al cargar inventario:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventario();
  }, [tenantId]);

  // Cálculos de métricas
  const totalProductos = productos.length;
  const valorizacionTotal = productos.reduce((sum, p) => sum + (Number(p.precio || 0) * (Number(p.stock) || 1)), 0);
  const productosBajoStock = productos.filter(p => Number(p.stock) > 0 && Number(p.stock) <= 5);
  const productosAgotados = productos.filter(p => Number(p.stock) === 0);

  // Filtrado
  const filteredProducts = productos.filter(p => {
    const matchSearch = (p.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (p.referencia || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = categoriaFilter === 'todas' || p.categoria_id === categoriaFilter || p.categoria === categoriaFilter;
    return matchSearch && matchCat;
  });

  // Guardar Ajuste / Entrada de Kardex
  const handleSaveAjuste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ajusteForm.producto_id) {
      alert('Por favor selecciona un producto');
      return;
    }

    try {
      setLoading(true);
      const prod = productos.find(p => p.id === ajusteForm.producto_id);
      if (!prod) return;

      const delta = ajusteForm.tipo === 'Salida' ? -Math.abs(Number(ajusteForm.cantidad)) : Math.abs(Number(ajusteForm.cantidad));
      const nuevoStock = Math.max(0, (Number(prod.stock) || 0) + delta);

      // Actualizar stock en BD
      await supabase
        .from('productos')
        .update({ stock: nuevoStock })
        .eq('id', prod.id);

      // Si es una compra/entrada, registrar automáticamente el comprobante contable
      if (ajusteForm.tipo === 'Entrada' && Number(ajusteForm.costo_unitario) > 0) {
        const totalCompra = Number(ajusteForm.costo_unitario) * Math.abs(Number(ajusteForm.cantidad));
        try {
          await ERPContabilidadService.registrarComprobante({
            tenant_id: tenantId,
            tipo_comprobante: 'Nota Contable',
            fecha: new Date().toISOString().split('T')[0],
            concepto: `Entrada de Inventario ERP: ${prod.nombre} (${ajusteForm.cantidad} uds) - ${ajusteForm.motivo}`,
            origen_modulo: 'inventario',
            estado: 'Asentado'
          }, [
            { tenant_id: tenantId, cuenta_codigo: '143505', cuenta_nombre: 'Inventario de Mercancías', debito: totalCompra, credito: 0, concepto_linea: `Ingreso ${prod.nombre}` },
            { tenant_id: tenantId, cuenta_codigo: '110505', cuenta_nombre: 'Caja General / Bancos', debito: 0, credito: totalCompra, concepto_linea: `Pago Inventario ${prod.nombre}` }
          ]);
        } catch (cErr) {
          console.warn('Asiento contable opcional:', cErr);
        }
      }

      alert(`✅ Ajuste de Kardex guardado. Nuevo stock para ${prod.nombre}: ${nuevoStock} unidades.`);
      setShowAjusteModal(false);
      setAjusteForm({ producto_id: '', tipo: 'Entrada', cantidad: 1, motivo: 'Compra de inventario / Reabastecimiento', costo_unitario: '' });
      loadInventario();
    } catch (err: any) {
      alert('Error al guardar ajuste: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Exportar Excel
  const handleExportExcel = () => {
    const data = filteredProducts.map(p => ({
      'Referencia': p.referencia || p.nombre,
      'Nombre del Producto': p.nombre,
      'Categoría': p.categoria || p.categoria_id || 'General',
      'Precio de Venta': p.precio,
      'Precio Al Por Mayor': p.precio_por_mayor || p.precio,
      'Stock Actual': p.stock || 0,
      'Valorización Estimada': (Number(p.precio || 0) * (Number(p.stock) || 1))
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kardex_Inventario');
    XLSX.writeFile(wb, `Kardex_Inventario_${tenantId}.xlsx`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Package size={28} color="var(--primary-color, #6366f1)" /> Módulo de Inventario & Kardex ERP
          </h1>
          <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.88rem' }}>
            Control en tiempo real de mercancías, valorización de existencias y movimientos contables de stock
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            onClick={handleExportExcel}
            className="erp-btn-primary"
            style={{ background: '#166534', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <FileSpreadsheet size={16} /> Exportar Kardex Excel
          </button>
          <button
            onClick={() => setShowAjusteModal(true)}
            className="erp-btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={16} /> Registrar Entrada / Salida Kardex
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas de Inventario */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>📦 Total Productos</span>
          <h2 style={{ fontSize: '1.8rem', color: '#0f172a', margin: '0.3rem 0 0 0', fontWeight: 800 }}>{totalProductos}</h2>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Catálogo activo</span>
        </div>

        <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.78rem', color: '#0284c7', fontWeight: 800, textTransform: 'uppercase' }}>💰 Valorización Estimada</span>
          <h2 style={{ fontSize: '1.8rem', color: '#0284c7', margin: '0.3rem 0 0 0', fontWeight: 800 }}>${valorizacionTotal.toLocaleString('es-CO')}</h2>
          <span style={{ fontSize: '0.75rem', color: '#0369a1' }}>Valor de inventario comercial</span>
        </div>

        <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: 800, textTransform: 'uppercase' }}>⚠️ Stock Bajo (1-5 Uds)</span>
          <h2 style={{ fontSize: '1.8rem', color: '#d97706', margin: '0.3rem 0 0 0', fontWeight: 800 }}>{productosBajoStock.length}</h2>
          <span style={{ fontSize: '0.75rem', color: '#b45309' }}>Requieren reabastecimiento</span>
        </div>

        <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 800, textTransform: 'uppercase' }}>🚫 Productos Agotados</span>
          <h2 style={{ fontSize: '1.8rem', color: '#dc2626', margin: '0.3rem 0 0 0', fontWeight: 800 }}>{productosAgotados.length}</h2>
          <span style={{ fontSize: '0.75rem', color: '#991b1b' }}>Sin disponibilidad</span>
        </div>
      </div>

      {/* Filtros de Tabla */}
      <div className="erp-card-table">
        <div className="erp-table-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: '260px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Buscar por nombre o referencia..."
                className="erp-search-input"
                style={{ paddingLeft: '2.4rem', width: '100%' }}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="erp-form-select"
              style={{ width: '200px' }}
              value={categoriaFilter}
              onChange={e => setCategoriaFilter(e.target.value)}
            >
              <option value="todas">Todas las Categorías</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <button onClick={loadInventario} className="erp-btn-primary" style={{ background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1' }}>
            <RefreshCw size={16} /> Actualizar Stock
          </button>
        </div>

        {/* Tabla Kardex de Inventario */}
        <table className="erp-table">
          <thead>
            <tr>
              <th>Producto & Referencia</th>
              <th>Categoría</th>
              <th>Precio Venta</th>
              <th>Precio Mayorista</th>
              <th>Stock Disponible</th>
              <th>Valor Comercial Stock</th>
              <th>Estado Stock</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>Cargando inventario ERP...</td></tr>
            ) : filteredProducts.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>No se encontraron productos en el inventario.</td></tr>
            ) : (
              filteredProducts.map((p) => {
                const stockNum = Number(p.stock) || 0;
                const valorStock = Number(p.precio || 0) * (stockNum || 1);

                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {p.imagen_url ? (
                          <img src={p.imagen_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                        ) : (
                          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Package size={20} color="#94a3b8" />
                          </div>
                        )}
                        <div>
                          <strong style={{ color: '#0f172a', display: 'block' }}>{p.nombre}</strong>
                          {p.referencia && <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 700 }}>Ref: {p.referencia}</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
                        {p.categoria || p.categoria_id || 'General'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>${Number(p.precio || 0).toLocaleString('es-CO')}</td>
                    <td style={{ color: '#64748b' }}>${Number(p.precio_por_mayor || p.precio || 0).toLocaleString('es-CO')}</td>
                    <td>
                      <strong style={{ fontSize: '1rem', color: stockNum === 0 ? '#dc2626' : stockNum <= 5 ? '#d97706' : '#16a34a' }}>
                        {stockNum} Unidades
                      </strong>
                    </td>
                    <td style={{ fontWeight: 800, color: '#0284c7' }}>${valorStock.toLocaleString('es-CO')}</td>
                    <td>
                      {stockNum === 0 ? (
                        <span style={{ background: '#fee2e2', color: '#dc2626', padding: '0.2rem 0.6rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 800 }}>Agotado</span>
                      ) : stockNum <= 5 ? (
                        <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.2rem 0.6rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 800 }}>Bajo Stock</span>
                      ) : (
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '0.2rem 0.6rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 800 }}>Disponible</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Registrar Entrada / Salida Kardex */}
      {showAjusteModal && (
        <div className="erp-modal-overlay">
          <div className="erp-modal-content" style={{ maxWidth: '600px' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Registrar Movimiento de Kardex / Entrada de Mercancía</h3>
            <form onSubmit={handleSaveAjuste}>
              <div className="erp-form-group">
                <label>Seleccionar Producto:</label>
                <select
                  required
                  className="erp-form-select"
                  value={ajusteForm.producto_id}
                  onChange={e => setAjusteForm({ ...ajusteForm, producto_id: e.target.value })}
                >
                  <option value="">-- Selecciona un Producto --</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} {p.referencia ? `[Ref: ${p.referencia}]` : ''} (Stock Actual: {p.stock || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div className="erp-form-group">
                <label>Tipo de Movimiento:</label>
                <select
                  className="erp-form-select"
                  value={ajusteForm.tipo}
                  onChange={e => setAjusteForm({ ...ajusteForm, tipo: e.target.value })}
                >
                  <option value="Entrada">📥 Entrada de Mercancía (Compra / Reabastecimiento)</option>
                  <option value="Salida">📤 Salida de Mercancía (Muestra / Daño / Devolución)</option>
                  <option value="Ajuste">🔧 Ajuste Directo de Inventario</option>
                </select>
              </div>

              <div className="erp-form-group">
                <label>Cantidad de Unidades:</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="erp-form-input"
                  value={ajusteForm.cantidad}
                  onChange={e => setAjusteForm({ ...ajusteForm, cantidad: Number(e.target.value) })}
                />
              </div>

              {ajusteForm.tipo === 'Entrada' && (
                <div className="erp-form-group">
                  <label>Costo Unitario de Compra ($ COP) - Opcional para Asiento Contable:</label>
                  <input
                    type="number"
                    placeholder="Ej. 15000"
                    className="erp-form-input"
                    value={ajusteForm.costo_unitario}
                    onChange={e => setAjusteForm({ ...ajusteForm, costo_unitario: e.target.value })}
                  />
                </div>
              )}

              <div className="erp-form-group">
                <label>Motivo / Observación:</label>
                <input
                  type="text"
                  required
                  className="erp-form-input"
                  placeholder="Ej. Factura proveedor #1024..."
                  value={ajusteForm.motivo}
                  onChange={e => setAjusteForm({ ...ajusteForm, motivo: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="erp-btn-primary" style={{ background: '#94a3b8' }} onClick={() => setShowAjusteModal(false)}>Cancelar</button>
                <button type="submit" className="erp-btn-primary">Guardar Ajuste Kardex</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
