import fs from 'fs';

const adminPath = 'd:/Xgroup/Software/Indisutex/src/pages/Admin.tsx';
const menuPath = 'd:/Xgroup/Software/Indisutex/src/pages/MenuDigital.tsx';

// ── 1. UPDATE MENUDIGITAL.TSX ──
let menuContent = fs.readFileSync(menuPath, 'utf8');

// A. Text Search (Accents and SKU reference check)
const menuSearchFind = `  // Text search filter
  if (busqueda.trim()) {
    const q = busqueda.toLowerCase().trim();
    productosFiltrados = productosFiltrados.filter(p =>
      (p.nombre || '').toLowerCase().includes(q) ||
      (p.descripcion || '').toLowerCase().includes(q) ||
      (p.categoria || '').toLowerCase().includes(q)
    );
  }`;

const menuSearchReplace = `  // Text search filter (diacritics-insensitive and searches references)
  if (busqueda.trim()) {
    const cleanStr = (str: string) => 
      (str || '').normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim();
    const q = cleanStr(busqueda);
    productosFiltrados = productosFiltrados.filter(p =>
      cleanStr(p.nombre).includes(q) ||
      cleanStr(p.descripcion).includes(q) ||
      cleanStr(p.categoria).includes(q) ||
      cleanStr(p.referencia).includes(q)
    );
  }`;

// Normalise line endings to avoid CRLF mismatch in match
const normText = (t) => t.replace(/\r\n/g, '\n');

menuContent = normText(menuContent);
const searchFindNorm = normText(menuSearchFind);
const searchReplaceNorm = normText(menuSearchReplace);

if (menuContent.includes(searchFindNorm)) {
  menuContent = menuContent.replace(searchFindNorm, searchReplaceNorm);
  console.log("Success: MenuDigital search optimization");
} else {
  console.log("Failed: MenuDigital search optimization (not found)");
}

// B. Checkout Web Payment Methods Box
const menuCheckoutFind = `                <div className="cart-footer" style={{ marginTop: 'auto' }}>`;
const menuCheckoutReplace = `                {configuracion?.metodos_pago && (
                  <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '0.2rem', marginBottom: '1rem', fontSize: '0.82rem' }}>
                    <strong style={{ color: '#1e293b', display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem' }}>💳 Métodos de Pago Disponibles:</strong>
                    {(() => {
                      try {
                        const parsed = JSON.parse(configuracion.metodos_pago);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                          return parsed.map((m: any, idx: number) => (
                            <div key={idx} style={{ padding: '0.3rem 0', color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: idx < parsed.length - 1 ? '1px dashed #e2e8f0' : 'none' }}>
                              <span><strong>{m.banco}</strong> {m.tipo ? \`(\${m.tipo})\` : ''}</span>
                              <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{m.numero}</span>
                            </div>
                          ));
                        }
                      } catch {}
                      return <p style={{ margin: 0, color: '#64748b' }}>{configuracion.metodos_pago}</p>;
                    })()}
                  </div>
                )}

                <div className="cart-footer" style={{ marginTop: 'auto' }}>`;

const checkoutFindNorm = normText(menuCheckoutFind);
const checkoutReplaceNorm = normText(menuCheckoutReplace);

if (menuContent.includes(checkoutFindNorm)) {
  menuContent = menuContent.replace(checkoutFindNorm, checkoutReplaceNorm);
  console.log("Success: MenuDigital checkout payment methods display");
} else {
  console.log("Failed: MenuDigital checkout payment methods display (not found)");
}

fs.writeFileSync(menuPath, menuContent.replace(/\n/g, '\r\n'), 'utf8');


// ── 2. UPDATE ADMIN.TSX ──
let adminContent = fs.readFileSync(adminPath, 'utf8');
adminContent = normText(adminContent);

// A. Admin product list search queries
const adminProductsFind = `  let filteredProducts = productos.filter(p =>
    p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.categoria.toLowerCase().includes(searchQuery.toLowerCase())
  );`;

const adminProductsReplace = `  const cleanSearchStr = (str: string) => 
    (str || '').normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim();

  let filteredProducts = productos.filter(p => {
    const q = cleanSearchStr(searchQuery);
    return cleanSearchStr(p.nombre).includes(q) ||
      cleanSearchStr(p.categoria).includes(q) ||
      cleanSearchStr(p.referencia || '').includes(q);
  });`;

const adminProductsFindNorm = normText(adminProductsFind);
const adminProductsReplaceNorm = normText(adminProductsReplace);

if (adminContent.includes(adminProductsFindNorm)) {
  adminContent = adminContent.replace(adminProductsFindNorm, adminProductsReplaceNorm);
  console.log("Success: Admin filteredProducts search optimization");
} else {
  console.log("Failed: Admin filteredProducts search optimization (not found)");
}

// B. Wholesaler products search queries
const adminWholesalerFind = `  let mayoristaFilteredProducts = productos.filter(p =>
    (mayoristaCategoryFilter === 'todos' || p.categoria === mayoristaCategoryFilter) &&
    (p.nombre.toLowerCase().includes(mayoristaSearchQuery.toLowerCase()) ||
     p.categoria.toLowerCase().includes(mayoristaSearchQuery.toLowerCase()))
  );`;

