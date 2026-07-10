const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.tsx');
let content = fs.readFileSync(adminPath, 'utf8');

// 1. Fix renderLeadOrOrderCard signature and isLead definition
content = content.replace(/const renderLeadOrOrderCard = \(ped: any\) => {/, 'const renderLeadOrOrderCard = (ped: any, forceIsLead?: boolean) => {');
content = content.replace(/const isLead = ped\.isLead \|\| !ped\.estado;/, 'const isLead = forceIsLead || ped.isLead || !ped.estado || (ped.retargeting_estado !== undefined);');

// 2. Fix Kanban board mapping for leads
content = content.replace(/\{leadsFiltrados\.map\(lead => renderLeadOrOrderCard\(lead\)\)\}/g, '{leadsFiltrados.map(lead => renderLeadOrOrderCard(lead, true))}');

// 3. Fix client info in modal
content = content.replace(/<p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>\{selectedPedido\.cliente_nombre\}<\/p>/g, "<p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>{selectedPedido.cliente_nombre || selectedPedido.nombre || 'Borrador Anónimo'}</p>");
content = content.replace(/<p style={{ margin: '0\.2rem 0 0 0', color: '#475569' }}>\{selectedPedido\.cliente_telefono\}<\/p>/g, "<p style={{ margin: '0.2rem 0 0 0', color: '#475569' }}>{selectedPedido.cliente_telefono || selectedPedido.telefono || 'Sin teléfono'}</p>");

// 4. Fix empty phone returns in renderLeadOrOrderCard
content = content.replace(/if \(!cleanPhone\) return;/g, "if (!cleanPhone) { showToast('Teléfono inválido para WhatsApp', 'error'); return; }");

fs.writeFileSync(adminPath, content);
console.log("Admin.tsx fixed for modal info, button text and clicks!");
