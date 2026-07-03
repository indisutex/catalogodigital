-- Script para agregar la columna 'origen' a la tabla de pedidos
-- Ejecuta este comando en el editor SQL de Supabase (SQL Editor)

ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS origen TEXT DEFAULT 'catalogo';
