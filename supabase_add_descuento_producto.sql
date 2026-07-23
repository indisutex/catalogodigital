-- Script para agregar la columna descuento a la tabla productos
ALTER TABLE productos ADD COLUMN descuento INTEGER DEFAULT 0;
