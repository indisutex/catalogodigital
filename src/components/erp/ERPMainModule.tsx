import React, { useState } from 'react';
import './ERPMainModule.css';
import { ERPVentasModule }      from './ERPVentasModule';
import { ERPTesoreriaModule }   from './ERPTesoreriaModule';
import { ERPContabilidadModule } from './ERPContabilidadModule';
import { ERPInventarioModule }   from './ERPInventarioModule';
import { ERPComprasModule }      from './ERPComprasModule';
import { ERPCRMModule }          from './ERPCRMModule';
import { ERPPQRSModule }         from './ERPPQRSModule';
import {
  Landmark, BookOpen, Building2,
  ShoppingCart, Package, Users, BarChart2, ChevronRight, LifeBuoy
} from 'lucide-react';

export type ERPTab =
  | 'ventas'
  | 'tesoreria'
  | 'contabilidad'
  | 'inventario'
  | 'compras'
  | 'crm'
  | 'soporte'
  | 'nomina';

export interface Props {
  tenantId: string;
  configuracion?: any;
  activeErpTab?: ERPTab;
  setActiveErpTab?: (tab: ERPTab) => void;
  activeErpSubTab?: string;
  setActiveErpSubTab?: (subTab: string) => void;
}

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
    key: 'soporte',
    icon: <LifeBuoy size={16} />,
    label: 'Soporte & PQRS',
    sublabel: 'Tickets · Reclamos · Consultas',
    available: true
  },
  {
    key: 'nomina',
    icon: <Building2 size={16} />,
    label: 'Nómina',
    sublabel: 'Liquidación · PILA · Colillas · Primas',
    available: false,
    badge: 'Próximamente'
  },
];

export const ERPMainModule: React.FC<Props> = ({ 
  tenantId, 
  configuracion,
  activeErpTab: propActiveErpTab,
  setActiveErpTab: propSetActiveErpTab,
  activeErpSubTab
}) => {
  const [internalTab, setInternalTab] = useState<ERPTab>('ventas');

  const activeTab = propActiveErpTab || internalTab;
  const setActiveTab = (tab: ERPTab) => {
    if (propSetActiveErpTab) propSetActiveErpTab(tab);
    else setInternalTab(tab);
  };

  return (
    <div className="erp-main-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

      {/* ── Contenido del módulo activo ── */}
      <div className="erp-main-content">

        {activeTab === 'ventas' && (
          <ERPVentasModule tenantId={tenantId} activeSubTab={activeErpSubTab} />
        )}

        {activeTab === 'tesoreria' && (
          <ERPTesoreriaModule tenantId={tenantId} activeSubTab={activeErpSubTab} onNavigateTab={(tab) => setActiveTab(tab as any)} />
        )}

        {activeTab === 'contabilidad' && (
          <ERPContabilidadModule tenantId={tenantId} activeSubTab={activeErpSubTab} onNavigateTab={(tab) => setActiveTab(tab as any)} />
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

        {activeTab === 'soporte' && (
          <ERPPQRSModule tenantId={tenantId} configuracion={configuracion} />
        )}

        {/* Módulos próximos — pantalla de "coming soon" */}
        {!['ventas', 'tesoreria', 'contabilidad', 'inventario', 'compras', 'crm', 'soporte'].includes(activeTab) && (
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
