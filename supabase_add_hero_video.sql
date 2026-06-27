-- Ejecuta esta consulta en el SQL Editor de tu panel de Supabase para agregar la columna de video de portada:

ALTER TABLE public.configuracion 
ADD COLUMN IF NOT EXISTS video_hero_url TEXT;
