// Lectura de pedidos con IA (capturas de WhatsApp): preparación de imágenes, llamada al servidor
// y, sobre todo, validación de la respuesta: la IA propone, pero solo se acepta lo que existe de verdad.
import type { Producto } from '../types';
import { DEPARTAMENTOS_COLOMBIA } from '../data/colombiaData';

export interface RespuestaIA {
  cliente: { nombre: string | null; celular: string | null; cedula: string | null; correo: string | null };
  entrega: { departamento: string | null; ciudad: string | null; direccion: string | null; barrio: string | null; recepcion: 'domicilio' | 'tienda' | null };
  pago: 'transferencia' | 'contra_entrega' | null;
  nota: string | null;
  lineas: { producto: number | null; descripcion_original: string; opcion: string | null; detalle?: string | null; estampado: string | null; cantidad: number; seguro: boolean }[];
  total_mencionado?: number | null;
  advertencias: string[];
}

export interface ImagenIA { id: string; nombre: string; tipo: 'image/jpeg'; datos: string; vista: string }

export interface IaLinea { prodId: string; opcion: string; detalle: string; estampado: string; cantidad: number; original: string; seguro: boolean }

export interface IaRevision {
  nombre: string; celular: string; cedula: string; correo: string;
  depto: string; ciudad: string; direccion: string; barrio: string;
  recepcion: 'domicilio' | 'tienda' | ''; pago: 'transferencia' | 'contra_entrega' | '';
  nota: string;
  lineas: IaLinea[];
  totalMencionado: number | null;
  sinIdentificar: string[];
  advertencias: string[];
}

export const MAX_CAPTURAS = 4;

export const normalizar = (s: string): string =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim();

// ───────────── Imágenes ─────────────
export async function prepararImagen(archivo: File): Promise<ImagenIA> {
  const bmp = await createImageBitmap(archivo);
  const k = Math.min(1, 1500 / bmp.width, 3200 / bmp.height);
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const lienzo = document.createElement('canvas');
  lienzo.width = w;
  lienzo.height = h;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>(res => lienzo.toBlob(res, 'image/jpeg', 0.85));
  if (!blob) throw new Error('No se pudo procesar la imagen');
  const vista = await new Promise<string>((res, rej) => {
    const lector = new FileReader();
    lector.onload = () => res(String(lector.result));
    lector.onerror = () => rej(new Error('No se pudo leer la imagen'));
    lector.readAsDataURL(blob);
  });
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, nombre: archivo.name || 'captura', tipo: 'image/jpeg', datos: vista.split(',')[1] || '', vista };
}

// ───────────── Servidor ─────────────
export async function iaDisponible(): Promise<boolean> {
  try {
    const r = await fetch('/api/leer-pedido/estado');
    if (!r.ok) return false;
    const j = await r.json();
    return Boolean(j && j.activo);
  } catch { return false; }
}

export async function leerConIA(datos: {
  asesorId: string; pin: string; imagenes: ImagenIA[]; texto: string; productoIndicado?: number | null;
  catalogo: { n: number; nombre: string; ref: string; cat: string; opciones: string[]; estampados: string[] }[];
}): Promise<RespuestaIA> {
  let r: Response;
  try {
    r = await fetch('/api/leer-pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...datos, imagenes: datos.imagenes.map(i => ({ tipo: i.tipo, datos: i.datos })) })
    });
  } catch {
    throw new Error('No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.');
  }
  let j: { ok?: boolean; error?: string; resultado?: RespuestaIA } | null = null;
  try { j = await r.json(); } catch { /* respuesta sin JSON */ }
  if (!r.ok || !j || !j.ok || !j.resultado) throw new Error((j && j.error) || 'No se pudo leer el chat. Intenta de nuevo o cárgalo a mano.');
  return j.resultado;
}

