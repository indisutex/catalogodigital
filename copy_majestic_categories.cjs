const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://dowbsbxvxjzjjhyqmyfr.supabase.co';
const supabaseAnonKey = 'sb_publishable_-6hv7O7DhudWC7NAW8izOw_PAc8hPre';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function copyMajesticCategories() {
  console.log('🚀 Iniciando copia de categorías desde Sublimados Majestic hacia todas las empresas...');
  
  const sourceTenant = 'sublimados_majestic';
  const targetTenants = ['saramantha', 'lovely', 'pijamas_lucerito', 'indisutex'];

  // 1. Obtener categorías de Majestic
  const { data: sourceCats, error: errCats } = await supabase
    .from('categorias')
    .select('*')
    .eq('tenant_id', sourceTenant);

  if (errCats || !sourceCats || sourceCats.length === 0) {
    console.error('❌ Error al obtener categorías de Sublimados Majestic:', errCats);
    return;
  }

  console.log(`📌 Encontradas ${sourceCats.length} categorías en Sublimados Majestic:`);
  sourceCats.forEach(c => console.log(` - [Cat] ${c.nombre} (ID: ${c.id})`));

  // 2. Obtener subcategorías de Majestic
  const { data: sourceSubcats } = await supabase
    .from('subcategorias')
    .select('*')
    .eq('tenant_id', sourceTenant);

  console.log(`📌 Encontradas ${sourceSubcats?.length || 0} subcategorías en Sublimados Majestic.`);

  // 3. Copiar a cada tenant destino
  for (const targetId of targetTenants) {
    console.log(`\n----------------------------------------`);
    console.log(`🏢 Procesando copia hacia tienda destino: [${targetId.toUpperCase()}]`);

    // Categorías existentes en el destino
    const { data: destCats } = await supabase
      .from('categorias')
      .select('*')
      .eq('tenant_id', targetId);

    // Subcategorías existentes en el destino
    const { data: destSubcats } = await supabase
      .from('subcategorias')
      .select('*')
      .eq('tenant_id', targetId);

    let newCatsCount = 0;
    let newSubcatsCount = 0;

    for (const srcCat of sourceCats) {
      // Verificar si ya existe en destino
      let destCat = destCats?.find(c => c.nombre.trim().toLowerCase() === srcCat.nombre.trim().toLowerCase());
      let destCatId = destCat?.id;

      if (!destCatId) {
        // Insertar nueva categoría en destino sin campos extra no existentes
        const catPayload = {
          nombre: srcCat.nombre,
          slug: srcCat.slug || srcCat.nombre.toLowerCase().replace(/ /g, '-'),
          icono: srcCat.icono || null,
          color: srcCat.color || null,
          imagen_url: srcCat.imagen_url || null,
          orden: srcCat.orden || 0,
          tenant_id: targetId
        };

        const { data: newCat, error: insertCatErr } = await supabase
          .from('categorias')
          .insert([catPayload])
          .select()
          .single();

        if (insertCatErr) {
          console.error(`  ❌ Error al insertar categoría '${srcCat.nombre}' en ${targetId}:`, insertCatErr.message);
        } else if (newCat) {
          destCatId = newCat.id;
          newCatsCount++;
          console.log(`  ✅ Categoría creada en ${targetId}: '${newCat.nombre}'`);
        }
      } else {
        console.log(`  ℹ️ Categoría ya existía en ${targetId}: '${srcCat.nombre}'`);
      }

      // Procesar subcategorías asociadas
      if (destCatId && sourceSubcats) {
        const matchingSubcats = sourceSubcats.filter(s => s.categoria_id === srcCat.id);
        for (const srcSub of matchingSubcats) {
          const existsSub = destSubcats?.find(s => 
            s.categoria_id === destCatId && 
            s.nombre.trim().toLowerCase() === srcSub.nombre.trim().toLowerCase()
          );

          if (!existsSub) {
            const subPayload = {
              categoria_id: destCatId,
              nombre: srcSub.nombre,
              slug: srcSub.slug || srcSub.nombre.toLowerCase().replace(/ /g, '-'),
              orden: srcSub.orden || 0,
              tenant_id: targetId
            };

            const { data: newSub, error: insertSubErr } = await supabase
              .from('subcategorias')
              .insert([subPayload])
              .select()
              .single();

            if (!insertSubErr) {
              newSubcatsCount++;
              console.log(`    ↳ ✅ Subcategoría creada: '${srcSub.nombre}' para categoría '${srcCat.nombre}'`);
            } else {
              console.error(`    ↳ ❌ Error subcategoría '${srcSub.nombre}':`, insertSubErr.message);
            }
          }
        }
      }
    }

    console.log(`🎉 Resumen para ${targetId.toUpperCase()}: ${newCatsCount} categorías nuevas, ${newSubcatsCount} subcategorías nuevas.`);
  }

  console.log(`\n========================================`);
  console.log(`✨ ¡PROCESO DE COPIA COMPLETADO CON ÉXITO PARA TODAS LAS EMPRESAS!`);
}

copyMajesticCategories();
