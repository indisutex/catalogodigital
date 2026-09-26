import { supabase } from './supabase';
import type { RegistroAsistencia } from '../types';
import * as XLSX from 'xlsx';

const STORAGE_BUCKET = 'archivos';
const STORAGE_PREFIX = 'asistencia_records_';

export interface AsistenciaFilters {
  fecha?: string; // YYYY-MM-DD
  fechaDesde?: string; // YYYY-MM-DD
  fechaHasta?: string; // YYYY-MM-DD
  asesorId?: string;
  estado?: 'todos' | 'activo' | 'finalizado' | 'sin_salida';
  busqueda?: string;
}

// Auxiliar para almacenamiento en nube (Supabase Storage fallback)
const getCloudStoragePath = (tenantId: string) => `${STORAGE_PREFIX}${tenantId}.json`;
const getLocalStorageKey = (tenantId: string) => `asistencia_local_${tenantId}`;

/**
 * Obtiene los registros almacenados en el fallback de nube (Storage) y local
 */
async function getFallbackRecords(tenantId: string): Promise<RegistroAsistencia[]> {
  let records: RegistroAsistencia[] = [];
  
  // 1. Intentar descargar de Supabase Storage
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(getCloudStoragePath(tenantId));

    if (!error && data) {
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        records = parsed;
        // Sincronizar con localStorage
        localStorage.setItem(getLocalStorageKey(tenantId), text);
        return records;
      }
    }
  } catch (err) {
    console.warn('No se pudo leer de Supabase Storage, usando cache local:', err);
  }

  // 2. Si falla Storage, intentar leer de localStorage
  try {
    const cached = localStorage.getItem(getLocalStorageKey(tenantId));
    if (cached) {
      records = JSON.parse(cached);
    }
  } catch {}

  return records;
}

/**
 * Guarda los registros en el fallback de nube (Storage) y local
 */
async function saveFallbackRecords(tenantId: string, records: RegistroAsistencia[]): Promise<void> {
  const jsonStr = JSON.stringify(records);
  
  // 1. Guardar en localStorage inmediatamente
  try {
    localStorage.setItem(getLocalStorageKey(tenantId), jsonStr);
  } catch {}

  // 2. Guardar en Supabase Storage para persistencia compartida multi-dispositivo
  try {
    await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(getCloudStoragePath(tenantId), jsonStr, {
        contentType: 'application/json',
        upsert: true
      });
  } catch (err) {
    console.warn('Error al guardar en Supabase Storage:', err);
  }
}

/**
 * Servicio centralizado de Control de Asistencia
 */
