-- ================================================================
-- ERP INTEGRADO - FASE 4: TESORERÍA, CxC y CxP
-- Caja, Bancos, Ingresos, Egresos, Cartera, Proveedores
-- Plataforma Multitenant | Compatible con Supabase (PostgreSQL)
-- ================================================================

-- ===================================================
-- 1. CUENTAS BANCARIAS / CAJAS DE LA EMPRESA
-- ===================================================
CREATE TABLE IF NOT EXISTS public.erp_cuentas_bancarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    nombre TEXT NOT NULL,
    -- Ej: "Caja General", "Bancolombia CC", "Nequi Empresa", "Daviplata"
    tipo TEXT NOT NULL DEFAULT 'Caja',
    -- Caja, Cuenta Corriente, Cuenta Ahorros, Billetera Digital, Otro
    banco TEXT,
    -- Nombre del banco: Bancolombia, Davivienda, BBVA, etc.
    numero_cuenta TEXT,
    titular TEXT,
    saldo_inicial NUMERIC(18,2) DEFAULT 0,
    saldo_actual NUMERIC(18,2) DEFAULT 0,
    activa BOOLEAN DEFAULT true,
    color TEXT DEFAULT '#6366f1',
    -- Para identificar visualmente cada cuenta
    cuenta_puc TEXT DEFAULT '110505',
    -- Cuenta PUC asociada (110505=Caja, 111005=Bancos, etc.)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.erp_cuentas_bancarias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "erp_cuentas_bancarias_tenant" ON public.erp_cuentas_bancarias;
CREATE POLICY "erp_cuentas_bancarias_tenant" ON public.erp_cuentas_bancarias
    USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_erp_cuentas_bancarias_tenant 
    ON public.erp_cuentas_bancarias(tenant_id);

-- ===================================================
-- 2. MOVIMIENTOS DE TESORERÍA (Ingresos y Egresos)
-- ===================================================
CREATE TABLE IF NOT EXISTS public.erp_movimientos_tesoreria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    cuenta_id UUID REFERENCES public.erp_cuentas_bancarias(id),
    tipo TEXT NOT NULL,
    -- Ingreso, Egreso, Traslado
    categoria TEXT NOT NULL DEFAULT 'Otro',
    -- Para Ingresos: Venta, Cobro Cartera, Anticipo, Devolución, Otro
    -- Para Egresos: Arriendo, Servicios, Nómina, Proveedor, Transporte, Comisión, Impuesto, Otro
    concepto TEXT NOT NULL,
    referencia TEXT,
    -- Número de pedido, factura, recibo, etc.
    tercero_id UUID REFERENCES public.erp_terceros(id),
    -- Cliente o proveedor asociado
    monto NUMERIC(18,2) NOT NULL DEFAULT 0,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    comprobante_url TEXT,
    -- Foto del recibo / soporte
    notas TEXT,
    registrado_por TEXT,
    comprobante_contable_id UUID REFERENCES public.erp_comprobantes_contables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.erp_movimientos_tesoreria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "erp_movimientos_tesoreria_tenant" ON public.erp_movimientos_tesoreria;
