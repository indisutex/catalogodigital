import React, { useState, useMemo } from 'react';
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
  Sparkles
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

export const InformeAsesorasDiario: React.FC<InformeAsesorasDiarioProps> = ({
  pedidos,
  leads,
  asesores,
  configuracion,
  tenantId,
  currentAsesor,
  onAtenderPedido,
  onUpdateLeadStatus,
  onSelectPedido
}) => {
  const primaryColor = configuracion?.color_primario || '#00a6f9';

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
  const [cutoffHour, setCutoffHour] = useState<number>(16); // 16 = 4:00 PM (Ejemplo del usuario predeterminado)
  const [filterStatusTab, setFilterStatusTab] = useState<'sin_atender' | 'atendidos' | 'todos'>('sin_atender');
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  // Unifica pedidos y leads en una lista única de interacciones/chats, deduplicando clientes
  const allInteractions = useMemo(() => {
    const items: ChatInteractionItem[] = [];

    // 1. Procesar Pedidos
    (pedidos || []).forEach(p => {
      if (p.tenant_id && p.tenant_id !== tenantId) return;
      const cleanLinePhone = (p.linea_whatsapp || '').replace(/\D/g, '');
      
      // Buscar qué asesor tiene esta línea
      let matchedAsesor: Asesor | undefined;
      for (const [, item] of asesoresPhoneMap) {
        if (item.phones.includes(cleanLinePhone)) {
          matchedAsesor = item.asesor;
          break;
        }
      }

      // Si no hace match por teléfono pero p.asesor coincide por nombre
      if (!matchedAsesor && p.asesor) {
        matchedAsesor = asesores.find(a => 
          a.nombre.toLowerCase().trim() === (p.asesor || '').toLowerCase().trim()
        );
      }

      const colTime = parseToColombiaTime(p.created_at);

      // Determinar si fue atendido
      const isCompleted = p.estado === 'completado' || p.estado === 'entregado_pagado' || p.estado === 'entregado';
      const isAtendido = Boolean(p.atendido || isCompleted);

      // Extraer timestamp de atención si existe en historial
      let atendidoTimestamp: string | null = null;
      if (Array.isArray((p as any).historial)) {
        const atLog = (p as any).historial.find((h: any) => 
          h.accion?.toLowerCase().includes('atendido') || 
          h.estado === 'mensaje_enviado' || 
          h.estado === 'completado'
        );
        if (atLog?.fecha) atendidoTimestamp = atLog.fecha;
      }

      // Resumen de productos
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
        atendido: isAtendido,
        atendidoTimestamp,
        estado: p.estado || 'pendiente',
        total: p.total || 0,
        productosResumen: prodSummary,
        raw: p
      });
    });

    // 2. Procesar Leads (Carritos Abandonados / Interesados) deduplicando si ya existe un pedido del cliente en fechas cercanas
    (leads || []).forEach(l => {
      if (l.tenant_id && l.tenant_id !== tenantId) return;
      const cleanLinePhone = (l.linea_whatsapp || '').replace(/\D/g, '');
      const cleanClientPhone = (l.telefono || '').replace(/\D/g, '');

      // Verificar si este lead ya se convirtió en pedido
      if (cleanClientPhone) {
        const leadTime = new Date(l.created_at).getTime();
        const hasOrder = items.some(it => {
          if (it.source !== 'pedido') return false;
          if (it.clienteTelefono !== cleanClientPhone) return false;
          const orderTime = new Date(it.createdAt).getTime();
          // Si el pedido se hizo dentro de 2 horas antes o después del lead
          return Math.abs(orderTime - leadTime) < 2 * 3600 * 1000;
        });
        if (hasOrder) return; // Deduplicar: el pedido ya representa este chat
      }

      let matchedAsesor: Asesor | undefined;
      for (const [, item] of asesoresPhoneMap) {
        if (item.phones.includes(cleanLinePhone)) {
          matchedAsesor = item.asesor;
          break;
        }
      }

      const colTime = parseToColombiaTime(l.created_at);
      const isContacted = l.retargeting_estado === 'contactado' || l.retargeting_estado === 'recuperado' || l.estado === 'completado';
      const isAtendido = Boolean(isContacted || l.atendido);

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
        atendido: isAtendido,
        atendidoTimestamp: null,
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
      // Llegó antes de la hora de corte o exactamente a esa hora
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
        // Si fue atendido, verificar si ya estaba atendido a la hora de corte
        if (item.atendidoTimestamp) {
          const colAtendido = parseToColombiaTime(item.atendidoTimestamp);
          const wasAttendedBeforeCutoff = 
            colAtendido.dateStr < selectedDate ||
            (colAtendido.dateStr === selectedDate && (colAtendido.hour < cutoffHour || (colAtendido.hour === cutoffHour && colAtendido.minute === 0)));
          
          if (wasAttendedBeforeCutoff) {
            atendidos.push(item);
          } else {
            // Se atendió DESPUÉS de la hora de corte: a la hora de corte todavía estaba sin atender!
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

  // Métricas del snapshot a la hora de corte
  const totalRecibidos = interactionsUpToCutoff.length;
  const totalAtendidos = atendidosAtCutoff.length;
  const totalSinAtender = sinAtenderAtCutoff.length;
  const porcentajeSinAtender = totalRecibidos > 0 ? Math.round((totalSinAtender / totalRecibidos) * 100) : 0;
  const porcentajeAtendidos = totalRecibidos > 0 ? Math.round((totalAtendidos / totalRecibidos) * 100) : 0;
  
  // Monto en riesgo (suma de pedidos/carritos de chats sin atender a la hora de corte)
  const valorSinAtender = useMemo(() => {
    return sinAtenderAtCutoff.reduce((acc, it) => acc + (it.total || 0), 0);
  }, [sinAtenderAtCutoff]);

  // Tiempo promedio que llevaban esperando los chats sin atender a la hora de corte
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

  // Formato horas y minutos
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
      const sinAtender = upToCutoff.filter(it => !it.atendido);
      const atendidos = upToCutoff.filter(it => it.atendido);
      const total = upToCutoff.length;
      const pctSinAtender = total > 0 ? Math.round((sinAtender.length / total) * 100) : 0;

      return {
        asesor: a,
        totalRecibidos: total,
        atendidos: atendidos.length,
        sinAtender: sinAtender.length,
        pctSinAtender,
        valorSinAtender: sinAtender.reduce((s, it) => s + (it.total || 0), 0)
      };
    });
  }, [asesores, dayInteractions, cutoffHour]);

  // Desglose hora a hora de 8:00 AM a 20:00 (8:00 PM)
  const hourlyBreakdown = useMemo(() => {
    const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    return hours.map(h => {
      const hour12 = h % 12 || 12;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const label = `${hour12}:00 ${ampm}`;

      // Chats que llegaron en esta franja específica de 1 hora
      const itemsInHour = dayAsesorInteractions.filter(it => it.colHour === h);
      
      // Chats acumulados sin atender exactamente al finalizar esa hora
      const upToThisHour = dayAsesorInteractions.filter(it => it.colHour <= h);
      const sinAtenderAtThisHour = upToThisHour.filter(it => !it.atendido);

      return {
        hourNumber: h,
        label,
        nuevos: itemsInHour.length,
        atendidos: itemsInHour.filter(it => it.atendido).length,
        sinAtenderAcumulados: sinAtenderAtThisHour.length,
        itemsInHour
      };
    });
  }, [dayAsesorInteractions]);

  // Lista detallada a mostrar según la pestaña activa ('sin_atender' | 'atendidos' | 'todos')
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

    // Ordenar de más antiguo a más reciente para priorizar los que más tiempo llevan esperando
    return [...list].sort((a, b) => {
      return (a.colHour * 60 + a.colMinute) - (b.colHour * 60 + b.colMinute);
    });
  }, [filterStatusTab, sinAtenderAtCutoff, atendidosAtCutoff, interactionsUpToCutoff, searchQuery]);

  // Función para marcar rápidamente como atendido
  const handleQuickMarkAtendido = async (item: ChatInteractionItem) => {
    try {
      if (item.source === 'pedido') {
        const { error } = await supabase
          .from('pedidos')
          .update({ atendido: true })
          .eq('id', item.raw.id);
        if (!error && onAtenderPedido) {
          onAtenderPedido(item.raw);
        }
      } else {
        const { error } = await supabase
          .from('leads')
          .update({ retargeting_estado: 'contactado' })
          .eq('id', item.raw.id);
        if (!error && onUpdateLeadStatus) {
          onUpdateLeadStatus(item.raw.id, 'contactado');
        }
      }
    } catch (err) {
      console.error('Error al marcar como atendido:', err);
    }
  };

  // Abrir chat directo de WhatsApp con el cliente
  const handleOpenWhatsAppChat = (item: ChatInteractionItem) => {
    const cleanPhone = item.clienteTelefono.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
    const text = encodeURIComponent(`¡Hola ${item.clienteNombre}! 👋 Te escribo de ${configuracion?.nombre_negocio || 'la tienda'}. ¿Cómo estás?`);
    window.open(`https://api.whatsapp.com/send?phone=${fullPhone}&text=${text}`, '_blank');
  };

  // Exportar reporte a formato CSV
  const handleExportCSV = () => {
    const headers = [
      'Fecha',
      'Hora Llegada',
      'Cliente',
      'Teléfono',
      'Asesora Asignada',
      'Tipo',
      'Estado a las ' + (cutoffHour % 12 || 12) + (cutoffHour >= 12 ? 'PM' : 'AM'),
      'Tiempo Espera a Corte (mins)',
      'Total COP',
      'Detalle'
    ];

    const cutoffMinutes = cutoffHour * 60;
    const rows = interactionsUpToCutoff.map(it => {
      const isSinAtender = !it.atendido;
      const waitMins = isSinAtender ? Math.max(0, cutoffMinutes - (it.colHour * 60 + it.colMinute)) : 0;
      return [
        `"${it.colDateStr}"`,
        `"${it.colTimeFormatted}"`,
        `"${it.clienteNombre.replace(/"/g, '""')}"`,
        `"${it.clienteTelefono}"`,
        `"${it.asesorNombre.replace(/"/g, '""')}"`,
        `"${it.source === 'pedido' ? 'Pedido Web' : 'Carrito Abandonado'}"`,
        `"${isSinAtender ? 'Sin Atender' : 'Atendido'}"`,
        waitMins,
        it.total,
        `"${it.productosResumen.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `informe_chats_${selectedAsesorId}_${selectedDate}_corte_${cutoffHour}h.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cambiar de fecha (día anterior / día siguiente)
  const handleStepDay = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);
    setSelectedDate(parseToColombiaTime(dateObj).dateStr);
  };

  // Formato amigable de fecha (ej: "Miércoles, 3 de Noviembre de 2026")
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
      
      {/* ── 1. HEADER PRINCIPAL Y CONTROLES DE FECHA / ASESORA / CORTE ── */}
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
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(0, 166, 249, 0.1)',
                color: primaryColor
              }}>
                <Clock size={18} />
              </span>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>
                Informe Diario por Asesora y Auditoría de Chats
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', fontWeight: 400 }}>
              Audita con exactitud cuántos clientes y chats ingresaron y cuántos permanecían sin atender a cualquier hora del día.
            </p>
          </div>

          {/* Botón Exportar */}
          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 1rem',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '0.82rem',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif"
            }}
          >
            <Download size={15} />
            <span>Descargar CSV</span>
          </button>
        </div>

        {/* Barra de Filtros interactiva */}
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

          {/* Selector de Hora de Corte (Snapshot: Ej. 4:00 PM) */}
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

        {/* Píldora de estado del corte auditado */}
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
          {cutoffHour === 16 && (
            <span style={{
              marginLeft: 'auto',
              padding: '0.15rem 0.5rem',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 500,
              background: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0'
            }}>
              Corte 4:00 PM Activo
            </span>
          )}
        </div>
      </div>

      {/* ── 2. TARJETAS DE RESULTADO KPI AL CORTE (SNAPSHOT) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: '0.85rem'
      }}>
        
        {/* Total Chats Recibidos */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '1rem 1.15rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748b', textTransform: 'uppercase' }}>
              Chats Recibidos
            </span>
            <MessageSquare size={16} color="#64748b" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 600, color: '#0f172a', lineHeight: 1 }}>
            {totalRecibidos}
          </div>
          <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '0.4rem', fontWeight: 400 }}>
            Hasta las {cutoffHour === 24 ? '23:59' : `${cutoffHour % 12 || 12}:00 ${cutoffHour >= 12 ? 'PM' : 'AM'}`}
          </div>
        </div>

        {/* Chats Atendidos */}
        <div style={{
          background: '#f0fdf4',
          borderRadius: '14px',
          padding: '1rem 1.15rem',
          border: '1px solid #bbf7d0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#166534', textTransform: 'uppercase' }}>
              Chats Atendidos
            </span>
            <CheckCircle2 size={16} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 600, color: '#15803d', lineHeight: 1 }}>
            {totalAtendidos}
          </div>
          <div style={{ fontSize: '0.73rem', color: '#166534', marginTop: '0.4rem', fontWeight: 400 }}>
            {porcentajeAtendidos}% de efectividad a esa hora
          </div>
        </div>

        {/* CHATS SIN ATENDER (EL DATO CLAVE) */}
        <div style={{
          borderRadius: '14px',
          padding: '1rem 1.15rem',
          border: totalSinAtender > 0 ? '1.5px solid #fca5a5' : '1px solid #e2e8f0',
          background: totalSinAtender > 0 ? '#fef2f2' : '#ffffff',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: totalSinAtender > 0 ? '#991b1b' : '#64748b', textTransform: 'uppercase' }}>
              ⚠️ Sin Atender a esa Hora
            </span>
            <AlertTriangle size={16} color={totalSinAtender > 0 ? '#dc2626' : '#94a3b8'} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 600, color: totalSinAtender > 0 ? '#b91c1c' : '#0f172a', lineHeight: 1 }}>
            {totalSinAtender}
          </div>
          <div style={{ fontSize: '0.73rem', color: totalSinAtender > 0 ? '#991b1b' : '#64748b', marginTop: '0.4rem', fontWeight: 400 }}>
            {totalSinAtender > 0 ? `${porcentajeSinAtender}% de clientes sin respuesta` : 'Todo al día a esa hora ✓'}
          </div>
        </div>

        {/* Tiempo Promedio de Espera */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '1rem 1.15rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748b', textTransform: 'uppercase' }}>
              Demora Promedio
            </span>
            <Clock size={16} color="#64748b" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#0f172a', lineHeight: 1 }}>
            {totalSinAtender > 0 ? formatMinsToDuration(promedioEsperaMins) : '0 min'}
          </div>
          <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '0.4rem', fontWeight: 400 }}>
            Tiempo en espera acumulado
          </div>
        </div>

        {/* Monto en Carrito / Pedidos en Riesgo */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '1rem 1.15rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748b', textTransform: 'uppercase' }}>
              Ventas en Riesgo
            </span>
            <DollarSign size={16} color="#d97706" />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 600, color: '#b45309', lineHeight: 1 }}>
            ${valorSinAtender.toLocaleString('es-CO')}
          </div>
          <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '0.4rem', fontWeight: 400 }}>
            En pedidos sin atender a las {cutoffHour % 12 || 12}{cutoffHour >= 12 ? 'PM' : 'AM'}
          </div>
        </div>

      </div>

      {/* ── 3. COMPARATIVA ENTRE ASESORAS EN ESE DÍA Y HORA ── */}
      {selectedAsesorId === 'todas' && (
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
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
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 400 }}>
                              📱 {(c.asesor.telefono || '').split(',')[0]}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', fontWeight: 600, color: '#0f172a' }}>
                        {c.totalRecibidos}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', fontWeight: 600, color: '#16a34a' }}>
                        {c.atendidos}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '12px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          background: hasSinAtender ? '#fee2e2' : '#f0fdf4',
                          color: hasSinAtender ? '#b91c1c' : '#15803d'
                        }}>
                          {c.sinAtender}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', fontWeight: 500 }}>
                        {c.totalRecibidos > 0 ? (
                          <span style={{ color: c.pctSinAtender > 30 ? '#dc2626' : '#16a34a' }}>
                            {100 - c.pctSinAtender}%
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Sin chats</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontWeight: 600, color: hasSinAtender ? '#b45309' : '#94a3b8' }}>
                        ${c.valorSinAtender.toLocaleString('es-CO')}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedAsesorId(c.asesor.id)}
                          style={{
                            padding: '0.3rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#334155',
                            fontSize: '0.76rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
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

      {/* ── 4. LÍNEA DE TIEMPO / DESGLOSE HORA A HORA (08:00 A 20:00) ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '1.25rem',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Clock size={17} color={primaryColor} /> Evolución Hora a Hora del Día (8:00 AM - 8:00 PM)
          </h3>
          <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
            Haz clic en cualquier hora para auditarla como hora de corte
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
          gap: '0.45rem',
          overflowX: 'auto',
          paddingBottom: '0.4rem'
        }}>
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
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: isCurrentCutoff ? primaryColor : '#475569', marginBottom: '0.25rem' }}>
                  {hb.label}
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: hasSinAtender ? '#dc2626' : '#16a34a', lineHeight: 1 }}>
                  {hb.sinAtenderAcumulados}
                </div>
                <div style={{ fontSize: '0.64rem', color: '#64748b', marginTop: '0.2rem' }}>
                  {hb.nuevos > 0 ? `+${hb.nuevos} nuevo` : '0 nuevo'}
                </div>
                {isCurrentCutoff && (
                  <div style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: primaryColor
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 5. LISTA DETALLADA DE CHATS AL CORTE DE LAS X:00 ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '1.25rem',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        
        {/* Barra superior de pestañas y búsqueda */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}>
          
          {/* Pestañas de estado */}
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
              <span style={{
                background: filterStatusTab === 'sin_atender' ? '#dc2626' : '#94a3b8',
                color: '#ffffff',
                padding: '0.05rem 0.45rem',
                borderRadius: '10px',
                fontSize: '0.72rem'
              }}>
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
              <span style={{
                background: filterStatusTab === 'atendidos' ? '#16a34a' : '#94a3b8',
                color: '#ffffff',
                padding: '0.05rem 0.45rem',
                borderRadius: '10px',
                fontSize: '0.72rem'
              }}>
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
                cursor: 'pointer',
                boxShadow: filterStatusTab === 'todos' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <span>Todos ({interactionsUpToCutoff.length})</span>
            </button>
          </div>

          {/* Campo de búsqueda */}
          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar cliente o teléfono..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem 0.45rem 2rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.8rem',
                fontFamily: "'Poppins', sans-serif"
              }}
            />
          </div>
        </div>

        {/* Listado de tarjetas de clientes / chats */}
        {detailedList.length === 0 ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>
              {filterStatusTab === 'sin_atender' ? '🎉' : '📭'}
            </div>
            <h4 style={{ margin: '0 0 0.25rem 0', color: '#0f172a', fontWeight: 600 }}>
              {filterStatusTab === 'sin_atender' 
                ? `¡No hay chats sin atender a las ${cutoffHour % 12 || 12}:00 ${cutoffHour >= 12 ? 'PM' : 'AM'}!` 
                : 'No hay interacciones registradas en este filtro.'}
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem' }}>
              {filterStatusTab === 'sin_atender' 
                ? 'Todos los clientes que escribieron hasta esta hora fueron atendidos correctamente.' 
                : 'Prueba cambiando la hora de corte o la fecha seleccionada.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {detailedList.map(item => {
              const cutoffMinutes = cutoffHour * 60;
              const itemMinutes = item.colHour * 60 + item.colMinute;
              const waitMinutesAtCutoff = Math.max(0, cutoffMinutes - itemMinutes);
              const isSinAtender = !item.atendido;

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
                    gap: '0.85rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                >
                  {/* Info del Cliente */}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>
                          {item.clienteNombre}
                        </span>
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 500,
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          background: item.source === 'pedido' ? '#eff6ff' : '#faf5ff',
                          color: item.source === 'pedido' ? '#1d4ed8' : '#7e22ce'
                        }}>
                          {item.source === 'pedido' ? 'Pedido Web' : 'Carrito Abandonado'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                        <span>📱 {item.clienteTelefono || 'Sin teléfono'}</span>
                        <span>•</span>
                        <span>Asesora: <strong>{item.asesorNombre}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Hora de llegada y demora a la hora de corte */}
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
                        ✓ Atendido oportunamente
                      </div>
                    )}
                  </div>

                  {/* Detalle y Monto */}
                  <div style={{ minWidth: '140px', textAlign: 'right' }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#0f172a' }}>
                      ${(item.total || 0).toLocaleString('es-CO')}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.productosResumen}>
                      {item.productosResumen}
                    </div>
                  </div>

                  {/* Botones de acción rápida */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenWhatsAppChat(item)}
                      style={{
                        padding: '0.45rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #bbf7d0',
                        background: '#f0fdf4',
                        color: '#15803d',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                      title="Abrir WhatsApp con el cliente"
                    >
                      <Phone size={13} />
                      <span>WhatsApp</span>
                    </button>

                    {isSinAtender && (
                      <button
                        type="button"
                        onClick={() => handleQuickMarkAtendido(item)}
                        style={{
                          padding: '0.45rem 0.75rem',
                          borderRadius: '8px',
                          border: 'none',
                          background: primaryColor,
                          color: '#ffffff',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <CheckCircle2 size={13} />
                        <span>Marcar Atendido</span>
                      </button>
                    )}

                    {item.source === 'pedido' && onSelectPedido && (
                      <button
                        type="button"
                        onClick={() => onSelectPedido(item.raw)}
                        style={{
                          padding: '0.45rem 0.65rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#475569',
                          fontSize: '0.76rem',
                          fontWeight: 500,
                          cursor: 'pointer'
                        }}
                        title="Ver detalle del pedido"
                      >
                        Ver Pedido
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

