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
    estampado = parts[1] || '';
  }

  return { url: url || '', ref: ref || '', estampado: estampado || '' };
};

export const isMediaVideo = (url?: string): boolean => {
  if (!url) return false;
  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
  return (
    /\.(mp4|webm|mov|ogg|m4v|3gp)$/i.test(cleanUrl) ||
    cleanUrl.includes('video') ||
    cleanUrl.includes('mp4')
  );
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
