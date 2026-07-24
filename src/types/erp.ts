// ========================================================
// INDISUTEX ERP - TIPOS DE DATOS Y MODELOS (FASE 2)
// ========================================================

export interface ERPTercero {
  id: string;
  tenant_id: string;
  tipo_documento: 'CC' | 'NIT' | 'CE' | 'PASAPORTE' | 'TI';
  numero_documento: string;
  dv?: string;
  razon_social: string;
  nombre_comercial?: string;
  tipo_persona: 'Persona Natural' | 'Persona Jurídica';
  regimen_tributario: string;
  direccion?: string;
  ciudad?: string;
  departamento?: string;
  telefono?: string;
  email?: string;
  es_cliente: boolean;
  es_proveedor: boolean;
  es_empleado: boolean;
  es_asesor: boolean;
  created_at: string;
}

export interface ERPCuentaPUC {
  id: string;
  tenant_id: string;
  codigo: string;
  nombre: string;
  nivel: number; // 1 a 5
  tipo: 'Activo' | 'Pasivo' | 'Patrimonio' | 'Ingresos' | 'Gastos' | 'Costos' | 'Orden';
  naturaleza: 'Débito' | 'Crédito';
  requiere_tercero: boolean;
  requiere_centro_costo: boolean;
  activa: boolean;
  created_at: string;
}

export interface ERPCentroCosto {
  id: string;
  tenant_id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  created_at: string;
}

export interface ERPComprobanteContable {
  id: string;
  tenant_id: string;
  tipo_comprobante: 'Venta' | 'Compra' | 'Ingreso' | 'Egreso' | 'Nómina' | 'Nota Contable' | 'Apertura' | 'Cierre';
  consecutivo?: number;
  fecha: string;
  concepto: string;
  referencia_origen?: string;
  origen_modulo?: 'ventas' | 'compras' | 'pos' | 'tesoreria' | 'nomina' | 'manual';
  estado: 'Borrador' | 'Asentado' | 'Anulado';
  creado_por?: string;
  created_at: string;
  asientos?: ERPAsientoContable[];
}

export interface ERPAsientoContable {
  id?: string;
  comprobante_id?: string;
  tenant_id: string;
  cuenta_id?: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  tercero_id?: string;
  centro_costo_id?: string;
  concepto_linea?: string;
  debito: number;
  credito: number;
  base_gravable?: number;
  created_at?: string;
}

export interface ERPBalancePruebaItem {
  cuenta_codigo: string;
  cuenta_nombre: string;
  naturaleza: string;
  saldo_anterior: number;
  total_debito: number;
  total_credito: number;
  saldo_nuevo: number;
}
