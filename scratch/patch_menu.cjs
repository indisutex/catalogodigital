const fs = require('fs');
const path = require('path');

const menuPath = path.join(__dirname, '..', 'src', 'pages', 'MenuDigital.tsx');
let content = fs.readFileSync(menuPath, 'utf8');

console.log('Original content length:', content.length);

// 1. Imports
const oldImport = `import { Loader2, Search, Plus, ShoppingBag, X, ShoppingCart, Volume2, VolumeX, Package, HelpCircle, RefreshCw, Menu, Check, Filter, LayoutGrid, Users, Sparkles, Shirt, Baby, Moon, Layers, Tag, Heart, Gift, ChevronDown, Share2, Trash2, CreditCard, MessageCircle, ArrowLeft, ChevronRight } from 'lucide-react';`;
const newImport = `import { Loader2, Search, Plus, ShoppingBag, X, ShoppingCart, Volume2, VolumeX, Package, HelpCircle, RefreshCw, Menu, Check, Filter, LayoutGrid, Users, Sparkles, Shirt, Baby, Moon, Layers, Tag, Heart, Gift, ChevronDown, Share2, Trash2, CreditCard, MessageCircle, ArrowLeft, ChevronRight, Truck } from 'lucide-react';`;

if (content.includes(oldImport)) {
  content = content.replace(oldImport, newImport);
  console.log('Replaced imports');
} else {
  console.error('Failed to replace imports');
}

// Normalize CRLF
const normalize = (s) => s.replace(/\r\n/g, '\n');
let normContent = normalize(content);

// 2. Cart Footer Buttons
const oldCartFooter = `                  {/* MAIN CTA BUTTON */}
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
                      boxShadow: (buyerType === 'mayorista' && totalUnits < 6) ? 'none' : \`0 4px 14px \${(configuracion?.color_primario || '#f36b8e')}40\`
                    }}
                  >
                    <CreditCard size={18} />
                    Continuar con tu compra
                  </button>`;

const newCartFooter = `                  {/* TRUST BADGE CONTRA ENTREGA */}
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

if (normContent.includes(normalize(oldCartFooter))) {
  normContent = normContent.replace(normalize(oldCartFooter), normalize(newCartFooter));
  console.log('Replaced Cart Footer Buttons');
} else {
  console.error('Failed to replace Cart Footer Buttons');
}

// 3. Step 3 - Highlight Contra Entrega
const oldOptionContraEntrega = `                            {/* OPCIÓN 2: PAGO CONTRA ENTREGA */}
                            <label 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.75rem', 
                                padding: '0.85rem 1rem', 
                                borderRadius: '14px', 
                                border: \`2px solid \${modalidadPago === 'contra_entrega' ? brandColor : '#e2e8f0'}\`, 
                                background: modalidadPago === 'contra_entrega' ? \`\${brandColor}0d\` : '#fafafa', 
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.1rem' }}>
                                🚚
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: modalidadPago === 'contra_entrega' ? brandColor : '#1e293b', fontFamily: "'Poppins', sans-serif" }}>
                                  Pago contra entrega
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>
                                  Pagas tus prendas y domicilio al recibir en tu puerta
                                </div>
                              </div>
                              <input 
                                type="radio" 
                                name="modalidadPago" 
                                value="contra_entrega"
                                checked={modalidadPago === 'contra_entrega'}
                                onChange={() => {
                                  setModalidadPago('contra_entrega');
                                  setIsPagoSeleccionado(true);
                                }}
                                style={{ accentColor: brandColor, width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                              />
                            </label>`;

const newOptionContraEntrega = `                            {/* OPCIÓN 2: PAGO CONTRA ENTREGA */}
                            <label 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.75rem', 
                                padding: '0.85rem 1rem', 
                                borderRadius: '14px', 
                                border: \`2px solid \${modalidadPago === 'contra_entrega' ? '#ea580c' : '#e2e8f0'}\`, 
                                background: modalidadPago === 'contra_entrega' ? '#fff7ed' : '#fafafa', 
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: modalidadPago === 'contra_entrega' ? '#fed7aa' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.1rem' }}>
                                🚚
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                  <div style={{ fontSize: '0.92rem', fontWeight: 600, color: modalidadPago === 'contra_entrega' ? '#ea580c' : '#1e293b', fontFamily: "'Poppins', sans-serif" }}>
                                    Pago contra entrega
                                  </div>
                                  <span style={{ fontSize: '0.68rem', fontWeight: 500, color: '#c2410c', background: '#ffedd5', padding: '0.1rem 0.45rem', borderRadius: '6px', fontFamily: "'Poppins', sans-serif" }}>
                                    🔥 Paga al recibir
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>
                                  Pagas tus prendas y domicilio al recibir en tu puerta
                                </div>
                              </div>
                              <input 
                                type="radio" 
                                name="modalidadPago" 
                                value="contra_entrega"
                                checked={modalidadPago === 'contra_entrega'}
                                onChange={() => {
                                  setModalidadPago('contra_entrega');
                                  setIsPagoSeleccionado(true);
                                }}
                                style={{ accentColor: '#ea580c', width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                              />
                            </label>`;

if (normContent.includes(normalize(oldOptionContraEntrega))) {
  normContent = normContent.replace(normalize(oldOptionContraEntrega), normalize(newOptionContraEntrega));
  console.log('Replaced Option Contra Entrega in Step 3');
} else {
  console.error('Failed to replace Option Contra Entrega in Step 3');
}

fs.writeFileSync(menuPath, normContent, 'utf8');
console.log('MenuDigital.tsx patched successfully! New length:', normContent.length);
