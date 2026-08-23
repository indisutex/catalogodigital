const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.tsx');
let content = fs.readFileSync(adminPath, 'utf8');

console.log('Original content length:', content.length);

// 1. Imports
const oldImport = `import { useState, useEffect, useMemo, useRef } from 'react';`;
const newImport = `import { useState, useEffect, useMemo, useRef, useCallback } from 'react';`;

if (!content.includes(oldImport)) {
  console.error('Failed to find oldImport');
} else {
  content = content.replace(oldImport, newImport);
  console.log('Replaced imports 1');
}

const oldLucide = `Ban, ExternalLink, Flame } from 'lucide-react';`;
const newLucide = `Ban, ExternalLink, Flame, RotateCcw } from 'lucide-react';`;

if (!content.includes(oldLucide)) {
  console.error('Failed to find oldLucide');
} else {
  content = content.replace(oldLucide, newLucide);
  console.log('Replaced imports 2');
}

// 2. Card Header badge for cancelados
const oldCardHeader = `{ped.estado === 'cancelado' ? (
              <span className="pedido-card-status-pill" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: '0.72rem', fontWeight: 500, padding: '0.2rem 0.55rem', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                🚫 Cancelado
              </span>
            ) : isLead ? (`;

const newCardHeader = `{ped.estado === 'cancelado' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <span className="pedido-card-status-pill" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: '0.72rem', fontWeight: 500, padding: '0.2rem 0.55rem', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  🚫 Cancelado
                </span>
                {(() => {
                  const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
                  const now = Date.now();
                  const created = new Date(ped.created_at || now).getTime();
                  const rem = (created + RETENTION_MS) - now;
                  if (rem <= 0) return null;
                  const d = Math.floor(rem / (1000 * 60 * 60 * 24));
                  const h = Math.floor((rem % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const badgeTxt = d > 0 ? \`⏳ Se borra en \${d}d \${h}h\` : \`⏳ Se borra en \${Math.max(1, h)}h\`;
                  return (
                    <span style={{ fontSize: '0.68rem', color: '#991b1b', background: '#fee2e2', padding: '0.15rem 0.4rem', borderRadius: '6px', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>
                      {badgeTxt}
                    </span>
                  );
                })()}
              </div>
            ) : isLead ? (`;

// Normalize CRLF to LF for matching
const normalize = (str) => str.replace(/\r\n/g, '\n');

let normContent = normalize(content);

if (normContent.includes(normalize(oldCardHeader))) {
  normContent = normContent.replace(normalize(oldCardHeader), normalize(newCardHeader));
  console.log('Replaced Card Header');
} else {
  console.error('Failed to find oldCardHeader');
}

// 3. Card Actions: direct trash button for cancelados
const oldCardActions = `{ped.estado !== 'cancelado' && (
            <button 
              type="button" 
              onClick={(e) => {
                e.stopPropagation();
                handleCancelarPedido(ped.id, isLead);
              }}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: '1.5px solid #fee2e2',
                background: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#dc2626',
                flexShrink: 0
              }}
              title="Cancelar pedido (Mover a Cancelados)"
            >
              <XCircle size={16} />
            </button>
          )}`;

const newCardActions = `{ped.estado !== 'cancelado' ? (
            <button 
              type="button" 
              onClick={(e) => {
                e.stopPropagation();
                handleCancelarPedido(ped.id, isLead);
              }}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: '1.5px solid #fee2e2',
                background: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#dc2626',
                flexShrink: 0
              }}
              title="Cancelar pedido (Mover a Cancelados)"
            >
              <XCircle size={16} />
            </button>
          ) : (
            <button 
              type="button" 
              onClick={(e) => {
                e.stopPropagation();
                handleEliminarPedidoDirecto(ped.id, isLead);
              }}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: '1.5px solid #fca5a5',
                background: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#dc2626',
                flexShrink: 0
              }}
              title="Eliminar tarjeta cancelada definitivamente"
            >
              <Trash2 size={16} />
            </button>
          )}`;

if (normContent.includes(normalize(oldCardActions))) {
  normContent = normContent.replace(normalize(oldCardActions), normalize(newCardActions));
  console.log('Replaced Card Actions');
} else {
  console.error('Failed to find oldCardActions');
}

