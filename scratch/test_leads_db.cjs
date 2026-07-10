const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read from .env file
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLeads() {
  console.log("Fetching last 5 leads...");
  const { data, error } = await supabase.from('leads').select('*').limit(5).order('created_at', { ascending: false });
  if (error) {
    console.error("Error fetching leads:", error);
  } else {
    console.log("Last 5 leads in DB:");
    data.forEach(l => {
      console.log(`ID: ${l.id}, Nombre: ${l.nombre}, Estado: ${l.estado}, Retargeting: ${l.retargeting_estado}, Tenant: ${l.tenant_id}`);
    });
  }

  const tenantId = data && data[0] ? data[0].tenant_id : 'default-tenant';

  console.log(`\nTesting insertion with tenant_id='${tenantId}' and estado='abandonado'...`);
  const { data: insData, error: insError } = await supabase.from('leads').insert({
    nombre: 'Test Abandonado',
    telefono: '1234567890',
    estado: 'abandonado',
    tenant_id: tenantId
  }).select();

  if (insError) {
    console.error("FAILED to insert with estado='abandonado':", insError.message);
  } else {
    console.log("SUCCESS inserted with estado='abandonado'!");
    await supabase.from('leads').delete().eq('id', insData[0].id);
  }

  console.log(`\nTesting insertion with tenant_id='${tenantId}' and estado='borrador'...`);
  const { data: insData2, error: insError2 } = await supabase.from('leads').insert({
    nombre: 'Test Borrador',
    telefono: '1234567890',
    estado: 'borrador',
    tenant_id: tenantId
  }).select();

  if (insError2) {
    console.error("FAILED to insert with estado='borrador':", insError2.message);
  } else {
    console.log("SUCCESS inserted with estado='borrador'!");
    await supabase.from('leads').delete().eq('id', insData2[0].id);
  }
}

testLeads();
