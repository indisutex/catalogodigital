// Conversión de un pedido guardado (fila de la tabla pedidos) a la ficha que usan vendedoras y bodega
import type { PedidoVista } from './fichaPedido';
import { etiqueta } from './fichaPedido';

// Foto del estampado elegido (las imágenes extra del producto vienen como "url|EST:nombre")
export function imagenDeEstampado(p: { imagenes_extra?: unknown }, est: string): string | null {
  if (!est) return null;
  const lista = Array.isArray(p.imagenes_extra) ? p.imagenes_extra : [];
  for (const e of lista) {
    const [url, marca] = String(e).split('|EST:');
    if (marca && marca.trim().toLowerCase() === est.toLowerCase()) return url;
  }
  return null;
}

// Cuentas para pagar por transferencia, una por línea
export function lineasPagoDe(metodos: unknown): string[] {
  const crudo = String(metodos || '').split('__EXTRA_CONFIG__')[0].trim();
  if (!crudo) return [];
  try {
    const arr = JSON.parse(crudo);
    if (Array.isArray(arr)) {
      return arr
        .filter((m: any) => (m.banco && String(m.banco).trim()) || (m.numero && String(m.numero).trim()))
        .map((m: any) => `${String(m.banco || '').trim()}${m.tipo ? ` (${m.tipo})` : ''}: ${String(m.numero || '').trim()}`);
    }
  } catch { return [crudo]; }
  return [];
}

export interface ContextoPedido {
  tienda: string;
  color: string;
  logo?: string | null;
  asesor: string;
  pagoInfo: string[];
}

export function vistaDePedido(r: any, ctx: ContextoPedido): PedidoVista {
  const partes = String(r.direccion || '').split(' | ');
  const nota = partes.find(x => x.startsWith('Nota: '))?.slice(6);
  const items = (Array.isArray(r.productos) ? r.productos : []).map((p: any) => ({
    nombre: String(p.nombre || '').trim(),
    imagen: imagenDeEstampado(p, String(p.estampado || '')) || p.imagen_url || null,
    etiqueta: (p.talla ? etiqueta(String(p.familia_opcion_key || p.talla)) : '') + (p.detalle ? ` (${p.detalle})` : ''),
    estampado: String(p.estampado || ''),
    cantidad: Number(p.cantidad) || 0,
    precio: Number(p.precio) || 0
  }));
  return {
    id: r.id,
    numero: r.numero_pedido ? Number(r.numero_pedido) : null,
    creado: r.created_at,
    tienda: ctx.tienda,
    color: ctx.color,
    logo: ctx.logo || null,
    asesor: ctx.asesor,
    cliente: r.cliente_nombre,
    telefono: r.cliente_telefono,
    ciudad: r.ciudad || '',
    direccion: partes[0] || '',
    pago: r.modalidad_pago === 'contra_entrega' ? 'Contra entrega' : 'Transferencia',
    entrega: r.metodo_recepcion === 'tienda' ? 'Recoge en tienda' : 'Domicilio',
    tipo: r.tipo_compra || 'Al detal',
    total: Number(r.total) || 0,
    nota,
    estado: r.estado,
    pagoInfo: ctx.pagoInfo,
    items
  };
}
