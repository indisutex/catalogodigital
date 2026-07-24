-- ================================================================
-- ERP INTEGRADO - FASE 3: INGRESOS, EGRESOS Y MIGRACIÓN HISTÓRICA
-- Plataforma Multitenant | Compatible con Supabase (PostgreSQL)
-- ================================================================

-- ===================================================
-- 1. TABLA DE EGRESOS / GASTOS OPERATIVOS
-- ===================================================
CREATE TABLE IF NOT EXISTS public.erp_egresos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    categoria TEXT NOT NULL DEFAULT 'Gasto Operativo',
    -- Categorías: Arriendo, Servicios Públicos, Nómina, Transporte, Marketing, Comisiones, Proveedor, Otro
    concepto TEXT NOT NULL,
    proveedor_nombre TEXT,
    proveedor_documento TEXT,
    monto NUMERIC(18,2) NOT NULL DEFAULT 0,
    metodo_pago TEXT DEFAULT 'Efectivo',
    -- Efectivo, Transferencia, Nequi, Daviplata, Tarjeta
    comprobante_url TEXT,
    notas TEXT,
    registrado_por TEXT,
    comprobante_contable_id UUID REFERENCES public.erp_comprobantes_contables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS para erp_egresos
ALTER TABLE public.erp_egresos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "erp_egresos_tenant" ON public.erp_egresos;
CREATE POLICY "erp_egresos_tenant" ON public.erp_egresos
    USING (true) WITH CHECK (true);

-- Índice para egresos
CREATE INDEX IF NOT EXISTS idx_erp_egresos_tenant_fecha 
    ON public.erp_egresos(tenant_id, fecha DESC);

-- ===================================================
-- 2. TABLA RESUMEN DIARIO DE CAJA (CIERRE DE CAJA)
-- ===================================================
CREATE TABLE IF NOT EXISTS public.erp_cierres_caja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    fecha DATE NOT NULL,
    total_ventas_efectivo NUMERIC(18,2) DEFAULT 0,
    total_ventas_transferencia NUMERIC(18,2) DEFAULT 0,
    total_ventas_nequi NUMERIC(18,2) DEFAULT 0,
    total_ventas_daviplata NUMERIC(18,2) DEFAULT 0,
    total_ventas_otro NUMERIC(18,2) DEFAULT 0,
    total_egresos NUMERIC(18,2) DEFAULT 0,
    saldo_inicial NUMERIC(18,2) DEFAULT 0,
    saldo_final NUMERIC(18,2) DEFAULT 0,
    observaciones TEXT,
    cerrado_por TEXT,
    cerrado_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, fecha)
);

ALTER TABLE public.erp_cierres_caja ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "erp_cierres_caja_tenant" ON public.erp_cierres_caja;
CREATE POLICY "erp_cierres_caja_tenant" ON public.erp_cierres_caja
    USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_erp_cierres_caja_tenant_fecha 
    ON public.erp_cierres_caja(tenant_id, fecha DESC);

-- ===================================================
-- 3. FUNCIÓN: MIGRAR PEDIDOS HISTÓRICOS AL ERP
--    Contabiliza automáticamente todos los pedidos
--    aprobados/pagados que aún no tienen registro contable
-- ===================================================
CREATE OR REPLACE FUNCTION public.erp_migrar_pedidos_historicos(p_tenant_id TEXT)
RETURNS TABLE(pedidos_migrados INT, total_migrado NUMERIC) AS $$
DECLARE
    v_pedido RECORD;
    v_tercero_id UUID;
    v_comprobante_id UUID;
    v_count INT := 0;
    v_total_sum NUMERIC := 0;
    v_doc TEXT;
