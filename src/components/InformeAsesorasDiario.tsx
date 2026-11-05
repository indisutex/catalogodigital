import React, { useState, useMemo, useEffect } from 'react';
import type { Pedido, Asesor, Configuracion } from '../types';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  MessageSquare, 
  Phone, 
  Download, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Users, 
  DollarSign,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  Truck,
  XCircle,
  Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface InformeAsesorasDiarioProps {
  pedidos: Pedido[];
  leads: any[];
  asesores: Asesor[];
  configuracion?: Configuracion | null;
  tenantId: string;
  currentAsesor?: Asesor | null;
  onAtenderPedido?: (ped: Pedido) => void;
  onUpdateLeadStatus?: (leadId: string, status: string) => void;
  onSelectPedido?: (ped: Pedido) => void;
  onReloadData?: () => void;
}

export interface ChatInteractionItem {
  id: string;
  source: 'pedido' | 'lead';
  clienteNombre: string;
  clienteTelefono: string;
  asesorNombre: string;
  asesorTelefono: string;
  asesorId?: string;
  createdAt: string;
  colDateStr: string;
  colHour: number;
  colMinute: number;
  colTimeFormatted: string;
  atendido: boolean;
  atendidoTimestamp?: string | null;
  statusLabel: string;
  estado: string;
  total: number;
  productosResumen: string;
  raw: any;
}

// Convierte cualquier fecha UTC o ISO a la zona horaria de Colombia (America/Bogota, UTC-5)
export function parseToColombiaTime(dateInput: string | Date | number): {
  dateStr: string;
  hour: number;
  minute: number;
  timeFormatted: string;
  colDate: Date;
} {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return { dateStr: '', hour: 0, minute: 0, timeFormatted: '00:00', colDate: new Date() };
  }
  const formatter = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(d);
  const partMap: Record<string, string> = {};
  parts.forEach(p => (partMap[p.type] = p.value));

  const dateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const hour12 = hour % 12 || 12;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const timeFormatted = `${hour12}:${String(minute).padStart(2, '0')} ${ampm}`;

  return {
    dateStr,
    hour,
    minute,
    timeFormatted,
    colDate: d
  };
}

// Evalúa con exactitud si un pedido o lead ya fue atendido por la asesora y cuándo ocurrió la atención
export function evaluateChatAttendance(item: any, source: 'pedido' | 'lead'): {
  isAttended: boolean;
  attendedTimestamp: string | null;
  statusLabel: string;
} {
  if (!item) return { isAttended: false, attendedTimestamp: null, statusLabel: 'Sin contactar' };

  if (source === 'pedido') {
    // 1. Pedido completado / entregado / pagado
    const isCompleted = item.estado === 'completado' || item.estado === 'entregado_pagado' || item.estado === 'entregado';
    if (isCompleted) {
      return {
        isAttended: true,
        attendedTimestamp: item.fecha_envio_mensaje || item.created_at,
        statusLabel: 'Venta Completada'
      };
    }

    // 2. Si ya tiene fecha_envio_mensaje (se le envió confirmación o recordatorio por WhatsApp)
    if (item.fecha_envio_mensaje) {
      return {
        isAttended: true,
        attendedTimestamp: item.fecha_envio_mensaje,
        statusLabel: 'Esperando Respuesta'
      };
    }

    // 3. Si el estado es mensaje_enviado, contra_mensaje_enviado, confirmado, despachado
    const attendedStatuses = [
      'mensaje_enviado',
      'contra_mensaje_enviado',
      'confirmado',
      'contra_confirmado',
      'despachado',
      'contra_despachado'
    ];
    if (attendedStatuses.includes(item.estado)) {
      let logDate: string | null = null;
      if (Array.isArray(item.historial)) {
        const log = [...item.historial].reverse().find((h: any) => 
          h.estado === 'mensaje_enviado' || 
          h.estado === 'confirmado' || 
          (h.accion && h.accion.toLowerCase().includes('mensaje'))
        );
        if (log?.fecha) logDate = log.fecha;
      }
      return {
        isAttended: true,
        attendedTimestamp: logDate || item.created_at,
        statusLabel: item.estado.includes('confirmado') ? 'Confirmado' : item.estado.includes('despachado') ? 'Despachado' : 'Esperando Respuesta'
      };
    }

    // 4. Si el pedido tiene flag atendido: true
    if (item.atendido === true) {
      return {
        isAttended: true,
        attendedTimestamp: item.created_at,
        statusLabel: 'Atendido'
      };
    }

    // 5. Si tiene comprobante de pago subido
    if (item.pantallazo_url) {
      return {
        isAttended: true,
        attendedTimestamp: item.created_at,
        statusLabel: 'Comprobante Subido'
      };
    }

    // 6. Si en historial hay alguna acción de mensaje o atención
    if (Array.isArray(item.historial) && item.historial.length > 0) {
      const log = item.historial.find((h: any) => 
        h.estado === 'mensaje_enviado' || 
        h.estado === 'contactado' || 
        h.estado === 'confirmado' || 
        (h.accion && (h.accion.toLowerCase().includes('mensaje') || h.accion.toLowerCase().includes('atendido')))
      );
      if (log) {
        return {
          isAttended: true,
          attendedTimestamp: log.fecha || item.created_at,
          statusLabel: 'Atendido'
        };
      }
    }

    return {
      isAttended: false,
      attendedTimestamp: null,
      statusLabel: item.modalidad_pago === 'contra_entrega' ? 'Por Confirmar' : 'Por Cobrar'
    };
  } else {
    // Es LEAD (Carrito Abandonado / Interesado)
    if (item.estado === 'completado') {
      return {
        isAttended: true,
        attendedTimestamp: item.created_at,
        statusLabel: 'Convertido en Pedido'
      };
    }

    if (item.retargeting_estado === 'contactado' || item.retargeting_estado === 'recuperado') {
      return {
        isAttended: true,
        attendedTimestamp: item.created_at,
        statusLabel: item.retargeting_estado === 'recuperado' ? 'Recuperado' : 'Esperando Respuesta'
      };
    }

    if (item.fecha_envio_mensaje) {
      return {
        isAttended: true,
        attendedTimestamp: item.fecha_envio_mensaje,
        statusLabel: 'Esperando Respuesta'
      };
    }

    if (item.atendido === true) {
      return {
        isAttended: true,
        attendedTimestamp: item.created_at,
        statusLabel: 'Contactado'
      };
    }

    return {
      isAttended: false,
      attendedTimestamp: null,
      statusLabel: 'Sin Contactar'
    };
  }
}

