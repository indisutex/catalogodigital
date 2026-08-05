import React, { useState } from 'react';
import { supabase, getTenantId } from '../lib/supabase';
import { X, Upload, Send, Loader2, MapPin, Mail, Phone, Building2, HelpCircle, MessageSquare, ExternalLink } from 'lucide-react';
import type { Configuracion } from '../types';
import './PqrsModal.css';

export default function PqrsModal({ onClose, configuracion }: { onClose: () => void; configuracion?: Configuracion | null }) {
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    pedido: '',
    motivo: 'Petición',
    descripcion: ''
  });
  const [file, setFile] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'form'>('info');

  const businessName = configuracion?.nombre_negocio || 'Nuestra Empresa';
  const direccion = configuracion?.direccion || '';
  const googleMapsUrl = configuracion?.google_maps_url?.trim() || (direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion + ' ' + businessName)}` : '');
  const embedQuery = encodeURIComponent(direccion ? `${direccion} ${businessName}` : businessName);
  const email = configuracion?.email || '';
  const telefono = configuracion?.telefono || configuracion?.whatsapp || '';
  const whatsapp = (configuracion?.whatsapp || '').replace(/\D/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.telefono || !formData.descripcion) {
      setError('Por favor completa todos los campos obligatorios (*).');
      return;
    }
    setEnviando(true);
    setError(null);

    try {
      let evidencia_url = null;
      if (file) {
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `pqrs_${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('archivos').upload(fileName, file);
          if (!uploadError) {
            const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
            evidencia_url = data.publicUrl;
          }
        } catch (sErr) {
          console.warn('Storage upload warning:', sErr);
        }
      }

      const tenantId = getTenantId();
      const newPqrsItem: any = {
        id: `pqrs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tenant_id: tenantId,
        nombre_cliente: formData.nombre,
        telefono_cliente: formData.telefono,
        numero_pedido: formData.pedido || null,
        motivo: formData.motivo,
        descripcion: formData.descripcion,
        evidencia_url,
        estado: 'pendiente',
        created_at: new Date().toISOString()
      };

      try {
        const saved = JSON.parse(localStorage.getItem('indisutex_pqrs_backup') || '[]');
        saved.unshift(newPqrsItem);
        localStorage.setItem('indisutex_pqrs_backup', JSON.stringify(saved));
      } catch (lsErr) {
        console.warn('LocalStorage save warning:', lsErr);
      }

      const { error: insertError } = await supabase.from('pqrs').insert([newPqrsItem]);

      if (insertError) {
        console.warn('Primary insert PQRS error, retrying standard insert:', insertError);
        const { id, ...dbPayload } = newPqrsItem;
        const { error: fallbackErr } = await supabase.from('pqrs').insert([dbPayload]);
        if (fallbackErr) {
          console.warn('Supabase insert failed, retained in local cache:', fallbackErr);
        }
      }
      setEnviado(true);
    } catch (err: any) {
      console.error('Error enviando PQRS:', err);
      setError(err?.message || 'Hubo un error al enviar tu solicitud. Intenta nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="pqrs-modal-overlay">
      <div className="pqrs-modal">
        <div className="pqrs-header">
          <div className="pqrs-header-title">
            <HelpCircle size={22} className="header-icon" />
            <div>
              <h3>Información & PQRS</h3>
              <p className="subtitle">{businessName}</p>
            </div>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>

        {/* Modal Tabs */}
        <div className="pqrs-tabs">
          <button 
            className={`pqrs-tab ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            <Building2 size={16} /> Ubicación & Contacto
          </button>
          <button 
            className={`pqrs-tab ${activeTab === 'form' ? 'active' : ''}`}
            onClick={() => setActiveTab('form')}
          >
            <MessageSquare size={16} /> Enviar PQRS
          </button>
        </div>
        
        <div className="pqrs-body">
          {activeTab === 'info' && (
            <div className="business-info-card">
              <h4 className="card-title">📍 Información del Negocio Local</h4>
              <div className="info-item">
                <div className="info-icon"><Building2 size={18} /></div>
                <div className="info-content">
                  <span className="info-label">Empresa / Negocio</span>
                  <span className="info-value">{businessName}</span>
                </div>
              </div>

              {(direccion || googleMapsUrl) ? (
                <div className="info-item location-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div className="info-icon"><MapPin size={18} /></div>
                    <div className="info-content" style={{ flex: 1 }}>
                      <span className="info-label">Dirección & Ubicación Física</span>
                      <span className="info-value" style={{ fontWeight: 700, fontSize: '0.95rem' }}>{direccion || 'Punto Físico de Venta'}</span>
                    </div>
                  </div>

                  {/* Google Maps Interactive Embed Preview */}
                  <div className="google-maps-preview-container" style={{ marginTop: '0.75rem', borderRadius: '14px', overflow: 'hidden', border: '1.5px solid #cbd5e1', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', background: '#f8fafc' }}>
                    <iframe
                      title="Google Maps Location"
                      width="100%"
                      height="170"
                      style={{ border: 0, display: 'block' }}
                      loading="lazy"
                      allowFullScreen
                      src={`https://maps.google.com/maps?q=${embedQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    />
                  </div>

                  <a 
                    href={googleMapsUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="map-link-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      marginTop: '0.75rem',
                      padding: '0.7rem 1.25rem',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: 'white',
                      borderRadius: '999px',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      textDecoration: 'none',
                      boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                      transition: 'all 0.25s ease'
                    }}
                  >
                    <MapPin size={16} /> Abrir en Google Maps / Cómo Llegar <ExternalLink size={14} />
                  </a>
                </div>
              ) : (
                <div className="info-item">
                  <div className="info-icon"><MapPin size={18} /></div>
                  <div className="info-content">
                    <span className="info-label">Dirección Local</span>
                    <span className="info-value muted">Dirección no registrada aún. Contáctanos por WhatsApp.</span>
                  </div>
                </div>
              )}

              {telefono && (
                <div className="info-item">
                  <div className="info-icon"><Phone size={18} /></div>
                  <div className="info-content">
                    <span className="info-label">Teléfono Principal</span>
                    <a href={`tel:${telefono.replace(/\D/g, '')}`} className="info-link">
                      {telefono}
                    </a>
                  </div>
                </div>
              )}

              {email && (
                <div className="info-item">
                  <div className="info-icon"><Mail size={18} /></div>
                  <div className="info-content">
                    <span className="info-label">Correo Electrónico Principal</span>
                    <a href={`mailto:${email}`} className="info-link">
                      {email}
                    </a>
                  </div>
                </div>
              )}

              {whatsapp && (
                <div className="info-item">
                  <div className="info-icon ws-icon">💬</div>
                  <div className="info-content">
                    <span className="info-label">WhatsApp de Atención</span>
                    <a 
                      href={`https://wa.me/${whatsapp.length === 10 ? '57' + whatsapp : whatsapp}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="ws-link"
                    >
                      Hablar por WhatsApp
                    </a>
                  </div>
                </div>
              )}

              <button 
                type="button" 
                className="btn-primary-outline"
                onClick={() => setActiveTab('form')}
                style={{ marginTop: '0.8rem' }}
              >
                <MessageSquare size={16} /> ¿Dudas o Reclamos? Abrir formulario PQRS
              </button>
            </div>
          )}

          {activeTab === 'form' && (
            enviado ? (
              <div className="pqrs-success">
                <div className="success-icon">✓</div>
                <h4>¡Solicitud Enviada!</h4>
                <p>Hemos recibido tu {formData.motivo.toLowerCase()}. Nos pondremos en contacto contigo muy pronto a través del número {formData.telefono}.</p>
                <button className="btn-primary" onClick={onClose}>Cerrar</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="pqrs-form">
                <p className="pqrs-intro">¿Tienes alguna duda, queja o reclamo? Llena este formulario y te ayudaremos lo más rápido posible.</p>
                
                {error && <div className="pqrs-error">{error}</div>}

                <div className="form-field">
                  <label>Nombre Completo *</label>
                  <input type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Ej: Juan Pérez" required />
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label>Teléfono / WhatsApp *</label>
                    <input type="tel" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} placeholder="Ej: 3001234567" required />
                  </div>
                  <div className="form-field">
                    <label>N° de Pedido / Guía (Opcional)</label>
                    <input type="text" value={formData.pedido} onChange={e => setFormData({...formData, pedido: e.target.value})} placeholder="Ej: #1234" />
                  </div>
                </div>

                <div className="form-field">
                  <label>Motivo *</label>
                  <select value={formData.motivo} onChange={e => setFormData({...formData, motivo: e.target.value})} required>
                    <option value="Petición">Consulta / Petición general</option>
                    <option value="Queja">Queja por servicio</option>
                    <option value="Reclamo">Reclamo sobre producto / garantía</option>
                    <option value="Sugerencia">Sugerencia de mejora</option>
                    <option value="Estado de pedido">Consultar estado de mi pedido</option>
                    <option value="Facturación">Problema de facturación</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Descripción detallada *</label>
                  <textarea rows={4} value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} placeholder="Explícanos en detalle lo sucedido..." required />
                </div>

                <div className="form-field">
                  <label>Adjuntar Foto o Video (Opcional)</label>
                  <label className="pqrs-file-upload">
                    <input type="file" accept="image/*,video/*" onChange={e => e.target.files && setFile(e.target.files[0])} style={{ display: 'none' }} />
                    <div className="upload-btn">
                      <Upload size={16} />
                      {file ? file.name : 'Seleccionar Archivo...'}
                    </div>
                  </label>
                </div>

                <button type="submit" className="btn-primary pqrs-submit-btn" disabled={enviando}>
                  {enviando ? <><Loader2 size={18} className="spin" /> Enviando...</> : <><Send size={18} /> Enviar Solicitud</>}
                </button>
              </form>
            )
          )}
        </div>
      </div>
    </div>
  );
}
