import type { Producto } from '../types';

export const deduplicateTallas = (tallasStr: string | undefined | null): string => {
  if (!tallasStr) return '-';
  const rawTallas = tallasStr.split(',').map(t => t.trim()).filter(Boolean);
  if (rawTallas.length === 0) return '-';
  const tallasMap = new Map<string, string>();
  rawTallas.forEach(t => {
    let key = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (key === 'talla unica' || key === 'unica' || key === 'tallaunica') {
      key = 'unica';
    }
    
    let displayVal = t;
    if (key === 'unica') displayVal = 'Única';

    if (!tallasMap.has(key)) tallasMap.set(key, displayVal);
  });
  return Array.from(tallasMap.values()).join(', ') || '-';
};

export const encodeExtraImage = (url: string, ref?: string, estampado?: string): string => {
  let res = url;
  if (estampado?.trim()) res += `|EST:${estampado.trim()}`;
  if (ref?.trim()) res += `|REF:${ref.trim()}`;
  return res;
};

export const decodeExtraImage = (str: string): { url: string; ref: string; estampado: string } => {
  if (!str) return { url: '', ref: '', estampado: '' };

  let url = str;
  let estampado = '';
  let ref = '';

  if (str.includes('|EST:')) {
    const parts = str.split('|EST:');
    url = parts[0];
    const rest = parts[1] || '';
    if (rest.includes('|REF:')) {
      const subParts = rest.split('|REF:');
      estampado = subParts[0] || '';
      ref = subParts[1] || '';
    } else {
      estampado = rest;
    }
  } else if (str.includes('|REF:')) {
    const parts = str.split('|REF:');
    url = parts[0];
    ref = parts[1] || '';
    estampado = parts[1] || '';
  }

  return { url: url || '', ref: ref || '', estampado: estampado || '' };
};

/**
 * Normaliza cadenas para comparaciones flexibles (sin tildes, minúsculas, sin espacios extras)
 */
export const normalizeMediaStr = (str?: string | null): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

/**
 * Resuelve la imagen correcta para un producto o ítem de pedido/carrito según su estampado o referencia.
 * Si el ítem tiene un estampado (ej. "SONNY", "MINNIE", "OSO", "VAQUITA"), busca la foto correspondiente
 * en las imagenes_extra del ítem o en el producto del catálogo, evitando que se muestre la foto por defecto.
 */
