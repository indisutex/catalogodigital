import { supabase } from './supabase';
import type { 
  ERPTercero, 
  ERPCuentaPUC, 
  ERPCentroCosto, 
  ERPComprobanteContable, 
  ERPAsientoContable,
  ERPBalancePruebaItem 
} from '../types/erp';

export class ERPContabilidadService {

  /**
   * Obtiene el catálogo del Plan Único de Cuentas (PUC)
   */
  public static async fetchPUC(tenantId: string): Promise<ERPCuentaPUC[]> {
    let { data, error } = await supabase
      .from('erp_cuentas_puc')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('codigo', { ascending: true });

    if (error) {
      console.error('Error al consultar catálogo PUC:', error);
      throw new Error(`Error PUC: ${error.message}`);
    }

    if (!data || data.length === 0) {
      // Auto-inicialización dinámica multitenant para cualquier marca/inquilino nuevo
      try {
        await supabase.rpc('erp_inicializar_puc_tenant', { p_tenant_id: tenantId });
      } catch (e) {
        console.warn('RPC erp_inicializar_puc_tenant no disponible aún o ya ejecutado:', e);
      }
      
      const { data: reData } = await supabase
        .from('erp_cuentas_puc')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('codigo', { ascending: true });
        
      if (reData && reData.length > 0) {
        data = reData;
      }
    }

    return data || [];
  }

  /**
   * Crea o actualiza una cuenta en el árbol PUC
   */
  public static async saveCuentaPUC(cuenta: Partial<ERPCuentaPUC>): Promise<ERPCuentaPUC> {
    const { data, error } = await supabase
      .from('erp_cuentas_puc')
      .upsert(cuenta)
      .select()
      .single();

    if (error) {
      throw new Error(`Error al guardar cuenta PUC: ${error.message}`);
    }
    return data;
  }

  /**
   * Consulta la maestra de Terceros (Clientes, Proveedores, Empleados)
   */
  public static async fetchTerceros(tenantId: string): Promise<ERPTercero[]> {
    const { data, error } = await supabase
      .from('erp_terceros')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('razon_social', { ascending: true });

    if (error) {
      console.error('Error al consultar terceros:', error);
      throw new Error(`Error Terceros: ${error.message}`);
    }
    return data || [];
  }

  /**
   * Crea o actualiza un Tercero en la maestra ERP
   */
  public static async upsertTercero(tercero: Partial<ERPTercero>): Promise<ERPTercero> {
    const { data, error } = await supabase
      .from('erp_terceros')
      .upsert(tercero, { onConflict: 'tenant_id, numero_documento' })
      .select()
      .single();

    if (error) {
      throw new Error(`Error al registrar tercero: ${error.message}`);
    }
    return data;
  }

  /**
   * Consulta los Centros de Costo activos
   */
  public static async fetchCentrosCosto(tenantId: string): Promise<ERPCentroCosto[]> {
    const { data, error } = await supabase
      .from('erp_centros_costo')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('activo', true)
      .order('codigo', { ascending: true });

    if (error) throw new Error(`Error Centros Costo: ${error.message}`);
    return data || [];
  }

  /**
   * Registra un Comprobante Contable completo verificando la ecuación de Partida Doble
   */
  public static async registrarComprobante(
    comprobante: Omit<ERPComprobanteContable, 'id' | 'created_at'>,
    asientos: Omit<ERPAsientoContable, 'id' | 'comprobante_id' | 'created_at'>[]
  ): Promise<ERPComprobanteContable> {
    if (!asientos || asientos.length === 0) {
      throw new Error('Un comprobante contable debe incluir al menos dos asientos.');
    }

    // 1. Validar Principio de Partida Doble (Débito == Crédito)
    const totalDebito = asientos.reduce((sum, a) => sum + (Number(a.debito) || 0), 0);
    const totalCredito = asientos.reduce((sum, a) => sum + (Number(a.credito) || 0), 0);

    const diferencia = Math.abs(totalDebito - totalCredito);
    if (diferencia > 0.01) {
      throw new Error(`Comprobante desbalanceado. Total Débito: $${totalDebito.toLocaleString()}, Total Crédito: $${totalCredito.toLocaleString()} (Diferencia: $${diferencia.toLocaleString()}).`);
    }

    // 2. Insertar Encabezado
    const { data: compData, error: compErr } = await supabase
      .from('erp_comprobantes_contables')
      .insert({
        tenant_id: comprobante.tenant_id,
        tipo_comprobante: comprobante.tipo_comprobante,
        fecha: comprobante.fecha || new Date().toISOString().split('T')[0],
        concepto: comprobante.concepto,
        referencia_origen: comprobante.referencia_origen,
        origen_modulo: comprobante.origen_modulo || 'manual',
        estado: comprobante.estado || 'Asentado',
        creado_por: comprobante.creado_por || 'Sistema ERP'
      })
      .select()
      .single();

    if (compErr || !compData) {
      throw new Error(`Error al crear comprobante: ${compErr?.message || 'Error desconocido'}`);
    }

    // 3. Insertar Detalle de Asientos
    const asientosPayload = asientos.map(a => ({
      comprobante_id: compData.id,
      tenant_id: comprobante.tenant_id,
      cuenta_id: a.cuenta_id,
      cuenta_codigo: a.cuenta_codigo,
      cuenta_nombre: a.cuenta_nombre,
      tercero_id: a.tercero_id,
      centro_costo_id: a.centro_costo_id,
      concepto_linea: a.concepto_linea || comprobante.concepto,
      debito: a.debito,
      credito: a.credito,
      base_gravable: a.base_gravable || 0
    }));

    const { error: asiantosErr } = await supabase
      .from('erp_asientos_contables')
      .insert(asientosPayload);

    if (asiantosErr) {
      // Reversar encabezado si fallan los asientos
      await supabase.from('erp_comprobantes_contables').delete().eq('id', compData.id);
      throw new Error(`Error al registrar detalle contable: ${asiantosErr.message}`);
    }

    return compData;
  }

