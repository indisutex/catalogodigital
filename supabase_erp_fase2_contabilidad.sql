-- ========================================================
-- INDISUTEX ERP - FASE 2: NÚCLEO CONTABLE CENTRAL & PUC COLOMBIA MULTITENANT
-- ========================================================

-- 1. MAESTRA DE TERCEROS UNIFICADA (Clientes, Proveedores, Empleados, Asesores)
CREATE TABLE IF NOT EXISTS public.erp_terceros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    tipo_documento TEXT NOT NULL DEFAULT 'CC', -- 'CC', 'NIT', 'CE', 'PASAPORTE', 'TI'
    numero_documento TEXT NOT NULL,
    dv TEXT, -- Dígito de verificación para NIT
    razon_social TEXT NOT NULL,
    nombre_comercial TEXT,
    tipo_persona TEXT DEFAULT 'Persona Natural', -- 'Persona Natural', 'Persona Jurídica'
    regimen_tributario TEXT DEFAULT 'No Responsable de IVA',
    direccion TEXT,
    ciudad TEXT DEFAULT 'Cali',
    departamento TEXT DEFAULT 'Valle del Cauca',
    telefono TEXT,
    email TEXT,
    es_cliente BOOLEAN DEFAULT true,
    es_proveedor BOOLEAN DEFAULT false,
    es_empleado BOOLEAN DEFAULT false,
    es_asesor BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unq_tercero_tenant_doc UNIQUE (tenant_id, numero_documento)
);

-- 2. PLAN ÚNICO DE CUENTAS (PUC COLOMBIA EXTENDIDO)
CREATE TABLE IF NOT EXISTS public.erp_cuentas_puc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    codigo TEXT NOT NULL, -- Ej: '110505', '23654001'
    nombre TEXT NOT NULL, -- Ej: 'Caja General'
    nivel INTEGER NOT NULL DEFAULT 4, -- 1: Clase, 2: Grupo, 3: Cuenta, 4: Subcuenta, 5: Auxiliar
    tipo TEXT NOT NULL DEFAULT 'Activo', -- 'Activo', 'Pasivo', 'Patrimonio', 'Ingresos', 'Gastos', 'Costos', 'Orden'
    naturaleza TEXT NOT NULL DEFAULT 'Débito', -- 'Débito', 'Crédito'
    requiere_tercero BOOLEAN DEFAULT false,
    requiere_centro_costo BOOLEAN DEFAULT false,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unq_puc_tenant_codigo UNIQUE (tenant_id, codigo)
);

-- 3. CENTROS DE COSTO
CREATE TABLE IF NOT EXISTS public.erp_centros_costo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    codigo TEXT NOT NULL, -- Ej: 'CC01'
    nombre TEXT NOT NULL, -- Ej: 'Sede Principal Cali'
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unq_centro_tenant_codigo UNIQUE (tenant_id, codigo)
);

-- 4. LIBRO DIARIO GENERAL (ENCABEZADO DE COMPROBANTES)
CREATE TABLE IF NOT EXISTS public.erp_comprobantes_contables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    tipo_comprobante TEXT NOT NULL, -- 'Venta', 'Compra', 'Ingreso', 'Egreso', 'Nómina', 'Nota Contable', 'Apertura', 'Cierre'
    consecutivo SERIAL,
    fecha DATE DEFAULT CURRENT_DATE NOT NULL,
    concepto TEXT NOT NULL,
    referencia_origen TEXT, -- ID de pedido o documento origen
    origen_modulo TEXT DEFAULT 'manual', -- 'ventas', 'compras', 'pos', 'tesoreria', 'nomina', 'manual'
    estado TEXT DEFAULT 'Asentado' NOT NULL, -- 'Borrador', 'Asentado', 'Anulado'
    creado_por TEXT DEFAULT 'Sistema ERP',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. ASIENTOS CONTABLES (DETALLE DÉBITO Y CRÉDITO)
