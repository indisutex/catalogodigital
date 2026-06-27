-- 1. Crear tabla de categorias
CREATE TABLE IF NOT EXISTS public.categorias (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icono TEXT,
    color TEXT,
    orden SERIAL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Crear tabla de subcategorias
CREATE TABLE IF NOT EXISTS public.subcategorias (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    categoria_id UUID REFERENCES public.categorias(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    slug TEXT NOT NULL,
    orden INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Crear tabla de configuracion
CREATE TABLE IF NOT EXISTS public.configuracion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre_negocio TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    logo_url TEXT,
    descripcion_hero TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Modificar tabla de productos (agregar nuevas columnas si no existen)
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS subcategoria TEXT;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS tallas TEXT;

-- 5. Habilitar RLS en las nuevas tablas
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

-- 6. Crear políticas públicas (Lectura y Escritura ilimitada para desarrollo/producción simple)
-- Politicas para categorias
CREATE POLICY "Permitir todo a categorias" ON public.categorias FOR ALL TO public USING (true) WITH CHECK (true);

-- Politicas para subcategorias
CREATE POLICY "Permitir todo a subcategorias" ON public.subcategorias FOR ALL TO public USING (true) WITH CHECK (true);

-- Politicas para configuracion
CREATE POLICY "Permitir todo a configuracion" ON public.configuracion FOR ALL TO public USING (true) WITH CHECK (true);

-- Asegurar politicas completas en productos por si acaso
DROP POLICY IF EXISTS "Permitir lectura pública de productos" ON public.productos;
CREATE POLICY "Permitir todo a productos" ON public.productos FOR ALL TO public USING (true) WITH CHECK (true);

-- 7. Insertar fila inicial de configuración si está vacía
INSERT INTO public.configuracion (nombre_negocio, whatsapp, descripcion_hero, logo_url)
SELECT 'Indisutex', '573185637317', 'CATÁLOGO DIGITAL', 'https://images.unsplash.com/photo-1596814234568-19ebcc1af3fa?auto=format&fit=crop&q=80&w=100'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion);

-- 8. Crear bucket de storage 'archivos' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('archivos', 'archivos', true)
ON CONFLICT (id) DO NOTHING;

-- 9. Crear políticas de storage para permitir subidas y lecturas públicas en el bucket 'archivos'
DROP POLICY IF EXISTS "Permitir lectura pública de archivos" ON storage.objects;
CREATE POLICY "Permitir lectura pública de archivos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'archivos');

DROP POLICY IF EXISTS "Permitir subida pública de archivos" ON storage.objects;
CREATE POLICY "Permitir subida pública de archivos"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'archivos');

DROP POLICY IF EXISTS "Permitir actualización pública de archivos" ON storage.objects;
CREATE POLICY "Permitir actualización pública de archivos"
ON storage.objects FOR UPDATE TO public
USING (bucket_id = 'archivos')
WITH CHECK (bucket_id = 'archivos');

DROP POLICY IF EXISTS "Permitir eliminación pública de archivos" ON storage.objects;
CREATE POLICY "Permitir eliminación pública de archivos"
ON storage.objects FOR DELETE TO public
USING (bucket_id = 'archivos');
