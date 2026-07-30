import { supabase, getTenantId } from './supabase';
import type { GanadorJuego } from '../types';

export const registrarGanadorJuego = async (ganadorData: {
  nombre_cliente: string;
  telefono_cliente: string;
  ciudad?: string;
  direccion?: string;
  juego: string;
  premio: string;
  tipo_premio: 'producto_gratis' | 'cupon_descuento' | 'envio_gratis';
  tenantId?: string;
}): Promise<GanadorJuego> => {
  const tenant = ganadorData.tenantId || getTenantId();
  const nuevoGanador: GanadorJuego = {
    id: 'ganador_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    tenant_id: tenant,
    created_at: new Date().toISOString(),
    nombre_cliente: ganadorData.nombre_cliente,
    telefono_cliente: ganadorData.telefono_cliente,
    ciudad: ganadorData.ciudad || '',
    direccion: ganadorData.direccion || '',
    juego: ganadorData.juego,
    premio: ganadorData.premio,
    tipo_premio: ganadorData.tipo_premio,
    estado: 'pendiente'
  };

  // 1. Guardar en LocalStorage
  try {
    const key = `ganadores_juegos_${tenant}`;
    const cached = JSON.parse(localStorage.getItem(key) || '[]');
    cached.unshift(nuevoGanador);
    localStorage.setItem(key, JSON.stringify(cached));
  } catch (e) {
    console.error('Error guardando en LocalStorage:', e);
  }

  // 2. Guardar en Supabase (si existe la tabla)
  try {
    await supabase.from('ganadores_juegos').insert([nuevoGanador]);
  } catch (e) {
    console.warn('Tabla ganadores_juegos no disponible o error en Supabase:', e);
  }

  return nuevoGanador;
};

export const obtenerGanadoresJuegos = async (tenantId?: string): Promise<GanadorJuego[]> => {
  const tenant = tenantId || getTenantId();
  const key = `ganadores_juegos_${tenant}`;
  
  let localData: GanadorJuego[] = [];
  try {
    localData = JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {}

  try {
    const { data, error } = await supabase
      .from('ganadores_juegos')
      .select('*')
      .eq('tenant_id', tenant)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      // Fusionar local y remotos evitando duplicados por ID
      const map = new Map<string, GanadorJuego>();
      data.forEach((item: GanadorJuego) => map.set(item.id, item));
      localData.forEach((item: GanadorJuego) => {
        if (!map.has(item.id)) map.set(item.id, item);
      });
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      localStorage.setItem(key, JSON.stringify(merged));
      return merged;
    }
  } catch (e) {}

  return localData;
};

export const actualizarEstadoGanador = async (id: string, nuevoEstado: 'pendiente' | 'entregado', tenantId?: string) => {
  const tenant = tenantId || getTenantId();
  const key = `ganadores_juegos_${tenant}`;

  try {
    const cached: GanadorJuego[] = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = cached.map(g => g.id === id ? { ...g, estado: nuevoEstado } : g);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {}

  try {
    await supabase.from('ganadores_juegos').update({ estado: nuevoEstado }).eq('id', id);
  } catch (e) {}
};

export const eliminarGanadorJuego = async (id: string, tenantId?: string) => {
  const tenant = tenantId || getTenantId();
  const key = `ganadores_juegos_${tenant}`;

  try {
    const cached: GanadorJuego[] = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = cached.filter(g => g.id !== id);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {}

  try {
    await supabase.from('ganadores_juegos').delete().eq('id', id);
  } catch (e) {}
};
