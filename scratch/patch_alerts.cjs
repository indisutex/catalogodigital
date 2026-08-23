const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.tsx');
let content = fs.readFileSync(adminPath, 'utf8');

console.log('Original content length:', content.length);

const normalize = (s) => s.replace(/\r\n/g, '\n');
let normContent = normalize(content);

// 1. Add dismissedAlertIds state and handlers
const oldStateTarget = `  const [materialFilter, setMaterialFilter] = useState<string>('todos');
  const [showNotificationsPopover, setShowNotificationsPopover] = useState(false);`;

const newStateReplacement = `  const [materialFilter, setMaterialFilter] = useState<string>('todos');
  const [showNotificationsPopover, setShowNotificationsPopover] = useState(false);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(\`admin_dismissed_alerts_\${getTenantId()}\`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlertIds(prev => {
      if (prev.includes(alertId)) return prev;
      const next = [...prev, alertId];
      try {
        localStorage.setItem(\`admin_dismissed_alerts_\${getTenantId()}\`, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleDismissAllAlerts = (alertIds: string[]) => {
    setDismissedAlertIds(prev => {
      const next = Array.from(new Set([...prev, ...alertIds]));
      try {
        localStorage.setItem(\`admin_dismissed_alerts_\${getTenantId()}\`, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    showToast('Todas las alertas marcadas como resueltas ✓');
  };

  const handleAtenderNotificacion = (notif: any) => {
    handleDismissAlert(notif.id);
    if (notif.pedidoId) {
      const p = pedidos.find(item => item.id === notif.pedidoId);
      if (p) setSelectedPedido(p);
    }
    if (notif.actionTab) {
      setActiveTab(notif.actionTab);
    }
    setShowNotificationsPopover(false);
    if (viewingAdvisorAlerts) setViewingAdvisorAlerts(null);
  };`;

if (normContent.includes(normalize(oldStateTarget))) {
  normContent = normContent.replace(normalize(oldStateTarget), normalize(newStateReplacement));
  console.log('1. Replaced state target');
} else {
  console.error('Failed 1. Replaced state target');
}

// 2. Add getAdminNotifications & Update activeNotifications calculation
const oldActiveNotifTarget = `  const activeNotifications = useMemo(() => {
    if (role === 'asesor' && currentAsesor) {
      const advStats = getAdvisorStats(currentAsesor);
      return getAdvisorNotifications(currentAsesor, advStats, false);
    }
    if (role === 'mayorista' && currentMayorista) {
      const advStats = getAdvisorStats(currentMayorista);
      return getAdvisorNotifications(currentMayorista, advStats, true);
    }
    return [];
  }, [role, currentAsesor, currentMayorista, leads, pedidos]);

  const activeNotificationsCount = activeNotifications.length;`;

