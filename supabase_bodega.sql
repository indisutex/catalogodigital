-- BODEGA GENERAL (pantalla /bodega): una sola bodega para todas las tiendas.
-- Ejecutar completo en Supabase > SQL Editor. Es seguro correrlo más de una vez
-- (también si ya habías ejecutado la versión anterior).

-- 1. Conteos: una línea por tienda + referencia + talla + color + ubicación
CREATE TABLE IF NOT EXISTS public.bodega_conteos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',   -- aquí va la TIENDA dueña de la mercancía
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

CREATE UNIQUE INDEX IF NOT EXISTS bodega_conteos_unica
ON public.bodega_conteos (tenant_id, referencia, talla, color, ubicacion);
CREATE INDEX IF NOT EXISTS idx_bodega_conteos_tenant ON public.bodega_conteos (tenant_id);

ALTER TABLE public.bodega_conteos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a bodega_conteos" ON public.bodega_conteos;
CREATE POLICY "Permitir todo a bodega_conteos" ON public.bodega_conteos
FOR ALL TO public USING (true) WITH CHECK (true);

-- 2. Suma atómica: si la línea existe suma (o resta con número negativo), si no, la crea.
--    Así dos tablets contando a la vez no se pisan.
CREATE OR REPLACE FUNCTION public.bodega_sumar(
    p_tenant TEXT, p_referencia TEXT, p_producto TEXT,
    p_talla TEXT, p_color TEXT, p_ubicacion TEXT,
    p_cantidad INTEGER, p_por TEXT
) RETURNS INTEGER
LANGUAGE sql
AS $$
    INSERT INTO public.bodega_conteos
        (tenant_id, referencia, producto_nombre, talla, color, ubicacion, cantidad, contado_por)
    VALUES
        (p_tenant, p_referencia, p_producto, COALESCE(p_talla, ''), COALESCE(p_color, ''),
         COALESCE(p_ubicacion, ''), GREATEST(p_cantidad, 0), p_por)
    ON CONFLICT (tenant_id, referencia, talla, color, ubicacion) DO UPDATE
    SET cantidad = GREATEST(public.bodega_conteos.cantidad + p_cantidad, 0),
        contado_por = COALESCE(p_por, public.bodega_conteos.contado_por),
        producto_nombre = COALESCE(p_producto, public.bodega_conteos.producto_nombre),
        updated_at = timezone('utc'::text, now())
    RETURNING cantidad;
$$;

-- 3. Envíos a aprobación del administrador
CREATE TABLE IF NOT EXISTS public.bodega_cierres (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'general',
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
    enviado_por TEXT,
    enviado_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    total_lineas INTEGER NOT NULL DEFAULT 0,
    total_unidades INTEGER NOT NULL DEFAULT 0,
    detalle JSONB NOT NULL DEFAULT '[]'::jsonb,
    resuelto_por TEXT,
    resuelto_at TIMESTAMP WITH TIME ZONE,
    nota TEXT
);
CREATE INDEX IF NOT EXISTS idx_bodega_cierres_tenant ON public.bodega_cierres (tenant_id, enviado_at DESC);

ALTER TABLE public.bodega_cierres ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a bodega_cierres" ON public.bodega_cierres;
CREATE POLICY "Permitir todo a bodega_cierres" ON public.bodega_cierres
FOR ALL TO public USING (true) WITH CHECK (true);

-- 4. PINs de la bodega (una sola fila). CÁMBIALOS en el paso 5.
CREATE TABLE IF NOT EXISTS public.bodega_ajustes (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    pin_bodega TEXT NOT NULL DEFAULT '1234',   -- el equipo de bodega: cuenta y envía
    pin_admin  TEXT NOT NULL DEFAULT '0000'    -- el administrador: además aprueba o rechaza
);
INSERT INTO public.bodega_ajustes (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.bodega_ajustes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a bodega_ajustes" ON public.bodega_ajustes;
CREATE POLICY "Permitir todo a bodega_ajustes" ON public.bodega_ajustes
FOR ALL TO public USING (true) WITH CHECK (true);

-- 5. Cambia los PIN por los tuyos (ejecuta esta línea aparte, con tus números):
-- UPDATE public.bodega_ajustes SET pin_bodega = '2468', pin_admin = '1357' WHERE id = 1;
