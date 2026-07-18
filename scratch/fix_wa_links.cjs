const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf8').replace(/\r\n/g, '\n');

// Replace POS success screen link
const posRegex = /const num = posLastInvoice\.cliente_telefono\.replace\(\/\\D\/g, ''\);\s*const itemsStr = posLastInvoice\.productos\.map\(\(i: any\) => `- \${i\.cantidad}x \${i\.nombre} \${i\.talla \? `\(\${i\.talla}\)` : ''}`\)\.join\('\\n'\);\s*const msg = `¡Hola \${posLastInvoice\.cliente_nombre}! 👋\\nMuchas gracias por tu compra en \*\${configuracion\?\.nombre_negocio \|\| 'nuestra tienda'}\*\.\\n\\n\*Detalle de tu compra:\*\\n\${itemsStr}\\n\\n\*Total Pagado: \$\${posLastInvoice\.total\.toLocaleString\(\)} COP\*\\n\*Método de Pago: \${posLastInvoice\.metodo_pago\.toUpperCase\(\)}\*\\n\\n¡Esperamos que disfrutes tus productos! 😊`;\s*window\.open\(`https:\/\/wa\.me\/57\${num}\?text=\${encodeURIComponent\(msg\)}`, '_blank'\);/g;

// Let's do a simple substring replacement instead of regex to avoid backslash escaping issues
const oldPosBlock = `                        if (!posLastInvoice) return;
                        const num = posLastInvoice.cliente_telefono.replace(/\\D/g, '');
                        const itemsStr = posLastInvoice.productos.map((i: any) => \`- \${i.cantidad}x \${i.nombre} \${i.talla ? \`(\${i.talla})\` : ''}\`).join('\\n');
                        const msg = \`¡Hola \${posLastInvoice.cliente_nombre}! 👋\\\\nMuchas gracias por tu compra en *\${configuracion?.nombre_negocio || 'nuestra tienda'}*.\\\\n\\\\n*Detalle de tu compra:*\\\\n\${itemsStr}\\\\n\\\\n*Total Pagado: $\${posLastInvoice.total.toLocaleString()} COP*\\\\n*Método de Pago: \${posLastInvoice.metodo_pago.toUpperCase()}*\\\\n\\\\n¡Esperamos que disfrutes tus productos! 😊\`;
                        window.open(\`https://wa.me/57\${num}?text=\${encodeURIComponent(msg)}\`, '_blank');`;

const newPosBlock = `                        if (!posLastInvoice) return;
                        const itemsStr = posLastInvoice.productos.map((i: any) => \`- \${i.cantidad}x \${i.nombre} \${i.talla ? \`(\${i.talla})\` : ''}\`).join('\\n');
                        const msg = \`¡Hola \${posLastInvoice.cliente_nombre}! 👋\\nMuchas gracias por tu compra en *\${configuracion?.nombre_negocio || 'nuestra tienda'}*.\\n\\n*Detalle de tu compra:*\\n\${itemsStr}\\n\\n*Total Pagado: $\${posLastInvoice.total.toLocaleString()} COP*\\n*Método de Pago: \${posLastInvoice.metodo_pago.toUpperCase()}*\\n\\n¡Esperamos que disfrutes tus productos! 😊\`;
                        window.open(formatWhatsAppLink(posLastInvoice.cliente_telefono || '', msg), '_blank');`;

if (code.includes(oldPosBlock)) {
  code = code.replace(oldPosBlock, newPosBlock);
} else {
  // Try with normalized backslashes
  const oldPosBlockAlt = oldPosBlock.replace(/\\\\n/g, '\\n');
  if (code.includes(oldPosBlockAlt)) {
    code = code.replace(oldPosBlockAlt, newPosBlock);
  } else {
    console.log("POS block not replaced");
  }
}

// Replace the two remaining guia links
const targetGuia1 = `                      onClick={() => {
                        const num = (selectedPedido.cliente_telefono || '').replace(/\\D/g, '');
                        const name = selectedPedido.cliente_nombre;
                        const business = configuracion?.nombre_negocio || 'Indisutex';
                        const msg = \`¡Felicidades \${name}! 🎉 Has hecho una compra exitosa con *\${business}*.\\n\\nTu número de guía de envío es: *\${numeroGuia || 'Pendiente'}*\\n\\n¡Muchas gracias por confiar en nosotros! 😊\`;
                        window.open(\`https://wa.me/57\${num}?text=\${encodeURIComponent(msg)}\`, '_blank');
                      }}`;

const replacementGuia1 = `                      onClick={() => {
                        const name = selectedPedido.cliente_nombre;
                        const business = configuracion?.nombre_negocio || 'Indisutex';
                        const msg = \`¡Felicidades \${name}! 🎉 Has hecho una compra exitosa con *\${business}*.\\n\\nTu número de guía de envío es: *\${numeroGuia || 'Pendiente'}*\\n\\n¡Muchas gracias por confiar en nosotros! 😊\`;
                        window.open(formatWhatsAppLink(selectedPedido.cliente_telefono || '', msg), '_blank');
                      }}`;

if (code.includes(targetGuia1)) {
  code = code.replace(targetGuia1, replacementGuia1);
} else {
  console.log("targetGuia1 not found");
}

const targetGuia2 = `                            const num = (selectedPedido.cliente_telefono || '').replace(/\\D/g, '');
                            const name = selectedPedido.cliente_nombre;
                            const business = configuracion?.nombre_negocio || 'Indisutex';
                            const msg = \`¡Felicidades \${name}! 🎉 Has hecho una compra exitosa con *\${business}*.\\n\\nTu número de guía de envío es: *\${numeroGuia}*\\n\\n¡Muchas gracias por confiar en nosotros! 😊\`;
                            window.open(\`https://wa.me/57\${num}?text=\${encodeURIComponent(msg)}\`, '_blank');`;

const replacementGuia2 = `                            const name = selectedPedido.cliente_nombre;
                            const business = configuracion?.nombre_negocio || 'Indisutex';
                            const msg = \`¡Felicidades \${name}! 🎉 Has hecho una compra exitosa con *\${business}*.\\n\\nTu número de guía de envío es: *\${numeroGuia}*\\n\\n¡Muchas gracias por confiar en nosotros! 😊\`;
                            window.open(formatWhatsAppLink(selectedPedido.cliente_telefono || '', msg), '_blank');`;

if (code.includes(targetGuia2)) {
  code = code.replace(targetGuia2, replacementGuia2);
} else {
  console.log("targetGuia2 not found");
}

fs.writeFileSync('src/pages/Admin.tsx', code, 'utf8');
console.log("Done!");
