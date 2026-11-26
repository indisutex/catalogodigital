// Ficha de un pedido manual: texto y imagen para compartir en el grupo de WhatsApp

export interface ItemVista {
  nombre: string;
  imagen: string | null;
  etiqueta: string;
  estampado: string;
  cantidad: number;
  precio: number;
}

export interface PedidoVista {
  id: string;
  creado: string;
  tienda: string;
  color: string;
  logo?: string | null;
  asesor: string;
  cliente: string;
  telefono: string;
  ciudad: string;
  direccion: string;
  pago: string;
  entrega: string;
  tipo: string;
  total: number;
  nota?: string;
  estado?: string;
  items: ItemVista[];
}

const ETIQ: Record<string, string> = {
  'Caballero Única': 'Hombre única',
  '2XL Unisex': 'Hombre extra plus (2XL)',
  'Dama Única': 'Dama única',
  'Dama Plus': 'Dama plus',
  '18': 'Talla 18'
};

export const etiqueta = (k: string) => ETIQ[k] || (/^\d+\/\d+$/.test(k) ? `Niño/a ${k}` : k || 'Cantidad');

export const peso = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

export function codigo(id: string): string {
  return '#' + id.slice(0, 8).toUpperCase();
}

interface Grupo { nombre: string; estampado: string; imagen: string | null; lineas: { texto: string; cantidad: number }[] }

function agrupar(items: ItemVista[]): Grupo[] {
  const mapa = new Map<string, Grupo>();
  for (const it of items) {
    const k = `${it.nombre}|${it.estampado}`;
    let g = mapa.get(k);
    if (!g) { g = { nombre: it.nombre, estampado: it.estampado, imagen: it.imagen, lineas: [] }; mapa.set(k, g); }
    if (!g.imagen && it.imagen) g.imagen = it.imagen;
    g.lineas.push({ texto: it.etiqueta || 'Cantidad', cantidad: it.cantidad });
  }
  return [...mapa.values()];
}

export const totalUnidades = (v: PedidoVista) => v.items.reduce((s, i) => s + i.cantidad, 0);

export function textoPedido(v: PedidoVista): string {
  const L: string[] = [];
  L.push(`*PEDIDO MANUAL* ${codigo(v.id)}`);
  L.push(`${v.tienda} · Asesor: ${v.asesor}`);
  L.push(new Date(v.creado).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }));
  L.push('');
  L.push(`*Cliente:* ${v.cliente}`);
  L.push(`*Celular:* ${v.telefono}`);
  L.push(`*Ciudad:* ${v.ciudad || '—'}`);
  if (v.direccion) L.push(`*Dirección:* ${v.direccion}`);
  L.push(`*Pago:* ${v.pago} · *Entrega:* ${v.entrega}`);
  if (v.nota) L.push(`*Nota:* ${v.nota}`);
  for (const g of agrupar(v.items)) {
    L.push('');
    L.push(`*${g.nombre}*${g.estampado ? ` (${g.estampado})` : ''}`);
    for (const l of g.lineas) L.push(`• ${l.texto} = ${l.cantidad}`);
  }
  L.push('');
  L.push(`*TOTAL:* ${peso(v.total)} · ${totalUnidades(v)} unidades`);
  L.push(`_${v.tipo}_`);
  return L.join('\n');
}

export const urlWhatsAppGrupo = (v: PedidoVista) => `https://wa.me/?text=${encodeURIComponent(textoPedido(v))}`;

export async function copiarTexto(v: PedidoVista): Promise<boolean> {
  try { await navigator.clipboard.writeText(textoPedido(v).replace(/\*/g, '').replace(/_/g, '')); return true; } catch { return false; }
}

// ───────────── Imagen ─────────────
const W = 1080;
const P = 44;
const FUENTE = "Poppins, 'Segoe UI', Arial, sans-serif";

