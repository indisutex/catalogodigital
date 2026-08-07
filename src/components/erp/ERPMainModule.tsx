import React, { useState } from 'react';
import './ERPMainModule.css';
import { ERPVentasModule }      from './ERPVentasModule';
import { ERPTesoreriaModule }   from './ERPTesoreriaModule';
import { ERPContabilidadModule } from './ERPContabilidadModule';
import { ERPInventarioModule }   from './ERPInventarioModule';
import { ERPComprasModule }      from './ERPComprasModule';
import { ERPCRMModule }          from './ERPCRMModule';
import {
  Landmark, BookOpen, Building2,
  ShoppingCart, Package, Users, BarChart2, ChevronRight
} from 'lucide-react';

interface Props {
  tenantId: string;
}

type ERPTab =
  | 'ventas'
  | 'tesoreria'
  | 'contabilidad'
  | 'inventario'
  | 'compras'
  | 'nomina'
  | 'crm';

interface NavItem {
  key: ERPTab;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  available: boolean;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'ventas',
    icon: <BarChart2 size={16} />,
    label: 'Ventas & Facturación',
    sublabel: 'Ventas reales · Historial de pedidos · Top productos',
    available: true
  },
  {
    key: 'tesoreria',
    icon: <Landmark size={16} />,
    label: 'Tesorería & Bancos',
    sublabel: 'Cajas · Bancos · Cartera CxC · Proveedores CxP',
    available: true
  },
  {
    key: 'contabilidad',
    icon: <BookOpen size={16} />,
    label: 'Contabilidad NIIF',
    sublabel: 'Comprobantes · Libro diario · Balance NIIF · PUC',
    available: true
  },
  {
    key: 'inventario',
    icon: <Package size={16} />,
    label: 'Inventario',
    sublabel: 'Kardex · Valorización · Stock · Ajustes',
    available: true
  },
  {
    key: 'compras',
    icon: <ShoppingCart size={16} />,
    label: 'Compras',
    sublabel: 'Facturas proveedor · Órdenes compra · CxP',
    available: true
  },
  {
    key: 'crm',
    icon: <Users size={16} />,
    label: 'CRM & Asesores',
    sublabel: 'Clientes VIP · Comisiones asesores · Historial',
    available: true
  },
  {
    key: 'nomina',
    icon: <Building2 size={16} />,
    label: 'Nómina',
    sublabel: 'Liquidación · PILA · Colillas · Primas',
    available: false
  },
];

export const ERPMainModule: React.FC<Props> = ({ tenantId }) => {
  const [activeTab, setActiveTab] = useState<ERPTab>('ventas');

  return (
    <div className="erp-main-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
      {/* ── Header Unificado del Sistema ERP ── */}
      <div className="admin-panel" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.1rem 1.25rem', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={22} color="#0ea5e9" /> Sistema ERP Empresarial Integrado
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              {NAV_ITEMS.find(n => n.key === activeTab)?.sublabel || 'Gestión integral de finanzas, ventas e inventario'}
            </p>
          </div>

          {/* Navegación por pestañas unificada con el diseño del sitio */}
          <div style={{ display: 'flex', gap: '0.3rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: '10px', flexWrap: 'wrap' }}>
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                onClick={() => item.available && setActiveTab(item.key)}
                style={{
                  border: 'none',
                  background: activeTab === item.key ? '#ffffff' : 'transparent',
                  color: activeTab === item.key ? '#0f172a' : item.available ? '#475569' : '#94a3b8',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '7px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: item.available ? 'pointer' : 'not-allowed',
                  boxShadow: activeTab === item.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  opacity: item.available ? 1 : 0.6
                }}
              >
                {item.icon}
                <span>{item.label}</span>
                {!item.available && (
                  <span style={{ fontSize: '0.65rem', background: '#e2e8f0', color: '#64748b', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>Próximamente</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contenido del módulo activo ── */}
      <div className="erp-main-content">

        {activeTab === 'ventas' && (
          <ERPVentasModule tenantId={tenantId} />
        )}

        {activeTab === 'tesoreria' && (
          <ERPTesoreriaModule tenantId={tenantId} onNavigateTab={(tab) => setActiveTab(tab as any)} />
        )}

        {activeTab === 'contabilidad' && (
          <ERPContabilidadModule tenantId={tenantId} onNavigateTab={(tab) => setActiveTab(tab as any)} />
        )}

        {activeTab === 'inventario' && (
          <ERPInventarioModule tenantId={tenantId} onNavigateTab={(tab) => setActiveTab(tab as any)} />
        )}

        {activeTab === 'compras' && (
          <ERPComprasModule tenantId={tenantId} onNavigateTab={(tab) => setActiveTab(tab as any)} />
        )}

        {activeTab === 'crm' && (
          <ERPCRMModule tenantId={tenantId} onNavigateTab={(tab) => setActiveTab(tab as any)} />
        )}

        {/* Módulos próximos — pantalla de "coming soon" */}
        {!['ventas', 'tesoreria', 'contabilidad', 'inventario', 'compras', 'crm'].includes(activeTab) && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '70vh',
            gap: '1.5rem',
            padding: '2rem'
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: '24px',
              background: 'linear-gradient(135deg, #1e293b, #334155)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ color: '#64748b', transform: 'scale(2.2)' }}>
                {NAV_ITEMS.find(n => n.key === activeTab)?.icon}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{
                fontFamily: 'Outfit, sans-serif', fontSize: '1.5rem',
                fontWeight: 800, color: '#0f172a', margin: '0 0 .5rem'
              }}>
                {NAV_ITEMS.find(n => n.key === activeTab)?.label} — En Desarrollo
              </h2>
              <p style={{ color: '#64748b', fontSize: '.95rem', margin: 0 }}>
                {NAV_ITEMS.find(n => n.key === activeTab)?.sublabel}
              </p>
            </div>
            <div style={{
              background: '#f1f5f9', border: '1px solid #e2e8f0',
              borderRadius: '14px', padding: '1.25rem 2rem',
              display: 'flex', alignItems: 'center', gap: '.75rem'
            }}>
              <span style={{
                background: '#334155', color: '#94a3b8',
                padding: '.3rem .7rem', borderRadius: '8px',
                fontSize: '.78rem', fontWeight: 800, letterSpacing: '.05em'
              }}>
                {NAV_ITEMS.find(n => n.key === activeTab)?.badge}
              </span>
              <span style={{ color: '#475569', fontSize: '.9rem' }}>
                Este módulo estará disponible próximamente
              </span>
              <ChevronRight size={16} color="#94a3b8" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
