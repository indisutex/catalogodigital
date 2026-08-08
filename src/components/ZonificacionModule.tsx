import { useState, useMemo } from 'react';
import { Search, MapPin, Check, ShieldCheck } from 'lucide-react';
import { DEPARTAMENTOS_COLOMBIA, TODAS_LAS_CIUDADES_COLOMBIA } from '../data/colombiaData';

interface Props {
  configuracion?: any;
}

export default function ZonificacionModule({ configuracion: _configuracion }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepto, setSelectedDepto] = useState<string>('TODOS');
  const [disabledCities, setDisabledCities] = useState<Set<string>>(new Set());
  const [tarifasEnvio, setTarifasEnvio] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Estadísticas
  const totalDepartamentos = Object.keys(DEPARTAMENTOS_COLOMBIA).length;
  const totalCiudades = TODAS_LAS_CIUDADES_COLOMBIA.length;
  const ciudadesActivasCount = totalCiudades - disabledCities.size;

  const filteredCiudades = useMemo(() => {
    return TODAS_LAS_CIUDADES_COLOMBIA.filter(item => {
      const matchDepto = selectedDepto === 'TODOS' || item.departamento === selectedDepto;
      const matchSearch = searchTerm === '' || 
        item.ciudad.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.departamento.toLowerCase().includes(searchTerm.toLowerCase());
      return matchDepto && matchSearch;
    });
  }, [searchTerm, selectedDepto]);

  const toggleCity = (ciudadNombre: string) => {
    setDisabledCities(prev => {
      const next = new Set(prev);
      if (next.has(ciudadNombre)) {
        next.delete(ciudadNombre);
      } else {
        next.add(ciudadNombre);
      }
      return next;
    });
  };

  const setAllInDepto = (depto: string, enable: boolean) => {
    const municipios = DEPARTAMENTOS_COLOMBIA[depto] || [];
    setDisabledCities(prev => {
      const next = new Set(prev);
      municipios.forEach(m => {
        const key = `${m}, ${depto}`;
        if (enable) {
          next.delete(key);
        } else {
          next.add(key);
        }
      });
      return next;
    });
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSuccessMsg('¡Configuración de zonificación y cobertura guardada correctamente!');
      setTimeout(() => setSuccessMsg(''), 4000);
    }, 600);
  };

  return (
    <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
      {/* HEADER Y ESTADÍSTICAS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={24} color="var(--primary-color, #0ea5e9)" /> Cobertura de Envíos en Colombia
          </h3>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.86rem', color: '#64748b' }}>
            Gestiona los 32 departamentos y municipios de Colombia con su tarifa y estado de cobertura.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '0.75rem 1.4rem',
            borderRadius: '12px',
            background: 'var(--primary-color, #6366f1)',
            color: '#ffffff',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
          }}
        >
          <Check size={18} /> {saving ? 'Guardando...' : 'Guardar Cobertura'}
        </button>
      </div>

      {successMsg && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.88rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={18} color="#059669" /> {successMsg}
        </div>
      )}

      {/* METRIC BADGES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Departamentos Colombia</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>{totalDepartamentos}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Municipios Registrados</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>{totalCiudades}</div>
        </div>
        <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>Ciudades con Cobertura Activa</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d', marginTop: '0.2rem' }}>{ciudadesActivasCount}</div>
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar ciudad, municipio o departamento..."
            style={{ width: '100%', padding: '0.65rem 0.85rem 0.65rem 2.2rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
          />
        </div>

        <select
          value={selectedDepto}
          onChange={e => setSelectedDepto(e.target.value)}
          style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', background: '#ffffff', color: '#0f172a', fontWeight: 600 }}
        >
          <option value="TODOS">Todos los Departamentos ({totalDepartamentos})</option>
          {Object.keys(DEPARTAMENTOS_COLOMBIA).map(depto => (
            <option key={depto} value={depto}>{depto} ({DEPARTAMENTOS_COLOMBIA[depto].length} municipios)</option>
          ))}
        </select>

        {selectedDepto !== 'TODOS' && (
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => setAllInDepto(selectedDepto, true)}
              style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #a7f3d0', background: '#ecfdf5', color: '#047857', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
            >
              ✓ Habilitar Todo {selectedDepto}
            </button>
            <button
              type="button"
              onClick={() => setAllInDepto(selectedDepto, false)}
              style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fff5f5', color: '#b91c1c', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
            >
              ✕ Deshabilitar Todo {selectedDepto}
            </button>
          </div>
        )}
      </div>

      {/* LISTADO DE CIUDADES */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', maxHeight: '550px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
              <th style={{ padding: '0.75rem 1rem' }}>Ciudad / Municipio</th>
              <th style={{ padding: '0.75rem 1rem' }}>Departamento</th>
              <th style={{ padding: '0.75rem 1rem' }}>Tarifa Envío ($ COP)</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Cobertura</th>
            </tr>
          </thead>
          <tbody>
            {filteredCiudades.slice(0, 150).map((item, idx) => {
              const key = item.ciudad;
              const isEnabled = !disabledCities.has(key);
              return (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: isEnabled ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ padding: '0.7rem 1rem', fontWeight: 700, color: isEnabled ? '#0f172a' : '#94a3b8' }}>
                    📍 {item.ciudad.split(',')[0]}
                  </td>
                  <td style={{ padding: '0.7rem 1rem', color: '#64748b' }}>
                    {item.departamento}
                  </td>
                  <td style={{ padding: '0.7rem 1rem' }}>
                    <input
                      type="number"
                      placeholder="12000"
                      value={tarifasEnvio[key] || ''}
                      onChange={e => setTarifasEnvio({ ...tarifasEnvio, [key]: Number(e.target.value) })}
                      style={{ width: '110px', padding: '0.35rem 0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none' }}
                    />
                  </td>
                  <td style={{ padding: '0.7rem 1rem', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => toggleCity(key)}
                      style={{
                        padding: '0.3rem 0.75rem',
                        borderRadius: '20px',
                        border: 'none',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: isEnabled ? '#d1fae5' : '#fee2e2',
                        color: isEnabled ? '#047857' : '#b91c1c',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isEnabled ? '✓ Habilitado' : '✕ Deshabilitado'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
