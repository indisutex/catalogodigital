const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dowbsbxvxjzjjhyqmyfr.supabase.co';
const supabaseKey = 'sb_publishable_-6hv7O7DhudWC7NAW8izOw_PAc8hPre';
const supabase = createClient(supabaseUrl, supabaseKey);

const deduplicateTallas = (tallasStr) => {
  if (!tallasStr) return null;
  const rawTallas = tallasStr.split(',').map(t => t.trim()).filter(Boolean);
  if (rawTallas.length === 0) return null;
  const tallasMap = new Map();
  rawTallas.forEach(t => {
    let key = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (key === 'talla unica' || key === 'unica' || key === 'tallaunica') {
      key = 'unica';
    }
    
    let displayVal = t;
    if (key === 'unica') displayVal = 'Única';

    if (!tallasMap.has(key)) tallasMap.set(key, displayVal);
  });
  return Array.from(tallasMap.values()).join(', ') || null;
};

async function fixTallas() {
  console.log('Fetching all products...');
  const { data: products, error } = await supabase.from('productos').select('id, tallas');
  
  if (error) {
    console.error('Error fetching products:', error);
    return;
  }
  
  console.log(`Found ${products.length} products.`);
  let updatedCount = 0;
  
  for (const product of products) {
    if (!product.tallas) continue;
    
    const newTallas = deduplicateTallas(product.tallas);
    if (newTallas !== product.tallas) {
      console.log(`Updating product ${product.id} tallas: "${product.tallas}" -> "${newTallas}"`);
      const { error: updateError } = await supabase
        .from('productos')
        .update({ tallas: newTallas })
        .eq('id', product.id);
        
      if (updateError) {
        console.error(`Error updating product ${product.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }
  }
  
  console.log(`Finished! Updated ${updatedCount} products.`);
}

fixTallas();
