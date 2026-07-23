-- Script para agregar la columna descuento_promocional a la tabla configuracion
ALTER TABLE configuracion ADD COLUMN descuento_promocional INTEGER DEFAULT 0;