// 4. useEffect & cargarDatos with auto-purge
const oldUseEffectCargar = `  useEffect(() => {
    if (!isAuthenticated) return;
    
    cargarDatos();
    
    // Auto-refresh data cada 8 segundos como respaldo
    const interval = setInterval(() => {
      cargarDatos();
    }, 8000);

    // Suscripción Realtime a Supabase para capturar cambios instantáneos de carritos abandonados y pedidos
    const channel = supabase
      .channel('admin_realtime_leads_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        cargarDatos();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        cargarDatos();
      })
      .subscribe();
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, selectedCompany]);

  async function cargarDatos() {
    try {
      const tenant = getTenantId();
      const normT = normalizeTenantId(tenant);

      const tenantOrFilter = \`tenant_id.eq.\${tenant},tenant_id.eq.\${normT},tenant_id.eq.\${tenant.replace(/_/g, '-')},tenant_id.eq.\${tenant.replace(/-/g, '_')}\`;

      // Fetch other data in parallel
      const [catRes, subcatRes, confRes, pedRes, leadRes, cliRes, aseRes, matRes, mayRes, pqrsRes] = await Promise.all([
        supabase.from('categorias').select('*').or(tenantOrFilter).order('orden', { ascending: true }),
        supabase.from('subcategorias').select('*').or(tenantOrFilter).order('orden', { ascending: true }),
        supabase.from('configuracion').select('*').or(tenantOrFilter),
        supabase.from('pedidos').select('*').or(tenantOrFilter).order('created_at', { ascending: false }),
        supabase.from('leads').select('*').or(tenantOrFilter).order('created_at', { ascending: false }),
        supabase.from('clientes_exitosos').select('*').or(tenantOrFilter).order('total_compras', { ascending: false }),
        supabase.from('asesores').select('*').or(tenantOrFilter).order('created_at', { ascending: false }),
        supabase.from('material_apoyo').select('*').or(tenantOrFilter).order('created_at', { ascending: false }),
        supabase.from('mayoristas').select('*').or(tenantOrFilter).order('created_at', { ascending: false }),
        supabase.from('pqrs').select('*').or(tenantOrFilter).order('created_at', { ascending: false })
      ]);

      if (catRes.data) {
        let cats = [...catRes.data];
        const hasFamiliar = cats.some(c => c.slug === 'familiar' || c.nombre.toLowerCase().trim() === 'familiar');
        if (!hasFamiliar) {
          const newFamCat = {
            id: \`fam_\${tenant}_\${Date.now()}\`,
            nombre: 'Familiar',
            slug: 'familiar',
            icono: '👨‍👩‍👧‍👦',
            color: '#0284c7',
            orden: 0,
            tenant_id: tenant
          };
          cats.unshift(newFamCat as any);
          supabase.from('categorias').insert([{
            nombre: 'Familiar',
            slug: 'familiar',
            icono: '👨‍👩‍👧‍👦',
            color: '#0284c7',
            orden: 0,
            tenant_id: tenant
          }]).then(() => {});
        }
        setCategoriasData(cats);
      }
      if (subcatRes.data) setSubcategoriasData(subcatRes.data);
      if (pedRes.data) setPedidos(pedRes.data);
      if (leadRes.data) setLeads(leadRes.data);`;

