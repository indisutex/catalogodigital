import React from 'react';
import { CheckCircle2, AlertTriangle, MessageCircle, ExternalLink, HelpCircle, Phone } from 'lucide-react';

export interface PhoneValidationResult {
  status: 'empty' | 'typing' | 'valid' | 'invalid_landline' | 'invalid_length';
  cleanPhone: string;
  formattedPhone: string;
  message: string;
  isValid: boolean;
}

/**
 * Valida si un número telefónico ingresado corresponde a una línea celular válida de WhatsApp en Colombia o internacional.
 */
export function validateWhatsAppPhone(rawPhone: string): PhoneValidationResult {
  let clean = (rawPhone || '').replace(/\D/g, '');
  
  // Si empieza con 57 (código de país Colombia) y tiene 12 dígitos, extraer los 10 dígitos celulares
  if (clean.startsWith('57') && clean.length === 12) {
    clean = clean.slice(2);
  }
  // Si empieza con 0 inicial (ej: 03001234567), remover el 0
  if (clean.startsWith('0') && clean.length > 1) {
    clean = clean.slice(1);
  }

  if (!clean) {
    return {
      status: 'empty',
      cleanPhone: '',
      formattedPhone: '',
      message: 'Ingresa tu número celular de 10 dígitos (ej. 300 123 4567).',
      isValid: false
    };
  }

  const startsWithMobile = clean.startsWith('3');
  const isLandlinePrefix = clean.startsWith('60') || clean.startsWith('4') || clean.startsWith('7') || clean.startsWith('8');

  // Si empieza por prefijos fijos (601, 602, 604, 605, etc.) o no empieza por 3 en longitud >= 7
  if (isLandlinePrefix || (!startsWithMobile && clean.length >= 7)) {
    let prefijoNombre = 'teléfono fijo';
    if (clean.startsWith('601')) prefijoNombre = 'fijo Bogotá / Cundinamarca (601)';
    else if (clean.startsWith('602')) prefijoNombre = 'fijo Valle / Cali (602)';
    else if (clean.startsWith('604')) prefijoNombre = 'fijo Antioquia / Medellín (604)';
    else if (clean.startsWith('605')) prefijoNombre = 'fijo Costa Caribe (605)';
    else if (clean.startsWith('607')) prefijoNombre = 'fijo Santanderes (607)';
    else if (clean.startsWith('608')) prefijoNombre = 'fijo Tolima / Boyacá / Meta (608)';

    return {
      status: 'invalid_landline',
      cleanPhone: clean,
      formattedPhone: clean,
      message: `⚠️ Número detectado como ${prefijoNombre}. Los teléfonos fijos NO tienen WhatsApp. Ingresa tu número celular (empieza por 3).`,
      isValid: false
    };
  }

  if (clean.length < 10) {
    const faltantes = 10 - clean.length;
    return {
      status: 'typing',
      cleanPhone: clean,
      formattedPhone: clean,
      message: `Ingresando celular... (${clean.length}/10 dígitos - faltan ${faltantes})`,
      isValid: false
    };
  }

  if (clean.length === 10 && startsWithMobile) {
    const formatted = `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
    return {
      status: 'valid',
      cleanPhone: clean,
      formattedPhone: formatted,
      message: '✓ WhatsApp Detectado y Válido',
      isValid: true
    };
  }

  if (clean.length > 10) {
    return {
      status: 'invalid_length',
      cleanPhone: clean,
      formattedPhone: clean,
      message: '⚠️ El número celular tiene más de 10 dígitos. Por favor verifica que esté correcto.',
      isValid: false
    };
  }

  return {
    status: 'typing',
    cleanPhone: clean,
    formattedPhone: clean,
    message: 'Ingresa tu celular de 10 dígitos.',
    isValid: false
  };
}

interface WhatsAppPhoneVerifierProps {
  phone: string;
  showTestButton?: boolean;
  compact?: boolean;
  style?: React.CSSProperties;
}

export default function WhatsAppPhoneVerifier({ phone, showTestButton = true, compact = false, style }: WhatsAppPhoneVerifierProps) {
  const result = validateWhatsAppPhone(phone);

  if (result.status === 'empty' && compact) {
    return null;
  }

  // Estilos visuales respetando estrictamente las reglas de AGENTS.md (font-weight max 500 para badges, 400 para texto)
  const getContainerStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      fontFamily: "'Poppins', sans-serif",
      borderRadius: '12px',
      padding: compact ? '0.45rem 0.75rem' : '0.65rem 0.9rem',
      fontSize: compact ? '0.78rem' : '0.82rem',
      lineHeight: 1.4,
      marginTop: '0.45rem',
      transition: 'all 0.25s ease',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.3rem',
      ...style
    };

    switch (result.status) {
      case 'valid':
        return {
          ...base,
          background: '#f0fdf4',
          border: '1.5px solid #bbf7d0',
          color: '#166534'
        };
      case 'invalid_landline':
        return {
          ...base,
          background: '#fffbeb',
          border: '1.5px solid #fde68a',
          color: '#b45309'
        };
      case 'invalid_length':
        return {
          ...base,
          background: '#fff7ed',
          border: '1.5px solid #fed7aa',
          color: '#c2410c'
        };
      case 'typing':
        return {
          ...base,
          background: '#f8fafc',
          border: '1.5px solid #e2e8f0',
          color: '#475569'
        };
      case 'empty':
      default:
        return {
          ...base,
          background: '#fafafa',
          border: '1.5px dashed #cbd5e1',
          color: '#64748b'
        };
    }
  };

  return (
    <div style={getContainerStyle()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: 1, minWidth: 0 }}>
          {result.status === 'valid' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: '#22c55e', color: '#ffffff', flexShrink: 0 }}>
              <CheckCircle2 size={14} style={{ strokeWidth: 2.5 }} />
            </span>
          )}
          {result.status === 'invalid_landline' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: '#f59e0b', color: '#ffffff', flexShrink: 0 }}>
              <AlertTriangle size={13} style={{ strokeWidth: 2.5 }} />
            </span>
          )}
          {result.status === 'invalid_length' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: '#ea580c', color: '#ffffff', flexShrink: 0 }}>
              <AlertTriangle size={13} style={{ strokeWidth: 2.5 }} />
            </span>
          )}
          {result.status === 'typing' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: '#e2e8f0', color: '#64748b', flexShrink: 0 }}>
              <Phone size={12} style={{ strokeWidth: 2 }} />
            </span>
          )}
          {result.status === 'empty' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: '#e2e8f0', color: '#64748b', flexShrink: 0 }}>
              <HelpCircle size={12} style={{ strokeWidth: 2 }} />
            </span>
          )}

          <span style={{ fontWeight: 500, fontFamily: "'Poppins', sans-serif", fontSize: compact ? '0.78rem' : '0.82rem' }}>
            {result.message}
          </span>
        </div>

        {result.status === 'valid' && showTestButton && (
          <a
            href={`https://wa.me/57${result.cleanPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir chat en WhatsApp para verificar recepción de mensajes"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.2rem 0.55rem',
              background: '#dcfce7',
              border: '1px solid #86efac',
              borderRadius: '8px',
              color: '#15803d',
              fontSize: '0.73rem',
              fontWeight: 500,
              textDecoration: 'none',
              fontFamily: "'Poppins', sans-serif",
              flexShrink: 0,
              transition: 'background 0.2s ease'
            }}
          >
            <MessageCircle size={12} color="#16a34a" />
            <span>Probar Chat</span>
            <ExternalLink size={10} color="#16a34a" />
          </a>
        )}
      </div>

      {result.status === 'valid' && (
        <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 400, marginTop: '0.1rem', fontFamily: "'Poppins', sans-serif" }}>
          Recibirás la confirmación de tu pedido y el estado del despacho a la línea <strong>{result.formattedPhone}</strong>.
        </div>
      )}
    </div>
  );
}
