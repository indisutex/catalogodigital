-- Actualizar la tabla de leads para soportar retargeting mejorado
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS productos jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS retargeting_estado text DEFAULT 'pendiente',
ADD COLUMN IF NOT EXISTS retargeted_by text;

-- Habilitar permisos si son necesarios para las inserciones públicas
GRANT ALL ON TABLE public.leads TO anon;
GRANT ALL ON TABLE public.leads TO authenticated;
GRANT ALL ON TABLE public.leads TO service_role;
