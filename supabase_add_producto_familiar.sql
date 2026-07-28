-- SQL Migration: Soporte para Productos Familiares (Niño, Hombre, Mujer)
ALTER TABLE productos ADD COLUMN IF NOT EXISTS es_producto_familiar BOOLEAN DEFAULT FALSE;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precios_familia JSONB DEFAULT NULL;
