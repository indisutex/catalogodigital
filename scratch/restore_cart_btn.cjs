const fs = require('fs');
const path = require('path');

const menuPath = path.join(__dirname, '..', 'src', 'pages', 'MenuDigital.tsx');
let content = fs.readFileSync(menuPath, 'utf8');

const normalize = s => s.replace(/\r\n/g, '\n');
let normContent = normalize(content);

const oldFooterButtons = `                  {/* TRUST BADGE CONTRA ENTREGA */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.74rem', color: '#059669', background: '#ecfdf5', padding: '0.4rem 0.65rem', borderRadius: '10px', marginBottom: '0.75rem', fontWeight: 500, border: '1px solid #a7f3d0', fontFamily: "'Poppins', sans-serif" }}>
                    <Truck size={15} style={{ color: '#059669', flexShrink: 0 }} />
                    <span>¡Pago contra entrega disponible en todo el país!</span>
                  </div>

                  {/* BOTÓN PRINCIPAL 1: PEDIR CONTRA ENTREGA */}
                  <button 
                    className="checkout-btn btn-contraentrega" 
                    disabled={items.length === 0}
                    onClick={() => {
                      if (buyerType === 'mayorista' && totalUnits < 6) {
                        alert(\`Tienes que comprar mínimo 6 unidades para poder comprar en nuestro catálogo mayorista. Actualmente llevas \${totalUnits} \${totalUnits === 1 ? 'unidad' : 'unidades'}. Agrega \${6 - totalUnits} más a tu carrito o cambia a modo Detal.\`);
                        return;
                      }
                      setModalidadPago('contra_entrega');
                      setMetodoRecepcion('domicilio');
                      setCheckoutStep(1);
                      setIsCheckoutMode(true);
                    }}
                    style={{ 
                      width: '100%',
                      padding: '0.88rem 1rem', 
                      fontSize: '0.98rem', 
                      fontWeight: 600,
                      borderRadius: '14px', 
                      background: (buyerType === 'mayorista' && totalUnits < 6) 
                        ? '#cbd5e1' 
                        : 'linear-gradient(135deg, #ea580c, #c2410c)', 
                      color: '#ffffff',
                      border: 'none',
                      cursor: (buyerType === 'mayorista' && totalUnits < 6) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.55rem',
                      boxShadow: (buyerType === 'mayorista' && totalUnits < 6) ? 'none' : '0 4px 14px rgba(234, 88, 12, 0.35)',
                      fontFamily: "'Poppins', sans-serif"
                    }}
                  >
                    <Truck size={19} />
                    <span>Pedir Contra Entrega</span>
                  </button>

                  {/* BOTÓN SECUNDARIO 2: TRANSFERENCIA / CONTINUAR */}
                  <button 
                    className="checkout-btn btn-transferencia" 
                    disabled={items.length === 0}
                    onClick={() => {
                      if (buyerType === 'mayorista' && totalUnits < 6) {
                        alert(\`Tienes que comprar mínimo 6 unidades para poder comprar en nuestro catálogo mayorista. Actualmente llevas \${totalUnits} \${totalUnits === 1 ? 'unidad' : 'unidades'}. Agrega \${6 - totalUnits} más a tu carrito o cambia a modo Detal.\`);
                        return;
                      }
                      setModalidadPago('transferencia');
                      setCheckoutStep(1);
                      setIsCheckoutMode(true);
                    }}
                    style={{ 
                      width: '100%',
                      padding: '0.8rem 1rem', 
                      fontSize: '0.9rem', 
                      fontWeight: 500,
                      borderRadius: '14px', 
                      background: (buyerType === 'mayorista' && totalUnits < 6) ? '#f8fafc' : '#ffffff', 
                      color: (buyerType === 'mayorista' && totalUnits < 6) ? '#94a3b8' : (configuracion?.color_primario || 'var(--primary, #f36b8e)'), 
                      border: \`1.5px solid \${(configuracion?.color_primario || '#f36b8e')}40\`,
                      cursor: (buyerType === 'mayorista' && totalUnits < 6) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      marginTop: '0.5rem',
                      fontFamily: "'Poppins', sans-serif"
                    }}
                  >
                    <CreditCard size={17} />
                    <span>Pagar con Transferencia Bancaria</span>
                  </button>`;

const newFooterButton = `                  {/* MAIN CTA BUTTON */}
                  <button 
                    className="checkout-btn" 
                    disabled={items.length === 0}
                    onClick={() => {
                      if (buyerType === 'mayorista' && totalUnits < 6) {
                        alert(\`Tienes que comprar mínimo 6 unidades para poder comprar en nuestro catálogo mayorista. Actualmente llevas \${totalUnits} \${totalUnits === 1 ? 'unidad' : 'unidades'}. Agrega \${6 - totalUnits} más a tu carrito o cambia a modo Detal.\`);
                        return;
                      }
                      setCheckoutStep(1);
                      setIsCheckoutMode(true);
                    }}
                    style={{ 
                      width: '100%',
                      padding: '0.88rem 1rem', 
                      fontSize: '0.98rem', 
                      fontWeight: 600,
                      borderRadius: '14px', 
                      background: (buyerType === 'mayorista' && totalUnits < 6) ? '#cbd5e1' : (configuracion?.color_primario || 'var(--primary, #f36b8e)'), 
                      color: '#ffffff',
                      border: 'none',
                      cursor: (buyerType === 'mayorista' && totalUnits < 6) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.55rem',
                      boxShadow: (buyerType === 'mayorista' && totalUnits < 6) ? 'none' : \`0 4px 14px \${(configuracion?.color_primario || '#f36b8e')}40\`,
                      fontFamily: "'Poppins', sans-serif"
                    }}
                  >
                    <CreditCard size={18} />
                    Continuar con tu compra
                  </button>`;

if (normContent.includes(normalize(oldFooterButtons))) {
  normContent = normContent.replace(normalize(oldFooterButtons), normalize(newFooterButton));
  fs.writeFileSync(menuPath, normContent, 'utf8');
  console.log('Successfully restored original single cart CTA button!');
} else {
  console.error('Could not find oldFooterButtons in MenuDigital.tsx');
}