export const getVariantImageUrl = (
  item: any,
  catalogProducts?: Producto[]
): string => {
  if (!item) return '';

  const rawEstampado = (item.estampado || '').trim();
  const rawRef = (item.referencia || '').trim();
  const targetEst = normalizeMediaStr(rawEstampado);
  const targetRef = normalizeMediaStr(rawRef);

  // Helper para buscar coincidencia en una lista de imagenes_extra
  const findInExtraImages = (extraImages: any[] | undefined | null): string | null => {
    if (!extraImages || !Array.isArray(extraImages) || extraImages.length === 0) return null;
    let fallbackPartialMatch: string | null = null;

    for (const raw of extraImages) {
      if (!raw) continue;
      const decoded = typeof raw === 'string'
        ? decodeExtraImage(raw)
        : {
            url: raw.url || raw.imagen_url || '',
            ref: raw.ref || raw.referencia || '',
            estampado: raw.estampado || ''
          };

      if (!decoded.url) continue;
      const est = normalizeMediaStr(decoded.estampado);
      const ref = normalizeMediaStr(decoded.ref);

      // 1. Coincidencia exacta por estampado
      if (targetEst && (est === targetEst || ref === targetEst)) {
        return decoded.url;
      }
      // 2. Coincidencia exacta por referencia
      if (targetRef && (ref === targetRef || est === targetRef)) {
        return decoded.url;
      }
      // 3. Coincidencia parcial (ej. "Minnie" dentro de "Minnie Rosa")
      if (targetEst && est && (est.includes(targetEst) || targetEst.includes(est)) && !fallbackPartialMatch) {
        fallbackPartialMatch = decoded.url;
      }
      if (targetRef && ref && (ref.includes(targetRef) || targetRef.includes(ref)) && !fallbackPartialMatch) {
        fallbackPartialMatch = decoded.url;
      }
    }

    return fallbackPartialMatch;
  };

  // 1. Si el ítem tiene un estampado o referencia específicos, buscar la foto exacta
  if (targetEst || targetRef) {
    // a. Buscar en las fotos extra que ya vengan dentro del propio ítem
    const directMatch = findInExtraImages(item.imagenes_extra);
    if (directMatch) return directMatch;

    // b. Buscar en el catálogo de productos
    if (catalogProducts && Array.isArray(catalogProducts)) {
      const parentProd = catalogProducts.find((p: any) =>
        (item.id && p.id === item.id) ||
        (item.producto_id && p.id === item.producto_id) ||
        (item.referencia && p.referencia && p.referencia === item.referencia) ||
        (item.nombre && p.nombre && (
          normalizeMediaStr(p.nombre) === normalizeMediaStr(item.nombre) ||
          normalizeMediaStr(item.nombre).startsWith(normalizeMediaStr(p.nombre)) ||
          normalizeMediaStr(p.nombre).startsWith(normalizeMediaStr(item.nombre))
        ))
      );

      if (parentProd) {
        const parentMatch = findInExtraImages(parentProd.imagenes_extra);
        if (parentMatch) return parentMatch;
      }
    }
  }

  // 2. Si no hay estampado o no hubo match en fotos extra, usar la imagen directa del ítem
  if (item.imagen_url && typeof item.imagen_url === 'string' && item.imagen_url.trim()) {
    return item.imagen_url.trim();
  }
  if (item.imagen && typeof item.imagen === 'string' && item.imagen.trim()) {
    return item.imagen.trim();
  }
  if (item.image_url && typeof item.image_url === 'string' && item.image_url.trim()) {
    return item.image_url.trim();
  }
  if (item.foto && typeof item.foto === 'string' && item.foto.trim()) {
    return item.foto.trim();
  }

  // 3. Fallback a la imagen principal del producto en catálogo
  if (catalogProducts && Array.isArray(catalogProducts)) {
    const parentProd = catalogProducts.find((p: any) =>
      (item.id && p.id === item.id) ||
      (item.producto_id && p.id === item.producto_id) ||
      (item.referencia && p.referencia && p.referencia === item.referencia) ||
      (item.nombre && p.nombre && (
        normalizeMediaStr(p.nombre) === normalizeMediaStr(item.nombre) ||
        normalizeMediaStr(item.nombre).startsWith(normalizeMediaStr(p.nombre)) ||
        normalizeMediaStr(p.nombre).startsWith(normalizeMediaStr(item.nombre))
      ))
    );

    if (parentProd) {
      if (parentProd.imagen_url) return parentProd.imagen_url;
      if (parentProd.imagenes_extra && parentProd.imagenes_extra.length > 0) {
        const decoded = typeof parentProd.imagenes_extra[0] === 'string'
          ? decodeExtraImage(parentProd.imagenes_extra[0])
          : parentProd.imagenes_extra[0];
        if (decoded?.url) return decoded.url;
      }
    }
  }

  // 4. Fallback a primera imagen extra del propio ítem
  if (item.imagenes_extra && Array.isArray(item.imagenes_extra) && item.imagenes_extra.length > 0) {
    const decoded = typeof item.imagenes_extra[0] === 'string'
      ? decodeExtraImage(item.imagenes_extra[0])
      : item.imagenes_extra[0];
    if (decoded?.url) return decoded.url;
  }

  return '';
};

export const isMediaVideo = (url?: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase().trim();
  if (cleanUrl.startsWith('data:image/')) return false;
  if (cleanUrl.startsWith('data:video/')) return true;
  
  // Si tiene extensión de imagen conocida, definitivamente es una imagen
  if (/\.(jpeg|jpg|png|webp|gif|svg|avif|bmp|ico)$/i.test(cleanUrl)) return false;
  
  // Si tiene extensión de video conocida
  if (/\.(mp4|webm|mov|ogg|m4v|3gp|m3u8|avi|flv|mkv|wmv)$/i.test(cleanUrl)) return true;
  
  // Plataformas de video
  if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be') || cleanUrl.includes('vimeo.com')) return true;

  return false;
};

export interface UnifiedImage {
  url: string;
  ref: string;
  estampado: string;
  isMain: boolean;
}

export const buildUnifiedImages = (prod: Partial<Producto>): UnifiedImage[] => {
  const decodedExtras = (prod.imagenes_extra || []).map((u: string) => ({ ...decodeExtraImage(u), isMain: false }));

  if (!decodedExtras.length && !prod.imagen_url) return [];

  let foundMain = false;
  const unified = decodedExtras.map((e) => {
    let estampado = e.estampado?.trim() || '';
    let ref = e.ref?.trim() || '';
    if (!foundMain && e.url === prod.imagen_url) {
      foundMain = true;
      return { ...e, estampado, ref, isMain: true };
    }
    return { ...e, estampado, ref, isMain: false };
  });

  if (!foundMain && prod.imagen_url) {
    unified.unshift({ url: prod.imagen_url, estampado: '', ref: '', isMain: true });
  } else if (!foundMain && unified.length > 0) {
    unified[0].isMain = true;
  }

  return unified;
};
