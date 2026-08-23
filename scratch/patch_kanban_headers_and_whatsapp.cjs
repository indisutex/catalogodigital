const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.tsx');
let content = fs.readFileSync(adminPath, 'utf8');

// 1. Ensure WhatsAppIcon is defined
const whatsappComponent = `
const WhatsAppIcon = ({ size = 20, color = "#ffffff" }: { size?: number; color?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill={color}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.48-8.413z" />
  </svg>
);
`;

if (!content.includes('const WhatsAppIcon =')) {
  const exportAdminIndex = content.indexOf('export default function Admin');
  if (exportAdminIndex !== -1) {
    content = content.slice(0, exportAdminIndex) + whatsappComponent + '\n' + content.slice(exportAdminIndex);
    console.log('Added WhatsAppIcon component');
  }
}

// 2. Replace the icon in the card WhatsApp button
const oldIconMatch = /<MessageCircle\s+size=\{18\}\s+fill="#ffffff"\s+color="#25D366"\s*\/>/g;
if (oldIconMatch.test(content)) {
  content = content.replace(oldIconMatch, '<WhatsAppIcon size={19} color="#ffffff" />');
  console.log('Replaced MessageCircle with WhatsAppIcon in order cards');
}

// 3. Upgrade Kanban Column Headers in Admin.tsx
// Col 0: Cancelados
const oldCol0 = `<div className="kanban-column-header col-red" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #dc2626', paddingBottom: '0.65rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.45rem', fontFamily: "'Poppins', sans-serif" }}>
                              <Ban size={16} color="#dc2626" />
                              <span>Cancelados</span>
                            </h3>
                            <span className="badge" style={{ background: '#ffffff', color: '#dc2626', border: '1px solid #fca5a5', padding: '0.15rem 0.6rem', borderRadius: '12px', fontSize: '0.76rem', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>{canceladosFiltrados.length}</span>
                          </div>`;

const newCol0 = `<div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'linear-gradient(135deg, #fff1f2 0%, #fee2e2 100%)',
                            border: '1px solid #fecaca',
                            borderRadius: '12px',
                            padding: '0.65rem 0.85rem',
                            boxShadow: '0 2px 6px rgba(220, 38, 38, 0.06)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#fee2e2', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Ban size={15} color="#dc2626" />
                              </div>
                              <span style={{ margin: 0, fontSize: '0.86rem', fontWeight: 600, color: '#991b1b', fontFamily: "'Poppins', sans-serif" }}>Cancelados</span>
                            </div>
                            <span style={{ background: '#dc2626', color: '#ffffff', minWidth: '24px', height: '22px', borderRadius: '11px', padding: '0 0.55rem', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)', fontFamily: "'Poppins', sans-serif" }}>{canceladosFiltrados.length}</span>
                          </div>`;

// Col 1: No Interesados
const oldCol1 = `<div className="kanban-column-header col-red" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ef4444', paddingBottom: '0.65rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.45rem', fontFamily: "'Poppins', sans-serif" }}>
                              <XCircle size={16} color="#dc2626" />
                              <span>No Interesados (Abandonos)</span>
                            </h3>
                            <span className="badge" style={{ background: '#ffffff', color: '#dc2626', border: '1px solid #fca5a5', padding: '0.15rem 0.6rem', borderRadius: '12px', fontSize: '0.76rem', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>{leadsFiltrados.length}</span>
                          </div>`;

const newCol1 = `<div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '0.65rem 0.85rem',
                            boxShadow: '0 2px 6px rgba(100, 116, 139, 0.06)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <XCircle size={15} color="#64748b" />
                              </div>
                              <span style={{ margin: 0, fontSize: '0.86rem', fontWeight: 600, color: '#475569', fontFamily: "'Poppins', sans-serif" }}>No Interesados (Abandonos)</span>
                            </div>
                            <span style={{ background: '#64748b', color: '#ffffff', minWidth: '24px', height: '22px', borderRadius: '11px', padding: '0 0.55rem', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(100, 116, 139, 0.2)', fontFamily: "'Poppins', sans-serif" }}>{leadsFiltrados.length}</span>
                          </div>`;

// Col 2: Contra Entrega
const oldCol2 = `<div className="kanban-column-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ea580c', paddingBottom: '0.65rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#c2410c', display: 'flex', alignItems: 'center', gap: '0.45rem', fontFamily: "'Poppins', sans-serif" }}>
                              <Truck size={16} color="#c2410c" />
                              <span>Pago Contra Entrega</span>
                            </h3>
                            <span className="badge" style={{ background: '#ffffff', color: '#c2410c', border: '1px solid #fdba74', padding: '0.15rem 0.6rem', borderRadius: '12px', fontSize: '0.76rem', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>{contraEntregaFiltrados.length}</span>
                          </div>`;

const newCol2 = `<div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                            border: '1px solid #fed7aa',
                            borderRadius: '12px',
                            padding: '0.65rem 0.85rem',
                            boxShadow: '0 2px 6px rgba(234, 88, 12, 0.08)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ffedd5', border: '1px solid #fdba74', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Truck size={15} color="#ea580c" />
                              </div>
                              <span style={{ margin: 0, fontSize: '0.86rem', fontWeight: 600, color: '#9a3412', fontFamily: "'Poppins', sans-serif" }}>Pago Contra Entrega</span>
                            </div>
                            <span style={{ background: '#ea580c', color: '#ffffff', minWidth: '24px', height: '22px', borderRadius: '11px', padding: '0 0.55rem', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(234, 88, 12, 0.25)', fontFamily: "'Poppins', sans-serif" }}>{contraEntregaFiltrados.length}</span>
                          </div>`;

