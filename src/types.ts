export interface Producto {
  id: string;
  nombre: string;
  precio: number;
  imagen_url: string;
  categoria: string;
  subcategoria?: string;
  descripcion: string;
  video_url?: string;
  tallas?: string;
  created_at: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  slug: string;
  icono?: string;
  color?: string;
  orden: number;
}

export interface Subcategoria {
  id: string;
  categoria_id: string;
  nombre: string;
  slug: string;
  orden: number;
}

export interface Configuracion {
  id: string;
  nombre_negocio: string;
  whatsapp: string;
  logo_url?: string;
  descripcion_hero?: string;
  link_dropshipper?: string;
  link_ganar_dinero?: string;
}
