import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
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
  BookOpen,
  Receipt,
  Package,
  Search,
  X,
  Printer,
  Download,
  Send,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  tenantId: string;
  onNavigateTab?: (tab: 'ventas' | 'tesoreria' | 'contabilidad' | 'inventario') => void;
}

export const ERPContabilidadModule: React.FC<Props> = ({ tenantId }) => {
  // Pestañas principales simplificadas para el usuario
  const [activeTab, setActiveTab] = useState<'resumen' | 'terceros' | 'movimientos' | 'facturacion' | 'reportes' | 'puc_avanzado'>('resumen');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados de datos
  const [pucList, setPucList] = useState<ERPCuentaPUC[]>([]);
  const [tercerosList, setTercerosList] = useState<ERPTercero[]>([]);
  const [comprobantesList, setComprobantesList] = useState<ERPComprobanteContable[]>([]);
  const [balanceList, setBalanceList] = useState<ERPBalancePruebaItem[]>([]);
  const [inventarioList, setInventarioList] = useState<any[]>([]);
  const [pedidosList, setPedidosList] = useState<any[]>([]);

  // Filtros de búsqueda y cartera
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [carteraFilter, setCarteraFilter] = useState<'todos' | 'pendientes' | 'completados'>('todos');
  const [modoVista, setModoVista] = useState<'facil' | 'tecnico'>('facil');

  // Modales
  const [showCuentaModal, setShowCuentaModal] = useState<boolean>(false);
  const [showTerceroModal, setShowTerceroModal] = useState<boolean>(false);
  const [showComprobanteModal, setShowComprobanteModal] = useState<boolean>(false);
  const [showInventarioModal, setShowInventarioModal] = useState<boolean>(false);
  const [inventarioSearch, setInventarioSearch] = useState<string>('');

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
      const [pucData, tercerosData, diarioData, balanceData, prodsRes, pedsRes] = await Promise.all([
        ERPContabilidadService.fetchPUC(tenantId),
        ERPContabilidadService.fetchTerceros(tenantId),
        ERPContabilidadService.fetchLibroDiario(tenantId),
        ERPContabilidadService.fetchBalancePrueba(tenantId),
        supabase.from('productos').select('*').eq('tenant_id', tenantId),
        supabase.from('pedidos').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
      ]);

      setPucList(pucData);
      setTercerosList(tercerosData);
      setComprobantesList(diarioData);
      setBalanceList(balanceData);
      setInventarioList(prodsRes.data || []);
      setPedidosList(pedsRes.data || []);
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

  // Exportar Libro Contable a Excel completo
  const exportBalanceExcel = () => {
    const wsBalance = XLSX.utils.json_to_sheet(balanceList.map(b => ({
      'Código Cuenta': b.cuenta_codigo,
      'Nombre de Cuenta': b.cuenta_nombre,
      'Naturaleza': b.naturaleza,
      'Total Entradas (Débito)': b.total_debito,
      'Total Salidas (Crédito)': b.total_credito,
      'Saldo Final': b.saldo_nuevo
    })));
    const wsTerceros = XLSX.utils.json_to_sheet(tercerosList.map(t => ({
      'Documento': `${t.tipo_documento} ${t.numero_documento}`,
      'Nombre / Razón Social': t.razon_social,
      'Teléfono': t.telefono || '',
      'Ciudad': t.ciudad || '',
      'Correo': t.email || ''
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsBalance, 'Balance_NIIF');
    XLSX.utils.book_append_sheet(wb, wsTerceros, 'Directorio_Clientes');
    XLSX.writeFile(wb, `ERP_Informe_Contable_${tenantId}.xlsx`);
  };

  // Marcar pedido/cartera como cobrado y asentar en caja
  const handleMarcarCobrado = async (pedido: any) => {
    try {
      setLoading(true);
      await supabase
        .from('pedidos')
        .update({ estado: 'completado', atendido: true })
        .eq('id', pedido.id);

      await ERPContabilidadService.contabilizarVentaAutomatica(tenantId, pedido);
      alert(`✅ Venta #${pedido.id.substring(0, 8)} marcada como Cobrada e ingresada a Caja General.`);
      loadData();
    } catch (err: any) {
      alert('Error al asentar cobro: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Enviar recordatorio por WhatsApp
  const handleSendWhatsAppPaymentReminder = (pedido: any) => {
    const tel = (pedido.cliente_telefono || '').replace(/\D/g, '');
    const msg = `¡Hola ${pedido.cliente_nombre}! 👋\nTe recordamos cordialmente que tienes una factura/pedido pendiente por valor de *$${Number(pedido.total).toLocaleString('es-CO')} COP* en *${tenantId.toUpperCase()}*.\n\n¿Nos confirmas por favor si requieres los datos bancarios para realizar la transferencia? ¡Muchas gracias! 😊`;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Imprimir Informe Financiero Ejecutivo (PyG)
  const handlePrintFinancialReport = () => {
    const printWin = window.open('', '_blank', 'width=800,height=900');
    if (!printWin) return;

    const reportHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Estado de Resultados PyG - ${tenantId}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; line-height: 1.5; }
            h1 { font-size: 20px; text-transform: uppercase; margin-bottom: 4px; }
            .subtitle { color: #64748b; font-size: 13px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
            .card { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; }
            .card label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; }
            .card .val { font-size: 18px; font-weight: bold; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
            th { background: #f1f5f9; text-transform: uppercase; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <h1>INFORME FINANCIERO Y ESTADO DE RESULTADOS (PyG)</h1>
          <div class="subtitle">Empresa / Tenant: <strong>${tenantId.toUpperCase()}</strong> | Fecha de Emisión: ${new Date().toLocaleDateString()}</div>
          
          <div class="grid">
            <div class="card">
              <label>Total Ingresos Ventas</label>
              <div class="val" style="color:#0284c7;">$${totalIngresos.toLocaleString('es-CO')}</div>
            </div>
            <div class="card">
              <label>Total Costos y Gastos</label>
              <div class="val" style="color:#dc2626;">$${totalGastos.toLocaleString('es-CO')}</div>
            </div>
            <div class="card">
              <label>Utilidad Neta</label>
              <div class="val" style="color:${utilidadNeta >= 0 ? '#16a34a' : '#dc2626'};">$${utilidadNeta.toLocaleString('es-CO')}</div>
            </div>
          </div>

          <h3>Desglose del Balance de Prueba por Cuentas NIIF</h3>
          <table>
            <thead>
              <tr>
                <th>Código PUC</th>
                <th>Nombre de la Cuenta</th>
                <th>Naturaleza</th>
                <th class="text-right">Entradas (Débito)</th>
                <th class="text-right">Salidas (Crédito)</th>
                <th class="text-right">Saldo Final</th>
              </tr>
            </thead>
            <tbody>
              ${balanceList.map(b => `
                <tr>
                  <td><strong>${b.cuenta_codigo}</strong></td>
                  <td>${b.cuenta_nombre}</td>
                  <td>${b.naturaleza}</td>
                  <td class="text-right">$${b.total_debito.toLocaleString()}</td>
                  <td class="text-right">$${b.total_credito.toLocaleString()}</td>
                  <td class="text-right"><strong>$${b.saldo_nuevo.toLocaleString()}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top:40px; border-top:1px solid #cbd5e1; padding-top:10px; font-size:11px; color:#64748b; text-align:center;">
            Generado automáticamente por el Sistema ERP Contable Indisutex NIIF
          </div>
        </body>
      </html>
    `;

    printWin.document.write(reportHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 250);
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
      {/* Encabezado NIIF */}
      <div className="erp-header">
        <div>
          <h1><BookOpen size={28} color="var(--primary-color, #6366f1)" /> Contabilidad NIIF & Plan Único de Cuentas (PUC)</h1>
          <p>Libro diario, catálogo de terceros, asientos contables y balance de prueba oficial DIAN</p>
        </div>
        <button onClick={loadData} className="erp-btn-primary" style={{ background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1' }}>
          <RefreshCw size={16} /> Actualizar Libro Contable
        </button>
      </div>



      {/* Tarjetas de Resumen Contable NIIF */}
      <div className="erp-metrics-grid">
        <div className="erp-metric-card ingresos">
          <div className="erp-metric-icon"><ArrowUpRight /></div>
          <div className="erp-metric-info">
            <h4>Total Ingresos Contables (Clase 4)</h4>
            <p className="amount" style={{ color: '#0284c7' }}>${totalIngresos.toLocaleString()}</p>
          </div>
        </div>

        <div className="erp-metric-card pasivos">
          <div className="erp-metric-icon"><ArrowDownRight /></div>
          <div className="erp-metric-info">
            <h4>Costos y Gastos NIIF (Clase 5 y 6)</h4>
            <p className="amount" style={{ color: '#ef4444' }}>${totalGastos.toLocaleString()}</p>
          </div>
        </div>

        <div className="erp-metric-card activos">
          <div className="erp-metric-icon"><BarChart3 /></div>
          <div className="erp-metric-info">
            <h4>Resultado del Ejercicio</h4>
            <p className="amount" style={{ color: utilidadNeta >= 0 ? '#10b981' : '#ef4444' }}>
              ${utilidadNeta.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Pestañas Contables NIIF */}
      <div className="erp-nav-tabs" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
        <button
          className={`erp-tab-btn ${activeTab === 'resumen' ? 'active' : ''}`}
          onClick={() => setActiveTab('resumen')}
        >
          <Wallet size={18} /> Balance de Caja
        </button>
        <button
          className={`erp-tab-btn ${activeTab === 'facturacion' ? 'active' : ''}`}
          onClick={() => setActiveTab('facturacion')}
        >
          <Receipt size={18} /> Facturación & Cartera ({pedidosList.filter(p => p.estado !== 'completado').length} Pendientes)
        </button>
        <button
          className={`erp-tab-btn ${activeTab === 'reportes' ? 'active' : ''}`}
          onClick={() => setActiveTab('reportes')}
        >
          <Printer size={18} /> Informe PyG & Reportes
        </button>
        <button
          className={`erp-tab-btn ${activeTab === 'movimientos' ? 'active' : ''}`}
          onClick={() => setActiveTab('movimientos')}
        >
          <BarChart3 size={18} /> Libro Diario
        </button>
        <button
          className={`erp-tab-btn ${activeTab === 'terceros' ? 'active' : ''}`}
          onClick={() => setActiveTab('terceros')}
        >
          <Users size={18} /> Terceros NIIF ({tercerosList.length})
        </button>
        <button
          className={`erp-tab-btn ${activeTab === 'puc_avanzado' ? 'active' : ''}`}
          onClick={() => setActiveTab('puc_avanzado')}
          style={{ marginLeft: 'auto', background: activeTab === 'puc_avanzado' ? undefined : '#f1f5f9' }}
        >
          <BookOpen size={18} /> Plan PUC
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

      {/* Pestaña: Facturación & Cartera (Cuentas por Cobrar) */}
      {activeTab === 'facturacion' && (
        <div className="erp-card-table">
          <div className="erp-table-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Gestión de Facturación & Cartera por Cobrar</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                Control de pedidos emitidos, saldos pendientes y cobranzas a clientes
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`erp-btn-primary ${carteraFilter === 'todos' ? '' : 'btn-secondary'}`}
                style={{ background: carteraFilter === 'todos' ? '#0f172a' : '#f1f5f9', color: carteraFilter === 'todos' ? '#fff' : '#334155' }}
                onClick={() => setCarteraFilter('todos')}
              >
                Todas las Ventas
              </button>
              <button
                type="button"
                className="erp-btn-primary"
                style={{ background: carteraFilter === 'pendientes' ? '#d97706' : '#fffbe6', color: carteraFilter === 'pendientes' ? '#fff' : '#b45309', border: '1px solid #fde68a' }}
                onClick={() => setCarteraFilter('pendientes')}
              >
                🟡 Pendientes por Cobrar ({pedidosList.filter(p => p.estado !== 'completado').length})
              </button>
              <button
                type="button"
                className="erp-btn-primary"
                style={{ background: carteraFilter === 'completados' ? '#16a34a' : '#f0fdf4', color: carteraFilter === 'completados' ? '#fff' : '#15803d', border: '1px solid #bbf7d0' }}
                onClick={() => setCarteraFilter('completados')}
              >
                🟢 Cobrados ({pedidosList.filter(p => p.estado === 'completado').length})
              </button>
            </div>
          </div>

          <table className="erp-table">
            <thead>
              <tr>
                <th>N° Pedido / Factura</th>
                <th>Cliente</th>
                <th>Teléfono / WhatsApp</th>
                <th>Fecha</th>
                <th>Total Facturado</th>
                <th>Estado de Pago</th>
                <th style={{ textAlign: 'right' }}>Acciones de Cobro</th>
              </tr>
            </thead>
            <tbody>
              {pedidosList
                .filter(p => {
                  if (carteraFilter === 'pendientes') return p.estado !== 'completado';
                  if (carteraFilter === 'completados') return p.estado === 'completado';
                  return true;
                })
                .map((p) => {
                  const isPagado = p.estado === 'completado';
                  return (
                    <tr key={p.id}>
                      <td><strong>#{p.id.substring(0, 8)}</strong></td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{p.cliente_nombre || 'Cliente General'}</td>
                      <td>{p.cliente_telefono || '-'}</td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 800, color: '#0f172a' }}>${Number(p.total).toLocaleString('es-CO')} COP</td>
                      <td>
                        <span
                          style={{
                            background: isPagado ? '#dcfce7' : '#fef3c7',
                            color: isPagado ? '#166534' : '#b45309',
                            padding: '0.25rem 0.65rem',
                            borderRadius: '99px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          {isPagado ? '✓ Cobrado / Pagado' : '⏳ Pendiente por Cobrar'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          {!isPagado && (
                            <button
                              type="button"
                              onClick={() => handleSendWhatsAppPaymentReminder(p)}
                              style={{ background: '#25D366', color: 'white', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <Send size={12} /> Cobrar WhatsApp
                            </button>
                          )}
                          {!isPagado ? (
                            <button
                              type="button"
                              onClick={() => handleMarcarCobrado(p)}
                              style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <Check size={12} /> Marcar Pagado
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 700 }}>✅ Asentado en Caja</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pestaña: Informe PyG & Reportes Financieros */}
      {activeTab === 'reportes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="erp-card-table">
            <div className="erp-table-header">
              <div>
                <h3 style={{ margin: 0 }}>Estado de Resultados NIIF (Pérdidas y Ganancias - PyG)</h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>Resumen consolidado de rentabilidad e ingresos del negocio</p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="erp-btn-primary" onClick={handlePrintFinancialReport} style={{ background: '#0f172a' }}>
                  <Printer size={16} /> Imprimir Estado PyG
                </button>
                <button className="erp-btn-primary" onClick={exportBalanceExcel} style={{ background: '#166534' }}>
                  <Download size={16} /> Exportar Libro Excel
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginTop: '1rem' }}>
              <div style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: '16px', padding: '1.25rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 800, textTransform: 'uppercase' }}>🛒 Total Ventas (Clase 4)</span>
                <h2 style={{ fontSize: '1.6rem', color: '#0369a1', margin: '0.4rem 0 0 0', fontWeight: 800 }}>
                  ${totalIngresos.toLocaleString('es-CO')}
                </h2>
              </div>

              <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '16px', padding: '1.25rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#991b1b', fontWeight: 800, textTransform: 'uppercase' }}>📉 Costos y Gastos (Clase 5 y 6)</span>
                <h2 style={{ fontSize: '1.6rem', color: '#991b1b', margin: '0.4rem 0 0 0', fontWeight: 800 }}>
                  ${totalGastos.toLocaleString('es-CO')}
                </h2>
              </div>

              <div style={{ background: utilidadNeta >= 0 ? '#f0fdf4' : '#fef2f2', border: `1.5px solid ${utilidadNeta >= 0 ? '#bbf7d0' : '#fecaca'}`, borderRadius: '16px', padding: '1.25rem' }}>
                <span style={{ fontSize: '0.78rem', color: utilidadNeta >= 0 ? '#166534' : '#991b1b', fontWeight: 800, textTransform: 'uppercase' }}>💰 Ganancia / Utilidad Neta</span>
                <h2 style={{ fontSize: '1.6rem', color: utilidadNeta >= 0 ? '#16a34a' : '#dc2626', margin: '0.4rem 0 0 0', fontWeight: 800 }}>
                  ${utilidadNeta.toLocaleString('es-CO')}
                </h2>
              </div>
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
          <div className="erp-table-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Historial General de Ventas y Movimientos</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                {modoVista === 'facil'
                  ? '💡 Modo Sencillo: Muestra tus ventas e ingresos de forma clara sin tecnicismos.'
                  : '📐 Modo Técnico: Muestra los códigos PUC (110505, 413505) y asientos contables NIIF.'}
              </p>
            </div>

            {/* Selector de Modo de Vista */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.25rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModoVista('facil')}
                  style={{
                    border: 'none',
                    background: modoVista === 'facil' ? '#10b981' : 'transparent',
                    color: modoVista === 'facil' ? '#ffffff' : '#64748b',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: modoVista === 'facil' ? '0 2px 6px rgba(16, 185, 129, 0.3)' : 'none'
                  }}
                >
                  💡 Vista Fácil (Sencilla)
                </button>
                <button
                  type="button"
                  onClick={() => setModoVista('tecnico')}
                  style={{
                    border: 'none',
                    background: modoVista === 'tecnico' ? '#334155' : 'transparent',
                    color: modoVista === 'tecnico' ? '#ffffff' : '#64748b',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  📐 Vista Técnico NIIF (PUC)
                </button>
              </div>

              <button className="erp-btn-primary" onClick={() => setShowComprobanteModal(true)}>
                <Plus size={16} /> Registrar Movimiento Manual
              </button>
            </div>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando historial de ventas y movimientos...</p>
          ) : comprobantesList.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>No hay registros de movimientos en el periodo.</p>
          ) : modoVista === 'facil' ? (
            /* 🟢 VISTA FÁCIL Y CLARA PARA CUALQUIER USUARIO */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              {comprobantesList.map((comp) => {
                const totalMonto = comp.asientos?.reduce((max, a) => Math.max(max, Number(a.debito || 0), Number(a.credito || 0)), 0) || 0;
                const isVenta = comp.concepto.toLowerCase().includes('venta') || comp.tipo_comprobante.toLowerCase().includes('venta');
                const isEgreso = comp.concepto.toLowerCase().includes('gasto') || comp.concepto.toLowerCase().includes('pago');

                return (
                  <div
                    key={comp.id}
                    style={{
                      background: '#ffffff',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '1.1rem 1.25rem',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '14px',
                          background: isVenta ? '#dcfce7' : isEgreso ? '#fee2e2' : '#e0f2fe',
                          color: isVenta ? '#15803d' : isEgreso ? '#b91c1c' : '#0369a1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.3rem',
                          fontWeight: 800,
                          flexShrink: 0
                        }}
                      >
                        {isVenta ? '🛒' : isEgreso ? '💸' : '📄'}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '0.98rem', color: '#0f172a' }}>{comp.concepto}</strong>
                          <span
                            style={{
                              background: isVenta ? '#dcfce7' : isEgreso ? '#fee2e2' : '#f1f5f9',
                              color: isVenta ? '#166534' : isEgreso ? '#991b1b' : '#475569',
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.6rem',
                              borderRadius: '99px',
                              fontWeight: 800
                            }}
                          >
                            {isVenta ? 'ENTRADA DE DINERO (VENTA)' : isEgreso ? 'SALIDA DE DINERO (GASTO)' : 'COMPROBANTE'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
                          <span>📅 <strong>Fecha:</strong> {comp.fecha}</span>
                          <span>🧾 <strong>Registro #:</strong> {comp.consecutivo}</span>
                          <span>📍 <strong>Origen:</strong> {comp.origen_modulo}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '1.3rem',
                          fontWeight: 800,
                          color: isVenta ? '#16a34a' : isEgreso ? '#dc2626' : '#0284c7',
                          display: 'block'
                        }}
                      >
                        {isVenta ? '+' : isEgreso ? '-' : ''}${totalMonto.toLocaleString('es-CO')}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>
                        ✅ Dinero Ingresado a Caja
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 📐 VISTA TÉCNICO NIIF CON NÚMEROS PUC (PARA CONTADORES) */
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
                      <th>Cuenta PUC</th>
                      <th>Detalle de Operación</th>
                      <th style={{ textAlign: 'right' }}>Débito / Entrada ($)</th>
                      <th style={{ textAlign: 'right' }}>Crédito / Salida ($)</th>
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
      {/* Modal Inventario & Stock */}
      {showInventarioModal && (
        <div className="erp-modal-overlay">
          <div className="erp-modal-content" style={{ maxWidth: '850px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Package size={22} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Inventario & Stock de Productos ERP</h3>
              </div>
              <button onClick={() => setShowInventarioModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={22} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, position: 'relative', minWidth: '240px' }}>
                <Search size={18} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="erp-form-input"
                  style={{ paddingLeft: '2.4rem', margin: 0, width: '100%' }}
                  placeholder="Buscar referencia, producto o categoría..."
                  value={inventarioSearch}
                  onChange={e => setInventarioSearch(e.target.value)}
                />
              </div>
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                {inventarioList.filter(p => (p.nombre || '').toLowerCase().includes(inventarioSearch.toLowerCase())).length} Productos encontrados
              </span>
            </div>

            <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Producto / Referencia</th>
                    <th>Categoría</th>
                    <th>Precio de Venta</th>
                    <th>Variantes / Estampados</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {inventarioList
                    .filter(p => (p.nombre || '').toLowerCase().includes(inventarioSearch.toLowerCase()))
                    .map((item, i) => {
                      const estampadosCount = Array.isArray(item.imagenes)
                        ? new Set(item.imagenes.map((img: any) => img.estampado || img.ref).filter(Boolean)).size
                        : 0;

                      return (
                        <tr key={item.id || i}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              {item.imagen_url ? (
                                <img src={item.imagen_url} alt="" style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Package size={18} color="#94a3b8" />
                                </div>
                              )}
                              <div>
                                <strong style={{ color: '#0f172a', display: 'block' }}>{item.nombre}</strong>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Ref: {item.nombre}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
                              {item.categoria || item.categoria_id || 'General'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>
                            ${Number(item.precio_mayorista || item.precio || 0).toLocaleString('es-CO')}
                          </td>
                          <td>
                            <span style={{ fontSize: '0.8rem', color: '#0284c7', fontWeight: 600 }}>
                              {estampadosCount > 0 ? `${estampadosCount} Estampados` : 'Estándar'}
                            </span>
                          </td>
                          <td>
                            <span style={{ background: item.activo !== false ? '#dcfce7' : '#fee2e2', color: item.activo !== false ? '#15803d' : '#b91c1c', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                              {item.activo !== false ? 'Disponible' : 'Inactivo'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="erp-btn-primary" onClick={() => setShowInventarioModal(false)}>Cerrar Inventario</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
