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
  BookOpen, 
  Users, 
  FileText, 
  BarChart3, 
  Plus, 
  CheckCircle, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  Download,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  tenantId: string;
}

export const ERPContabilidadModule: React.FC<Props> = ({ tenantId }) => {
  const [activeTab, setActiveTab] = useState<'puc' | 'terceros' | 'diario' | 'balance'>('puc');
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

  // Formulario Nuevo Comprobante Asiento Manual
  const [comprobanteForm, setComprobanteForm] = useState({
    tipo_comprobante: 'Nota Contable',
    concepto: '',
    fecha: new Date().toISOString().split('T')[0]
  });

  const [asientosForm, setAsientosForm] = useState([
    { cuenta_codigo: '110505', cuenta_nombre: 'Caja General', debito: 0, credito: 0, concepto_linea: '' },
    { cuenta_codigo: '413505', cuenta_nombre: 'Venta de Textiles', debito: 0, credito: 0, concepto_linea: '' }
  ]);

  // Cargar datos según pestaña activa
  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (activeTab === 'puc') {
        const data = await ERPContabilidadService.fetchPUC(tenantId);
        setPucList(data);
      } else if (activeTab === 'terceros') {
        const data = await ERPContabilidadService.fetchTerceros(tenantId);
        setTercerosList(data);
      } else if (activeTab === 'diario') {
        const data = await ERPContabilidadService.fetchLibroDiario(tenantId);
        setComprobantesList(data);
      } else if (activeTab === 'balance') {
        const data = await ERPContabilidadService.fetchBalancePrueba(tenantId);
        setBalanceList(data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar módulo contable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, activeTab]);

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
      'Código PUC': b.cuenta_codigo,
      'Nombre de Cuenta': b.cuenta_nombre,
      'Naturaleza': b.naturaleza,
      'Total Débito': b.total_debito,
      'Total Crédito': b.total_credito,
      'Saldo Final': b.saldo_nuevo
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Balance_de_Prueba');
    XLSX.writeFile(wb, `Balance_de_Prueba_${tenantId}.xlsx`);
  };

  // Filtros de búsqueda
  const filteredPuc = pucList.filter(p => 
    p.codigo.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTerceros = tercerosList.filter(t => 
    t.numero_documento.includes(searchTerm) || 
    t.razon_social.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Totales de Balance para validaciones
  const totalDebitosBalance = balanceList.reduce((s, i) => s + i.total_debito, 0);
  const totalCreditosBalance = balanceList.reduce((s, i) => s + i.total_credito, 0);

  return (
    <div className="erp-contabilidad-container">
      <div className="erp-header">
        <div>
          <h1><BookOpen size={28} /> Núcleo Contable ERP - PUC Colombia</h1>
          <p>Gestión unificada de Plan Único de Cuentas, Terceros, Libro Diario y Balances</p>
        </div>
        <button onClick={loadData} className="erp-btn-primary" style={{ background: '#334155' }}>
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      {/* Tarjetas resumen del Balance */}
      <div className="erp-metrics-grid">
        <div className="erp-metric-card activos">
          <div className="erp-metric-icon"><TrendingUp /></div>
          <div className="erp-metric-info">
            <h4>Total Débitos (Movimientos)</h4>
            <p className="amount">${totalDebitosBalance.toLocaleString()}</p>
          </div>
        </div>

        <div className="erp-metric-card pasivos">
          <div className="erp-metric-icon"><TrendingDown /></div>
          <div className="erp-metric-info">
            <h4>Total Créditos (Movimientos)</h4>
            <p className="amount">${totalCreditosBalance.toLocaleString()}</p>
          </div>
        </div>

        <div className="erp-metric-card ingresos">
          <div className="erp-metric-icon"><DollarSign /></div>
          <div className="erp-metric-info">
            <h4>Estado Ecuación Contable</h4>
            <p className="amount" style={{ color: Math.abs(totalDebitosBalance - totalCreditosBalance) < 0.01 ? '#34d399' : '#f87171' }}>
              {Math.abs(totalDebitosBalance - totalCreditosBalance) < 0.01 ? 'Cuadrado (0.00)' : `Descuadre: $${Math.abs(totalDebitosBalance - totalCreditosBalance).toLocaleString()}`}
            </p>
          </div>
        </div>
      </div>

      {/* Pestañas Navegación Módulo */}
      <div className="erp-nav-tabs">
        <button 
          className={`erp-tab-btn ${activeTab === 'puc' ? 'active' : ''}`}
          onClick={() => setActiveTab('puc')}
        >
          <BookOpen size={18} /> Plan Único de Cuentas (PUC)
        </button>
        <button 
          className={`erp-tab-btn ${activeTab === 'terceros' ? 'active' : ''}`}
          onClick={() => setActiveTab('terceros')}
        >
          <Users size={18} /> Maestra de Terceros
        </button>
        <button 
          className={`erp-tab-btn ${activeTab === 'diario' ? 'active' : ''}`}
          onClick={() => setActiveTab('diario')}
        >
          <FileText size={18} /> Libro Diario (Comprobantes)
        </button>
        <button 
          className={`erp-tab-btn ${activeTab === 'balance' ? 'active' : ''}`}
          onClick={() => setActiveTab('balance')}
        >
          <BarChart3 size={18} /> Balance de Prueba
        </button>
      </div>

      {errorMsg && (
        <div style={{ background: '#7f1d1d', border: '1px solid #ef4444', color: '#fca5a5', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={20} /> {errorMsg}
        </div>
      )}

      {/* Pestaña 1: Catálogo PUC */}
      {activeTab === 'puc' && (
        <div className="erp-card-table">
          <div className="erp-table-header">
            <input 
              type="text"
              placeholder="Buscar por código o nombre de cuenta..."
              className="erp-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="erp-btn-primary" onClick={() => setShowCuentaModal(true)}>
              <Plus size={16} /> Nueva Cuenta PUC
            </button>
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
                <tr><td colSpan={6} style={{ textAlign: 'center' }}>No se encontraron cuentas contables.</td></tr>
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
                    <td><CheckCircle size={16} color="#34d399" /> Activa</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pestaña 2: Maestra de Terceros */}
      {activeTab === 'terceros' && (
        <div className="erp-card-table">
          <div className="erp-table-header">
            <input 
              type="text"
              placeholder="Buscar por documento o razón social..."
              className="erp-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="erp-btn-primary" onClick={() => setShowTerceroModal(true)}>
              <Plus size={16} /> Crear Tercero
            </button>
          </div>

          <table className="erp-table">
            <thead>
              <tr>
                <th>Tipo / No. Documento</th>
                <th>Razón Social / Nombre</th>
                <th>Teléfono</th>
                <th>Ciudad</th>
                <th>Email</th>
                <th>Rol</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center' }}>Cargando maestra de terceros...</td></tr>
              ) : filteredTerceros.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center' }}>No hay terceros registrados.</td></tr>
              ) : (
                filteredTerceros.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.tipo_documento} {t.numero_documento}{t.dv ? `-${t.dv}` : ''}</strong></td>
                    <td style={{ color: '#0f172a', fontWeight: 600 }}>{t.razon_social}</td>
                    <td>{t.telefono || '-'}</td>
                    <td>{t.ciudad || 'Cali'}</td>
                    <td>{t.email || '-'}</td>
                    <td>
                      {t.es_cliente && <span style={{ background: '#0284c7', color: 'white', padding: '0.2rem 0.4rem', borderRadius: '0.25rem', fontSize: '0.7rem', marginRight: '0.2rem' }}>Cliente</span>}
                      {t.es_proveedor && <span style={{ background: '#d97706', color: 'white', padding: '0.2rem 0.4rem', borderRadius: '0.25rem', fontSize: '0.7rem' }}>Proveedor</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pestaña 3: Libro Diario */}
      {activeTab === 'diario' && (
        <div className="erp-card-table">
          <div className="erp-table-header">
            <h3>Libro Diario General - Comprobantes Asentados</h3>
            <button className="erp-btn-primary" onClick={() => setShowComprobanteModal(true)}>
              <Plus size={16} /> Asiento Manual (Partida Doble)
            </button>
          </div>

          {loading ? (
            <p>Cargando comprobantes contables...</p>
          ) : comprobantesList.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No hay comprobantes contables registrados en el periodo.</p>
          ) : (
            comprobantesList.map((comp) => (
              <div key={comp.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--primary-color, #6366f1)' }}>{comp.tipo_comprobante} #{comp.consecutivo}</span>
                  <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{comp.fecha} | Módulo: {comp.origen_modulo}</span>
                </div>
                <p style={{ margin: '0 0 0.75rem 0', color: '#334155', fontSize: '0.9rem' }}>{comp.concepto}</p>

                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Código PUC</th>
                      <th>Nombre Cuenta</th>
                      <th>Concepto Línea</th>
                      <th style={{ textAlign: 'right' }}>Débito</th>
                      <th style={{ textAlign: 'right' }}>Crédito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.asientos?.map((a) => (
                      <tr key={a.id}>
                        <td>{a.cuenta_codigo}</td>
                        <td>{a.cuenta_nombre}</td>
                        <td>{a.concepto_linea || '-'}</td>
                        <td style={{ textAlign: 'right', color: a.debito > 0 ? '#34d399' : '#64748b' }}>${Number(a.debito).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', color: a.credito > 0 ? '#f87171' : '#64748b' }}>${Number(a.credito).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pestaña 4: Balance de Prueba */}
      {activeTab === 'balance' && (
        <div className="erp-card-table">
          <div className="erp-table-header">
            <h3>Balance de Prueba de Sumas y Saldos</h3>
            <button className="erp-btn-primary" onClick={exportBalanceExcel} style={{ background: '#166534' }}>
              <Download size={16} /> Exportar Excel
            </button>
          </div>

          <table className="erp-table">
            <thead>
              <tr>
                <th>Código PUC</th>
                <th>Nombre de Cuenta</th>
                <th>Naturaleza</th>
                <th style={{ textAlign: 'right' }}>Total Débito</th>
                <th style={{ textAlign: 'right' }}>Total Crédito</th>
                <th style={{ textAlign: 'right' }}>Saldo Final</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center' }}>Generando balance...</td></tr>
              ) : balanceList.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center' }}>No existen movimientos contables asentados.</td></tr>
              ) : (
                balanceList.map((item) => (
                  <tr key={item.cuenta_codigo}>
                    <td style={{ fontWeight: 700, color: 'var(--primary-color, #6366f1)' }}>{item.cuenta_codigo}</td>
                    <td>{item.cuenta_nombre}</td>
                    <td><span className={item.naturaleza === 'Débito' ? 'badge-debito' : 'badge-credito'}>{item.naturaleza}</span></td>
                    <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>${item.total_debito.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>${item.total_credito.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>${item.saldo_nuevo.toLocaleString()}</td>
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
            <h3>Agregar Cuenta al Plan Único de Cuentas (PUC)</h3>
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
                  <option value={1}>Nivel 1 - Clase (1 dígito)</option>
                  <option value={2}>Nivel 2 - Grupo (2 dígitos)</option>
                  <option value={3}>Nivel 3 - Cuenta (4 dígitos)</option>
                  <option value={4}>Nivel 4 - Subcuenta (6 dígitos)</option>
                  <option value={5}>Nivel 5 - Auxiliar (8 dígitos)</option>
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
                <button type="button" className="erp-btn-primary" style={{ background: '#475569' }} onClick={() => setShowCuentaModal(false)}>Cancelar</button>
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
            <h3>Registrar Tercero en ERP</h3>
            <form onSubmit={handleSaveTercero}>
              <div className="erp-form-group">
                <label>Número de Documento (NIT / Cédula):</label>
                <input type="text" required className="erp-form-input" value={terceroForm.numero_documento} onChange={(e) => setTerceroForm({ ...terceroForm, numero_documento: e.target.value })} />
              </div>
              <div className="erp-form-group">
                <label>Nombre Completo / Razón Social:</label>
                <input type="text" required className="erp-form-input" value={terceroForm.razon_social} onChange={(e) => setTerceroForm({ ...terceroForm, razon_social: e.target.value })} />
              </div>
              <div className="erp-form-group">
                <label>Teléfono:</label>
                <input type="text" className="erp-form-input" value={terceroForm.telefono} onChange={(e) => setTerceroForm({ ...terceroForm, telefono: e.target.value })} />
              </div>
              <div className="erp-form-group">
                <label>Correo Electrónico:</label>
                <input type="email" className="erp-form-input" value={terceroForm.email} onChange={(e) => setTerceroForm({ ...terceroForm, email: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="erp-btn-primary" style={{ background: '#475569' }} onClick={() => setShowTerceroModal(false)}>Cancelar</button>
                <button type="submit" className="erp-btn-primary">Guardar Tercero</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nuevo Asiento Manual */}
      {showComprobanteModal && (
        <div className="erp-modal-overlay">
          <div className="erp-modal-content" style={{ maxWidth: '800px' }}>
            <h3>Registrar Comprobante de Partida Doble</h3>
            <form onSubmit={handleSaveComprobante}>
              <div className="erp-form-group">
                <label>Concepto General del Comprobante:</label>
                <input type="text" required className="erp-form-input" value={comprobanteForm.concepto} onChange={(e) => setComprobanteForm({ ...comprobanteForm, concepto: e.target.value })} placeholder="Ej: Ajuste contable de saldo inicial..." />
              </div>
              
              <h4>Líneas de Asiento (Débito y Crédito)</h4>
              {asientosForm.map((line, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input type="text" placeholder="Código PUC" className="erp-form-input" value={line.cuenta_codigo} onChange={(e) => {
                    const copy = [...asientosForm];
                    copy[idx].cuenta_codigo = e.target.value;
                    setAsientosForm(copy);
                  }} />
                  <input type="text" placeholder="Nombre Cuenta" className="erp-form-input" value={line.cuenta_nombre} onChange={(e) => {
                    const copy = [...asientosForm];
                    copy[idx].cuenta_nombre = e.target.value;
                    setAsientosForm(copy);
                  }} />
                  <input type="number" placeholder="Débito" className="erp-form-input" value={line.debito} onChange={(e) => {
                    const copy = [...asientosForm];
                    copy[idx].debito = Number(e.target.value);
                    setAsientosForm(copy);
                  }} />
                  <input type="number" placeholder="Crédito" className="erp-form-input" value={line.credito} onChange={(e) => {
                    const copy = [...asientosForm];
                    copy[idx].credito = Number(e.target.value);
                    setAsientosForm(copy);
                  }} />
                </div>
              ))}

              <button type="button" className="erp-btn-primary" style={{ background: '#334155', marginTop: '0.5rem' }} onClick={() => setAsientosForm([...asientosForm, { cuenta_codigo: '', cuenta_nombre: '', debito: 0, credito: 0, concepto_linea: '' }])}>
                + Agregar Línea
              </button>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="erp-btn-primary" style={{ background: '#475569' }} onClick={() => setShowComprobanteModal(false)}>Cancelar</button>
                <button type="submit" className="erp-btn-primary">Asentar Comprobante</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
