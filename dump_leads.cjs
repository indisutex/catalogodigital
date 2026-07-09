const { createClient } = require('@supabase/supabase-js');

const url = "https://dowbsbxvxjzjjhyqmyfr.supabase.co";
const key = "sb_publishable_-6hv7O7DhudWC7NAW8izOw_PAc8hPre";
const supabase = createClient(url, key);

supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(10)
  .then(({ data, error }) => {
    if (error) {
      console.error("Error fetching leads:", error);
    } else {
      console.log("Recent leads in DB:");
      console.log(JSON.stringify(data, null, 2));
    }
  });
