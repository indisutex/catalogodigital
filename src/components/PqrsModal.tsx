import React, { useState } from 'react';
import { supabase, getTenantId } from '../lib/supabase';
import { X, Upload, Send, Loader2 } from 'lucide-react';
import './PqrsModal.css';

export default function PqrsModal({ onClose }: { onClose: () => void }) {
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
        const fileExt = file.name.split('.').pop();
        const fileName = `pqrs_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('archivos').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
        evidencia_url = data.publicUrl;
      }

      const tenantId = getTenantId();
      let { error: insertError } = await supabase.from('pqrs').insert([{
        tenant_id: tenantId,
        nombre_cliente: formData.nombre,
        telefono_cliente: formData.telefono,
        numero_pedido: formData.pedido || null,
        motivo: formData.motivo,
        descripcion: formData.descripcion,
        evidencia_url,
        estado: 'pendiente'
      }]);

      if (insertError) {
        console.warn('Fallback insert PQRS sin tenant_id:', insertError);
        const { error: fallbackErr } = await supabase.from('pqrs').insert([{
          nombre_cliente: formData.nombre,
          telefono_cliente: formData.telefono,
          numero_pedido: formData.pedido || null,
          motivo: formData.motivo,
          descripcion: formData.descripcion,
          evidencia_url,
          estado: 'pendiente'
        }]);
        if (fallbackErr) throw fallbackErr;
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
          <h3>Soporte / PQRS</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        
        <div className="pqrs-body">
          {enviado ? (
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
          )}
        </div>
      </div>
    </div>
  );
}
