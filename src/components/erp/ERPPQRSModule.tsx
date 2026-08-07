import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { PQRS } from '../../types';
import {
  Search, Link, Eye, X, MessageSquare, RefreshCw
} from 'lucide-react';

interface Props {
  tenantId: string;
  configuracion?: any;
}

export const ERPPQRSModule: React.FC<Props> = ({ tenantId, configuracion }) => {
  const [listaPqrs, setListaPqrs] = useState<PQRS[]>([]);
  const [loading, setLoading] = useState(true);
  const [pqrsBusqueda, setPqrsBusqueda] = useState('');
  const [pqrsFiltroEstado, setPqrsFiltroEstado] = useState('todos');
  const [detailPqrs, setDetailPqrs] = useState<PQRS | null>(null);

  useEffect(() => {
    cargarPqrs();
  }, [tenantId]);

  async function cargarPqrs() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pqrs')
        .select('*')
        .or(`tenant_id.eq.${tenantId},tenant_id.eq.${tenantId.replace(/_/g, '-')},tenant_id.eq.${tenantId.replace(/-/g, '_')},tenant_id.is.null`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListaPqrs(data || []);
    } catch (err) {
      console.error('Error cargando PQRS en ERP:', err);
    } finally {
      setLoading(false);
    }
  }

  const formatWhatsAppLink = (phone: string, text: string) => {
    const clean = (phone || '').replace(/\D/g, '');
    const num = clean.length === 10 ? `57${clean}` : clean;
    return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  };

  const filtrados = listaPqrs.filter(p => {
    const matchEstado = pqrsFiltroEstado === 'todos' || p.estado === pqrsFiltroEstado;
    const q = pqrsBusqueda.toLowerCase().trim();
    const matchQuery = !q ||
      (p.nombre_cliente || '').toLowerCase().includes(q) ||
      (p.telefono_cliente || '').includes(q) ||
      (p.numero_pedido || '').toLowerCase().includes(q) ||
      (p.motivo || '').toLowerCase().includes(q) ||
      (p.descripcion || '').toLowerCase().includes(q);

    return matchEstado && matchQuery;
  });

  return (
    <div className="erp-pqrs-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div
          onClick={() => setPqrsFiltroEstado('todos')}
          style={{
            background: pqrsFiltroEstado === 'todos' ? 'linear-gradient(135deg, #eff6ff, #dbeafe)' : '#ffffff',
            border: `1.5px solid ${pqrsFiltroEstado === 'todos' ? '#3b82f6' : '#e2e8f0'}`,
            borderRadius: '14px',
            padding: '1.1rem 1.25rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>{listaPqrs.length}</div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginTop: '0.2rem' }}>Total Solicitudes</div>
        </div>

        <div
          onClick={() => setPqrsFiltroEstado('pendiente')}
          style={{
            background: pqrsFiltroEstado === 'pendiente' ? 'linear-gradient(135deg, #fef2f2, #fee2e2)' : '#ffffff',
            border: `1.5px solid ${pqrsFiltroEstado === 'pendiente' ? '#ef4444' : '#e2e8f0'}`,
            borderRadius: '14px',
            padding: '1.1rem 1.25rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {listaPqrs.filter(p => p.estado === 'pendiente').length}
            {listaPqrs.filter(p => p.estado === 'pendiente').length > 0 && (
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
            )}
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginTop: '0.2rem' }}>🔴 Pendientes</div>
        </div>

        <div
          onClick={() => setPqrsFiltroEstado('en_proceso')}
          style={{
            background: pqrsFiltroEstado === 'en_proceso' ? 'linear-gradient(135deg, #fffbeb, #fef3c7)' : '#ffffff',
            border: `1.5px solid ${pqrsFiltroEstado === 'en_proceso' ? '#f59e0b' : '#e2e8f0'}`,
            borderRadius: '14px',
            padding: '1.1rem 1.25rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>
            {listaPqrs.filter(p => p.estado === 'en_proceso').length}
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginTop: '0.2rem' }}>🟠 En Proceso</div>
        </div>

        <div
          onClick={() => setPqrsFiltroEstado('resuelto')}
          style={{
            background: pqrsFiltroEstado === 'resuelto' ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' : '#ffffff',
            border: `1.5px solid ${pqrsFiltroEstado === 'resuelto' ? '#10b981' : '#e2e8f0'}`,
            borderRadius: '14px',
            padding: '1.1rem 1.25rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>
            {listaPqrs.filter(p => p.estado === 'resuelto').length}
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginTop: '0.2rem' }}>🟢 Resueltos</div>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="admin-panel" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
        {/* Controls Bar */}
        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Buscar por cliente, teléfono, pedido o motivo..."
              value={pqrsBusqueda}
              onChange={e => setPqrsBusqueda(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 0.85rem 0.55rem 2.3rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.84rem', outline: 'none', background: '#f8fafc' }}
            />
            {pqrsBusqueda && (
              <button onClick={() => setPqrsBusqueda('')} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 700 }}>✕</button>
            )}
          </div>

          <button
            onClick={cargarPqrs}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer' }}
          >
            <RefreshCw size={14} className={loading ? 'spin-icon-active' : ''} /> Actualizar
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          {filtrados.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💬</div>
              <h4 style={{ margin: '0 0 0.25rem 0', color: '#0f172a' }}>No hay solicitudes de soporte</h4>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>No se encontraron registros con los filtros actuales.</p>
            </div>
          ) : (
            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9', background: '#f8fafc' }}>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Fecha</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Cliente</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Motivo</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Caso</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Adjunto</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Estado</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(pqrs => {
                  const motivoClean = (pqrs.motivo || 'General').trim();
                  const isReclamo = /reclamo|daño|defect|faltant|error/i.test(motivoClean);
                  const isQueja = /queja|demora|mal serv|mala aten/i.test(motivoClean);

                  return (
                    <tr key={pqrs.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: '#64748b' }}>
                        {new Date(pqrs.created_at).toLocaleDateString()}<br />
                        <small style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{new Date(pqrs.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#0f172a', display: 'block' }}>{pqrs.nombre_cliente}</strong>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>📞 {pqrs.telefono_cliente}</span>
                        {pqrs.numero_pedido && (
                          <div style={{ marginTop: '0.15rem' }}>
                            <span style={{ fontSize: '0.7rem', background: '#e0f2fe', color: '#0369a1', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                              Pedido: #{pqrs.numero_pedido}
                            </span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '20px',
                          background: isReclamo ? '#fee2e2' : isQueja ? '#fef3c7' : '#e0f2fe',
                          color: isReclamo ? '#dc2626' : isQueja ? '#d97706' : '#0284c7'
                        }}>
                          {motivoClean}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', maxWidth: '260px' }}>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#334155', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pqrs.descripcion}>
                          {pqrs.descripcion}
                        </p>
                        <button
                          onClick={() => setDetailPqrs(pqrs)}
                          style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', padding: 0, marginTop: '0.2rem' }}
                        >
                          Ver detalle completo
                        </button>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {pqrs.evidencia_url ? (
                          <a href={pqrs.evidencia_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Link size={12} /> Adjunto
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <select
                          value={pqrs.estado}
                          onChange={async (e) => {
                            const nuevoEstado = e.target.value;
                            setListaPqrs(prev => prev.map(p => p.id === pqrs.id ? { ...p, estado: nuevoEstado } : p));
                            await supabase.from('pqrs').update({ estado: nuevoEstado }).eq('id', pqrs.id);
                          }}
                          style={{
                            padding: '0.3rem 0.6rem',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            outline: 'none',
                            cursor: 'pointer',
                            background: pqrs.estado === 'completado' || pqrs.estado === 'resuelto' ? '#dcfce7' : pqrs.estado === 'en_proceso' ? '#fef3c7' : '#fee2e2',
                            color: pqrs.estado === 'completado' || pqrs.estado === 'resuelto' ? '#15803d' : pqrs.estado === 'en_proceso' ? '#b45309' : '#b91c1c'
                          }}
                        >
                          <option value="pendiente">🔴 Pendiente</option>
                          <option value="en_proceso">🟠 En Proceso</option>
                          <option value="resuelto">🟢 Resuelto</option>
                        </select>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <button
                          onClick={() => setDetailPqrs(pqrs)}
                          style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
                          title="Ver detalle"
                        >
                          <Eye size={14} color="#475569" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {detailPqrs && (
        <div className="detail-overlay" onClick={() => setDetailPqrs(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="detail-modal" onClick={e => e.stopPropagation()} style={{ background: '#ffffff', borderRadius: '20px', padding: '1.5rem', maxWidth: '580px', width: '92%', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <button onClick={() => setDetailPqrs(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
                {(detailPqrs.nombre_cliente || 'C').substring(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{detailPqrs.nombre_cliente}</h3>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>📞 {detailPqrs.telefono_cliente}</span>
              </div>
              <span style={{ fontSize: '0.78rem', background: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '20px', fontWeight: 700 }}>
                {detailPqrs.motivo}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.2rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', fontSize: '0.84rem' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Fecha:</span>
                <strong>{new Date(detailPqrs.created_at).toLocaleString()}</strong>
              </div>
              {detailPqrs.numero_pedido && (
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Pedido:</span>
                  <strong style={{ color: '#0ea5e9' }}>#{detailPqrs.numero_pedido}</strong>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.84rem', color: '#334155', marginBottom: '0.4rem' }}>Descripción del caso:</label>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem', fontSize: '0.88rem', color: '#1e293b', lineHeight: '1.5', whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto' }}>
                {detailPqrs.descripcion}
              </div>
            </div>

            {detailPqrs.evidencia_url && (
              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.84rem', color: '#334155', marginBottom: '0.4rem' }}>Evidencia adjunta:</label>
                <a href={detailPqrs.evidencia_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: '8px', background: '#eff6ff', color: '#0284c7', textDecoration: 'none', fontWeight: 700, fontSize: '0.82rem' }}>
                  <Link size={14} /> Abrir evidencia adjunta
                </a>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
              <a
                href={formatWhatsAppLink(detailPqrs.telefono_cliente, `Hola ${detailPqrs.nombre_cliente}, te escribimos de ${configuracion?.nombre_negocio || 'la tienda'} referente a tu solicitud de soporte: "${detailPqrs.motivo}". Estamos aquí para ayudarte.`)}
                target="_blank"
                rel="noreferrer"
                style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#25D366', color: 'white', border: 'none', borderRadius: '10px', padding: '0.7rem', fontWeight: 800, textDecoration: 'none', fontSize: '0.85rem' }}
              >
                <MessageSquare size={16} /> Abrir WhatsApp con respuesta
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
