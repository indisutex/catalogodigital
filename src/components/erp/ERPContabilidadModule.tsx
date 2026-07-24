import React, { useState, useEffect } from 'react';
import { ERPContabilidadService } from '../../lib/erpContabilidadService';
import type { 
  ERPCuentaPUC, 
  ERPTercero, 
  ERPComprobanteContable, 
  ERPBalancePruebaItem 
} from '../../types/erp';
import './ERPContabilidadModule.css';
import { 
  Wallet, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight, 
  BarChart3, 
  Plus, 
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  HelpCircle,
  BookOpen
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  tenantId: string;
}

export const ERPContabilidadModule: React.FC<Props> = ({ tenantId }) => {
  // Pestañas principales simplificadas para el usuario
  const [activeTab, setActiveTab] = useState<'resumen' | 'terceros' | 'movimientos' | 'puc_avanzado'>('resumen');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados de datos
  const [pucList, setPucList] = useState<ERPCuentaPUC[]>([]);
  const [tercerosList, setTercerosList] = useState<ERPTercero[]>([]);
  const [comprobantesList, setComprobantesList] = useState<ERPComprobanteContable[]>([]);
  const [balanceList, setBalanceList] = useState<ERPBalancePruebaItem[]>([]);

  // Filtro de búsqueda
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modales
  const [showCuentaModal, setShowCuentaModal] = useState<boolean>(false);
  const [showTerceroModal, setShowTerceroModal] = useState<boolean>(false);
  const [showComprobanteModal, setShowComprobanteModal] = useState<boolean>(false);

  // Formulario Nueva Cuenta PUC
  const [cuentaForm, setCuentaForm] = useState({
    codigo: '',
    nombre: '',
    nivel: 4,
    tipo: 'Activo',
    naturaleza: 'Débito'
  });

  // Formulario Nuevo Tercero
  const [terceroForm, setTerceroForm] = useState({
    tipo_documento: 'CC',
    numero_documento: '',
    dv: '',
    razon_social: '',
    telefono: '',
    email: '',
    direccion: '',
    ciudad: 'Cali',
    es_cliente: true,
    es_proveedor: false
  });

  // Formulario Nuevo Movimiento Manual
  const [comprobanteForm, setComprobanteForm] = useState({
    tipo_comprobante: 'Nota Contable',
    concepto: '',
    fecha: new Date().toISOString().split('T')[0]
  });

  const [asientosForm, setAsientosForm] = useState([
    { cuenta_codigo: '110505', cuenta_nombre: 'Caja General', debito: 0, credito: 0, concepto_linea: '' },
    { cuenta_codigo: '413505', cuenta_nombre: 'Venta de Textiles', debito: 0, credito: 0, concepto_linea: '' }
  ]);

  // Cargar datos
  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [pucData, tercerosData, diarioData, balanceData] = await Promise.all([
        ERPContabilidadService.fetchPUC(tenantId),
        ERPContabilidadService.fetchTerceros(tenantId),
        ERPContabilidadService.fetchLibroDiario(tenantId),
        ERPContabilidadService.fetchBalancePrueba(tenantId)
      ]);

      setPucList(pucData);
      setTercerosList(tercerosData);
      setComprobantesList(diarioData);
      setBalanceList(balanceData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar información del ERP');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  // Manejador Guardar Cuenta PUC
  const handleSaveCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ERPContabilidadService.saveCuentaPUC({
        tenant_id: tenantId,
        codigo: cuentaForm.codigo,
        nombre: cuentaForm.nombre,
        nivel: Number(cuentaForm.nivel),
        tipo: cuentaForm.tipo as any,
        naturaleza: cuentaForm.naturaleza as any,
        activa: true
      });
      setShowCuentaModal(false);
      setCuentaForm({ codigo: '', nombre: '', nivel: 4, tipo: 'Activo', naturaleza: 'Débito' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Manejador Guardar Tercero
  const handleSaveTercero = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ERPContabilidadService.upsertTercero({
        tenant_id: tenantId,
        tipo_documento: terceroForm.tipo_documento as any,
        numero_documento: terceroForm.numero_documento,
        dv: terceroForm.dv,
        razon_social: terceroForm.razon_social,
        telefono: terceroForm.telefono,
        email: terceroForm.email,
        direccion: terceroForm.direccion,
        ciudad: terceroForm.ciudad,
        es_cliente: terceroForm.es_cliente,
        es_proveedor: terceroForm.es_proveedor
      });
      setShowTerceroModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Manejador Guardar Comprobante Manual
  const handleSaveComprobante = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ERPContabilidadService.registrarComprobante({
        tenant_id: tenantId,
        tipo_comprobante: comprobanteForm.tipo_comprobante as any,
        fecha: comprobanteForm.fecha,
        concepto: comprobanteForm.concepto,
        origen_modulo: 'manual',
        estado: 'Asentado'
      }, asientosForm.map(a => ({ ...a, tenant_id: tenantId })));

      setShowComprobanteModal(false);
      setComprobanteForm({ tipo_comprobante: 'Nota Contable', concepto: '', fecha: new Date().toISOString().split('T')[0] });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Exportar Balance a Excel
  const exportBalanceExcel = () => {
    const ws = XLSX.utils.json_to_sheet(balanceList.map(b => ({
      'Código Cuenta': b.cuenta_codigo,
      'Nombre de Cuenta': b.cuenta_nombre,
      'Naturaleza': b.naturaleza,
      'Total Entradas (Débito)': b.total_debito,
      'Total Salidas (Crédito)': b.total_credito,
      'Saldo Final': b.saldo_nuevo
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Informe_Financiero');
    XLSX.writeFile(wb, `Informe_Financiero_${tenantId}.xlsx`);
  };

  // Totales Financieros amigables
  const totalIngresos = balanceList.filter(b => b.cuenta_codigo.startsWith('4')).reduce((s, i) => s + i.total_credito, 0);
  const totalGastos = balanceList.filter(b => b.cuenta_codigo.startsWith('5') || b.cuenta_codigo.startsWith('6')).reduce((s, i) => s + i.total_debito, 0);
  const utilidadNeta = totalIngresos - totalGastos;

  const saldoCaja = balanceList.filter(b => b.cuenta_codigo === '110505').reduce((s, i) => s + i.saldo_nuevo, 0);
  const saldoBancos = balanceList.filter(b => b.cuenta_codigo.startsWith('1110')).reduce((s, i) => s + i.saldo_nuevo, 0);

  const filteredPuc = pucList.filter(p => 
    p.codigo.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTerceros = tercerosList.filter(t => 
    t.numero_documento.includes(searchTerm) || 
    t.razon_social.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="erp-contabilidad-container">
      {/* Encabezado Amigable */}
      <div className="erp-header">
        <div>
          <h1><Wallet size={28} color="var(--primary-color, #6366f1)" /> Gestión de Finanzas y Control de Caja</h1>
          <p>Supervisa ventas, ingresos, gastos, clientes y dinero disponible de forma sencilla</p>
        </div>
        <button onClick={loadData} className="erp-btn-primary" style={{ background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1' }}>
          <RefreshCw size={16} /> Actualizar Datos
        </button>
      </div>

      {/* Tarjetas de Resumen Dinero Real (Fácil de entender) */}
      <div className="erp-metrics-grid">
        <div className="erp-metric-card ingresos">
          <div className="erp-metric-icon"><ArrowUpRight /></div>
          <div className="erp-metric-info">
            <h4>Total Ventas / Ingresos</h4>
            <p className="amount" style={{ color: '#0284c7' }}>${totalIngresos.toLocaleString()}</p>
          </div>
        </div>

        <div className="erp-metric-card pasivos">
          <div className="erp-metric-icon"><ArrowDownRight /></div>
          <div className="erp-metric-info">
            <h4>Gastos y Costos Operativos</h4>
            <p className="amount" style={{ color: '#ef4444' }}>${totalGastos.toLocaleString()}</p>
          </div>
        </div>

        <div className="erp-metric-card activos">
          <div className="erp-metric-icon"><BarChart3 /></div>
          <div className="erp-metric-info">
            <h4>Ganancia / Utilidad Estimada</h4>
            <p className="amount" style={{ color: utilidadNeta >= 0 ? '#10b981' : '#ef4444' }}>
              ${utilidadNeta.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Pestañas Simplificadas */}
      <div className="erp-nav-tabs">
        <button 
          className={`erp-tab-btn ${activeTab === 'resumen' ? 'active' : ''}`}
          onClick={() => setActiveTab('resumen')}
        >
          <Wallet size={18} /> Resumen de Dinero y Caja
        </button>
        <button 
          className={`erp-tab-btn ${activeTab === 'terceros' ? 'active' : ''}`}
          onClick={() => setActiveTab('terceros')}
        >
          <Users size={18} /> Clientes y Proveedores ({tercerosList.length})
        </button>
        <button 
          className={`erp-tab-btn ${activeTab === 'movimientos' ? 'active' : ''}`}
          onClick={() => setActiveTab('movimientos')}
        >
          <BarChart3 size={18} /> Historial de Movimientos
        </button>
        <button 
          className={`erp-tab-btn ${activeTab === 'puc_avanzado' ? 'active' : ''}`}
          onClick={() => setActiveTab('puc_avanzado')}
          style={{ marginLeft: 'auto', background: activeTab === 'puc_avanzado' ? undefined : '#f1f5f9' }}
        >
          <BookOpen size={18} /> Configuración Contable (PUC)
        </button>
      </div>

      {errorMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #ef4444', color: '#991b1b', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={20} /> {errorMsg}
        </div>
      )}

      {/* Pestaña 1: Resumen de Caja y Dinero Simplificado */}
      {activeTab === 'resumen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="erp-card-table">
            <div className="erp-table-header">
              <h3>💳 Estado de Caja y Disponibilidad de Dinero</h3>
              <button className="erp-btn-primary" onClick={exportBalanceExcel} style={{ background: '#166534' }}>
                <FileSpreadsheet size={16} /> Descargar Reporte Excel
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginTop: '1rem' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>💵 Dinero en Caja General</span>
                <h2 style={{ fontSize: '1.8rem', color: '#0f172a', margin: '0.5rem 0 0 0', fontWeight: 800 }}>
                  ${saldoCaja.toLocaleString()}
                </h2>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>Disponible para operaciones diarias</p>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>🏦 Dinero en Cuentas Bancarias / Pasarelas</span>
                <h2 style={{ fontSize: '1.8rem', color: '#0f172a', margin: '0.5rem 0 0 0', fontWeight: 800 }}>
                  ${saldoBancos.toLocaleString()}
                </h2>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#0284c7', fontWeight: 600 }}>Recaudos y consignaciones</p>
              </div>
            </div>
          </div>

          {/* Guía Explicativa Amigable */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '16px', padding: '1.25rem', color: '#1e3a8a', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <HelpCircle size={24} style={{ flexShrink: 0, marginTop: '2px', color: '#2563eb' }} />
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: 700, fontSize: '0.95rem' }}>¿Cómo funciona esta sección?</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#1e40af', lineHeight: 1.5 }}>
                Cada vez que un cliente realiza un pedido o un asesor aprueba un pago, el dinero se suma automáticamente a tus ingresos y a la caja. No necesitas registrar asientos ni números complicados; todo el cálculo se actualiza solo en tiempo real.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pestaña 2: Clientes y Proveedores */}
      {activeTab === 'terceros' && (
        <div className="erp-card-table">
          <div className="erp-table-header">
            <input 
              type="text"
              placeholder="Buscar por documento o nombre del cliente..."
              className="erp-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="erp-btn-primary" onClick={() => setShowTerceroModal(true)}>
              <Plus size={16} /> Registrar Cliente / Proveedor
            </button>
          </div>

          <table className="erp-table">
            <thead>
              <tr>
                <th>Documento / Identificación</th>
                <th>Nombre Completo / Razón Social</th>
                <th>Teléfono / WhatsApp</th>
                <th>Ciudad</th>
                <th>Correo</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center' }}>Cargando lista de clientes...</td></tr>
              ) : filteredTerceros.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No hay registrados aún. Los clientes se guardan automáticamente al realizar ventas.</td></tr>
              ) : (
                filteredTerceros.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.tipo_documento} {t.numero_documento}{t.dv ? `-${t.dv}` : ''}</strong></td>
                    <td style={{ color: '#0f172a', fontWeight: 600 }}>{t.razon_social}</td>
                    <td>{t.telefono || '-'}</td>
                    <td>{t.ciudad || 'Cali'}</td>
                    <td>{t.email || '-'}</td>
                    <td>
                      {t.es_cliente && <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, marginRight: '0.3rem' }}>Cliente</span>}
                      {t.es_proveedor && <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>Proveedor</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pestaña 3: Historial de Movimientos */}
      {activeTab === 'movimientos' && (
        <div className="erp-card-table">
          <div className="erp-table-header">
            <h3>Historial General de Ventas y Movimientos</h3>
            <button className="erp-btn-primary" onClick={() => setShowComprobanteModal(true)}>
              <Plus size={16} /> Registrar Movimiento Manual
            </button>
          </div>

          {loading ? (
            <p>Cargando historial...</p>
          ) : comprobantesList.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>No hay registros de movimientos en el periodo.</p>
          ) : (
            comprobantesList.map((comp) => (
              <div key={comp.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--primary-color, #6366f1)' }}>{comp.tipo_comprobante} #{comp.consecutivo}</span>
                  <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{comp.fecha} | Origen: {comp.origen_modulo}</span>
                </div>
                <p style={{ margin: '0 0 0.75rem 0', color: '#334155', fontSize: '0.9rem', fontWeight: 600 }}>{comp.concepto}</p>

                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Cuenta</th>
                      <th>Detalle de Operación</th>
                      <th style={{ textAlign: 'right' }}>Entrada ($)</th>
                      <th style={{ textAlign: 'right' }}>Salida ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.asientos?.map((a) => (
                      <tr key={a.id}>
                        <td><strong>{a.cuenta_nombre}</strong> ({a.cuenta_codigo})</td>
                        <td>{a.concepto_linea || '-'}</td>
                        <td style={{ textAlign: 'right', color: a.debito > 0 ? '#16a34a' : '#94a3b8', fontWeight: a.debito > 0 ? 700 : 400 }}>
                          {a.debito > 0 ? `$${Number(a.debito).toLocaleString()}` : '-'}
                        </td>
                        <td style={{ textAlign: 'right', color: a.credito > 0 ? '#dc2626' : '#94a3b8', fontWeight: a.credito > 0 ? 700 : 400 }}>
                          {a.credito > 0 ? `$${Number(a.credito).toLocaleString()}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pestaña 4: Configuración PUC Avanzada (Solo si se requiere para contadores) */}
      {activeTab === 'puc_avanzado' && (
        <div className="erp-card-table">
          <div className="erp-table-header">
            <div>
              <h3 style={{ margin: 0 }}>Plan Único de Cuentas (PUC Colombia)</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>Estructura oficial para contadores e informes tributarios DIAN</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text"
                placeholder="Buscar cuenta por código o nombre..."
                className="erp-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="erp-btn-primary" onClick={() => setShowCuentaModal(true)}>
                <Plus size={16} /> Crear Cuenta Auxiliar
              </button>
            </div>
          </div>

          <table className="erp-table">
            <thead>
              <tr>
                <th>Código PUC</th>
                <th>Nombre de Cuenta</th>
                <th>Nivel</th>
                <th>Tipo</th>
                <th>Naturaleza</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center' }}>Cargando catálogo contable...</td></tr>
              ) : filteredPuc.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center' }}>No se encontraron cuentas.</td></tr>
              ) : (
                filteredPuc.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: item.nivel <= 3 ? '700' : '400', color: item.nivel <= 2 ? 'var(--primary-color, #6366f1)' : '#0f172a' }}>
                      {item.codigo}
                    </td>
                    <td style={{ fontWeight: item.nivel <= 3 ? '700' : '400' }}>{item.nombre}</td>
                    <td><span style={{ fontSize: '0.75rem', background: '#e2e8f0', color: '#475569', padding: '0.2rem 0.55rem', borderRadius: '6px', fontWeight: 600 }}>Nivel {item.nivel}</span></td>
                    <td>{item.tipo}</td>
                    <td>
                      <span className={item.naturaleza === 'Débito' ? 'badge-debito' : 'badge-credito'}>
                        {item.naturaleza}
                      </span>
                    </td>
                    <td><CheckCircle2 size={16} color="#16a34a" /> Activa</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nueva Cuenta PUC */}
      {showCuentaModal && (
        <div className="erp-modal-overlay">
          <div className="erp-modal-content">
            <h3>Agregar Cuenta al PUC</h3>
            <form onSubmit={handleSaveCuenta}>
              <div className="erp-form-group">
                <label>Código PUC (Ej: 110505):</label>
                <input type="text" required className="erp-form-input" value={cuentaForm.codigo} onChange={(e) => setCuentaForm({ ...cuentaForm, codigo: e.target.value })} />
              </div>
              <div className="erp-form-group">
                <label>Nombre de la Cuenta:</label>
                <input type="text" required className="erp-form-input" value={cuentaForm.nombre} onChange={(e) => setCuentaForm({ ...cuentaForm, nombre: e.target.value })} />
              </div>
              <div className="erp-form-group">
                <label>Nivel de Cuenta:</label>
                <select className="erp-form-select" value={cuentaForm.nivel} onChange={(e) => setCuentaForm({ ...cuentaForm, nivel: Number(e.target.value) })}>
                  <option value={1}>Nivel 1 - Clase</option>
                  <option value={2}>Nivel 2 - Grupo</option>
                  <option value={3}>Nivel 3 - Cuenta</option>
                  <option value={4}>Nivel 4 - Subcuenta</option>
                  <option value={5}>Nivel 5 - Auxiliar</option>
                </select>
              </div>
              <div className="erp-form-group">
                <label>Naturaleza:</label>
                <select className="erp-form-select" value={cuentaForm.naturaleza} onChange={(e) => setCuentaForm({ ...cuentaForm, naturaleza: e.target.value })}>
                  <option value="Débito">Débito</option>
                  <option value="Crédito">Crédito</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="erp-btn-primary" style={{ background: '#94a3b8' }} onClick={() => setShowCuentaModal(false)}>Cancelar</button>
                <button type="submit" className="erp-btn-primary">Guardar Cuenta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nuevo Tercero */}
      {showTerceroModal && (
        <div className="erp-modal-overlay">
          <div className="erp-modal-content">
            <h3>Registrar Cliente o Proveedor</h3>
            <form onSubmit={handleSaveTercero}>
              <div className="erp-form-group">
                <label>Número de Documento / Cédula / NIT:</label>
                <input type="text" required className="erp-form-input" value={terceroForm.numero_documento} onChange={(e) => setTerceroForm({ ...terceroForm, numero_documento: e.target.value })} />
              </div>
              <div className="erp-form-group">
                <label>Nombre Completo / Razón Social:</label>
                <input type="text" required className="erp-form-input" value={terceroForm.razon_social} onChange={(e) => setTerceroForm({ ...terceroForm, razon_social: e.target.value })} />
              </div>
              <div className="erp-form-group">
                <label>Teléfono / WhatsApp:</label>
                <input type="text" className="erp-form-input" value={terceroForm.telefono} onChange={(e) => setTerceroForm({ ...terceroForm, telefono: e.target.value })} />
              </div>
              <div className="erp-form-group">
                <label>Correo Electrónico:</label>
                <input type="email" className="erp-form-input" value={terceroForm.email} onChange={(e) => setTerceroForm({ ...terceroForm, email: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="erp-btn-primary" style={{ background: '#94a3b8' }} onClick={() => setShowTerceroModal(false)}>Cancelar</button>
                <button type="submit" className="erp-btn-primary">Guardar Registro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Movimiento Manual */}
      {showComprobanteModal && (
        <div className="erp-modal-overlay">
          <div className="erp-modal-content" style={{ maxWidth: '750px' }}>
            <h3>Registrar Movimiento de Entrada / Salida</h3>
            <form onSubmit={handleSaveComprobante}>
              <div className="erp-form-group">
                <label>Concepto / Motivo:</label>
                <input type="text" required className="erp-form-input" value={comprobanteForm.concepto} onChange={(e) => setComprobanteForm({ ...comprobanteForm, concepto: e.target.value })} placeholder="Ej: Pago de transporte o servicio..." />
              </div>
              
              <h4 style={{ margin: '1rem 0 0.5rem 0', fontSize: '0.9rem' }}>Detalle de Operación</h4>
              {asientosForm.map((line, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input type="text" placeholder="Código PUC" className="erp-form-input" value={line.cuenta_codigo} onChange={(e) => {
                    const copy = [...asientosForm];
                    copy[idx].cuenta_codigo = e.target.value;
                    setAsientosForm(copy);
                  }} />
                  <input type="text" placeholder="Cuenta / Concepto" className="erp-form-input" value={line.cuenta_nombre} onChange={(e) => {
                    const copy = [...asientosForm];
                    copy[idx].cuenta_nombre = e.target.value;
                    setAsientosForm(copy);
                  }} />
                  <input type="number" placeholder="Entrada ($)" className="erp-form-input" value={line.debito} onChange={(e) => {
                    const copy = [...asientosForm];
                    copy[idx].debito = Number(e.target.value);
                    setAsientosForm(copy);
                  }} />
                  <input type="number" placeholder="Salida ($)" className="erp-form-input" value={line.credito} onChange={(e) => {
                    const copy = [...asientosForm];
                    copy[idx].credito = Number(e.target.value);
                    setAsientosForm(copy);
                  }} />
                </div>
              ))}

              <button type="button" className="erp-btn-primary" style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', marginTop: '0.5rem' }} onClick={() => setAsientosForm([...asientosForm, { cuenta_codigo: '', cuenta_nombre: '', debito: 0, credito: 0, concepto_linea: '' }])}>
                + Agregar Línea
              </button>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="erp-btn-primary" style={{ background: '#94a3b8' }} onClick={() => setShowComprobanteModal(false)}>Cancelar</button>
                <button type="submit" className="erp-btn-primary">Guardar Movimiento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
