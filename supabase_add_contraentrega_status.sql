-- Migración para añadir soporte de historial de auditoría y estados en pedidos
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS historial JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS fecha_envio_mensaje TIMESTAMPTZ;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS evidencia_entrega_url TEXT;

COMMENT ON COLUMN public.pedidos.historial IS 'Registro de auditoría con fecha, usuario y acción de cada cambio de estado';
COMMENT ON COLUMN public.pedidos.fecha_envio_mensaje IS 'Fecha y hora en que se envió el mensaje de confirmación por WhatsApp';
COMMENT ON COLUMN public.pedidos.evidencia_entrega_url IS 'Comprobante o recibo de entrega y pago en pedidos contra entrega';
