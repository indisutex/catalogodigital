-- Copia y pega este script en el editor SQL de tu panel de Supabase para habilitar la configuración de los nuevos botones:

ALTER TABLE public.configuracion 
ADD COLUMN IF NOT EXISTS link_dropshipper TEXT,
ADD COLUMN IF NOT EXISTS link_ganar_dinero TEXT;
