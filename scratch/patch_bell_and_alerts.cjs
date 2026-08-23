const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.tsx');
let content = fs.readFileSync(adminPath, 'utf8');

console.log('Original content length:', content.length);

const normalize = (s) => s.replace(/\r\n/g, '\n');
let normContent = normalize(content);

// 1. Replace Top Bar Bell and Popover
const oldTopBar = `            {(role === 'asesor' || role === 'mayorista') && (
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
                          🎉 ¡Todo al día! No tienes notificaciones pendientes.
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

const newTopBar = `            {isAuthenticated && (
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

if (normContent.includes(normalize(oldTopBar))) {
  normContent = normContent.replace(normalize(oldTopBar), normalize(newTopBar));
  console.log('Replaced Top Bar successfully');
} else {
  console.error('Failed to replace Top Bar');
}

// 2. Replace notificaciones_asesor panel
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
                                  e.currentTarget.style.boxShadow = '0 6px 8px -1px rgba(0,0,0,0.1)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'none';
                                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.06)';
                                }}
                              >
                                Ir a atender →
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>`;

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
                    )}
                  </div>`;

if (normContent.includes(normalize(oldNotifPanel))) {
  normContent = normContent.replace(normalize(oldNotifPanel), normalize(newNotifPanel));
  console.log('Replaced notificaciones_asesor panel successfully');
} else {
  console.error('Failed to replace notificaciones_asesor panel');
}

fs.writeFileSync(adminPath, normContent, 'utf8');
console.log('Admin.tsx updated! New length:', normContent.length);