const newUseEffectCargar = `  const isPurgingExpiredRef = useRef(false);

  const purgarCanceladosExpirados = useCallback(async () => {
    if (isPurgingExpiredRef.current) return;
    try {
      isPurgingExpiredRef.current = true;
      const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const cutoffDate = new Date(now - RETENTION_MS).toISOString();
      const tenant = getTenantId();
      const normT = normalizeTenantId(tenant);
      const tenantFilter = \`tenant_id.eq.\${tenant},tenant_id.eq.\${normT},tenant_id.eq.\${tenant.replace(/_/g, '-')},tenant_id.eq.\${tenant.replace(/-/g, '_')}\`;

      const [pedExpRes, leadExpRes] = await Promise.all([
        supabase.from('pedidos').select('id').or(tenantFilter).eq('estado', 'cancelado').lte('created_at', cutoffDate),
        supabase.from('leads').select('id').or(tenantFilter).eq('estado', 'cancelado').lte('created_at', cutoffDate)
      ]);

      const expiredPedIds = (pedExpRes.data || []).map((p: any) => p.id);
      const expiredLeadIds = (leadExpRes.data || []).map((l: any) => l.id);

      if (expiredPedIds.length > 0) {
        await supabase.from('pedidos').delete().in('id', expiredPedIds);
        setPedidos(prev => prev.filter(p => !expiredPedIds.includes(p.id)));
      }

      if (expiredLeadIds.length > 0) {
        await supabase.from('leads').delete().in('id', expiredLeadIds);
        setLeads(prev => prev.filter(l => !expiredLeadIds.includes(l.id)));
      }
    } catch (err) {
      console.warn('[Auto-Purge] Error purgando cancelados expirados:', err);
    } finally {
      isPurgingExpiredRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    cargarDatos();
    purgarCanceladosExpirados();
    
    // Auto-refresh data cada 8 segundos como respaldo
    const interval = setInterval(() => {
      cargarDatos();
      purgarCanceladosExpirados();
    }, 8000);

    // Suscripción Realtime a Supabase para capturar cambios instantáneos de carritos abandonados y pedidos
    const channel = supabase
      .channel('admin_realtime_leads_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        cargarDatos();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        cargarDatos();
      })
      .subscribe();
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, selectedCompany, purgarCanceladosExpirados]);

  async function cargarDatos() {
    try {
      const tenant = getTenantId();
      const normT = normalizeTenantId(tenant);

      const tenantOrFilter = \`tenant_id.eq.\${tenant},tenant_id.eq.\${normT},tenant_id.eq.\${tenant.replace(/_/g, '-')},tenant_id.eq.\${tenant.replace(/-/g, '_')}\`;

      // Fetch other data in parallel
      const [catRes, subcatRes, confRes, pedRes, leadRes, cliRes, aseRes, matRes, mayRes, pqrsRes] = await Promise.all([
        supabase.from('categorias').select('*').or(tenantOrFilter).order('orden', { ascending: true }),
        supabase.from('subcategorias').select('*').or(tenantOrFilter).order('orden', { ascending: true }),
        supabase.from('configuracion').select('*').or(tenantOrFilter),
        supabase.from('pedidos').select('*').or(tenantOrFilter).order('created_at', { ascending: false }),
        supabase.from('leads').select('*').or(tenantOrFilter).order('created_at', { ascending: false }),
        supabase.from('clientes_exitosos').select('*').or(tenantOrFilter).order('total_compras', { ascending: false }),
        supabase.from('asesores').select('*').or(tenantOrFilter).order('created_at', { ascending: false }),
        supabase.from('material_apoyo').select('*').or(tenantOrFilter).order('created_at', { ascending: false }),
        supabase.from('mayoristas').select('*').or(tenantOrFilter).order('created_at', { ascending: false }),
        supabase.from('pqrs').select('*').or(tenantOrFilter).order('created_at', { ascending: false })
      ]);

      if (catRes.data) {
        let cats = [...catRes.data];
        const hasFamiliar = cats.some(c => c.slug === 'familiar' || c.nombre.toLowerCase().trim() === 'familiar');
        if (!hasFamiliar) {
          const newFamCat = {
            id: \`fam_\${tenant}_\${Date.now()}\`,
            nombre: 'Familiar',
            slug: 'familiar',
            icono: '👨‍👩‍👧‍👦',
            color: '#0284c7',
            orden: 0,
            tenant_id: tenant
          };
          cats.unshift(newFamCat as any);
          supabase.from('categorias').insert([{
            nombre: 'Familiar',
            slug: 'familiar',
            icono: '👨‍👩‍👧‍👦',
            color: '#0284c7',
            orden: 0,
            tenant_id: tenant
          }]).then(() => {});
        }
        setCategoriasData(cats);
      }
      if (subcatRes.data) setSubcategoriasData(subcatRes.data);
      if (pedRes.data) {
        const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const activePeds = pedRes.data.filter(p => {
          if (p.estado !== 'cancelado') return true;
          return (now - new Date(p.created_at || now).getTime()) < RETENTION_MS;
        });
        const expiredPedIds = pedRes.data.filter(p => p.estado === 'cancelado' && (now - new Date(p.created_at || now).getTime()) >= RETENTION_MS).map(p => p.id);
        if (expiredPedIds.length > 0) {
          supabase.from('pedidos').delete().in('id', expiredPedIds).then(() => {});
        }
        setPedidos(activePeds);
      }
      if (leadRes.data) {
        const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const activeLeads = leadRes.data.filter(l => {
          if (l.estado !== 'cancelado') return true;
          return (now - new Date(l.created_at || now).getTime()) < RETENTION_MS;
        });
        const expiredLeadIds = leadRes.data.filter(l => l.estado === 'cancelado' && (now - new Date(l.created_at || now).getTime()) >= RETENTION_MS).map(l => l.id);
        if (expiredLeadIds.length > 0) {
          supabase.from('leads').delete().in('id', expiredLeadIds).then(() => {});
        }
        setLeads(activeLeads);
      }`;