export const asistenciaService = {
  /**
   * Obtiene todos los registros de asistencia para una tienda/tenant con filtros aplicados
   */
  async obtenerRegistros(tenantId: string, filters?: AsistenciaFilters): Promise<RegistroAsistencia[]> {
    let registros: RegistroAsistencia[] = [];
    let tableExists = true;

    // 1. Intentar consultar la tabla nativa de Supabase 'control_asistencia'
    try {
      let query = supabase
        .from('control_asistencia')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('hora_entrada', { ascending: false });

      if (filters?.fecha) {
        query = query.eq('fecha', filters.fecha);
      }
      if (filters?.fechaDesde) {
        query = query.gte('fecha', filters.fechaDesde);
      }
      if (filters?.fechaHasta) {
        query = query.lte('fecha', filters.fechaHasta);
      }
      if (filters?.asesorId && filters.asesorId !== 'todos') {
        query = query.eq('asesor_id', filters.asesorId);
      }
      if (filters?.estado && filters.estado !== 'todos') {
        query = query.eq('estado', filters.estado);
      }

      const { data, error } = await query;

      if (!error && data) {
        registros = data as RegistroAsistencia[];
      } else if (error && (error.message?.includes('does not exist') || error.code === '42P01' || error.message?.includes('schema cache'))) {
        tableExists = false;
      }
    } catch {
      tableExists = false;
    }

    // 2. Si la tabla no existe aún en PostgreSQL, usar fallback sincronizado en la nube
    if (!tableExists) {
      const allFallback = await getFallbackRecords(tenantId);
      registros = allFallback.filter(r => {
        if (r.tenant_id !== tenantId) return false;
        if (filters?.fecha && r.fecha !== filters.fecha) return false;
        if (filters?.fechaDesde && r.fecha < filters.fechaDesde) return false;
        if (filters?.fechaHasta && r.fecha > filters.fechaHasta) return false;
        if (filters?.asesorId && filters.asesorId !== 'todos' && r.asesor_id !== filters.asesorId) return false;
        if (filters?.estado && filters.estado !== 'todos' && r.estado !== filters.estado) return false;
        return true;
      });

      // Ordenar por hora_entrada descendente
      registros.sort((a, b) => new Date(b.hora_entrada).getTime() - new Date(a.hora_entrada).getTime());
    }

    // Filtro adicional por texto de búsqueda (nombre o teléfono)
    if (filters?.busqueda && filters.busqueda.trim() !== '') {
      const q = filters.busqueda.toLowerCase().trim();
      registros = registros.filter(r => 
        (r.asesor_nombre && r.asesor_nombre.toLowerCase().includes(q)) ||
        (r.asesor_telefono && r.asesor_telefono.includes(q)) ||
        (r.fecha && r.fecha.includes(q))
      );
    }

    return registros;
  },

  /**
   * Obtiene la jornada activa actual de un asesor (si existe)
   */
  async obtenerJornadaActivaAsesor(tenantId: string, asesorId: string): Promise<RegistroAsistencia | null> {
    try {
      // Intentar en la tabla nativa primero
      const { data, error } = await supabase
        .from('control_asistencia')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('asesor_id', asesorId)
        .eq('estado', 'activo')
        .is('hora_salida', null)
        .order('hora_entrada', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return data as RegistroAsistencia;
      }
    } catch {}

    // Fallback en Storage/Local
    const fallbacks = await getFallbackRecords(tenantId);
    const activa = fallbacks.find(r => 
      r.tenant_id === tenantId && 
      r.asesor_id === asesorId && 
      r.estado === 'activo' && 
      !r.hora_salida
    );

    return activa || null;
  },

  /**
   * Registra la ENTRADA de un asesor al iniciar su jornada
   */
  async marcarEntrada(params: {
    tenantId: string;
    asesorId: string;
    asesorNombre: string;
    asesorTelefono: string;
    observaciones?: string;
  }): Promise<RegistroAsistencia> {
    const { tenantId, asesorId, asesorNombre, asesorTelefono, observaciones } = params;

    // 1. Verificar si ya tiene una jornada activa para evitar duplicados
    const existente = await this.obtenerJornadaActivaAsesor(tenantId, asesorId);
    if (existente) {
      return existente;
    }

    const now = new Date();
    const fechaStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const horaEntradaIso = now.toISOString();
    const dispositivo = typeof navigator !== 'undefined' ? (navigator.userAgent.includes('Mobile') ? 'Móvil' : 'Computador') : 'Web';

    const nuevoRegistro: RegistroAsistencia = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `asist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      asesor_id: asesorId,
      asesor_nombre: asesorNombre,
      asesor_telefono: asesorTelefono,
      fecha: fechaStr,
      hora_entrada: horaEntradaIso,
      hora_salida: null,
      duracion_minutos: null,
      estado: 'activo',
      dispositivo,
      observaciones: observaciones || null,
      created_at: horaEntradaIso,
      updated_at: horaEntradaIso
    };

    // Intentar insertar en tabla nativa
    let insertedInDb = false;
    try {
      const { data, error } = await supabase
        .from('control_asistencia')
        .insert({
          id: nuevoRegistro.id,
          tenant_id: nuevoRegistro.tenant_id,
          asesor_id: nuevoRegistro.asesor_id,
          asesor_nombre: nuevoRegistro.asesor_nombre,
          asesor_telefono: nuevoRegistro.asesor_telefono,
          fecha: nuevoRegistro.fecha,
          hora_entrada: nuevoRegistro.hora_entrada,
          estado: 'activo',
          dispositivo: nuevoRegistro.dispositivo,
          observaciones: nuevoRegistro.observaciones
        })
        .select()
        .single();

      if (!error && data) {
        insertedInDb = true;
        // Guardar copia de respaldo en Storage/Local
        const fallbacks = await getFallbackRecords(tenantId);
        await saveFallbackRecords(tenantId, [data as RegistroAsistencia, ...fallbacks.filter(f => f.id !== data.id)]);
        return data as RegistroAsistencia;
      }
    } catch {}

    // Si falló la tabla nativa, guardar en Storage y localStorage
    if (!insertedInDb) {
      const fallbacks = await getFallbackRecords(tenantId);
      const updated = [nuevoRegistro, ...fallbacks.filter(f => f.id !== nuevoRegistro.id)];
      await saveFallbackRecords(tenantId, updated);
    }

    return nuevoRegistro;
  },

  /**
   * Registra la SALIDA de un asesor finalizando su jornada
   */
  async marcarSalida(registroId: string, tenantId: string, observaciones?: string): Promise<RegistroAsistencia> {
    const now = new Date();
    const horaSalidaIso = now.toISOString();

    // 1. Intentar actualizar en la tabla nativa
    try {
      // Consultar hora de entrada para calcular duración
      const { data: current } = await supabase
        .from('control_asistencia')
        .select('*')
        .eq('id', registroId)
        .maybeSingle();

      if (current) {
        const entradaMs = new Date(current.hora_entrada).getTime();
        const salidaMs = now.getTime();
        const duracionMin = Math.max(0, Math.round((salidaMs - entradaMs) / (1000 * 60)));

        const payload: Partial<RegistroAsistencia> = {
          hora_salida: horaSalidaIso,
          duracion_minutos: duracionMin,
          estado: 'finalizado',
          updated_at: horaSalidaIso
        };
        if (observaciones) payload.observaciones = observaciones;

        const { data: updated, error } = await supabase
          .from('control_asistencia')
          .update(payload)
          .eq('id', registroId)
          .select()
          .single();

        if (!error && updated) {
          // Actualizar también en storage/local
          const fallbacks = await getFallbackRecords(tenantId);
          const newFallbacks = fallbacks.map(f => f.id === registroId ? (updated as RegistroAsistencia) : f);
          await saveFallbackRecords(tenantId, newFallbacks);
          return updated as RegistroAsistencia;
        }
      }
    } catch {}

    // 2. Fallback Storage / Local
    const fallbacks = await getFallbackRecords(tenantId);
    let registroActualizado: RegistroAsistencia | null = null;

    const newFallbacks = fallbacks.map(item => {
      if (item.id === registroId) {
        const entradaMs = new Date(item.hora_entrada).getTime();
        const salidaMs = now.getTime();
        const duracionMin = Math.max(0, Math.round((salidaMs - entradaMs) / (1000 * 60)));

        registroActualizado = {
          ...item,
          hora_salida: horaSalidaIso,
          duracion_minutos: duracionMin,
          estado: 'finalizado',
          observaciones: observaciones || item.observaciones || null,
          updated_at: horaSalidaIso
        };
        return registroActualizado;
      }
      return item;
    });

    if (registroActualizado) {
      await saveFallbackRecords(tenantId, newFallbacks);
      return registroActualizado;
    }

    throw new Error('No se encontró el registro de jornada para finalizar');
  },

  /**
   * Cierre manual o modificación de jornada por el Administrador
   */
  async cerrarJornadaAdmin(
    registroId: string, 
    tenantId: string, 
    horaSalidaManual?: string, 
    observaciones?: string
  ): Promise<RegistroAsistencia> {
    const salidaDate = horaSalidaManual ? new Date(horaSalidaManual) : new Date();
    const horaSalidaIso = salidaDate.toISOString();

    // 1. Intentar actualizar en base de datos nativa
    try {
      const { data: current } = await supabase
        .from('control_asistencia')
        .select('*')
        .eq('id', registroId)
        .maybeSingle();

      if (current) {
        const entradaMs = new Date(current.hora_entrada).getTime();
        const duracionMin = Math.max(0, Math.round((salidaDate.getTime() - entradaMs) / (1000 * 60)));

        const { data: updated, error } = await supabase
          .from('control_asistencia')
          .update({
            hora_salida: horaSalidaIso,
            duracion_minutos: duracionMin,
            estado: 'finalizado',
            observaciones: observaciones || current.observaciones || 'Cierre manual por Administrador',
            updated_at: new Date().toISOString()
          })
          .eq('id', registroId)
          .select()
          .single();

        if (!error && updated) {
          const fallbacks = await getFallbackRecords(tenantId);
          await saveFallbackRecords(tenantId, fallbacks.map(f => f.id === registroId ? (updated as RegistroAsistencia) : f));
          return updated as RegistroAsistencia;
        }
      }
    } catch {}

    // 2. Fallback
    const fallbacks = await getFallbackRecords(tenantId);
    let registroActualizado: RegistroAsistencia | null = null;

    const newFallbacks = fallbacks.map(item => {
      if (item.id === registroId) {
        const entradaMs = new Date(item.hora_entrada).getTime();
        const duracionMin = Math.max(0, Math.round((salidaDate.getTime() - entradaMs) / (1000 * 60)));

        registroActualizado = {
          ...item,
          hora_salida: horaSalidaIso,
          duracion_minutos: duracionMin,
          estado: 'finalizado',
          observaciones: observaciones || item.observaciones || 'Cierre manual por Administrador',
          updated_at: new Date().toISOString()
        };
        return registroActualizado;
      }
      return item;
    });

    if (registroActualizado) {
      await saveFallbackRecords(tenantId, newFallbacks);
      return registroActualizado;
    }

    throw new Error('No se encontró el registro para cierre administrativo');
  },

  /**
   * Elimina un registro de asistencia permanentemente (Función exclusiva de Administrador)
   */
  async eliminarRegistro(registroId: string, tenantId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('control_asistencia')
        .delete()
        .eq('id', registroId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.warn('Error al eliminar de tabla control_asistencia:', error);
      }
    } catch (e) {
      console.warn('Error de conexión al eliminar registro:', e);
    }

    try {
      const fallbacks = await getFallbackRecords(tenantId);
      const updated = fallbacks.filter(f => f.id !== registroId);
      await saveFallbackRecords(tenantId, updated);
    } catch (e) {
      console.warn('Error al eliminar de cache/fallback:', e);
    }

    return true;
  },

  /**
   * Actualiza los datos de un registro de asistencia (hora_entrada, hora_salida, observaciones, estado)
   */
  async actualizarRegistro(
    registroId: string,
    tenantId: string,
    cambios: {
      hora_entrada?: string;
      hora_salida?: string | null;
      observaciones?: string;
      estado?: 'activo' | 'finalizado' | 'sin_salida';
    }
  ): Promise<RegistroAsistencia> {
    let duracionMin: number | null = null;
    if (cambios.hora_entrada && cambios.hora_salida) {
      const eMs = new Date(cambios.hora_entrada).getTime();
      const sMs = new Date(cambios.hora_salida).getTime();
      duracionMin = Math.max(0, Math.round((sMs - eMs) / (1000 * 60)));
    } else if (cambios.estado === 'activo' || !cambios.hora_salida) {
      duracionMin = null;
    }

    const payload: any = {
      ...cambios,
      updated_at: new Date().toISOString()
    };
    if (duracionMin !== null) {
      payload.duracion_minutos = duracionMin;
    } else if (cambios.estado === 'activo') {
      payload.duracion_minutos = null;
      payload.hora_salida = null;
    }

    try {
      const { data, error } = await supabase
        .from('control_asistencia')
        .update(payload)
        .eq('id', registroId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (!error && data) {
        const fallbacks = await getFallbackRecords(tenantId);
        await saveFallbackRecords(tenantId, fallbacks.map(f => f.id === registroId ? (data as RegistroAsistencia) : f));
        return data as RegistroAsistencia;
      }
    } catch {}

    const fallbacks = await getFallbackRecords(tenantId);
    let updatedObj: RegistroAsistencia | null = null;
    const newFallbacks: RegistroAsistencia[] = fallbacks.map(item => {
      if (item.id === registroId) {
        const up: RegistroAsistencia = { ...item, ...payload };
        updatedObj = up;
        return up;
      }
      return item;
    });

    if (updatedObj) {
      await saveFallbackRecords(tenantId, newFallbacks);
      return updatedObj;
    }

    throw new Error('No se encontró el registro para actualizar');
  },

  /**
   * Formateo de fecha y hora
   */
  formatearHora12(isoString?: string | null): string {
    if (!isoString) return '--:--';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '--:--';
    }
  },

  formatearFechaLarga(isoString?: string | null): string {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('es-CO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return '';
    }
  },

  formatearDuracion(minutos?: number | null): string {
    if (minutos === null || minutos === undefined || isNaN(minutos)) return '--';
    const hrs = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (hrs === 0) return `${mins}m`;
    return `${hrs}h ${mins > 0 ? `${mins}m` : ''}`.trim();
  },

  calcularTiempoTranscurrido(horaInicioIso: string): string {
    try {
      const diffMs = Math.max(0, Date.now() - new Date(horaInicioIso).getTime());
      const totalMins = Math.floor(diffMs / 60000);
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      if (hrs === 0) return `${mins}m transcurridos`;
      return `${hrs}h ${mins}m transcurridos`;
    } catch {
      return 'En curso';
    }
  },

  /**
   * Exportación de informe a Excel
   */
  exportarReporteExcel(registros: RegistroAsistencia[], tenantName: string, _rangoTexto?: string): void {
    const dataFilas = registros.map(r => {
      const entradaStr = r.hora_entrada ? new Date(r.hora_entrada).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
      const salidaStr = r.hora_salida ? new Date(r.hora_salida).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : (r.estado === 'activo' ? 'En jornada activa' : 'Sin salida');
      const duracionStr = r.duracion_minutos ? this.formatearDuracion(r.duracion_minutos) : (r.estado === 'activo' ? this.calcularTiempoTranscurrido(r.hora_entrada) : '--');

      return {
        'Asesor': r.asesor_nombre,
        'Teléfono': r.asesor_telefono,
        'Fecha': r.fecha,
        'Hora Entrada': entradaStr,
        'Hora Salida': salidaStr,
        'Duración': duracionStr,
        'Minutos Totales': r.duracion_minutos || 0,
        'Estado': r.estado === 'activo' ? 'Activo (En curso)' : r.estado === 'finalizado' ? 'Finalizado' : 'Sin salida',
        'Dispositivo': r.dispositivo || 'Web',
        'Observaciones': r.observaciones || ''
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dataFilas);

    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 25 }, // Asesor
      { wch: 18 }, // Telefono
      { wch: 14 }, // Fecha
      { wch: 15 }, // Hora Entrada
      { wch: 18 }, // Hora Salida
      { wch: 15 }, // Duracion
      { wch: 16 }, // Minutos Totales
      { wch: 20 }, // Estado
      { wch: 14 }, // Dispositivo
      { wch: 30 }  // Observaciones
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Control Asistencia');

    const cleanTenant = (tenantName || 'indisutex').toLowerCase().replace(/\s+/g, '_');
    const fechaHoy = new Date().toISOString().split('T')[0];
    const fileName = `Reporte_Asistencia_${cleanTenant}_${fechaHoy}.xlsx`;

    XLSX.writeFile(wb, fileName);
  }
};