BEGIN
    -- Iterar sobre pedidos aprobados/pagados sin contabilización previa
    FOR v_pedido IN
        SELECT p.*
        FROM public.pedidos p
        WHERE p.tenant_id = p_tenant_id
          AND p.estado IN ('aprobado', 'pagado', 'enviado', 'entregado')
          AND NOT EXISTS (
              SELECT 1 FROM public.erp_comprobantes_contables cc
              WHERE cc.referencia_origen = p.id::TEXT
                AND cc.tenant_id = p_tenant_id
          )
        ORDER BY p.created_at ASC
    LOOP
        BEGIN
            -- Documento del cliente
            v_doc := COALESCE(NULLIF(TRIM(v_pedido.cliente_telefono), ''), '222222222222');

            -- Upsert Tercero
            INSERT INTO public.erp_terceros(tenant_id, tipo_documento, numero_documento, razon_social, telefono, ciudad, es_cliente)
            VALUES (p_tenant_id, 'CC', v_doc, COALESCE(NULLIF(v_pedido.cliente_nombre, ''), 'Consumidor Final'), v_pedido.cliente_telefono, v_pedido.ciudad, true)
            ON CONFLICT (tenant_id, numero_documento) DO UPDATE SET razon_social = EXCLUDED.razon_social
            RETURNING id INTO v_tercero_id;

            IF v_tercero_id IS NULL THEN
                SELECT id INTO v_tercero_id FROM public.erp_terceros WHERE tenant_id = p_tenant_id AND numero_documento = v_doc LIMIT 1;
            END IF;

            -- Crear Comprobante
            INSERT INTO public.erp_comprobantes_contables(
                tenant_id, tipo_comprobante, fecha, concepto, referencia_origen,
                origen_modulo, estado, creado_por
            )
            VALUES (
                p_tenant_id, 'Venta',
                COALESCE(v_pedido.created_at::DATE, CURRENT_DATE),
                'Venta Histórica Pedido #' || LEFT(v_pedido.id::TEXT, 8) || ' - ' || COALESCE(v_pedido.cliente_nombre, 'Consumidor Final'),
                v_pedido.id::TEXT,
                'ventas', 'Asentado', 'Migración ERP Fase 3'
            )
            RETURNING id INTO v_comprobante_id;

            -- Asiento Débito (Caja / Ingreso)
            INSERT INTO public.erp_asientos_contables(
                tenant_id, comprobante_id, cuenta_codigo, cuenta_nombre,
                tercero_id, concepto_linea, debito, credito, orden
            ) VALUES (
                p_tenant_id, v_comprobante_id, '110505', 'Caja General',
                v_tercero_id,
                'Ingreso Caja Venta #' || LEFT(v_pedido.id::TEXT, 8),
                COALESCE(v_pedido.total, 0), 0, 1
            );

            -- Asiento Crédito (Ingresos por Ventas)
            INSERT INTO public.erp_asientos_contables(
                tenant_id, comprobante_id, cuenta_codigo, cuenta_nombre,
                tercero_id, concepto_linea, debito, credito, orden
            ) VALUES (
                p_tenant_id, v_comprobante_id, '413505', 'Venta de Textiles y Confecciones',
                v_tercero_id,
                'Venta Comercial #' || LEFT(v_pedido.id::TEXT, 8),
                0, COALESCE(v_pedido.total, 0), 2
            );

            v_count := v_count + 1;
            v_total_sum := v_total_sum + COALESCE(v_pedido.total, 0);

        EXCEPTION WHEN OTHERS THEN
            -- Si hay error en un pedido, continúa con el siguiente
            RAISE WARNING 'Error migrando pedido %: %', v_pedido.id, SQLERRM;
        END;
    END LOOP;

    pedidos_migrados := v_count;
    total_migrado := v_total_sum;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ===================================================
-- 4. EJECUTAR MIGRACIÓN PARA TODOS LOS TENANTS
-- ===================================================
SELECT tenant_id, pedidos_migrados, total_migrado
FROM (
    SELECT 'saramantha' AS tenant_id, r.* FROM public.erp_migrar_pedidos_historicos('saramantha') r
    UNION ALL
    SELECT 'sublimados_majestic', r.* FROM public.erp_migrar_pedidos_historicos('sublimados_majestic') r
    UNION ALL
    SELECT 'pijamas_lucerito', r.* FROM public.erp_migrar_pedidos_historicos('pijamas_lucerito') r
    UNION ALL
    SELECT 'indisutex', r.* FROM public.erp_migrar_pedidos_historicos('indisutex') r
    UNION ALL
    SELECT 'lovely', r.* FROM public.erp_migrar_pedidos_historicos('lovely') r
    UNION ALL
    SELECT 'default', r.* FROM public.erp_migrar_pedidos_historicos('default') r
) AS migracion;
