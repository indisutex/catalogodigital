const fs = require('fs');
let c = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// 1. Fix perfil_asesor bindings
const searchString = `defaultValue={asesores.find(a => a.telefono === loggedAsesorPhone)?.nombre}`;
if (c.includes(searchString)) {
  c = c.replace(
    /defaultValue=\{asesores\.find\(a => a\.telefono === loggedAsesorPhone\)\?\.nombre\}/g,
    `defaultValue={currentAsesorData.nombre}`
  );
  
  c = c.replace(
    /defaultValue=\{asesores\.find\(a => a\.telefono === loggedAsesorPhone\)\?\.pin\}/g,
    `defaultValue={currentAsesorData.pin}`
  );
  
  c = c.replace(
    /\{asesores\.find\(a => a\.telefono === loggedAsesorPhone\)\?\.foto_url && \(/g,
    `{currentAsesorData.foto_url && (`
  );
  
  c = c.replace(
    /src=\{asesores\.find\(a => a\.telefono === loggedAsesorPhone\)\?\.foto_url \?\? ''\}/g,
    `src={currentAsesorData.foto_url ?? ''}`
  );
  
  c = c.replace(
    /defaultValue=\{asesores\.find\(a => a\.telefono === loggedAsesorPhone\)\?\.foto_url \|\| ''\}/g,
    `defaultValue={currentAsesorData.foto_url || ''}`
  );
  
  // In the file upload handler, fix the local state update:
  // From: const currentAsesorData = asesores.find(a => a.telefono === loggedAsesorPhone);
  // It's inside an async handler, but `currentAsesorData` is already defined in the outer scope, 
  // however, let's just make it check if it's mayorista and update the right list.
  // Actually, wait, the upload handler is:
  /*
  const currentAsesorData = asesores.find(a => a.telefono === loggedAsesorPhone);
  if (currentAsesorData) {
    setAsesores(asesores.map(a => 
      a.id === currentAsesorData.id 
        ? { ...a, foto_url: data.publicUrl } 
        : a
    ));
  */
  
  const oldUploadStateUpdate = `const currentAsesorData = asesores.find(a => a.telefono === loggedAsesorPhone);
                                if (currentAsesorData) {
                                  setAsesores(asesores.map(a => 
                                    a.id === currentAsesorData.id 
                                      ? { ...a, foto_url: data.publicUrl } 
                                      : a
                                  ));`;
                                  
  const newUploadStateUpdate = `// currentAsesorData ya existe en el scope exterior
                                if (currentAsesorData) {
                                  if (role === 'mayorista') {
                                    setMayoristas(mayoristas.map(m => m.id === currentAsesorData.id ? { ...m, foto_url: data.publicUrl } : m));
                                  } else {
                                    setAsesores(asesores.map(a => a.id === currentAsesorData.id ? { ...a, foto_url: data.publicUrl } : a));
                                  }`;
                                  
  c = c.replace(oldUploadStateUpdate, newUploadStateUpdate);
}

// 2. Fix sidebar ordering and text for mayorista
// We will extract the productos_asesor button and insert it after resumen_asesor
const mayoristaSidebarStart = `        {role === 'mayorista' ? (
          <>
            <button className={\`nav-item \${activeTab === 'resumen_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('resumen_asesor')}>
              <span className="nav-icon"><Home size={14} /></span> Mi Negocio
              {activeTab === 'resumen_asesor' && <span className="active-dot"></span>}
            </button>`;

const productosBtn = `
            <button className={\`nav-item \${activeTab === 'productos_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('productos_asesor')}>
              <span className="nav-icon"><Package size={14} /></span> Mis Productos
              {activeTab === 'productos_asesor' && <span className="active-dot"></span>}
            </button>`;

if (c.includes(mayoristaSidebarStart) && c.includes(productosBtn)) {
  // Remove the button from its current place
  c = c.replace(productosBtn, '');
  
  // Modify the button text
  const newProductosBtn = productosBtn.replace('Mis Productos', 'Productos');
  
  // Insert it after resumen_asesor
  c = c.replace(mayoristaSidebarStart, mayoristaSidebarStart + newProductosBtn);
}

fs.writeFileSync('src/pages/Admin.tsx', c, 'utf8');
console.log('Fixed profile bindings and sidebar order');