const newActiveNotifReplacement = `  const getAdminNotifications = () => {
    const list: any[] = [];
    const now = Date.now();

    // 1. Leads sin atender > 15 mins
    const unassignedOrLateLeads = leads.filter(l => l.retargeting_estado !== 'contactado' && l.retargeting_estado !== 'recuperado' && l.estado !== 'completado');
    unassignedOrLateLeads.forEach(l => {
      const elapsedMins = Math.floor((now - new Date(l.created_at).getTime()) / 60000);
      if (elapsedMins >= 15) {
        list.push({
          id: \`admin-lead-\${l.id}\`,
          leadId: l.id,
          type: 'warning',
          title: '⚠️ Carrito Abandonado sin Atender',
          message: \`El cliente "\${l.nombre || 'Anónimo'}" lleva \${elapsedMins} min sin atención en Carritos Abandonados.\`,
          actionTab: 'pedidos',
          time: l.created_at
        });
      }
    });

    // 2. Pedidos pendientes sin atender > 10 mins
    const lateOrders = pedidos.filter(p => p.estado === 'pendiente' && !p.atendido);
    lateOrders.forEach(o => {
      const elapsedMins = Math.floor((now - new Date(o.created_at).getTime()) / 60000);
      if (elapsedMins >= 10) {
        list.push({
          id: \`admin-order-\${o.id}\`,
          pedidoId: o.id,
          type: 'danger',
          title: '📞 Pedido Pendiente de Atención',
          message: \`El cliente "\${o.cliente_nombre}" realizó un pedido hace \${elapsedMins} min y no ha sido atendido.\`,
          actionTab: 'pedidos',
          time: o.created_at
        });
      }
    });

    // 3. PQRS pendientes
    const pendingPqrs = listaPqrs.filter(p => p.estado === 'pendiente');
    pendingPqrs.forEach(pq => {
      list.push({
        id: \`admin-pqrs-\${pq.id}\`,
        type: 'warning',
        title: \`📩 PQRS: \${(pq.tipo || '').toUpperCase()}\`,
        message: \`Cliente \${pq.nombre_cliente} (\${pq.telefono}) radicó un \${pq.tipo}. Requiere respuesta.\`,
        actionTab: 'pqrs',
        time: pq.created_at
      });
    });

    // 4. Stock bajo
    const lowStock = productos.filter(p => p.stock !== undefined && p.stock !== null && p.stock <= 2);
    if (lowStock.length > 0) {
      list.push({
        id: \`admin-low-stock-\${lowStock.length}\`,
        type: 'info',
        title: '📦 Productos con Stock Bajo',
        message: \`Tienes \${lowStock.length} producto\${lowStock.length > 1 ? 's' : ''} con 2 o menos unidades en inventario.\`,
        actionTab: 'productos',
        time: new Date().toISOString()
      });
    }

    return list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  };

  const activeNotifications = useMemo(() => {
    let rawList: any[] = [];
    if (role === 'asesor' && currentAsesor) {
      const advStats = getAdvisorStats(currentAsesor);
      rawList = getAdvisorNotifications(currentAsesor, advStats, false);
    } else if (role === 'mayorista' && currentMayorista) {
      const advStats = getAdvisorStats(currentMayorista);
      rawList = getAdvisorNotifications(currentMayorista, advStats, true);
    } else if (role === 'admin') {
      rawList = getAdminNotifications();
    }
    return rawList.filter(n => !dismissedAlertIds.includes(n.id));
  }, [role, currentAsesor, currentMayorista, leads, pedidos, productos, listaPqrs, dismissedAlertIds]);

  const activeNotificationsCount = activeNotifications.length;`;

if (normContent.includes(normalize(oldActiveNotifTarget))) {
  normContent = normContent.replace(normalize(oldActiveNotifTarget), normalize(newActiveNotifReplacement));
  console.log('2. Replaced activeNotifications calculation');
} else {
  console.error('Failed 2. Replaced activeNotifications calculation');
}

// 3. Include leadId and pedidoId in getAdvisorNotifications
const oldGetAdvLeads = `    myLeads.forEach(l => {
      const elapsedMins = Math.floor((now - new Date(l.created_at).getTime()) / 60000);
      if (elapsedMins >= 15) {
        list.push({
          id: \`lead-\${l.id}\`,
          type: 'warning',
          title: '⚠️ Demora en Carrito Abandonado',
          message: \`Llevas \${elapsedMins} minutos sin atender al cliente "\${l.nombre || 'Anónimo'}". ¡Recupéralo antes de que se enfríe!\`,
          actionTab: 'pedidos',
          time: l.created_at
        });
      }
    });`;

const newGetAdvLeads = `    myLeads.forEach(l => {
      const elapsedMins = Math.floor((now - new Date(l.created_at).getTime()) / 60000);
      if (elapsedMins >= 15) {
        list.push({
          id: \`lead-\${l.id}\`,
          leadId: l.id,
          type: 'warning',
          title: '⚠️ Demora en Carrito Abandonado',
          message: \`Llevas \${elapsedMins} minutos sin atender al cliente "\${l.nombre || 'Anónimo'}". ¡Recupéralo antes de que se enfríe!\`,
          actionTab: 'pedidos',
          time: l.created_at
        });
      }
    });`;

if (normContent.includes(normalize(oldGetAdvLeads))) {
  normContent = normContent.replace(normalize(oldGetAdvLeads), normalize(newGetAdvLeads));
  console.log('3. Replaced getAdvisorNotifications leads');
} else {
  console.error('Failed 3. Replaced getAdvisorNotifications leads');
}

