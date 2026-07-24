-- ========================================================
-- INDISUTEX ERP - FASE 2: NÚCLEO CONTABLE CENTRAL & PUC COLOMBIA
-- ========================================================

-- 1. MAESTRA DE TERCEROS UNIFICADA (Clientes, Proveedores, Empleados, Asesores)
CREATE TABLE IF NOT EXISTS public.erp_terceros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'saramantha',
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

-- 2. PLAN ÚNICO DE CUENTAS (PUC COLOMBIA)
CREATE TABLE IF NOT EXISTS public.erp_cuentas_puc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'saramantha',
    codigo TEXT NOT NULL, -- Ej: '110505'
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
    tenant_id TEXT NOT NULL DEFAULT 'saramantha',
    codigo TEXT NOT NULL, -- Ej: 'CC01'
    nombre TEXT NOT NULL, -- Ej: 'Sede Principal Cali'
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unq_centro_tenant_codigo UNIQUE (tenant_id, codigo)
);

-- 4. LIBRO DIARIO GENERAL (ENCABEZADO DE COMPROBANTES)
CREATE TABLE IF NOT EXISTS public.erp_comprobantes_contables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'saramantha',
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
    tenant_id TEXT NOT NULL DEFAULT 'saramantha',
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

-- PRECARGA INICIAL DE CENTRO DE COSTOS PREDETERMINADO
INSERT INTO public.erp_centros_costo (tenant_id, codigo, nombre)
VALUES ('saramantha', 'CC01', 'Centro Principal - Ventas y Operaciones')
ON CONFLICT (tenant_id, codigo) DO NOTHING;

-- PRECARGA INICIAL DE PUC ESTÁNDAR COLOMBIA (CUENTAS CLAVE)
INSERT INTO public.erp_cuentas_puc (tenant_id, codigo, nombre, nivel, tipo, naturaleza, requiere_tercero, requiere_centro_costo) VALUES
('saramantha', '1', 'ACTIVO', 1, 'Activo', 'Débito', false, false),
('saramantha', '11', 'DISPONIBLE', 2, 'Activo', 'Débito', false, false),
('saramantha', '1105', 'CAJA', 3, 'Activo', 'Débito', false, false),
('saramantha', '110505', 'Caja General', 4, 'Activo', 'Débito', true, true),
('saramantha', '1110', 'BANCOS', 3, 'Activo', 'Débito', false, false),
('saramantha', '111005', 'Bancos Nacionales (Moneda Nacional)', 4, 'Activo', 'Débito', true, true),
('saramantha', '13', 'DEUDORES / CUENTAS POR COBRAR', 2, 'Activo', 'Débito', false, false),
('saramantha', '1305', 'CLIENTES', 3, 'Activo', 'Débito', false, false),
('saramantha', '130505', 'Clientes Nacionales', 4, 'Activo', 'Débito', true, true),
('saramantha', '14', 'INVENTARIOS', 2, 'Activo', 'Débito', false, false),
('saramantha', '1435', 'MERCANCÍAS NO FABRICADAS POR LA EMPRESA', 3, 'Activo', 'Débito', false, false),
('saramantha', '143505', 'Inventario de Mercancía General', 4, 'Activo', 'Débito', false, true),
('saramantha', '2', 'PASIVO', 1, 'Pasivo', 'Crédito', false, false),
('saramantha', '22', 'PROVEEDORES', 2, 'Pasivo', 'Crédito', false, false),
('saramantha', '2205', 'PROVEEDORES NACIONALES', 3, 'Pasivo', 'Crédito', false, false),
('saramantha', '220505', 'Proveedores Nacionales Directos', 4, 'Pasivo', 'Crédito', true, true),
('saramantha', '23', 'CUENTAS POR PAGAR', 2, 'Pasivo', 'Crédito', false, false),
('saramantha', '2335', 'COSTOS Y GASTOS POR PAGAR', 3, 'Pasivo', 'Crédito', false, false),
('saramantha', '233505', 'Gastos Financieros / Operativos por Pagar', 4, 'Pasivo', 'Crédito', true, true),
('saramantha', '24', 'IMPUESTOS, GRAVÁMENES Y TASAS', 2, 'Pasivo', 'Crédito', false, false),
('saramantha', '2408', 'IMPUESTO SOBRE LAS VENTAS POR PAGAR (IVA)', 3, 'Pasivo', 'Crédito', false, false),
('saramantha', '240805', 'IVA Generado en Ventas (19%)', 4, 'Pasivo', 'Crédito', true, true),
('saramantha', '240810', 'IVA Descontable en Compras (19%)', 4, 'Pasivo', 'Débito', true, true),
('saramantha', '3', 'PATRIMONIO', 1, 'Patrimonio', 'Crédito', false, false),
('saramantha', '31', 'CAPITAL SOCIAL', 2, 'Patrimonio', 'Crédito', false, false),
('saramantha', '3105', 'CAPITAL SUSCRITO Y PAGADO', 3, 'Patrimonio', 'Crédito', false, false),
('saramantha', '310505', 'Capital Aportado', 4, 'Patrimonio', 'Crédito', true, false),
('saramantha', '4', 'INGRESOS', 1, 'Ingresos', 'Crédito', false, false),
('saramantha', '41', 'OPERACIONALES', 2, 'Ingresos', 'Crédito', false, false),
('saramantha', '4135', 'COMERCIO AL POR MAYOR Y AL POR MENOR', 3, 'Ingresos', 'Crédito', false, false),
('saramantha', '413505', 'Venta de Textiles y Confecciones', 4, 'Ingresos', 'Crédito', true, true),
('saramantha', '5', 'GASTOS', 1, 'Gastos', 'Débito', false, false),
('saramantha', '51', 'OPERACIONALES DE ADMINISTRACIÓN', 2, 'Gastos', 'Débito', false, false),
('saramantha', '5105', 'GASTOS DE PERSONAL', 3, 'Gastos', 'Débito', false, false),
('saramantha', '510506', 'Sueldos de Personal', 4, 'Gastos', 'Débito', true, true),
('saramantha', '52', 'OPERACIONALES DE VENTAS', 2, 'Gastos', 'Débito', false, false),
('saramantha', '5205', 'GASTOS DE VENTAS / COMISIONES', 3, 'Gastos', 'Débito', false, false),
('saramantha', '520518', 'Comisiones de Vendedores y Asesores', 4, 'Gastos', 'Débito', true, true),
('saramantha', '6', 'COSTOS DE VENTAS', 1, 'Costos', 'Débito', false, false),
('saramantha', '61', 'COSTOS OPERACIONALES DE VENTA', 2, 'Costos', 'Débito', false, false),
('saramantha', '6135', 'COSTO MERCANCÍA VENDIDA', 3, 'Costos', 'Débito', false, false),
('saramantha', '613505', 'Costo de Ventas Textiles', 4, 'Costos', 'Débito', true, true)
ON CONFLICT (tenant_id, codigo) DO NOTHING;
