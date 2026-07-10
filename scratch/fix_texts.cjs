const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.tsx');
let content = fs.readFileSync(adminPath, 'utf8');

// Replace tab texts safely
content = content.replace(/>Recuperado</g, '>Venta Exitosa<');
content = content.replace(/Recuperados <span/g, 'Ventas Exitosas <span');

fs.writeFileSync(adminPath, content);
console.log("Admin.tsx texts replaced!");

// Admin.css fix
const cssPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');

const cssTarget = /\.modal-overlay \{\s*align-items: center !important;\s*\}/;
const cssRepl = `.modal-overlay {
      align-items: flex-start !important;
      padding-top: 5vh;
    }`;
cssContent = cssContent.replace(cssTarget, cssRepl);

fs.writeFileSync(cssPath, cssContent);
console.log("Admin.css fixed!");
