-- 1. Agregar columna 'estado' a la tabla de pedidos si no existe
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente';

-- 2. Crear la tabla de clientes con compras exitosas
CREATE TABLE IF NOT EXISTS public.clientes_exitosos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    telefono TEXT NOT NULL,
    direccion TEXT,
    ciudad TEXT,
    tenant_id TEXT NOT NULL,
    total_compras NUMERIC DEFAULT 0 NOT NULL,
    numero_pedidos INTEGER DEFAULT 0 NOT NULL,
    ultima_compra TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_cliente_telefono_tenant UNIQUE (telefono, tenant_id)
);

-- 3. Habilitar RLS (Row Level Security) en clientes_exitosos
ALTER TABLE public.clientes_exitosos ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas de acceso para permitir todas las operaciones públicas
DROP POLICY IF EXISTS "Permitir todo a clientes_exitosos" ON public.clientes_exitosos;
CREATE POLICY "Permitir todo a clientes_exitosos" ON public.clientes_exitosos FOR ALL TO public USING (true) WITH CHECK (true);

-- 5. Agregar nuevas columnas a la tabla 'productos' para costos, precios mayoristas y estampados
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS costo NUMERIC DEFAULT 0;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS precio_por_mayor NUMERIC DEFAULT 0;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS precio_50_unidades NUMERIC DEFAULT 0;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS estampados TEXT; -- Almacena opciones como: "Bob Esponja, Spider-Man, Mickey Mouse"
