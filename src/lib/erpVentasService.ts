import { supabase } from './supabase';
import type { Pedido } from '../types';

// ─────────────────────────────────────────────
// TIPOS INTERNOS DEL MÓDULO DE VENTAS ERP
// ─────────────────────────────────────────────
export interface ERPVentaDiaria {
  fecha: string;
  total_ventas: number;
  cantidad_pedidos: number;
  ticket_promedio: number;
}

export interface ERPEgreso {
  id?: string;
  tenant_id: string;
  fecha: string;
  categoria: string;
  concepto: string;
  proveedor_nombre?: string;
  monto: number;
  metodo_pago: string;
  comprobante_url?: string;
  notas?: string;
  registrado_por?: string;
  created_at?: string;
}

export interface ERPResumenFinanciero {
  totalVentasMes: number;
  totalVentasHoy: number;
  totalEgresosMes: number;
  totalEgresosHoy: number;
  utilidadMes: number;
  utilidadHoy: number;
  pedidosHoy: number;
  pedidosMes: number;
  ticketPromedio: number;
  ventasPorDia: ERPVentaDiaria[];
}

// ─────────────────────────────────────────────
// SERVICIO PRINCIPAL
// ─────────────────────────────────────────────
export class ERPVentasService {

  /**
   * Lee ventas REALES directamente de la tabla pedidos
   * Filtradas por tenant y rango de fechas
   */
  static async fetchVentasReales(
    tenantId: string,
    desde?: string,
    hasta?: string
  ): Promise<Pedido[]> {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

    let query = supabase
      .from('pedidos')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('estado', ['aprobado', 'pagado', 'enviado', 'entregado'])
      .gte('created_at', (desde ?? inicioMes) + 'T00:00:00')
      .lte('created_at', (hasta ?? finMes) + 'T23:59:59')
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data as Pedido[]) || [];
  }

  /**
   * Calcula el resumen financiero completo del mes actual
   */
  static async fetchResumenFinanciero(tenantId: string): Promise<ERPResumenFinanciero> {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

    // 1. Ventas del mes desde pedidos
    const { data: ventasMes } = await supabase
      .from('pedidos')
      .select('total, created_at')
      .eq('tenant_id', tenantId)
      .in('estado', ['aprobado', 'pagado', 'enviado', 'entregado'])
      .gte('created_at', inicioMes + 'T00:00:00')
      .lte('created_at', finMes + 'T23:59:59');

    // 2. Ventas de hoy
    const { data: ventasHoy } = await supabase
      .from('pedidos')
      .select('total, created_at')
      .eq('tenant_id', tenantId)
      .in('estado', ['aprobado', 'pagado', 'enviado', 'entregado'])
      .gte('created_at', hoyStr + 'T00:00:00')
      .lte('created_at', hoyStr + 'T23:59:59');

    // 3. Egresos del mes
    const { data: egresosMes } = await supabase
      .from('erp_egresos')
      .select('monto')
      .eq('tenant_id', tenantId)
      .gte('fecha', inicioMes)
      .lte('fecha', finMes);

    // 4. Egresos de hoy
    const { data: egresosHoy } = await supabase
      .from('erp_egresos')
      .select('monto')
      .eq('tenant_id', tenantId)
      .eq('fecha', hoyStr);

    const totalVentasMes = (ventasMes || []).reduce((s, v) => s + Number(v.total), 0);
    const totalVentasHoy = (ventasHoy || []).reduce((s, v) => s + Number(v.total), 0);
    const totalEgresosMes = (egresosMes || []).reduce((s, e) => s + Number(e.monto), 0);
    const totalEgresosHoy = (egresosHoy || []).reduce((s, e) => s + Number(e.monto), 0);
    const pedidosMes = (ventasMes || []).length;
    const pedidosHoy = (ventasHoy || []).length;

    // Agrupar ventas por día para gráfico
    const ventasPorDia: ERPVentaDiaria[] = [];
    const mapaFechas: Record<string, { total: number; count: number }> = {};
    (ventasMes || []).forEach(v => {
      const fecha = v.created_at.split('T')[0];
      if (!mapaFechas[fecha]) mapaFechas[fecha] = { total: 0, count: 0 };
      mapaFechas[fecha].total += Number(v.total);
      mapaFechas[fecha].count++;
    });
    Object.entries(mapaFechas).sort().forEach(([fecha, val]) => {
      ventasPorDia.push({
        fecha,
        total_ventas: val.total,
        cantidad_pedidos: val.count,
        ticket_promedio: val.count > 0 ? val.total / val.count : 0
      });
    });

    return {
      totalVentasMes,
      totalVentasHoy,
      totalEgresosMes,
      totalEgresosHoy,
      utilidadMes: totalVentasMes - totalEgresosMes,
      utilidadHoy: totalVentasHoy - totalEgresosHoy,
      pedidosHoy,
      pedidosMes,
      ticketPromedio: pedidosMes > 0 ? totalVentasMes / pedidosMes : 0,
      ventasPorDia
    };
  }

  /**
   * Registrar un egreso / gasto operativo
   */
  static async registrarEgreso(egreso: Omit<ERPEgreso, 'id' | 'created_at'>): Promise<ERPEgreso> {
    const { data, error } = await supabase
      .from('erp_egresos')
      .insert([egreso])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as ERPEgreso;
  }

  /**
   * Obtener egresos del mes
   */
  static async fetchEgresos(tenantId: string, desde?: string, hasta?: string): Promise<ERPEgreso[]> {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('erp_egresos')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('fecha', desde ?? inicioMes)
      .lte('fecha', hasta ?? finMes)
      .order('fecha', { ascending: false });

    if (error) throw new Error(error.message);
    return (data as ERPEgreso[]) || [];
  }

  /**
   * Top 5 productos más vendidos del mes
   */
  static async fetchTopProductos(tenantId: string): Promise<{ nombre: string; cantidad: number; total: number }[]> {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];

    const { data } = await supabase
      .from('pedidos')
      .select('productos, total')
      .eq('tenant_id', tenantId)
      .in('estado', ['aprobado', 'pagado', 'enviado', 'entregado'])
      .gte('created_at', inicioMes + 'T00:00:00');

    const mapaProductos: Record<string, { cantidad: number; total: number }> = {};
    (data || []).forEach(pedido => {
      try {
        const items = Array.isArray(pedido.productos) ? pedido.productos : JSON.parse(pedido.productos || '[]');
        items.forEach((item: any) => {
          const nombre = item.nombre || item.name || 'Producto sin nombre';
          const cantidad = item.cantidad || item.quantity || 1;
          const precio = item.precio || item.price || 0;
          if (!mapaProductos[nombre]) mapaProductos[nombre] = { cantidad: 0, total: 0 };
          mapaProductos[nombre].cantidad += Number(cantidad);
          mapaProductos[nombre].total += Number(precio) * Number(cantidad);
        });
      } catch (_) {}
    });

    return Object.entries(mapaProductos)
      .map(([nombre, val]) => ({ nombre, ...val }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }
}