if (normContent.includes(normalize(oldUseEffectCargar))) {
  normContent = normContent.replace(normalize(oldUseEffectCargar), normalize(newUseEffectCargar));
  console.log('Replaced useEffect & cargarDatos');
} else {
  console.error('Failed to find oldUseEffectCargar');
}

// 5. canceladosFiltrados memo
const oldCanceladosMemo = `  const canceladosFiltrados = useMemo(() => {
    const canceledOrders = allFilteredPedidos.filter(p => p.estado === 'cancelado').map(p => ({ ...p, isLead: false }));
    
    const normalizePhone = (phone?: string | null) => {
      if (!phone) return '';
      const clean = phone.replace(/\\D/g, '');
      return clean.length >= 10 ? clean.slice(-10) : clean;
    };

    let tempLeads = leads.filter(l => l.estado === 'cancelado');`;

const newCanceladosMemo = `  const canceladosFiltrados = useMemo(() => {
    const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    const canceledOrders = allFilteredPedidos
      .filter(p => p.estado === 'cancelado')
      .filter(p => (now - new Date(p.created_at || now).getTime()) < RETENTION_MS)
      .map(p => ({ ...p, isLead: false }));
    
    const normalizePhone = (phone?: string | null) => {
      if (!phone) return '';
      const clean = phone.replace(/\\D/g, '');
      return clean.length >= 10 ? clean.slice(-10) : clean;
    };

    let tempLeads = leads
      .filter(l => l.estado === 'cancelado')
      .filter(l => (now - new Date(l.created_at || now).getTime()) < RETENTION_MS);`;

if (normContent.includes(normalize(oldCanceladosMemo))) {
  normContent = normContent.replace(normalize(oldCanceladosMemo), normalize(newCanceladosMemo));
  console.log('Replaced canceladosFiltrados memo');
} else {
  console.error('Failed to find oldCanceladosMemo');
}

// 6. Direct delete, reactivate and wipe functions
const oldCancelarEnd = `      if (selectedPedido && selectedPedido.id === id) {
        setSelectedPedido(prev => prev ? { ...prev, estado: 'cancelado' } : null);
      }
      cargarDatos();
    } catch (err: any) {
      showToast('Error al cancelar pedido: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadEvidenciaCancelacion = async (e: React.ChangeEvent<HTMLInputElement>, pedidoId: string) => {`;

