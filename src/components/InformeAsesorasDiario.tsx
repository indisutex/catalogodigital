import React, { useState, useMemo, useEffect } from 'react';
import type { Pedido, Asesor, Configuracion } from '../types';
import { 
  Share2,
  Copy,
  Check,
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
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  Truck,
  XCircle,
  Eye,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Calendar,
  Zap,
  PhoneForwarded
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RecuperarLineaBloqueadaModal } from './RecuperarLineaBloqueadaModal';

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

  // Selector de Modo Principal: Auditoría Diaria vs Backlogs Acumulados
  const [mainViewMode, setMainViewMode] = useState<'diario' | 'contra_acumulado' | 'interesados_acumulado' | 'pendientes_pago_acumulado'>('diario');

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
  const [showHourlyTimeline, setShowHourlyTimeline] = useState<boolean>(false);
  const [showCustomDate, setShowCustomDate] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [showLineaBloqueadaModal, setShowLineaBloqueadaModal] = useState<boolean>(false);
  const [copiedMessage, setCopiedMessage] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

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

    // Polling de respaldo pasivo cada 60s (el push instantáneo ya lo hace Supabase Realtime)
    const pollInterval = setInterval(() => {
      onReloadData?.();
    }, 60000);

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

  // Detectar pedidos duplicados en el backlog (mismo teléfono y total enviados con menos de 5 min de diferencia por clics repetidos)
  const duplicateContraOrderIds = useMemo(() => {
    const ids = new Set<string>();
    const map = new Map<string, Array<{ id: string; time: number }>>();

    unconfirmedContraOrders.forEach(p => {
      const phone = (p.cliente_telefono || '').replace(/\D/g, '');
      const total = p.total || 0;
      if (!phone) return;
      const key = `${phone}_${total}`;
      const time = new Date(p.created_at).getTime();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ id: p.id, time });
    });

    map.forEach(list => {
      if (list.length > 1) {
        list.sort((a, b) => a.time - b.time);
        for (let i = 1; i < list.length; i++) {
          if (list[i].time - list[0].time <= 5 * 60 * 1000) {
            ids.add(list[i].id);
          }
        }
      }
    });

    return ids;
  }, [unconfirmedContraOrders]);

  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);

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

  // ── MODO 3: INTERESADOS / CARRITOS ABANDONADOS (ACUMULADO HISTÓRICO) ──
  const unconfirmedInteresados = useMemo(() => {
    const normalizePhone = (phone?: string | null) => {
      if (!phone) return '';
      const clean = phone.replace(/\D/g, '');
      return clean.length >= 10 ? clean.slice(-10) : clean;
    };

    let tempLeads = (leads || []).filter(l => {
      if (l.tenant_id && l.tenant_id !== tenantId) return false;
      if (l.estado === 'completado' || l.estado === 'contra_entrega' || l.estado === 'cancelado') return false;
      const cleanLeadPhone = normalizePhone(l.telefono);
      if (!cleanLeadPhone) return true;
      const hasOrder = (pedidos || []).some(p => {
        const cleanOrderPhone = normalizePhone(p.cliente_telefono);
        if (!cleanOrderPhone || cleanOrderPhone !== cleanLeadPhone) return false;
        const orderTime = new Date(p.created_at).getTime();
        const leadTime = new Date(l.created_at).getTime();
        return orderTime >= leadTime - 2 * 60 * 1000;
      });
      return !hasOrder;
    }).map(l => ({
      id: l.id,
      source: 'lead' as const,
      cliente_nombre: l.nombre || 'Cliente Interesado',
      cliente_telefono: l.telefono || '',
      ciudad: l.ciudad || '',
      linea_whatsapp: l.linea_whatsapp || '',
      total: Number(l.total || l.valor_estimado || 0),
      created_at: l.created_at,
      estado: l.estado || 'interesado',
      retargeting_estado: l.retargeting_estado || 'sin_contactar',
      productos: l.productos,
      raw: l
    }));

    const pedidosAbandonados = (pedidos || [])
      .filter(p => {
        if (p.tenant_id && p.tenant_id !== tenantId) return false;
        return p.estado === 'abandonado';
      })
      .map(p => ({
        id: p.id,
        source: 'pedido_abandonado' as const,
        cliente_nombre: p.cliente_nombre || 'Cliente',
        cliente_telefono: p.cliente_telefono || '',
        ciudad: p.ciudad || '',
        linea_whatsapp: p.linea_whatsapp || '',
        total: Number(p.total || 0),
        created_at: p.created_at,
        estado: 'abandonado',
        retargeting_estado: (p as any).retargeting_estado || 'sin_contactar',
        productos: p.productos,
        raw: p
      }));

    return [...tempLeads, ...pedidosAbandonados];
  }, [leads, pedidos, tenantId]);

  // Desglose de interesados por Asesora
  const interesadosBreakdownByAsesor = useMemo(() => {
    return asesores.map(a => {
      const aPhones = (a.telefono || '').split(',').map(p => p.replace(/\D/g, '')).filter(Boolean);
      const items = unconfirmedInteresados.filter(it => {
        const itemPhone = (it.linea_whatsapp || '').replace(/\D/g, '');
        return aPhones.includes(itemPhone);
      });
      const totalAmount = items.reduce((sum, it) => sum + (it.total || 0), 0);
      return {
        asesor: a,
        count: items.length,
        totalAmount,
        items
      };
    });
  }, [asesores, unconfirmedInteresados]);

  // Lista filtrada de interesados
  const filteredInteresadosList = useMemo(() => {
    let list = unconfirmedInteresados;
    if (selectedAsesorId !== 'todas') {
      const targetAsesor = asesores.find(a => a.id === selectedAsesorId);
      if (targetAsesor) {
        const aPhones = (targetAsesor.telefono || '').split(',').map(p => p.replace(/\D/g, '')).filter(Boolean);
        list = list.filter(it => {
          const itemPhone = (it.linea_whatsapp || '').replace(/\D/g, '');
          return aPhones.includes(itemPhone);
        });
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(it => 
        (it.cliente_nombre || '').toLowerCase().includes(q) ||
        (it.cliente_telefono || '').includes(q) ||
        (it.ciudad || '').toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [unconfirmedInteresados, selectedAsesorId, asesores, searchQuery]);

  // ── MODO 4: PENDIENTES POR PAGO / TRANSFERENCIA (ACUMULADO HISTÓRICO) ──
  const unconfirmedPendientesPago = useMemo(() => {
    return (pedidos || []).filter(p => {
      if (p.tenant_id && p.tenant_id !== tenantId) return false;
      const mp = (p.metodo_pago || '').toLowerCase();
      const mod = ((p as any).modalidad_pago || '').toLowerCase();
      const est = (p.estado || '').toLowerCase();
      const isContra = mp.includes('contra') || mod.includes('contra') || est.includes('contra');
      const isCompleted = est === 'confirmado' || est === 'contra_confirmado' || est === 'despachado' || est === 'contra_despachado' || est === 'completado' || est === 'entregado_pagado' || est === 'cancelado' || est === 'abandonado';
      return !isContra && !isCompleted;
    });
  }, [pedidos, tenantId]);

  // Desglose de pendientes por pago por Asesora
  const pendientesPagoBreakdownByAsesor = useMemo(() => {
    return asesores.map(a => {
      const aPhones = (a.telefono || '').split(',').map(p => p.replace(/\D/g, '')).filter(Boolean);
      const orders = unconfirmedPendientesPago.filter(p => {
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
  }, [asesores, unconfirmedPendientesPago]);

  // Lista filtrada de pendientes por pago
  const filteredPendientesPagoList = useMemo(() => {
    let list = unconfirmedPendientesPago;
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
  }, [unconfirmedPendientesPago, selectedAsesorId, asesores, searchQuery]);

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

  const handleCleanAllDuplicates = async () => {
    if (duplicateContraOrderIds.size === 0) return;
    if (!confirm(`Se detectaron ${duplicateContraOrderIds.size} pedidos duplicados por toques repetidos en la web.\n\n¿Deseas descartar estos ${duplicateContraOrderIds.size} duplicados automáticamente para conservar únicamente 1 pedido original por cliente?`)) {
      return;
    }

    setIsCleaningDuplicates(true);
    try {
      const idsToCancel = Array.from(duplicateContraOrderIds);
      const { error } = await supabase
        .from('pedidos')
        .update({ estado: 'cancelado' })
        .in('id', idsToCancel);

      if (!error) {
        if (onReloadData) onReloadData();
        alert(`Se descartaron con éxito los ${idsToCancel.length} pedidos duplicados.`);
      } else {
        alert('Hubo un error al descartar duplicados: ' + error.message);
      }
    } catch (err) {
      console.error('Error al limpiar duplicados:', err);
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const handleConfirmPendientePago = async (orderId: string) => {
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
      console.error('Error al confirmar pedido pendiente de pago:', err);
    }
  };

  const handleCancelPendientePago = async (orderId: string) => {
    if (!confirm('¿Deseas cancelar este pedido pendiente de pago?')) return;
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
      console.error('Error al cancelar pedido pendiente de pago:', err);
    }
  };

  const handleContactarInteresado = async (item: any) => {
    try {
      const nowIso = new Date().toISOString();
      if (item.source === 'lead') {
        const { error } = await supabase
          .from('leads')
          .update({
            retargeting_estado: 'contactado',
            atendido: true,
            fecha_envio_mensaje: nowIso
          })
          .eq('id', item.id);
        if (!error) {
          if (onUpdateLeadStatus) onUpdateLeadStatus(item.id, 'contactado');
          if (onReloadData) onReloadData();
        }
      } else {
        const { error } = await supabase
          .from('pedidos')
          .update({
            retargeting_estado: 'contactado',
            atendido: true,
            fecha_envio_mensaje: nowIso
          })
          .eq('id', item.id);
        if (!error) {
          if (onReloadData) onReloadData();
        }
      }
    } catch (err) {
      console.error('Error al contactar interesado:', err);
    }
  };

  const handleDescartarInteresado = async (item: any) => {
    if (!confirm(`¿Deseas descartar este cliente interesado (${item.cliente_nombre})?`)) return;
    try {
      if (item.source === 'lead') {
        const { error } = await supabase
          .from('leads')
          .update({
            estado: 'cancelado',
            retargeting_estado: 'cancelado'
          })
          .eq('id', item.id);
        if (!error && onReloadData) onReloadData();
      } else {
        const { error } = await supabase
          .from('pedidos')
          .update({
            estado: 'cancelado'
          })
          .eq('id', item.id);
        if (!error && onReloadData) onReloadData();
      }
    } catch (err) {
      console.error('Error al descartar interesado:', err);
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

  // Total acumulado sin atender en todo el histórico (disponible siempre para KPIs y badges)
  const allHistorySinAtender = useMemo(() => {
    return allInteractions.filter(it => !it.atendido);
  }, [allInteractions]);

  const allHistorySinAtenderCount = allHistorySinAtender.length;
  const allHistorySinAtenderValor = useMemo(() => {
    return allHistorySinAtender.reduce((acc, it) => acc + (it.total || 0), 0);
  }, [allHistorySinAtender]);

  // Si está seleccionado el modo Histórico completo
  const isHistorico = selectedDate === 'historico';

  // Filtrar interacciones por Fecha seleccionada o Todo el Histórico
  const dayInteractions = useMemo(() => {
    if (isHistorico) return allInteractions;
    return allInteractions.filter(item => item.colDateStr === selectedDate);
  }, [allInteractions, selectedDate, isHistorico]);

  // Filtrar interacciones por Asesora seleccionada
  const dayAsesorInteractions = useMemo(() => {
    if (selectedAsesorId === 'todas') return dayInteractions;
    return dayInteractions.filter(item => item.asesorId === selectedAsesorId);
  }, [dayInteractions, selectedAsesorId]);

  // Interacciones que llegaron ANTES o HASTA la hora de corte seleccionada (ej: 16:00 = 4:00 PM)
  const interactionsUpToCutoff = useMemo(() => {
    if (isHistorico && cutoffHour === 24) return dayAsesorInteractions;
    return dayAsesorInteractions.filter(item => {
      return item.colHour < cutoffHour || (item.colHour === cutoffHour && item.colMinute === 0);
    });
  }, [dayAsesorInteractions, cutoffHour, isHistorico]);

  // Clasificar según estado de atención a la hora de corte o histórico
  const { atendidosAtCutoff, sinAtenderAtCutoff } = useMemo(() => {
    const atendidos: ChatInteractionItem[] = [];
    const sinAtender: ChatInteractionItem[] = [];

    interactionsUpToCutoff.forEach(item => {
      if (!item.atendido) {
        sinAtender.push(item);
      } else {
        if (isHistorico) {
          atendidos.push(item);
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
      }
    });

    return {
      atendidosAtCutoff: atendidos,
      sinAtenderAtCutoff: sinAtender
    };
  }, [interactionsUpToCutoff, cutoffHour, selectedDate, isHistorico]);

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

  // Comparativa por asesora para el día o histórico y la hora de corte seleccionados
  const comparativaAsesores = useMemo(() => {
    return asesores.map(a => {
      const asesorItems = dayInteractions.filter(it => it.asesorId === a.id);
      const upToCutoff = isHistorico && cutoffHour === 24
        ? asesorItems
        : asesorItems.filter(it => it.colHour < cutoffHour || (it.colHour === cutoffHour && it.colMinute === 0));
      
      const sinAtenderList: ChatInteractionItem[] = [];
      const atendidosList: ChatInteractionItem[] = [];

      upToCutoff.forEach(item => {
        if (!item.atendido) {
          sinAtenderList.push(item);
        } else {
          if (isHistorico) {
            atendidosList.push(item);
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
  }, [asesores, dayInteractions, cutoffHour, selectedDate, isHistorico]);

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
      if (isHistorico) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return (a.colHour * 60 + a.colMinute) - (b.colHour * 60 + b.colMinute);
    });
  }, [filterStatusTab, sinAtenderAtCutoff, atendidosAtCutoff, interactionsUpToCutoff, searchQuery, isHistorico]);

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

  const handleOpenWhatsAppChat = (item: ChatInteractionItem | any, modeOverride?: 'contra' | 'lead' | 'pago') => {
    const rawPhone = item.clienteTelefono || item.cliente_telefono || item.telefono || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
    const name = item.clienteNombre || item.cliente_nombre || item.nombre || 'Cliente';
    const shopName = configuracion?.nombre_negocio || 'la tienda';
    const total = item.total ? `$${Number(item.total).toLocaleString('es-CO')}` : '';

    let textStr = `¡Hola ${name}! 👋 Te escribo de ${shopName}. ¿Cómo estás?`;
    if (modeOverride === 'contra' || mainViewMode === 'contra_acumulado') {
      textStr = `¡Hola ${name}! 👋 Te escribimos de ${shopName} para confirmar tu pedido con pago Contra Entrega ${total ? `por valor de ${total}` : ''}. ¿Nos confirmas por favor si tus datos y dirección de entrega están correctos para programar el despacho?`;
    } else if (modeOverride === 'lead' || mainViewMode === 'interesados_acumulado') {
      textStr = `¡Hola ${name}! 👋 Te saludamos de ${shopName}. Vimos que guardaste unos productos en tu carrito y no completaste tu orden. ¿Te gustaría que te ayudemos a finalizar tu compra hoy?`;
    } else if (modeOverride === 'pago' || mainViewMode === 'pendientes_pago_acumulado') {
      textStr = `¡Hola ${name}! 👋 Te escribimos de ${shopName} respecto a tu pedido ${total ? `por ${total}` : ''}. Te recordamos que estamos atentos a tu comprobante de transferencia para despacharte de inmediato. ¿Tienes alguna pregunta con las cuentas de pago?`;
    }

    const text = encodeURIComponent(textStr);
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

    let exportItems: any[] = [];
    if (mainViewMode === 'diario') exportItems = interactionsUpToCutoff;
    else if (mainViewMode === 'contra_acumulado') exportItems = unconfirmedContraOrders;
    else if (mainViewMode === 'interesados_acumulado') exportItems = unconfirmedInteresados;
    else if (mainViewMode === 'pendientes_pago_acumulado') exportItems = unconfirmedPendientesPago;

    const rows = exportItems.map((it: any) => {
      const isSinAtender = mainViewMode === 'diario' 
        ? sinAtenderAtCutoff.some(s => s.id === it.id)
        : true;
      return [
        `"${it.colDateStr || it.created_at}"`,
        `"${it.colTimeFormatted || ''}"`,
        `"${(it.clienteNombre || it.cliente_nombre || it.nombre || '').replace(/"/g, '""')}"`,
        `"${it.clienteTelefono || it.cliente_telefono || it.telefono || ''}"`,
        `"${(it.asesorNombre || it.asesor || '').replace(/"/g, '""')}"`,
        `"${it.source === 'pedido' || it.modalidad_pago ? 'Contra Entrega' : it.source === 'lead' ? 'Lead' : 'Pedido'}"`,
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
    let baseDate = selectedDate;
    if (selectedDate === 'historico') baseDate = hoyColombiaStr;
    const [y, m, d] = baseDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);
    dateObj.setDate(dateObj.getDate() + days);
    setSelectedDate(parseToColombiaTime(dateObj).dateStr);
  };

  const shareData = useMemo(() => {
    const shopName = configuracion?.nombre_negocio || 'Indisutex';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const targetTenant = tenantId || 'saramantha';
    const directLink = `${baseUrl}/${targetTenant}/reporte?pin=1107`;

    let dateTitle = '';
    if (selectedDate === 'historico') {
      dateTitle = 'Todo el Histórico Acumulado';
    } else if (selectedDate === hoyColombiaStr) {
      dateTitle = `Hoy (${selectedDate}) - Corte de las ${cutoffHour > 12 ? `${cutoffHour - 12}:00 PM` : `${cutoffHour}:00 AM`}`;
    } else {
      dateTitle = `${selectedDate} - Corte de las ${cutoffHour > 12 ? `${cutoffHour - 12}:00 PM` : `${cutoffHour}:00 AM`}`;
    }

    let msg = `📊 *INFORME EJECUTIVO - AUDITORÍA DE VENTAS Y ASESORAS*\n`;
    msg += `🏢 *Empresa:* ${shopName}\n`;
    msg += `📅 *Período:* ${dateTitle}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (mainViewMode === 'diario') {
      msg += `📥 *Total Chats Recibidos:* ${totalRecibidos}\n`;
      msg += `✅ *Chats Atendidos:* ${totalAtendidos} (${porcentajeAtendidos}% de efectividad)\n`;
      msg += `⚠️ *Chats Sin Atender:* ${totalSinAtender} (${porcentajeSinAtender}%)\n`;
      msg += `💰 *Ventas en Riesgo:* $${valorSinAtender.toLocaleString('es-CO')}\n\n`;

      msg += `👥 *RENDIMIENTO POR ASESORA:*\n`;
      comparativaAsesores.forEach(ca => {
        const pct = ca.totalRecibidos > 0 ? Math.round((ca.atendidos / ca.totalRecibidos) * 100) : 0;
        msg += `• *${ca.asesor.nombre}:* ${ca.sinAtender} sin atender | ${ca.atendidos} atendidos (${pct}%) | $${ca.valorSinAtender.toLocaleString('es-CO')} en riesgo\n`;
      });
    } else if (mainViewMode === 'contra_acumulado') {
      const totalMonto = unconfirmedContraOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      msg += `🚚 *BACKLOG CONTRA ENTREGA SIN CONFIRMAR*\n`;
      msg += `📦 *Total Pedidos Pendientes:* ${unconfirmedContraOrders.length}\n`;
      msg += `💰 *Monto Acumulado:* $${totalMonto.toLocaleString('es-CO')}\n\n`;
      msg += `👥 *PENDIENTES POR ASESORA:*\n`;
      contraBreakdownByAsesor.forEach(ca => {
        msg += `• *${ca.asesor.nombre}:* ${ca.count} pedidos ($${ca.totalAmount.toLocaleString('es-CO')})\n`;
      });
    } else if (mainViewMode === 'interesados_acumulado') {
      const totalMonto = unconfirmedInteresados.reduce((sum, o) => sum + (o.total || 0), 0);
      msg += `✨ *INTERESADAS Y CARRITOS ABANDONADOS*\n`;
      msg += `🛒 *Total Clientes por Recuperar:* ${unconfirmedInteresados.length}\n`;
      msg += `💰 *Ventas Potenciales:* $${totalMonto.toLocaleString('es-CO')}\n\n`;
      msg += `👥 *POR ASESORA:*\n`;
      interesadosBreakdownByAsesor.forEach(ia => {
        msg += `• *${ia.asesor.nombre}:* ${ia.count} carritos ($${ia.totalAmount.toLocaleString('es-CO')})\n`;
      });
    } else if (mainViewMode === 'pendientes_pago_acumulado') {
      const totalMonto = unconfirmedPendientesPago.reduce((sum, o) => sum + (o.total || 0), 0);
      msg += `⏳ *PENDIENTES POR PAGO / TRANSFERENCIA*\n`;
      msg += `💳 *Total Pedidos Pendientes:* ${unconfirmedPendientesPago.length}\n`;
      msg += `💰 *Monto en Espera de Pago:* $${totalMonto.toLocaleString('es-CO')}\n\n`;
      msg += `👥 *POR ASESORA:*\n`;
      pendientesPagoBreakdownByAsesor.forEach(pa => {
        msg += `• *${pa.asesor.nombre}:* ${pa.count} pedidos ($${pa.totalAmount.toLocaleString('es-CO')})\n`;
      });
    }

    msg += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📲 *Ver informe interactivo para dueños:*\n${directLink}\n`;
    msg += `🔐 _Acceso con PIN de seguridad: 1107_`;

    return { text: msg, link: directLink };
  }, [
    configuracion,
    tenantId,
    selectedDate,
    hoyColombiaStr,
    cutoffHour,
    mainViewMode,
    totalRecibidos,
    totalAtendidos,
    totalSinAtender,
    porcentajeAtendidos,
    porcentajeSinAtender,
    valorSinAtender,
    comparativaAsesores,
    unconfirmedContraOrders,
    contraBreakdownByAsesor,
    unconfirmedInteresados,
    interesadosBreakdownByAsesor,
    unconfirmedPendientesPago,
    pendientesPagoBreakdownByAsesor
  ]);

  const friendlyDateStr = useMemo(() => {
    if (selectedDate === 'historico') return 'Todo el Histórico Acumulado';
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
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          {/* Tab 1: Diario */}
          <button
            type="button"
            onClick={() => setMainViewMode('diario')}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '10px',
              border: mainViewMode === 'diario' ? `1.5px solid ${primaryColor}` : '1px solid #cbd5e1',
              background: mainViewMode === 'diario' ? 'rgba(0, 166, 249, 0.08)' : '#ffffff',
              color: mainViewMode === 'diario' ? primaryColor : '#475569',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontFamily: "'Poppins', sans-serif"
            }}
          >
            <Clock size={15} />
            <span>Auditoría Diaria por Horas</span>
          </button>

          {/* Tab 2: Contra Entrega */}
          <button
            type="button"
            onClick={() => setMainViewMode('contra_acumulado')}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '10px',
              border: mainViewMode === 'contra_acumulado' ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
              background: mainViewMode === 'contra_acumulado' ? '#fff7ed' : '#ffffff',
              color: mainViewMode === 'contra_acumulado' ? '#ea580c' : '#475569',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontFamily: "'Poppins', sans-serif"
            }}
          >
            <Truck size={15} color="#ea580c" />
            <span>🚚 Contra Entrega Sin Confirmar</span>
            <span style={{
              background: '#ea580c',
              color: '#ffffff',
              padding: '0.1rem 0.45rem',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 600
            }}>
              {unconfirmedContraOrders.length}
            </span>
          </button>

          {/* Tab 3: Interesadas / Carritos */}
          <button
            type="button"
            onClick={() => setMainViewMode('interesados_acumulado')}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '10px',
              border: mainViewMode === 'interesados_acumulado' ? '1.5px solid #9333ea' : '1px solid #cbd5e1',
              background: mainViewMode === 'interesados_acumulado' ? '#faf5ff' : '#ffffff',
              color: mainViewMode === 'interesados_acumulado' ? '#9333ea' : '#475569',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontFamily: "'Poppins', sans-serif"
            }}
          >
            <Sparkles size={15} color="#9333ea" />
            <span>✨ Interesadas / Carritos</span>
            <span style={{
              background: '#9333ea',
              color: '#ffffff',
              padding: '0.1rem 0.45rem',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 600
            }}>
              {unconfirmedInteresados.length}
            </span>
          </button>

          {/* Tab 4: Pendientes por Pago */}
          <button
            type="button"
            onClick={() => setMainViewMode('pendientes_pago_acumulado')}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '10px',
              border: mainViewMode === 'pendientes_pago_acumulado' ? '1.5px solid #d97706' : '1px solid #cbd5e1',
              background: mainViewMode === 'pendientes_pago_acumulado' ? '#fffbeb' : '#ffffff',
              color: mainViewMode === 'pendientes_pago_acumulado' ? '#d97706' : '#475569',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontFamily: "'Poppins', sans-serif"
            }}
          >
            <CreditCard size={15} color="#d97706" />
            <span>⏳ Pendientes por Pago</span>
            <span style={{
              background: '#d97706',
              color: '#ffffff',
              padding: '0.1rem 0.45rem',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 600
            }}>
              {unconfirmedPendientesPago.length}
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
            onClick={() => setShowShareModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.95rem',
              borderRadius: '10px',
              border: 'none',
              background: '#16a34a',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.28)',
              fontFamily: "'Poppins', sans-serif"
            }}
            title="Compartir resumen y enlace a los dueños por WhatsApp"
          >
            <Share2 size={14} />
            <span>📲 Compartir a Dueños</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLineaBloqueadaModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.95rem',
              borderRadius: '10px',
              border: '1px solid #fed7aa',
              background: '#fff7ed',
              color: '#c2410c',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif"
            }}
            title="Recuperar y contactar clientes de una línea de WhatsApp bloqueada"
          >
            <PhoneForwarded size={14} color="#ea580c" />
            <span>🚨 Línea Bloqueada</span>
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
      {mainViewMode === 'diario' && (
        <>
          {/* Centro de Control Rápido Anti-Bobos */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '1.25rem 1.5rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            fontFamily: "'Poppins', sans-serif"
          }}>
            {/* Fila 1: Selector de Período y Hora de Control */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}>
              {/* Botones de Período */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 500, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '0.2rem' }}>
                  📅 Período:
                </span>

                {/* Hoy */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(hoyColombiaStr);
                    setShowCustomDate(false);
                  }}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: '10px',
                    border: selectedDate === hoyColombiaStr ? `1.5px solid ${primaryColor}` : '1px solid #cbd5e1',
                    background: selectedDate === hoyColombiaStr ? 'rgba(0, 166, 249, 0.08)' : '#ffffff',
                    color: selectedDate === hoyColombiaStr ? primaryColor : '#334155',
                    fontSize: '0.82rem',
                    fontWeight: selectedDate === hoyColombiaStr ? 600 : 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontFamily: "'Poppins', sans-serif",
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Zap size={14} color={selectedDate === hoyColombiaStr ? primaryColor : '#64748b'} />
                  <span>Hoy</span>
                </button>

                {/* Ayer */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(ayerColombiaStr);
                    setShowCustomDate(false);
                  }}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: '10px',
                    border: selectedDate === ayerColombiaStr ? `1.5px solid ${primaryColor}` : '1px solid #cbd5e1',
                    background: selectedDate === ayerColombiaStr ? 'rgba(0, 166, 249, 0.08)' : '#ffffff',
                    color: selectedDate === ayerColombiaStr ? primaryColor : '#334155',
                    fontSize: '0.82rem',
                    fontWeight: selectedDate === ayerColombiaStr ? 600 : 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontFamily: "'Poppins', sans-serif",
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Clock size={14} color={selectedDate === ayerColombiaStr ? primaryColor : '#64748b'} />
                  <span>Ayer</span>
                </button>

                {/* Todo el Histórico */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate('historico');
                    setCutoffHour(24);
                    setShowCustomDate(false);
                  }}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: '10px',
                    border: isHistorico ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                    background: isHistorico ? '#faf5ff' : '#ffffff',
                    color: isHistorico ? '#7c3aed' : '#334155',
                    fontSize: '0.82rem',
                    fontWeight: isHistorico ? 600 : 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontFamily: "'Poppins', sans-serif",
                    transition: 'all 0.15s ease'
                  }}
                  title="Ver acumulado de todos los chats de la historia"
                >
                  <span>♾️ Todo el Histórico</span>
                  {allHistorySinAtenderCount > 0 && (
                    <span style={{
                      background: '#dc2626',
                      color: '#ffffff',
                      borderRadius: '10px',
                      padding: '0.1rem 0.45rem',
                      fontSize: '0.7rem',
                      fontWeight: 600
                    }}>
                      {allHistorySinAtenderCount} sin atender
                    </span>
                  )}
                </button>

                {/* Otra Fecha */}
                <button
                  type="button"
                  onClick={() => setShowCustomDate(!showCustomDate)}
                  style={{
                    padding: '0.45rem 0.8rem',
                    borderRadius: '10px',
                    border: !isHistorico && selectedDate !== hoyColombiaStr && selectedDate !== ayerColombiaStr ? `1.5px solid ${primaryColor}` : '1px solid #cbd5e1',
                    background: !isHistorico && selectedDate !== hoyColombiaStr && selectedDate !== ayerColombiaStr ? 'rgba(0, 166, 249, 0.08)' : '#ffffff',
                    color: !isHistorico && selectedDate !== hoyColombiaStr && selectedDate !== ayerColombiaStr ? primaryColor : '#475569',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontFamily: "'Poppins', sans-serif"
                  }}
                >
                  <Calendar size={14} />
                  <span>{!isHistorico && selectedDate !== hoyColombiaStr && selectedDate !== ayerColombiaStr ? selectedDate : 'Otra Fecha'}</span>
                  <ChevronDown size={13} />
                </button>
              </div>

              {/* Hora de Corte */}
              {!isHistorico && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 500, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '0.2rem' }}>
                    ⏱️ Corte:
                  </span>

                  <button
                    type="button"
                    onClick={() => setCutoffHour(16)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '10px',
                      border: cutoffHour === 16 ? `1.5px solid ${primaryColor}` : '1px solid #cbd5e1',
                      background: cutoffHour === 16 ? 'rgba(0, 166, 249, 0.08)' : '#ffffff',
                      color: cutoffHour === 16 ? primaryColor : '#334155',
                      fontSize: '0.8rem',
                      fontWeight: cutoffHour === 16 ? 600 : 500,
                      cursor: 'pointer',
                      fontFamily: "'Poppins', sans-serif"
                    }}
                  >
                    ⭐ 4:00 PM (Control)
                  </button>

                  <button
                    type="button"
                    onClick={() => setCutoffHour(24)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '10px',
                      border: cutoffHour === 24 ? `1.5px solid ${primaryColor}` : '1px solid #cbd5e1',
                      background: cutoffHour === 24 ? 'rgba(0, 166, 249, 0.08)' : '#ffffff',
                      color: cutoffHour === 24 ? primaryColor : '#334155',
                      fontSize: '0.8rem',
                      fontWeight: cutoffHour === 24 ? 600 : 500,
                      cursor: 'pointer',
                      fontFamily: "'Poppins', sans-serif"
                    }}
                  >
                    🌙 Cierre del Día
                  </button>

                  {/* Selector desplegable de más horas */}
                  <select
                    value={cutoffHour}
                    onChange={e => setCutoffHour(Number(e.target.value))}
                    style={{
                      padding: '0.42rem 0.65rem',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      color: '#475569',
                      fontFamily: "'Poppins', sans-serif",
                      cursor: 'pointer'
                    }}
                  >
                    <option value={9}>09:00 AM</option>
                    <option value={10}>10:00 AM</option>
                    <option value={11}>11:00 AM</option>
                    <option value={12}>12:00 PM</option>
                    <option value={13}>01:00 PM</option>
                    <option value={14}>02:00 PM</option>
                    <option value={15}>03:00 PM</option>
                    <option value={16}>04:00 PM</option>
                    <option value={17}>05:00 PM</option>
                    <option value={18}>06:00 PM</option>
                    <option value={19}>07:00 PM</option>
                    <option value={20}>08:00 PM</option>
                    <option value={24}>Todo el día</option>
                  </select>
                </div>
              )}
            </div>

            {/* Selector de Fecha desplegable (si el usuario presionó 'Otra Fecha') */}
            {showCustomDate && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#f8fafc',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                width: 'fit-content'
              }}>
                <button
                  type="button"
                  onClick={() => handleStepDay(-1)}
                  style={{ padding: '0.35rem 0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', color: '#475569' }}
                  title="Día anterior"
                >
                  <ChevronLeft size={14} />
                </button>
                <input
                  type="date"
                  value={selectedDate === 'historico' ? hoyColombiaStr : selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  style={{
                    padding: '0.35rem 0.6rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    fontFamily: "'Poppins', sans-serif",
                    color: '#1e293b'
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleStepDay(1)}
                  style={{ padding: '0.35rem 0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', color: '#475569' }}
                  title="Día siguiente"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            {/* Fila 2: Filtro Rápido de Asesoras */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              flexWrap: 'wrap',
              paddingTop: '0.75rem',
              borderTop: '1px solid #f1f5f9'
            }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 500, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '0.2rem' }}>
                👩‍💼 Asesora:
              </span>

              {/* Botón Ambas / Todas */}
              <button
                type="button"
                onClick={() => setSelectedAsesorId('todas')}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '20px',
                  border: selectedAsesorId === 'todas' ? `1.5px solid ${primaryColor}` : '1px solid #cbd5e1',
                  background: selectedAsesorId === 'todas' ? 'rgba(0, 166, 249, 0.08)' : '#ffffff',
                  color: selectedAsesorId === 'todas' ? primaryColor : '#334155',
                  fontSize: '0.82rem',
                  fontWeight: selectedAsesorId === 'todas' ? 600 : 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                <Users size={14} />
                <span>👥 Todas las Asesoras</span>
              </button>

              {/* Botón para cada Asesora */}
              {asesores.map(a => {
                const isSelected = selectedAsesorId === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedAsesorId(a.id)}
                    style={{
                      padding: '0.35rem 0.8rem',
                      borderRadius: '20px',
                      border: isSelected ? `1.5px solid ${primaryColor}` : '1px solid #cbd5e1',
                      background: isSelected ? 'rgba(0, 166, 249, 0.08)' : '#ffffff',
                      color: isSelected ? primaryColor : '#334155',
                      fontSize: '0.82rem',
                      fontWeight: isSelected ? 600 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontFamily: "'Poppins', sans-serif"
                    }}
                  >
                    {a.foto_url ? (
                      <img src={a.foto_url} alt={a.nombre} style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 600 }}>
                        {a.nombre.charAt(0)}
                      </div>
                    )}
                    <span>{a.nombre}</span>
                  </button>
                );
              })}
            </div>

            {/* Subtítulo aclaratorio simple */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.8rem',
              color: isHistorico ? '#6b21a8' : '#475569',
              background: isHistorico ? '#faf5ff' : '#f8fafc',
              border: isHistorico ? '1px solid #e9d5ff' : '1px solid #f1f5f9',
              padding: '0.45rem 0.8rem',
              borderRadius: '8px'
            }}>
              <Sparkles size={14} color={isHistorico ? '#7c3aed' : primaryColor} />
              <span>
                {isHistorico ? (
                  <>Auditoría acumulada de <strong>TODO EL HISTÓRICO</strong> ({allInteractions.length} clientes y leads en total):</>
                ) : (
                  <>Auditoría para <strong>{friendlyDateStr}</strong> al corte de las <strong>{cutoffHour === 24 ? 'Cierre del día' : `${cutoffHour % 12 || 12}:00 ${cutoffHour >= 12 ? 'PM' : 'AM'}`}</strong>:</>
                )}
              </span>
            </div>
          </div>

          {/* 3 Tarjetas KPI Anti-Bobos */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1rem',
            fontFamily: "'Poppins', sans-serif"
          }}>
            {/* Tarjeta 1: Recibidos */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '1.25rem 1.4rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 500, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  📬 Chats Recibidos
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={16} color="#64748b" />
                </div>
              </div>
              <div style={{ fontSize: '2.4rem', fontWeight: 600, color: '#0f172a', lineHeight: 1, margin: '0.3rem 0' }}>
                {totalRecibidos}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 400 }}>
                {isHistorico 
                  ? 'Total de clientes y leads en todo el histórico' 
                  : `Clientes que entraron hasta las ${cutoffHour === 24 ? '23:59' : `${cutoffHour % 12 || 12}:00 ${cutoffHour >= 12 ? 'PM' : 'AM'}`}`}
              </div>
            </div>

            {/* Tarjeta 2: Atendidos */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '1.25rem 1.4rem',
              border: '1px solid #bbf7d0',
              boxShadow: '0 2px 8px rgba(16,185,129,0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 500, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ✅ Chats Atendidos
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={16} color="#16a34a" />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', margin: '0.3rem 0' }}>
                <span style={{ fontSize: '2.4rem', fontWeight: 600, color: '#15803d', lineHeight: 1 }}>{totalAtendidos}</span>
                <span style={{ fontSize: '1rem', fontWeight: 500, color: '#16a34a' }}>({porcentajeAtendidos}%)</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 400 }}>
                Respondidos oportunamente por el equipo
              </div>
            </div>

            {/* Tarjeta 3: Sin Atender (Semáforo Dinámico: Verde si 0, Rojo Alerta si > 0) */}
            <div style={{
              background: totalSinAtender > 0 ? '#fef2f2' : '#f0fdf4',
              borderRadius: '16px',
              padding: '1.25rem 1.4rem',
              border: totalSinAtender > 0 ? '1.5px solid #fca5a5' : '1px solid #86efac',
              boxShadow: totalSinAtender > 0 ? '0 2px 10px rgba(239,68,68,0.08)' : '0 2px 8px rgba(16,185,129,0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 600, color: totalSinAtender > 0 ? '#991b1b' : '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {totalSinAtender > 0 ? '🚨 Sin Atender' : '🎉 Estado General'}
                </span>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: totalSinAtender > 0 ? '#fee2e2' : '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {totalSinAtender > 0 ? <AlertTriangle size={16} color="#dc2626" /> : <CheckCircle2 size={16} color="#16a34a" />}
                </div>
              </div>

              {totalSinAtender > 0 ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', margin: '0.3rem 0' }}>
                    <span style={{ fontSize: '2.4rem', fontWeight: 600, color: '#b91c1c', lineHeight: 1 }}>{totalSinAtender}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#dc2626' }}>({porcentajeSinAtender}% pendientes)</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#991b1b', fontWeight: 500 }}>
                    ⚠️ ${valorSinAtender.toLocaleString('es-CO')} en ventas en riesgo
                    {!isHistorico && promedioEsperaMins > 0 ? ` • Espera prom: ${formatMinsToDuration(promedioEsperaMins)}` : ''}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#15803d', margin: '0.3rem 0', lineHeight: 1.2 }}>
                    ¡Todo al día! ✓
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 400 }}>
                    {isHistorico ? 'Cero chats pendientes en el histórico' : `Ningún cliente esperando a las ${cutoffHour % 12 || 12}:00 ${cutoffHour >= 12 ? 'PM' : 'AM'}`}
                  </div>
                </>
              )}

              {/* Acceso rápido al histórico si no está en histórico */}
              {!isHistorico && (
                <div style={{
                  marginTop: '0.65rem',
                  paddingTop: '0.5rem',
                  borderTop: totalSinAtender > 0 ? '1px dashed #fca5a5' : '1px dashed #bbf7d0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.74rem'
                }}>
                  <span style={{ color: '#475569' }}>Total en histórico:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate('historico');
                      setCutoffHour(24);
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      color: '#7c3aed',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      fontFamily: "'Poppins', sans-serif"
                    }}
                  >
                    <span>{allHistorySinAtenderCount} sin atender (${allHistorySinAtenderValor.toLocaleString('es-CO')})</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Comparativa de Asesoras (Tarjetas Visuales Anti-Bobos) */}
          {selectedAsesorId === 'todas' && (
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '1.25rem 1.5rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              fontFamily: "'Poppins', sans-serif"
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Users size={18} color={primaryColor} /> 
                    <span>Comparativa: ¿Quién tiene chats pendientes?</span>
                  </h3>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    {isHistorico ? 'Estado acumulado de todo el histórico' : `Corte de auditoría a las ${cutoffHour % 12 || 12}:00 ${cutoffHour >= 12 ? 'PM' : 'AM'}`}
                  </p>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1rem'
              }}>
                {comparativaAsesores.map(c => {
                  const hasSinAtender = c.sinAtender > 0;
                  const phone = (c.asesor.telefono || '').split(',')[0].trim();
                  return (
                    <div
                      key={c.asesor.id}
                      style={{
                        borderRadius: '14px',
                        border: hasSinAtender ? '1.5px solid #fca5a5' : '1px solid #bbf7d0',
                        background: hasSinAtender ? '#fffafa' : '#f0fdf4',
                        padding: '1.15rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.85rem'
                      }}
                    >
                      {/* Header Asesora */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {c.asesor.foto_url ? (
                            <img
                              src={c.asesor.foto_url}
                              alt={c.asesor.nombre}
                              style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}
                            />
                          ) : (
                            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '1rem' }}>
                              {c.asesor.nombre.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.92rem' }}>{c.asesor.nombre}</div>
                            {phone && (
                              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                📱 {phone}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Badge de Estado Gigante */}
                        <span style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          background: hasSinAtender ? '#fee2e2' : '#dcfce7',
                          color: hasSinAtender ? '#b91c1c' : '#15803d',
                          border: hasSinAtender ? '1px solid #fca5a5' : '1px solid #86efac'
                        }}>
                          {hasSinAtender ? `🚨 ${c.sinAtender} sin atender` : '✓ Al día (0)'}
                        </span>
                      </div>

                      {/* Métricas de la Asesora */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.5rem',
                        background: '#ffffff',
                        padding: '0.75rem',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500, textTransform: 'uppercase' }}>Recibidos</div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 600, color: '#0f172a', marginTop: '0.15rem' }}>{c.totalRecibidos}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: '#166534', fontWeight: 500, textTransform: 'uppercase' }}>Atendidos</div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 600, color: '#15803d', marginTop: '0.15rem' }}>
                            {c.atendidos}
                            {c.totalRecibidos > 0 && (
                              <span style={{ fontSize: '0.68rem', fontWeight: 500, color: '#16a34a', display: 'block' }}>
                                {100 - c.pctSinAtender}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: hasSinAtender ? '#b45309' : '#64748b', fontWeight: 500, textTransform: 'uppercase' }}>En Riesgo</div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: hasSinAtender ? '#b45309' : '#94a3b8', marginTop: '0.15rem' }}>
                            ${c.valorSinAtender.toLocaleString('es-CO')}
                          </div>
                        </div>
                      </div>

                      {/* Botón de Acción Directo */}
                      <button
                        type="button"
                        onClick={() => setSelectedAsesorId(c.asesor.id)}
                        style={{
                          width: '100%',
                          padding: '0.55rem',
                          borderRadius: '8px',
                          border: hasSinAtender ? '1px solid #fca5a5' : '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: hasSinAtender ? '#b91c1c' : '#334155',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          fontFamily: "'Poppins', sans-serif"
                        }}
                      >
                        <span>{hasSinAtender ? `Ver los ${c.sinAtender} chats de ${c.asesor.nombre.split(' ')[0]}` : `Ver chats de ${c.asesor.nombre.split(' ')[0]}`}</span>
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Línea de Tiempo Hora a Hora (Colapsable) */}
          {!isHistorico && (
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '0.9rem 1.25rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              fontFamily: "'Poppins', sans-serif"
            }}>
              <div
                onClick={() => setShowHourlyTimeline(!showHourlyTimeline)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Clock size={16} color={primaryColor} />
                  <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0f172a' }}>
                    Evolución hora a hora del día (8:00 AM - 8:00 PM)
                  </span>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    ({showHourlyTimeline ? 'Clic para ocultar' : 'Clic para ver corte de cada hora'})
                  </span>
                </div>
                <button
                  type="button"
                  style={{
                    border: 'none',
                    background: '#f1f5f9',
                    borderRadius: '6px',
                    padding: '0.3rem 0.6rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.74rem',
                    fontWeight: 500,
                    color: '#475569',
                    fontFamily: "'Poppins', sans-serif"
                  }}
                >
                  <span>{showHourlyTimeline ? 'Ocultar' : 'Ver Horas'}</span>
                  {showHourlyTimeline ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {showHourlyTimeline && (
                <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(75px, 1fr))', gap: '0.4rem', overflowX: 'auto' }}>
                    {hourlyBreakdown.map(hb => {
                      const isCurrentCutoff = cutoffHour === hb.hourNumber;
                      const hasSinAtender = hb.sinAtenderAcumulados > 0;
                      return (
                        <button
                          key={hb.hourNumber}
                          type="button"
                          onClick={() => setCutoffHour(hb.hourNumber)}
                          style={{
                            padding: '0.55rem 0.35rem',
                            borderRadius: '10px',
                            border: isCurrentCutoff ? `2px solid ${primaryColor}` : '1px solid #e2e8f0',
                            background: isCurrentCutoff ? 'rgba(0, 166, 249, 0.08)' : '#f8fafc',
                            cursor: 'pointer',
                            textAlign: 'center',
                            fontFamily: "'Poppins', sans-serif"
                          }}
                        >
                          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: isCurrentCutoff ? primaryColor : '#475569', marginBottom: '0.2rem' }}>{hb.label}</div>
                          <div style={{ fontSize: '0.98rem', fontWeight: 600, color: hasSinAtender ? '#dc2626' : '#16a34a', lineHeight: 1 }}>{hb.sinAtenderAcumulados}</div>
                          <div style={{ fontSize: '0.62rem', color: '#64748b', marginTop: '0.2rem' }}>{hb.nuevos > 0 ? `+${hb.nuevos}` : '0'}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

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
                  {isHistorico 
                    ? (filterStatusTab === 'sin_atender' ? '¡No hay chats sin atender en todo el histórico!' : 'No hay interacciones registradas en este filtro.')
                    : (filterStatusTab === 'sin_atender' ? `¡No hay chats sin atender a las ${cutoffHour % 12 || 12}:00 ${cutoffHour >= 12 ? 'PM' : 'AM'}!` : 'No hay interacciones registradas en este filtro.')}
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>
                  {filterStatusTab === 'sin_atender' 
                    ? (isHistorico ? 'Todas las interacciones de la historia fueron atendidas exitosamente.' : 'Todos los clientes que escribieron hasta esta hora fueron atendidos oportunamente.') 
                    : 'Prueba cambiando la hora de corte o la fecha seleccionada.'}
                </p>
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
                            {isHistorico && (
                              <>
                                <span>•</span>
                                <span style={{ fontWeight: 500, color: '#64748b' }}>📅 {item.colDateStr}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ minWidth: '160px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Clock size={14} color="#64748b" />
                          <span>Llegó: <strong>{isHistorico ? `${item.colDateStr} ${item.colTimeFormatted}` : item.colTimeFormatted}</strong></span>
                        </div>
                        {isSinAtender ? (
                          <div style={{ fontSize: '0.74rem', color: '#dc2626', fontWeight: 500, marginTop: '0.15rem' }}>
                            {isHistorico 
                              ? `⚠️ Sin atender desde el ${item.colDateStr}`
                              : `⚠️ Llevaba ${formatMinsToDuration(waitMinutesAtCutoff)} sin atender a las ${cutoffHour % 12 || 12}:00 ${cutoffHour >= 12 ? 'PM' : 'AM'}`
                            }
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
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* VISTA 2: CONTRA ENTREGAS SIN CONFIRMAR (ACUMULADO HISTÓRICO)       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {mainViewMode === 'contra_acumulado' && (
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
            {/* Banner de alerta de duplicados por clics rápidos */}
            {duplicateContraOrderIds.size > 0 && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.85rem 1rem',
                background: '#fffbeb',
                border: '1.5px solid #fde68a',
                borderRadius: '12px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                fontFamily: "'Poppins', sans-serif"
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{ fontSize: '1.35rem' }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#92400e' }}>
                      Se detectaron {duplicateContraOrderIds.size} pedidos duplicados por toques repetidos en la web
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#b45309' }}>
                      Ocurrió cuando clientes dieron varios clics rápidos seguidos al enviar su pedido (como Patricia Montero). Solo 1 es la orden real.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isCleaningDuplicates}
                  onClick={handleCleanAllDuplicates}
                  style={{
                    background: '#d97706',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: isCleaningDuplicates ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)',
                    fontFamily: "'Poppins', sans-serif"
                  }}
                >
                  <span>🗑️ Descartar {duplicateContraOrderIds.size} duplicados</span>
                </button>
              </div>
            )}

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
                  const isDuplicate = duplicateContraOrderIds.has(p.id);

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
                        border: isDuplicate ? '1.5px dashed #f59e0b' : (isOld ? '1.5px solid #fed7aa' : '1px solid #e2e8f0'),
                        background: isDuplicate ? '#fffdf5' : (isOld ? '#fffbf5' : '#ffffff'),
                        opacity: isDuplicate ? 0.8 : 1,
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
                          background: isDuplicate ? '#fef3c7' : '#ffedd5',
                          color: isDuplicate ? '#b45309' : '#ea580c',
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
                            {isDuplicate && (
                              <span style={{ fontSize: '0.68rem', fontWeight: 500, padding: '0.1rem 0.45rem', borderRadius: '4px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                                ⚠️ Clic Repetido (Duplicado)
                              </span>
                            )}
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

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* VISTA 3: INTERESADAS / CARRITOS ABANDONADOS (ACUMULADO HISTÓRICO)  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {mainViewMode === 'interesados_acumulado' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Banner Explicativo */}
          <div style={{
            background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
            border: '1.5px solid #d8b4fe',
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
                <Sparkles size={20} color="#7c3aed" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#6b21a8' }}>
                  Backlog Acumulado: Clientes Interesadas y Carritos Abandonados
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#6b21a8', opacity: 0.9 }}>
                Aquí se encuentran los <strong>{unconfirmedInteresados.length} clientes interesados</strong> que iniciaron compra en la web o dejaron prendas en el carrito y que las asesoras aún no han cerrado.
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#7c3aed', textTransform: 'uppercase' }}>Valor Potencial Estimado</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 600, color: '#6b21a8' }}>
                ${unconfirmedInteresados.reduce((acc, it) => acc + (it.total || 0), 0).toLocaleString('es-CO')}
              </div>
            </div>
          </div>

          {/* Comparativa por Asesora del Backlog Interesados */}
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.96rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Users size={16} color="#7c3aed" /> Carritos e Interesadas Asignadas por Asesora
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', background: '#f8fafc' }}>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569' }}>Asesora</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Línea WhatsApp</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#7c3aed', textAlign: 'center' }}>Carritos / Leads</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Monto Estimado ($)</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Filtro</th>
                  </tr>
                </thead>
                <tbody>
                  {interesadosBreakdownByAsesor.map(item => (
                    <tr key={item.asesor.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
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
                          background: item.count > 0 ? '#f3e8ff' : '#f1f5f9',
                          color: item.count > 0 ? '#7c3aed' : '#64748b'
                        }}>
                          {item.count} interesadas
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontWeight: 600, color: item.count > 0 ? '#7c3aed' : '#94a3b8' }}>
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

          {/* Listado de Clientes Interesadas */}
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>
                  Listado de Interesadas ({filteredInteresadosList.length}):
                </span>
                {selectedAsesorId !== 'todas' && (
                  <span style={{ fontSize: '0.75rem', color: primaryColor, background: 'rgba(0,166,249,0.08)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 500 }}>
                    Filtrado por: {asesores.find(a => a.id === selectedAsesorId)?.nombre}
                    <button type="button" onClick={() => setSelectedAsesorId('todas')} style={{ border: 'none', background: 'transparent', marginLeft: '0.3rem', cursor: 'pointer', color: primaryColor, fontWeight: 600 }}>✕</button>
                  </span>
                )}
              </div>

              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Buscar por cliente o teléfono..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.65rem 0.45rem 2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontFamily: "'Poppins', sans-serif" }}
                />
              </div>
            </div>

            {filteredInteresadosList.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>🎉</div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#0f172a', fontWeight: 600 }}>
                  ¡No hay clientes interesadas pendientes!
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>Todos los carritos y leads fueron gestionados o convertidos.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {filteredInteresadosList.map(it => {
                  const createdCol = parseToColombiaTime(it.created_at);
                  const daysAgo = Math.floor((Date.now() - new Date(it.created_at).getTime()) / (1000 * 3600 * 24));
                  const isOld = daysAgo >= 2;

                  let asesorName = 'Sin Asignar';
                  const cleanPhone = (it.linea_whatsapp || '').replace(/\D/g, '');
                  for (const [, item] of asesoresPhoneMap) {
                    if (item.phones.includes(cleanPhone)) {
                      asesorName = item.asesor.nombre;
                      break;
                    }
                  }

                  let prodText = 'Prendas sin especificar';
                  if (Array.isArray(it.productos) && it.productos.length > 0) {
                    prodText = it.productos.map((prod: any) => `${prod.cantidad || 1}x ${prod.nombre || prod.title || 'Prenda'}`).slice(0, 3).join(', ');
                    if (it.productos.length > 3) prodText += ` (+${it.productos.length - 3} más)`;
                  }

                  const isContactado = it.retargeting_estado === 'contactado';

                  return (
                    <div
                      key={it.id}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '12px',
                        border: isOld ? '1.5px solid #e9d5ff' : '1px solid #e2e8f0',
                        background: '#ffffff',
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
                          background: '#f3e8ff',
                          color: '#7c3aed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '0.92rem',
                          flexShrink: 0
                        }}>
                          {(it.cliente_nombre || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>{it.cliente_nombre}</span>
                            <span style={{ fontSize: '0.68rem', fontWeight: 500, padding: '0.1rem 0.4rem', borderRadius: '4px', background: '#faf5ff', color: '#7c3aed', border: '1px solid #d8b4fe' }}>
                              ✨ {it.source === 'lead' ? 'Carrito Web' : 'Pedido Abandonado'}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 500,
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              background: isContactado ? '#ecfdf5' : '#fffbeb',
                              color: isContactado ? '#15803d' : '#b45309'
                            }}>
                              {isContactado ? '✓ Contactado' : '⏱️ Sin Contactar'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                            <span>📱 {it.cliente_telefono || 'Sin teléfono'}</span>
                            <span>•</span>
                            <span>Asesora: <strong>{asesorName}</strong></span>
                            <span>•</span>
                            <span style={{ color: isOld ? '#7c3aed' : '#64748b', fontWeight: isOld ? 500 : 400 }}>
                              {daysAgo === 0 ? 'Hoy' : daysAgo === 1 ? 'Ayer' : `Hace ${daysAgo} días`} ({createdCol.dateStr})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ minWidth: '130px', textAlign: 'right' }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
                          ${(it.total || 0).toLocaleString('es-CO')}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={prodText}>
                          {prodText}
                        </div>
                      </div>

                      {/* Botones de Acción */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {it.raw && onSelectPedido && it.source === 'pedido_abandonado' && (
                          <button
                            type="button"
                            onClick={() => onSelectPedido(it.raw)}
                            style={{ padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: '0.76rem', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            title="Ver detalles completos del pedido"
                          >
                            <Eye size={13} />
                            <span>Ver</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenWhatsAppChat(it, 'lead')}
                          style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          title="Escribir por WhatsApp para recuperar carrito"
                        >
                          <Phone size={13} />
                          <span>WhatsApp</span>
                        </button>

                        {!isContactado && (
                          <button
                            type="button"
                            onClick={() => handleContactarInteresado(it)}
                            style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: 'none', background: '#7c3aed', color: '#ffffff', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                            title="Marcar como contactado"
                          >
                            <CheckCircle2 size={13} />
                            <span>Contactado</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDescartarInteresado(it)}
                          style={{ padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff5f5', color: '#dc2626', fontSize: '0.76rem', fontWeight: 500, cursor: 'pointer' }}
                          title="Descartar este lead/interesado"
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

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* VISTA 4: PENDIENTES POR PAGO (ACUMULADO HISTÓRICO)                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {mainViewMode === 'pendientes_pago_acumulado' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Banner Explicativo */}
          <div style={{
            background: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)',
            border: '1.5px solid #fde047',
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
                <CreditCard size={20} color="#ca8a04" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#854d0e' }}>
                  Backlog Acumulado: Pedidos Pendientes por Pago (Transferencia Bancaria)
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#854d0e', opacity: 0.9 }}>
                Aquí se encuentran los <strong>{unconfirmedPendientesPago.length} pedidos por transferencia</strong> (Bancolombia, Nequi, etc.) que están pendientes de comprobante o en espera de aprobación de pago.
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#854d0e', textTransform: 'uppercase' }}>Valor Total en Retención</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 600, color: '#ca8a04' }}>
                ${unconfirmedPendientesPago.reduce((acc, p) => acc + (p.total || 0), 0).toLocaleString('es-CO')}
              </div>
            </div>
          </div>

          {/* Comparativa por Asesora del Backlog Pendientes de Pago */}
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.96rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Users size={16} color="#ca8a04" /> Pendientes por Pago Asignados por Asesora
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', background: '#f8fafc' }}>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569' }}>Asesora</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Línea WhatsApp</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#ca8a04', textAlign: 'center' }}>Pedidos Pendientes</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Monto Retenido ($)</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Filtro</th>
                  </tr>
                </thead>
                <tbody>
                  {pendientesPagoBreakdownByAsesor.map(item => (
                    <tr key={item.asesor.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fef9c3', color: '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
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
                          background: item.count > 0 ? '#fef9c3' : '#f1f5f9',
                          color: item.count > 0 ? '#854d0e' : '#64748b'
                        }}>
                          {item.count} pedidos
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontWeight: 600, color: item.count > 0 ? '#854d0e' : '#94a3b8' }}>
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

          {/* Listado de Pedidos Pendientes de Pago */}
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>
                  Listado de Pedidos Pendientes ({filteredPendientesPagoList.length}):
                </span>
                {selectedAsesorId !== 'todas' && (
                  <span style={{ fontSize: '0.75rem', color: primaryColor, background: 'rgba(0,166,249,0.08)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 500 }}>
                    Filtrado por: {asesores.find(a => a.id === selectedAsesorId)?.nombre}
                    <button type="button" onClick={() => setSelectedAsesorId('todas')} style={{ border: 'none', background: 'transparent', marginLeft: '0.3rem', cursor: 'pointer', color: primaryColor, fontWeight: 600 }}>✕</button>
                  </span>
                )}
              </div>

              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Buscar por cliente o teléfono..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.65rem 0.45rem 2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontFamily: "'Poppins', sans-serif" }}
                />
              </div>
            </div>

            {filteredPendientesPagoList.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>🎉</div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#0f172a', fontWeight: 600 }}>
                  ¡No hay pedidos pendientes por pago!
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>Todos los pedidos por transferencia fueron pagados o confirmados.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {filteredPendientesPagoList.map(p => {
                  const createdCol = parseToColombiaTime(p.created_at);
                  const daysAgo = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 3600 * 24));
                  const isOld = daysAgo >= 2;

                  let asesorName = p.asesor || 'Sin Asignar';
                  const cleanPhone = (p.linea_whatsapp || '').replace(/\D/g, '');
                  for (const [, item] of asesoresPhoneMap) {
                    if (item.phones.includes(cleanPhone)) {
                      asesorName = item.asesor.nombre;
                      break;
                    }
                  }

                  const hasPantallazo = Boolean(p.pantallazo_url);

                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '12px',
                        border: isOld ? '1.5px solid #fef08a' : '1px solid #e2e8f0',
                        background: '#ffffff',
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
                          background: hasPantallazo ? '#eff6ff' : '#fef9c3',
                          color: hasPantallazo ? '#2563eb' : '#ca8a04',
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
                            <span style={{ fontSize: '0.68rem', fontWeight: 500, padding: '0.1rem 0.4rem', borderRadius: '4px', background: '#fefce8', color: '#a16207', border: '1px solid #fef08a' }}>
                              💳 {p.metodo_pago || 'Transferencia'}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 500,
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              background: hasPantallazo ? '#dbeafe' : '#f1f5f9',
                              color: hasPantallazo ? '#1e40af' : '#475569'
                            }}>
                              {hasPantallazo ? '🧾 Comprobante Subido' : '⏳ Esperando Pago'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                            <span>📱 {p.cliente_telefono || 'Sin teléfono'}</span>
                            <span>•</span>
                            <span>Asesora: <strong>{asesorName}</strong></span>
                            <span>•</span>
                            <span style={{ color: isOld ? '#b45309' : '#64748b', fontWeight: isOld ? 500 : 400 }}>
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
                          onClick={() => handleOpenWhatsAppChat(p, 'pago')}
                          style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          title="Abrir WhatsApp para recordar o verificar pago"
                        >
                          <Phone size={13} />
                          <span>WhatsApp</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleConfirmPendientePago(p.id)}
                          style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: 'none', background: '#10b981', color: '#ffffff', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          title="Confirmar recepción del pago"
                        >
                          <CheckCircle2 size={13} />
                          <span>✓ Pago Recibido</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCancelPendientePago(p.id)}
                          style={{ padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff5f5', color: '#dc2626', fontSize: '0.76rem', fontWeight: 500, cursor: 'pointer' }}
                          title="Cancelar pedido si no pagó"
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

      {/* ── MODAL COMPARTIR INFORME CON PROPIETARIOS / DIRECTORES ── */}
      {showShareModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1rem',
            fontFamily: "'Poppins', sans-serif"
          }}
          onClick={() => setShowShareModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              padding: '2rem',
              maxWidth: '540px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1.5px solid #d1fae5',
              position: 'relative',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowShareModal(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <XCircle size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: '#ecfdf5',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Share2 size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#0f172a' }}>
                  Compartir Informe Ejecutivo
                </h3>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                  Listo para enviar a WhatsApp a propietarios, socios o directores
                </p>
              </div>
            </div>

            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              padding: '0.55rem 0.85rem',
              marginBottom: '0.85rem',
              fontSize: '0.76rem',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}>
              <span>🔐</span>
              <span>Incluye enlace interactivo directo protegido con PIN <strong>1107</strong></span>
            </div>

            {/* Vista previa del mensaje */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              fontSize: '0.78rem',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              color: '#1e293b',
              marginBottom: '1rem',
              maxHeight: '280px',
              fontFamily: "'Courier New', Courier, monospace"
            }}>
              {shareData.text}
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => {
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareData.text)}`, '_blank');
                }}
                style={{
                  flex: '1 1 180px',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#16a34a',
                  color: '#ffffff',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                <Phone size={15} />
                <span>Abrir en WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(shareData.text);
                  setCopiedMessage(true);
                  setTimeout(() => setCopiedMessage(false), 2000);
                }}
                style={{
                  flex: '1 1 140px',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  background: copiedMessage ? '#ecfdf5' : '#ffffff',
                  color: copiedMessage ? '#166534' : '#334155',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                {copiedMessage ? <Check size={15} color="#16a34a" /> : <Copy size={15} />}
                <span>{copiedMessage ? '¡Texto Copiado!' : 'Copiar Texto'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(shareData.link);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                style={{
                  flex: '1 1 140px',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  background: copiedLink ? '#ecfdf5' : '#ffffff',
                  color: copiedLink ? '#166534' : '#334155',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                {copiedLink ? <Check size={15} color="#16a34a" /> : <Share2 size={15} />}
                <span>{copiedLink ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL RECUPERAR LÍNEAS BLOQUEADAS ── */}
      <RecuperarLineaBloqueadaModal
        isOpen={showLineaBloqueadaModal}
        onClose={() => setShowLineaBloqueadaModal(false)}
        asesores={asesores}
        pedidos={pedidos}
        leads={leads}
        configuracion={configuracion}
        tenantId={tenantId}
      />

    </div>
  );
};