const oldGetAdvOrders = `    myOrders.forEach(o => {
      const elapsedMins = Math.floor((now - new Date(o.created_at).getTime()) / 60000);
      if (!o.atendido && elapsedMins >= 10) {
        list.push({
          id: \`order-atender-\${o.id}\`,
          type: 'danger',
          title: '📞 Cliente Esperando Atención',
          message: \`El cliente "\${o.cliente_nombre}" realizó un pedido hace \${elapsedMins} minutos y aún no ha sido atendido.\`,
          actionTab: 'pedidos',
          time: o.created_at
        });
      } else if (o.atendido && !o.pantallazo_url && elapsedMins >= 45) {
        list.push({
          id: \`order-espera-\${o.id}\`,
          type: 'info',
          title: '⏳ Esperando Comprobante',
          message: \`Hace \${elapsedMins} minutos atendiste a "\${o.cliente_nombre}", pero no ha subido comprobante. Escríbele para ofrecerle otro medio de pago.\`,
          actionTab: 'pedidos',
          time: o.created_at
        });
      }
    });`;

const newGetAdvOrders = `    myOrders.forEach(o => {
      const elapsedMins = Math.floor((now - new Date(o.created_at).getTime()) / 60000);
      if (!o.atendido && elapsedMins >= 10) {
        list.push({
          id: \`order-atender-\${o.id}\`,
          pedidoId: o.id,
          type: 'danger',
          title: '📞 Cliente Esperando Atención',
          message: \`El cliente "\${o.cliente_nombre}" realizó un pedido hace \${elapsedMins} minutos y aún no ha sido atendido.\`,
          actionTab: 'pedidos',
          time: o.created_at
        });
      } else if (o.atendido && !o.pantallazo_url && elapsedMins >= 45) {
        list.push({
          id: \`order-espera-\${o.id}\`,
          pedidoId: o.id,
          type: 'info',
          title: '⏳ Esperando Comprobante',
          message: \`Hace \${elapsedMins} minutos atendiste a "\${o.cliente_nombre}", pero no ha subido comprobante. Escríbele para ofrecerle otro medio de pago.\`,
          actionTab: 'pedidos',
          time: o.created_at
        });
      }
    });`;

if (normContent.includes(normalize(oldGetAdvOrders))) {
  normContent = normContent.replace(normalize(oldGetAdvOrders), normalize(newGetAdvOrders));
  console.log('4. Replaced getAdvisorNotifications orders');
} else {
  console.error('Failed 4. Replaced getAdvisorNotifications orders');
}

