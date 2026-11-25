-- Conteo de bodega (pantalla /bodega)
-- Ejecutar en Supabase > SQL Editor. Es seguro correrlo más de una vez.

-- 1. PIN propio para bodega (así no se comparte el PIN del administrador)
ALTER TABLE public.configuracion ADD COLUMN IF NOT EXISTS bodega_pin TEXT;

-- 2. Tabla de conteos
CREATE TABLE IF NOT EXISTS public.bodega_conteos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    referencia TEXT NOT NULL,
    producto_nombre TEXT,
    talla TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '',
    ubicacion TEXT NOT NULL DEFAULT '',
    cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    contado_por TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Una sola línea por referencia + talla + color + ubicación en cada tienda
CREATE UNIQUE INDEX IF NOT EXISTS bodega_conteos_unica
ON public.bodega_conteos (tenant_id, referencia, talla, color, ubicacion);

CREATE INDEX IF NOT EXISTS idx_bodega_conteos_tenant ON public.bodega_conteos (tenant_id);

-- 3. Permisos (mismo esquema abierto que usan las demás tablas del proyecto)
ALTER TABLE public.bodega_conteos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a bodega_conteos" ON public.bodega_conteos;
CREATE POLICY "Permitir todo a bodega_conteos" ON public.bodega_conteos
FOR ALL TO public USING (true) WITH CHECK (true);

-- 4. (Opcional) Definir el PIN de bodega de una tienda. Cambia 'sublimados_majestic' y '1234'.
-- UPDATE public.configuracion SET bodega_pin = '1234' WHERE tenant_id = 'sublimados_majestic';