// Col 3: Pendientes
const oldCol3 = `<div className="kanban-column-header col-yellow" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eab308', paddingBottom: '0.65rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#a16207', display: 'flex', alignItems: 'center', gap: '0.45rem', fontFamily: "'Poppins', sans-serif" }}>
                              <Clock size={16} color="#a16207" />
                              <span>Pendientes por Pago</span>
                            </h3>
                            <span className="badge" style={{ background: '#ffffff', color: '#a16207', border: '1px solid #fde047', padding: '0.15rem 0.6rem', borderRadius: '12px', fontSize: '0.76rem', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>{pendientePagoFiltrados.length}</span>
                          </div>`;

const newCol3 = `<div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)',
                            border: '1px solid #fef08a',
                            borderRadius: '12px',
                            padding: '0.65rem 0.85rem',
                            boxShadow: '0 2px 6px rgba(202, 138, 4, 0.08)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#fef9c3', border: '1px solid #fde047', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Clock size={15} color="#ca8a04" />
                              </div>
                              <span style={{ margin: 0, fontSize: '0.86rem', fontWeight: 600, color: '#854d0e', fontFamily: "'Poppins', sans-serif" }}>Pendientes por Pago</span>
                            </div>
                            <span style={{ background: '#ca8a04', color: '#ffffff', minWidth: '24px', height: '22px', borderRadius: '11px', padding: '0 0.55rem', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(202, 138, 4, 0.25)', fontFamily: "'Poppins', sans-serif" }}>{pendientePagoFiltrados.length}</span>
                          </div>`;

// Col 4: Comprobante
const oldCol4 = `<div className="kanban-column-header col-blue" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #2563eb', paddingBottom: '0.65rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '0.45rem', fontFamily: "'Poppins', sans-serif" }}>
                              <FileCheck size={16} color="#1d4ed8" />
                              <span>Comprobante Recibido</span>
                            </h3>
                            <span className="badge" style={{ background: '#ffffff', color: '#1d4ed8', border: '1px solid #93c5fd', padding: '0.15rem 0.6rem', borderRadius: '12px', fontSize: '0.76rem', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>{comprobarPagosFiltrados.length}</span>
                          </div>`;

const newCol4 = `<div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                            border: '1px solid #bfdbfe',
                            borderRadius: '12px',
                            padding: '0.65rem 0.85rem',
                            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.08)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#dbeafe', border: '1px solid #93c5fd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <FileCheck size={15} color="#2563eb" />
                              </div>
                              <span style={{ margin: 0, fontSize: '0.86rem', fontWeight: 600, color: '#1e40af', fontFamily: "'Poppins', sans-serif" }}>Comprobante Recibido</span>
                            </div>
                            <span style={{ background: '#2563eb', color: '#ffffff', minWidth: '24px', height: '22px', borderRadius: '11px', padding: '0 0.55rem', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)', fontFamily: "'Poppins', sans-serif" }}>{comprobarPagosFiltrados.length}</span>
                          </div>`;

// Col 5: Ventas Exitosas
const oldCol5 = `<div className="kanban-column-header col-green" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #16a34a', paddingBottom: '0.65rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.45rem', fontFamily: "'Poppins', sans-serif" }}>
                              <CheckCircle size={16} color="#15803d" />
                              <span>Ventas Exitosas</span>
                            </h3>
                            <span className="badge" style={{ background: '#ffffff', color: '#15803d', border: '1px solid #86efac', padding: '0.15rem 0.6rem', borderRadius: '12px', fontSize: '0.76rem', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>{clientesFiltrados.length}</span>
                          </div>`;

const newCol5 = `<div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                            border: '1px solid #bbf7d0',
                            borderRadius: '12px',
                            padding: '0.65rem 0.85rem',
                            boxShadow: '0 2px 6px rgba(22, 163, 74, 0.08)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#dcfce7', border: '1px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <CheckCircle size={15} color="#16a34a" />
                              </div>
                              <span style={{ margin: 0, fontSize: '0.86rem', fontWeight: 600, color: '#166534', fontFamily: "'Poppins', sans-serif" }}>Ventas Exitosas</span>
                            </div>
                            <span style={{ background: '#16a34a', color: '#ffffff', minWidth: '24px', height: '22px', borderRadius: '11px', padding: '0 0.55rem', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)', fontFamily: "'Poppins', sans-serif" }}>{clientesFiltrados.length}</span>
                          </div>`;

const normalize = s => s.replace(/\r\n/g, '\n');
let normContent = normalize(content);

let count = 0;
if (normContent.includes(normalize(oldCol0))) {
  normContent = normContent.replace(normalize(oldCol0), normalize(newCol0));
  count++;
}
if (normContent.includes(normalize(oldCol1))) {
  normContent = normContent.replace(normalize(oldCol1), normalize(newCol1));
  count++;
}
if (normContent.includes(normalize(oldCol2))) {
  normContent = normContent.replace(normalize(oldCol2), normalize(newCol2));
  count++;
}
if (normContent.includes(normalize(oldCol3))) {
  normContent = normContent.replace(normalize(oldCol3), normalize(newCol3));
  count++;
}
if (normContent.includes(normalize(oldCol4))) {
  normContent = normContent.replace(normalize(oldCol4), normalize(newCol4));
  count++;
}
if (normContent.includes(normalize(oldCol5))) {
  normContent = normContent.replace(normalize(oldCol5), normalize(newCol5));
  count++;
}

console.log('Replaced', count, 'kanban headers');

fs.writeFileSync(adminPath, normContent, 'utf8');
