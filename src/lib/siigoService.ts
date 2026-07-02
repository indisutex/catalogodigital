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
        'Partner-Id': 'indisutex'
      },
      body: JSON.stringify({
        username: credentials.username,
        access_key: credentials.accessKey,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.message || (errData.errors && errData.errors[0]?.message) || 'Error de autenticación con Siigo Nube';
      throw new Error(errMsg);
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
          'Partner-Id': 'indisutex'
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.message || (errData.errors && errData.errors[0]?.message) || 'Error 400 de validación en Siigo';
        throw new Error(`Error de API Siigo: ${errMsg}`);
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
   * Compara los productos de Siigo con los locales de Supabase y calcula los cambios
   */
  public static async fetchAndCompare(
    tenantId: string,
    credentials: SiigoCredentials,
    onProgress: (message: string) => void
  ): Promise<{ 
    toCreate: any[]; 
    toUpdate: { localId: string; nombre: string; referencia: string; precioViejo: number; precioNuevo: number; stockViejo: number; stockNuevo: number }[] 
  }> {
    onProgress('Autenticando con Siigo Nube...');
    const token = await this.authenticate(credentials);

    onProgress('Descargando catálogo de productos desde Siigo...');
    const siigoProducts = await this.fetchProducts(token);

    onProgress(`Se obtuvieron ${siigoProducts.length} productos de Siigo. Comparando con base de datos local...`);

    // 1. Obtener productos locales
    const { data: dbProducts } = await supabase
      .from('productos')
      .select('*')
      .eq('tenant_id', tenantId);

    const localProdMap = new Map<string, Producto>(); // Referencia -> Producto
    dbProducts?.forEach((p: Producto) => {
      if (p.referencia) {
        localProdMap.set(p.referencia.toLowerCase().trim(), p);
      }
    });

    const toCreate: any[] = [];
    const toUpdate: any[] = [];

    // 2. Clasificar productos
    for (const sp of siigoProducts) {
      if (sp.active === false) continue;

      const ref = sp.code || '';
      if (!ref) continue;

      const nombre = sp.name || 'Producto sin Nombre';
      const descripcion = sp.description || '';
      
      let precioNuevo = 0;
      if (sp.prices && sp.prices[0] && sp.prices[0].price_list && sp.prices[0].price_list[0]) {
        precioNuevo = sp.prices[0].price_list[0].value || 0;
      }

      const stockNuevo = sp.stock?.total || 0;
      const groupName = sp.account_group?.name || 'General';

      const localMatch = localProdMap.get(ref.toLowerCase().trim());

      if (localMatch) {
        // Verificar si hay cambios en precio o stock
        const tieneCambios = localMatch.precio !== precioNuevo || (localMatch.stock || 0) !== stockNuevo;
        if (tieneCambios) {
          toUpdate.push({
            localId: localMatch.id,
            nombre: localMatch.nombre,
            referencia: ref,
            precioViejo: localMatch.precio,
            precioNuevo,
            stockViejo: localMatch.stock || 0,
            stockNuevo
          });
        }
      } else {
        // Es un producto nuevo
        toCreate.push({
          nombre,
          descripcion,
          precio: precioNuevo,
          stock: stockNuevo,
          referencia: ref,
          categoria: groupName
        });
      }
    }

    return { toCreate, toUpdate };
  }

  /**
   * Aplica los cambios aprobados en la base de datos de Supabase
   */
  public static async applySync(
    tenantId: string,
    toCreate: any[],
    toUpdate: any[],
    onProgress: (message: string) => void
  ): Promise<{ imported: number; updated: number }> {
    onProgress(`Iniciando guardado de cambios en la base de datos...`);

    // 1. Obtener categorías existentes para mapear
    const { data: dbCategorias } = await supabase
      .from('categorias')
      .select('*');
    
    const catMap = new Map<string, string>();
    dbCategorias?.forEach((c: Categoria) => {
      catMap.set(c.nombre.toLowerCase().trim(), c.id);
    });

    let importedCount = 0;
    let updatedCount = 0;

    // 2. Procesar inserciones de nuevos productos
    for (const item of toCreate) {
      const groupName = item.categoria;
      let categoriaId = catMap.get(groupName.toLowerCase().trim());

      if (!categoriaId) {
        // Crear categoría si no existe
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

      onProgress(`Creando producto: ${item.nombre} (Ref: ${item.referencia})`);
      await supabase
        .from('productos')
        .insert({
          nombre: item.nombre,
          descripcion: item.descripcion,
          precio: item.precio,
          stock: item.stock,
          referencia: item.referencia,
          categoria: groupName,
          tenant_id: tenantId,
          imagen_url: '' // Inicialmente vacío
        });
      importedCount++;
    }

    // 3. Procesar actualizaciones de stock/precio
    for (const item of toUpdate) {
      onProgress(`Actualizando precio/stock: ${item.nombre} (Ref: ${item.referencia})`);
      await supabase
        .from('productos')
        .update({
          precio: item.precioNuevo,
          stock: item.stockNuevo
        })
        .eq('id', item.localId);
      updatedCount++;
    }

    // Registrar fecha de última sincronización
    await supabase
      .from('configuracion')
      .update({
        siigo_sincronizado_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId);

    onProgress('Sincronización finalizada exitosamente.');
    return { imported: importedCount, updated: updatedCount };
  }
}
