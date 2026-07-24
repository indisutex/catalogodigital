import { supabase } from './supabase';

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────
export interface ERPCuentaBancaria {
  id: string;
  tenant_id: string;
  nombre: string;
  tipo: string;
  banco?: string;
  numero_cuenta?: string;
  titular?: string;
  saldo_inicial: number;
  saldo_actual: number;
  activa: boolean;
  color: string;
  cuenta_puc: string;
  created_at: string;
}

export interface ERPMovimientoTesoreria {
  id?: string;
  tenant_id: string;
  cuenta_id: string;
  tipo: 'Ingreso' | 'Egreso';
  categoria: string;
  concepto: string;
  referencia?: string;
  tercero_id?: string;
  monto: number;
  fecha: string;
  comprobante_url?: string;
  notas?: string;
  registrado_por?: string;
  created_at?: string;
}

export interface ERPCuentaPorCobrar {
  id?: string;
  tenant_id: string;
  tercero_id?: string;
  cliente_nombre: string;
  concepto: string;
  referencia_pedido?: string;
  fecha_emision: string;
  fecha_vencimiento?: string;
  monto_total: number;
  monto_pagado: number;
  saldo_pendiente?: number;
  estado: string;
  notas?: string;
  created_at?: string;
}

export interface ERPCuentaPorPagar {
  id?: string;
  tenant_id: string;
  tercero_id?: string;
  proveedor_nombre: string;
  concepto: string;
  numero_factura?: string;
  fecha_emision: string;
  fecha_vencimiento?: string;
  monto_total: number;
  monto_pagado: number;
  saldo_pendiente?: number;
  estado: string;
  categoria: string;
  notas?: string;
  created_at?: string;
}

export interface ERPAbono {
  tenant_id: string;
  tipo_documento: 'CxC' | 'CxP';
  documento_id: string;
  fecha: string;
  monto: number;
  metodo_pago: string;
  notas?: string;
  registrado_por?: string;
}

export interface ERPResumenTesoreria {
  totalCajas: number;
  totalBancos: number;
  totalBilleterasDigitales: number;
  totalDisponible: number;
  cuentasPorCobrar: number;
  cuentasPorPagar: number;
  flujoCajaNeto: number;
}

// ─────────────────────────────────────────────
// SERVICIO
// ─────────────────────────────────────────────
export class ERPTesoreriaService {

  // ── CUENTAS BANCARIAS ──
  static async fetchCuentas(tenantId: string): Promise<ERPCuentaBancaria[]> {
    const { data, error } = await supabase
      .from('erp_cuentas_bancarias')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('activa', true)
      .order('tipo');
    if (error) throw new Error(error.message);
    return (data as ERPCuentaBancaria[]) || [];
  }

  static async crearCuenta(cuenta: Omit<ERPCuentaBancaria, 'id' | 'created_at'>): Promise<ERPCuentaBancaria> {
    const { data, error } = await supabase
      .from('erp_cuentas_bancarias')
      .insert([{ ...cuenta, saldo_actual: cuenta.saldo_inicial }])
      .select().single();
    if (error) throw new Error(error.message);
    return data as ERPCuentaBancaria;
  }

  static async actualizarSaldoCuenta(cuentaId: string, nuevoSaldo: number): Promise<void> {
    const { error } = await supabase
      .from('erp_cuentas_bancarias')
      .update({ saldo_actual: nuevoSaldo })
      .eq('id', cuentaId);
    if (error) throw new Error(error.message);
  }

  // ── MOVIMIENTOS TESORERÍA ──
  static async fetchMovimientos(tenantId: string, desde?: string, hasta?: string): Promise<ERPMovimientoTesoreria[]> {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('erp_movimientos_tesoreria')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('fecha', desde ?? inicioMes)
      .lte('fecha', hasta ?? finMes)
      .order('fecha', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as ERPMovimientoTesoreria[]) || [];
  }

  static async registrarMovimiento(mov: Omit<ERPMovimientoTesoreria, 'id' | 'created_at'>): Promise<ERPMovimientoTesoreria> {
    const { data, error } = await supabase
      .from('erp_movimientos_tesoreria')
      .insert([mov])
      .select().single();
    if (error) throw new Error(error.message);
    return data as ERPMovimientoTesoreria;
  }

