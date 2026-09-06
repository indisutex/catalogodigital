const supabaseUrl = 'https://dowbsbxvxjzjjhyqmyfr.supabase.co';
const anonKey = 'sb_publishable_-6hv7O7DhudWC7NAW8izOw_PAc8hPre';
const headers = { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` };

async function run() {
  console.log('--- Search all records with Brenda ---');
  const resP = await fetch(`${supabaseUrl}/rest/v1/pedidos?cliente_nombre=ilike.*brenda*`, { headers });
  const pedidos = await resP.json();
  console.log('Pedidos for Brenda:');
  pedidos.forEach(p => console.log(p.id, p.cliente_nombre, p.cliente_telefono, p.linea_whatsapp, p.created_at));

  const resL = await fetch(`${supabaseUrl}/rest/v1/leads?nombre=ilike.*brenda*`, { headers });
  const leads = await resL.json();
  console.log('Leads for Brenda:');
  leads.forEach(l => console.log(l.id, l.nombre, l.telefono, l.linea_whatsapp, l.created_at));
}

run();
