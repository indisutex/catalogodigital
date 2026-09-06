const supabaseUrl = 'https://dowbsbxvxjzjjhyqmyfr.supabase.co';
const anonKey = 'sb_publishable_-6hv7O7DhudWC7NAW8izOw_PAc8hPre';
const headers = { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` };

async function run() {
  console.log('--- Search for Brenda in pedidos ---');
  const res = await fetch(`${supabaseUrl}/rest/v1/pedidos?cliente_telefono=ilike.*3155211109*`, { headers });
  const pedidos = await res.json();
  console.log('Pedidos found:', pedidos);

  console.log('--- Search for Brenda in leads ---');
  const res2 = await fetch(`${supabaseUrl}/rest/v1/leads?telefono=ilike.*3155211109*`, { headers });
  const leads = await res2.json();
  console.log('Leads found:', leads);
}

run();
