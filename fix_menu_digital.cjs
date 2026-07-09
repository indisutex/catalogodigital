const fs = require('fs');
let c = fs.readFileSync('src/pages/MenuDigital.tsx', 'utf8');

// 1. Update loadWholesalerMarkup: fetch adjustments and call setAjustesProductos
const OLD_LWM = `        // Primero buscar en asesores
        const { data: asesoresData } = await supabase
          .from('asesores')
          .select('id, telefono, porcentaje_ganancia')
          .eq('tenant_id', tenant);

        if (asesoresData) {
          const match = asesoresData.find(a => {
            const phones = (a.telefono || '').split(',').map((p: string) => p.replace(/\\D/g, '')).filter(Boolean);
            return phones.includes(phone);
          });
          if (match && (match as any).porcentaje_ganancia) {
            setMarkupPorcentaje(Number((match as any).porcentaje_ganancia) || 0);
            return;
          }
        }

        // Si no se encontró en asesores, buscar en mayoristas (tabla independiente)
        const { data: mayoristasData } = await supabase
          .from('mayoristas')
          .select('id, telefono, porcentaje_ganancia')
          .eq('tenant_id', tenant);

        if (mayoristasData) {
          const match = mayoristasData.find(m => {
            const phones = (m.telefono || '').split(',').map((p: string) => p.replace(/\\D/g, '')).filter(Boolean);
            return phones.includes(phone);
          });
          if (match && (match as any).porcentaje_ganancia) {
            setMarkupPorcentaje(Number((match as any).porcentaje_ganancia) || 0);
            return;
          }
        }

        setMarkupPorcentaje(0);`;

const NEW_LWM = `        // Primero buscar en asesores
        const { data: asesoresData } = await supabase
          .from('asesores')
          .select('id, telefono, porcentaje_ganancia, ajustes_productos')
          .eq('tenant_id', tenant);

        if (asesoresData) {
          const match = asesoresData.find(a => {
            const phones = (a.telefono || '').split(',').map((p: string) => p.replace(/\\D/g, '')).filter(Boolean);
            return phones.includes(phone);
          });
          if (match) {
            setMarkupPorcentaje(Number((match as any).porcentaje_ganancia) || 0);
            setAjustesProductos((match as any).ajustes_productos || {});
            return;
          }
        }

        // Si no se encontró en asesores, buscar en mayoristas (tabla independiente)
        const { data: mayoristasData } = await supabase
          .from('mayoristas')
          .select('id, telefono, porcentaje_ganancia, ajustes_productos')
          .eq('tenant_id', tenant);

        if (mayoristasData) {
          const match = mayoristasData.find(m => {
            const phones = (m.telefono || '').split(',').map((p: string) => p.replace(/\\D/g, '')).filter(Boolean);
            return phones.includes(phone);
          });
          if (match) {
            setMarkupPorcentaje(Number((match as any).porcentaje_ganancia) || 0);
            setAjustesProductos((match as any).ajustes_productos || {});
            return;
          }
        }

        setMarkupPorcentaje(0);
        setAjustesProductos({});`;

if (c.includes(OLD_LWM)) {
  c = c.replace(OLD_LWM, NEW_LWM);
  console.log('loadWholesalerMarkup updated (CRLF)');
} else {
  const oldLF = OLD_LWM.replace(/\r\n/g, '\n');
  const newLF = NEW_LWM.replace(/\r\n/g, '\n');
  if (c.replace(/\r\n/g, '\n').includes(oldLF)) {
    c = c.replace(/\r\n/g, '\n').replace(oldLF, newLF);
    console.log('loadWholesalerMarkup updated (LF)');
  } else {
    console.log('WARNING: loadWholesalerMarkup not found');
  }
}

// 2. Destructure ajustesProductos, setAjustesProductos from useCart()
c = c.replace(
  `  const { items, addToCart, removeFromCart, updateQuantity, total, clearCart, buyerType, setBuyerType, markupPorcentaje, setMarkupPorcentaje } = useCart();`,
  `  const { items, addToCart, removeFromCart, updateQuantity, total, clearCart, buyerType, setBuyerType, markupPorcentaje, setMarkupPorcentaje, ajustesProductos, setAjustesProductos } = useCart();`
);

// 3. Clear settings on 'clear' ws param
c = c.replace(
  `        setMarkupPorcentaje(0);`,
  `        setMarkupPorcentaje(0);\n        setAjustesProductos({});`
);

// 4. Update product list filtering: exclude hidden products
const OLD_FILTER = `  const catActual = categorias.find(c => c.slug === filtroCategoria);
  let productosFiltrados = filtroCategoria === 'todos' 
    ? productos 
    : productos.filter(p => {
        // Enlazar subcategorías si aplica
        return p.categoria === catActual?.nombre;
      });`;

const NEW_FILTER = `  const catActual = categorias.find(c => c.slug === filtroCategoria);
  let productosFiltrados = filtroCategoria === 'todos' 
    ? productos 
    : productos.filter(p => {
        // Enlazar subcategorías si aplica
        return p.categoria === catActual?.nombre;
      });

  // Ocultar productos desactivados por el mayorista/asesor
  if (ajustesProductos) {
    productosFiltrados = productosFiltrados.filter(p => {
      const productSetting = ajustesProductos[p.id];
      return !(productSetting && productSetting.oculto);
    });
  }`;

if (c.includes(OLD_FILTER)) {
  c = c.replace(OLD_FILTER, NEW_FILTER);
  console.log('Product filtering updated (CRLF)');
} else {
  const oldLF = OLD_FILTER.replace(/\r\n/g, '\n');
  const newLF = NEW_FILTER.replace(/\r\n/g, '\n');
  if (c.replace(/\r\n/g, '\n').includes(oldLF)) {
    c = c.replace(/\r\n/g, '\n').replace(oldLF, newLF);
    console.log('Product filtering updated (LF)');
  } else {
    console.log('WARNING: Product filtering not found');
  }
}

// 5. Update getEffectivePrice calls in MenuDigital to pass ajustesProductos
c = c.replaceAll(
  `getEffectivePrice(item, buyerType, markupPorcentaje)`,
  `getEffectivePrice(item, buyerType, markupPorcentaje, ajustesProductos)`
);
c = c.replaceAll(
  `getEffectivePrice(producto, buyerType, markupPorcentaje)`,
  `getEffectivePrice(producto, buyerType, markupPorcentaje, ajustesProductos)`
);
c = c.replaceAll(
  `getEffectivePrice(detailProduct, buyerType, markupPorcentaje)`,
  `getEffectivePrice(detailProduct, buyerType, markupPorcentaje, ajustesProductos)`
);

fs.writeFileSync('src/pages/MenuDigital.tsx', c, 'utf8');
console.log('Done MenuDigital');
