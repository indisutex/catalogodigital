-- Crear tabla de asesores para el multitenant
CREATE TABLE IF NOT EXISTS public.asesores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    telefono TEXT NOT NULL,
    pin TEXT NOT NULL DEFAULT '1234',
    tenant_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.asesores ENABLE ROW LEVEL SECURITY;

-- Crear política de acceso total para todos los usuarios anon/authenticated
CREATE POLICY "Permitir acceso total a asesores" ON public.asesores
    FOR ALL USING (true) WITH CHECK (true);