const newCancelarEnd = `      if (selectedPedido && selectedPedido.id === id) {
        setSelectedPedido(prev => prev ? { ...prev, estado: 'cancelado' } : null);
      }
      cargarDatos();
    } catch (err: any) {
      showToast('Error al cancelar pedido: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarPedidoDirecto = async (id: string, isLead?: boolean) => {
    if (!window.confirm('¿Estás seguro de eliminar esta tarjeta definitivamente? Esta acción no se puede deshacer.')) return;
    try {
      setLoading(true);
      if (isLead) {
        setLeads(prev => prev.filter(l => l.id !== id));
        const { error } = await supabase.from('leads').delete().eq('id', id);
        if (error) throw error;
      } else {
        setPedidos(prev => prev.filter(p => p.id !== id));
        const { error } = await supabase.from('pedidos').delete().eq('id', id);
        if (error) throw error;
      }
      if (selectedPedido && selectedPedido.id === id) {
        setSelectedPedido(null);
      }
      showToast('Tarjeta cancelada eliminada definitivamente 🗑️', 'success');
      cargarDatos();
    } catch (err: any) {
      showToast('Error al eliminar tarjeta: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReactivarPedido = async (id: string, isLead?: boolean) => {
    try {
      setLoading(true);
      if (isLead) {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, estado: 'abandonado', retargeting_estado: undefined } : l));
        await supabase.from('leads').update({ estado: 'abandonado', retargeting_estado: null }).eq('id', id);
        showToast('Lead reactivado y movido a Abandonados 🔄', 'success');
      } else {
        setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: 'pendiente' } : p));
        await supabase.from('pedidos').update({ estado: 'pendiente' }).eq('id', id);
        showToast('Pedido reactivado y movido a Pendientes 🔄', 'success');
      }
      if (selectedPedido && selectedPedido.id === id) {
        setSelectedPedido(prev => prev ? { ...prev, estado: 'pendiente' } : null);
      }
      cargarDatos();
    } catch (err: any) {
      showToast('Error al reactivar pedido: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVaciarCancelados = async () => {
    const count = canceladosFiltrados.length;
    if (count === 0) {
      showToast('No hay pedidos cancelados para eliminar.', 'info');
      return;
    }
    if (!window.confirm(\`¿Estás seguro de eliminar definitivamente TODAS las \${count} tarjetas canceladas? Esta acción no se puede deshacer.\`)) return;
    try {
      setLoading(true);
      const pedIds = canceladosFiltrados.filter(c => !c.isLead).map(c => c.id);
      const leadIds = canceladosFiltrados.filter(c => c.isLead).map(c => c.id);

      if (pedIds.length > 0) {
        await supabase.from('pedidos').delete().in('id', pedIds);
        setPedidos(prev => prev.filter(p => !pedIds.includes(p.id)));
      }
      if (leadIds.length > 0) {
        await supabase.from('leads').delete().in('id', leadIds);
        setLeads(prev => prev.filter(l => !leadIds.includes(l.id)));
      }

      if (selectedPedido && (pedIds.includes(selectedPedido.id) || leadIds.includes(selectedPedido.id))) {
        setSelectedPedido(null);
      }

      showToast(\`Se eliminaron \${count} tarjetas canceladas definitivamente ✓\`, 'success');
      cargarDatos();
    } catch (err: any) {
      showToast('Error al vaciar cancelados: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadEvidenciaCancelacion = async (e: React.ChangeEvent<HTMLInputElement>, pedidoId: string) => {`;

if (normContent.includes(normalize(oldCancelarEnd))) {
  normContent = normContent.replace(normalize(oldCancelarEnd), normalize(newCancelarEnd));
  console.log('Replaced Cancelar Actions & Add Direct Delete/Reactivate/Vaciar');
} else {
  console.error('Failed to find oldCancelarEnd');
}

