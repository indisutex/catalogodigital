const fs = require('fs');
let c = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// Normalizar a LF para búsquedas
let lf = c.replace(/\r\n/g, '\n');
let changed = false;

// FIX 1: Eliminar el <img> espurio insertado antes del input de PIN
const BAD_IMG = `                        <img src={asesores.find(a => a.telefono === loggedAsesorPhone)?.foto_url ?? ''} className="img-preview-thumb" alt="Foto Perfil" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }} />\n`;
if (lf.includes(BAD_IMG)) {
  lf = lf.replace(BAD_IMG, '');
  console.log('FIX 1: Removed spurious img near PIN field');
  changed = true;
} else {
  console.log('WARN 1: Spurious img not found (may already be removed)');
}

// FIX 2: Corregir src de foto_url en el bloque de Foto de Perfil (puede ser null)
const OLD2 = `src={asesores.find(a => a.telefono === loggedAsesorPhone)?.foto_url} className="img-preview-thumb"`;
const NEW2 = `src={asesores.find(a => a.telefono === loggedAsesorPhone)?.foto_url ?? ''} className="img-preview-thumb"`;
if (lf.includes(OLD2)) {
  lf = lf.replace(OLD2, NEW2);
  console.log('FIX 2: Added ?? empty string to foto_url src in perfil section');
  changed = true;
} else {
  console.log('WARN 2: foto_url src already fixed or not found');
}

// FIX 3: Corregir src de bestAsesorObj.foto_url en la tarjeta de ranking (puede ser null)
const OLD3 = `src={bestAsesorObj.foto_url} alt={bestAsesorObj.nombre}`;
const NEW3 = `src={bestAsesorObj?.foto_url ?? ''} alt={bestAsesorObj?.nombre ?? ''}`;
if (lf.includes(OLD3)) {
  lf = lf.replace(OLD3, NEW3);
  console.log('FIX 3: Added null coalescing to bestAsesorObj.foto_url src');
  changed = true;
} else {
  console.log('WARN 3: bestAsesorObj.foto_url src already fixed or not found');
}

if (changed) {
  fs.writeFileSync('src/pages/Admin.tsx', lf, 'utf8');
  console.log('Done — Admin.tsx saved.');
} else {
  console.log('No changes needed.');
}
