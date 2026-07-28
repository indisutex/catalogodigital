import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Award, Send, Search, RefreshCw } from 'lucide-react';

interface Props {
  tenantId: string;
  onNavigateTab?: (tab: string) => void;
}

export const ERPCRMModule: React.FC<Props> = ({ tenantId }) => {
  const [asesores, setAsesores] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadCRMData = async () => {
    setLoading(true);
    try {
      const [aseRes, cliRes, pedRes] = await Promise.all([
        supabase.from('asesores').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
        supabase.from('clientes_exitosos').select('*').eq('tenant_id', tenantId).order('total_compras', { ascending: false }),
        supabase.from('pedidos').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
      ]);

      setAsesores(aseRes.data || []);
      setClientes(cliRes.data || []);
      setPedidos(pedRes.data || []);
    } catch (err) {
      console.error('Error al cargar módulo CRM:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCRMData();
  }, [tenantId]);

  // Ranking de Asesoras por Venta
  const asesoraStats = asesores.map(a => {
    const ventasAsesora = pedidos.filter(p => p.asesor === a.nombre || p.linea_whatsapp === `pos_${a.nombre}`);
    const totalVendido = ventasAsesora.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
    return {
      ...a,
      cantidad_ventas: ventasAsesora.length,
      total_vendido: totalVendido
    };
  }).sort((a, b) => b.total_vendido - a.total_vendido);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Users size={28} color="var(--primary-color, #6366f1)" /> Módulo CRM, Asesores & Clientes ERP
          </h1>
          <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.88rem' }}>
            Desempeño de ventas por vendedora, comisiones y directorio VIP de clientes
          </p>
        </div>

        <button onClick={loadCRMData} className="erp-btn-primary" style={{ background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={16} /> Actualizar CRM
        </button>
      </div>

      {/* Ránking de Asesoras y Vendedoras */}
      <div className="erp-card-table">
        <div className="erp-table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={22} color="#f59e0b" />
            <h3 style={{ margin: 0 }}>Tabla de Desempeño & Comisiones por Asesora</h3>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', padding: '1rem' }}>
          {asesoraStats.length === 0 ? (
            <p style={{ color: '#64748b', padding: '1rem' }}>No hay asesoras registradas aún en el sistema.</p>
          ) : (
            asesoraStats.map((a, idx) => (
              <div key={a.id} style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {a.foto_url ? (
                  <img src={a.foto_url} alt="" style={{ width: '54px', height: '54px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #cbd5e1' }} />
                ) : (
                  <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800 }}>
                    👤
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{a.nombre}</strong>
                    {idx === 0 && <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.72rem', padding: '0.1rem 0.5rem', borderRadius: '99px', fontWeight: 800 }}>👑 Top 1</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                    🛍️ {a.cantidad_ventas} Ventas Realizadas
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>
                    ${a.total_vendido.toLocaleString('es-CO')}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Directorio CRM Clientes Frecuentes */}
      <div className="erp-card-table">
        <div className="erp-table-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Directorio CRM de Clientes VIP</h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>Historial acumulado de compras por cliente</p>
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Buscar cliente por teléfono o nombre..."
              className="erp-search-input"
              style={{ paddingLeft: '2.4rem', width: '100%' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <table className="erp-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Teléfono / WhatsApp</th>
              <th>Ciudad</th>
              <th>Historial Compras</th>
              <th>Total Invertido en Tienda</th>
              <th style={{ textAlign: 'right' }}>Contacto Directo</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Cargando clientes CRM...</td></tr>
            ) : clientes.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>No se han registrado clientes aún.</td></tr>
            ) : (
              clientes
                .filter(c => (c.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || (c.telefono || '').includes(searchTerm))
                .map((c) => (
                  <tr key={c.id}>
                    <td><strong style={{ color: '#0f172a' }}>{c.nombre || 'Cliente General'}</strong></td>
                    <td>{c.telefono || '-'}</td>
                    <td>{c.ciudad || 'Cali'}</td>
                    <td>
                      <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700 }}>
                        {c.compras_exitosas || 1} Pedidos
                      </span>
                    </td>
                    <td style={{ fontWeight: 800, color: '#16a34a' }}>
                      ${Number(c.total_compras || 0).toLocaleString('es-CO')}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {c.telefono && (
                        <button
                          type="button"
                          onClick={() => {
                            const tel = c.telefono.replace(/\D/g, '');
                            window.open(`https://wa.me/${tel}`, '_blank');
                          }}
                          style={{ background: '#25D366', color: 'white', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <Send size={12} /> Contactar WhatsApp
                        </button>
                      )}
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
