import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  Users, 
  UserCheck, 
  Calendar, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  FileSpreadsheet,
  Check,
  X
} from 'lucide-react';
import type { Asesor, RegistroAsistencia } from '../../types';
import { asistenciaService, type AsistenciaFilters } from '../../lib/asistenciaService';

interface ControlAsistenciaAdminProps {
  tenantId: string;
  tenantName: string;
  asesores: Asesor[];
}

export const ControlAsistenciaAdmin: React.FC<ControlAsistenciaAdminProps> = ({
  tenantId,
  tenantName,
  asesores
}) => {
  const [registros, setRegistros] = useState<RegistroAsistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros
  const [periodPreset, setPeriodPreset] = useState<'hoy' | 'ayer' | 'semana' | 'mes' | 'personalizado'>('hoy');
  const [fechaDesde, setFechaDesde] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [fechaHasta, setFechaHasta] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedAsesorId, setSelectedAsesorId] = useState<string>('todos');
  const [selectedEstado, setSelectedEstado] = useState<'todos' | 'activo' | 'finalizado' | 'sin_salida'>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal para cerrar jornada manualmente por admin
  const [selectedRegistroToClose, setSelectedRegistroToClose] = useState<RegistroAsistencia | null>(null);
  const [adminManualSalidaHora, setAdminManualSalidaHora] = useState<string>('');
  const [adminManualObservacion, setAdminManualObservacion] = useState<string>('');
  const [closingJornada, setClosingJornada] = useState(false);

  // Calcular fechas según preset
  const handlePresetChange = (preset: 'hoy' | 'ayer' | 'semana' | 'mes' | 'personalizado') => {
    setPeriodPreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'hoy') {
      setFechaDesde(todayStr);
      setFechaHasta(todayStr);
    } else if (preset === 'ayer') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split('T')[0];
      setFechaDesde(yStr);
      setFechaHasta(yStr);
    } else if (preset === 'semana') {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay(); // 0 is Sunday
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
      startOfWeek.setDate(diff);
      setFechaDesde(startOfWeek.toISOString().split('T')[0]);
      setFechaHasta(todayStr);
    } else if (preset === 'mes') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setFechaDesde(startOfMonth.toISOString().split('T')[0]);
      setFechaHasta(todayStr);
    }
  };

  // Cargar datos
  const cargarAsistencia = async () => {
    try {
      setRefreshing(true);
      const filters: AsistenciaFilters = {
        fechaDesde,
        fechaHasta,
        asesorId: selectedAsesorId !== 'todos' ? selectedAsesorId : undefined,
        estado: selectedEstado !== 'todos' ? selectedEstado : undefined,
        busqueda: searchQuery.trim() || undefined
      };
      const data = await asistenciaService.obtenerRegistros(tenantId, filters);
      setRegistros(data);
    } catch (err) {
      console.error('Error cargando asistencia:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    cargarAsistencia();
  }, [tenantId, fechaDesde, fechaHasta, selectedAsesorId, selectedEstado]);

  // Manejar búsqueda en tiempo real
  const registrosFiltrados = useMemo(() => {
    if (!searchQuery.trim()) return registros;
    const q = searchQuery.toLowerCase().trim();
    return registros.filter(r => 
      r.asesor_nombre.toLowerCase().includes(q) ||
      r.asesor_telefono.includes(q) ||
      (r.observaciones && r.observaciones.toLowerCase().includes(q))
    );
  }, [registros, searchQuery]);

  // Cálculos para KPIs Resumen
  const kpis = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    // Total de asesores activos ahora (en turno en tiempo real)
    const activosAhora = registros.filter(r => r.estado === 'activo' && !r.hora_salida).length;

    // Asesores que ya ingresaron hoy (únicos)
    const hoyRecords = registros.filter(r => r.fecha === todayStr);
    const uniqueAsesoresHoy = new Set(hoyRecords.map(r => r.asesor_id)).size;

    // Total jornadas finalizadas en el filtro
    const finalizadas = registrosFiltrados.filter(r => r.estado === 'finalizado').length;

    // Asesores sin marcar salida (jornadas de fechas anteriores a hoy que siguen en 'activo')
    const sinMarcarSalida = registros.filter(r => r.estado === 'activo' && r.fecha < todayStr).length;

    // Suma total de minutos trabajados en el filtro
    const totalMinutos = registrosFiltrados.reduce((acc, r) => {
      if (r.duracion_minutos) {
        return acc + r.duracion_minutos;
      }
      if (r.estado === 'activo' && r.hora_entrada) {
        const diff = Math.max(0, Date.now() - new Date(r.hora_entrada).getTime());
        return acc + Math.floor(diff / 60000);
      }
      return acc;
    }, 0);

    const totalHorasStr = asistenciaService.formatearDuracion(totalMinutos);

    return {
      activosAhora,
      uniqueAsesoresHoy,
      finalizadas,
      sinMarcarSalida,
      totalHorasStr
    };
  }, [registros, registrosFiltrados]);

  // Exportar a Excel
  const handleExportarExcel = () => {
    const rangoTexto = `${fechaDesde} a ${fechaHasta}`;
    asistenciaService.exportarReporteExcel(registrosFiltrados, tenantName, rangoTexto);
  };

  // Cierre manual por administrador
  const handleCerrarJornadaManual = async () => {
    if (!selectedRegistroToClose) return;
    try {
      setClosingJornada(true);
      await asistenciaService.cerrarJornadaAdmin(
        selectedRegistroToClose.id,
        tenantId,
        adminManualSalidaHora || undefined,
        adminManualObservacion || undefined
      );
      setSelectedRegistroToClose(null);
      setAdminManualSalidaHora('');
      setAdminManualObservacion('');
      cargarAsistencia();
    } catch (err) {
      console.error(err);
      alert('Error al cerrar la jornada manualmente');
    } finally {
      setClosingJornada(false);
    }
  };

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", paddingBottom: '2.5rem' }}>
      {/* ── ENCABEZADO DE SECCIÓN ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          background: '#ffffff',
          padding: '1.25rem 1.5rem',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#ecfdf5',
                color: '#10b981',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Clock size={18} />
            </span>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 600, color: '#0f172a' }}>
              Control de Asistencia y Jornadas Laborales
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b', fontWeight: 400 }}>
            Supervisa en tiempo real las horas de entrada, salida y duración de turno de tu equipo de asesores.
          </p>
        </div>

        {/* Botones de acción principales */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={cargarAsistencia}
            disabled={refreshing}
            style={{
              padding: '0.55rem 0.9rem',
              background: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderRadius: '10px',
              fontSize: '0.8rem',
              color: '#334155',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontFamily: "'Poppins', sans-serif"
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>Actualizar</span>
          </button>

          <button
            type="button"
            onClick={handleExportarExcel}
            style={{
              padding: '0.55rem 1rem',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              fontFamily: "'Poppins', sans-serif"
            }}
          >
            <FileSpreadsheet size={15} />
            <span>Exportar Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* ── TARJETAS DE RESUMEN (KPIS) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        {/* KPI 1: Activos Ahora */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #bbf7d0',
            padding: '1.1rem 1.25rem',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#ecfdf5',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              position: 'relative'
            }}
          >
            <Users size={22} />
            <span
              style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 0 2px #ecfdf5'
              }}
            />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500, display: 'block' }}>
              En turno ahora
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 600, color: '#047857' }}>
                {kpis.activosAhora}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 500 }}>
                {kpis.activosAhora === 1 ? 'asesor activo' : 'asesores activos'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: Ingresos Hoy */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #bfdbfe',
            padding: '1.1rem 1.25rem',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#eff6ff',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <UserCheck size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500, display: 'block' }}>
              Ingresaron hoy
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 600, color: '#1d4ed8' }}>
                {kpis.uniqueAsesoresHoy}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 500 }}>
                {kpis.uniqueAsesoresHoy === 1 ? 'asesor registrado' : 'asesores registrados'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Jornadas Finalizadas */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '1.1rem 1.25rem',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#f8fafc',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500, display: 'block' }}>
              Turnos finalizados
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 600, color: '#0f172a' }}>
                {kpis.finalizadas}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
                en el periodo
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Sin Marcar Salida */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: kpis.sinMarcarSalida > 0 ? '1.5px solid #fed7aa' : '1px solid #e2e8f0',
            padding: '1.1rem 1.25rem',
            boxShadow: '0 2px 8px rgba(234, 88, 12, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: kpis.sinMarcarSalida > 0 ? '#fff7ed' : '#f8fafc',
              color: kpis.sinMarcarSalida > 0 ? '#ea580c' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <AlertCircle size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500, display: 'block' }}>
              Pendientes de salida
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 600, color: kpis.sinMarcarSalida > 0 ? '#c2410c' : '#64748b' }}>
                {kpis.sinMarcarSalida}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#ea580c', fontWeight: 500 }}>
                días previos
              </span>
            </div>
          </div>
        </div>

        {/* KPI 5: Horas Trabajadas */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '1.1rem 1.25rem',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#f8fafc',
              color: '#0ea5e9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Clock size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500, display: 'block' }}>
              Horas laboradas
            </span>
            <span style={{ fontSize: '1.35rem', fontWeight: 600, color: '#0369a1', display: 'block' }}>
              {kpis.totalHorasStr}
            </span>
          </div>
        </div>
      </div>

      {/* ── BARRA DE FILTROS AVANZADOS ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}
      >
        {/* Fila 1: Presets de Periodo y Fechas */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', marginRight: '0.25rem' }}>
              <Calendar size={14} /> Periodo:
            </span>

            {(['hoy', 'ayer', 'semana', 'mes', 'personalizado'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => handlePresetChange(p)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  border: periodPreset === p ? 'none' : '1px solid #cbd5e1',
                  background: periodPreset === p ? '#0ea5e9' : '#ffffff',
                  color: periodPreset === p ? '#ffffff' : '#475569',
                  fontSize: '0.75rem',
                  fontWeight: periodPreset === p ? 600 : 500,
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif",
                  transition: 'all 0.15s ease'
                }}
              >
                {p === 'hoy' ? 'Hoy' : p === 'ayer' ? 'Ayer' : p === 'semana' ? 'Esta semana' : p === 'mes' ? 'Este mes' : 'Personalizado'}
              </button>
            ))}
          </div>

          {/* Selector de Rango Personalizado */}
          {periodPreset === 'personalizado' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Desde:</span>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={e => setFechaDesde(e.target.value)}
                  style={{
                    padding: '0.35rem 0.6rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.78rem',
                    fontFamily: "'Poppins', sans-serif"
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Hasta:</span>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={e => setFechaHasta(e.target.value)}
                  style={{
                    padding: '0.35rem 0.6rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.78rem',
                    fontFamily: "'Poppins', sans-serif"
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Fila 2: Selectores de Asesor, Estado y Campo de Búsqueda */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '0.65rem', borderTop: '1px solid #f1f5f9' }}>
          {/* Asesor */}
          <div style={{ minWidth: '180px', flex: 1 }}>
            <select
              value={selectedAsesorId}
              onChange={e => setSelectedAsesorId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.78rem',
                color: '#334155',
                background: '#ffffff',
                fontFamily: "'Poppins', sans-serif",
                cursor: 'pointer'
              }}
            >
              <option value="todos">👤 Todos los asesores ({asesores.length})</option>
              {asesores.map(a => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div style={{ minWidth: '160px' }}>
            <select
              value={selectedEstado}
              onChange={e => setSelectedEstado(e.target.value as any)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.78rem',
                color: '#334155',
                background: '#ffffff',
                fontFamily: "'Poppins', sans-serif",
                cursor: 'pointer'
              }}
            >
              <option value="todos">⚡ Todos los estados</option>
              <option value="activo">🟢 En turno activo</option>
              <option value="finalizado">🏁 Finalizados</option>
              <option value="sin_salida">⚠️ Sin marcar salida</option>
            </select>
          </div>

          {/* Buscador de texto */}
          <div style={{ minWidth: '220px', flex: 1.5, position: 'relative' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Buscar por asesor, teléfono u observación..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem 0.5rem 2rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.78rem',
                fontFamily: "'Poppins', sans-serif",
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── TABLA DE REGISTROS DE ASISTENCIA ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
          overflow: 'hidden'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Asesor</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Fecha</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Hora Entrada</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Hora Salida</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Duración</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Estado</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Observaciones</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                      <RefreshCw size={18} className="spin" />
                      <span>Cargando registros de asistencia...</span>
                    </div>
                  </td>
                </tr>
              ) : registrosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ maxWidth: '320px', margin: '0 auto' }}>
                      <Clock size={36} color="#cbd5e1" style={{ marginBottom: '0.5rem' }} />
                      <h4 style={{ margin: '0 0 0.35rem 0', color: '#475569', fontWeight: 600, fontSize: '0.95rem' }}>
                        No hay registros para este periodo
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                        Ningún asesor ha marcado entrada en las fechas o filtros seleccionados.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                registrosFiltrados.map(r => {
                  const matchingAsesor = asesores.find(a => a.id === r.asesor_id);
                  const isActivo = r.estado === 'activo' && !r.hora_salida;
                  const entrada12 = asistenciaService.formatearHora12(r.hora_entrada);
                  const salida12 = r.hora_salida ? asistenciaService.formatearHora12(r.hora_salida) : null;
                  const duracionStr = r.duracion_minutos 
                    ? asistenciaService.formatearDuracion(r.duracion_minutos) 
                    : (isActivo ? asistenciaService.calcularTiempoTranscurrido(r.hora_entrada) : '--');

                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.1s ease'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = '#ffffff';
                      }}
                    >
                      {/* Asesor */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          {matchingAsesor?.foto_url ? (
                            <img
                              src={matchingAsesor.foto_url}
                              alt={r.asesor_nombre}
                              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid #e2e8f0' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: '#e0e7ff',
                                color: '#4338ca',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                flexShrink: 0
                              }}
                            >
                              {r.asesor_nombre.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span style={{ fontWeight: 600, color: '#0f172a', display: 'block', fontSize: '0.84rem' }}>
                              {r.asesor_nombre}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>
                              📞 {r.asesor_telefono || 'Sin teléfono'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Fecha */}
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: '#334155' }}>
                        {r.fecha}
                      </td>

                      {/* Entrada */}
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                          <strong style={{ fontWeight: 600, color: '#065f46' }}>{entrada12}</strong>
                        </div>
                      </td>

                      {/* Salida */}
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                        {salida12 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                            <strong style={{ fontWeight: 600, color: '#991b1b' }}>{salida12}</strong>
                          </div>
                        ) : (
                          <span
                            style={{
                              background: '#f0fdf4',
                              color: '#15803d',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 500,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
                            En jornada
                          </span>
                        )}
                      </td>

                      {/* Duración */}
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 500, color: isActivo ? '#0284c7' : '#334155', fontSize: '0.82rem' }}>
                          ⏱️ {duracionStr}
                        </span>
                      </td>

                      {/* Estado */}
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                        {isActivo ? (
                          <span
                            style={{
                              background: '#ecfdf5',
                              color: '#065f46',
                              border: '1px solid #a7f3d0',
                              borderRadius: '8px',
                              padding: '0.2rem 0.55rem',
                              fontSize: '0.72rem',
                              fontWeight: 500
                            }}
                          >
                            🟢 Activo
                          </span>
                        ) : r.estado === 'finalizado' ? (
                          <span
                            style={{
                              background: '#f1f5f9',
                              color: '#475569',
                              border: '1px solid #cbd5e1',
                              borderRadius: '8px',
                              padding: '0.2rem 0.55rem',
                              fontSize: '0.72rem',
                              fontWeight: 500
                            }}
                          >
                            ✓ Finalizado
                          </span>
                        ) : (
                          <span
                            style={{
                              background: '#fff7ed',
                              color: '#c2410c',
                              border: '1px solid #fed7aa',
                              borderRadius: '8px',
                              padding: '0.2rem 0.55rem',
                              fontSize: '0.72rem',
                              fontWeight: 500
                            }}
                          >
                            ⚠️ Sin salida
                          </span>
                        )}
                      </td>

                      {/* Observaciones */}
                      <td style={{ padding: '0.75rem 1rem', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748b' }} title={r.observaciones || ''}>
                        {r.observaciones || '--'}
                      </td>

                      {/* Acciones */}
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {isActivo && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRegistroToClose(r);
                              setAdminManualSalidaHora(new Date().toISOString().substring(0, 16));
                            }}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              color: '#0f172a',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '8px',
                              fontSize: '0.72rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              fontFamily: "'Poppins', sans-serif"
                            }}
                            title="Finalizar turno manualmente como administrador"
                          >
                            Finalizar turno
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer de la tabla con totalizador */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.76rem',
            color: '#64748b'
          }}
        >
          <span>Mostrando <strong>{registrosFiltrados.length}</strong> registro(s)</span>
          <span>Horas totales en vista: <strong style={{ color: '#0f172a' }}>{kpis.totalHorasStr}</strong></span>
        </div>
      </div>

      {/* ── MODAL DE ADMINISTRADOR: FINALIZAR TURNO MANUALMENTE ── */}
      {selectedRegistroToClose && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1rem',
            fontFamily: "'Poppins', sans-serif"
          }}
          onClick={() => !closingJornada && setSelectedRegistroToClose(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '460px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #f1f5f9'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: '#f0fdf4',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Clock size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>
                  Cerrar Jornada de Asesor
                </h3>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Asesor: <strong>{selectedRegistroToClose.asesor_nombre}</strong>
                </p>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Fecha de entrada:</span>
                <strong style={{ color: '#0f172a' }}>{selectedRegistroToClose.fecha}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Hora de entrada:</span>
                <strong style={{ color: '#065f46' }}>{asistenciaService.formatearHora12(selectedRegistroToClose.hora_entrada)}</strong>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#334155', marginBottom: '0.35rem' }}>
                Fecha y Hora de Salida:
              </label>
              <input
                type="datetime-local"
                value={adminManualSalidaHora}
                onChange={e => setAdminManualSalidaHora(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  fontFamily: "'Poppins', sans-serif",
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#334155', marginBottom: '0.35rem' }}>
                Observación del Administrador:
              </label>
              <input
                type="text"
                placeholder="Ej. Cierre manual por olvido de marcación"
                value={adminManualObservacion}
                onChange={e => setAdminManualObservacion(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  fontFamily: "'Poppins', sans-serif",
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                type="button"
                disabled={closingJornada}
                onClick={() => setSelectedRegistroToClose(null)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={closingJornada}
                onClick={handleCerrarJornadaManual}
                style={{
                  flex: 1.3,
                  padding: '0.75rem',
                  background: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: closingJornada ? 'not-allowed' : 'pointer',
                  fontFamily: "'Poppins', sans-serif",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem'
                }}
              >
                <Check size={16} />
                <span>{closingJornada ? 'Guardando...' : 'Confirmar Cierre'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
