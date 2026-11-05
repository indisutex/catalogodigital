import React, { useState, useEffect, useMemo } from 'react';
import type { Asesor, Pedido, Configuracion } from '../types';
import { 
  PhoneForwarded, 
  X, 
  MessageSquare, 
  Copy, 
  Check, 
  Trash2, 
  Search, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  ExternalLink,
  Plus
} from 'lucide-react';

export interface TarjetaContactoBloqueado {
  id: string;
  telefono: string;
  nombre?: string;
  origen?: string;
  estado: 'pendiente' | 'contactado';
  contactadoAt?: string;
  nota?: string;
}

interface RecuperarLineaBloqueadaModalProps {
  isOpen: boolean;
  onClose: () => void;
  asesores: Asesor[];
  pedidos: Pedido[];
  leads: any[];
  configuracion?: Configuracion | null;
  tenantId: string;
}

export const RecuperarLineaBloqueadaModal: React.FC<RecuperarLineaBloqueadaModalProps> = ({
  isOpen,
  onClose,
  asesores,
  pedidos,
  leads,
  configuracion,
  tenantId
}) => {
  const storageKey = `tarjetas_linea_bloqueada_${tenantId || 'general'}`;
  const msgStorageKey = `msg_linea_bloqueada_${tenantId || 'general'}`;

  // ── ESTADOS ──
  const [activeTab, setActiveTab] = useState<'pegar' | 'extraer_db'>('pegar');
  const [tarjetas, setTarjetas] = useState<TarjetaContactoBloqueado[]>([]);
  const [rawText, setRawText] = useState<string>('');
  
  // Filtros de la lista de tarjetas
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendiente' | 'contactado'>('todos');
  
  // Extracción desde la BD
  const [selectedAsesorId, setSelectedAsesorId] = useState<string>('');
  const [filtroPeriodo, setFiltroPeriodo] = useState<'hoy' | 'ayer' | 'ultimos_3_dias' | 'ultimos_7_dias' | 'todos'>('ultimos_3_dias');
  const [filtroTipoCliente, setFiltroTipoCliente] = useState<'todos' | 'leads' | 'pedidos'>('todos');

  // Mensaje predeterminado de WhatsApp
  const defaultShopName = configuracion?.nombre_negocio || 'nuestra tienda';
  const [customMessage, setCustomMessage] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(msgStorageKey);
      if (saved) return saved;
    }
    return `¡Hola! Te escribimos de ${defaultShopName} 🌸. Te contactamos desde esta nueva línea oficial ya que nuestra línea anterior presentó una falla técnica temporal. ¿En qué te podemos colaborar con tu pedido?`;
  });
  const [showEditMsg, setShowEditMsg] = useState<boolean>(false);

  // Copiado feedback
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── CARGAR Y GUARDAR LOCALSTORAGE ──
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setTarjetas(parsed);
        }
      }
    } catch (e) {
      console.warn('Error leyendo tarjetas guardadas:', e);
    }
  }, [isOpen, storageKey]);

  const saveTarjetasToStorage = (newTarjetas: TarjetaContactoBloqueado[]) => {
    setTarjetas(newTarjetas);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newTarjetas));
    } catch (e) {
      console.warn('Error guardando tarjetas:', e);
    }
  };

  const saveMessageToStorage = (msg: string) => {
    setCustomMessage(msg);
    try {
      localStorage.setItem(msgStorageKey, msg);
    } catch (e) {}
  };

  // ── NORMALIZADOR DE TELÉFONO COLOMBIANO ──
  const cleanPhone = (str: string): string => {
    const digits = (str || '').replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('57')) {
      return digits.substring(2);
    }
    if (digits.length === 11 && digits.startsWith('57')) {
      return digits.substring(2);
    }
    return digits;
  };

  const formatDisplayPhone = (raw: string): string => {
    const c = cleanPhone(raw);
    if (c.length === 10) {
      return `+57 ${c.substring(0, 3)} ${c.substring(3, 6)} ${c.substring(6)}`;
    }
    return raw;
  };

  // ── 1. PROCESAR TEXTO PEGADO MANUALMENTE ──
  const handleProcesarTexto = () => {
    if (!rawText.trim()) return;

    const lines = rawText.split('\n');
    const existingPhones = new Set(tarjetas.map(t => cleanPhone(t.telefono)));
    const nuevasTarjetas: TarjetaContactoBloqueado[] = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Intentar extraer formato "Nombre - Teléfono" o "Nombre: Teléfono"
      let parsedName = '';
      let extractedDigits = '';

      if (trimmed.includes('-') || trimmed.includes(':')) {
        const separator = trimmed.includes('-') ? '-' : ':';
        const parts = trimmed.split(separator);
        const p1 = parts[0].trim();
        const p2 = parts.slice(1).join(' ').trim();

        // Determinar cuál parte tiene más dígitos
        const digitsP1 = p1.replace(/\D/g, '');
        const digitsP2 = p2.replace(/\D/g, '');

        if (digitsP2.length >= 10) {
          parsedName = p1.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').trim();
          extractedDigits = cleanPhone(digitsP2);
        } else if (digitsP1.length >= 10) {
          parsedName = p2.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').trim();
          extractedDigits = cleanPhone(digitsP1);
        }
      }

      // Si no hubo separación clara, extraer números de 10 dígitos directamente
      if (!extractedDigits) {
        const matchDigits = trimmed.match(/(?:\+?57)?\s*3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}|\d{10,12}/g);
        if (matchDigits && matchDigits.length > 0) {
          extractedDigits = cleanPhone(matchDigits[0]);
          // El resto de la línea puede ser el nombre si contiene letras
          const remainder = trimmed.replace(matchDigits[0], '').replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').trim();
          if (remainder.length > 2) {
            parsedName = remainder;
          }
        }
      }

      if (extractedDigits && extractedDigits.length >= 10) {
        if (!existingPhones.has(extractedDigits)) {
          existingPhones.add(extractedDigits);
          nuevasTarjetas.push({
            id: `linea_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
            telefono: extractedDigits,
            nombre: parsedName || undefined,
            origen: 'Texto pegado',
            estado: 'pendiente'
          });
        }
      }
    });

    if (nuevasTarjetas.length > 0) {
      saveTarjetasToStorage([...nuevasTarjetas, ...tarjetas]);
      setRawText('');
    }
  };

  // ── 2. EXTRAER AUTOMÁTICAMENTE DE LA BASE DE DATOS ──
  const handleExtraerDeBD = () => {
    if (!selectedAsesorId) return;

    const asesorObj = asesores.find(a => a.id === selectedAsesorId);
    if (!asesorObj) return;

    const asesorPhones = (asesorObj.telefono || '')
      .split(',')
      .map(p => cleanPhone(p))
      .filter(Boolean);

    const now = new Date().getTime();
    const getDaysDiff = (dateStr?: string) => {
      if (!dateStr) return 9999;
      return (now - new Date(dateStr).getTime()) / (1000 * 3600 * 24);
    };

    const isWithinPeriod = (createdStr?: string) => {
      if (filtroPeriodo === 'todos') return true;
      const diff = getDaysDiff(createdStr);
      if (filtroPeriodo === 'hoy') return diff <= 1.0;
      if (filtroPeriodo === 'ayer') return diff <= 2.0;
      if (filtroPeriodo === 'ultimos_3_dias') return diff <= 3.0;
      if (filtroPeriodo === 'ultimos_7_dias') return diff <= 7.0;
      return true;
    };

    const existingPhones = new Set(tarjetas.map(t => cleanPhone(t.telefono)));
    const extractedMap = new Map<string, { telefono: string; nombre?: string; origen: string }>();

    // 1. Extraer de Leads
    if (filtroTipoCliente === 'todos' || filtroTipoCliente === 'leads') {
      (leads || []).forEach(l => {
        const linePhone = cleanPhone(l.linea_whatsapp || '');
        if (!asesorPhones.includes(linePhone)) return;
        if (!isWithinPeriod(l.created_at)) return;

        const clientPhone = cleanPhone(l.telefono || '');
        if (clientPhone && clientPhone.length >= 10 && !existingPhones.has(clientPhone)) {
          extractedMap.set(clientPhone, {
            telefono: clientPhone,
            nombre: l.nombre || l.cliente_nombre || undefined,
            origen: `Lead (${asesorObj.nombre})`
          });
        }
      });
    }

    // 2. Extraer de Pedidos
    if (filtroTipoCliente === 'todos' || filtroTipoCliente === 'pedidos') {
      (pedidos || []).forEach(p => {
        const linePhone = cleanPhone(p.linea_whatsapp || '');
        const matchesName = (p.asesor || '').toLowerCase().trim() === asesorObj.nombre.toLowerCase().trim();
        const matchesPhone = asesorPhones.includes(linePhone);

        if (!matchesPhone && !matchesName) return;
        if (!isWithinPeriod(p.created_at)) return;

        const clientPhone = cleanPhone(p.cliente_telefono || '');
        if (clientPhone && clientPhone.length >= 10 && !existingPhones.has(clientPhone)) {
          if (!extractedMap.has(clientPhone)) {
            extractedMap.set(clientPhone, {
              telefono: clientPhone,
              nombre: p.cliente_nombre || undefined,
              origen: `Pedido (${asesorObj.nombre})`
            });
          }
        }
      });
    }

    const itemsToAdd: TarjetaContactoBloqueado[] = Array.from(extractedMap.values()).map((item, idx) => ({
      id: `db_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
      telefono: item.telefono,
      nombre: item.nombre,
      origen: item.origen,
      estado: 'pendiente'
    }));

    if (itemsToAdd.length > 0) {
      saveTarjetasToStorage([...itemsToAdd, ...tarjetas]);
    }
  };

  // ── ACCIÓN: ENVIAR WHATSAPP Y MARCAR CONTACTADO ──
  const handleOpenWhatsApp = (item: TarjetaContactoBloqueado) => {
    const rawTel = cleanPhone(item.telefono);
    const intlPhone = `57${rawTel}`;
    
    // Personalizar mensaje con nombre si existe
    let finalMsg = customMessage;
    if (item.nombre && finalMsg.includes('[Nombre]')) {
      finalMsg = finalMsg.replace('[Nombre]', item.nombre);
    } else if (item.nombre) {
      finalMsg = `¡Hola ${item.nombre}! ${finalMsg.replace(/¡Hola! ?/i, '')}`;
    } else {
      finalMsg = finalMsg.replace('[Nombre]', '').replace(/\s{2,}/g, ' ');
    }

    const url = `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encodeURIComponent(finalMsg)}`;
    window.open(url, '_blank');

    // Marcar como contactado automáticamente
    const updated = tarjetas.map(t => {
      if (t.id === item.id) {
        return {
          ...t,
          estado: 'contactado' as const,
          contactadoAt: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
        };
      }
      return t;
    });
    saveTarjetasToStorage(updated);
  };

  const handleToggleEstado = (id: string) => {
    const updated = tarjetas.map(t => {
      if (t.id === id) {
        const isNowContactado = t.estado !== 'contactado';
        return {
          ...t,
          estado: isNowContactado ? ('contactado' as const) : ('pendiente' as const),
          contactadoAt: isNowContactado 
            ? new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
            : undefined
        };
      }
      return t;
    });
    saveTarjetasToStorage(updated);
  };

  const handleDeleteTarjeta = (id: string) => {
    saveTarjetasToStorage(tarjetas.filter(t => t.id !== id));
  };

  const handleClearAll = () => {
    if (window.confirm('¿Seguro que deseas eliminar todas las tarjetas de la lista?')) {
      saveTarjetasToStorage([]);
    }
  };

  const handleCopySinglePhone = (t: TarjetaContactoBloqueado) => {
    navigator.clipboard.writeText(cleanPhone(t.telefono));
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCopyAllPending = () => {
    const pendingList = tarjetas
      .filter(t => t.estado === 'pendiente')
      .map(t => `${cleanPhone(t.telefono)}${t.nombre ? ` - ${t.nombre}` : ''}`)
      .join('\n');
    
    if (!pendingList) return;
    navigator.clipboard.writeText(pendingList);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // ── ESTADÍSTICAS Y FILTRADO ──
  const stats = useMemo(() => {
    const total = tarjetas.length;
    const contactados = tarjetas.filter(t => t.estado === 'contactado').length;
    const pendientes = total - contactados;
    const pct = total > 0 ? Math.round((contactados / total) * 100) : 0;
    return { total, contactados, pendientes, pct };
  }, [tarjetas]);

  const filteredTarjetas = useMemo(() => {
    return tarjetas.filter(t => {
      if (statusFilter !== 'todos' && t.estado !== statusFilter) return false;
      if (searchFilter) {
        const q = searchFilter.toLowerCase().trim();
        const matchTel = cleanPhone(t.telefono).includes(q);
        const matchName = (t.nombre || '').toLowerCase().includes(q);
        if (!matchTel && !matchName) return false;
      }
      return true;
    });
  }, [tarjetas, statusFilter, searchFilter]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        fontFamily: "'Poppins', sans-serif"
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '920px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
          border: '1.5px solid #fed7aa',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── HEADER MODAL ── */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #fed7aa',
          background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: '#ffedd5',
              color: '#ea580c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.2)'
            }}>
              <PhoneForwarded size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#0f172a' }}>
                  Contactar Números de Línea Bloqueada
                </h3>
                <span style={{
                  padding: '0.15rem 0.55rem',
                  borderRadius: '20px',
                  fontSize: '0.68rem',
                  fontWeight: 500,
                  background: '#fef3c7',
                  color: '#b45309',
                  border: '1px solid #fde68a'
                }}>
                  🚨 Contingencia WhatsApp
                </span>
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Genera tarjetas independientes con acceso directo a WhatsApp para rescatar clientes sin escribirlos a mano.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
              flexShrink: 0
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── CUERPO CON SCROLL ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* SELECCIÓN DE MÉTODO DE CARGA */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setActiveTab('pegar')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '10px',
                  border: activeTab === 'pegar' ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
                  background: activeTab === 'pegar' ? '#fff7ed' : '#ffffff',
                  color: activeTab === 'pegar' ? '#c2410c' : '#475569',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'pegar' ? 600 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                <span>📋 Pegar Listado de Números</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('extraer_db')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '10px',
                  border: activeTab === 'extraer_db' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                  background: activeTab === 'extraer_db' ? '#eff6ff' : '#ffffff',
                  color: activeTab === 'extraer_db' ? '#1d4ed8' : '#475569',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'extraer_db' ? 600 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                <Sparkles size={14} color="#2563eb" />
                <span>⚡ Extraer Automático de Base de Datos</span>
              </button>
            </div>

            {/* TAB: PEGAR NÚMEROS */}
            {activeTab === 'pegar' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                  Copia y pega cualquier texto con números (un chat, notas, Excel o listados desordenados). El sistema extraerá y limpiará cada número automáticamente:
                </p>
                <textarea
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder={`Ejemplo:\n3123456789\nMaria Gómez - 3001234567\n+57 320 987 6543\n3154443322 (Cliente interesado)`}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    fontFamily: "'Courier New', Courier, monospace",
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleProcesarTexto}
                    disabled={!rawText.trim()}
                    style={{
                      padding: '0.55rem 1.25rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: rawText.trim() ? '#ea580c' : '#94a3b8',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: rawText.trim() ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontFamily: "'Poppins', sans-serif"
                    }}
                  >
                    <Plus size={15} />
                    <span>Crear Tarjetas de Contacto</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB: EXTRAER DE BD */}
            {activeTab === 'extraer_db' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                  Selecciona la asesora cuya línea fue bloqueada. El sistema buscará en la base de datos todos los clientes que le escribieron en el período seleccionado:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>
                      Asesora / Línea Bloqueada
                    </label>
                    <select
                      value={selectedAsesorId}
                      onChange={e => setSelectedAsesorId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.8rem',
                        fontFamily: "'Poppins', sans-serif"
                      }}
                    >
                      <option value="">-- Seleccionar Asesora --</option>
                      {asesores.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.nombre} ({a.telefono || 'Sin tel'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>
                      Período de llegada
                    </label>
                    <select
                      value={filtroPeriodo}
                      onChange={e => setFiltroPeriodo(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.8rem',
                        fontFamily: "'Poppins', sans-serif"
                      }}
                    >
                      <option value="hoy">Hoy</option>
                      <option value="ayer">Ayer y Hoy</option>
                      <option value="ultimos_3_dias">Últimos 3 días</option>
                      <option value="ultimos_7_dias">Últimos 7 días</option>
                      <option value="todos">Todo el Histórico</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>
                      Tipo de Registros
                    </label>
                    <select
                      value={filtroTipoCliente}
                      onChange={e => setFiltroTipoCliente(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.8rem',
                        fontFamily: "'Poppins', sans-serif"
                      }}
                    >
                      <option value="todos">Todos (Pedidos y Leads)</option>
                      <option value="leads">Solo Carritos / Leads</option>
                      <option value="pedidos">Solo Pedidos</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleExtraerDeBD}
                    disabled={!selectedAsesorId}
                    style={{
                      padding: '0.55rem 1.25rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: selectedAsesorId ? '#2563eb' : '#94a3b8',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: selectedAsesorId ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontFamily: "'Poppins', sans-serif"
                    }}
                  >
                    <Sparkles size={15} />
                    <span>Extraer Clientes de esta Línea</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* MENSAJE DE WHATSAPP PREDETERMINADO */}
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '14px',
            padding: '0.75rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, color: '#166534' }}>
                <MessageSquare size={15} />
                <span>Mensaje automático al abrir WhatsApp:</span>
              </div>
              <button
                type="button"
                onClick={() => setShowEditMsg(!showEditMsg)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#15803d',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {showEditMsg ? 'Listo' : 'Personalizar mensaje'}
              </button>
            </div>

            {showEditMsg ? (
              <textarea
                value={customMessage}
                onChange={e => saveMessageToStorage(e.target.value)}
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: '1px solid #86efac',
                  fontSize: '0.78rem',
                  fontFamily: "'Poppins', sans-serif",
                  boxSizing: 'border-box'
                }}
              />
            ) : (
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#166534', lineHeight: 1.4, fontStyle: 'italic' }}>
                "{customMessage}"
              </p>
            )}
          </div>

          {/* ── BARRA DE CONTROL Y ESTADÍSTICAS DE TARJETAS ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              
              {/* Badges de conteo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setStatusFilter('todos')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.76rem',
                    fontWeight: statusFilter === 'todos' ? 600 : 500,
                    background: statusFilter === 'todos' ? '#0f172a' : '#f1f5f9',
                    color: statusFilter === 'todos' ? '#ffffff' : '#475569',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Todos ({stats.total})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('pendiente')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.76rem',
                    fontWeight: statusFilter === 'pendiente' ? 600 : 500,
                    background: statusFilter === 'pendiente' ? '#ea580c' : '#ffedd5',
                    color: statusFilter === 'pendiente' ? '#ffffff' : '#c2410c',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  ⏳ Pendientes ({stats.pendientes})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('contactado')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.76rem',
                    fontWeight: statusFilter === 'contactado' ? 600 : 500,
                    background: statusFilter === 'contactado' ? '#16a34a' : '#ecfdf5',
                    color: statusFilter === 'contactado' ? '#ffffff' : '#15803d',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  ✅ Contactados ({stats.contactados})
                </button>
              </div>

              {/* Acciones de lista */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {stats.pendientes > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyAllPending}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#334155',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                    title="Copiar todos los números pendientes"
                  >
                    {copiedAll ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                    <span>{copiedAll ? '¡Copiados!' : 'Copiar Pendientes'}</span>
                  </button>
                )}

                {stats.total > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.7rem',
                      borderRadius: '8px',
                      border: '1px solid #fee2e2',
                      background: '#fef2f2',
                      color: '#dc2626',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                    title="Limpiar todas las tarjetas"
                  >
                    <Trash2 size={13} />
                    <span>Limpiar</span>
                  </button>
                )}
              </div>
            </div>

            {/* Barra de progreso */}
            {stats.total > 0 && (
              <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '10px', height: '7px', overflow: 'hidden' }}>
                <div style={{
                  width: `${stats.pct}%`,
                  background: stats.pct === 100 ? '#10b981' : '#ea580c',
                  height: '100%',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            )}

            {/* Buscador de tarjetas */}
            {tarjetas.length > 5 && (
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Buscar en las tarjetas por número o nombre..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.78rem',
                    fontFamily: "'Poppins', sans-serif",
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}
          </div>

          {/* ── GRID DE TARJETAS INDEPENDIENTES (Lo pedido por el usuario) ── */}
          {filteredTarjetas.length === 0 ? (
            <div style={{
              padding: '2.5rem 1rem',
              textAlign: 'center',
              background: '#f8fafc',
              borderRadius: '16px',
              border: '1.5px dashed #cbd5e1'
            }}>
              <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>📇</div>
              <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem', fontWeight: 600, color: '#334155' }}>
                {tarjetas.length === 0 ? 'No hay tarjetas de contacto todavía' : 'No hay números con este filtro'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                {tarjetas.length === 0 
                  ? 'Pega un listado de números arriba o extráelos automáticamente desde la base de datos de la asesora.' 
                  : 'Prueba cambiando el filtro de estado o el término de búsqueda.'}
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '0.85rem'
            }}>
              {filteredTarjetas.map((item, index) => {
                const isContacted = item.estado === 'contactado';
                return (
                  <div
                    key={item.id}
                    style={{
                      background: isContacted ? '#f0fdf4' : '#ffffff',
                      borderRadius: '16px',
                      padding: '1rem',
                      border: `1.5px solid ${isContacted ? '#86efac' : '#fed7aa'}`,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      position: 'relative'
                    }}
                  >
                    {/* Encabezado de la tarjeta: Nombre / Origen y Badge */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>
                            #{index + 1}
                          </span>
                          <h4 style={{
                            margin: 0,
                            fontSize: '0.86rem',
                            fontWeight: 600,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {item.nombre || 'Cliente WhatsApp'}
                          </h4>
                        </div>
                        {item.origen && (
                          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                            {item.origen}
                          </span>
                        )}
                      </div>

                      {/* Botón borrar tarjeta */}
                      <button
                        type="button"
                        onClick={() => handleDeleteTarjeta(item.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#cbd5e1',
                          cursor: 'pointer',
                          padding: '0.2rem',
                          borderRadius: '6px'
                        }}
                        title="Eliminar esta tarjeta"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Teléfono formateado con botón de copiar */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isContacted ? '#ffffff' : '#fff7ed',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '10px',
                      border: `1px solid ${isContacted ? '#bbf7d0' : '#ffedd5'}`
                    }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1e293b', letterSpacing: '0.3px' }}>
                        {formatDisplayPhone(item.telefono)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopySinglePhone(item)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedId === item.id ? '#16a34a' : '#64748b',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontSize: '0.68rem',
                          padding: 0
                        }}
                        title="Copiar número"
                      >
                        {copiedId === item.id ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                      </button>
                    </div>

                    {/* Estado de contacto */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.72rem',
                        fontWeight: 500,
                        color: isContacted ? '#15803d' : '#c2410c'
                      }}>
                        {isContacted ? (
                          <>
                            <CheckCircle2 size={13} color="#16a34a" />
                            <span>Contactado {item.contactadoAt ? `a las ${item.contactadoAt}` : ''}</span>
                          </>
                        ) : (
                          <>
                            <Clock size={13} color="#ea580c" />
                            <span>Pendiente de escribir</span>
                          </>
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleToggleEstado(item.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          fontSize: '0.68rem',
                          textDecoration: 'underline',
                          cursor: 'pointer'
                        }}
                      >
                        {isContacted ? 'Marcar pendiente' : 'Ya contactado'}
                      </button>
                    </div>

                    {/* BOTÓN PRIMARIO DE WHATSAPP */}
                    <button
                      type="button"
                      onClick={() => handleOpenWhatsApp(item)}
                      style={{
                        marginTop: '0.2rem',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '12px',
                        border: 'none',
                        background: '#16a34a',
                        color: '#ffffff',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        boxShadow: '0 3px 10px rgba(22, 163, 74, 0.28)',
                        fontFamily: "'Poppins', sans-serif",
                        transition: 'transform 0.15s ease'
                      }}
                    >
                      <MessageSquare size={15} />
                      <span>{isContacted ? 'Escribir de nuevo' : '📲 Escribir por WhatsApp'}</span>
                      <ExternalLink size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* ── FOOTER MODAL ── */}
        <div style={{
          padding: '0.85rem 1.5rem',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            💾 Guardado local automático: tus tarjetas no se borran al cerrar esta ventana.
          </span>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 1.25rem',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif"
            }}
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
