-- Agregar columnas para la integración de Siigo Nube a la tabla configuracion
ALTER TABLE public.configuracion 
ADD COLUMN IF NOT EXISTS siigo_username text,
ADD COLUMN IF NOT EXISTS siigo_access_key text,
ADD COLUMN IF NOT EXISTS siigo_sincronizado_at timestamp with time zone;

-- Agregar columna para la referencia (código de producto de Siigo) e inventario (stock)
ALTER TABLE public.productos
ADD COLUMN IF NOT EXISTS referencia text,
ADD COLUMN IF NOT EXISTS stock integer DEFAULT 0;