// 5. Update Top Bar Notification Bell & Popover
const oldTopBarBell = `            {(role === 'asesor' || role === 'mayorista') && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowNotificationsPopover(!showNotificationsPopover)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.55rem',
                    borderRadius: '10px',
                    border: showNotificationsPopover ? '1px solid #fee2e2' : '1px solid #cbd5e1',
                    cursor: 'pointer',
                    background: showNotificationsPopover ? '#fee2e2' : 'white',
                    color: showNotificationsPopover ? '#ef4444' : '#475569',
                    position: 'relative',
                    transition: 'all 0.2s',
                    width: '38px',
                    height: '38px',
                    flexShrink: 0
                  }}
                  title="Notificaciones y Alertas"
                >
                  <Bell size={18} className={activeNotificationsCount > 0 ? 'pulse-bell' : ''} style={{ color: activeNotificationsCount > 0 ? '#ef4444' : 'inherit' }} />
                  {activeNotificationsCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      background: '#ef4444',
                      color: 'white',
                      fontSize: '0.65rem',
                      padding: '2px 5px',
                      borderRadius: '50%',
                      fontWeight: 800,
                      border: '2px solid white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '18px',
                      height: '18px'
                    }}>
                      {activeNotificationsCount}
                    </span>
                  )}
                </button>
                
                {showNotificationsPopover && (
                  <div style={{
                    position: 'absolute',
                    top: '120%',
                    right: 0,
                    width: '320px',
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {/* Header Popover */}
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>🔔 Centro de Notificaciones</h4>
                      <span style={{ fontSize: '0.75rem', background: '#fee2e2', color: '#ef4444', padding: '0.15rem 0.5rem', borderRadius: '12px', fontWeight: 700 }}>{activeNotificationsCount} nuevas</span>
                    </div>

                    {/* Lista Notificaciones */}
                    <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '0.5rem' }}>
                      {activeNotifications.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                           ¡Todo al día! No tienes notificaciones pendientes.
                        </div>
                      ) : (
                        activeNotifications.map((notif: any) => {
                          const isDanger = notif.type === 'danger';
                          const isWarning = notif.type === 'warning';
                          const isSuccess = notif.type === 'success';
                          const primaryColor = configuracion?.color_primario || '#6366f1';
                          
                          return (
                            <div key={notif.id} style={{
                              padding: '0.75rem',
                              borderBottom: '1px solid #f1f5f9',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                              background: isDanger ? '#fef2f2' : isWarning ? '#fffbeb' : 'transparent',
                              borderRadius: '8px',
                              marginBottom: '0.25rem'
                            }}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '1.1rem' }}>
                                  {isDanger ? '🔴' : isWarning ? '🟡' : isSuccess ? '🟢' : '🔵'}
                                </span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                  <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>{notif.title}</h4>
                                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: 1.3 }}>{notif.message}</p>
                                </div>
                              </div>
                              {notif.actionTab && (
                                <button
                                  onClick={() => {
                                    setActiveTab(notif.actionTab);
                                    setShowNotificationsPopover(false);
                                  }}
                                  style={{
                                    background: isDanger ? '#ef4444' : isWarning ? '#f59e0b' : primaryColor,
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.3rem 0.65rem',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    alignSelf: 'flex-end'
                                  }}
                                >
                                  Ver Detalle →
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}`;

