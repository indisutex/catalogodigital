CREATE SEQUENCE IF NOT EXISTS public.pedidos_numero_seq START 1001;

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS numero_pedido BIGINT;

UPDATE public.pedidos p
SET numero_pedido = n.rn + (SELECT COALESCE(MAX(numero_pedido), 1000) FROM public.pedidos)
FROM (
    SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
    FROM public.pedidos
    WHERE numero_pedido IS NULL
) n
WHERE p.id = n.id;

SELECT setval('public.pedidos_numero_seq', (SELECT COALESCE(MAX(numero_pedido), 1000) FROM public.pedidos));

ALTER TABLE public.pedidos ALTER COLUMN numero_pedido SET DEFAULT nextval('public.pedidos_numero_seq');

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_numero_pedido_uq ON public.pedidos (numero_pedido);

NOTIFY pgrst, 'reload schema';
