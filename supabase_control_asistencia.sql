-- ==============================================================================
-- SISTEMA DE CONTROL DE ASISTENCIA Y JORNADAS LABORALES (INDISUTEX CLOUD)
-- ==============================================================================

-- 1. Crear tabla principal para control de asistencia de asesores
CREATE TABLE IF NOT EXISTS public.control_asistencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    asesor_id UUID REFERENCES public.asesores(id) ON DELETE CASCADE,
    asesor_nombre TEXT NOT NULL,
    asesor_telefono TEXT NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_entrada TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    hora_salida TIMESTAMP WITH TIME ZONE,
    duracion_minutos INTEGER,
    estado TEXT NOT NULL DEFAULT 'activo', -- 'activo', 'finalizado', 'sin_salida'
    ip_registro TEXT,
    dispositivo TEXT,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Índices de alto rendimiento para consultas por sede, asesor, fecha y estado
CREATE INDEX IF NOT EXISTS idx_control_asistencia_tenant ON public.control_asistencia(tenant_id);
CREATE INDEX IF NOT EXISTS idx_control_asistencia_asesor ON public.control_asistencia(asesor_id);
CREATE INDEX IF NOT EXISTS idx_control_asistencia_fecha ON public.control_asistencia(fecha);
CREATE INDEX IF NOT EXISTS idx_control_asistencia_estado ON public.control_asistencia(estado);
CREATE INDEX IF NOT EXISTS idx_control_asistencia_tenant_fecha ON public.control_asistencia(tenant_id, fecha);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.control_asistencia ENABLE ROW LEVEL SECURITY;

-- 4. Crear política de acceso total para anon, authenticated y service_role
CREATE POLICY "Permitir acceso total a control_asistencia" ON public.control_asistencia
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Otorgar permisos completos a los roles de la API
GRANT ALL ON TABLE public.control_asistencia TO anon, authenticated, service_role;

-- 6. Trigger para actualizar el campo updated_at automáticamente
CREATE OR REPLACE FUNCTION update_control_asistencia_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_control_asistencia_updated_at ON public.control_asistencia;
CREATE TRIGGER trigger_update_control_asistencia_updated_at
    BEFORE UPDATE ON public.control_asistencia
    FOR EACH ROW
    EXECUTE FUNCTION update_control_asistencia_updated_at();
