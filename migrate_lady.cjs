const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const [k, ...v] = line.split('=');
    if (k) env[k.trim()] = v.join('=').trim().replace(/^"|"$/g, '');
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

async function migrate() {
  try {
    // 1. Fetch Lady from asesores
    const res = await fetch(`${supabaseUrl}/rest/v1/asesores?nombre=ilike.*Lady*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (!res.ok) throw new Error(await res.text());
    const asesores = await res.json();
    
    if (asesores.length === 0) {
      console.log('No se encontro a Lady en la tabla asesores.');
      return;
    }
    
    const lady = asesores[0];
    console.log('Encontrado:', lady.nombre);
    
    // 2. Insert into mayoristas
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/mayoristas`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        id: lady.id, // keep the same ID so login works instantly
        nombre: lady.nombre,
        telefono: lady.telefono,
        pin: lady.pin,
        foto_url: lady.foto_url,
        tenant_id: lady.tenant_id,
        porcentaje_ganancia: 0,
        ajustes_productos: {},
        created_at: lady.created_at
      })
    });
    
    if (!insertRes.ok) {
        // Might already exist?
        console.error('Error insertando en mayoristas:', await insertRes.text());
        return;
    }
    
    console.log('Lady copiada a mayoristas exitosamente.');
    
    // 3. Delete from asesores
    const delRes = await fetch(`${supabaseUrl}/rest/v1/asesores?id=eq.${lady.id}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (!delRes.ok) {
        console.error('Error eliminando de asesores:', await delRes.text());
    } else {
        console.log('Lady eliminada de asesores exitosamente. Migracion completa.');
    }
    
  } catch(e) {
    console.error(e);
  }
}

migrate();