CREATE POLICY "erp_movimientos_tesoreria_tenant" ON public.erp_movimientos_tesoreria
    USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_erp_movimientos_tesoreria_tenant_fecha 
    ON public.erp_movimientos_tesoreria(tenant_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_erp_movimientos_tesoreria_cuenta 
    ON public.erp_movimientos_tesoreria(cuenta_id);

-- ===================================================
-- 3. CUENTAS POR COBRAR (Cartera de Clientes)
-- ===================================================
CREATE TABLE IF NOT EXISTS public.erp_cuentas_por_cobrar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    tercero_id UUID REFERENCES public.erp_terceros(id),
    -- Cliente al que se le cobra
    cliente_nombre TEXT NOT NULL,
    concepto TEXT NOT NULL,
    -- Descripción de la deuda
    referencia_pedido TEXT,
    -- ID del pedido relacionado
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE,
    monto_total NUMERIC(18,2) NOT NULL DEFAULT 0,
    monto_pagado NUMERIC(18,2) DEFAULT 0,
    saldo_pendiente NUMERIC(18,2) GENERATED ALWAYS AS (monto_total - monto_pagado) STORED,
    estado TEXT NOT NULL DEFAULT 'Pendiente',
    -- Pendiente, Parcial, Pagado, Vencido, Incobrable
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.erp_cuentas_por_cobrar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "erp_cuentas_por_cobrar_tenant" ON public.erp_cuentas_por_cobrar;
CREATE POLICY "erp_cuentas_por_cobrar_tenant" ON public.erp_cuentas_por_cobrar
    USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_erp_cxc_tenant_estado 
    ON public.erp_cuentas_por_cobrar(tenant_id, estado);

-- ===================================================
-- 4. CUENTAS POR PAGAR (Pagos a Proveedores)
-- ===================================================
CREATE TABLE IF NOT EXISTS public.erp_cuentas_por_pagar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    tercero_id UUID REFERENCES public.erp_terceros(id),
    -- Proveedor al que se le paga
    proveedor_nombre TEXT NOT NULL,
    concepto TEXT NOT NULL,
    numero_factura TEXT,
    -- Número de factura del proveedor
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE,
    monto_total NUMERIC(18,2) NOT NULL DEFAULT 0,
    monto_pagado NUMERIC(18,2) DEFAULT 0,
    saldo_pendiente NUMERIC(18,2) GENERATED ALWAYS AS (monto_total - monto_pagado) STORED,
    estado TEXT NOT NULL DEFAULT 'Pendiente',
    -- Pendiente, Parcial, Pagado, Vencido
    categoria TEXT DEFAULT 'Proveedor',
    -- Proveedor, Arriendo, Servicios, Nómina, Impuesto, Otro
    cuenta_bancaria_pago TEXT,
    -- Cuenta desde la que se pagará
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.erp_cuentas_por_pagar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "erp_cuentas_por_pagar_tenant" ON public.erp_cuentas_por_pagar;
CREATE POLICY "erp_cuentas_por_pagar_tenant" ON public.erp_cuentas_por_pagar
    USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_erp_cxp_tenant_estado 
    ON public.erp_cuentas_por_pagar(tenant_id, estado);

-- ===================================================
-- 5. ABONOS / PAGOS PARCIALES
-- ===================================================
CREATE TABLE IF NOT EXISTS public.erp_abonos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    tipo_documento TEXT NOT NULL,
    -- CxC, CxP
    documento_id UUID NOT NULL,
    -- ID de la CxC o CxP
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    monto NUMERIC(18,2) NOT NULL DEFAULT 0,
    metodo_pago TEXT DEFAULT 'Efectivo',
    -- Efectivo, Transferencia, Nequi, Daviplata, Tarjeta
    comprobante_url TEXT,
    notas TEXT,
    registrado_por TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.erp_abonos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "erp_abonos_tenant" ON public.erp_abonos;
CREATE POLICY "erp_abonos_tenant" ON public.erp_abonos
    USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_erp_abonos_documento 
    ON public.erp_abonos(documento_id);

-- ===================================================
-- 6. FUNCIÓN: ACTUALIZAR SALDO CUENTA BANCARIA
-- ===================================================
CREATE OR REPLACE FUNCTION public.erp_actualizar_saldo_cuenta()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo = 'Ingreso' THEN
        UPDATE public.erp_cuentas_bancarias
        SET saldo_actual = saldo_actual + NEW.monto
        WHERE id = NEW.cuenta_id;
    ELSIF NEW.tipo = 'Egreso' THEN
        UPDATE public.erp_cuentas_bancarias
        SET saldo_actual = saldo_actual - NEW.monto
        WHERE id = NEW.cuenta_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_actualizar_saldo_tesoreria ON public.erp_movimientos_tesoreria;
CREATE TRIGGER trg_actualizar_saldo_tesoreria
    AFTER INSERT ON public.erp_movimientos_tesoreria
    FOR EACH ROW EXECUTE FUNCTION public.erp_actualizar_saldo_cuenta();

-- ===================================================
-- 7. FUNCIÓN: ACTUALIZAR ESTADO CxC AL ABONAR
-- ===================================================
CREATE OR REPLACE FUNCTION public.erp_procesar_abono()
RETURNS TRIGGER AS $$
DECLARE
    v_nuevo_pagado NUMERIC;
    v_total NUMERIC;
BEGIN
    IF NEW.tipo_documento = 'CxC' THEN
        SELECT monto_total, monto_pagado + NEW.monto 
        INTO v_total, v_nuevo_pagado
        FROM public.erp_cuentas_por_cobrar WHERE id = NEW.documento_id;
        
        UPDATE public.erp_cuentas_por_cobrar
        SET monto_pagado = v_nuevo_pagado,
            estado = CASE 
                WHEN v_nuevo_pagado >= v_total THEN 'Pagado'
                WHEN v_nuevo_pagado > 0 THEN 'Parcial'
                ELSE 'Pendiente'
            END,
            updated_at = NOW()
        WHERE id = NEW.documento_id;

    ELSIF NEW.tipo_documento = 'CxP' THEN
        SELECT monto_total, monto_pagado + NEW.monto 
        INTO v_total, v_nuevo_pagado
        FROM public.erp_cuentas_por_pagar WHERE id = NEW.documento_id;
        
        UPDATE public.erp_cuentas_por_pagar
        SET monto_pagado = v_nuevo_pagado,
            estado = CASE 
                WHEN v_nuevo_pagado >= v_total THEN 'Pagado'
                WHEN v_nuevo_pagado > 0 THEN 'Parcial'
                ELSE 'Pendiente'
            END,
            updated_at = NOW()
        WHERE id = NEW.documento_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_procesar_abono ON public.erp_abonos;
CREATE TRIGGER trg_procesar_abono
    AFTER INSERT ON public.erp_abonos
    FOR EACH ROW EXECUTE FUNCTION public.erp_procesar_abono();

-- ===================================================
-- 8. INICIALIZAR CUENTAS BANCARIAS POR DEFECTO
-- ===================================================
CREATE OR REPLACE FUNCTION public.erp_inicializar_cuentas_bancarias(p_tenant_id TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.erp_cuentas_bancarias (tenant_id, nombre, tipo, saldo_inicial, saldo_actual, color, cuenta_puc)
    VALUES
        (p_tenant_id, 'Caja General', 'Caja', 0, 0, '#10b981', '110505'),
        (p_tenant_id, 'Caja Menor', 'Caja', 0, 0, '#6366f1', '110510'),
        (p_tenant_id, 'Nequi / Daviplata', 'Billetera Digital', 0, 0, '#8b5cf6', '110515'),
        (p_tenant_id, 'Cuenta Bancaria Principal', 'Cuenta Ahorros', 0, 0, '#0284c7', '111005')
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Inicializar para todos los tenants existentes
SELECT public.erp_inicializar_cuentas_bancarias('saramantha');
SELECT public.erp_inicializar_cuentas_bancarias('sublimados_majestic');
SELECT public.erp_inicializar_cuentas_bancarias('pijamas_lucerito');
SELECT public.erp_inicializar_cuentas_bancarias('indisutex');
SELECT public.erp_inicializar_cuentas_bancarias('lovely');
SELECT public.erp_inicializar_cuentas_bancarias('default');
