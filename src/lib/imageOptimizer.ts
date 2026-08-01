/**
 * Optimiza URLs de imágenes (Supabase Storage, Unsplash, etc.) aplicando
 * compresión, dimensiones adecuadas y formato WebP cuando sea posible.
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  width: number = 600,
  quality: number = 75
): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  // Si es un Blob local, Data URL (base64) o un logo, no alteramos para evitar recortes del servidor
  if (url.startsWith('blob:') || url.startsWith('data:') || url.toLowerCase().includes('logo') || url.toLowerCase().includes('avatar') || url.toLowerCase().includes('brand')) {
    return url;
  }

  try {
    const parsed = new URL(url);

    // 1. Supabase Storage URLs
    // Ejemplo: https://xyz.supabase.co/storage/v1/object/public/archivos/foto.jpg
    if (parsed.hostname.includes('supabase.co')) {
      if (parsed.pathname.includes('/storage/v1/object/public/')) {
        // Transformación si el render endpoint de Supabase está activo
        const renderPath = parsed.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
        parsed.pathname = renderPath;
        parsed.searchParams.set('width', width.toString());
        parsed.searchParams.set('quality', quality.toString());
        return parsed.toString();
      }
    }

    // 2. Unsplash URLs
    if (parsed.hostname.includes('unsplash.com')) {
      parsed.searchParams.set('w', width.toString());
      parsed.searchParams.set('q', quality.toString());
      parsed.searchParams.set('auto', 'format');
      return parsed.toString();
    }
  } catch (e) {
    // Si la URL es relativa o no válida, retornarla tal cual
    return url;
  }

  return url;
}
