import { supabase } from './supabase';
import type { Producto, Categoria } from '../types';

export interface SiigoCredentials {
  username: string;
  accessKey: string;
}

export class SiigoService {
  // En desarrollo usamos el proxy de Vite '/api-siigo' para evitar errores de CORS.
  // En producción, si no es localhost, puedes mantener '/api-siigo' si configuras las redirecciones en Vercel/Netlify.
  private static BASE_URL = '/api-siigo';
  private static AUTH_URL = '/api-siigo-auth';

  /**
   * Genera el token de autenticación contra la API de Siigo
   */
  public static async authenticate(credentials: SiigoCredentials): Promise<string> {
    // Siigo requiere username (email) y access_key
    const response = await fetch(`${this.AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: credentials.username,
        access_key: credentials.accessKey,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Error de autenticación con Siigo Nube');
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Obtiene la lista completa de productos desde Siigo Nube (paginado)
   */
  public static async fetchProducts(token: string): Promise<any[]> {
    let allProducts: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(`${this.BASE_URL}/products?page=${page}&page_size=25`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Error obteniendo productos de Siigo Nube');
      }

      const data = await response.json();
      const results = data.results || [];
      allProducts = [...allProducts, ...results];

      // Verificar si hay más páginas
      if (results.length < 25) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return allProducts;
  }

  /**
   * Ejecuta el proceso de sincronización con Supabase para el tenant actual
   */
  public static async syncSiigoProducts(
    tenantId: string,
    credentials: SiigoCredentials,
    onProgress: (message: string) => void
  ): Promise<{ imported: number; updated: number }> {
    onProgress('Autenticando con Siigo Nube...');
    const token = await this.authenticate(credentials);

    onProgress('Descargando catálogo de productos desde Siigo...');
    const siigoProducts = await this.fetchProducts(token);

    onProgress(`Se obtuvieron ${siigoProducts.length} productos. Sincronizando con tu tienda...`);

    let importedCount = 0;
    let updatedCount = 0;

    // 1. Obtener categorías existentes en Supabase para evitar duplicados
    const { data: dbCategorias } = await supabase
      .from('categorias')
      .select('*');
    
    const catMap = new Map<string, string>(); // Nombre -> ID
    dbCategorias?.forEach((c: Categoria) => {
      catMap.set(c.nombre.toLowerCase().trim(), c.id);
    });

    // 2. Procesar productos uno por uno
    for (const sp of siigoProducts) {
      // Omitir productos inactivos
      if (sp.active === false) continue;

      const ref = sp.code || '';
      if (!ref) continue; // Si no tiene código de barra/ref, se omite

      const nombre = sp.name || 'Producto sin Nombre';
      const descripcion = sp.description || '';
      
      // Obtener el precio (Siigo retorna una lista de precios)
      let precio = 0;
      if (sp.prices && sp.prices[0] && sp.prices[0].price_list && sp.prices[0].price_list[0]) {
        precio = sp.prices[0].price_list[0].value || 0;
      }

      // Obtener inventario/stock
      const stock = sp.stock?.total || 0;

      // Obtener o Crear Categoría basada en el Grupo Contable de Siigo
      const groupName = sp.account_group?.name || 'General';
      let categoriaId = catMap.get(groupName.toLowerCase().trim());

      if (!categoriaId) {
        // Crear categoría automáticamente si no existe
        const newSlug = groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const { data: newCat, error: catError } = await supabase
          .from('categorias')
          .insert({
            nombre: groupName,
            slug: newSlug,
            orden: (dbCategorias?.length || 0) + 1
          })
          .select()
          .single();

        if (!catError && newCat) {
          categoriaId = newCat.id;
          catMap.set(groupName.toLowerCase().trim(), newCat.id);
        }
      }

      // 3. Buscar si el producto ya existe en la DB por referencia y tenant_id
      const { data: existingProd } = await supabase
        .from('productos')
        .select('*')
        .eq('referencia', ref)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existingProd) {
        // Opción A: Solo actualizar precio y stock para no sobreescribir fotos/videos manuales
        await supabase
          .from('productos')
          .update({
            precio: precio,
            stock: stock,
          })
          .eq('id', existingProd.id);
        updatedCount++;
      } else {
        // Crear producto nuevo en Supabase
        await supabase
          .from('productos')
          .insert({
            nombre: nombre,
            descripcion: descripcion,
            precio: precio,
            stock: stock,
            referencia: ref,
            categoria: groupName, // O mapeado a Categoria.nombre
            tenant_id: tenantId,
            imagen_url: '' // Inicialmente sin imagen hasta que la suban en Admin
          });
        importedCount++;
      }
    }

    // Registrar fecha de última sincronización
    await supabase
      .from('configuracion')
      .update({
        siigo_sincronizado_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId);

    return { imported: importedCount, updated: updatedCount };
  }
}
