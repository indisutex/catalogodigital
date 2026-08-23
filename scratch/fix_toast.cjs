const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.tsx');
let content = fs.readFileSync(adminPath, 'utf8');

const oldStr = `showToast('No hay pedidos cancelados para eliminar.', 'info');`;
const newStr = `showToast('No hay pedidos cancelados para eliminar.');`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  fs.writeFileSync(adminPath, content, 'utf8');
  console.log('Fixed showToast type issue successfully!');
} else {
  console.error('Could not find string to replace');
}