CREATE TABLE IF NOT EXISTS public.erp_asientos_contables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comprobante_id UUID NOT NULL REFERENCES public.erp_comprobantes_contables(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    cuenta_id UUID REFERENCES public.erp_cuentas_puc(id),
    cuenta_codigo TEXT NOT NULL,
    cuenta_nombre TEXT NOT NULL,
    tercero_id UUID REFERENCES public.erp_terceros(id),
    centro_costo_id UUID REFERENCES public.erp_centros_costo(id),
    concepto_linea TEXT,
    debito NUMERIC(15,2) DEFAULT 0.00 NOT NULL,
    credito NUMERIC(15,2) DEFAULT 0.00 NOT NULL,
    base_gravable NUMERIC(15,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- HABILITAR SEGURIDAD RLS
ALTER TABLE public.erp_terceros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_cuentas_puc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_centros_costo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_comprobantes_contables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_asientos_contables ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS LIBRES PARA INTEGRACIÓN PÚBLICA / ADMIN
DROP POLICY IF EXISTS "Permitir todo a erp_terceros" ON public.erp_terceros;
CREATE POLICY "Permitir todo a erp_terceros" ON public.erp_terceros FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo a erp_cuentas_puc" ON public.erp_cuentas_puc;
CREATE POLICY "Permitir todo a erp_cuentas_puc" ON public.erp_cuentas_puc FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo a erp_centros_costo" ON public.erp_centros_costo;
CREATE POLICY "Permitir todo a erp_centros_costo" ON public.erp_centros_costo FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo a erp_comprobantes_contables" ON public.erp_comprobantes_contables;
CREATE POLICY "Permitir todo a erp_comprobantes_contables" ON public.erp_comprobantes_contables FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo a erp_asientos_contables" ON public.erp_asientos_contables;
CREATE POLICY "Permitir todo a erp_asientos_contables" ON public.erp_asientos_contables FOR ALL USING (true) WITH CHECK (true);

-- ÍNDICES DE RENDIMIENTO MULTITENANT Y BÚSQUEDA
CREATE INDEX IF NOT EXISTS idx_erp_terceros_tenant ON public.erp_terceros(tenant_id);
CREATE INDEX IF NOT EXISTS idx_erp_cuentas_puc_tenant ON public.erp_cuentas_puc(tenant_id);
CREATE INDEX IF NOT EXISTS idx_erp_comprobantes_tenant ON public.erp_comprobantes_contables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_erp_asientos_tenant ON public.erp_asientos_contables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_erp_asientos_comprobante ON public.erp_asientos_contables(comprobante_id);

-- ========================================================
-- FUNCIÓN PL/pgSQL PARA INICIALIZAR EL PUC EN CUALQUIER TENANT
-- ========================================================
CREATE OR REPLACE FUNCTION public.erp_inicializar_puc_tenant(p_tenant_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- 1. Centro de costos por defecto
    INSERT INTO public.erp_centros_costo (tenant_id, codigo, nombre)
    VALUES (p_tenant_id, 'CC01', 'Centro Principal - Ventas y Operaciones')
    ON CONFLICT (tenant_id, codigo) DO NOTHING;

    -- 2. Cuentas PUC Extendido
    INSERT INTO public.erp_cuentas_puc (tenant_id, codigo, nombre, nivel, tipo, naturaleza, requiere_tercero, requiere_centro_costo) VALUES
    (p_tenant_id, '1', 'ACTIVO', 1, 'Activo', 'Débito', false, false),
    (p_tenant_id, '11', 'DISPONIBLE', 2, 'Activo', 'Débito', false, false),
    (p_tenant_id, '1105', 'CAJA', 3, 'Activo', 'Débito', false, false),
    (p_tenant_id, '110505', 'Caja General', 4, 'Activo', 'Débito', true, true),
    (p_tenant_id, '110510', 'Caja Menor', 4, 'Activo', 'Débito', true, true),
    (p_tenant_id, '110515', 'Recaudos en Tránsito / Pasarelas (Nequi/Daviplata)', 4, 'Activo', 'Débito', true, true),
    (p_tenant_id, '1110', 'BANCOS', 3, 'Activo', 'Débito', false, false),
    (p_tenant_id, '111005', 'Bancos Nacionales Moneda Nacional', 4, 'Activo', 'Débito', true, true),
    (p_tenant_id, '11100501', 'Bancolombia Cuenta Corriente', 5, 'Activo', 'Débito', true, true),
    (p_tenant_id, '11100502', 'Banco de Bogotá Cuenta Ahorros', 5, 'Activo', 'Débito', true, true),
    (p_tenant_id, '13', 'DEUDORES / CUENTAS POR COBRAR', 2, 'Activo', 'Débito', false, false),
    (p_tenant_id, '1305', 'CLIENTES', 3, 'Activo', 'Débito', false, false),
    (p_tenant_id, '130505', 'Clientes Nacionales', 4, 'Activo', 'Débito', true, true),
    (p_tenant_id, '1355', 'ANTICIPO DE IMPUESTOS Y CONTRIBUCIONES', 3, 'Activo', 'Débito', false, false),
    (p_tenant_id, '135515', 'Retención en la Fuente a Favor (2.5% / 3.5%)', 4, 'Activo', 'Débito', true, true),
    (p_tenant_id, '135517', 'Impuesto a las Ventas Retenido (ReteIVA)', 4, 'Activo', 'Débito', true, true),
    (p_tenant_id, '135518', 'Impuesto de Industria y Comercio Retenido (ReteICA)', 4, 'Activo', 'Débito', true, true),
    (p_tenant_id, '135595', 'Autorretención de Renta a Favor', 4, 'Activo', 'Débito', true, true),
    (p_tenant_id, '14', 'INVENTARIOS', 2, 'Activo', 'Débito', false, false),
    (p_tenant_id, '1435', 'MERCANCÍAS NO FABRICADAS POR LA EMPRESA', 3, 'Activo', 'Débito', false, false),
    (p_tenant_id, '143505', 'Inventario de Mercancía Textiles y Confecciones', 4, 'Activo', 'Débito', false, true),
    (p_tenant_id, '143510', 'Inventario de Pijametría y Sublimados', 4, 'Activo', 'Débito', false, true),
    (p_tenant_id, '15', 'PROPIEDAD, PLANTA Y EQUIPO (ACTIVOS FIJOS)', 2, 'Activo', 'Débito', false, false),
    (p_tenant_id, '1524', 'EQUIPO DE OFICINA Y COMPUTACIÓN', 3, 'Activo', 'Débito', false, false),
    (p_tenant_id, '152405', 'Muebles y Enseres', 4, 'Activo', 'Débito', true, true),
    (p_tenant_id, '152805', 'Equipos de Computamiento y Servidores', 4, 'Activo', 'Débito', true, true),
    (p_tenant_id, '1592', 'DEPRECIACIÓN ACUMULADA', 3, 'Activo', 'Crédito', false, false),
    (p_tenant_id, '159215', 'Depreciación Acumulada Equipos de Cómputo', 4, 'Activo', 'Crédito', true, true),
    (p_tenant_id, '2', 'PASIVO', 1, 'Pasivo', 'Crédito', false, false),
    (p_tenant_id, '22', 'PROVEEDORES', 2, 'Pasivo', 'Crédito', false, false),
    (p_tenant_id, '2205', 'PROVEEDORES NACIONALES', 3, 'Pasivo', 'Crédito', false, false),
    (p_tenant_id, '220505', 'Proveedores Nacionales Directos', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '23', 'CUENTAS POR PAGAR', 2, 'Pasivo', 'Crédito', false, false),
    (p_tenant_id, '2335', 'COSTOS Y GASTOS POR PAGAR', 3, 'Pasivo', 'Crédito', false, false),
    (p_tenant_id, '233505', 'Gastos Financieros / Operativos por Pagar', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '2365', 'RETENCIÓN EN LA FUENTE POR PAGAR', 3, 'Pasivo', 'Crédito', false, false),
    (p_tenant_id, '236505', 'Retención por Salarios y Pagos Laborales', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '236515', 'Retención por Honorarios y Servicios', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '236525', 'Retención por Comisiones (4%)', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '236540', 'Retención por Compras Declarantes (2.5%)', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '23654001', 'Retención por Compras No Declarantes (3.5%)', 5, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '2367', 'IMPUESTO A LAS VENTAS RETENIDO (RETEIVA)', 3, 'Pasivo', 'Crédito', false, false),
    (p_tenant_id, '236701', 'ReteIVA 15% sobre IVA Generado', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '2368', 'IMPUESTO DE INDUSTRIA Y COMERCIO RETENIDO (RETEICA)', 3, 'Pasivo', 'Crédito', false, false),
    (p_tenant_id, '236801', 'ReteICA por Pagar (6.9/1000 / 11.04/1000)', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '2370', 'RETENCIONES Y APORTES DE NÓMINA', 3, 'Pasivo', 'Crédito', false, false),
    (p_tenant_id, '237005', 'Aportes a Entidades Promotoras de Salud (EPS 4% / 8.5%)', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '237010', 'Aportes a Fondos de Pensiones (AFP 4% / 12%)', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '237015', 'Aportes a Administradoras de Riesgos Laborales (ARL)', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '237020', 'Aportes Caja de Compensación Familiar (SENA, ICBF, Caja 9%)', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '24', 'IMPUESTOS, GRAVÁMENES Y TASAS', 2, 'Pasivo', 'Crédito', false, false),
    (p_tenant_id, '2408', 'IMPUESTO SOBRE LAS VENTAS POR PAGAR (IVA)', 3, 'Pasivo', 'Crédito', false, false),
    (p_tenant_id, '240805', 'IVA Generado en Ventas (19%)', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '240806', 'IVA Generado en Ventas Tarifa General (5%)', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '240810', 'IVA Descontable en Compras (19%)', 4, 'Pasivo', 'Débito', true, true),
    (p_tenant_id, '25', 'OBLIGACIONES LABORALES (PRESTACIONES SOCIALES)', 2, 'Pasivo', 'Crédito', false, false),
    (p_tenant_id, '2505', 'SALARIOS POR PAGAR', 3, 'Pasivo', 'Crédito', false, false),
    (p_tenant_id, '250505', 'Nómina Pendiente de Pago', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '2510', 'CESANTÍAS CONSOLIDADAS', 3, 'Pasivo', 'Crédito', false, false),
    (p_tenant_id, '251005', 'Cesantías por Pagar (8.33%)', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '2515', 'INTERESES SOBRE CESANTÍAS', 3, 'Pasivo', 'Crédito', false, false),
    (p_tenant_id, '251505', 'Intereses sobre Cesantías (12% anual / 1% mensual)', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '2520', 'PRIMA DE SERVICIOS', 3, 'Pasivo', 'Crédito', false, false),
    (p_tenant_id, '252005', 'Prima de Servicios por Pagar (8.33%)', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '2525', 'VACACIONES CONSOLIDADAS', 3, 'Pasivo', 'Crédito', false, false),
    (p_tenant_id, '252505', 'Vacaciones por Pagar (4.17%)', 4, 'Pasivo', 'Crédito', true, true),
    (p_tenant_id, '3', 'PATRIMONIO', 1, 'Patrimonio', 'Crédito', false, false),
    (p_tenant_id, '31', 'CAPITAL SOCIAL', 2, 'Patrimonio', 'Crédito', false, false),
    (p_tenant_id, '3105', 'CAPITAL SUSCRITO Y PAGADO', 3, 'Patrimonio', 'Crédito', false, false),
    (p_tenant_id, '310505', 'Capital Aportado', 4, 'Patrimonio', 'Crédito', true, false),
    (p_tenant_id, '36', 'RESULTADOS DEL EJERCICIO', 2, 'Patrimonio', 'Crédito', false, false),
    (p_tenant_id, '3605', 'UTILIDAD DEL EJERCICIO', 3, 'Patrimonio', 'Crédito', false, false),
    (p_tenant_id, '360505', 'Utilidad Neta del Período', 4, 'Patrimonio', 'Crédito', false, false),
    (p_tenant_id, '4', 'INGRESOS', 1, 'Ingresos', 'Crédito', false, false),
    (p_tenant_id, '41', 'OPERACIONALES', 2, 'Ingresos', 'Crédito', false, false),
    (p_tenant_id, '4135', 'COMERCIO AL POR MAYOR Y AL POR MENOR', 3, 'Ingresos', 'Crédito', false, false),
    (p_tenant_id, '413505', 'Venta de Textiles y Confecciones (Tarifa General 19%)', 4, 'Ingresos', 'Crédito', true, true),
    (p_tenant_id, '413510', 'Venta de Pijametría y Sublimados Exentos/Excluidos', 4, 'Ingresos', 'Crédito', true, true),
    (p_tenant_id, '5', 'GASTOS', 1, 'Gastos', 'Débito', false, false),
    (p_tenant_id, '51', 'OPERACIONALES DE ADMINISTRACIÓN', 2, 'Gastos', 'Débito', false, false),
    (p_tenant_id, '5105', 'GASTOS DE PERSONAL ADMINISTRATIVO', 3, 'Gastos', 'Débito', false, false),
    (p_tenant_id, '510506', 'Sueldos de Personal Administrador', 4, 'Gastos', 'Débito', true, true),
    (p_tenant_id, '510527', 'Auxilio de Transporte', 4, 'Gastos', 'Débito', true, true),
    (p_tenant_id, '510530', 'Cesantías', 4, 'Gastos', 'Débito', true, true),
    (p_tenant_id, '510533', 'Intereses sobre Cesantías', 4, 'Gastos', 'Débito', true, true),
    (p_tenant_id, '510536', 'Prima de Servicios', 4, 'Gastos', 'Débito', true, true),
    (p_tenant_id, '510539', 'Vacaciones', 4, 'Gastos', 'Débito', true, true),
    (p_tenant_id, '52', 'OPERACIONALES DE VENTAS', 2, 'Gastos', 'Débito', false, false),
    (p_tenant_id, '5205', 'GASTOS DE VENTAS / COMISIONES', 3, 'Gastos', 'Débito', false, false),
    (p_tenant_id, '520518', 'Comisiones de Vendedores y Asesores', 4, 'Gastos', 'Débito', true, true),
    (p_tenant_id, '520520', 'Comisiones Super Mayoristas', 4, 'Gastos', 'Débito', true, true),
    (p_tenant_id, '53', 'NO OPERACIONALES / FINANCIEROS', 2, 'Gastos', 'Débito', false, false),
    (p_tenant_id, '5305', 'FINANCIEROS', 3, 'Gastos', 'Débito', false, false),
    (p_tenant_id, '530505', 'Gastos Bancarios y Comisiones de Pasarelas', 4, 'Gastos', 'Débito', true, true),
    (p_tenant_id, '6', 'COSTOS DE VENTAS', 1, 'Costos', 'Débito', false, false),
    (p_tenant_id, '61', 'COSTOS OPERACIONALES DE VENTA', 2, 'Costos', 'Débito', false, false),
    (p_tenant_id, '6135', 'COSTO MERCANCÍA VENDIDA', 3, 'Costos', 'Débito', false, false),
    (p_tenant_id, '613505', 'Costo de Ventas Textiles', 4, 'Costos', 'Débito', true, true)
    ON CONFLICT (tenant_id, codigo) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- INICIALIZACIÓN DE TENANTS EXISTENTES
SELECT public.erp_inicializar_puc_tenant('saramantha');
SELECT public.erp_inicializar_puc_tenant('sublimados_majestic');
SELECT public.erp_inicializar_puc_tenant('pijamas_lucerito');
SELECT public.erp_inicializar_puc_tenant('indisutex');
SELECT public.erp_inicializar_puc_tenant('lovely');
SELECT public.erp_inicializar_puc_tenant('default');
