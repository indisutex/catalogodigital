export interface Producto {
  id: string;
  nombre: string;
  precio: number;
  imagen_url: string;
  imagenes_extra?: string[];
  categoria: string;
  subcategoria?: string;
  descripcion: string;
  video_url?: string;
  tallas?: string;
  tenant_id?: string;
  referencia?: string;
  sku?: string;
  stock?: number;
  costo?: number;
  precio_por_mayor?: number;
  precio_50_unidades?: number;
  estampados?: string;
  created_at: string;
  oculto?: boolean;
  descuento?: number;
  es_producto_familiar?: boolean;
  precios_familia?: {
    nino?: number | null;
    hombre?: number | null;
    mujer?: number | null;
    dama_unica?: number | null;
    dama_plus?: number | null;
    caballero_unica?: number | null;
    unisex_2xl?: number | null;
    precios_tallas?: Record<string, number> | null;
    precios_detallados?: Record<string, { detal?: number; mayor?: number; p50?: number }> | null;
  } | null;
}

export interface Categoria {
  id: string;
  nombre: string;
  slug: string;
  icono?: string;
  color?: string;
  orden: number;
  imagen_url?: string;
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
  tenant_id?: string;
  nombre_negocio: string;
  whatsapp: string;
  logo_url?: string;
  descripcion_hero?: string;
  link_dropshipper?: string;
  link_ganar_dinero?: string;
  video_hero_url?: string;
  siigo_username?: string;
  siigo_access_key?: string;
  siigo_sincronizado_at?: string;
  color_primario?: string;
  direccion?: string;
  google_maps_url?: string;
  email?: string;
  telefono?: string;
  envios_99_api_key?: string;
  google_analytics_id?: string;
  meta_pixel_id?: string;
  clarity_project_id?: string;
  preguntar_tipo_cliente?: boolean;
  descuento_mayor_carrito_activo?: boolean;
  activar_minijuegos?: boolean;
  admin_nombre?: string;
  admin_foto_url?: string;
  admin_pin?: string;
  metodos_pago?: string;
  descuento_promocional?: number;
  impresora_termica_ancho?: '58mm' | '80mm';
  formato_ticket_pos?: 'termico' | 'estandar';
  tarjeta_imagen_fit?: 'cover' | 'contain' | 'fill' | 'scale-down';
  tarjeta_imagen_posicion?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  tarjeta_imagen_aspecto?: '1/1' | '3/4' | '4/5' | '4/3' | '16/9' | 'auto' | 'auto-fit';
}

export interface Pedido {
  id: string;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion: string;
  ciudad: string;
  total: number;
  productos: any;
  linea_whatsapp: string;
  tenant_id: string;
  created_at: string;
  pantallazo_url?: string;
  atendido?: boolean;
  estado?: string;
  numero_guia?: string;
  origen?: string;
  evidencia_despacho_url?: string;
  envio_metodo?: string;
}

export interface Asesor {
  id: string;
  nombre: string;
  telefono: string;
  pin: string;
  tenant_id: string;
  created_at: string;
  foto_url?: string | null;
  ajustes_productos?: any;
}

export interface Mayorista {
  id: string;
  nombre: string;
  telefono: string;
  pin: string;
  tenant_id: string;
  created_at: string;
  foto_url?: string | null;
  porcentaje_ganancia?: number;
  ajustes_productos?: any;
  nombre_negocio?: string;
  logo_url?: string;
  video_hero_url?: string;
}

export interface PQRS {
  id: string;
  tenant_id: string;
  created_at: string;
  nombre_cliente: string;
  telefono_cliente: string;
  numero_pedido?: string;
  motivo: string;
  descripcion: string;
  evidencia_url?: string;
  estado: string;
}
