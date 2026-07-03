-- Agregar columna para la integración de 99 Envíos a la tabla configuracion
-- Ejecuta este comando en el editor SQL de Supabase (SQL Editor)

ALTER TABLE public.configuracion 
ADD COLUMN IF NOT EXISTS envios_99_api_key text;
