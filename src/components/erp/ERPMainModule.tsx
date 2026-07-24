import React, { useState } from 'react';
import './ERPMainModule.css';
import { ERPVentasModule }      from './ERPVentasModule';
import { ERPTesoreriaModule }   from './ERPTesoreriaModule';
import { ERPContabilidadModule } from './ERPContabilidadModule';
import {
  BarChart2, Landmark, BookOpen, Building2,
  ShoppingCart, Package, Users, ChevronRight
} from 'lucide-react';

interface Props {
  tenantId: string;
}

type ERPTab =
  | 'ventas'
  | 'tesoreria'
  | 'contabilidad'
  | 'inventario'   // Fase 5 - próximamente
  | 'compras'      // Fase 6 - próximamente
  | 'nomina'       // Fase 7 - próximamente
  | 'crm';         // Fase 6 - próximamente

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
    label: 'Ventas',
    sublabel: 'Ingresos · Dashboard · Top productos',
    available: true,
    badge: 'ACTIVO'
  },
  {
    key: 'tesoreria',
    icon: <Landmark size={16} />,
    label: 'Tesorería',
    sublabel: 'Caja · Bancos · CxC · CxP · Proveedores',
    available: true,
    badge: 'ACTIVO'
  },
  {
    key: 'contabilidad',
    icon: <BookOpen size={16} />,
    label: 'Contabilidad',
    sublabel: 'PUC · Comprobantes · Balance · Libro diario',
    available: true,
    badge: 'ACTIVO'
  },
  {
    key: 'inventario',
    icon: <Package size={16} />,
    label: 'Inventario',
    sublabel: 'Kardex · Bodegas · Stock · Costo promedio',
    available: false,
    badge: 'FASE 5'
  },
  {
    key: 'compras',
    icon: <ShoppingCart size={16} />,
    label: 'Compras',
    sublabel: 'Órdenes de compra · Proveedores · CxP auto',
    available: false,
    badge: 'FASE 6'
  },
  {
    key: 'crm',
    icon: <Users size={16} />,
    label: 'CRM',
    sublabel: 'Clientes · Pipeline · Comisiones asesores',
    available: false,
    badge: 'FASE 6'
  },
  {
    key: 'nomina',
    icon: <Building2 size={16} />,
    label: 'Nómina',
    sublabel: 'Liquidación · PILA · Colillas · Primas',
    available: false,
    badge: 'FASE 7'
  },
];

export const ERPMainModule: React.FC<Props> = ({ tenantId }) => {
  const [activeTab, setActiveTab] = useState<ERPTab>('ventas');

  return (
    <div className="erp-main-container">

      {/* ── Barra de navegación superior ── */}
      <nav className="erp-main-topbar">
        <div className="erp-main-brand">
          <BarChart2 size={20} color="var(--primary-color, #6366f1)" />
          <div>
            <span>ERP Empresarial</span>
            <small>Sistema Integrado</small>
          </div>
        </div>

        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            className={`erp-nav-tab ${activeTab === item.key ? 'active' : ''} ${!item.available ? 'disabled' : ''}`}
            onClick={() => item.available && setActiveTab(item.key)}
            title={item.sublabel}
            style={{ opacity: item.available ? 1 : 0.45, cursor: item.available ? 'pointer' : 'not-allowed' }}
          >
            {item.icon}
            {item.label}
            {item.badge && (
              <span
                className="erp-nav-badge"
                style={{
                  background: item.available
                    ? 'var(--primary-color, #6366f1)'
                    : '#334155'
                }}
              >
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Contenido del módulo activo ── */}
      <div className="erp-main-content">

        {activeTab === 'ventas' && (
          <ERPVentasModule tenantId={tenantId} />
        )}

        {activeTab === 'tesoreria' && (
          <ERPTesoreriaModule tenantId={tenantId} />
        )}

        {activeTab === 'contabilidad' && (
          <ERPContabilidadModule tenantId={tenantId} />
        )}

        {/* Módulos próximos — pantalla de "coming soon" */}
        {!['ventas', 'tesoreria', 'contabilidad'].includes(activeTab) && (
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
