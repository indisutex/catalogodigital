-- Crear tabla de mayoristas independiente
CREATE TABLE IF NOT EXISTS public.mayoristas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    telefono TEXT NOT NULL,
    pin TEXT NOT NULL DEFAULT '1234',
    tenant_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    foto_url TEXT,
    porcentaje_ganancia NUMERIC DEFAULT 0
);

-- Habilitar RLS
ALTER TABLE public.mayoristas ENABLE ROW LEVEL SECURITY;

-- Crear política de acceso total para todos los usuarios
DROP POLICY IF EXISTS "Permitir acceso total a mayoristas" ON public.mayoristas;
CREATE POLICY "Permitir acceso total a mayoristas" ON public.mayoristas
    FOR ALL USING (true) WITH CHECK (true);
