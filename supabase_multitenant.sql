-- Añadir columna tenant_id a las tablas existentes
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default' NOT NULL;
ALTER TABLE public.subcategorias ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default' NOT NULL;
ALTER TABLE public.configuracion ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default' NOT NULL;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default' NOT NULL;

-- Crear un índice en tenant_id para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_categorias_tenant ON public.categorias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subcategorias_tenant ON public.subcategorias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_configuracion_tenant ON public.configuracion(tenant_id);
CREATE INDEX IF NOT EXISTS idx_productos_tenant ON public.productos(tenant_id);
