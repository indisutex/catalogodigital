import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

export interface AddressValidationResult {
  status: 'empty' | 'missing_fields' | 'invalid_format' | 'valid';
  message: string;
  isValid: boolean;
}

/**
 * Valida de forma local e instantánea que los campos de dirección de envío estén completos y correctos.
 */
export function validateAddressFormat(
  direccion: string, 
  barrio: string, 
  ciudad: string, 
  departamento: string
): { isValidFormat: boolean; missingFields: string[]; message: string } {
  const missingFields: string[] = [];

  if (!departamento || !departamento.trim()) missingFields.push('Departamento');
  if (!ciudad || !ciudad.trim()) missingFields.push('Ciudad / Municipio');
  if (!barrio || !barrio.trim()) missingFields.push('Barrio');
  if (!direccion || !direccion.trim()) missingFields.push('Dirección de residencia');

  if (missingFields.length > 0) {
    return {
      isValidFormat: false,
      missingFields,
      message: `Faltan campos obligatorios para el envío: ${missingFields.join(', ')}.`
    };
  }

  const cleanDir = direccion.trim();
  if (cleanDir.length < 5) {
    return {
      isValidFormat: false,
      missingFields: [],
      message: 'La dirección es muy corta. Especifica la calle, carrera o número de casa.'
    };
  }

  return {
    isValidFormat: true,
    missingFields: [],
    message: '✓ Dirección y datos de entrega completos'
  };
}

interface AddressVerifierProps {
  direccion: string;
  barrio: string;
  ciudad: string;
  departamento: string;
  style?: React.CSSProperties;
}

export default function AddressVerifier({ direccion, barrio, ciudad, departamento, style }: AddressVerifierProps) {
  const check = validateAddressFormat(direccion, barrio, ciudad, departamento);

  if (!direccion && !barrio && !ciudad && !departamento) {
    return null;
  }

  const isComplete = check.isValidFormat;

  const containerStyle: React.CSSProperties = {
    fontFamily: "'Poppins', sans-serif",
    borderRadius: '12px',
    padding: '0.65rem 0.85rem',
    fontSize: '0.8rem',
    lineHeight: 1.4,
    marginTop: '0.45rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    transition: 'all 0.2s ease',
    background: isComplete ? '#f0fdf4' : '#fffbeb',
    border: isComplete ? '1.5px solid #bbf7d0' : '1.5px solid #fde68a',
    color: isComplete ? '#166534' : '#b45309',
    ...style
  };

  return (
    <div style={containerStyle}>
      {isComplete ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: '#22c55e', color: '#ffffff', flexShrink: 0 }}>
          <CheckCircle2 size={13} style={{ strokeWidth: 2.5 }} />
        </span>
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: '#f59e0b', color: '#ffffff', flexShrink: 0 }}>
          <AlertTriangle size={12} style={{ strokeWidth: 2.5 }} />
        </span>
      )}

      <span style={{ fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>
        {check.message}
      </span>
    </div>
  );
}
