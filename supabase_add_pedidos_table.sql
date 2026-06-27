-- Copia y pega este script en el editor SQL de tu panel de Supabase para crear la tabla de pedidos:

CREATE TABLE IF NOT EXISTS public.pedidos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_nombre TEXT NOT NULL,
    cliente_telefono TEXT NOT NULL,
    direccion TEXT NOT NULL,
    ciudad TEXT NOT NULL,
    total NUMERIC NOT NULL,
    productos JSONB NOT NULL,
    linea_whatsapp TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso público (Lectura y Escritura ilimitada)
DROP POLICY IF EXISTS "Permitir todo a pedidos" ON public.pedidos;
CREATE POLICY "Permitir todo a pedidos" ON public.pedidos FOR ALL TO public USING (true) WITH CHECK (true);
