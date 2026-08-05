-- Copia y ejecuta este código en el editor SQL de Supabase para agregar las columnas faltantes a la tabla 'configuracion':

ALTER TABLE public.configuracion 
ADD COLUMN IF NOT EXISTS direccion TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS telefono TEXT,
ADD COLUMN IF NOT EXISTS link_dropshipper TEXT,
ADD COLUMN IF NOT EXISTS link_ganar_dinero TEXT,
ADD COLUMN IF NOT EXISTS impresora_termica_ancho TEXT DEFAULT '58mm',
ADD COLUMN IF NOT EXISTS formato_ticket_pos TEXT DEFAULT 'termico',
ADD COLUMN IF NOT EXISTS descuento_mayor_carrito_activo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS activar_minijuegos BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS tarjeta_imagen_fit TEXT DEFAULT 'cover',
ADD COLUMN IF NOT EXISTS tarjeta_imagen_posicion TEXT DEFAULT 'center',
ADD COLUMN IF NOT EXISTS tarjeta_imagen_aspecto TEXT DEFAULT '1/1';
