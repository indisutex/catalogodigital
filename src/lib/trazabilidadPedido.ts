// Estado de pago / envío e historial de un pedido, con los mismos criterios que usa el admin:
//  - Transferencia: con comprobante (pantallazo_url) = "por validar"; estado "completado" = pagado.
//  - Contra entrega: se paga al recibir; "entregado_pagado" = cobrado.

export interface Chip { texto: string; bg: string; fg: string }
export type GrupoPago = 'esperando' | 'validar' | 'pagado' | 'contra' | 'cancelado';

export interface EstadoPedido {
  grupo: GrupoPago;
  pago: Chip;
  envio: Chip;
  guia: string;
}

const PAGADOS = ['completado', 'entregado_pagado', 'exitosa', 'exitoso', 'entregado'];

export function estadoDe(r: any): EstadoPedido {
  const est = String(r?.estado || '').toLowerCase();
  const contra = r?.modalidad_pago === 'contra_entrega' || est.startsWith('contra');
  const guia = String(r?.numero_guia || '').trim();

  let grupo: GrupoPago;
  let pago: Chip;
  if (est === 'cancelado') {
    grupo = 'cancelado';
    pago = { texto: 'Cancelado', bg: '#f1f5f9', fg: '#475569' };
  } else if (PAGADOS.includes(est)) {
    grupo = 'pagado';
    pago = { texto: 'Pagado', bg: '#dcfce7', fg: '#166534' };
  } else if (contra) {
    grupo = 'contra';
    pago = { texto: 'Contra entrega · se cobra al recibir', bg: '#e0f2fe', fg: '#075985' };
  } else if (r?.pantallazo_url) {
    grupo = 'validar';
    pago = { texto: 'Comprobante recibido · por validar', bg: '#ffedd5', fg: '#9a3412' };
  } else {
    grupo = 'esperando';
    pago = { texto: 'Esperando comprobante', bg: '#fee2e2', fg: '#991b1b' };
  }

  let envio: Chip;
  if (grupo === 'cancelado') envio = { texto: 'Sin envío', bg: '#f1f5f9', fg: '#475569' };
  else if (est === 'entregado_pagado' || est === 'entregado') envio = { texto: 'Entregado', bg: '#dcfce7', fg: '#166534' };
  else if (est === 'despachado' || est === 'contra_despachado' || guia) envio = { texto: guia ? `Despachado · guía ${guia}` : 'Despachado', bg: '#e0e7ff', fg: '#3730a3' };
  else envio = { texto: 'Por preparar', bg: '#fef3c7', fg: '#92400e' };

  return { grupo, pago, envio, guia };
}

export interface Evento { fecha: string | null; texto: string; usuario?: string }

export function lineaTiempo(r: any): Evento[] {
  const eventos: Evento[] = [];
  const hist = Array.isArray(r?.historial) ? r.historial : [];
  for (const h of hist) {
    if (!h) continue;
    eventos.push({ fecha: h.fecha || null, texto: String(h.accion || h.estado || 'Cambio de estado'), usuario: h.usuario ? String(h.usuario) : undefined });
  }
  if (!eventos.some(e => /cargado|creado/i.test(e.texto))) {
    eventos.push({ fecha: r?.created_at || null, texto: 'Pedido registrado' });
  }
  if (r?.pantallazo_url && !eventos.some(e => /comprobante/i.test(e.texto))) {
    eventos.push({ fecha: null, texto: 'Comprobante de pago recibido' });
  }
  if (r?.numero_guia && !eventos.some(e => /gu[ií]a/i.test(e.texto))) {
    eventos.push({ fecha: null, texto: `Guía de envío asignada: ${r.numero_guia}` });
  }
  if (r?.evidencia_despacho_url && !eventos.some(e => /despach/i.test(e.texto))) {
    eventos.push({ fecha: null, texto: 'Evidencia de despacho cargada' });
  }
  if (r?.evidencia_entrega_url && !eventos.some(e => /entrega/i.test(e.texto))) {
    eventos.push({ fecha: null, texto: 'Evidencia de entrega cargada' });
  }
  return eventos.sort((a, b) => {
    if (a.fecha && b.fecha) return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
    if (a.fecha) return -1;
    if (b.fecha) return 1;
    return 0;
  });
}

// ───────────── Estado de alistamiento en bodega ─────────────
// Se guarda en el historial del pedido (estados "bodega_alistando", "bodega_listo", "bodega_por_alistar").
export type ClaveBodega = 'por_alistar' | 'alistando' | 'listo';

export interface EstadoBodega { clave: ClaveBodega; chip: Chip; por: string; fecha: string | null; automatico: boolean }

const CHIPS_BODEGA: Record<ClaveBodega, Chip> = {
  por_alistar: { texto: 'Por alistar', bg: '#fef3c7', fg: '#92400e' },
  alistando: { texto: 'Alistando', bg: '#e0e7ff', fg: '#3730a3' },
  listo: { texto: 'Listo para despachar', bg: '#dcfce7', fg: '#166534' }
};

const DESPACHADOS = ['despachado', 'contra_despachado', 'entregado_pagado', 'entregado', 'completado'];

export function estadoBodega(r: any): EstadoBodega {
  const hist = Array.isArray(r?.historial) ? r.historial : [];
  for (let i = hist.length - 1; i >= 0; i--) {
    const e = String(hist[i]?.estado || '');
    if (e.startsWith('bodega_')) {
      const clave = e.slice(7) as ClaveBodega;
      if (CHIPS_BODEGA[clave]) {
        return { clave, chip: CHIPS_BODEGA[clave], por: String(hist[i].usuario || '').replace(/^Bodega · /, ''), fecha: hist[i].fecha || null, automatico: false };
      }
    }
  }
  // Si el admin ya lo despachó o entregó, no debe seguir apareciendo como pendiente de alistar
  if (DESPACHADOS.includes(String(r?.estado || '').toLowerCase())) {
    return { clave: 'listo', chip: { texto: 'Despachado', bg: '#e0e7ff', fg: '#3730a3' }, por: '', fecha: null, automatico: true };
  }
  return { clave: 'por_alistar', chip: CHIPS_BODEGA.por_alistar, por: '', fecha: null, automatico: false };
}