  /**
   * Genera AUTOMÁTICAMENTE el asiento contable de partida doble para un pedido de venta
   */
  public static async contabilizarVentaAutomatica(tenantId: string, pedido: any): Promise<void> {
    try {
      // 1. Buscar o Registrar Tercero Cliente
      const doc = (pedido.cliente_telefono || '').replace(/\D/g, '') || '222222222222';
      const tercero = await this.upsertTercero({
        tenant_id: tenantId,
        tipo_documento: doc === '222222222222' ? 'NIT' : 'CC',
        numero_documento: doc,
        razon_social: pedido.cliente_nombre || 'Cliente Consumidor Final',
        telefono: pedido.cliente_telefono,
        direccion: pedido.direccion,
        ciudad: pedido.ciudad,
        es_cliente: true
      });

      const total = Number(pedido.total) || 0;
      if (total <= 0) return;

      // 2. Definir cuentas PUC
      const cuentaCaja = '110505'; // Caja General (Débito)
      const cuentaVentas = '413505'; // Ingresos por Ventas Textiles (Crédito)

      // 3. Generar Comprobante Automático
      await this.registrarComprobante({
        tenant_id: tenantId,
        tipo_comprobante: 'Venta',
        fecha: new Date().toISOString().split('T')[0],
        concepto: `Venta Automática Pedido #${pedido.id.substring(0, 8)} - ${pedido.cliente_nombre}`,
        referencia_origen: pedido.id,
        origen_modulo: 'ventas',
        estado: 'Asentado',
        creado_por: 'ERP Contabilización Automática'
      }, [
        {
          tenant_id: tenantId,
          cuenta_codigo: cuentaCaja,
          cuenta_nombre: 'Caja General',
          tercero_id: tercero.id,
          concepto_linea: `Ingreso Caja Venta Pedido #${pedido.id.substring(0, 8)}`,
          debito: total,
          credito: 0
        },
        {
          tenant_id: tenantId,
          cuenta_codigo: cuentaVentas,
          cuenta_nombre: 'Venta de Textiles y Confecciones',
          tercero_id: tercero.id,
          concepto_linea: `Venta Comercial Pedido #${pedido.id.substring(0, 8)}`,
          debito: 0,
          credito: total
        }
      ]);

      console.log(`✅ Contabilización automática de venta ejecutada para Pedido ${pedido.id}`);
    } catch (err) {
      console.warn('⚠️ No se pudo contabilizar automáticamente la venta:', err);
    }
  }

  /**
   * Consulta el Libro Diario General de Comprobantes
   */
  public static async fetchLibroDiario(tenantId: string): Promise<ERPComprobanteContable[]> {
    const { data, error } = await supabase
      .from('erp_comprobantes_contables')
      .select('*, asientos:erp_asientos_contables(*)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Error Libro Diario: ${error.message}`);
    return data || [];
  }

  /**
   * Genera el Balance de Prueba agrupado por cuenta PUC
   */
  public static async fetchBalancePrueba(tenantId: string): Promise<ERPBalancePruebaItem[]> {
    const { data: asientos, error } = await supabase
      .from('erp_asientos_contables')
      .select('cuenta_codigo, cuenta_nombre, debito, credito')
      .eq('tenant_id', tenantId);

    if (error) throw new Error(`Error Balance de Prueba: ${error.message}`);

    const map = new Map<string, { nombre: string; debito: number; credito: number }>();

    asientos?.forEach(a => {
      const code = a.cuenta_codigo;
      const prev = map.get(code) || { nombre: a.cuenta_nombre, debito: 0, credito: 0 };
      prev.debito += Number(a.debito) || 0;
      prev.credito += Number(a.credito) || 0;
      map.set(code, prev);
    });

    const resultado: ERPBalancePruebaItem[] = [];
    map.forEach((val, code) => {
      const nat = code.startsWith('1') || code.startsWith('5') || code.startsWith('6') ? 'Débito' : 'Crédito';
      const saldo = nat === 'Débito' ? val.debito - val.credito : val.credito - val.debito;
      resultado.push({
        cuenta_codigo: code,
        cuenta_nombre: val.nombre,
        naturaleza: nat,
        saldo_anterior: 0,
        total_debito: val.debito,
        total_credito: val.credito,
        saldo_nuevo: saldo
      });
    });

    return resultado.sort((a, b) => a.cuenta_codigo.localeCompare(b.cuenta_codigo));
  }
}