const adminWholesalerReplace = `  let mayoristaFilteredProducts = productos.filter(p => {
    const q = cleanSearchStr(mayoristaSearchQuery);
    return (mayoristaCategoryFilter === 'todos' || p.categoria === mayoristaCategoryFilter) &&
      (cleanSearchStr(p.nombre).includes(q) ||
       cleanSearchStr(p.categoria).includes(q) ||
       cleanSearchStr(p.referencia || '').includes(q));
  });`;

const adminWholesalerFindNorm = normText(adminWholesalerFind);
const adminWholesalerReplaceNorm = normText(adminWholesalerReplace);

if (adminContent.includes(adminWholesalerFindNorm)) {
  adminContent = adminContent.replace(adminWholesalerFindNorm, adminWholesalerReplaceNorm);
  console.log("Success: Admin mayoristaFilteredProducts search optimization");
} else {
  console.log("Failed: Admin mayoristaFilteredProducts search optimization (not found)");
}

// C. Admin orders search query (filteredPedidos)
const adminOrdersFind = `    if (orderSearchQuery) {
        const q = orderSearchQuery.toLowerCase().trim();
        result = result.filter(p => 
          (p.cliente_nombre || '').toLowerCase().includes(q) ||
          (p.cliente_telefono || '').toLowerCase().includes(q) ||
          (p.ciudad || '').toLowerCase().includes(q) ||
          (p.direccion || '').toLowerCase().includes(q)
        ).sort((a, b) => {
          const aName = (a.cliente_nombre || '').toLowerCase();
          const bName = (b.cliente_nombre || '').toLowerCase();
          const aStarts = aName.startsWith(q);
          const bStarts = bName.startsWith(q);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return 0;
        });
      }`;

const adminOrdersReplace = `    if (orderSearchQuery) {
        const cleanOrderStr = (str: string) => 
          (str || '').normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim();
        const q = cleanOrderStr(orderSearchQuery);
        result = result.filter(p => 
          cleanOrderStr(p.cliente_nombre).includes(q) ||
          cleanOrderStr(p.cliente_telefono).includes(q) ||
          cleanOrderStr(p.ciudad).includes(q) ||
          cleanOrderStr(p.direccion).includes(q)
        ).sort((a, b) => {
          const aName = cleanOrderStr(a.cliente_nombre);
          const bName = cleanOrderStr(b.cliente_nombre);
          const aStarts = aName.startsWith(q);
          const bStarts = bName.startsWith(q);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return 0;
        });
      }`;

const adminOrdersFindNorm = normText(adminOrdersFind);
const adminOrdersReplaceNorm = normText(adminOrdersReplace);

if (adminContent.includes(adminOrdersFindNorm)) {
  adminContent = adminContent.replace(adminOrdersFindNorm, adminOrdersReplaceNorm);
  console.log("Success: Admin filteredPedidos search optimization");
} else {
  console.log("Failed: Admin filteredPedidos search optimization (not found)");
}

// D. Admin leads search query (leadsFiltrados)
const adminLeadsFind = `    if (orderSearchQuery) {
        const q = orderSearchQuery.toLowerCase().trim();
        temp = temp.filter(l => 
          (l.nombre || '').toLowerCase().includes(q) ||
          (l.telefono || '').toLowerCase().includes(q) ||
          (l.ciudad || '').toLowerCase().includes(q)
        ).sort((a, b) => {
          const aName = (a.nombre || '').toLowerCase();
          const bName = (b.nombre || '').toLowerCase();
          const aStarts = aName.startsWith(q);
          const bStarts = bName.startsWith(q);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return 0;
        });
      }`;

const adminLeadsReplace = `    if (orderSearchQuery) {
        const cleanOrderStr = (str: string) => 
          (str || '').normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim();
        const q = cleanOrderStr(orderSearchQuery);
        temp = temp.filter(l => 
          cleanOrderStr(l.nombre).includes(q) ||
          cleanOrderStr(l.telefono).includes(q) ||
          cleanOrderStr(l.ciudad).includes(q)
        ).sort((a, b) => {
          const aName = cleanOrderStr(a.nombre);
          const bName = cleanOrderStr(b.nombre);
          const aStarts = aName.startsWith(q);
          const bStarts = bName.startsWith(q);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return 0;
        });
      }`;

const adminLeadsFindNorm = normText(adminLeadsFind);
const adminLeadsReplaceNorm = normText(adminLeadsReplace);

if (adminContent.includes(adminLeadsFindNorm)) {
  adminContent = adminContent.replace(adminLeadsFindNorm, adminLeadsReplaceNorm);
  console.log("Success: Admin leadsFiltrados search optimization");
} else {
  console.log("Failed: Admin leadsFiltrados search optimization (not found)");
}

fs.writeFileSync(adminPath, adminContent.replace(/\n/g, '\r\n'), 'utf8');

console.log("All modifications completed!");