  // ── RESUMEN TESORERÍA ──
  static async fetchResumen(tenantId: string): Promise<ERPResumenTesoreria> {
    const cuentas = await ERPTesoreriaService.fetchCuentas(tenantId);

    const totalCajas = cuentas
      .filter(c => c.tipo === 'Caja')
      .reduce((s, c) => s + Number(c.saldo_actual), 0);
    const totalBancos = cuentas
      .filter(c => ['Cuenta Corriente', 'Cuenta Ahorros'].includes(c.tipo))
      .reduce((s, c) => s + Number(c.saldo_actual), 0);
    const totalBilleterasDigitales = cuentas
      .filter(c => c.tipo === 'Billetera Digital')
      .reduce((s, c) => s + Number(c.saldo_actual), 0);

    const { data: cxc } = await supabase
      .from('erp_cuentas_por_cobrar')
      .select('saldo_pendiente')
      .eq('tenant_id', tenantId)
      .in('estado', ['Pendiente', 'Parcial']);

    const { data: cxp } = await supabase
      .from('erp_cuentas_por_pagar')
      .select('saldo_pendiente')
      .eq('tenant_id', tenantId)
      .in('estado', ['Pendiente', 'Parcial']);

    const totalCxC = (cxc || []).reduce((s, r) => s + Number(r.saldo_pendiente), 0);
    const totalCxP = (cxp || []).reduce((s, r) => s + Number(r.saldo_pendiente), 0);

    return {
      totalCajas,
      totalBancos,
      totalBilleterasDigitales,
      totalDisponible: totalCajas + totalBancos + totalBilleterasDigitales,
      cuentasPorCobrar: totalCxC,
      cuentasPorPagar: totalCxP,
      flujoCajaNeto: (totalCajas + totalBancos + totalBilleterasDigitales + totalCxC) - totalCxP
    };
  }

  // ── CxC - CUENTAS POR COBRAR ──
  static async fetchCxC(tenantId: string, soloActivas = false): Promise<ERPCuentaPorCobrar[]> {
    let query = supabase
      .from('erp_cuentas_por_cobrar')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('fecha_emision', { ascending: false });

    if (soloActivas) {
      query = query.in('estado', ['Pendiente', 'Parcial', 'Vencido']);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data as ERPCuentaPorCobrar[]) || [];
  }

  static async crearCxC(cxc: Omit<ERPCuentaPorCobrar, 'id' | 'saldo_pendiente' | 'created_at'>): Promise<ERPCuentaPorCobrar> {
    const { data, error } = await supabase
      .from('erp_cuentas_por_cobrar')
      .insert([{ ...cxc, monto_pagado: cxc.monto_pagado ?? 0 }])
      .select().single();
    if (error) throw new Error(error.message);
    return data as ERPCuentaPorCobrar;
  }

  // ── CxP - CUENTAS POR PAGAR ──
  static async fetchCxP(tenantId: string, soloActivas = false): Promise<ERPCuentaPorPagar[]> {
    let query = supabase
      .from('erp_cuentas_por_pagar')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('fecha_emision', { ascending: false });

    if (soloActivas) {
      query = query.in('estado', ['Pendiente', 'Parcial', 'Vencido']);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data as ERPCuentaPorPagar[]) || [];
  }

  static async crearCxP(cxp: Omit<ERPCuentaPorPagar, 'id' | 'saldo_pendiente' | 'created_at'>): Promise<ERPCuentaPorPagar> {
    const { data, error } = await supabase
      .from('erp_cuentas_por_pagar')
      .insert([{ ...cxp, monto_pagado: cxp.monto_pagado ?? 0 }])
      .select().single();
    if (error) throw new Error(error.message);
    return data as ERPCuentaPorPagar;
  }

  // ── ABONOS ──
  static async registrarAbono(abono: ERPAbono): Promise<void> {
    const { error } = await supabase
      .from('erp_abonos')
      .insert([abono]);
    if (error) throw new Error(error.message);
  }

  static async fetchAbonos(documentoId: string): Promise<ERPAbono[]> {
    const { data, error } = await supabase
      .from('erp_abonos')
      .select('*')
      .eq('documento_id', documentoId)
      .order('fecha', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as ERPAbono[]) || [];
  }
}