// 7. Kanban Banner for cancelados
const oldKanbanBanner = `                          {/* ⏱️ Aviso de Purga Automática & Incentivo para Recuperar Venta */}
                          {(() => {
                            const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
                            const now = Date.now();
                            let shortestRemaining = Infinity;
                            
                            for (const item of canceladosFiltrados) {
                              const created = new Date(item.created_at || now).getTime();
                              const expiry = created + RETENTION_MS;
                              const rem = expiry - now;
                              if (rem < shortestRemaining) shortestRemaining = rem;
                            }

                            let timerText = '7 días';
                            if (canceladosFiltrados.length > 0 && shortestRemaining !== Infinity) {
                              if (shortestRemaining <= 0) {
                                timerText = 'menos de 1 hora';
                              } else {
                                const d = Math.floor(shortestRemaining / (1000 * 60 * 60 * 24));
                                const h = Math.floor((shortestRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                if (d > 0) {
                                  timerText = \`\${d} día\${d !== 1 ? 's' : ''} y \${h} hora\${h !== 1 ? 's' : ''}\`;
                                } else {
                                  timerText = \`\${h} hora\${h !== 1 ? 's' : ''}\`;
                                }
                              }
                            }

                            return (
                              <div style={{
                                background: '#ffffff',
                                border: '1px solid #fecaca',
                                borderRadius: '12px',
                                padding: '0.55rem 0.75rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem',
                                boxShadow: '0 1px 4px rgba(220, 38, 38, 0.05)',
                                fontFamily: "'Poppins', sans-serif"
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#991b1b', fontSize: '0.73rem', fontWeight: 500 }}>
                                  <Clock size={13} style={{ color: '#dc2626', flexShrink: 0 }} />
                                  <span>Faltan <strong style={{ fontWeight: 600, color: '#dc2626' }}>{timerText}</strong> para eliminar tarjetas</span>
                                </div>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  background: '#fff1f2',
                                  padding: '0.2rem 0.45rem',
                                  borderRadius: '6px',
                                  fontSize: '0.71rem',
                                  color: '#b91c1c',
                                  fontWeight: 500
                                }}>
                                  <span>🎯</span>
                                  <span>¡Logra incentivar esta venta!</span>
                                </div>
                              </div>
                            );
                          })()}`;

const newKanbanBanner = `                          {/* ⏱️ Aviso de Purga Automática & Acciones de Cancelados */}
                          {(() => {
                            const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
                            const now = Date.now();
                            let shortestRemaining = Infinity;
                            
                            for (const item of canceladosFiltrados) {
                              const created = new Date(item.created_at || now).getTime();
                              const expiry = created + RETENTION_MS;
                              const rem = expiry - now;
                              if (rem > 0 && rem < shortestRemaining) {
                                shortestRemaining = rem;
                              }
                            }

                            let timerText = '7 días';
                            if (canceladosFiltrados.length > 0 && shortestRemaining !== Infinity) {
                              const d = Math.floor(shortestRemaining / (1000 * 60 * 60 * 24));
                              const h = Math.floor((shortestRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                              const m = Math.floor((shortestRemaining % (1000 * 60 * 60)) / (1000 * 60));
                              if (d > 0) {
                                timerText = \`\${d} día\${d !== 1 ? 's' : ''} y \${h} h\`;
                              } else if (h > 0) {
                                timerText = \`\${h} hora\${h !== 1 ? 's' : ''} y \${m} min\`;
                              } else {
                                timerText = \`\${Math.max(1, m)} min\`;
                              }
                            }

                            return (
                              <div style={{
                                background: '#ffffff',
                                border: '1px solid #fecaca',
                                borderRadius: '12px',
                                padding: '0.6rem 0.75rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.4rem',
                                boxShadow: '0 1px 4px rgba(220, 38, 38, 0.05)',
                                fontFamily: "'Poppins', sans-serif"
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem', color: '#991b1b', fontSize: '0.73rem', fontWeight: 500 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <Clock size={13} style={{ color: '#dc2626', flexShrink: 0 }} />
                                    {canceladosFiltrados.length > 0 ? (
                                      <span>Próxima purga en: <strong style={{ fontWeight: 600, color: '#dc2626' }}>{timerText}</strong></span>
                                    ) : (
                                      <span>Autoborrado tras <strong style={{ fontWeight: 600, color: '#dc2626' }}>7 días</strong></span>
                                    )}
                                  </div>
                                  {canceladosFiltrados.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={handleVaciarCancelados}
                                      title="Vaciar todas las tarjetas canceladas definitivamente"
                                      style={{
                                        background: '#fef2f2',
                                        border: '1px solid #fca5a5',
                                        borderRadius: '6px',
                                        padding: '0.15rem 0.45rem',
                                        color: '#dc2626',
                                        fontSize: '0.68rem',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.2rem',
                                        fontFamily: "'Poppins', sans-serif"
                                      }}
                                    >
                                      <Trash2 size={11} />
                                      <span>Vaciar</span>
                                    </button>
                                  )}
                                </div>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  background: '#fff1f2',
                                  padding: '0.2rem 0.45rem',
                                  borderRadius: '6px',
                                  fontSize: '0.71rem',
                                  color: '#b91c1c',
                                  fontWeight: 500
                                }}>
                                  <span>🎯</span>
                                  <span>¡Logra incentivar esta venta o elimínala!</span>
                                </div>
                              </div>
                            );
                          })()}`;