const newTopBarBell = `            {isAuthenticated && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowNotificationsPopover(!showNotificationsPopover)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.55rem',
                    borderRadius: '10px',
                    border: showNotificationsPopover ? '1px solid #fee2e2' : '1px solid #cbd5e1',
                    cursor: 'pointer',
                    background: showNotificationsPopover ? '#fee2e2' : 'white',
                    color: showNotificationsPopover ? '#ef4444' : '#475569',
                    position: 'relative',
                    transition: 'all 0.2s',
                    width: '38px',
                    height: '38px',
                    flexShrink: 0
                  }}
                  title="Notificaciones y Alertas"
                >
                  <Bell size={18} className={activeNotificationsCount > 0 ? 'pulse-bell' : ''} style={{ color: activeNotificationsCount > 0 ? '#ef4444' : 'inherit' }} />
                  {activeNotificationsCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      background: '#ef4444',
                      color: 'white',
                      fontSize: '0.65rem',
                      padding: '2px 5px',
                      borderRadius: '50%',
                      fontWeight: 600,
                      border: '2px solid white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '18px',
                      height: '18px',
                      fontFamily: "'Poppins', sans-serif"
                    }}>
                      {activeNotificationsCount}
                    </span>
                  )}
                </button>
                
                {showNotificationsPopover && (
                  <div style={{
                    position: 'absolute',
                    top: '120%',
                    right: 0,
                    width: '340px',
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    fontFamily: "'Poppins', sans-serif"
                  }}>
                    {/* Header Popover */}
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.9rem' }}>🔔</span>
                        <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>Centro de Alertas</h4>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {activeNotificationsCount > 0 && (
                          <>
                            <span style={{ fontSize: '0.72rem', background: '#fee2e2', color: '#ef4444', padding: '0.15rem 0.45rem', borderRadius: '12px', fontWeight: 500 }}>{activeNotificationsCount}</span>
                            <button
                              type="button"
                              onClick={() => handleDismissAllAlerts(activeNotifications.map((n: any) => n.id))}
                              style={{ background: 'transparent', border: 'none', color: '#0284c7', fontSize: '0.72rem', fontWeight: 500, cursor: 'pointer', padding: '0 0.2rem' }}
                              title="Marcar todas como resueltas"
                            >
                              Limpiar todo
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Lista Notificaciones */}
                    <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '0.5rem' }}>
                      {activeNotifications.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>
                          🎉 ¡Todo al día! No tienes alertas pendientes de resolución.
                        </div>
                      ) : (
                        activeNotifications.map((notif: any) => {
                          const isDanger = notif.type === 'danger';
                          const isWarning = notif.type === 'warning';
                          const isSuccess = notif.type === 'success';
                          const primaryColor = configuracion?.color_primario || '#6366f1';
                          
                          return (
                            <div key={notif.id} style={{
                              padding: '0.7rem 0.8rem',
                              borderBottom: '1px solid #f1f5f9',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.45rem',
                              background: isDanger ? '#fef2f2' : isWarning ? '#fffbeb' : '#f8fafc',
                              borderRadius: '10px',
                              marginBottom: '0.35rem',
                              border: isDanger ? '1px solid #fecaca' : isWarning ? '1px solid #fef08a' : '1px solid #e2e8f0'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem' }}>
                                <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start', flex: 1 }}>
                                  <span style={{ fontSize: '1rem', marginTop: '0.1rem', flexShrink: 0 }}>
                                    {isDanger ? '🔴' : isWarning ? '🟡' : isSuccess ? '🟢' : '🔵'}
                                  </span>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>{notif.title}</h4>
                                    <p style={{ margin: 0, fontSize: '0.76rem', color: '#475569', lineHeight: 1.35, fontWeight: 400 }}>{notif.message}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDismissAlert(notif.id)}
                                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.1rem 0.2rem', fontSize: '0.85rem', flexShrink: 0 }}
                                  title="Marcar como resuelta / descartar"
                                >
                                  ✕
                                </button>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                                <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                                  {notif.time ? new Date(notif.time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : 'Hoy'}
                                </span>
                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleDismissAlert(notif.id)}
                                    style={{
                                      background: '#ffffff',
                                      color: '#64748b',
                                      border: '1px solid #cbd5e1',
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '6px',
                                      fontSize: '0.72rem',
                                      fontWeight: 500,
                                      cursor: 'pointer'
                                    }}
                                    title="Marcar como resuelta y descontar"
                                  >
                                    ✓ Resuelta
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAtenderNotificacion(notif)}
                                    style={{
                                      background: isDanger ? '#ef4444' : isWarning ? '#f59e0b' : primaryColor,
                                      color: 'white',
                                      border: 'none',
                                      padding: '0.2rem 0.55rem',
                                      borderRadius: '6px',
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Atender →
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}`;

if (normContent.includes(normalize(oldTopBarBell))) {
  normContent = normContent.replace(normalize(oldTopBarBell), normalize(newTopBarBell));
  console.log('5. Replaced Top Bar Notification Bell & Popover');
} else {
  console.error('Failed 5. Replaced Top Bar Notification Bell & Popover');
}

