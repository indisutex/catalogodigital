-- Crear tabla para almacenar borradores de leads (checkouts abandonados)
CREATE TABLE IF NOT EXISTS public.leads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre text,
    telefono text,
    ciudad text,
    tenant_id text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    estado text DEFAULT 'abandonado' -- 'abandonado' o 'completado'
);

-- Habilitar RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso para permitir que los usuarios en el catálogo registren su borrador
CREATE POLICY "Permitir inserciones públicas" ON public.leads
FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualizaciones públicas" ON public.leads
FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Permitir lecturas públicas" ON public.leads
FOR SELECT USING (true);

CREATE POLICY "Permitir eliminaciones públicas" ON public.leads
FOR DELETE USING (true);