// ───────────── Teléfono y ubicación ─────────────
export function normalizarCelular(v: string | null | undefined): string {
  const d = String(v || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
}

export function resolverUbicacion(depto: string | null | undefined, ciudad: string | null | undefined): { depto: string; ciudad: string; aviso?: string } {
  const nd = normalizar(depto || '');
  const nc = normalizar(ciudad || '');
  const deptos = Object.keys(DEPARTAMENTOS_COLOMBIA);
  let dKey = nd ? deptos.find(d => normalizar(d) === nd) || deptos.find(d => normalizar(d).includes(nd) || nd.includes(normalizar(d))) : undefined;

  if (nc) {
    if (dKey) {
      const m = DEPARTAMENTOS_COLOMBIA[dKey].find(x => normalizar(x) === nc);
      if (m) return { depto: dKey, ciudad: m };
    }
    const coincidencias: { d: string; c: string }[] = [];
    for (const d of deptos) for (const c of DEPARTAMENTOS_COLOMBIA[d]) if (normalizar(c) === nc) coincidencias.push({ d, c });
    if (coincidencias.length === 1) return { depto: coincidencias[0].d, ciudad: coincidencias[0].c };
    if (coincidencias.length > 1) {
      const enSuDepto = dKey ? coincidencias.find(x => x.d === dKey) : undefined;
      if (enSuDepto) return { depto: enSuDepto.d, ciudad: enSuDepto.c };
      return { depto: dKey || '', ciudad: '', aviso: `"${ciudad}" existe en varios departamentos: elige el correcto.` };
    }
    return { depto: dKey || '', ciudad: '', aviso: `No encontré "${ciudad}"${dKey ? ` en ${dKey}` : ''} en la lista de ciudades: elígela a mano.` };
  }
  return { depto: dKey || '', ciudad: '' };
}

// ───────────── Revisión: solo se acepta lo que existe ─────────────
export function armarRevision(
  r: RespuestaIA,
  catalogo: Producto[],
  ayudas: { opcionesDe: (p: Producto) => { clave: string; texto: string }[]; estampadosDe: (p: Producto) => string[] }
): IaRevision {
  const advertencias = [...(r.advertencias || [])].map(a => String(a).slice(0, 200)).slice(0, 8);
  const sinIdentificar: string[] = [];
  const lineas: IaLinea[] = [];

  for (const l of r.lineas || []) {
    const original = String(l.descripcion_original || '').slice(0, 160);
    const prod = l.producto != null && Number.isInteger(l.producto) ? catalogo[l.producto] : undefined;
    if (!prod) { sinIdentificar.push(original || 'Producto sin identificar'); continue; }

    const opciones = ayudas.opcionesDe(prod);
    const buscada = normalizar(l.opcion || '');
    let opcion = buscada ? (opciones.find(o => normalizar(o.clave) === buscada) || opciones.find(o => normalizar(o.texto) === buscada))?.clave : undefined;
    if (opcion === undefined && opciones.length === 1) opcion = opciones[0].clave;

    const estampados = ayudas.estampadosDe(prod);
    const eBuscado = normalizar(l.estampado || '');
    let estampado = eBuscado ? estampados.find(e => normalizar(e) === eBuscado) : undefined;
    if (estampado === undefined && estampados.length === 1) estampado = estampados[0];

    const cantidad = Math.min(999, Math.max(1, Math.round(Number(l.cantidad) || 1)));
    lineas.push({
      prodId: prod.id,
      opcion: opcion ?? '',
      detalle: String(l.detalle || '').trim().slice(0, 40),
      estampado: estampado ?? '',
      cantidad,
      original,
      seguro: Boolean(l.seguro) && opcion !== undefined && (estampados.length === 0 || estampado !== undefined)
    });
  }

  const ubic = resolverUbicacion(r.entrega?.departamento, r.entrega?.ciudad);
  if (ubic.aviso) advertencias.push(ubic.aviso);
  const celular = normalizarCelular(r.cliente?.celular);
  if (r.cliente?.celular && !celular) advertencias.push(`El celular "${r.cliente.celular}" no tiene 10 dígitos: revísalo.`);

  return {
    nombre: String(r.cliente?.nombre || '').trim().slice(0, 120),
    celular,
    cedula: String(r.cliente?.cedula || '').replace(/\D/g, '').slice(0, 15),
    correo: String(r.cliente?.correo || '').trim().slice(0, 120),
    depto: ubic.depto,
    ciudad: ubic.ciudad,
    direccion: String(r.entrega?.direccion || '').trim().slice(0, 200),
    barrio: String(r.entrega?.barrio || '').trim().slice(0, 80),
    recepcion: r.entrega?.recepcion === 'tienda' || r.entrega?.recepcion === 'domicilio' ? r.entrega.recepcion : '',
    pago: r.pago === 'transferencia' || r.pago === 'contra_entrega' ? r.pago : '',
    nota: String(r.nota || '').trim().slice(0, 200),
    lineas,
    totalMencionado: Number.isFinite(Number(r.total_mencionado)) && Number(r.total_mencionado) > 0 ? Math.round(Number(r.total_mencionado)) : null,
    sinIdentificar,
    advertencias
  };
}
