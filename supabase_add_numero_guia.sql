-- Script para agregar la columna de número de guía a la tabla de pedidos
-- Ejecuta este comando en el editor SQL de Supabase (SQL Editor)

ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS numero_guia TEXT;