// 6. Update notificaciones_asesor panel
const oldNotifPanel = `                <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Notifications list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 800, color: '#1e293b', textAlign: 'left' }}>Alertas Activas ({activeNotifications.length})</h3>
                    {activeNotifications.length === 0 ? (
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2.5rem 2rem', textAlign: 'center', color: '#64748b' }}>
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>🎉</p>
                        <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#475569' }}>¡Estás al día!</p>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>No tienes tareas ni alertas pendientes de respuesta en este momento.</p>
                      </div>
                    ) : (
                      activeNotifications.map((notif: any) => {
                        const isDanger = notif.type === 'danger';
                        const isWarning = notif.type === 'warning';
                        const isSuccess = notif.type === 'success';

                        let cardClass = "notif-hover ";
                        if (isDanger) cardClass += "alert-card-danger";
                        else if (isWarning) cardClass += "alert-card-warning";

                        return (
                          <div 
                            key={notif.id}
                            className={cardClass}
                            style={{
                              background: isDanger 
                                ? 'linear-gradient(135deg, #fff5f5, #fef2f2)' 
                                : isWarning 
                                  ? 'linear-gradient(135deg, #fffbeb, #fffcf0)' 
                                  : isSuccess 
                                    ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' 
                                    : 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
                              border: \`1.5px solid \${isDanger ? '#f87171' : isWarning ? '#fbbf24' : isSuccess ? '#4ade80' : '#60a5fa'}\`,
                              borderRadius: '16px',
                              padding: '1.1rem 1.25rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '1rem',
                              textAlign: 'left',
                              position: 'relative',
                              overflow: 'hidden'
                            }}
                          >
                            {/* Decorative background symbol */}
                            <div style={{
                              position: 'absolute',
                              right: '-10px',
                              top: '-10px',
                              fontSize: '4.5rem',
                              opacity: 0.05,
                              pointerEvents: 'none',
                              userSelect: 'none'
                            }}>
                              {isDanger ? '🚨' : isWarning ? '⏳' : isSuccess ? '🎉' : '🔔'}
                            </div>

                            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start', flex: 1, zIndex: 1 }}>
                              <span style={{ fontSize: '1.3rem', marginTop: '0.1rem' }}>
                                {isDanger ? '🔴' : isWarning ? '🟡' : isSuccess ? '🟢' : '🔵'}
                              </span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>{notif.title}</h4>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: 1.45, fontWeight: 500 }}>{notif.message}</p>
                                <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem', fontWeight: 600 }}>
                                  ⏰ {new Date(notif.time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>

                            {notif.actionTab && (
                              <button
                                onClick={() => setActiveTab(notif.actionTab)}
                                style={{
                                  background: isDanger ? '#ef4444' : isWarning ? '#f59e0b' : primaryColor,
                                  color: 'white',
                                  border: 'none',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '10px',
                                  fontSize: '0.8rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06)',
                                  transition: 'all 0.2s',
                                  zIndex: 1
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                Ver Detalle →
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}`;

const newNotifPanel = `                <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: "'Poppins', sans-serif" }}>
                  {/* Notifications list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#1e293b', textAlign: 'left' }}>Alertas Activas ({activeNotifications.length})</h3>
                      {activeNotifications.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleDismissAllAlerts(activeNotifications.map((n: any) => n.id))}
                          style={{
                            background: '#f0fdf4',
                            border: '1.5px solid #bbf7d0',
                            color: '#16a34a',
                            borderRadius: '10px',
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.78rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontFamily: "'Poppins', sans-serif"
                          }}
                        >
                          <span>✓ Marcar todas como resueltas</span>
                        </button>
                      )}
                    </div>

                    {activeNotifications.length === 0 ? (
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2.5rem 2rem', textAlign: 'center', color: '#64748b' }}>
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>🎉</p>
                        <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: '#475569' }}>¡Estás al día!</p>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>No tienes tareas ni alertas pendientes de respuesta en este momento.</p>
                      </div>
                    ) : (
                      activeNotifications.map((notif: any) => {
                        const isDanger = notif.type === 'danger';
                        const isWarning = notif.type === 'warning';
                        const isSuccess = notif.type === 'success';

                        let cardClass = "notif-hover ";
                        if (isDanger) cardClass += "alert-card-danger";
                        else if (isWarning) cardClass += "alert-card-warning";

                        return (
                          <div 
                            key={notif.id}
                            className={cardClass}
                            style={{
                              background: isDanger 
                                ? 'linear-gradient(135deg, #fff5f5, #fef2f2)' 
                                : isWarning 
                                  ? 'linear-gradient(135deg, #fffbeb, #fffcf0)' 
                                  : isSuccess 
                                    ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' 
                                    : 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
                              border: \`1.5px solid \${isDanger ? '#f87171' : isWarning ? '#fbbf24' : isSuccess ? '#4ade80' : '#60a5fa'}\`,
                              borderRadius: '16px',
                              padding: '1.1rem 1.25rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '1rem',
                              textAlign: 'left',
                              position: 'relative',
                              overflow: 'hidden'
                            }}
                          >
                            {/* Decorative background symbol */}
                            <div style={{
                              position: 'absolute',
                              right: '-10px',
                              top: '-10px',
                              fontSize: '4.5rem',
                              opacity: 0.05,
                              pointerEvents: 'none',
                              userSelect: 'none'
                            }}>
                              {isDanger ? '🚨' : isWarning ? '⏳' : isSuccess ? '🎉' : '🔔'}
                            </div>

                            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start', flex: 1, zIndex: 1 }}>
                              <span style={{ fontSize: '1.3rem', marginTop: '0.1rem' }}>
                                {isDanger ? '🔴' : isWarning ? '🟡' : isSuccess ? '🟢' : '🔵'}
                              </span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>{notif.title}</h4>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: 1.45, fontWeight: 400 }}>{notif.message}</p>
                                <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem', fontWeight: 500 }}>
                                  ⏰ {new Date(notif.time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', zIndex: 1, flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() => handleDismissAlert(notif.id)}
                                style={{
                                  background: '#ffffff',
                                  color: '#64748b',
                                  border: '1.5px solid #cbd5e1',
                                  padding: '0.45rem 0.85rem',
                                  borderRadius: '10px',
                                  fontSize: '0.78rem',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  fontFamily: "'Poppins', sans-serif"
                                }}
                                title="Marcar como resuelta para que ya no aparezca"
                              >
                                ✓ Resuelta
                              </button>

                              {notif.actionTab && (
                                <button
                                  type="button"
                                  onClick={() => handleAtenderNotificacion(notif)}
                                  style={{
                                    background: isDanger ? '#ef4444' : isWarning ? '#f59e0b' : primaryColor,
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.45rem 0.95rem',
                                    borderRadius: '10px',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06)',
                                    transition: 'all 0.2s',
                                    fontFamily: "'Poppins', sans-serif"
                                  }}
                                >
                                  Atender →
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}`;