if (normContent.includes(normalize(oldKanbanBanner))) {
  normContent = normContent.replace(normalize(oldKanbanBanner), normalize(newKanbanBanner));
  console.log('Replaced Kanban Banner');
} else {
  console.error('Failed to find oldKanbanBanner');
}

// 8. selectedPedido modal for Cancelados
const oldModalCancel = `                      {selectedPedido.estado === 'cancelado' ? (
                        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #fee2e2', paddingTop: '0.85rem' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }}>Total del Pedido Cancelado:</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 600, color: '#dc2626' }}>
                              \${selectedPedido.total.toLocaleString()}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPedido(null);
                              setShowSuccessScreen(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              background: '#ffffff',
                              color: '#64748b',
                              border: '1px solid #cbd5e1',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '0.86rem',
                              fontFamily: "'Poppins', sans-serif",
                              marginTop: '0.5rem'
                            }}
                          >
                            Cerrar Ventana
                          </button>
                        </div>
                      ) : (`;

const newModalCancel = `                      {selectedPedido.estado === 'cancelado' ? (
                        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #fee2e2', paddingTop: '0.85rem' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }}>Total del Pedido Cancelado:</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 600, color: '#dc2626' }}>
                              \${selectedPedido.total.toLocaleString()}
                            </span>
                          </div>

                          {/* Info de Retención y Purga */}
                          {(() => {
                            const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
                            const now = Date.now();
                            const created = new Date(selectedPedido.created_at || now).getTime();
                            const rem = (created + RETENTION_MS) - now;
                            let remText = 'menos de 1 hora';
                            if (rem > 0) {
                              const d = Math.floor(rem / (1000 * 60 * 60 * 24));
                              const h = Math.floor((rem % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                              if (d > 0) remText = \`\${d} día\${d !== 1 ? 's' : ''} y \${h} h\`;
                              else remText = \`\${h} hora\${h !== 1 ? 's' : ''}\`;
                            }
                            return (
                              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>
                                <Clock size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
                                <span>Esta tarjeta se eliminará automáticamente en: <strong style={{ fontWeight: 600, color: '#dc2626' }}>{remText}</strong> (retención de 7 días).</span>
                              </div>
                            );
                          })()}

                          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.3rem' }}>
                            <button
                              type="button"
                              onClick={() => handleReactivarPedido(selectedPedido.id, (selectedPedido as any).isLead)}
                              style={{
                                flex: 1,
                                padding: '0.65rem',
                                background: '#f0fdf4',
                                color: '#16a34a',
                                border: '1.5px solid #bbf7d0',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '0.82rem',
                                fontFamily: "'Poppins', sans-serif",
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <RotateCcw size={14} />
                              <span>Reactivar Pedido</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleEliminarPedidoDirecto(selectedPedido.id, (selectedPedido as any).isLead)}
                              style={{
                                flex: 1,
                                padding: '0.65rem',
                                background: '#fef2f2',
                                color: '#dc2626',
                                border: '1.5px solid #fca5a5',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '0.82rem',
                                fontFamily: "'Poppins', sans-serif",
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <Trash2 size={14} />
                              <span>Eliminar Ahora</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPedido(null);
                              setShowSuccessScreen(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '0.65rem',
                              background: '#ffffff',
                              color: '#64748b',
                              border: '1px solid #cbd5e1',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              fontWeight: 500,
                              fontSize: '0.84rem',
                              fontFamily: "'Poppins', sans-serif"
                            }}
                          >
                            Cerrar Ventana
                          </button>
                        </div>
                      ) : (`;

if (normContent.includes(normalize(oldModalCancel))) {
  normContent = normContent.replace(normalize(oldModalCancel), normalize(newModalCancel));
  console.log('Replaced selectedPedido Modal Cancel');
} else {
  console.error('Failed to find oldModalCancel');
}

fs.writeFileSync(adminPath, normContent, 'utf8');
console.log('Successfully patched Admin.tsx! New length:', normContent.length);