function camino(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cargarImagen(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise(res => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const t = window.setTimeout(() => res(null), 7000);
    img.onload = () => { window.clearTimeout(t); res(img); };
    img.onerror = () => { window.clearTimeout(t); res(null); };
    img.src = url;
  });
}

function envolver(ctx: CanvasRenderingContext2D, texto: string, ancho: number, maxLineas: number): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? actual + ' ' + p : p;
    if (ctx.measureText(prueba).width <= ancho) actual = prueba;
    else { if (actual) lineas.push(actual); actual = p; }
  }
  if (actual) lineas.push(actual);
  if (lineas.length > maxLineas) {
    const corto = lineas.slice(0, maxLineas);
    let ult = corto[maxLineas - 1];
    while (ult.length > 1 && ctx.measureText(ult + '…').width > ancho) ult = ult.slice(0, -1);
    corto[maxLineas - 1] = ult + '…';
    return corto;
  }
  return lineas.length ? lineas : [''];
}

export async function dibujarFicha(v: PedidoVista): Promise<Blob> {
  try { await document.fonts.load(`700 30px Poppins`); await document.fonts.load(`500 30px Poppins`); } catch { /* usa la fuente de respaldo */ }
  const grupos = agrupar(v.items);
  const [logo, ...fotos] = await Promise.all([cargarImagen(v.logo), ...grupos.map(g => cargarImagen(g.imagen))]);

  const medir = document.createElement('canvas').getContext('2d')!;
  medir.font = `500 30px ${FUENTE}`;
  const dirLineas = envolver(medir, v.direccion || '—', W - P * 2 - 250, 2);
  const filasCliente: [string, string[]][] = [
    ['Cliente', [v.cliente]],
    ['Celular', [v.telefono]],
    ['Ciudad', [v.ciudad || '—']],
    ['Dirección', dirLineas],
    ['Pago', [`${v.pago} · ${v.entrega}`]]
  ];
  if (v.nota) filasCliente.push(['Nota', envolver(medir, v.nota, W - P * 2 - 250, 2)]);
  const altoCliente = 40 + filasCliente.reduce((s, [, l]) => s + l.length * 42 + 8, 0);

  medir.font = `700 34px ${FUENTE}`;
  const infoGrupos = grupos.map(g => {
    const titulo = envolver(medir, g.nombre, W - P * 2 - 300, 2);
    const alto = Math.max(280, 40 + titulo.length * 44 + (g.estampado ? 46 : 0) + g.lineas.length * 50 + 30);
    return { g, titulo, alto };
  });

  const altoHeader = 200;
  const altoFooter = 190;
  const alto = altoHeader + 24 + altoCliente + 24 + infoGrupos.reduce((s, x) => s + x.alto + 20, 0) + altoFooter;

  const c = document.createElement('canvas');
  c.width = W;
  c.height = alto;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#eef0f6';
  ctx.fillRect(0, 0, W, alto);

  // Encabezado
  ctx.fillStyle = v.color || '#4f46e5';
  ctx.fillRect(0, 0, W, altoHeader);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.font = `700 26px ${FUENTE}`;
  ctx.fillText('PEDIDO MANUAL', P, 62);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 54px ${FUENTE}`;
  ctx.fillText(envolver(ctx, v.tienda || 'Pedido', W - P * 2 - 250, 1)[0], P, 124);
  ctx.font = `500 26px ${FUENTE}`;
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.fillText(`${codigo(v.id)} · ${new Date(v.creado).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}`, P, 168);
  if (logo) {
    ctx.fillStyle = '#fff';
    camino(ctx, W - P - 130, 35, 130, 130, 24);
    ctx.fill();
    ctx.save();
    camino(ctx, W - P - 130, 35, 130, 130, 24);
    ctx.clip();
    const k = Math.min(110 / logo.width, 110 / logo.height);
    ctx.drawImage(logo, W - P - 130 + (130 - logo.width * k) / 2, 35 + (130 - logo.height * k) / 2, logo.width * k, logo.height * k);
    ctx.restore();
  }

  // Cliente
  let y = altoHeader + 24;
  ctx.fillStyle = '#ffffff';
  camino(ctx, P / 2, y, W - P, altoCliente, 26);
  ctx.fill();
  let yy = y + 32;
  for (const [k, lineas] of filasCliente) {
    ctx.fillStyle = '#64748b';
    ctx.font = `600 24px ${FUENTE}`;
    ctx.fillText(k.toUpperCase(), P + 8, yy + 30);
    ctx.fillStyle = '#0f172a';
    ctx.font = `600 30px ${FUENTE}`;
    lineas.forEach((t, i) => ctx.fillText(t, P + 250, yy + 30 + i * 42));
    yy += lineas.length * 42 + 8;
  }
  y += altoCliente + 24;

  // Productos
  infoGrupos.forEach(({ g, titulo, alto: h }, idx) => {
    ctx.fillStyle = '#ffffff';
    camino(ctx, P / 2, y, W - P, h, 26);
    ctx.fill();
    const fx = P / 2 + 22, fy = y + 22, fs = h - 44 < 236 ? h - 44 : 236;
    ctx.fillStyle = '#e2e8f0';
    camino(ctx, fx, fy, 236, fs, 18);
    ctx.fill();
    const foto = fotos[idx];
    if (foto) {
      ctx.save();
      camino(ctx, fx, fy, 236, fs, 18);
      ctx.clip();
      const k = Math.max(236 / foto.width, fs / foto.height);
      ctx.drawImage(foto, fx + (236 - foto.width * k) / 2, fy + (fs - foto.height * k) / 2, foto.width * k, foto.height * k);
      ctx.restore();
    }
    const tx = fx + 236 + 28;
    let ty = y + 34;
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 34px ${FUENTE}`;
    titulo.forEach((t, i) => ctx.fillText(t, tx, ty + 30 + i * 44));
    ty += titulo.length * 44 + 4;
    if (g.estampado) {
      ctx.font = `600 26px ${FUENTE}`;
      const ancho = ctx.measureText(g.estampado).width + 36;
      ctx.fillStyle = v.color || '#4f46e5';
      camino(ctx, tx, ty + 6, ancho, 40, 20);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(g.estampado, tx + 18, ty + 35);
      ty += 46;
    }
    ctx.fillStyle = '#0f172a';
    g.lineas.forEach((l, i) => {
      ctx.font = `600 32px ${FUENTE}`;
      ctx.fillStyle = '#334155';
      ctx.fillText(l.texto + ' =', tx, ty + 42 + i * 50);
      ctx.font = `700 36px ${FUENTE}`;
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'right';
      ctx.fillText(String(l.cantidad), W - P - 24, ty + 42 + i * 50);
      ctx.textAlign = 'left';
    });
    y += h + 20;
  });

  // Total
  ctx.fillStyle = '#0f172a';
  camino(ctx, P / 2, y + 4, W - P, altoFooter - 20, 26);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.font = `600 26px ${FUENTE}`;
  ctx.fillText(`${totalUnidades(v)} UNIDADES · ${v.tipo.toUpperCase()}`, P + 8, y + 56);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 64px ${FUENTE}`;
  ctx.fillText(peso(v.total), P + 8, y + 138);
  ctx.font = `500 24px ${FUENTE}`;
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  const as = `Asesor: ${v.asesor}`;
  ctx.fillText(as, W - P - 8 - ctx.measureText(as).width, y + 138);

  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('No se pudo crear la imagen'))), 'image/png'));
}

export type ResultadoCompartir = 'compartido' | 'descargado' | 'cancelado';

export async function compartirImagen(v: PedidoVista): Promise<ResultadoCompartir> {
  const blob = await dibujarFicha(v);
  const archivo = new File([blob], `pedido-${v.id.slice(0, 8)}.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [archivo] })) {
    try {
      await nav.share({ files: [archivo], title: `Pedido manual ${codigo(v.id)}` });
      return 'compartido';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelado';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'descargado';
}
