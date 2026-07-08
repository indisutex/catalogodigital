const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://dowbsbxvxjzjjhyqmyfr.supabase.co', 'sb_publishable_-6hv7O7DhudWC7NAW8izOw_PAc8hPre');

async function run() {
  const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(5);
  console.log(JSON.stringify(data, null, 2));
}

run();