if (normContent.includes(normalize(oldNotifPanel))) {
  normContent = normContent.replace(normalize(oldNotifPanel), normalize(newNotifPanel));
  console.log('6. Replaced notificaciones_asesor panel');
} else {
  console.error('Failed 6. Replaced notificaciones_asesor panel');
}

// 7. Update viewingAdvisorAlerts Modal
const oldAdvisorModal = `              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {alerts.map((al, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      padding: '1rem', 
                      borderRadius: '12px', 
                      background: al.type === 'danger' ? '#fef2f2' : al.type === 'warning' ? '#fffbeb' : '#f0f9ff',
                      border: al.type === 'danger' ? '1px solid #fee2e2' : al.type === 'warning' ? '#fef3c7' : '#e0f2fe',
                      textAlign: 'left'
                    }}
                  >
                    <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.88rem', fontWeight: 800, color: al.type === 'danger' ? '#991b1b' : al.type === 'warning' ? '#92400e' : '#0369a1' }}>
                      {al.title}
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>
                      {al.message}
                    </p>
                  </div>
                ))}
              </div>`;

const newAdvisorModal = `              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.25rem', fontFamily: "'Poppins', sans-serif" }}>
                {alerts.map((al, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      padding: '0.85rem 1rem', 
                      borderRadius: '12px', 
                      background: al.type === 'danger' ? '#fef2f2' : al.type === 'warning' ? '#fffbeb' : '#f0f9ff',
                      border: al.type === 'danger' ? '1px solid #fee2e2' : al.type === 'warning' ? '#fef3c7' : '#e0f2fe',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.86rem', fontWeight: 600, color: al.type === 'danger' ? '#991b1b' : al.type === 'warning' ? '#92400e' : '#0369a1' }}>
                        {al.title}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: 1.35, fontWeight: 400 }}>
                        {al.message}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleDismissAlert(al.id);
                        setViewingAdvisorAlerts(prev => prev ? { ...prev, alerts: prev.alerts.filter(x => x.id !== al.id) } : null);
                      }}
                      style={{
                        background: '#ffffff',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.72rem',
                        fontWeight: 500,
                        color: '#334155',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      ✓ Resuelta
                    </button>
                  </div>
                ))}
              </div>`;

if (normContent.includes(normalize(oldAdvisorModal))) {
  normContent = normContent.replace(normalize(oldAdvisorModal), normalize(newAdvisorModal));
  console.log('7. Replaced viewingAdvisorAlerts Modal');
} else {
  console.error('Failed 7. Replaced viewingAdvisorAlerts Modal');
}

fs.writeFileSync(adminPath, normContent, 'utf8');
console.log('Admin.tsx patched successfully! New length:', normContent.length);
