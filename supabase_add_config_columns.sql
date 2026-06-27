-- Copia y ejecuta este código en el editor SQL de Supabase para agregar las columnas a la tabla de configuración:

ALTER TABLE public.configuracion 
ADD COLUMN IF NOT EXISTS link_dropshipper TEXT,
ADD COLUMN IF NOT EXISTS link_ganar_dinero TEXT;
