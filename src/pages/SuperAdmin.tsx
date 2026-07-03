import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Pedido, Producto } from '../types';
import './SuperAdmin.css';
import { Shield, TrendingUp, Package, Clock, LogOut, Building, CheckCircle, Activity, Filter, X, MessageCircle, MapPin } from 'lucide-react';

const SUPER_PIN = '9999';

export default function SuperAdmin() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('superadmin_auth') === 'true';
  });
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filtros
  const [tenantFilter, setTenantFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modal de Detalle
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [pagoModalUrl, setPagoModalUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'dashboard' | 'crm'>('dashboard');
  const [leads, setLeads] = useState<any[]>([]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const cargarDatosGlobales = async () => {
    setLoading(true);
    try {
      // 1. Cargar Pedidos
      const { data: dataPedidos, error: errorPedidos } = await supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });

      if (dataPedidos && !errorPedidos) {
        setPedidos(dataPedidos as Pedido[]);
      }

      // 2. Cargar Productos
      const { data: dataProductos, error: errorProductos } = await supabase
        .from('productos')
        .select('*');

      if (dataProductos && !errorProductos) {
        setProductos(dataProductos as Producto[]);
      }

      // 3. Cargar Leads (CRM - Carts Abandonados)
      const { data: dataLeads, error: errorLeads } = await supabase
        .from('leads')
        .select('*')
        .eq('estado', 'abandonado')
        .order('created_at', { ascending: false });

      if (dataLeads && !errorLeads) {
        setLeads(dataLeads);
      }
    } catch (err) {
      console.error(err);
      showToast('Error cargando base de datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      cargarDatosGlobales();
      const interval = setInterval(cargarDatosGlobales, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === SUPER_PIN) {
      localStorage.setItem('superadmin_auth', 'true');
      setIsAuthenticated(true);
      setErrorMsg('');
    } else {
      setErrorMsg('PIN incorrecto. Acceso denegado.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('superadmin_auth');
    setIsAuthenticated(false);
    setPin('');
  };

  const handleAtenderPedido = async (ped: Pedido) => {
    const { error } = await supabase.from('pedidos').update({ atendido: true }).eq('id', ped.id);
    if (!error) {
      setPedidos(prev => prev.map(p => p.id === ped.id ? { ...p, atendido: true } : p));
      if (selectedPedido && selectedPedido.id === ped.id) {
        setSelectedPedido(prev => prev ? { ...prev, atendido: true } : null);
      }
      showToast('Pedido marcado como atendido ✓');
    } else {
      showToast('Error al actualizar en DB', 'error');
    }
  };

  // --- LISTADO DE NEGOCIOS ÚNICOS ---
  const listadoTenants = useMemo(() => {
    const setTenants = new Set(pedidos.map(p => p.tenant_id).filter(Boolean));
    productos.forEach(p => { if (p.tenant_id) setTenants.add(p.tenant_id); });
    return Array.from(setTenants);
  }, [pedidos, productos]);

  // --- FILTRAR PEDIDOS ---
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter(p => {
      const matchTenant = tenantFilter === 'all' || p.tenant_id === tenantFilter;
      const matchStatus = statusFilter === 'all' || 
                          (statusFilter === 'atendidos' && p.atendido) || 
                          (statusFilter === 'pendientes' && !p.atendido);
      return matchTenant && matchStatus;
    });
  }, [pedidos, tenantFilter, statusFilter]);

  // --- MÉTTRICAS CON FILTRO APLICADO ---
  const stats = useMemo(() => {
    const total = pedidosFiltrados.length;
    const ventas = pedidosFiltrados.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const atendidos = pedidosFiltrados.filter(p => p.atendido).length;
    const pendientes = total - atendidos;
    const tasa = total > 0 ? Math.round((atendidos / total) * 100) : 0;

    return { total, ventas, atendidos, pendientes, tasa };
  }, [pedidosFiltrados]);

  // --- PERFORMANCE POR NEGOCIO (GLOBAL) ---
  const rendimientoNegocios = useMemo(() => {
    const porNegocio = pedidos.reduce((acc, curr) => {
      const tenant = curr.tenant_id || 'Indisutex';
      if (!acc[tenant]) {
        acc[tenant] = { count: 0, total: 0, atendidos: 0, productos: 0 };
      }
      acc[tenant].count += 1;
      acc[tenant].total += curr.total || 0;
      if (curr.atendido) acc[tenant].atendidos += 1;
      return acc;
    }, {} as Record<string, { count: number; total: number; atendidos: number; productos: number }>);

    // Sumar conteo de productos
    productos.forEach(p => {
      const tenant = p.tenant_id || 'Indisutex';
      if (!porNegocio[tenant]) {
        porNegocio[tenant] = { count: 0, total: 0, atendidos: 0, productos: 0 };
      }
      porNegocio[tenant].productos += 1;
    });

    return Object.entries(porNegocio).map(([name, data]) => ({
      name,
      ...data,
      atencionRate: data.count > 0 ? Math.round((data.atendidos / data.count) * 100) : 0
    })).sort((a, b) => b.total - a.total);
  }, [pedidos, productos]);

  // --- TOP CIUDADES ---
  const topCiudades = useMemo(() => {
    const porCiudad = pedidosFiltrados.reduce((acc, curr) => {
      const ciudad = curr.ciudad ? curr.ciudad.trim().toUpperCase() : 'DESCONOCIDA';
      if (!acc[ciudad]) acc[ciudad] = { count: 0, total: 0 };
      acc[ciudad].count += 1;
      acc[ciudad].total += curr.total || 0;
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    return Object.entries(porCiudad)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [pedidosFiltrados]);

  // --- TOP LÍNEAS WHATSAPP ---
  const topLineas = useMemo(() => {
    const porLinea = pedidosFiltrados.reduce((acc, curr) => {
      const linea = curr.linea_whatsapp || 'Sin Asignar';
      if (!acc[linea]) acc[linea] = { count: 0, total: 0 };
      acc[linea].count += 1;
      acc[linea].total += curr.total || 0;
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    return Object.entries(porLinea)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [pedidosFiltrados]);

  // --- CRM LEADS FILTERS ---
  const leadsFiltrados = useMemo(() => {
    return leads.filter(l => tenantFilter === 'all' || l.tenant_id === tenantFilter);
  }, [leads, tenantFilter]);

  const interesadosFiltrados = useMemo(() => {
    return pedidos.filter(p => !p.atendido && (tenantFilter === 'all' || p.tenant_id === tenantFilter));
  }, [pedidos, tenantFilter]);

  const clientesFiltrados = useMemo(() => {
    return pedidos.filter(p => p.atendido && (tenantFilter === 'all' || p.tenant_id === tenantFilter));
  }, [pedidos, tenantFilter]);


  if (!isAuthenticated) {
    return (
      <div className="super-auth-wrapper">
        <div className="super-auth-card">
          <div className="super-auth-icon">
            <Shield size={32} />
          </div>
          <h2>Control Central</h2>
          <p>Portal Super Administrador Indisutex</p>
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              placeholder="••••" 
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value)}
              autoFocus
            />
            {errorMsg && <p style={{ color: '#ef4444', margin: '-1rem 0 1.5rem', fontWeight: 600, fontSize: '0.85rem' }}>{errorMsg}</p>}
            <button type="submit">Autenticar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="superadmin-container" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: 'white',
          padding: '0.85rem 1.5rem',
          borderRadius: '10px',
          zIndex: 9999,
          fontWeight: 600,
          boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
        }}>
          {toast.message}
        </div>
      )}

      {/* SIDEBAR NAVIGATION (Lista de 1 columna a la izquierda) */}
      <aside className="super-sidebar" style={{ width: '260px', background: '#ffffff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, flexShrink: 0 }}>
        {/* Brand Header */}
        <div className="sidebar-brand" style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="brand-icon" style={{ width: '38px', height: '38px', background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>
            <Shield size={18} />
          </div>
          <div className="brand-text">
            <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>INDISUTEX</h2>
            <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0, fontWeight: 500 }}>Super Admin</p>
          </div>
        </div>

        {/* Navigation List (1 columna vertical) */}
        <div className="sidebar-nav" style={{ padding: '1.25rem', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <p className="sidebar-nav-label" style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', margin: '0 0 0.5rem 0', paddingLeft: '0.5rem' }}>Navegación</p>
          
          <button 
            className={`nav-item ${viewMode === 'dashboard' ? 'active' : ''}`}
            onClick={() => setViewMode('dashboard')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              width: '100%', 
              padding: '0.75rem 1rem', 
              background: viewMode === 'dashboard' ? 'rgba(99, 102, 241, 0.08)' : 'transparent', 
              border: 'none', 
              borderRadius: '12px', 
              color: viewMode === 'dashboard' ? '#6366f1' : '#64748b', 
              fontSize: '0.9rem', 
              fontWeight: 600, 
              cursor: 'pointer', 
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
          >
            <Activity size={18} /> Panel de Control
          </button>
          
          <button 
            className={`nav-item ${viewMode === 'crm' ? 'active' : ''}`}
            onClick={() => setViewMode('crm')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              width: '100%', 
              padding: '0.75rem 1rem', 
              background: viewMode === 'crm' ? 'rgba(99, 102, 241, 0.08)' : 'transparent', 
              border: 'none', 
              borderRadius: '12px', 
              color: viewMode === 'crm' ? '#6366f1' : '#64748b', 
              fontSize: '0.9rem', 
              fontWeight: 600, 
              cursor: 'pointer', 
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
          >
            📊 CRM Kanban
          </button>
        </div>

        {/* Sidebar Footer with Logout & Reload */}
        <div className="sidebar-footer" style={{ padding: '1.25rem', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button 
            onClick={cargarDatosGlobales} 
            disabled={loading}
            className="filter-select"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', width: '100%', padding: '0.6rem', fontSize: '0.8rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}
          >
            🔄 {loading ? 'Cargando...' : 'Actualizar Datos'}
          </button>
          
          <button 
            onClick={handleLogout}
            style={{ 
              width: '100%', 
              padding: '0.6rem', 
              background: '#fee2e2', 
              border: '1px solid #fca5a5', 
              color: '#dc2626', 
              borderRadius: '10px', 
              cursor: 'pointer', 
              fontWeight: 700, 
              fontSize: '0.84rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
          >
            <LogOut size={16} /> Salir
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="super-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <header className="super-header" style={{ height: '64px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
            {viewMode === 'dashboard' ? 'Panel de Analíticas' : 'Tablero CRM Kanban'}
          </h2>
          <span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '6px', fontWeight: 700, color: '#64748b' }}>
            GLOBAL
          </span>
        </header>

        <main className="super-content">
        
        {/* Barra de Filtros */}
        <div className="super-filters-bar">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div className="filter-group">
              <label><Building size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Negocio:</label>
              <select className="filter-select" value={tenantFilter} onChange={e => setTenantFilter(e.target.value)}>
                <option value="all">Todos los negocios</option>
                {listadoTenants.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label><Filter size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Estado de Pedido:</label>
              <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">Todos los estados</option>
                <option value="atendidos">Atendidos</option>
                <option value="pendientes">Pendientes / En Espera</option>
              </select>
            </div>
          </div>
        </div>

        {viewMode === 'dashboard' ? (
          <>
            {/* Métricas Globales */}
            <div className="super-metrics-grid">
              <div className="super-metric-card">
                <div className="super-metric-icon blue">
                  <TrendingUp size={24} />
                </div>
                <div className="super-metric-content">
                  <h4>Ventas Filtradas</h4>
                  <p className="value">${stats.ventas.toLocaleString()}</p>
                </div>
              </div>
              <div className="super-metric-card">
                <div className="super-metric-icon purple">
                  <Package size={24} />
                </div>
                <div className="super-metric-content">
                  <h4>Pedidos</h4>
                  <p className="value">{stats.total}</p>
                </div>
              </div>
              <div className="super-metric-card">
                <div className="super-metric-icon green">
                  <CheckCircle size={24} />
                </div>
                <div className="super-metric-content">
                  <h4>Tasa de Atención</h4>
                  <p className="value">{stats.tasa}%</p>
                </div>
              </div>
              <div className="super-metric-card">
                <div className="super-metric-icon orange">
                  <Clock size={24} />
                </div>
                <div className="super-metric-content">
                  <h4>En Espera</h4>
                  <p className="value">{stats.pendientes}</p>
                </div>
              </div>
            </div>

            {/* Tablas Principales */}
            <div className="super-panels">
              {/* Panel Flujo de Pedidos */}
              <div className="super-panel">
                <div className="super-panel-header">
                  <h3><Activity size={18} color="#4f46e5" /> Flujo de Pedidos Recientes</h3>
                </div>
                <div className="super-panel-body" style={{ padding: 0 }}>
                  <div className="super-table-container">
                    <table className="super-table interactive">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Negocio</th>
                          <th>Cliente</th>
                          <th>Total</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pedidosFiltrados.slice(0, 15).map(ped => (
                          <tr key={ped.id} onClick={() => setSelectedPedido(ped)}>
                            <td style={{ color: '#64748b', fontSize: '0.82rem' }}>
                              {new Date(ped.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td>
                              <span className="badge-tenant">{ped.tenant_id || 'Indisutex'}</span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{ped.cliente_nombre}</td>
                            <td style={{ fontWeight: 700, color: '#0f172a' }}>${ped.total.toLocaleString()}</td>
                            <td>
                              <span className={`badge-status ${ped.atendido ? 'atendido' : 'pendiente'}`}>
                                {ped.atendido ? '✓ Atendido' : '⏳ Espera'}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {pedidosFiltrados.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                              No se encontraron pedidos con los filtros aplicados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Panel Rendimiento por Negocio */}
              <div className="super-panel">
                <div className="super-panel-header">
                  <h3><Building size={18} color="#0ea5e9" /> Rendimiento por Negocio</h3>
                </div>
                <div className="super-panel-body" style={{ padding: 0 }}>
                  <div className="super-table-container">
                    <table className="super-table">
                      <thead>
                        <tr>
                          <th>Negocio</th>
                          <th>Ventas</th>
                          <th>Catálogo</th>
                          <th>Tasa Atención</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rendimientoNegocios.map(n => (
                          <tr key={n.name}>
                            <td style={{ fontWeight: 600 }}>{n.name}</td>
                            <td style={{ color: '#059669', fontWeight: 700 }}>${n.total.toLocaleString()}</td>
                            <td style={{ color: '#475569', fontSize: '0.85rem' }}>{n.productos} referencias</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '100px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{n.atencionRate}%</span>
                                <div style={{ flex: 1 }}>
                                  <div className="progress-container">
                                    <div 
                                      className="progress-bar" 
                                      style={{ 
                                        width: `${n.atencionRate}%`, 
                                        background: n.atencionRate < 50 ? '#ef4444' : n.atencionRate < 80 ? '#f59e0b' : '#10b981' 
                                      }} 
                                    />
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Estadísticas de Distribución */}
            <div className="stats-breakdown-grid">
              {/* Ciudades con mayores ventas */}
              <div className="super-panel">
                <div className="super-panel-header">
                  <h3><MapPin size={16} color="#ef4444" /> Ciudades más Activas</h3>
                </div>
                <div className="super-panel-body">
                  <div className="stats-card-list">
                    {topCiudades.map(c => (
                      <div key={c.name} className="stats-item-row">
                        <span className="stats-item-label">📍 {c.name}</span>
                        <span className="stats-item-value">{c.count} pedidos (${c.total.toLocaleString()})</span>
                      </div>
                    ))}
                    {topCiudades.length === 0 && (
                      <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>No hay registros de ciudades.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Líneas de WhatsApp más saturadas */}
              <div className="super-panel">
                <div className="super-panel-header">
                  <h3><MessageCircle size={16} color="#10b981" /> Líneas de Asignación Frecuente</h3>
                </div>
                <div className="super-panel-body">
                  <div className="stats-card-list">
                    {topLineas.map(l => (
                      <div key={l.name} className="stats-item-row">
                        <span className="stats-item-label">📞 {l.name}</span>
                        <span className="stats-item-value">{l.count} pedidos recibidos</span>
                      </div>
                    ))}
                    {topLineas.length === 0 && (
                      <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>No hay líneas registradas.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="super-crm-kanban">
            {/* Columna 1: No Interesados (Abandonos) */}
            <div className="kanban-column">
              <div className="kanban-column-header col-red">
                <h3>🔴 No Interesados (Abandonos)</h3>
                <span className="badge">{leadsFiltrados.length}</span>
              </div>
              <div className="kanban-cards-list">
                {leadsFiltrados.map((lead) => (
                  <div key={lead.id} className="kanban-card lead-card">
                    <div className="card-tenant-badge">{lead.tenant_id?.toUpperCase()}</div>
                    <h4>👤 {lead.nombre || 'Borrador Anónimo'}</h4>
                    <p className="phone">📞 {lead.telefono || 'Sin número'}</p>
                    <p className="city">📍 {lead.ciudad || 'No especificada'}</p>
                    <p className="date">📅 {new Date(lead.created_at).toLocaleDateString('es-CO', { dateStyle: 'short' })}</p>
                    {lead.telefono && (
                      <button 
                        className="btn-whatsapp-retarget"
                        onClick={() => {
                          const text = `¡Hola ${lead.nombre || ''}! 👋 Vimos que estabas mirando nuestro catálogo de *${lead.tenant_id.toUpperCase()}* y empezaste a llenar tus datos de envío pero no completaste el pedido. ¿Tuviste algún problema o tienes alguna duda con los productos? ¡Escríbenos y con gusto te ayudamos! 😊`;
                          window.open(`https://wa.me/57${lead.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                        }}
                      >
                        💬 WhatsApp Retargeting
                      </button>
                    )}
                  </div>
                ))}
                {leadsFiltrados.length === 0 && (
                  <p className="empty-column-msg">No hay carritos abandonados.</p>
                )}
              </div>
            </div>

            {/* Columna 2: Interesados (Por Pagar) */}
            <div className="kanban-column">
              <div className="kanban-column-header col-yellow">
                <h3>🟡 Interesados (Pendiente Pago)</h3>
                <span className="badge">{interesadosFiltrados.length}</span>
              </div>
              <div className="kanban-cards-list">
                {interesadosFiltrados.map((ped) => (
                  <div key={ped.id} className="kanban-card order-card">
                    <div className="card-tenant-badge">{ped.tenant_id?.toUpperCase()}</div>
                    <h4>👤 {ped.cliente_nombre}</h4>
                    <p className="phone">📞 {ped.cliente_telefono}</p>
                    <p className="total">💰 Total: <span>${ped.total.toLocaleString()}</span></p>
                    
                    {/* Lista de productos comprados */}
                    {Array.isArray(ped.productos) && ped.productos.length > 0 && (
                      <div className="card-products-summary" style={{ margin: '0.6rem 0', padding: '0.5rem 0.65rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <p style={{ margin: '0 0 0.3rem 0', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📦 Artículos:</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {ped.productos.map((prod: any, idx: number) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#334155' }}>
                              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }} title={prod.nombre}>
                                {prod.nombre} {prod.talla ? `(${prod.talla})` : ''}
                              </span>
                              <span style={{ color: '#64748b', fontWeight: 700 }}>
                                x{prod.cantidad}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="status">
                      {ped.pantallazo_url ? (
                        <span className="status-badge upload-success">✅ Comprobante Subido</span>
                      ) : (
                        <span className="status-badge upload-wait">⏳ Esperando Pago</span>
                      )}
                    </div>
                    <p className="date">📅 {new Date(ped.created_at).toLocaleDateString('es-CO', { dateStyle: 'short' })}</p>
                    <button 
                      className="btn-view-detail"
                      onClick={() => setSelectedPedido(ped)}
                    >
                      🔍 Verificar Pedido
                    </button>
                  </div>
                ))}
                {interesadosFiltrados.length === 0 && (
                  <p className="empty-column-msg">No hay pedidos pendientes.</p>
                )}
              </div>
            </div>

            {/* Columna 3: Clientes (Exitoso) */}
            <div className="kanban-column">
              <div className="kanban-column-header col-green">
                <h3>🟢 Clientes (Venta Exitosa)</h3>
                <span className="badge">{clientesFiltrados.length}</span>
              </div>
              <div className="kanban-cards-list">
                {clientesFiltrados.map((ped) => (
                  <div key={ped.id} className="kanban-card client-card">
                    <div className="card-tenant-badge">{ped.tenant_id?.toUpperCase()}</div>
                    <h4>👤 {ped.cliente_nombre}</h4>
                    <p className="phone">📞 {ped.cliente_telefono}</p>
                    <p className="total">💰 Facturado: <span>${ped.total.toLocaleString()}</span></p>

                    {/* Lista de productos comprados */}
                    {Array.isArray(ped.productos) && ped.productos.length > 0 && (
                      <div className="card-products-summary" style={{ margin: '0.6rem 0', padding: '0.5rem 0.65rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <p style={{ margin: '0 0 0.3rem 0', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📦 Artículos:</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {ped.productos.map((prod: any, idx: number) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#334155' }}>
                              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }} title={prod.nombre}>
                                {prod.nombre} {prod.talla ? `(${prod.talla})` : ''}
                              </span>
                              <span style={{ color: '#64748b', fontWeight: 700 }}>
                                x{prod.cantidad}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="status">
                      <span className="status-badge verified">✓ Pago Verificado</span>
                    </div>
                    <p className="date">📅 {new Date(ped.created_at).toLocaleDateString('es-CO', { dateStyle: 'short' })}</p>
                    <button 
                      className="btn-view-detail"
                      onClick={() => setSelectedPedido(ped)}
                    >
                      🔍 Ver Factura
                    </button>
                  </div>
                ))}
                {clientesFiltrados.length === 0 && (
                  <p className="empty-column-msg">No hay ventas exitosas aún.</p>
                )}
              </div>
            </div>
          </div>
        )}

      </main>
      </div>

      {/* MODAL DETALLE PEDIDO GLOBAL */}
      {selectedPedido && (
        <div className="modal-overlay" onClick={() => setSelectedPedido(null)} style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
            maxWidth: '600px', 
            width: '100%', 
            borderRadius: '24px', 
            padding: '2rem',
            background: '#ffffff',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.2rem', color: '#0f172a' }}>📦 Detalle del Pedido</h3>
              <button onClick={() => setSelectedPedido(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <h5 style={{ margin: '0 0 0.2rem 0', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Cliente</h5>
                <p style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>{selectedPedido.cliente_nombre}</p>
                <p style={{ margin: '0.2rem 0 0 0', color: '#475569', fontSize: '0.9rem' }}>{selectedPedido.cliente_telefono}</p>
              </div>
              <div>
                <h5 style={{ margin: '0 0 0.2rem 0', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Negocio / Línea</h5>
                <p style={{ margin: 0, fontWeight: 700, color: '#2563eb' }}>{selectedPedido.tenant_id || 'Indisutex'}</p>
                <p style={{ margin: '0.2rem 0 0 0', color: '#0ea5e9', fontSize: '0.9rem', fontWeight: 600 }}>📞 {selectedPedido.linea_whatsapp}</p>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <h5 style={{ margin: '0 0 0.2rem 0', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Dirección de Entrega</h5>
                <p style={{ margin: 0, color: '#334155' }}>{selectedPedido.direccion}, {selectedPedido.ciudad}</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Productos Solicitados</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}>
                {Array.isArray(selectedPedido.productos) && selectedPedido.productos.map((prod: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <h5 style={{ margin: 0, color: '#0f172a', fontWeight: 600 }}>{prod.nombre}</h5>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Cantidad: {prod.cantidad} {prod.talla ? ` | Talla: ${prod.talla}` : ''}
                      </span>
                    </div>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>
                      ${(prod.precio * prod.cantidad).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pantallazo de Pago */}
            {selectedPedido.pantallazo_url && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                  💳 Comprobante de Pago (Nequi)
                </h4>
                <div onClick={() => setPagoModalUrl(selectedPedido.pantallazo_url)} style={{ cursor: 'pointer' }}>
                  <img
                    src={selectedPedido.pantallazo_url}
                    alt="Comprobante Nequi"
                    style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', marginTop: '1.5rem', paddingTop: '1.5rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Total del Pedido:</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#059669' }}>
                ${selectedPedido.total.toLocaleString()}
              </span>
            </div>

            {/* Botón de Atención Maestra */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              {!selectedPedido.atendido ? (
                <button
                  style={{ 
                    flex: 1, 
                    padding: '0.85rem 1rem', 
                    background: '#10b981', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '12px', 
                    cursor: 'pointer', 
                    fontWeight: 700, 
                    fontSize: '0.95rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.5rem',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                  }}
                  onClick={() => handleAtenderPedido(selectedPedido)}
                >
                  <CheckCircle size={16} /> Marcar como Atendido
                </button>
              ) : (
                <div style={{ 
                  flex: 1, 
                  padding: '0.85rem 1rem', 
                  background: '#f0fdf4', 
                  color: '#15803d', 
                  border: '1px solid #bbf7d0', 
                  borderRadius: '12px', 
                  fontWeight: 700, 
                  textAlign: 'center',
                  fontSize: '0.95rem'
                }}>
                  ✓ Este pedido ya ha sido atendido
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL IMAGEN COMPROBANTE COMPLETA */}
      {pagoModalUrl && (
        <div className="modal-overlay" onClick={() => setPagoModalUrl(null)} style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '90%', maxHeight: '90%', background: 'none', border: 'none', padding: 0 }}>
            <img src={pagoModalUrl} alt="Pago Completo" style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px' }} />
            <button onClick={() => setPagoModalUrl(null)} style={{ display: 'block', margin: '1rem auto 0', padding: '0.5rem 2rem', background: 'white', border: 'none', borderRadius: '20px', fontWeight: 700, cursor: 'pointer' }}>
              Cerrar Vista
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