export const InformeAsesorasDiario: React.FC<InformeAsesorasDiarioProps> = ({
  pedidos,
  leads,
  asesores,
  configuracion,
  tenantId,
  currentAsesor,
  onAtenderPedido,
  onUpdateLeadStatus,
  onSelectPedido,
  onReloadData
}) => {
  const primaryColor = configuracion?.color_primario || '#00a6f9';

  // Selector de Modo Principal: Flujo Diario (por horas) vs Backlog Acumulado de Contra Entregas
  const [mainViewMode, setMainViewMode] = useState<'diario' | 'contra_acumulado'>('diario');

  // Fecha actual en Colombia por defecto
  const hoyColombiaStr = useMemo(() => {
    return parseToColombiaTime(new Date()).dateStr;
  }, []);

  const ayerColombiaStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return parseToColombiaTime(d).dateStr;
  }, []);

  // Filtros principales
  const [selectedDate, setSelectedDate] = useState<string>(hoyColombiaStr);
  const [selectedAsesorId, setSelectedAsesorId] = useState<string>(currentAsesor?.id || 'todas');
  const [cutoffHour, setCutoffHour] = useState<number>(16); // 16 = 4:00 PM (Hora de Control)
  const [filterStatusTab, setFilterStatusTab] = useState<'sin_atender' | 'atendidos' | 'todos'>('sin_atender');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── SUSCRIPCIÓN EN TIEMPO REAL (Supabase Realtime) ──
  useEffect(() => {
    const channel = supabase
      .channel(`realtime_reporte_chats_${tenantId}_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        onReloadData?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        onReloadData?.();
      })
      .subscribe();

    const pollInterval = setInterval(() => {
      onReloadData?.();
    }, 6000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [tenantId, onReloadData]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    if (onReloadData) {
      await onReloadData();
    }
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Teléfonos mapeados de cada asesor
  const asesoresPhoneMap = useMemo(() => {
    const map = new Map<string, { asesor: Asesor; phones: string[] }>();
    asesores.forEach(a => {
      const phones = (a.telefono || '')
        .split(',')
        .map(p => p.replace(/\D/g, ''))
        .filter(Boolean);
      map.set(a.id, { asesor: a, phones });
    });
    return map;
  }, [asesores]);

  // ── MODO 2: CONTRA ENTREGAS SIN CONFIRMAR (ACUMULADO HISTÓRICO) ──
  const unconfirmedContraOrders = useMemo(() => {
    return (pedidos || []).filter(p => {
      if (p.tenant_id && p.tenant_id !== tenantId) return false;
      const mp = (p.metodo_pago || '').toLowerCase();
      const mod = ((p as any).modalidad_pago || '').toLowerCase();
      const est = (p.estado || '').toLowerCase();
      const isContra = mp.includes('contra') || mod.includes('contra') || est.includes('contra');
      const isCompleted = est === 'confirmado' || est === 'contra_confirmado' || est === 'despachado' || est === 'contra_despachado' || est === 'completado' || est === 'entregado_pagado' || est === 'cancelado';
      return isContra && !isCompleted;
    });
  }, [pedidos, tenantId]);

  // Desglose de contra entregas sin confirmar por Asesora
  const contraBreakdownByAsesor = useMemo(() => {
    return asesores.map(a => {
      const aPhones = (a.telefono || '').split(',').map(p => p.replace(/\D/g, '')).filter(Boolean);
      const orders = unconfirmedContraOrders.filter(p => {
        const orderPhone = (p.linea_whatsapp || '').replace(/\D/g, '');
        return aPhones.includes(orderPhone) || (p.asesor && p.asesor.toLowerCase() === a.nombre.toLowerCase());
      });
      const totalAmount = orders.reduce((sum, o) => sum + (o.total || 0), 0);
      return {
        asesor: a,
        count: orders.length,
        totalAmount,
        orders
      };
    });
  }, [asesores, unconfirmedContraOrders]);

  // Lista de contra entregas filtradas según asesora seleccionada y búsqueda
  const filteredContraList = useMemo(() => {
    let list = unconfirmedContraOrders;
    if (selectedAsesorId !== 'todas') {
      const targetAsesor = asesores.find(a => a.id === selectedAsesorId);
      if (targetAsesor) {
        const aPhones = (targetAsesor.telefono || '').split(',').map(p => p.replace(/\D/g, '')).filter(Boolean);
        list = list.filter(p => {
          const orderPhone = (p.linea_whatsapp || '').replace(/\D/g, '');
          return aPhones.includes(orderPhone) || (p.asesor && p.asesor.toLowerCase() === targetAsesor.nombre.toLowerCase());
        });
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => 
        (p.cliente_nombre || '').toLowerCase().includes(q) ||
        (p.cliente_telefono || '').includes(q) ||
        (p.linea_whatsapp || '').includes(q)
      );
    }

    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [unconfirmedContraOrders, selectedAsesorId, asesores, searchQuery]);

  // Confirmar un pedido contra entrega desde el informe
  const handleConfirmContraOrder = async (orderId: string) => {
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('pedidos')
        .update({
          estado: 'confirmado',
          atendido: true,
          fecha_envio_mensaje: nowIso
        })
        .eq('id', orderId);
      if (!error) {
        if (onReloadData) onReloadData();
      }
    } catch (err) {
      console.error('Error al confirmar pedido contra entrega:', err);
    }
  };

  // Cancelar un pedido contra entrega desde el informe
  const handleCancelContraOrder = async (orderId: string) => {
    if (!confirm('¿Deseas marcar este pedido contra entrega como cancelado?')) return;
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({
          estado: 'cancelado'
        })
        .eq('id', orderId);
      if (!error) {
        if (onReloadData) onReloadData();
      }
    } catch (err) {
      console.error('Error al cancelar pedido:', err);
    }
  };

  // ── MODO 1: FLUJO DIARIO POR HORAS ──
  // Unifica pedidos y leads en una lista única de interacciones/chats, deduplicando clientes
  const allInteractions = useMemo(() => {
    const items: ChatInteractionItem[] = [];

    // 1. Procesar Pedidos
    (pedidos || []).forEach(p => {
      if (p.tenant_id && p.tenant_id !== tenantId) return;
      const cleanLinePhone = (p.linea_whatsapp || '').replace(/\D/g, '');
      
      let matchedAsesor: Asesor | undefined;
      for (const [, item] of asesoresPhoneMap) {
        if (item.phones.includes(cleanLinePhone)) {
          matchedAsesor = item.asesor;
          break;
        }
      }

      if (!matchedAsesor && p.asesor) {
        matchedAsesor = asesores.find(a => 
          a.nombre.toLowerCase().trim() === (p.asesor || '').toLowerCase().trim()
        );
      }

      const colTime = parseToColombiaTime(p.created_at);
      const evalAttendance = evaluateChatAttendance(p, 'pedido');

      let prodSummary = 'Pedido sin detalle';
      if (Array.isArray(p.productos) && p.productos.length > 0) {
        prodSummary = p.productos
          .map((prod: any) => `${prod.cantidad || 1}x ${prod.nombre || 'Item'}`)
          .slice(0, 3)
          .join(', ');
        if (p.productos.length > 3) prodSummary += ` (+${p.productos.length - 3} más)`;
      }

      items.push({
        id: `pedido_${p.id}`,
        source: 'pedido',
        clienteNombre: p.cliente_nombre || 'Cliente WhatsApp',
        clienteTelefono: (p.cliente_telefono || '').replace(/\D/g, ''),
        asesorNombre: matchedAsesor?.nombre || p.asesor || 'Asesor General',
        asesorTelefono: matchedAsesor?.telefono || p.linea_whatsapp || '',
        asesorId: matchedAsesor?.id,
        createdAt: p.created_at,
        colDateStr: colTime.dateStr,
        colHour: colTime.hour,
        colMinute: colTime.minute,
        colTimeFormatted: colTime.timeFormatted,
        atendido: evalAttendance.isAttended,
        atendidoTimestamp: evalAttendance.attendedTimestamp,
        statusLabel: evalAttendance.statusLabel,
        estado: p.estado || 'pendiente',
        total: p.total || 0,
        productosResumen: prodSummary,
        raw: p
      });
    });

    // 2. Procesar Leads
    (leads || []).forEach(l => {
      if (l.tenant_id && l.tenant_id !== tenantId) return;
      const cleanLinePhone = (l.linea_whatsapp || '').replace(/\D/g, '');
      const cleanClientPhone = (l.telefono || '').replace(/\D/g, '');

      if (cleanClientPhone) {
        const leadTime = new Date(l.created_at).getTime();
        const hasOrder = items.some(it => {
          if (it.source !== 'pedido') return false;
          if (it.clienteTelefono !== cleanClientPhone) return false;
          const orderTime = new Date(it.createdAt).getTime();
          return Math.abs(orderTime - leadTime) < 2 * 3600 * 1000;
        });
        if (hasOrder) return;
      }

      let matchedAsesor: Asesor | undefined;
      for (const [, item] of asesoresPhoneMap) {
        if (item.phones.includes(cleanLinePhone)) {
          matchedAsesor = item.asesor;
          break;
        }
      }

      const colTime = parseToColombiaTime(l.created_at);
      const evalAttendance = evaluateChatAttendance(l, 'lead');

      let prodSummary = 'Carrito / Interés';
      if (Array.isArray(l.productos) && l.productos.length > 0) {
        prodSummary = l.productos
          .map((prod: any) => `${prod.cantidad || 1}x ${prod.nombre || 'Item'}`)
          .slice(0, 3)
          .join(', ');
      }

      items.push({
        id: `lead_${l.id}`,
        source: 'lead',
        clienteNombre: l.nombre || 'Interesado Carrito',
        clienteTelefono: cleanClientPhone,
        asesorNombre: matchedAsesor?.nombre || 'Asesor General',
        asesorTelefono: matchedAsesor?.telefono || l.linea_whatsapp || '',
        asesorId: matchedAsesor?.id,
        createdAt: l.created_at,
        colDateStr: colTime.dateStr,
        colHour: colTime.hour,
        colMinute: colTime.minute,
        colTimeFormatted: colTime.timeFormatted,
        atendido: evalAttendance.isAttended,
        atendidoTimestamp: evalAttendance.attendedTimestamp,
        statusLabel: evalAttendance.statusLabel,
        estado: l.retargeting_estado || l.estado || 'abandonado',
        total: l.total || 0,
        productosResumen: prodSummary,
        raw: l
      });
    });

    return items;
  }, [pedidos, leads, tenantId, asesoresPhoneMap, asesores]);

  // Filtrar interacciones por Fecha seleccionada
  const dayInteractions = useMemo(() => {
    return allInteractions.filter(item => item.colDateStr === selectedDate);
  }, [allInteractions, selectedDate]);

  // Filtrar interacciones por Asesora seleccionada
  const dayAsesorInteractions = useMemo(() => {
    if (selectedAsesorId === 'todas') return dayInteractions;
    return dayInteractions.filter(item => item.asesorId === selectedAsesorId);
  }, [dayInteractions, selectedAsesorId]);

  // Interacciones que llegaron ANTES o HASTA la hora de corte seleccionada (ej: 16:00 = 4:00 PM)
  const interactionsUpToCutoff = useMemo(() => {
    return dayAsesorInteractions.filter(item => {
      return item.colHour < cutoffHour || (item.colHour === cutoffHour && item.colMinute === 0);
    });
  }, [dayAsesorInteractions, cutoffHour]);

  // Clasificar según estado de atención a la hora de corte
  const { atendidosAtCutoff, sinAtenderAtCutoff } = useMemo(() => {
    const atendidos: ChatInteractionItem[] = [];
    const sinAtender: ChatInteractionItem[] = [];

    interactionsUpToCutoff.forEach(item => {
      if (!item.atendido) {
        sinAtender.push(item);
      } else {
        if (item.atendidoTimestamp) {
          const colAtendido = parseToColombiaTime(item.atendidoTimestamp);
          const wasAttendedBeforeCutoff = 
            colAtendido.dateStr < selectedDate ||
            (colAtendido.dateStr === selectedDate && (colAtendido.hour < cutoffHour || (colAtendido.hour === cutoffHour && colAtendido.minute === 0)));
          
          if (wasAttendedBeforeCutoff) {
            atendidos.push(item);
          } else {
            sinAtender.push(item);
          }
        } else {
          atendidos.push(item);
        }
      }
    });

    return {
      atendidosAtCutoff: atendidos,
      sinAtenderAtCutoff: sinAtender
    };
  }, [interactionsUpToCutoff, cutoffHour, selectedDate]);

  const totalRecibidos = interactionsUpToCutoff.length;
  const totalAtendidos = atendidosAtCutoff.length;
  const totalSinAtender = sinAtenderAtCutoff.length;
  const porcentajeSinAtender = totalRecibidos > 0 ? Math.round((totalSinAtender / totalRecibidos) * 100) : 0;
  const porcentajeAtendidos = totalRecibidos > 0 ? Math.round((totalAtendidos / totalRecibidos) * 100) : 0;
  
  const valorSinAtender = useMemo(() => {
    return sinAtenderAtCutoff.reduce((acc, it) => acc + (it.total || 0), 0);
  }, [sinAtenderAtCutoff]);

  const promedioEsperaMins = useMemo(() => {
    if (sinAtenderAtCutoff.length === 0) return 0;
    const cutoffMinutesFromDayStart = cutoffHour * 60;
    const totalMinutes = sinAtenderAtCutoff.reduce((acc, it) => {
      const itemMinutes = it.colHour * 60 + it.colMinute;
      const wait = Math.max(0, cutoffMinutesFromDayStart - itemMinutes);
      return acc + wait;
    }, 0);
    return Math.round(totalMinutes / sinAtenderAtCutoff.length);
  }, [sinAtenderAtCutoff, cutoffHour]);

  const formatMinsToDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h} horas`;
  };

  // Comparativa por asesora para el día y la hora de corte seleccionados
  const comparativaAsesores = useMemo(() => {
    return asesores.map(a => {
      const asesorItems = dayInteractions.filter(it => it.asesorId === a.id);
      const upToCutoff = asesorItems.filter(it => it.colHour < cutoffHour || (it.colHour === cutoffHour && it.colMinute === 0));
      
      const sinAtenderList: ChatInteractionItem[] = [];
      const atendidosList: ChatInteractionItem[] = [];

      upToCutoff.forEach(item => {
        if (!item.atendido) {
          sinAtenderList.push(item);
        } else {
          if (item.atendidoTimestamp) {
            const colAtendido = parseToColombiaTime(item.atendidoTimestamp);
            const wasAttendedBeforeCutoff = 
              colAtendido.dateStr < selectedDate ||
              (colAtendido.dateStr === selectedDate && (colAtendido.hour < cutoffHour || (colAtendido.hour === cutoffHour && colAtendido.minute === 0)));
            if (wasAttendedBeforeCutoff) {
              atendidosList.push(item);
            } else {
              sinAtenderList.push(item);
            }
          } else {
            atendidosList.push(item);
          }
        }
      });

      const total = upToCutoff.length;
      const pctSinAtender = total > 0 ? Math.round((sinAtenderList.length / total) * 100) : 0;

      return {
        asesor: a,
        totalRecibidos: total,
        atendidos: atendidosList.length,
        sinAtender: sinAtenderList.length,
        pctSinAtender,
        valorSinAtender: sinAtenderList.reduce((s, it) => s + (it.total || 0), 0)
      };
    });
  }, [asesores, dayInteractions, cutoffHour, selectedDate]);

  // Desglose hora a hora de 8:00 AM a 20:00 (8:00 PM)
  const hourlyBreakdown = useMemo(() => {
    const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    return hours.map(h => {
      const hour12 = h % 12 || 12;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const label = `${hour12}:00 ${ampm}`;

      const itemsInHour = dayAsesorInteractions.filter(it => it.colHour === h);
      const upToThisHour = dayAsesorInteractions.filter(it => it.colHour <= h);
      const sinAtenderAtThisHour = upToThisHour.filter(it => {
        if (!it.atendido) return true;
        if (it.atendidoTimestamp) {
          const colAtendido = parseToColombiaTime(it.atendidoTimestamp);
          const wasAttendedBeforeThisHour = 
            colAtendido.dateStr < selectedDate ||
            (colAtendido.dateStr === selectedDate && (colAtendido.hour < h || (colAtendido.hour === h && colAtendido.minute === 0)));
          return !wasAttendedBeforeThisHour;
        }
        return false;
      });

      return {
        hourNumber: h,
        label,
        nuevos: itemsInHour.length,
        atendidos: itemsInHour.filter(it => it.atendido).length,
        sinAtenderAcumulados: sinAtenderAtThisHour.length,
        itemsInHour
      };
    });
  }, [dayAsesorInteractions, selectedDate]);

  const detailedList = useMemo(() => {
    let list: ChatInteractionItem[] = [];
    if (filterStatusTab === 'sin_atender') list = sinAtenderAtCutoff;
    else if (filterStatusTab === 'atendidos') list = atendidosAtCutoff;
    else list = interactionsUpToCutoff;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(it => 
        it.clienteNombre.toLowerCase().includes(q) ||
        it.clienteTelefono.includes(q) ||
        it.asesorNombre.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      return (a.colHour * 60 + a.colMinute) - (b.colHour * 60 + b.colMinute);
    });
  }, [filterStatusTab, sinAtenderAtCutoff, atendidosAtCutoff, interactionsUpToCutoff, searchQuery]);

  const handleQuickMarkAtendido = async (item: ChatInteractionItem) => {
    try {
      const nowIso = new Date().toISOString();
      if (item.source === 'pedido') {
        const { error } = await supabase
          .from('pedidos')
          .update({ 
            atendido: true,
            estado: 'mensaje_enviado',
            fecha_envio_mensaje: nowIso
          })
          .eq('id', item.raw.id);
        if (!error) {
          if (onAtenderPedido) onAtenderPedido(item.raw);
          if (onReloadData) onReloadData();
        }
      } else {
        const { error } = await supabase
          .from('leads')
          .update({ 
            retargeting_estado: 'contactado',
            atendido: true,
            fecha_envio_mensaje: nowIso
          })
          .eq('id', item.raw.id);
        if (!error) {
          if (onUpdateLeadStatus) onUpdateLeadStatus(item.raw.id, 'contactado');
          if (onReloadData) onReloadData();
        }
      }
    } catch (err) {
      console.error('Error al marcar como atendido:', err);
    }
  };

  const handleOpenWhatsAppChat = (item: ChatInteractionItem | any) => {
    const rawPhone = item.clienteTelefono || item.cliente_telefono || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
    const name = item.clienteNombre || item.cliente_nombre || 'Cliente';
    const text = encodeURIComponent(`¡Hola ${name}! 👋 Te escribo de ${configuracion?.nombre_negocio || 'la tienda'}. ¿Cómo estás?`);
    window.open(`https://api.whatsapp.com/send?phone=${fullPhone}&text=${text}`, '_blank');
  };

  const handleExportCSV = () => {
    const headers = [
      'Fecha',
      'Hora Llegada',
      'Cliente',
      'Teléfono',
      'Asesora Asignada',
      'Tipo',
      'Estado al Corte',
      'Estado Detallado',
      'Total COP',
      'Detalle'
    ];

    const rows = (mainViewMode === 'diario' ? interactionsUpToCutoff : unconfirmedContraOrders).map((it: any) => {
      const isSinAtender = mainViewMode === 'diario' 
        ? sinAtenderAtCutoff.some(s => s.id === it.id)
        : true;
      return [
        `"${it.colDateStr || it.created_at}"`,
        `"${it.colTimeFormatted || ''}"`,
        `"${(it.clienteNombre || it.cliente_nombre || '').replace(/"/g, '""')}"`,
        `"${it.clienteTelefono || it.cliente_telefono || ''}"`,
        `"${(it.asesorNombre || it.asesor || '').replace(/"/g, '""')}"`,
        `"${it.source === 'pedido' || it.modalidad_pago ? 'Contra Entrega' : 'Lead'}"`,
        `"${isSinAtender ? 'Sin Atender / Sin Confirmar' : 'Atendido'}"`,
        `"${it.statusLabel || it.estado}"`,
        it.total || 0,
        `"${(it.productosResumen || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `informe_asesoras_${mainViewMode}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStepDay = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);
    setSelectedDate(parseToColombiaTime(dateObj).dateStr);
  };

  const friendlyDateStr = useMemo(() => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);
    return dateObj.toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, [selectedDate]);

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* ── SELECTOR PRINCIPAL: FLUJO DIARIO VS CONTRA ENTREGAS ACUMULADAS ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.85rem',
        background: '#ffffff',
        padding: '0.85rem 1.25rem',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setMainViewMode('diario')}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '10px',
              border: mainViewMode === 'diario' ? `1.5px solid ${primaryColor}` : '1px solid #cbd5e1',
              background: mainViewMode === 'diario' ? 'rgba(0, 166, 249, 0.08)' : '#ffffff',
              color: mainViewMode === 'diario' ? primaryColor : '#475569',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontFamily: "'Poppins', sans-serif"
            }}
          >
            <Clock size={16} />
            <span>Auditoría Diaria por Horas</span>
          </button>

          <button
            type="button"
            onClick={() => setMainViewMode('contra_acumulado')}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '10px',
              border: mainViewMode === 'contra_acumulado' ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
              background: mainViewMode === 'contra_acumulado' ? '#fff7ed' : '#ffffff',
              color: mainViewMode === 'contra_acumulado' ? '#ea580c' : '#475569',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontFamily: "'Poppins', sans-serif"
            }}
          >
            <Truck size={16} color="#ea580c" />
            <span>🚚 Contra Entregas Sin Confirmar (Acumulado)</span>
            <span style={{
              background: '#ea580c',
              color: '#ffffff',
              padding: '0.1rem 0.5rem',
              borderRadius: '12px',
              fontSize: '0.74rem',
              fontWeight: 600
            }}>
              {unconfirmedContraOrders.length}
            </span>
          </button>
        </div>

        {/* Acciones: En Vivo + Refrescar + Descargar CSV */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.35rem 0.65rem',
            borderRadius: '20px',
            fontSize: '0.74rem',
            fontWeight: 500,
            background: '#ecfdf5',
            color: '#059669',
            border: '1px solid #a7f3d0'
          }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
            En Vivo (Tiempo Real)
          </span>

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.5rem 0.85rem',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif"
            }}
            title="Sincronizar cambios de Supabase ahora"
          >
            <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isRefreshing ? 'Actualizando...' : 'Refrescar'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.85rem',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif"
            }}
          >
            <Download size={14} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* VISTA 1: FLUJO DIARIO POR HORAS                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {mainViewMode === 'diario' ? (
        <>
          {/* Header y Controles Diarios */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '1.25rem 1.5rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.85rem',
              background: '#f8fafc',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid #edf2f7'
            }}>
              
              {/* Selector de Asesora */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 500, color: '#475569', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  👩‍💼 Asesora a Auditar
                </label>
                <select
                  value={selectedAsesorId}
                  onChange={e => setSelectedAsesorId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '0.84rem',
                    fontWeight: 500,
                    color: '#1e293b',
                    fontFamily: "'Poppins', sans-serif",
                    cursor: 'pointer'
                  }}
                >
                  <option value="todas">👥 Todas las Asesoras (Comparativa General)</option>
                  {asesores.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} {a.telefono ? `(${a.telefono.split(',')[0].trim()})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de Fecha */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 500, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    📅 Día del Informe
                  </label>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(hoyColombiaStr)}
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        border: 'none',
                        fontSize: '0.68rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        background: selectedDate === hoyColombiaStr ? primaryColor : '#e2e8f0',
                        color: selectedDate === hoyColombiaStr ? '#ffffff' : '#475569'
                      }}
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(ayerColombiaStr)}
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        border: 'none',
                        fontSize: '0.68rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        background: selectedDate === ayerColombiaStr ? primaryColor : '#e2e8f0',
                        color: selectedDate === ayerColombiaStr ? '#ffffff' : '#475569'
                      }}
                    >
                      Ayer
                    </button>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <button
                    type="button"
                    onClick={() => handleStepDay(-1)}
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#475569'
                    }}
                    title="Día anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.6rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '0.84rem',
                      fontWeight: 500,
                      color: '#1e293b',
                      fontFamily: "'Poppins', sans-serif"
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleStepDay(1)}
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#475569'
                    }}
                    title="Día siguiente"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Selector de Hora de Corte */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 500, color: '#475569', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ⏱️ Corte de Hora a Auditar
                </label>
                <select
                  value={cutoffHour}
                  onChange={e => setCutoffHour(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: cutoffHour === 16 ? `2px solid ${primaryColor}` : '1px solid #cbd5e1',
                    background: cutoffHour === 16 ? 'rgba(0, 166, 249, 0.04)' : '#ffffff',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    color: '#0f172a',
                    fontFamily: "'Poppins', sans-serif",
                    cursor: 'pointer'
                  }}
                >
                  <option value={9}>09:00 AM (Apertura)</option>
                  <option value={10}>10:00 AM</option>
                  <option value={11}>11:00 AM</option>
                  <option value={12}>12:00 PM (Mediodía)</option>
                  <option value={13}>01:00 PM</option>
                  <option value={14}>02:00 PM</option>
                  <option value={15}>03:00 PM</option>
                  <option value={16}>⭐ 04:00 PM (Hora de Control)</option>
                  <option value={17}>05:00 PM</option>
                  <option value={18}>06:00 PM (Cierre turno tarde)</option>
                  <option value={19}>07:00 PM</option>
                  <option value={20}>08:00 PM</option>
                  <option value={24}>23:59 (Todo el día completo)</option>
                </select>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.82rem',
              color: '#334155',
              background: '#f1f5f9',
              padding: '0.5rem 0.85rem',
              borderRadius: '8px'
            }}>
              <Sparkles size={15} color={primaryColor} />
              <span>
                Mostrando auditoría para <strong>{friendlyDateStr}</strong> a las <strong>{cutoffHour === 24 ? 'Cierre del día' : `${cutoffHour % 12 || 12}:00 ${cutoffHour >= 12 ? 'PM' : 'AM'}`}</strong>:
              </span>
            </div>
          </div>

          {/* Tarjetas KPI del Flujo Diario */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '0.85rem'
          }}>
            <div style={{ background: '#ffffff', borderRadius: '14px', padding: '1rem 1.15rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748b', textTransform: 'uppercase' }}>Chats Recibidos</span>
                <MessageSquare size={16} color="#64748b" />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 600, color: '#0f172a', lineHeight: 1 }}>{totalRecibidos}</div>
              <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '0.4rem' }}>Hasta las {cutoffHour === 24 ? '23:59' : `${cutoffHour % 12 || 12}:00 ${cutoffHour >= 12 ? 'PM' : 'AM'}`}</div>
            </div>

            <div style={{ background: '#f0fdf4', borderRadius: '14px', padding: '1rem 1.15rem', border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#166534', textTransform: 'uppercase' }}>Chats Atendidos</span>
                <CheckCircle2 size={16} color="#16a34a" />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 600, color: '#15803d', lineHeight: 1 }}>{totalAtendidos}</div>
              <div style={{ fontSize: '0.73rem', color: '#166534', marginTop: '0.4rem' }}>{porcentajeAtendidos}% de efectividad a esa hora</div>
            </div>

            <div style={{ borderRadius: '14px', padding: '1rem 1.15rem', border: totalSinAtender > 0 ? '1.5px solid #fca5a5' : '1px solid #e2e8f0', background: totalSinAtender > 0 ? '#fef2f2' : '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: totalSinAtender > 0 ? '#991b1b' : '#64748b', textTransform: 'uppercase' }}>⚠️ Sin Atender a esa Hora</span>
                <AlertTriangle size={16} color={totalSinAtender > 0 ? '#dc2626' : '#94a3b8'} />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 600, color: totalSinAtender > 0 ? '#b91c1c' : '#0f172a', lineHeight: 1 }}>{totalSinAtender}</div>
              <div style={{ fontSize: '0.73rem', color: totalSinAtender > 0 ? '#991b1b' : '#64748b', marginTop: '0.4rem' }}>{totalSinAtender > 0 ? `${porcentajeSinAtender}% sin respuesta` : 'Todo al día ✓'}</div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '14px', padding: '1rem 1.15rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748b', textTransform: 'uppercase' }}>Demora Promedio</span>
                <Clock size={16} color="#64748b" />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#0f172a', lineHeight: 1 }}>{totalSinAtender > 0 ? formatMinsToDuration(promedioEsperaMins) : '0 min'}</div>
              <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '0.4rem' }}>Tiempo de espera</div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '14px', padding: '1rem 1.15rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748b', textTransform: 'uppercase' }}>Ventas en Riesgo</span>
                <DollarSign size={16} color="#d97706" />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 600, color: '#b45309', lineHeight: 1 }}>${valorSinAtender.toLocaleString('es-CO')}</div>
              <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '0.4rem' }}>En pedidos sin atender</div>
            </div>
          </div>

          {/* Comparativa de Asesoras */}
          {selectedAsesorId === 'todas' && (
            <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 0.85rem 0', fontSize: '0.98rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Users size={17} color={primaryColor} /> Comparativa de Asesoras al Corte de las {cutoffHour % 12 || 12}:00 {cutoffHour >= 12 ? 'PM' : 'AM'}
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9', background: '#f8fafc' }}>
                      <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569' }}>Asesora</th>
                      <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Chats Recibidos</th>
                      <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#16a34a', textAlign: 'center' }}>Atendidos</th>
                      <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#dc2626', textAlign: 'center' }}>Sin Atender</th>
                      <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Efectividad</th>
                      <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Ventas en Riesgo</th>
                      <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparativaAsesores.map(c => {
                      const hasSinAtender = c.sinAtender > 0;
                      return (
                        <tr key={c.asesor.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              {c.asesor.foto_url ? (
                                <img src={c.asesor.foto_url} alt={c.asesor.nombre} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                                  {c.asesor.nombre.charAt(0)}
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.asesor.nombre}</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 400 }}>📱 {(c.asesor.telefono || '').split(',')[0]}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', fontWeight: 600, color: '#0f172a' }}>{c.totalRecibidos}</td>
                          <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', fontWeight: 600, color: '#16a34a' }}>{c.atendidos}</td>
                          <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600, background: hasSinAtender ? '#fee2e2' : '#f0fdf4', color: hasSinAtender ? '#b91c1c' : '#15803d' }}>
                              {c.sinAtender}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', fontWeight: 500 }}>
                            {c.totalRecibidos > 0 ? (
                              <span style={{ color: c.pctSinAtender > 30 ? '#dc2626' : '#16a34a' }}>{100 - c.pctSinAtender}%</span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Sin chats</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontWeight: 600, color: hasSinAtender ? '#b45309' : '#94a3b8' }}>${c.valorSinAtender.toLocaleString('es-CO')}</td>
                          <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedAsesorId(c.asesor.id)}
                              style={{ padding: '0.3rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontSize: '0.76rem', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <span>Ver detalle</span>
                              <ArrowUpRight size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Línea de Tiempo Hora a Hora */}
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Clock size={17} color={primaryColor} /> Evolución Hora a Hora del Día (8:00 AM - 8:00 PM)
              </h3>
              <span style={{ fontSize: '0.76rem', color: '#64748b' }}>Haz clic en cualquier hora para auditarla como corte</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.45rem', overflowX: 'auto', paddingBottom: '0.4rem' }}>
              {hourlyBreakdown.map(hb => {
                const isCurrentCutoff = cutoffHour === hb.hourNumber;
                const hasSinAtender = hb.sinAtenderAcumulados > 0;
                return (
                  <button
                    key={hb.hourNumber}
                    type="button"
                    onClick={() => setCutoffHour(hb.hourNumber)}
                    style={{
                      padding: '0.65rem 0.4rem',
                      borderRadius: '10px',
                      border: isCurrentCutoff ? `2px solid ${primaryColor}` : '1px solid #e2e8f0',
                      background: isCurrentCutoff ? 'rgba(0, 166, 249, 0.08)' : '#f8fafc',
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontFamily: "'Poppins', sans-serif",
                      position: 'relative'
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: isCurrentCutoff ? primaryColor : '#475569', marginBottom: '0.25rem' }}>{hb.label}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: hasSinAtender ? '#dc2626' : '#16a34a', lineHeight: 1 }}>{hb.sinAtenderAcumulados}</div>
                    <div style={{ fontSize: '0.64rem', color: '#64748b', marginTop: '0.2rem' }}>{hb.nuevos > 0 ? `+${hb.nuevos} nuevo` : '0 nuevo'}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista detallada del Día */}
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: '10px' }}>
                <button
                  type="button"
                  onClick={() => setFilterStatusTab('sin_atender')}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: filterStatusTab === 'sin_atender' ? '#fee2e2' : 'transparent',
                    color: filterStatusTab === 'sin_atender' ? '#b91c1c' : '#475569',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <span>🚨 Sin Atender</span>
                  <span style={{ background: filterStatusTab === 'sin_atender' ? '#dc2626' : '#94a3b8', color: '#ffffff', padding: '0.05rem 0.45rem', borderRadius: '10px', fontSize: '0.72rem' }}>
                    {sinAtenderAtCutoff.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterStatusTab('atendidos')}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: filterStatusTab === 'atendidos' ? '#dcfce7' : 'transparent',
                    color: filterStatusTab === 'atendidos' ? '#15803d' : '#475569',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <span>✓ Atendidos</span>
                  <span style={{ background: filterStatusTab === 'atendidos' ? '#16a34a' : '#94a3b8', color: '#ffffff', padding: '0.05rem 0.45rem', borderRadius: '10px', fontSize: '0.72rem' }}>
                    {atendidosAtCutoff.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterStatusTab('todos')}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: filterStatusTab === 'todos' ? '#ffffff' : 'transparent',
                    color: filterStatusTab === 'todos' ? '#0f172a' : '#475569',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <span>Todos ({interactionsUpToCutoff.length})</span>
                </button>
              </div>

              <div style={{ position: 'relative', width: '240px' }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Buscar cliente o teléfono..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.65rem 0.45rem 2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontFamily: "'Poppins', sans-serif" }}
                />
              </div>
            </div>

            {detailedList.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>{filterStatusTab === 'sin_atender' ? '🎉' : '📭'}</div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#0f172a', fontWeight: 600 }}>
                  {filterStatusTab === 'sin_atender' ? `¡No hay chats sin atender a las ${cutoffHour % 12 || 12}:00 ${cutoffHour >= 12 ? 'PM' : 'AM'}!` : 'No hay interacciones registradas en este filtro.'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>{filterStatusTab === 'sin_atender' ? 'Todos los clientes que escribieron hasta esta hora fueron atendidos oportunamente.' : 'Prueba cambiando la hora de corte o la fecha seleccionada.'}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {detailedList.map(item => {
                  const cutoffMinutes = cutoffHour * 60;
                  const itemMinutes = item.colHour * 60 + item.colMinute;
                  const waitMinutesAtCutoff = Math.max(0, cutoffMinutes - itemMinutes);
                  const isSinAtender = sinAtenderAtCutoff.some(s => s.id === item.id);

                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '12px',
                        border: isSinAtender ? '1.5px solid #fee2e2' : '1px solid #e2e8f0',
                        background: isSinAtender ? '#fffafa' : '#ffffff',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.85rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '220px' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: isSinAtender ? '#fee2e2' : '#ecfdf5',
                          color: isSinAtender ? '#dc2626' : '#16a34a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '0.92rem',
                          flexShrink: 0
                        }}>
                          {item.clienteNombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>{item.clienteNombre}</span>
                            <span style={{ fontSize: '0.68rem', fontWeight: 500, padding: '0.1rem 0.4rem', borderRadius: '4px', background: item.source === 'pedido' ? '#eff6ff' : '#faf5ff', color: item.source === 'pedido' ? '#1d4ed8' : '#7e22ce' }}>
                              {item.source === 'pedido' ? 'Pedido Web' : 'Carrito Abandonado'}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 500,
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              background: item.statusLabel.includes('Esperando') ? '#fffbeb' : item.statusLabel.includes('Confirmado') || item.statusLabel.includes('Venta') ? '#ecfdf5' : '#f1f5f9',
                              color: item.statusLabel.includes('Esperando') ? '#b45309' : item.statusLabel.includes('Confirmado') || item.statusLabel.includes('Venta') ? '#15803d' : '#475569',
                              border: item.statusLabel.includes('Esperando') ? '1px solid #fde68a' : '1px solid transparent'
                            }}>
                              {item.statusLabel}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                            <span>📱 {item.clienteTelefono || 'Sin teléfono'}</span>
                            <span>•</span>
                            <span>Asesora: <strong>{item.asesorNombre}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div style={{ minWidth: '160px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Clock size={14} color="#64748b" />
                          <span>Llegó: <strong>{item.colTimeFormatted}</strong></span>
                        </div>
                        {isSinAtender ? (
                          <div style={{ fontSize: '0.74rem', color: '#dc2626', fontWeight: 500, marginTop: '0.15rem' }}>
                            ⚠️ Llevaba {formatMinsToDuration(waitMinutesAtCutoff)} sin atender a las {cutoffHour % 12 || 12}:00 {cutoffHour >= 12 ? 'PM' : 'AM'}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 500, marginTop: '0.15rem' }}>
                            ✓ {item.atendidoTimestamp ? `Atendido (${parseToColombiaTime(item.atendidoTimestamp).timeFormatted})` : 'Atendido oportunamente'}
                          </div>
                        )}
                      </div>

                      <div style={{ minWidth: '140px', textAlign: 'right' }}>
                        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#0f172a' }}>${(item.total || 0).toLocaleString('es-CO')}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.productosResumen}>{item.productosResumen}</div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {item.source === 'pedido' && item.raw && onSelectPedido && (
                          <button
                            type="button"
                            onClick={() => onSelectPedido(item.raw)}
                            style={{ padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: '0.76rem', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            title="Ver detalles del pedido"
                          >
                            <Eye size={13} />
                            <span>Ver</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsAppChat(item)}
                          style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <Phone size={13} />
                          <span>WhatsApp</span>
                        </button>
                        {isSinAtender && (
                          <button
                            type="button"
                            onClick={() => handleQuickMarkAtendido(item)}
                            style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: 'none', background: primaryColor, color: '#ffffff', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <CheckCircle2 size={13} />
                            <span>Marcar Atendido</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* ══════════════════════════════════════════════════════════════════ */
        /* VISTA 2: CONTRA ENTREGAS SIN CONFIRMAR (ACUMULADO HISTÓRICO)       */
        /* ══════════════════════════════════════════════════════════════════ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Banner Explicativo */}
          <div style={{
            background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
            border: '1.5px solid #fed7aa',
            borderRadius: '16px',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                <Truck size={20} color="#ea580c" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#9a3412' }}>
                  Backlog Acumulado: Pedidos Contra Entrega Sin Confirmar
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#9a3412', opacity: 0.9 }}>
                Aquí se encuentran los <strong>{unconfirmedContraOrders.length} pedidos contra entrega</strong> que ingresaron por la web y que las asesoras aún no han confirmado ni cerrado (muchos están en "Esperando Respuesta" o sin confirmar desde días pasados).
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#9a3412', textTransform: 'uppercase' }}>Valor Total en Riesgo</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 600, color: '#c2410c' }}>
                ${unconfirmedContraOrders.reduce((acc, p) => acc + (p.total || 0), 0).toLocaleString('es-CO')}
              </div>
            </div>
          </div>

          {/* Comparativa por Asesora del Backlog Contra Entrega */}
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.96rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Users size={16} color="#ea580c" /> Contra Entregas Pendientes por Asesora
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', background: '#f8fafc' }}>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569' }}>Asesora</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Línea WhatsApp</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#ea580c', textAlign: 'center' }}>Contra Entregas Sin Confirmar</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Monto Acumulado ($)</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Filtro</th>
                  </tr>
                </thead>
                <tbody>
                  {contraBreakdownByAsesor.map(item => (
                    <tr key={item.asesor.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#ffedd5', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                            {item.asesor.nombre.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.asesor.nombre}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', color: '#64748b' }}>
                        {(item.asesor.telefono || '').split(',').join(' · ')}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '0.2rem 0.65rem',
                          borderRadius: '12px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          background: item.count > 0 ? '#ffedd5' : '#f1f5f9',
                          color: item.count > 0 ? '#c2410c' : '#64748b'
                        }}>
                          {item.count} pedidos
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontWeight: 600, color: item.count > 0 ? '#b45309' : '#94a3b8' }}>
                        ${item.totalAmount.toLocaleString('es-CO')}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedAsesorId(selectedAsesorId === item.asesor.id ? 'todas' : item.asesor.id)}
                          style={{
                            padding: '0.3rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: selectedAsesorId === item.asesor.id ? primaryColor : '#ffffff',
                            color: selectedAsesorId === item.asesor.id ? '#ffffff' : '#334155',
                            fontSize: '0.76rem',
                            fontWeight: 500,
                            cursor: 'pointer'
                          }}
                        >
                          {selectedAsesorId === item.asesor.id ? 'Viendo esta asesora ✓' : 'Filtrar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Listado de Pedidos Contra Entrega para Confirmar o Gestionar */}
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>
                  Listado de Clientes Pendientes ({filteredContraList.length}):
                </span>
                {selectedAsesorId !== 'todas' && (
                  <button
                    type="button"
                    onClick={() => setSelectedAsesorId('todas')}
                    style={{ background: '#f1f5f9', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', color: '#475569', cursor: 'pointer' }}
                  >
                    Ver todas las asesoras ✕
                  </button>
                )}
              </div>

              <div style={{ position: 'relative', width: '250px' }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Buscar cliente o teléfono..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.65rem 0.45rem 2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontFamily: "'Poppins', sans-serif" }}
                />
              </div>
            </div>

            {filteredContraList.length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎉</div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#0f172a', fontWeight: 600 }}>¡No hay pedidos contra entrega pendientes de confirmar!</h4>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>Todos los pedidos contra entrega han sido confirmados, despachados o cancelados.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {filteredContraList.map(p => {
                  const createdCol = parseToColombiaTime(p.created_at);
                  const daysAgo = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 3600 * 24));
                  const isOld = daysAgo >= 3;

                  // Nombre asesora
                  const cleanPhone = (p.linea_whatsapp || '').replace(/\D/g, '');
                  let asesorName = p.asesor || 'Asesora';
                  for (const [, item] of asesoresPhoneMap) {
                    if (item.phones.includes(cleanPhone)) {
                      asesorName = item.asesor.nombre;
                      break;
                    }
                  }

                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '12px',
                        border: isOld ? '1.5px solid #fed7aa' : '1px solid #e2e8f0',
                        background: isOld ? '#fffbf5' : '#ffffff',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.85rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '220px' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: '#ffedd5',
                          color: '#ea580c',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '0.92rem',
                          flexShrink: 0
                        }}>
                          {(p.cliente_nombre || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>{p.cliente_nombre}</span>
                            <span style={{ fontSize: '0.68rem', fontWeight: 500, padding: '0.1rem 0.4rem', borderRadius: '4px', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>
                              🚚 Contra Entrega
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 500,
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              background: p.estado === 'mensaje_enviado' ? '#fffbeb' : '#f1f5f9',
                              color: p.estado === 'mensaje_enviado' ? '#b45309' : '#475569'
                            }}>
                              {p.estado === 'mensaje_enviado' ? '⏱️ Esperando Resp.' : 'Por Confirmar'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                            <span>📱 {p.cliente_telefono || 'Sin teléfono'}</span>
                            <span>•</span>
                            <span>Asesora: <strong>{asesorName}</strong></span>
                            <span>•</span>
                            <span style={{ color: isOld ? '#dc2626' : '#64748b', fontWeight: isOld ? 500 : 400 }}>
                              {daysAgo === 0 ? 'Hoy' : daysAgo === 1 ? 'Ayer' : `Hace ${daysAgo} días`} ({createdCol.dateStr})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ minWidth: '130px', textAlign: 'right' }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
                          ${(p.total || 0).toLocaleString('es-CO')}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {p.ciudad || 'Colombia'}
                        </div>
                      </div>

                      {/* Botones de Acción */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {onSelectPedido && (
                          <button
                            type="button"
                            onClick={() => onSelectPedido(p)}
                            style={{ padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: '0.76rem', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            title="Ver detalles completos del pedido"
                          >
                            <Eye size={13} />
                            <span>Ver</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsAppChat(p)}
                          style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          title="Abrir WhatsApp para confirmar dirección"
                        >
                          <Phone size={13} />
                          <span>WhatsApp</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleConfirmContraOrder(p.id)}
                          style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: 'none', background: '#10b981', color: '#ffffff', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          title="Confirmar este pedido contra entrega"
                        >
                          <CheckCircle2 size={13} />
                          <span>✓ Confirmar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCancelContraOrder(p.id)}
                          style={{ padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff5f5', color: '#dc2626', fontSize: '0.76rem', fontWeight: 500, cursor: 'pointer' }}
                          title="Cancelar pedido si el cliente no quiso o no responde"
                        >
                          <XCircle size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
