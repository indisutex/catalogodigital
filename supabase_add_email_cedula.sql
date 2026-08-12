-- Copia y pega este script en el SQL Editor de tu panel de Supabase:
-- Esto asegura que las tablas 'pedidos' y 'leads' guarden explícitamente el correo y la cédula en sus propias columnas.

-- 1. Agregar columnas a la tabla de pedidos
ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS cliente_email TEXT,
ADD COLUMN IF NOT EXISTS cliente_cedula TEXT,
ADD COLUMN IF NOT EXISTS metodo_pago TEXT,
ADD COLUMN IF NOT EXISTS metodo_envio TEXT;

-- 2. Agregar columnas a la tabla de leads (carritos abandonados)
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS cliente_email TEXT,
ADD COLUMN IF NOT EXISTS cliente_cedula TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS cedula TEXT;

-- Confirmación de permisos
GRANT ALL ON TABLE public.pedidos TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.leads TO anon, authenticated, service_role;
