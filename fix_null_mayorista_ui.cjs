const fs = require('fs');
let c = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// Fix 1: Top panel global markup condition
const oldTop = `{role === 'mayorista' && currentMayorista && (`;
const newTop = `{role === 'mayorista' && (
                  !currentMayorista ? (
                    <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#fee2e2', borderRadius: '12px', color: '#991b1b' }}>
                      <strong>Error de Sesión:</strong> No se pudo cargar tu perfil de mayorista. Por favor, cierra sesión e ingresa nuevamente.
                    </div>
                  ) : (`;
c = c.replace(oldTop, newTop);

// Fix 2: Add closing parenthesis for the new ternary in top panel
const oldTopEnd = `                      </button>
                    </div>
                  </div>
                )}`;
const newTopEnd = `                      </button>
                    </div>
                  </div>
                )
                )}`;
c = c.replace(oldTopEnd, newTopEnd);

// Fix 3: Table data column condition
const oldTd = `{role === 'mayorista' && currentMayorista && (
                              <td>`;
const newTd = `{role === 'mayorista' && (
                              <td>
                                {!currentMayorista ? (
                                  <span style={{color: 'red', fontSize: '0.8rem'}}>Requiere login</span>
                                ) : (`;
c = c.replace(oldTd, newTd);

// Fix 4: Add closing parenthesis for the new ternary in td
const oldTdEnd = `                                  </button>
                                </div>
                              </td>
                            )}`;
const newTdEnd = `                                  </button>
                                </div>
                                )}
                              </td>
                            )}`;
c = c.replace(oldTdEnd, newTdEnd);

fs.writeFileSync('src/pages/Admin.tsx', c, 'utf8');
console.log("Fixed UI layout for null currentMayorista");
