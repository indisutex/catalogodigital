import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejar preflight de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url);
    const tenant = url.searchParams.get('tenant');

    if (!tenant) {
      return new Response(
        JSON.stringify({ error: "Falta el parámetro 'tenant' en la URL (ej: ?tenant=saramantha)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inicializar cliente de Supabase usando variables de entorno del servidor
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log(`Recibido webhook de Siigo para tenant [${tenant}]:`, JSON.stringify(payload));

    const event = payload.event; // ej: "product.created", "product.updated"
    const sp = payload.data; // Datos del producto de Siigo

    if (!sp || !sp.code) {
      return new Response(
        JSON.stringify({ error: "Payload inválido o falta el 'code' (referencia) del producto" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ref = sp.code;
    const nombre = sp.name || 'Producto sin Nombre';
    const active = sp.active !== false;

    // Obtener precio de la Lista 2
    let precio = 0;
    if (sp.prices && sp.prices[0] && sp.prices[0].price_list) {
      // Buscar la posición 2
      const price2 = sp.prices[0].price_list.find((p: any) => p.position === 2);
      precio = price2 ? (price2.value || 0) : (sp.prices[0].price_list[0]?.value || 0);
    }

    const stock = sp.available_quantity !== undefined ? sp.available_quantity : 0;

    // 1. Buscar si el producto ya existe para este tenant
    const { data: existingProd, error: findError } = await supabase
      .from('productos')
      .select('id, categoria')
      .eq('referencia', ref)
      .eq('tenant_id', tenant)
      .maybeSingle();

    if (findError) {
      throw findError;
    }

    if (existingProd) {
      if (!active) {
        // Si el producto fue desactivado en Siigo, lo eliminamos o lo ocultamos
        console.log(`Desactivando/Eliminando producto existente [Ref: ${ref}]`);
        await supabase
          .from('productos')
          .delete()
          .eq('id', existingProd.id);
      } else {
        // Actualizar precio y stock
        console.log(`Actualizando producto existente [Ref: ${ref}]: Precio = ${precio}, Stock = ${stock}`);
        await supabase
          .from('productos')
          .update({
            nombre: nombre,
            precio: precio,
            stock: stock
          })
          .eq('id', existingProd.id);
      }
    } else if (active) {
      // Crear producto nuevo
      console.log(`Creando nuevo producto vía Webhook [Ref: ${ref}]`);
      
      // Buscar o crear la categoría del producto basado en el grupo de Siigo
      const groupName = sp.account_group?.name || 'General';
      
      const { data: catData } = await supabase
        .from('categorias')
        .select('id')
        .eq('nombre', groupName)
        .maybeSingle();
        
      let categoriaId = catData?.id;
      
      if (!categoriaId) {
        const slug = groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const { data: newCat } = await supabase
          .from('categorias')
          .insert({ nombre: groupName, slug })
          .select('id')
          .single();
        categoriaId = newCat?.id;
      }

      await supabase
        .from('productos')
        .insert({
          nombre: nombre,
          descripcion: sp.description || '',
          precio: precio,
          stock: stock,
          referencia: ref,
          categoria: groupName,
          tenant_id: tenant,
          imagen_url: ''
        });
    }

    return new Response(
      JSON.stringify({ success: true, message: `Sincronización procesada para referencia ${ref}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error('Error procesando webhook:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
})
