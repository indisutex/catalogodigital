-- 1. Agregar la columna de ajustes_productos que faltaba en la base de datos
ALTER TABLE public.mayoristas ADD COLUMN IF NOT EXISTS ajustes_productos JSONB DEFAULT '{}'::jsonb;

-- 2. Migrar a Lady (y cualquier otro mayorista) de la tabla asesores a la tabla mayoristas
INSERT INTO public.mayoristas (id, nombre, telefono, pin, tenant_id, created_at, foto_url, porcentaje_ganancia, ajustes_productos)
SELECT 
    id, 
    nombre, 
    telefono, 
    pin, 
    tenant_id, 
    created_at, 
    foto_url, 
    0 as porcentaje_ganancia, 
    '{}'::jsonb as ajustes_productos
FROM public.asesores 
WHERE nombre ILIKE '%Lady%';

-- 3. Eliminar a Lady de la tabla antigua (asesores) para que no salga duplicada
DELETE FROM public.asesores WHERE nombre ILIKE '%Lady%';
