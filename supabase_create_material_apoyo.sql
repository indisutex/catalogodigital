CREATE TABLE IF NOT EXISTS material_apoyo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    tipo TEXT NOT NULL, -- 'video' | 'imagen' | 'documento'
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE material_apoyo ENABLE ROW LEVEL SECURITY;

-- Allow public select
CREATE POLICY "Permitir lectura publica de material_apoyo" 
ON material_apoyo FOR SELECT 
USING (true);

-- Allow public insert/update/delete for simple demo, or check tenant_id
CREATE POLICY "Permitir escritura publica de material_apoyo" 
ON material_apoyo FOR ALL 
USING (true)
WITH CHECK (true);
