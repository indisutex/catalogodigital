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
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    while (hasMore) {
      let response: Response | null = null;
      let retries = 3;

      while (retries > 0) {
        try {
          response = await fetch(`${this.BASE_URL}/products?page=${page}&page_size=100`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Partner-Id': 'indisutex'
            },
          });

          if (response.ok) {
            break;
          }

          // Si es un error temporal (503, 429) o del servidor, reintentamos con espera
          if (response.status === 503 || response.status === 429 || response.status >= 500) {
            retries--;
            console.warn(`Siigo API respondió con ${response.status}. Reintentando en 2 segundos... (${retries} intentos restantes)`);
            await sleep(2000);
          } else {
            // Si es un error de cliente (400, 401, 403), fallamos inmediatamente
            break;
          }
        } catch (fetchErr) {
          retries--;
          if (retries === 0) throw fetchErr;
          await sleep(2000);
        }
      }

      if (!response || !response.ok) {
        const errData = await response?.json().catch(() => ({})) || {};
        const errMsg = errData.message || (errData.errors && errData.errors[0]?.message) || `Error ${response?.status || 'desconocido'}`;
        throw new Error(`Error de API Siigo en página ${page}: ${errMsg}`);
      }

      const data = await response.json();
      const results = data.results || [];
      allProducts = [...allProducts, ...results];

      // Verificar si hay más páginas
      if (results.length < 100) {
        hasMore = false;
      } else {
        page++;
        // Esperar 250ms entre peticiones para respetar los límites de tasa (Rate Limits) de Siigo
        await sleep(250);
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

      // En Siigo Nube API V1, el stock viene en la propiedad available_quantity
      const stockNuevo = sp.available_quantity !== undefined ? sp.available_quantity : 0;
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

  /**
   * Suscribe la URL de Supabase Edge Function a los eventos de Siigo Nube
   */
  public static async registerWebhooks(
    credentials: SiigoCredentials,
    webhookUrl: string,
    onProgress: (message: string) => void
  ): Promise<void> {
    onProgress('Autenticando con Siigo Nube...');
    const token = await this.authenticate(credentials);

    // 1. Obtener webhooks existentes para evitar duplicados y errores 400
    onProgress('Obteniendo webhooks activos en Siigo...');
    const listRes = await fetch(`${this.BASE_URL}/webhooks`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': 'indisutex'
      }
    });

    let existingWebhooks: any[] = [];
    if (listRes.ok) {
      existingWebhooks = await listRes.json();
    }

    const topics = [
      'public.siigoapi.products.create',
      'public.siigoapi.products.update'
    ];

    for (const topic of topics) {
      const match = existingWebhooks.find(wh => wh.topic === topic);

      if (match) {
        if (match.url === webhookUrl) {
          onProgress(`ℹ️ El evento ${topic} ya está correctamente suscrito a esta URL.`);
          continue;
        } else {
          // Si la URL cambió, eliminamos el webhook anterior
          onProgress(`🔄 URL diferente detectada para ${topic}. Eliminando webhook antiguo...`);
          const delRes = await fetch(`${this.BASE_URL}/webhooks/${match.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Partner-Id': 'indisutex'
            }
          });
          if (!delRes.ok) {
            onProgress(`⚠️ No se pudo eliminar el webhook antiguo: ${delRes.statusText}`);
          }
        }
      }

      onProgress(`Suscribiendo a evento: ${topic}...`);
      const response = await fetch(`${this.BASE_URL}/webhooks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Partner-Id': 'indisutex'
        },
        body: JSON.stringify({
          application_id: 'indisutex',
          url: webhookUrl,
          topic: topic
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.message || (errData.errors && errData.errors[0]?.message) || `Error al suscribir a ${topic}`;
        onProgress(`❌ Error: ${errMsg}`);
      } else {
        onProgress(`✅ Suscripción exitosa a ${topic}`);
      }
    }
  }

  /**
   * Crea una factura de venta (Invoice) en Siigo Nube para un pedido confirmado
   */
  public static async createSiigoInvoice(
    tenantId: string,
    order: any,
    credentials: SiigoCredentials,
    onProgress: (message: string) => void
  ): Promise<any> {
    onProgress('Autenticando con Siigo Nube...');
    const token = await this.authenticate(credentials);

    // 1. Obtener Tipo de Documento FV (Factura de Venta) activo
    onProgress('Consultando tipos de comprobante de venta (FV)...');
    const docRes = await fetch(`${this.BASE_URL}/document-types?type=FV`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': 'indisutex'
      }
    });

    if (!docRes.ok) throw new Error('No se pudieron consultar los tipos de comprobante en Siigo.');
    const docTypes = await docRes.json();
    const activeDoc = docTypes.find((d: any) => d.active === true);
    if (!activeDoc) throw new Error('No se encontró ningún tipo de comprobante FV activo en tu Siigo.');
    onProgress(`Comprobante FV a usar: ${activeDoc.name} (ID: ${activeDoc.id})`);

    // 2. Obtener vendedor (Vendedor por defecto) activo
    onProgress('Consultando usuarios/vendedores activos...');
    const usersRes = await fetch(`${this.BASE_URL}/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': 'indisutex'
      }
    });
    
    let sellerId = 0;
    if (usersRes.ok) {
      const users = await usersRes.json();
      const activeSeller = users.results?.find((u: any) => u.active === true);
      if (activeSeller) {
        sellerId = activeSeller.id;
      }
    }
    onProgress(`Vendedor asignado: ID ${sellerId || 'Predeterminado'}`);

    // 3. Obtener métodos de pago activos en Siigo
    onProgress('Consultando formas de pago habilitadas...');
    const paymentRes = await fetch(`${this.BASE_URL}/payment-types`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': 'indisutex'
      }
    });

    if (!paymentRes.ok) throw new Error('No se pudieron consultar los métodos de pago en Siigo.');
    const paymentsList = await paymentRes.json();
    const activePayment = paymentsList.find((p: any) => p.active === true);
    if (!activePayment) throw new Error('No hay métodos de pago activos en tu Siigo Nube.');
    onProgress(`Forma de pago asignada: ${activePayment.name} (ID: ${activePayment.id})`);

    // 4. Buscar o crear cliente
    const rawPhone = (order.cliente_telefono || '').replace(/\D/g, '');
    const clientIdent = rawPhone || '222222222222'; // fallback a Consumidor Final de Colombia si no hay teléfono
    onProgress(`Buscando cliente con identificación/cédula: ${clientIdent}...`);

    const customerCheckRes = await fetch(`${this.BASE_URL}/customers?identification=${clientIdent}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': 'indisutex'
      }
    });

    let customerExists = false;
    if (customerCheckRes.ok) {
      const checkData = await customerCheckRes.json();
      if (checkData.results && checkData.results.length > 0) {
        customerExists = true;
      }
    }

    if (!customerExists && clientIdent !== '222222222222') {
      onProgress(`Creando cliente nuevo: ${order.cliente_nombre} en Siigo...`);
      const createCustRes = await fetch(`${this.BASE_URL}/customers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Partner-Id': 'indisutex'
        },
        body: JSON.stringify({
          person_type: 'Person',
          id_type: '13', // Cédula de ciudadanía
          identification: clientIdent,
          name: [order.cliente_nombre || 'Cliente Genérico', ''],
          address: {
            address: order.direccion || 'Dirección de Entrega',
            city: {
              country_code: 'Co',
              state_code: '76', // Valle
              city_code: '76001' // Cali
            }
          },
          phones: [{
            number: clientIdent
          }],
          contacts: [{
            first_name: order.cliente_nombre || 'Cliente',
            last_name: 'Genérico',
            email: 'correo@cliente.com'
          }]
        })
      });

      if (!createCustRes.ok) {
        onProgress('⚠️ No se pudo crear el cliente específico. Se usará Consumidor Final (222222222222).');
      } else {
        onProgress(`✅ Cliente creado con éxito.`);
      }
    } else {
      onProgress(`Cliente verificado en Siigo.`);
    }

    // 5. Estructurar los ítems de la factura
    const invoiceItems = (order.productos || []).map((p: any) => ({
      code: p.referencia || '',
      description: p.nombre || '',
      quantity: p.cantidad || 1,
      price: p.precio || 0
    }));

    if (invoiceItems.length === 0 || invoiceItems.some((item: any) => !item.code)) {
      throw new Error('El pedido contiene productos sin código de referencia de Siigo.');
    }

    // 6. Enviar la Factura a Siigo Nube
    const today = new Date().toISOString().split('T')[0];
    const invoicePayload = {
      document: {
        id: activeDoc.id
      },
      date: today,
      customer: {
        identification: customerExists ? clientIdent : '222222222222',
        branch_office: 0
      },
      seller: sellerId,
      items: invoiceItems,
      payments: [
        {
          id: activeDoc.id === activePayment.id ? activePayment.id + 1 : activePayment.id, // Evitar colisión si IDs coinciden
          id_type: activePayment.id,
          value: order.total,
          due_date: today
        }
      ]
    };

    onProgress('Enviando Factura de Venta a Siigo Nube...');
    const invoiceRes = await fetch(`${this.BASE_URL}/invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': 'indisutex'
      },
      body: JSON.stringify(invoicePayload)
    });

    if (!invoiceRes.ok) {
      const errData = await invoiceRes.json().catch(() => ({}));
      const errMsg = errData.message || (errData.errors && errData.errors[0]?.message) || 'Error desconocido al facturar';
      throw new Error(`Error de Siigo al facturar: ${errMsg}`);
    }

    const invoiceData = await invoiceRes.json();
    onProgress(`✅ ¡Factura creada exitosamente en Siigo! Número: ${invoiceData.number}`);
    return invoiceData;
  }
}
