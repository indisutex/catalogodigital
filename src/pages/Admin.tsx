import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase, getTenantId, setTenantId } from '../lib/supabase';
import { compressImage } from '../lib/imageCompression';
import { SiigoService } from '../lib/siigoService';
import type { Producto, Categoria, Subcategoria, Configuracion, Pedido, Asesor, Mayorista } from '../types';
import './Admin.css';
import { X, Upload, Package, Tag, Settings, LayoutDashboard, Plus, Trash2, Pencil, Check, Eye, EyeOff, Phone, LogOut, User, ShoppingBag, Copy, RefreshCw, Search, Calculator, Code, Menu, Users, Home, Lightbulb, Bell, CreditCard, Download, Building2, Trophy, MessageSquare, Filter, Link } from 'lucide-react';
import * as XLSX from 'xlsx';

const SECRET_PIN = '0000';

const formatWhatsAppLink = (phone: string, text?: string) => {
  if (!phone) return '#';
  const clean = phone.replace(/\D/g, '');
  const finalNum = clean.startsWith('57') && clean.length > 10 ? clean : '57' + clean;
  return `https://wa.me/${finalNum}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};

const getGoogleDriveEmbedUrl = (url: string) => {
  if (!url) return '';
  // File match
  const fileMatch = url.match(/\/file\/d\/([^/]+)/);
  if (fileMatch && fileMatch[1]) {
    return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  }
  // Folder match
  const folderMatch = url.match(/\/folders\/([^/?]+)/);
  if (folderMatch && folderMatch[1]) {
    return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#grid`;
  }
  return url;
};

const getGoogleDriveDownloadUrl = (url: string) => {
  if (!url) return '';
  const fileMatch = url.match(/\/file\/d\/([^/]+)/);
  if (fileMatch && fileMatch[1]) {
    return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
  }
  return url;
};

const getGoogleDriveThumbnailUrl = (url: string) => {
  if (!url) return '';
  const fileMatch = url.match(/\/file\/d\/([^/]+)/);
  if (fileMatch && fileMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
  }
  return '';
};

const deduplicateTallas = (tallasStr: string | undefined | null) => {
  if (!tallasStr) return '-';
  const rawTallas = tallasStr.split(',').map(t => t.trim()).filter(Boolean);
  if (rawTallas.length === 0) return '-';
  const tallasMap = new Map();
  rawTallas.forEach(t => {
    const key = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!tallasMap.has(key)) tallasMap.set(key, t);
  });
  return Array.from(tallasMap.values()).join(', ') || '-';
};

export const encodeExtraImage = (url: string, ref: string) => ref ? `${url}|REF:${ref}` : url;
export const decodeExtraImage = (str: string) => {
  if (!str) return { url: '', ref: '' };
  const [url, ref] = str.split('|REF:');
  return { url: url || '', ref: ref || '' };
};

type ProductFormData = {
  nombre: string;
  descripcion: string;
  precio: string;
  precio_por_mayor: string;
  precio_50_unidades: string;
  categoria: string;
  subcategoria: string;
  imagenes: { url: string; ref: string }[];
  video_url: string;
  tallas: string;
  estampados: string;
  stock: number;
};

const emptyProduct: ProductFormData = {
  nombre: '',
  descripcion: '',
  precio: '',
  precio_por_mayor: '',
  precio_50_unidades: '',
  categoria: '',
  subcategoria: '',
  imagenes: [{ url: '', ref: '' }],
  video_url: '',
  tallas: '',
  estampados: '',
  stock: 0
};

type TabType = 'dashboard' | 'productos' | 'categorias' | 'config' | 'pedidos' | 'siigo' | 'pos' | 'clientes' | 'asesores' | 'mayoristas' | 'perfil_asesor' | 'resumen_asesor' | 'notificaciones_asesor' | 'material_apoyo' | 'material_asesor' | 'productos_asesor' | 'productos_mayorista' | 'ranking_mayorista';

type Toast = { message: string; type: 'success' | 'error' } | null;

// Ejecutar sincrónicamente para evitar parpadeo de color
try {
  let tId = 'indisutex';
  const pathParts = window.location.pathname.split('/');
  if (pathParts[1] && pathParts[1] !== 'admin' && pathParts[1] !== 'superadmin' && pathParts[1] !== 'menu') {
    tId = pathParts[1].toLowerCase().replace(/-/g, '_');
  } else {
    tId = localStorage.getItem('tenant_id') || 'saramantha';
  }
  const cachedColor = localStorage.getItem(`admin_primary_color_${tId}`);
  if (cachedColor) {
    document.documentElement.style.setProperty('--primary-color', cachedColor);
    const hex = cachedColor.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
      }
    }
  }
} catch (e) {}

function MiNegocioSettings({ 
  mayorista, 
  onSave, 
  showToast 
}: { 
  mayorista: Mayorista, 
  onSave: (data: { nombre_negocio: string, logo_url: string, video_hero_url: string, ajustes_productos?: any }) => Promise<void>, 
  showToast: (msg: string, type?: 'success' | 'error') => void 
}) {
  const [nombre, setNombre] = useState(mayorista.nombre_negocio || '');
  const [logo, setLogo] = useState(mayorista.logo_url || '');
  const [video, setVideo] = useState(mayorista.video_hero_url || '');
  const ajustesIni = mayorista.ajustes_productos?.botones_extra || {};
  const [dsText, setDsText] = useState(ajustesIni.dropshipper_text ?? '');
  const [dsLink, setDsLink] = useState(ajustesIni.dropshipper_link ?? '');
  const [dsEnabled, setDsEnabled] = useState(ajustesIni.dropshipper_enabled ?? true);
  const [earnText, setEarnText] = useState(ajustesIni.earn_money_text ?? '');
  const [earnLink, setEarnLink] = useState(ajustesIni.earn_money_link ?? '');
  const [earnEnabled, setEarnEnabled] = useState(ajustesIni.earn_money_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const newAjustes = {
        ...(mayorista.ajustes_productos || {}),
        botones_extra: {
          dropshipper_text: dsText,
          dropshipper_link: dsLink,
          dropshipper_enabled: dsEnabled,
          earn_money_text: earnText,
          earn_money_link: earnLink,
          earn_money_enabled: earnEnabled,
        }
      };
      await onSave({ 
        nombre_negocio: nombre, 
        logo_url: logo, 
        video_hero_url: video,
        ajustes_productos: newAjustes
      });
      showToast('Configuración guardada exitosamente ✓', 'success');
    } catch (err) {
      showToast('Error al guardar configuración', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'video') => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const fileName = `${field}_${Date.now()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('archivos').upload(fileName, file);
      const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
      if (field === 'logo') setLogo(data.publicUrl);
      if (field === 'video') setVideo(data.publicUrl);
      showToast(`${field === 'logo' ? 'Logo' : 'Video'} subido ✓`, 'success');
    } catch {
      showToast(`Error subiendo ${field}`, 'error');
    }
    setUploading(false);
  };

  return (
    <div className="admin-panel" style={{ borderRadius: '20px', padding: '1.5rem 1.75rem', marginTop: '1.5rem' }}>
      <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}>
        <span style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🏪</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
          <h2 className="panel-header-title-custom">Configuración de Mi Catálogo (Marca Blanca)</h2>
          <p style={{ margin: '0.15rem 0 0 0', color: '#64748b', fontSize: '0.85rem', textAlign: 'left' }}>Personaliza el logo, video y nombre que verán tus clientes en tu catálogo propio.</p>
        </div>
      </div>
      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="form-group">
          <label style={{ fontWeight: 600 }}>Nombre de tu Negocio</label>
          <input type="text" className="form-input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Moda Express" />
        </div>
        <div className="form-group">
          <label style={{ fontWeight: 600 }}>Logo del Negocio</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {logo && <img src={logo} alt="Logo preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '8px' }} />}
            <input type="text" className="form-input" style={{ flex: 1 }} value={logo} onChange={e => setLogo(e.target.value)} placeholder="URL del logo" />
            <label className="btn-upload-img" style={{ flexShrink: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.55rem 0.85rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
              <Upload size={12} /> {uploading ? '...' : 'Subir'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'logo')} disabled={uploading} />
            </label>
          </div>
        </div>
        <div className="form-group">
          <label style={{ fontWeight: 600 }}>Video Principal / Imagen Hero</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="text" className="form-input" style={{ flex: 1 }} value={video} onChange={e => setVideo(e.target.value)} placeholder="URL del video o imagen" />
            <label className="btn-upload-img" style={{ flexShrink: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.55rem 0.85rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
              <Upload size={12} /> {uploading ? '...' : 'Subir'}
              <input type="file" accept="video/*,image/*" style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'video')} disabled={uploading} />
            </label>
          </div>
        </div>
        
        {/* NUEVOS BOTONES EXTRA */}
        <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Configuración de Botones del Catálogo</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Botón 1</h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                <label htmlFor="ds-enabled" style={{ margin: 0, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>Habilitar Botón 1</label>
                <label className="toggle-switch">
                  <input type="checkbox" id="ds-enabled" checked={dsEnabled} onChange={e => setDsEnabled(e.target.checked)} />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontWeight: 600 }}>Texto del Botón</label>
                <input type="text" className="form-input" value={dsText} onChange={e => setDsText(e.target.value)} placeholder="Ej: ¿Eres Mayorista?" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontWeight: 600 }}>Enlace del Botón (WhatsApp o web)</label>
                <input type="text" className="form-input" value={dsLink} onChange={e => setDsLink(e.target.value)} placeholder="Ej: https://wa.me/57..." />
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Botón 2</h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                <label htmlFor="earn-enabled" style={{ margin: 0, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>Habilitar Botón 2</label>
                <label className="toggle-switch">
                  <input type="checkbox" id="earn-enabled" checked={earnEnabled} onChange={e => setEarnEnabled(e.target.checked)} />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontWeight: 600 }}>Texto del Botón</label>
                <input type="text" className="form-input" value={earnText} onChange={e => setEarnText(e.target.value)} placeholder="Ej: ¿Quieres ganar dinero extra?" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontWeight: 600 }}>Enlace del Botón (WhatsApp o web)</label>
                <input type="text" className="form-input" value={earnLink} onChange={e => setEarnLink(e.target.value)} placeholder="Ej: https://wa.me/57..." />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '1rem' }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving || uploading}>
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem(`admin_auth_${getTenantId()}`) === 'true';
  });
  const [role, setRole] = useState<'admin' | 'asesor' | 'mayorista'>(() => {
    return (localStorage.getItem(`admin_role_${getTenantId()}`) as 'admin' | 'asesor' | 'mayorista') || 'admin';
  });
  const [loggedAsesorPhone, setLoggedAsesorPhone] = useState<string | null>(() => {
    return localStorage.getItem(`admin_asesor_phone_${getTenantId()}`);
  });
  const [failedThumbnails, setFailedThumbnails] = useState<Record<string, boolean>>({});
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab') as TabType;

    const userRole = localStorage.getItem(`admin_role_${getTenantId()}`);
    const defaultTab = (userRole === 'asesor') ? 'pedidos' : (userRole === 'mayorista' ? 'resumen_asesor' : 'productos');
    const saved = localStorage.getItem('admin_active_tab') as string;
    if (saved === 'perfil_admin' || saved === 'perfil_admin_tab') return 'dashboard';
    const allowedTabs: string[] = ['dashboard', 'productos', 'categorias', 'pedidos', 'clientes', 'asesores', 'mayoristas', 'pos', 'siigo', 'config', 'perfil_asesor', 'resumen_asesor', 'notificaciones_asesor', 'material_apoyo', 'material_asesor', 'productos_asesor', 'productos_mayorista', 'ranking_mayorista'];
    
    if (urlTab && allowedTabs.includes(urlTab)) return urlTab;
    
    if (saved && !allowedTabs.includes(saved)) return defaultTab as TabType;
    return (saved as TabType) || (defaultTab as TabType);
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('admin_active_tab', activeTab);
  }, [activeTab]);

  const [toast, setToast] = useState<Toast>(null);
  
  const [selectedCompany, setSelectedCompany] = useState<string | null>(getTenantId() || null);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [categoriasData, setCategoriasData] = useState<Categoria[]>([]);
  const [subcategoriasData, setSubcategoriasData] = useState<Subcategoria[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteSearchQuery, setClienteSearchQuery] = useState('');
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [mayoristas, setMayoristas] = useState<Mayorista[]>([]);
  const [materiales, setMateriales] = useState<any[]>([]);
  const [materialFilter, setMaterialFilter] = useState<string>('todos');
  const [showNotificationsPopover, setShowNotificationsPopover] = useState(false);
  const [nuevoMaterialTitulo, setNuevoMaterialTitulo] = useState('');
  const [nuevoMaterialDesc, setNuevoMaterialDesc] = useState('');
  const [nuevoMaterialTipo, setNuevoMaterialTipo] = useState<'video' | 'imagen' | 'documento'>('video');
  const [nuevoMaterialUrl, setNuevoMaterialUrl] = useState('');
  const [nuevoMaterialCampana, setNuevoMaterialCampana] = useState('');
  const [campanaFilter, setCampanaFilter] = useState<string>('todas');

  const uniqueCampanas = useMemo(() => {
    const campanas = materiales.map(m => m.campana).filter(Boolean);
    return Array.from(new Set(campanas));
  }, [materiales]);

  const filteredMateriales = materiales.filter(m => {
    const typeMatch = materialFilter === 'todos' || m.tipo === materialFilter;
    const campanaMatch = campanaFilter === 'todas' || m.campana === campanaFilter;
    return typeMatch && campanaMatch;
  });

  const currentAsesor = useMemo(() => {
    if (role === 'asesor') return asesores.find(a => a.id === localStorage.getItem(`admin_asesor_id_${getTenantId()}`)) ?? null;
    return null;
  }, [role, asesores]);

  const currentMayorista = useMemo(() => {
    if (role === 'mayorista') return mayoristas.find(m => m.id === localStorage.getItem(`admin_asesor_id_${getTenantId()}`)) ?? null;
    return null;
  }, [role, mayoristas]);

  useEffect(() => {
    if (selectedCompany) {
      const compName = selectedCompany.charAt(0).toUpperCase() + selectedCompany.slice(1);
      let titleStr = `${compName} Admin`;
      const activeAsesor = role === 'mayorista' ? currentMayorista : currentAsesor;
      if (activeAsesor) {
        titleStr += ` - ${activeAsesor.nombre}`;
      }
      document.title = titleStr;
    } else {
      document.title = 'Indisutex Admin';
    }
  }, [selectedCompany, currentAsesor, currentMayorista, role]);

  const getMotivationalPhrase = (asesorId: string) => {
    const phrases = [
      "¡Cada cliente es una oportunidad para alcanzar tus metas! ¡A darlo todo hoy!",
      "¡El éxito llega a quienes se atreven a actuar! ¡Haz que hoy cuente!",
      "¡Tu energía y entusiasmo son tus mejores herramientas de venta!",
      "¡La persistencia rompe barreras! Hoy conquistarás nuevas ventas.",
      "¡La excelencia no es un acto, es un hábito! ¡A brillar hoy!",
      "¡Enfócate en aportar valor y las ventas llegarán solas!",
      "¡Cada 'no' te acerca un paso más al próximo 'sí'! ¡Sigue adelante!",
      "¡Hoy es el día perfecto para superar tus límites! ¡Vamos equipo!",
      "¡El camino al éxito es tomar acción masiva y decidida!",
      "¡Haz que cada cliente viva una experiencia única hoy!"
    ];
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const seed = (dayOfYear + String(asesorId).charCodeAt(0)) % phrases.length;
    return phrases[seed];
  };

  const renderLeadOrOrderCard = (ped: any, forceIsLead?: boolean) => {
    const isLead = forceIsLead || ped.isLead || !ped.estado || (ped.retargeting_estado !== undefined);
    const elapsedMs = new Date().getTime() - new Date(ped.created_at).getTime();
    const elapsedMins = Math.floor(elapsedMs / 60000);
    let timeLabel = 'Hace un momento';
    if (elapsedMins >= 60) {
      const elapsedHours = Math.floor(elapsedMins / 60);
      if (elapsedHours >= 24) {
        const days = Math.floor(elapsedHours / 24);
        timeLabel = `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
      } else {
        timeLabel = `Hace ${elapsedHours} ${elapsedHours === 1 ? 'hora' : 'horas'}`;
      }
    } else if (elapsedMins > 0) {
      timeLabel = `Hace ${elapsedMins} ${elapsedMins === 1 ? 'minuto' : 'minutos'}`;
    }

    // let // probLabel = "50%";
    // let // probClass = "prob-medium";
    const nombreCliente = ped.cliente_nombre || ped.nombre || 'Borrador Anónimo';
    const telefonoCliente = ped.cliente_telefono || ped.telefono || '';
    if (isLead) {
      // const charCodeSum = nombreCliente.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
      // const randProb = 15 + (charCodeSum % 80);
      // probLabel = `${randProb}%`;
      // probClass = randProb > 70 ? 'prob-high' : randProb > 40 ? 'prob-medium' : 'prob-low';
    }

    const adv = getAsesorInfoByPhone(ped.linea_whatsapp);
    const parsedProds = getParsedProducts(ped.productos);

    return (
      <div key={ped.id} className={`order-mobile-card ${isLead ? 'lead-abandonado' : ped.estado === 'completado' ? 'order-completado' : ped.pantallazo_url ? 'order-comprobante' : 'order-pendiente'}`} style={{ margin: 0 }}>
        <div className="card-header-row">
          <div className="client-info-block">
            <div className="client-avatar">
              {nombreCliente.charAt(0).toUpperCase()}
            </div>
            <div className="client-details">
              <h4>{nombreCliente}</h4>
              <p className="client-phone">📞 {telefonoCliente || 'Sin número'}</p>
              <span className="client-time">{timeLabel}</span>
            </div>
          </div>
          <div className="status-badges-block">
            <div className="advisor-badge">
              <div className="advisor-avatar">
                {adv.foto_url ? (
                  <img src={adv.foto_url} alt="" />
                ) : (
                  adv.nombre.charAt(0).toUpperCase()
                )}
              </div>
              <div className="advisor-meta">
                <h5>{adv.nombre}</h5>
                <span className="advisor-role">{adv.role}</span>
              </div>
            </div>
            {!isLead && (
              <span className={`payment-badge-small ${ped.estado === 'completado' ? 'verified' : ped.pantallazo_url ? 'uploaded' : 'pending'}`} style={{ marginTop: '4px', display: 'inline-block' }}>
                {ped.estado === 'completado' ? '✅ Verificado' : ped.pantallazo_url ? '📸 Comprobante recibido' : '⏳ Esperando comprobante de pago'}
              </span>
            )}
          </div>
        </div>

        <div className="card-body-row">
          <div className="cart-summary-block">
            <div className="cart-total-info">
              <span className="cart-total-icon">💰</span>
              <span className="cart-total-amount">${ped.total.toLocaleString()}</span>
              <span className="items-count">📦 {parsedProds.reduce((acc: number, p: any) => acc + (p.cantidad || 1), 0)} uds</span>
            </div>
            
            {parsedProds.length > 0 ? (
              <div className="cart-products-box">
                <ul className="cart-products-list">
                  {parsedProds.slice(0, 2).map((prod: any, idx: number) => (
                    <li key={idx}>
                      • {prod.nombre} {prod.talla ? `(${prod.talla})` : ''}
                    </li>
                  ))}
                </ul>
                {parsedProds.length > 2 && (
                  <div className="more-products-badge" onClick={() => setSelectedPedido(ped)}>
                    + Ver {parsedProds.length - 2} más
                  </div>
                )}
              </div>
            ) : (
              <div className="cart-products-box" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                <span style={{ fontSize: '0.65rem', color: '#b45309', fontWeight: 600 }}>⚠️ Sin productos</span>
              </div>
            )}
          </div>


        </div>



        <div className="card-footer-row" style={{ marginTop: '0.25rem' }}>
          <div className="quick-actions" style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {telefonoCliente && (
              <button 
                type="button" 
                className="btn-circle-action"
                onClick={() => {
                  const cleanPhone = telefonoCliente.replace(/\D/g, '');
                  const target = cleanPhone.length === 10 ? '57' + cleanPhone : cleanPhone;
                  window.open(`https://wa.me/${target}`, '_blank');
                }}
              >
                <MessageSquare size={13} />
              </button>
            )}
            <button type="button" className="btn-details-action" onClick={() => setSelectedPedido(ped)}>
              Ver detalles
            </button>
            {isLead && (
              <select 
                className="lead-status-dropdown" 
                value={ped.retargeting_estado || ''}
                onChange={(e) => handleUpdateLeadStatus(ped.id, e.target.value)}
                style={{ fontSize: '0.75rem', padding: '0.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}
              >
                <option value="">Estado...</option>
                <option value="contactado">Contactado</option>
                <option value="descartado">Descartado</option>
              </select>
            )}
          </div>

          <div className="main-action-wrapper">
            {isLead ? (
              <button 
                type="button" 
                className="btn-main-recover green"
                onClick={() => {
                  const cleanPhone = (telefonoCliente || '').replace(/\D/g, '');
                  if (!cleanPhone) {
                    showToast('Teléfono inválido para WhatsApp', 'error');
                    return;
                  }
                  const prodNames = Array.isArray(ped.productos) && ped.productos.length > 0
                    ? ped.productos.map((p: any) => `${p.nombre} ${p.talla ? `(${p.talla})` : ''}`).join(', ')
                    : '';
                  const text = `¡Hola ${nombreCliente || ''}! 👋 Vimos que estás interesado en: ${prodNames ? `*${prodNames}*` : 'nuestros productos'}. ¿Tienes alguna duda o te ayudamos a completar tu pedido? Escríbenos y con gusto te colaboramos. 😊`;
                  const targetPhone = cleanPhone.length === 10 ? '57' + cleanPhone : cleanPhone;
                  window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`, '_blank');
                  handleUpdateLeadStatus(ped.id, 'contactado');
                }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ marginRight: '5px', display: 'inline-block', verticalAlign: 'middle' }}>
                  <path d="M12.012 2c-5.506 0-9.988 4.482-9.988 9.988 0 1.761.46 3.473 1.332 4.978L2 22l5.222-1.368a9.92 9.92 0 0 0 4.79 1.228h.004c5.502 0 9.984-4.482 9.984-9.988C22 6.482 17.514 2 12.012 2zm5.836 14.199c-.24.676-1.18 1.258-1.748 1.356-.572.096-1.28.18-3.79-.824-3.13-1.252-5.112-4.412-5.268-4.622-.156-.21-1.272-1.688-1.272-3.218 0-1.53.804-2.28 1.092-2.584.288-.304.624-.378.834-.378.21 0 .42.002.604.01.192.008.452-.074.708.536.26.622.888 2.164.966 2.322.078.158.13.342.024.552-.104.21-.156.342-.312.524-.156.182-.328.406-.468.546-.156.156-.32.326-.138.636.182.31.81 1.334 1.738 2.16.196.176.386.326.568.428 1.218.682 1.83.582 2.112.282.282-.3.626-.642.796-.89.17-.25.334-.208.562-.124.228.084 1.442.68 1.69 1.046.248.366.248.55.128.832z"/>
                </svg> Recuperar venta</button>
            ) : ped.estado === 'completado' ? (
              <button 
                type="button" 
                className="btn-main-recover blue"
                onClick={() => setSelectedPedido(ped)}
              >
                👁️ Ver Factura
              </button>
            ) : ped.pantallazo_url ? (
              <button 
                type="button" 
                className="btn-main-recover blue"
                onClick={() => setSelectedPedido(ped)}
              >
                💳 Verificar Pago
              </button>
            ) : (
              <button 
                type="button" 
                className="btn-main-recover green"
                onClick={() => {
                  const cleanPhone = (telefonoCliente || '').replace(/\D/g, '');
                  if (!cleanPhone) { showToast('Teléfono inválido para WhatsApp', 'error'); return; }
                  const prodNames = Array.isArray(ped.productos) && ped.productos.length > 0
                    ? ped.productos.map((p: any) => p.nombre).join(', ')
                    : '';
                  const uploadLink = `${window.location.origin}/pago/${ped.id}`;
                  const text = `¡Hola ${nombreCliente || ''}! 👋 Esperamos que estés muy bien. Recordamos que tu pedido de ${prodNames ? `*${prodNames}*` : 'nuestro catálogo'} por valor de *${ped.total.toLocaleString()}* está pendiente de pago.\n\nPor favor, sube tu comprobante de pago en el siguiente enlace para completar tu pedido:\n${uploadLink} 😊`;
                  const targetPhone = cleanPhone.length === 10 ? '57' + cleanPhone : cleanPhone;
                  window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`, '_blank');
                }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ marginRight: '5px', display: 'inline-block', verticalAlign: 'middle' }}>
                  <path d="M12.012 2c-5.506 0-9.988 4.482-9.988 9.988 0 1.761.46 3.473 1.332 4.978L2 22l5.222-1.368a9.92 9.92 0 0 0 4.79 1.228h.004c5.502 0 9.984-4.482 9.984-9.988C22 6.482 17.514 2 12.012 2zm5.836 14.199c-.24.676-1.18 1.258-1.748 1.356-.572.096-1.28.18-3.79-.824-3.13-1.252-5.112-4.412-5.268-4.622-.156-.21-1.272-1.688-1.272-3.218 0-1.53.804-2.28 1.092-2.584.288-.304.624-.378.834-.378.21 0 .42.002.604.01.192.008.452-.074.708.536.26.622.888 2.164.966 2.322.078.158.13.342.024.552-.104.21-.156.342-.312.524-.156.182-.328.406-.468.546-.156.156-.32.326-.138.636.182.31.81 1.334 1.738 2.16.196.176.386.326.568.428 1.218.682 1.83.582 2.112.282.282-.3.626-.642.796-.89.17-.25.334-.208.562-.124.228.084 1.442.68 1.69 1.046.248.366.248.55.128.832z"/>
                </svg>
                Recordar Pago
              </button>
            )}
          </div>
        </div>


      </div>
    );
  };

  const getAdvisorNotifications = (asesor: Asesor | Mayorista, stats: any, isMayorista = false) => {
    const list: any[] = [];
    const now = Date.now();

    // 1. Check for abandoned leads (No Interesados) assigned to this advisor that are not yet contacted / recovered
    const myLeads = leads.filter(l => {
      const isAssigned = (l.linea_whatsapp || '').split(',').map((p: string) => p.replace(/\D/g, '')).some((p: string) => 
        (asesor.telefono || '').split(',').map((ap: string) => ap.replace(/\D/g, '')).includes(p)
      );
      return isAssigned && l.retargeting_estado !== 'contactado' && l.retargeting_estado !== 'recuperado' && l.estado !== 'completado';
    });

    myLeads.forEach(l => {
      const elapsedMins = Math.floor((now - new Date(l.created_at).getTime()) / 60000);
      if (elapsedMins >= 15) {
        list.push({
          id: `lead-${l.id}`,
          type: 'warning',
          title: '⚠️ Demora en Carrito Abandonado',
          message: `Llevas ${elapsedMins} minutos sin atender al cliente "${l.nombre || 'Anónimo'}". ¡Recupéralo antes de que se enfríe!`,
          actionTab: 'pedidos',
          time: l.created_at
        });
      }
    });

    // 2. Check for orders waiting for attention / checking
    const myOrders = pedidos.filter(p => {
      const isAssigned = (p.linea_whatsapp || '').split(',').map((ph: string) => ph.replace(/\D/g, '')).some((ph: string) => 
        (asesor.telefono || '').split(',').map((ap: string) => ap.replace(/\D/g, '')).includes(ph)
      );
      return isAssigned && p.estado !== 'completado';
    });

    myOrders.forEach(o => {
      const elapsedMins = Math.floor((now - new Date(o.created_at).getTime()) / 60000);
      if (!o.atendido && elapsedMins >= 10) {
        list.push({
          id: `order-atender-${o.id}`,
          type: 'danger',
          title: '📞 Cliente Esperando Atención',
          message: `El cliente "${o.cliente_nombre}" realizó un pedido hace ${elapsedMins} minutos y aún no ha sido atendido.`,
          actionTab: 'pedidos',
          time: o.created_at
        });
      } else if (o.atendido && !o.pantallazo_url && elapsedMins >= 45) {
        list.push({
          id: `order-espera-${o.id}`,
          type: 'info',
          title: '⏳ Esperando Comprobante',
          message: `Hace ${elapsedMins} minutos atendiste a "${o.cliente_nombre}", pero no ha subido comprobante. Escríbele para ofrecerle otro medio de pago.`,
          actionTab: 'pedidos',
          time: o.created_at
        });
      }
    });

    // 3. Motivational notification based on daily performance
    if (stats && stats.comisionHoy === 0) {
      list.push({
        id: 'motivate-sales-today',
        type: 'motivate',
        title: '💪 ¡Motívate hoy!',
        message: 'Aún no registras comisiones hoy. ¡El día no ha terminado! Envía un mensaje amable a tus carritos abandonados y activa tus ventas.',
        actionTab: 'pedidos',
        time: new Date().toISOString()
      });
    } else if (stats && stats.comisionHoy > 0) {
      list.push({
        id: 'congrats-sales-today',
        type: 'success',
        title: '🎉 ¡Vas por excelente camino!',
        message: `¡Hoy has ganado $${stats.comisionHoy.toLocaleString()} en comisiones! Sigue así y rompe tu récord diario.`,
        actionTab: 'pedidos',
        time: new Date().toISOString()
      });
    }

    // 4. Notificación de recompra para mayoristas (sin pedido en +15 días)
    if (isMayorista) {
      const aPhones = (asesor.telefono || '').split(',').map((p: string) => p.replace(/\D/g, '')).filter(Boolean);
      const misOrdenes = pedidos.filter(p => {
        const op = (p.linea_whatsapp || '').replace(/\D/g, '');
        return aPhones.includes(op);
      });
      if (misOrdenes.length === 0) {
        list.push({
          id: 'mayorista-sin-pedidos',
          type: 'warning',
          title: '🛒 ¡Es hora de reponer stock!',
          message: 'Aún no has realizado ningún pedido. Comparte tu catálogo con clientes y empieza a generar ventas. ¡Tu primer pedido está a un paso!',
          actionTab: 'resumen_asesor',
          time: new Date().toISOString()
        });
      } else {
        const lastOrder = misOrdenes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        const diasSinComprar = Math.floor((now - new Date(lastOrder.created_at).getTime()) / (1000 * 60 * 60 * 24));
        if (diasSinComprar >= 15) {
          list.push({
            id: 'mayorista-recompra',
            type: 'warning',
            title: `🔄 ¡Llevas ${diasSinComprar} días sin reponer stock!`,
            message: `Tu último pedido fue el ${new Date(lastOrder.created_at).toLocaleDateString()}. Tus clientes pueden estar esperando nuevas referencias. ¡Renueva tu inventario hoy!`,
            actionTab: 'resumen_asesor',
            time: new Date().toISOString()
          });
        } else if (diasSinComprar >= 7) {
          list.push({
            id: 'mayorista-recompra-pronto',
            type: 'info',
            title: `📦 Han pasado ${diasSinComprar} días desde tu último pedido`,
            message: 'Esta semana es un buen momento para revisar qué referencias se están agotando en tu inventario.',
            actionTab: 'resumen_asesor',
            time: new Date().toISOString()
          });
        }
      }
    }

    return list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  };
  const [nuevoAsesorNombre, setNuevoAsesorNombre] = useState('');
  const [nuevoAsesorTelefonos, setNuevoAsesorTelefonos] = useState<string[]>(['']);
  const [nuevoAsesorPin, setNuevoAsesorPin] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [asesorSearchQuery, setAsesorSearchQuery] = useState('');
  const [editingAsesorId, setEditingAsesorId] = useState<string | null>(null);
  const [editingAsesorNombre, setEditingAsesorNombre] = useState('');
  const [editingAsesorTelefonos, setEditingAsesorTelefonos] = useState<string[]>(['']);
  const [editingAsesorPin, setEditingAsesorPin] = useState('');
  const [nuevoAsesorFotoUrl, setNuevoAsesorFotoUrl] = useState('');
  const [editingAsesorFotoUrl, setEditingAsesorFotoUrl] = useState('');
  const [selectedAsesorAnalytics, setSelectedAsesorAnalytics] = useState<any | null>(null);
  // Mayorista states
  const [nuevoMayoristaNombre, setNuevoMayoristaNombre] = useState('');
  const [nuevoMayoristaTelefonos, setNuevoMayoristaTelefonos] = useState<string[]>(['']);
  const [nuevoMayoristaPin, setNuevoMayoristaPin] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [nuevoMayoristaFotoUrl, setNuevoMayoristaFotoUrl] = useState('');
  const [mayoristaBuscador, setMayoristaBuscador] = useState('');
  const [editingMayoristaId, setEditingMayoristaId] = useState<string | null>(null);
  const [editingMayoristaNombre, setEditingMayoristaNombre] = useState('');
  const [editingMayoristaTelefonos, setEditingMayoristaTelefonos] = useState<string[]>(['']);
  const [editingMayoristaPin, setEditingMayoristaPin] = useState('');
  const [editingMayoristaFotoUrl, setEditingMayoristaFotoUrl] = useState('');

  // POS States
  const [posCart, setPosCart] = useState<any[]>([]);
  const [posSearchQuery, setPosSearchQuery] = useState('');
  const [posCategoryFilter, setPosCategoryFilter] = useState('todos');
  const [posCustomerPhone, setPosCustomerPhone] = useState('');
  const [posCustomerName, setPosCustomerName] = useState('');
  const [posCustomerAddress, setPosCustomerAddress] = useState('');
  const [posCustomerCity, setPosCustomerCity] = useState('');
  const [posPaymentMethod, setPosPaymentMethod] = useState<'efectivo' | 'transferencia' | 'tarjeta'>('efectivo');
  const [posPriceTier, setPosPriceTier] = useState<'detal' | 'por_mayor' | 'precio_50_unidades'>('detal');
  const [posCheckoutSuccess, setPosCheckoutSuccess] = useState(false);
  const [posLastInvoice, setPosLastInvoice] = useState<any | null>(null);

  useEffect(() => {
    const lookupCustomer = async () => {
      if (posCustomerPhone.trim().length >= 7) {
        const { data, error } = await supabase
          .from('clientes_exitosos')
          .select('*')
          .eq('telefono', posCustomerPhone.trim())
          .eq('tenant_id', getTenantId())
          .maybeSingle();
        if (!error && data) {
          setPosCustomerName(data.nombre || '');
          // Find last order of this client to fetch address and city
          const { data: lastOrder } = await supabase
            .from('pedidos')
            .select('direccion, ciudad')
            .eq('cliente_telefono', posCustomerPhone.trim())
            .eq('tenant_id', getTenantId())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastOrder) {
            setPosCustomerAddress(lastOrder.direccion || '');
            setPosCustomerCity(lastOrder.ciudad || '');
          }
        }
      }
    };
    lookupCustomer();
  }, [posCustomerPhone]);

  const [showSuccessScreen, setShowSuccessScreen] = useState<boolean>(false);
  const [numeroGuia, setNumeroGuia] = useState<string>('');
  const [loadingGuia, setLoadingGuia] = useState<boolean>(false);

  useEffect(() => {
    if (selectedPedido) {
      setNumeroGuia(selectedPedido.numero_guia || '');
      setShowSuccessScreen(false);
    } else {
      setNumeroGuia('');
      setShowSuccessScreen(false);
    }
  }, [selectedPedido]);
  const [subcatNombre, setSubcatNombre] = useState('');
  const [subcatSlug, setSubcatSlug] = useState('');
  const [subcatParentId, setSubcatParentId] = useState('');
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [productSort, setProductSort] = useState<string>('recientes');
  const [mayoristaSearchQuery, setMayoristaSearchQuery] = useState('');
  const [mayoristaProductSort, setMayoristaProductSort] = useState<string>('recientes');
  const [mayoristaCategoryFilter, setMayoristaCategoryFilter] = useState<string>('todos');

  const [bulkForms, setBulkForms] = useState<ProductFormData[]>([{ ...emptyProduct }]);

  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [editExtraImages, setEditExtraImages] = useState<{ url: string; ref: string }[]>([]);
  const [editUploadingIdx, setEditUploadingIdx] = useState<number | null>(null);

  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingSubcategory, setIsAddingSubcategory] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'manual' | 'excel' | 'texto'>('manual');
  const [pastedText, setPastedText] = useState('');
  const [excelProducts, setExcelProducts] = useState<any[]>([]);
  const [siigoLoading, setSiigoLoading] = useState(false);
  const [siigoLogs, setSiigoLogs] = useState<string[]>([]);
  const [syncPending, setSyncPending] = useState<{ toCreate: any[]; toUpdate: any[] } | null>(null);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [deleteDate, setDeleteDate] = useState('');
  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);
  const [wipingCatalog, setWipingCatalog] = useState(false);

  // States for Editing Categories & Subcategories
  const [editingCategory, setEditingCategory] = useState<Categoria | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategoria | null>(null);

  const hasRestoredModals = useRef(false);

  // Sync state to URL
  useEffect(() => {
    if (!hasRestoredModals.current) return;

    const params = new URLSearchParams(window.location.search);
    let changed = false;

    if (activeTab && params.get('tab') !== activeTab) {
      params.set('tab', activeTab);
      changed = true;
    }

    if (editingProduct) {
      if (params.get('editProduct') !== editingProduct.id.toString()) {
        params.set('editProduct', editingProduct.id.toString());
        changed = true;
      }
    } else {
      if (params.has('editProduct')) {
        params.delete('editProduct');
        changed = true;
      }
    }

    if (editingCategory) {
      if (params.get('editCategory') !== editingCategory.id.toString()) {
        params.set('editCategory', editingCategory.id.toString());
        changed = true;
      }
    } else {
      if (params.has('editCategory')) {
        params.delete('editCategory');
        changed = true;
      }
    }

    if (selectedPedido) {
      if (params.get('viewOrder') !== selectedPedido.id.toString()) {
        params.set('viewOrder', selectedPedido.id.toString());
        changed = true;
      }
    } else {
      if (params.has('viewOrder')) {
        params.delete('viewOrder');
        changed = true;
      }
    }

    if (isAddingProduct) {
      if (!params.has('newProduct')) { params.set('newProduct', 'true'); changed = true; }
    } else {
      if (params.has('newProduct')) { params.delete('newProduct'); changed = true; }
    }

    if (isAddingCategory) {
      if (!params.has('newCategory')) { params.set('newCategory', 'true'); changed = true; }
    } else {
      if (params.has('newCategory')) { params.delete('newCategory'); changed = true; }
    }

    if (changed) {
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', newUrl);
    }
  }, [activeTab, editingProduct, editingCategory, selectedPedido, isAddingProduct, isAddingCategory]);

  // Sync URL to State on initial data load
  useEffect(() => {
    if (hasRestoredModals.current) return;
    if (productos.length === 0 && categoriasData.length === 0 && pedidos.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    let restored = false;

    if (params.has('editProduct') && productos.length > 0 && !editingProduct) {
      const pId = params.get('editProduct');
      const prod = productos.find(p => p.id === pId);
      if (prod) {
        setEditingProduct(prod);
        setEditExtraImages((prod.imagenes_extra || []).map(u => decodeExtraImage(u)));
        restored = true;
      }
    }

    if (params.has('editCategory') && categoriasData.length > 0 && !editingCategory) {
      const cId = params.get('editCategory');
      const cat = categoriasData.find(c => c.id === cId);
      if (cat) {
        setEditingCategory(cat);
        restored = true;
      }
    }

    if (params.has('viewOrder') && pedidos.length > 0 && !selectedPedido) {
      const oId = params.get('viewOrder');
      const order = pedidos.find(o => o.id === oId);
      if (order) {
        setSelectedPedido(order);
        restored = true;
      }
    }

    if (params.has('newProduct') && !isAddingProduct) {
      setIsAddingProduct(true);
      restored = true;
    }

    if (params.has('newCategory') && !isAddingCategory) {
      setIsAddingCategory(true);
      restored = true;
    }

    if (restored || productos.length > 0 || categoriasData.length > 0 || pedidos.length > 0) {
      hasRestoredModals.current = true;
    }
  }, [productos, categoriasData, pedidos]);
  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleLogout() {
    localStorage.removeItem(`admin_auth_${getTenantId()}`);
    localStorage.removeItem(`admin_role_${getTenantId()}`);
    localStorage.removeItem(`admin_asesor_id_${getTenantId()}`);
    localStorage.removeItem(`admin_asesor_phone_${getTenantId()}`);
    localStorage.removeItem('admin_active_tab');
    setIsAuthenticated(false);
    setRole('admin');
    setLoggedAsesorPhone(null);
    setSelectedCompany(null);
    setPin('');
    setActiveTab('productos');
  }

  const [pagoModalUrl, setPagoModalUrl] = useState<string | null>(null);

  // Filtros y Ordenamiento para la pestaña de Pedidos
  const [orderFilterStatus, setOrderFilterStatus] = useState<string>('todos');
  const [orderFilterOrigin, setOrderFilterOrigin] = useState<string>('todos');
  const [orderFilterAsesor, setOrderFilterAsesor] = useState<string>('todos');
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [orderFilterDate, setOrderFilterDate] = useState<string>('');
  const [orderSortBy, setOrderSortBy] = useState<string>('date_desc');
  const [showMobileSearch, setShowMobileSearch] = useState<boolean>(false);
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  const [leads, setLeads] = useState<any[]>([]);
  const [pedidosViewMode, setPedidosViewMode] = useState<'lista' | 'kanban'>(() => {
    return (localStorage.getItem('admin_pedidos_view_mode') as 'lista' | 'kanban' || 'lista');
  });

  const getAsesorNameByPhone = (phone?: string) => {
    if (!phone) return 'Sin Asignar';
    const cleanInput = phone.trim();
    if (cleanInput === 'pos' || cleanInput.replace(/\D/g, '') === 'pos') return 'POS';
    
    const firstPhone = cleanInput.split(',')[0].replace(/\D/g, '');
    const numSinIndicativo = firstPhone.startsWith('57') ? firstPhone.substring(2) : firstPhone;
    
    const matchAsesor = asesores.find(a => {
      const phones = (a.telefono || '').split(',').map(p => p.replace(/\D/g, '')).filter(Boolean);
      return phones.some(p => cleanInput.split(',').map(cp => cp.replace(/\D/g, '')).includes(p));
    });
    if (matchAsesor) return matchAsesor.nombre;

    const matchMayorista = mayoristas.find(m => {
      const phones = (m.telefono || '').split(',').map(p => p.replace(/\D/g, '')).filter(Boolean);
      return phones.some(p => cleanInput.split(',').map(cp => cp.replace(/\D/g, '')).includes(p));
    });
    if (matchMayorista) return matchMayorista.nombre;

    return numSinIndicativo;
  };

  const getAsesorInfoByPhone = (phone?: string) => {
    if (!phone) return { nombre: 'Sin Asignar', foto_url: '', role: 'Catálogo' };
    const cleanInput = phone.trim();
    if (cleanInput === 'pos' || cleanInput.replace(/\D/g, '') === 'pos') return { nombre: 'POS', foto_url: '', role: 'Sistema' };
    
    const matchAsesor = asesores.find(a => {
      const phones = (a.telefono || '').split(',').map(p => p.replace(/\D/g, '')).filter(Boolean);
      return phones.some(p => cleanInput.split(',').map(cp => cp.replace(/\D/g, '')).includes(p));
    });
    if (matchAsesor) return { nombre: matchAsesor.nombre, foto_url: matchAsesor.foto_url || '', role: 'Asesor' };

    const matchMayorista = mayoristas.find(m => {
      const phones = (m.telefono || '').split(',').map(p => p.replace(/\D/g, '')).filter(Boolean);
      return phones.some(p => cleanInput.split(',').map(cp => cp.replace(/\D/g, '')).includes(p));
    });
    if (matchMayorista) return { nombre: matchMayorista.nombre, foto_url: matchMayorista.foto_url || '', role: 'Mayorista' };

    const cleanPhone = cleanInput.split(',')[0].replace(/\D/g, '');
    const numSinIndicativo = cleanPhone.startsWith('57') ? cleanPhone.substring(2) : cleanPhone;
    return { nombre: numSinIndicativo, foto_url: '', role: 'Asesor' };
  };

  const getParsedProducts = (rawProds: any) => {
    if (!rawProds) return [];
    if (Array.isArray(rawProds)) return rawProds;
    if (typeof rawProds === 'string') {
      try {
        const parsed = JSON.parse(rawProds);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  const renderAsesorBadge = (phone?: string, origen?: string) => {
    if (!phone) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#64748b' }}>👤 Sin Asignar</span>;
    const cleanInput = phone.trim();
    if (cleanInput === 'pos' || cleanInput.replace(/\D/g, '') === 'pos') {
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#166534', fontWeight: 700 }}>💻 POS</span>;
    }
    
    const name = getAsesorNameByPhone(phone);
    
    const matchAsesor = asesores.find(a => {
      const phones = (a.telefono || '').split(',').map(p => p.replace(/\D/g, '')).filter(Boolean);
      return phones.some(p => cleanInput.split(',').map(cp => cp.replace(/\D/g, '')).includes(p));
    });
    const matchMayorista = mayoristas.find(m => {
      const phones = (m.telefono || '').split(',').map(p => p.replace(/\D/g, '')).filter(Boolean);
      return phones.some(p => cleanInput.split(',').map(cp => cp.replace(/\D/g, '')).includes(p));
    });
    const match = matchAsesor || matchMayorista;

    const lineaDisplay = cleanInput.split(',').map(p => p.trim()).filter(Boolean)[0] || cleanInput;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', verticalAlign: 'middle', textAlign: 'left' }}>
        {match?.foto_url ? (
          <img 
            src={match.foto_url} 
            alt={name} 
            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #cbd5e1', flexShrink: 0 }} 
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-color,#6366f1), #8b5cf6)', fontSize: '1rem', color: 'white', fontWeight: 700, flexShrink: 0 }}>
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 700, lineHeight: 1.2 }}>{name}</span>
          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500, lineHeight: 1 }}>📲 {lineaDisplay}</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
            {origen && (
              origen === 'pos' ? (
                <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#166534', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, display: 'inline-block' }}>POS</span>
              ) : (
                <span style={{ fontSize: '0.65rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, display: 'inline-block' }}>Catálogo</span>
              )
            )}
            {matchAsesor && (
              <span style={{ fontSize: '0.65rem', background: '#f3e8ff', color: '#6b21a8', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, display: 'inline-block' }}>Asesor</span>
            )}
            {matchMayorista && (
              <span style={{ fontSize: '0.65rem', background: '#fef3c7', color: '#b45309', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, display: 'inline-block' }}>Mayorista</span>
            )}
          </div>
        </span>
      </span>
    );
  };

  useEffect(() => {
    localStorage.setItem('admin_pedidos_view_mode', pedidosViewMode);
  }, [pedidosViewMode]);

  useEffect(() => {
    if (configuracion?.nombre_negocio) {
      document.title = `${configuracion.nombre_negocio} - Panel Administrativo`;
    } else {
      document.title = 'Panel Administrativo';
    }

    if (configuracion) {
      if (configuracion.color_primario) {
        document.documentElement.style.setProperty('--primary-color', configuracion.color_primario);
        localStorage.setItem(`admin_primary_color_${getTenantId()}`, configuracion.color_primario);
        // Extraer RGB para transparencias rgba()
        const hex = configuracion.color_primario.replace('#', '');
        if (hex.length === 6) {
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
          }
        }
      } else {
        document.documentElement.style.setProperty('--primary-color', '#6366f1');
        document.documentElement.style.setProperty('--primary-rgb', '99, 102, 241');
        localStorage.removeItem(`admin_primary_color_${getTenantId()}`);
      }
    }
  }, [configuracion]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('admin_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem('admin_sidebar_collapsed', String(newVal));
      return newVal;
    });
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await cargarDatos();
      showToast('Datos sincronizados ✓');
    } catch (e: any) {
      showToast('Error al sincronizar: ' + e.message, 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    
    cargarDatos();
    
    // Auto-refresh data every 10 seconds to keep stats and orders in real-time
    const interval = setInterval(() => {
      cargarDatos();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  async function cargarDatos() {
    try {
      const tenant = getTenantId();

      // Fetch other data in parallel
      const [catRes, subcatRes, confRes, pedRes, leadRes, cliRes, aseRes, matRes, mayRes] = await Promise.all([
        supabase.from('categorias').select('*').eq('tenant_id', tenant).order('orden', { ascending: true }),
        supabase.from('subcategorias').select('*').eq('tenant_id', tenant).order('orden', { ascending: true }),
        supabase.from('configuracion').select('*').eq('tenant_id', tenant).limit(1).single(),
        supabase.from('pedidos').select('*').eq('tenant_id', tenant).order('created_at', { ascending: false }),
        supabase.from('leads').select('*').eq('tenant_id', tenant).order('created_at', { ascending: false }),
        supabase.from('clientes_exitosos').select('*').eq('tenant_id', tenant).order('total_compras', { ascending: false }),
        supabase.from('asesores').select('*').eq('tenant_id', tenant).order('created_at', { ascending: false }),
        supabase.from('material_apoyo').select('*').eq('tenant_id', tenant).order('created_at', { ascending: false }),
        supabase.from('mayoristas').select('*').eq('tenant_id', tenant).order('created_at', { ascending: false })
      ]);

      if (catRes.data) setCategoriasData(catRes.data);
      if (subcatRes.data) setSubcategoriasData(subcatRes.data);
      if (pedRes.data) setPedidos(pedRes.data);
      if (leadRes.data) setLeads(leadRes.data);
      if (cliRes.data) setClientes(cliRes.data);
      if (aseRes && aseRes.data) setAsesores(aseRes.data);
      if (matRes && matRes.data) setMateriales(matRes.data);
      if (mayRes && mayRes.data) setMayoristas(mayRes.data);

      // Fetch products in chunks of 1000 to bypass Supabase defaults
      let allProducts: Producto[] = [];
      let from = 0;
      let to = 999;
      let hasMore = true;

      while (hasMore) {
        const { data: chunk, error: prodError } = await supabase
          .from('productos')
          .select('*')
          .eq('tenant_id', tenant)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (prodError || !chunk || chunk.length === 0) {
          hasMore = false;
        } else {
          allProducts = [...allProducts, ...chunk];
          if (chunk.length < 1000) {
            hasMore = false;
          } else {
            from += 1000;
            to += 1000;
          }
        }
      }

      setProductos(allProducts);
      
      if (confRes.data) {
        setConfiguracion(confRes.data);
        setWebhookUrl(`https://dowbsbxvxjzjjhyqmyfr.supabase.co/functions/v1/siigo-webhook?tenant=${tenant}`);
      } else {
        // Create default config for this tenant if it doesn't exist
        const tenant = getTenantId();
        const defaultConfig = {
          nombre_negocio: tenant,
          whatsapp: '573185637317',
          descripcion_hero: 'CATÁLOGO DIGITAL',
          tenant_id: tenant
        };
        const { data: newConf } = await supabase.from('configuracion').insert([defaultConfig]).select().single();
        if (newConf) setConfiguracion(newConf);
      }
    } catch (err: any) {
      console.error('Error cargando datos:', err);
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const tenant = getTenantId();

      const { data: confData } = await supabase
        .from('configuracion')
        .select('admin_pin')
        .eq('tenant_id', tenant)
        .limit(1)
        .maybeSingle();

      const expectedAdminPin = confData?.admin_pin || SECRET_PIN;

      if (pin.trim() === expectedAdminPin.trim()) {
        localStorage.setItem(`admin_auth_${getTenantId()}`, 'true');
        localStorage.setItem(`admin_role_${getTenantId()}`, 'admin');
        setRole('admin');
        setLoggedAsesorPhone(null);
        setIsAuthenticated(true);
        setActiveTab('productos');
        setLoading(false);
        return;
      }
      const { data: advisorMatch, error } = await supabase
        .from('asesores')
        .select('*')
        .eq('tenant_id', tenant)
        .eq('pin', pin.trim())
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (advisorMatch) {
        // Encontrado en tabla asesores
        localStorage.setItem(`admin_auth_${getTenantId()}`, 'true');
        localStorage.setItem(`admin_role_${getTenantId()}`, 'asesor');
        localStorage.setItem(`admin_asesor_id_${getTenantId()}`, advisorMatch.id);
        localStorage.setItem(`admin_asesor_phone_${getTenantId()}`, advisorMatch.telefono);
        setRole('asesor');
        setLoggedAsesorPhone(advisorMatch.telefono);
        setIsAuthenticated(true);
        setActiveTab('pedidos');
        showToast(`Sesión iniciada como asesor: ${advisorMatch.nombre} ✓`, 'success');
      } else {
        // Buscar en tabla mayoristas (independiente)
        const { data: mayoristaMatch, error: mayError } = await supabase
          .from('mayoristas')
          .select('*')
          .eq('tenant_id', tenant)
          .eq('pin', pin.trim())
          .limit(1)
          .maybeSingle();
        if (mayError) throw mayError;
        if (mayoristaMatch) {
          localStorage.setItem(`admin_auth_${getTenantId()}`, 'true');
          localStorage.setItem(`admin_role_${getTenantId()}`, 'mayorista');
          localStorage.setItem(`admin_asesor_id_${getTenantId()}`, mayoristaMatch.id);
          localStorage.setItem(`admin_asesor_phone_${getTenantId()}`, mayoristaMatch.telefono);
          setRole('mayorista');
          setLoggedAsesorPhone(mayoristaMatch.telefono);
          setIsAuthenticated(true);
          setActiveTab('resumen_asesor');
          showToast(`Sesión iniciada como mayorista: ${mayoristaMatch.nombre} ✓`, 'success');
        } else {
          showToast('PIN incorrecto o no registrado.', 'error');
          setPin('');
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error de autenticación.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateBulkForm = (index: number, field: keyof ProductFormData, value: string | number) => {
    const newForms = [...bulkForms];
    newForms[index] = { ...newForms[index], [field]: value };
    setBulkForms(newForms);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, formIndex: number, imgIndex: number) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setLoading(true);
    try {
      const uploadedData: { url: string, ref: string }[] = [];
      for (const file of files) {
        const compFile = await compressImage(file);
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${compFile.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage.from('archivos').upload(fileName, compFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
        const originalName = file.name.split('.').slice(0, -1).join('.').toUpperCase();
        uploadedData.push({ url: data.publicUrl, ref: originalName });
      }
      // Insertar las URLs subidas a partir de la posición imgIndex
      const newForms = [...bulkForms];
      const newImagenes = [...newForms[formIndex].imagenes];
      newImagenes.splice(imgIndex, 1, ...uploadedData);
      // Agregar filas extra si se subieron más de una imagen
      newForms[formIndex] = { ...newForms[formIndex], imagenes: newImagenes };
      setBulkForms(newForms);
      showToast(`${uploadedData.length} foto(s) subida(s) ✓`);
    } catch {
      showToast('Error al subir foto(s)', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateImagenUrl = (formIndex: number, imgIndex: number, value: string) => {
    const newForms = [...bulkForms];
    const newImagenes = [...newForms[formIndex].imagenes];
    newImagenes[imgIndex] = { ...newImagenes[imgIndex], url: value };
    newForms[formIndex] = { ...newForms[formIndex], imagenes: newImagenes };
    setBulkForms(newForms);
  };

  const updateImagenRef = (formIndex: number, imgIndex: number, value: string) => {
    const newForms = [...bulkForms];
    const newImagenes = [...newForms[formIndex].imagenes];
    newImagenes[imgIndex] = { ...newImagenes[imgIndex], ref: value };
    newForms[formIndex] = { ...newForms[formIndex], imagenes: newImagenes };
    setBulkForms(newForms);
  };

  const addImagenRow = (formIndex: number) => {
    const newForms = [...bulkForms];
    newForms[formIndex] = { ...newForms[formIndex], imagenes: [...newForms[formIndex].imagenes, { url: '', ref: '' }] };
    setBulkForms(newForms);
  };

  const removeImagenRow = (formIndex: number, imgIndex: number) => {
    const newForms = [...bulkForms];
    const newImagenes = newForms[formIndex].imagenes.filter((_, i) => i !== imgIndex);
    newForms[formIndex] = { ...newForms[formIndex], imagenes: newImagenes.length > 0 ? newImagenes : [{ url: '', ref: '' }] };
    setBulkForms(newForms);
  };



  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const validForms = bulkForms.filter(f => f.nombre.trim() !== '' && f.precio !== '');
    const newProducts = validForms.map(f => {
      const allImgs = f.imagenes.filter(img => img.url.trim() !== '');
      const mainImg = allImgs.length > 0 ? allImgs[0].url : '';
      const extraImgs = allImgs.slice(1).map(img => encodeExtraImage(img.url, img.ref));

      return {
        nombre: f.nombre,
        descripcion: f.descripcion,
        precio: parseFloat(f.precio),
        precio_por_mayor: parseFloat(f.precio_por_mayor) || null,
        precio_50_unidades: parseFloat(f.precio_50_unidades) || null,
        categoria: f.categoria,
        subcategoria: f.subcategoria || null,
        imagen_url: mainImg,
        imagenes_extra: extraImgs.length > 0 ? extraImgs : null,
        video_url: f.video_url || null,
        tallas: f.tallas || null,
        estampados: f.estampados || null,
        stock: f.stock || 0,
        tenant_id: getTenantId()
      };
    });
    const { error } = await supabase.from('productos').insert(newProducts);
    setLoading(false);
    if (error) {
      showToast('Error al guardar: ' + error.message, 'error');
    } else {
      showToast(`${validForms.length} producto(s) guardado(s) exitosamente ✓`);
      setBulkForms([{ ...emptyProduct }]);
      setIsAddingProduct(false);
      cargarDatos();
    }
  };

  const downloadExcelTemplate = () => {
    const templateData = [
      {
        "Nombre": "Camiseta Básica",
        "Referencia": "CAM-001",
        "Descripción": "Camiseta 100% algodón",
        "Precio": 25000,
        "Costo": 15000,
        "Precio por mayor": 20000,
        "Precio 50 unidades": 18000,
        "Categoría": "Ropa",
        "Subcategoría": "Camisetas",
        "Tallas": "S, M, L, XL",
        "Estampados": "Liso, Rayas",
        "Stock": 100,
        "Imagen": "https://ejemplo.com/imagen.jpg",
        "Video": "https://ejemplo.com/video.mp4"
      },
      {
        "Nombre": "Pantalón Jean",
        "Referencia": "PAN-002",
        "Descripción": "Jean clásico azul",
        "Precio": 65000,
        "Costo": 40000,
        "Precio por mayor": 55000,
        "Precio 50 unidades": 50000,
        "Categoría": "Ropa",
        "Subcategoría": "Pantalones",
        "Tallas": "28, 30, 32, 34",
        "Estampados": "",
        "Stock": 50,
        "Imagen": "",
        "Video": ""
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Productos");
    XLSX.writeFile(wb, "Plantilla_Importacion_Productos.xlsx");
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);
        
        const mapped = rows.map((row: any) => {
          const findVal = (keys: string[]) => {
            const foundKey = Object.keys(row).find(k => keys.includes(k.toLowerCase().trim()));
            return foundKey ? String(row[foundKey]).trim() : '';
          };
          
          const desc = findVal(['descripcion', 'detalles', 'description']);
          const ref = findVal(['referencia', 'ref', 'code']);
          const name = findVal(['nombre', 'titulo', 'title', 'name']) || desc || `Producto ${ref}`;
          
          return {
            nombre: name,
            descripcion: desc || name,
            referencia: ref,
            precio: parseFloat(findVal(['detal', 'precio', 'valor', 'price'])) || 0,
            categoria: findVal(['categoria', 'category', 'cat']) || 'General',
            subcategoria: findVal(['subcategoria', 'subcategory', 'subcat']) || null,
            imagen_url: findVal(['imagen', 'imagen_url', 'image', 'image_url']),
            video_url: findVal(['video', 'video_url', 'url_video']),
            tallas: findVal(['tallas', 'talla', 'sizes', 'size']),
            costo: parseFloat(findVal(['costo', 'cost'])) || 0,
            precio_por_mayor: parseFloat(findVal(['por mayor', 'mayor', 'wholesale'])) || 0,
            precio_50_unidades: parseFloat(findVal(['50 unidades', '50unidades', 'unidades 50'])) || 0,
            estampados: findVal(['estampados', 'estampado', 'tematica', 'tematicas', 'print', 'prints']),
            stock: parseInt(findVal(['stock', 'cantidad', 'qty'])) || 0
          };
        });
        
        const valid = mapped.filter(p => p.nombre);
        setExcelProducts(valid);
        showToast(`Se cargaron ${valid.length} productos del Excel ✓`);
      } catch (err: any) {
        showToast('Error leyendo el archivo Excel', 'error');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleTextImport = () => {
    if (!pastedText.trim()) {
      showToast('Por favor, pega el texto primero', 'error');
      return;
    }
    try {
      const lines = pastedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        showToast('El texto no contiene suficientes filas (se requiere cabecera y datos)', 'error');
        return;
      }
      
      const headerLine = lines[0];
      const separator = headerLine.includes('\t') ? '\t' : ',';
      
      const headers = headerLine.split(separator).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
      
      const parsedRows = lines.slice(1).map(line => {
        let cols: string[] = [];
        if (separator === ',') {
          cols = line.split(',');
        } else {
          cols = line.split('\t');
        }
        
        cols = cols.map(c => c.replace(/^["']|["']$/g, '').trim());
        
        const rowObj: any = {};
        headers.forEach((header, idx) => {
          if (idx < cols.length) {
            rowObj[header] = cols[idx];
          }
        });
        
        const getFieldVal = (keys: string[]) => {
          const foundKey = Object.keys(rowObj).find(k => keys.includes(k.toLowerCase().trim()));
          return foundKey ? rowObj[foundKey] : '';
        };
        
        const desc = getFieldVal(['descripcion', 'description', 'desc']);
        const ref = getFieldVal(['referencia', 'ref', 'code']);
        const cat = getFieldVal(['categoria', 'category', 'cat']);
        
        const costoVal = parseFloat(getFieldVal(['costo', 'cost'])) || 0;
        const porMayorVal = parseFloat(getFieldVal(['por mayor', 'mayor', 'wholesale'])) || 0;
        const detalVal = parseFloat(getFieldVal(['detal', 'precio', 'price', 'valor'])) || 0;
        const unidades50Val = parseFloat(getFieldVal(['50 unidades', '50unidades', 'unidades 50'])) || 0;
        const stockVal = parseInt(getFieldVal(['stock', 'cantidad', 'qty'])) || 0;
        
        const name = desc || `Producto ${ref}`;
        
        return {
          nombre: name,
          descripcion: desc || name,
          referencia: ref || '',
          categoria: cat || 'General',
          subcategoria: null,
          costo: costoVal,
          precio_por_mayor: porMayorVal,
          precio: detalVal,
          precio_50_unidades: unidades50Val,
          stock: stockVal,
          imagen_url: '',
          video_url: null,
          tallas: '',
          estampados: getFieldVal(['estampados', 'estampado', 'tematica', 'tematicas', 'print', 'prints'])
        };
      });
      
      const valid = parsedRows.filter(p => p.nombre || p.referencia);
      setExcelProducts(valid);
      showToast(`Se cargaron ${valid.length} productos desde el texto ✓`, 'success');
      setUploadMethod('excel');
    } catch (err: any) {
      console.error(err);
      showToast('Error al procesar el texto: ' + err.message, 'error');
    }
  };

  const handleExcelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (excelProducts.length === 0) return;
    setLoading(true);
    const newProducts = excelProducts.map(p => ({
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: p.precio,
      categoria: p.categoria,
      subcategoria: p.subcategoria || null,
      imagen_url: p.imagen_url || '',
      video_url: p.video_url || null,
      tallas: p.tallas || null,
      referencia: p.referencia || null,
      costo: p.costo || null,
      precio_por_mayor: p.precio_por_mayor || null,
      precio_50_unidades: p.precio_50_unidades || null,
      stock: p.stock || 0,
      estampados: p.estampados || null,
      tenant_id: getTenantId()
    }));
    const { error } = await supabase.from('productos').insert(newProducts);
    setLoading(false);
    if (error) {
      showToast('Error al guardar: ' + error.message, 'error');
    } else {
      showToast(`${excelProducts.length} productos guardados exitosamente ✓`);
      setExcelProducts([]);
      setIsAddingProduct(false);
      cargarDatos();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este producto?')) return;
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (!error) { cargarDatos(); showToast('Producto eliminado'); }
    else showToast('Error al eliminar', 'error');
  };

  const handleToggleVisibility = async (p: Producto) => {
    try {
      setLoading(true);
      const newStatus = !p.oculto;
      const { error } = await supabase.from('productos').update({ oculto: newStatus }).eq('id', p.id);
      if (error) throw error;
      setProductos(productos.map(prod => prod.id === p.id ? { ...prod, oculto: newStatus } : prod));
      showToast(newStatus ? 'Producto ocultado globalmente 👁️‍🗨️' : 'Producto visible globalmente 👁️', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al cambiar visibilidad', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (p: any) => {
    setLoading(true);
    const copy = { ...p };
    delete copy.id;
    delete copy.created_at;
    copy.nombre = `${copy.nombre} (Copia)`;
    const { error } = await supabase.from('productos').insert([copy]);
    setLoading(false);
    if (!error) {
      cargarDatos();
      showToast('Producto duplicado ✓');
    } else {
      showToast('Error al duplicar: ' + error.message, 'error');
    }
  };





  const handleAprobarPago = async (ped: Pedido) => {
    setLoading(true);
    try {
      // 1. Actualizar el pedido en Supabase
      const { error: errorPed } = await supabase
        .from('pedidos')
        .update({ estado: 'completado', atendido: true })
        .eq('id', ped.id);

      if (errorPed) throw errorPed;

      // 2. Registrar/actualizar en la base de datos de clientes exitosos
      if (ped.cliente_telefono) {
        const telLimpio = ped.cliente_telefono.trim();
        const tenant = ped.tenant_id || getTenantId();

        const { data: extExist, error: errorExist } = await supabase
          .from('clientes_exitosos')
          .select('*')
          .eq('telefono', telLimpio)
          .eq('tenant_id', tenant)
          .maybeSingle();

        if (!errorExist) {
          if (extExist) {
            await supabase
              .from('clientes_exitosos')
              .update({
                nombre: ped.cliente_nombre || extExist.nombre,
                total_compras: (extExist.total_compras || 0) + (ped.total || 0),
                numero_pedidos: (extExist.numero_pedidos || 0) + 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', extExist.id);
          } else {
            await supabase
              .from('clientes_exitosos')
              .insert({
                nombre: ped.cliente_nombre,
                telefono: telLimpio,
                total_compras: ped.total || 0,
                numero_pedidos: 1,
                tenant_id: tenant
              });
          }
        }
      }

      // 3. Actualizar estado local
      setPedidos(prev => prev.map(p => p.id === ped.id ? { ...p, estado: 'completado', atendido: true } : p));
      setSelectedPedido(prev => prev && prev.id === ped.id ? { ...prev, estado: 'completado', atendido: true } : prev);
      
      cargarDatos();

      setShowSuccessScreen(true);
    } catch (err: any) {
      console.error(err);
      showToast('Error al procesar la aprobación: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerarGuia99Envios = async (pedId: string) => {
    setLoadingGuia(true);
    try {
      // Simulate API call to 99 Envios / 99 Minutos
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const randNum = Math.floor(100000 + Math.random() * 900000);
      const generatedGuia = `99E-${randNum}`;
      
      // Update in Supabase
      const { error } = await supabase
        .from('pedidos')
        .update({ numero_guia: generatedGuia })
        .eq('id', pedId);
        
      if (error) throw error;
      
      setNumeroGuia(generatedGuia);
      
      // Update local state
      setPedidos(prev => prev.map(p => p.id === pedId ? { ...p, numero_guia: generatedGuia } : p));
      setSelectedPedido(prev => prev && prev.id === pedId ? { ...prev, numero_guia: generatedGuia } : prev);
      
      showToast('Guía generada con 99 Envíos ✓', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Error al generar la guía: ' + err.message, 'error');
    } finally {
      setLoadingGuia(false);
    }
  };

  const handleGuardarGuiaManual = async (pedId: string, manualGuia: string) => {
    if (!manualGuia.trim()) {
      showToast('Ingresa un número de guía válido', 'error');
      return;
    }
    setLoadingGuia(true);
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ numero_guia: manualGuia.trim() })
        .eq('id', pedId);
        
      if (error) throw error;
      
      // Update local state
      setPedidos(prev => prev.map(p => p.id === pedId ? { ...p, numero_guia: manualGuia.trim() } : p));
      setSelectedPedido(prev => prev && prev.id === pedId ? { ...prev, numero_guia: manualGuia.trim() } : prev);
      
      showToast('Número de guía guardado ✓', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Error al guardar: ' + err.message, 'error');
    } finally {
      setLoadingGuia(false);
    }
  };

  const handleAtenderPedido = async (ped: Pedido) => {
    const uploadLink = `${window.location.origin}/pago/${ped.id}`;
    const msg = `¡Hola ${ped.cliente_nombre}! 👋\nGracias por tu pedido en *${configuracion?.nombre_negocio || 'nuestra tienda'}*.\n\n*Total a pagar: ${ped.total.toLocaleString()} COP*\n\n💳 *Datos del banco:*\nNúmero: ${configuracion?.whatsapp || ''}\nTitular: ${configuracion?.nombre_negocio || ''}\n\nPara poder completar tu pedido, haz la captura de pantalla de tu pago o de transacción y envíala por este enlace:\n${uploadLink}\n\n¡Tu pedido será despachado en cuanto verifiquemos el pago! 🚀`;
    window.open(formatWhatsAppLink(ped.cliente_telefono || '', msg), '_blank');

    // 2. Marcar en Base de Datos como atendido
    const { error } = await supabase.from('pedidos').update({ atendido: true }).eq('id', ped.id);
    if (!error) {
      setPedidos(prev => prev.map(p => p.id === ped.id ? { ...p, atendido: true } : p));
      showToast('Pedido marcado como atendido ✓');
    } else {
      showToast('Error al marcar como atendido en DB', 'error');
    }
  };

  const handleUpdateLeadStatus = async (leadId: string, status: string) => {
    try {
      const activeAsesor = role === 'asesor' ? asesores.find(a => a.telefono === loggedAsesorPhone) : null;
      const userLabel = activeAsesor ? activeAsesor.nombre : 'Admin';
      const { error } = await supabase
        .from('leads')
        .update({ retargeting_estado: status, retargeted_by: userLabel })
        .eq('id', leadId);
      
      if (error) throw error;
      
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, retargeting_estado: status, retargeted_by: userLabel } : l));
      showToast(`Lead marcado como ${status} ✓`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Error al actualizar lead: ' + err.message, 'error');
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setLoading(true);
    const extraImgs = editExtraImages.filter(u => u.url.trim());
    let mainImg = editingProduct.imagen_url || '';
    if (!mainImg && extraImgs.length > 0) {
      mainImg = extraImgs[0].url;
    }
    const extraImgsEncoded = extraImgs.map(img => encodeExtraImage(img.url, img.ref));
    const { error } = await supabase.from('productos').update({
      nombre: editingProduct.nombre,
      descripcion: editingProduct.descripcion,
      precio: editingProduct.precio,
      precio_por_mayor: editingProduct.precio_por_mayor || null,
      precio_50_unidades: editingProduct.precio_50_unidades || null,
      categoria: editingProduct.categoria,
      subcategoria: editingProduct.subcategoria || null,
      imagen_url: mainImg,
      imagenes_extra: extraImgsEncoded,
      video_url: editingProduct.video_url,
      tallas: editingProduct.tallas,
      estampados: editingProduct.estampados || null,
      stock: editingProduct.stock
    }).eq('id', editingProduct.id);
    setLoading(false);
    if (error) showToast('Error al actualizar', 'error');
    else { showToast('Producto actualizado ✓'); setEditingProduct(null); cargarDatos(); }
  };

  const handleEditMainImgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;
    setLoading(true);
    try {
      const compFile = await compressImage(file);
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${compFile.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('archivos').upload(fileName, compFile);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
      setEditingProduct({ ...editingProduct, imagen_url: data.publicUrl });
      showToast('Foto principal actualizada ✓');
    } catch { showToast('Error al subir foto', 'error'); }
    finally { setLoading(false); }
  };

  const handleEditExtraUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setEditUploadingIdx(idx);
    try {
      const uploadedData: { url: string, ref: string }[] = [];
      for (const file of files) {
        const compFile = await compressImage(file);
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${compFile.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage.from('archivos').upload(fileName, compFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
        const originalName = file.name.split('.').slice(0, -1).join('.').toUpperCase();
        uploadedData.push({ url: data.publicUrl, ref: originalName });
      }
      setEditExtraImages(prev => {
        const next = [...prev];
        next.splice(idx, 1, ...uploadedData);
        return next;
      });
      showToast(`${uploadedData.length} foto(s) extra subida(s) ✓`);
    } catch { showToast('Error al subir foto extra', 'error'); }
    finally { setEditUploadingIdx(null); }
  };

  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subcatNombre.trim() || !subcatParentId) {
      showToast('Completa el nombre y selecciona la categoría padre', 'error');
      return;
    }
    setLoading(true);
    const slug = subcatSlug.trim() || subcatNombre.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');
    const { error } = await supabase.from('subcategorias').insert([
      { nombre: subcatNombre.trim(), slug, categoria_id: subcatParentId, tenant_id: getTenantId() }
    ]);
    setLoading(false);
    if (error) {
      showToast('Error: ' + error.message, 'error');
    } else {
      setSubcatNombre('');
      setSubcatSlug('');
      cargarDatos();
      showToast('Subcategoría creada ✓');
    }
  };

  const handleDeleteSubcategory = async (id: string) => {
    if (!window.confirm('¿Eliminar esta subcategoría?')) return;
    const { error } = await supabase.from('subcategorias').delete().eq('id', id);
    if (!error) {
      cargarDatos();
      showToast('Subcategoría eliminada');
    } else {
      showToast('Error al eliminar', 'error');
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setLoading(true);
    const { error } = await supabase.from('categorias').update({
      nombre: editingCategory.nombre,
      slug: editingCategory.slug,
      icono: editingCategory.icono,
      color: editingCategory.color,
      imagen_url: editingCategory.imagen_url
    }).eq('id', editingCategory.id);
    setLoading(false);
    if (error) {
      showToast('Error al actualizar: ' + error.message, 'error');
    } else {
      showToast('Categoría actualizada ✓');
      setEditingCategory(null);
      cargarDatos();
    }
  };

  const handleUpdateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubcategory) return;
    setLoading(true);
    const { error } = await supabase.from('subcategorias').update({
      nombre: editingSubcategory.nombre,
      slug: editingSubcategory.slug,
      categoria_id: editingSubcategory.categoria_id
    }).eq('id', editingSubcategory.id);
    setLoading(false);
    if (error) {
      showToast('Error al actualizar: ' + error.message, 'error');
    } else {
      showToast('Subcategoría actualizada ✓');
      setEditingSubcategory(null);
      cargarDatos();
    }
  };

  // --- DUPLICATE CLEANUP & WIPE METHODS ---
  const getDuplicados = useMemo(() => {
    const counts: Record<string, Producto[]> = {};
    productos.forEach(p => {
      const nameKey = (p.nombre || '').toLowerCase().trim();
      if (!counts[nameKey]) counts[nameKey] = [];
      counts[nameKey].push(p);
    });
    
    return Object.entries(counts)
      .filter(([_, group]) => group.length > 1)
      .map(([_, group]) => ({
        nombre: group[0].nombre,
        count: group.length,
        items: group
      }));
  }, [productos]);

  const filteredPedidos = useMemo(() => {
    let result = [...pedidos];

    if (orderSearchQuery) {
        const q = orderSearchQuery.toLowerCase().trim();
        result = result.filter(p => 
          (p.cliente_nombre || '').toLowerCase().includes(q) ||
          (p.cliente_telefono || '').toLowerCase().includes(q) ||
          (p.ciudad || '').toLowerCase().includes(q) ||
          (p.direccion || '').toLowerCase().includes(q)
        ).sort((a, b) => {
          const aName = (a.cliente_nombre || '').toLowerCase();
          const bName = (b.cliente_nombre || '').toLowerCase();
          const aStarts = aName.startsWith(q);
          const bStarts = bName.startsWith(q);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return 0;
        });
      }

    if (orderFilterStatus !== 'todos') {
      if (orderFilterStatus === 'comprobante') {
        result = result.filter(p => !!p.pantallazo_url && p.estado !== 'completado');
      } else if (orderFilterStatus === 'esperando_pago') {
        result = result.filter(p => !p.pantallazo_url && p.estado !== 'completado');
      } else if (orderFilterStatus === 'exitosas') {
        result = result.filter(p => p.estado === 'completado');
      }
    }

    if (orderFilterOrigin !== 'todos') {
      result = result.filter(p => {
        const o = p.origen || 'catalogo';
        return o === orderFilterOrigin;
      });
    }

    if ((role === 'asesor' || role === 'mayorista') && loggedAsesorPhone) {
      result = result.filter(p => {
        if (!p.linea_whatsapp) return false;
        const cleanOrder = p.linea_whatsapp.replace(/\D/g, '');
        const orderPhone = cleanOrder.length === 12 && cleanOrder.startsWith('57') ? cleanOrder.substring(2) : cleanOrder;
        const advisorPhones = loggedAsesorPhone.split(',').map(phone => {
          const clean = phone.replace(/\D/g, '');
          return clean.length === 12 && clean.startsWith('57') ? clean.substring(2) : clean;
        }).filter(Boolean);
        return advisorPhones.includes(orderPhone);
      });
    } else if (orderFilterAsesor !== 'todos') {
      result = result.filter(p => {
        const orderPhone = p.linea_whatsapp?.replace(/\D/g, '');
        const filterPhones = orderFilterAsesor.split(',').map(phone => phone.replace(/\D/g, '')).filter(Boolean);
        return orderPhone && filterPhones.includes(orderPhone);
      });
    }

    if (orderFilterDate) {
      result = result.filter(p => {
        const d = new Date(p.created_at).toISOString().split('T')[0];
        return d === orderFilterDate;
      });
    }

    result.sort((a, b) => {
      if (orderSortBy === 'date_desc') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (orderSortBy === 'date_asc') {
        return new Date(a.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (orderSortBy === 'total_desc') {
        return b.total - a.total;
      }
      if (orderSortBy === 'total_asc') {
        return a.total - b.total;
      }
      return 0;
    });

    return result;
  }, [pedidos, orderSearchQuery, orderFilterStatus, orderFilterOrigin, orderFilterAsesor, orderFilterDate, orderSortBy, role, loggedAsesorPhone]);

  // Dashboard Calculations
  const stats = useMemo(() => {
    // 1. Total Ventas ($ COP de pedidos completados)
    const completados = pedidos.filter(p => p.estado === 'completado');
    const totalVentasVal = completados.reduce((sum, p) => sum + (p.total || 0), 0);

    // 2. Pedidos no resueltos (pendientes o atendidos)
    const noResueltos = pedidos.filter(p => p.estado === 'pendiente' || p.estado === 'atendido' || !p.estado);

    // 3. Ventas por origen (POS vs Catálogo)
    const posOrders = pedidos.filter(p => p.origen === 'pos');
    const catalogOrders = pedidos.filter(p => p.origen === 'catalogo' || !p.origen);

    // 4. Pedidos por ciudad (agrupados)
    const cityCounts: { [city: string]: number } = {};
    pedidos.forEach(p => {
      if (p.ciudad) {
        const c = p.ciudad.trim().toUpperCase();
        cityCounts[c] = (cityCounts[c] || 0) + 1;
      }
    });
    const sortedCities = Object.entries(cityCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 5. Línea/Asesor que más ha vendido (completados)
    const advisorSales: { [advisorIdOrPos: string]: { name: string; total: number; phone: string } } = {};
    completados.forEach(p => {
      const phone = p.linea_whatsapp || 'pos';
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone === 'pos' || !cleanPhone) {
        advisorSales['pos'] = {
          name: 'POS',
          total: (advisorSales['pos']?.total || 0) + p.total,
          phone: 'pos'
        };
      } else {
        const match = asesores.find(a => {
          const phones = (a.telefono || '').split(',').map(ph => ph.replace(/\D/g, '')).filter(Boolean);
          return phones.includes(cleanPhone);
        });
        if (match) {
          advisorSales[match.id] = {
            name: match.nombre,
            total: (advisorSales[match.id]?.total || 0) + p.total,
            phone: match.telefono
          };
        } else {
          advisorSales[phone] = {
            name: phone,
            total: (advisorSales[phone]?.total || 0) + p.total,
            phone: phone
          };
        }
      }
    });
    const bestAdvisor = Object.entries(advisorSales)
      .map(([id, info]) => ({ id, ...info }))
      .sort((a, b) => b.total - a.total)[0] || { id: 'pos', name: 'POS', total: 0, phone: 'pos' };

    // 6. Mejor hora del día
    const hourCounts: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourCounts[i] = 0;
    completados.forEach(p => { const h = new Date(p.created_at).getHours(); hourCounts[h] = (hourCounts[h] || 0) + 1; });
    const bestHourEntry = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    const bestHour = { hour: Number(bestHourEntry[0]), count: Number(bestHourEntry[1]) };
    const hourLabels = [
      '12:00 AM', '1:00 AM', '2:00 AM', '3:00 AM', '4:00 AM', '5:00 AM', '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
      '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM'
    ];

    // 7. Mejor día de la semana
    const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const dayCounts: Record<number, number> = {0:0,1:0,2:0,3:0,4:0,5:0,6:0};
    completados.forEach(p => { const d = new Date(p.created_at).getDay(); dayCounts[d] = (dayCounts[d] || 0) + 1; });
    const bestDayEntry = Object.entries(dayCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    const bestDay = { day: Number(bestDayEntry[0]), name: dayNames[Number(bestDayEntry[0])], count: Number(bestDayEntry[1]) };

    // 8. Ranking de asesores por ventas
    const advisorRanking = Object.entries(advisorSales)
      .map(([id, info]) => ({ id, ...info }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // 8a. Desempeño separado de Asesores y Mayoristas
    const asesoresSales: { [id: string]: { total: number; ordersCount: number } } = {};
    const mayoristasSales: { [id: string]: { total: number; ordersCount: number } } = {};

    completados.forEach(p => {
      const phone = p.linea_whatsapp || 'pos';
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone !== 'pos' && cleanPhone) {
        const matchedAsesor = asesores.find(a => {
          const phones = (a.telefono || '').split(',').map(ph => ph.replace(/\D/g, '')).filter(Boolean);
          return phones.includes(cleanPhone);
        });
        if (matchedAsesor) {
          if (!asesoresSales[matchedAsesor.id]) asesoresSales[matchedAsesor.id] = { total: 0, ordersCount: 0 };
          asesoresSales[matchedAsesor.id].total += p.total || 0;
          asesoresSales[matchedAsesor.id].ordersCount += 1;
        } else {
          const matchedMayorista = mayoristas.find(m => {
            const phones = (m.telefono || '').split(',').map(ph => ph.replace(/\D/g, '')).filter(Boolean);
            return phones.includes(cleanPhone);
          });
          if (matchedMayorista) {
            if (!mayoristasSales[matchedMayorista.id]) mayoristasSales[matchedMayorista.id] = { total: 0, ordersCount: 0 };
            mayoristasSales[matchedMayorista.id].total += p.total || 0;
            mayoristasSales[matchedMayorista.id].ordersCount += 1;
          }
        }
      }
    });

    const asesoresRanking = asesores
      .map(a => {
        const saleInfo = asesoresSales[a.id] || { total: 0, ordersCount: 0 };
        return {
          id: a.id,
          nombre: a.nombre,
          foto_url: a.foto_url,
          telefono: a.telefono,
          total: saleInfo.total,
          ordersCount: saleInfo.ordersCount
        };
      })
      .sort((a, b) => b.total - a.total);

    const mayoristasRanking = mayoristas
      .map(m => {
        const saleInfo = mayoristasSales[m.id] || { total: 0, ordersCount: 0 };
        return {
          id: m.id,
          nombre: m.nombre,
          foto_url: m.foto_url,
          telefono: m.telefono,
          total: saleInfo.total,
          ordersCount: saleInfo.ordersCount
        };
      })
      .sort((a, b) => b.total - a.total);

    // 8b. Productos más vendidos (completados)
    const productSales: { [prodIdOrName: string]: { id: string; nombre: string; cantidad: number; total: number; imagen_url?: string } } = {};
    completados.forEach(p => {
      if (Array.isArray(p.productos)) {
        p.productos.forEach((prod: any) => {
          const key = prod.id || prod.nombre;
          if (key) {
            if (!productSales[key]) {
              const fullProdObj = productos.find(pr => pr.id === prod.id || pr.nombre === prod.nombre);
              productSales[key] = {
                id: prod.id || '',
                nombre: prod.nombre,
                cantidad: 0,
                total: 0,
                imagen_url: fullProdObj?.imagen_url || ''
              };
            }
            productSales[key].cantidad += (prod.cantidad || 1);
            productSales[key].total += (prod.cantidad || 1) * (prod.precio || 0);
          }
        });
      }
    });

    const topSellingProducts = Object.values(productSales)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    // 9. Consejo del día (rotativo por fecha)
    const allTips = [
      { icon: '📱', text: 'Responde en menos de 5 minutos: los clientes que reciben respuesta rápida compran 3x más.' },
      { icon: '📸', text: 'Comparte 3 fotos del producto desde diferentes ángulos. Las imágenes claras reducen las dudas y aumentan el cierre.' },
      { icon: '⭐', text: 'Pide a cada cliente satisfecho que te recomiende con un conocido. El voz a voz es tu mejor publicidad.' },
      { icon: '🎁', text: 'Ofrece un pequeño regalo o envío gratis por encima de cierto monto para aumentar el ticket promedio.' },
      { icon: '📅', text: `Las ventas pico son los ${bestDay.count > 0 ? bestDay.name : 'fines de semana'}. Planifica más stock and asesoras disponibles ese día.` },
      { icon: '⏰', text: `La hora de oro es a las ${bestHour.count > 0 ? hourLabels[bestHour.hour] : 'tarde'}. Programa tus publicaciones en redes en ese horario.` },
      { icon: '💬', text: 'Un seguimiento después de 24h a los carros abandonados recupera hasta un 20% de ventas perdidas.' },
      { icon: '📊', text: 'Revisa tu analítica semanal. Los datos te dicen qué productos y asesoras funcionan mejor.' },
      { icon: '📦', text: 'Mantén tu catálogo actualizado. Los productos sin stock generan frustración y pérdida de clientes.' },
      { icon: '📝', text: 'Personaliza el mensaje de WhatsApp. Un saludo con el nombre del cliente aumenta la tasa de respuesta.' },
    ];
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const todayTips = Array.from({ length: 8 }, (_, i) => allTips[(dayOfYear + i) % allTips.length]);

    return {
      totalVentasVal,
      noResueltosCount: noResueltos.length,
      posCount: posOrders.length,
      catalogCount: catalogOrders.length,
      sortedCities,
      bestAdvisorPhone: bestAdvisor.phone,
      bestAdvisorTotal: bestAdvisor.total,
      bestHour,
      bestDay,
      advisorRanking,
      todayTips,
      hourLabels,
      hourCounts,
      dayCounts,
      dayNames,
      asesoresRanking,
      mayoristasRanking,
      topSellingProducts,
    };
  }, [pedidos, asesores, productos]);

  const getAdvisorStats = (a: any) => {
    if (!a) return null;
    const aPhones = (a.telefono || '').split(',').map((p: string) => p.replace(/\D/g, '')).filter(Boolean);
    const aPedidos = pedidos.filter(p => {
      const op = (p.linea_whatsapp || '').replace(/\D/g, '');
      return aPhones.includes(op);
    });
    const aLeads = leads.filter(l => {
      const leadPhone = l.linea_whatsapp?.replace(/\D/g, '');
      const isAssigned = leadPhone && aPhones.includes(leadPhone);
      if (!isAssigned) return false;
      if (l.estado === 'completado') return false;
      const cleanLeadPhone = (l.telefono || '').replace(/\D/g, '');
      if (cleanLeadPhone) {
        const hasOrder = pedidos.some(p => (p.cliente_telefono || '').replace(/\D/g, '') === cleanLeadPhone);
        if (hasOrder) return false;
      }
      return true;
    });
    const aCompletados = aPedidos.filter(p => p.estado === 'completado');
    const aPendientes = aPedidos.filter(p => p.estado === 'pendiente' || p.estado === 'interesado');
    const totalVentas = aCompletados.reduce((s, p) => s + (p.total || 0), 0);
    const ticketProm = aCompletados.length > 0 ? Math.round(totalVentas / aCompletados.length) : 0;

    const horasMap: Record<number, number> = {};
    for (let i = 0; i < 24; i++) horasMap[i] = 0;
    aCompletados.forEach(p => { const h = new Date(p.created_at).getHours(); horasMap[h] = (horasMap[h] || 0) + 1; });
    const maxHoraCount = Math.max(1, ...Object.values(horasMap));
    const bestHour = (Object.entries(horasMap) as [string, number][]).reduce((best, [h, c]) => c > best[1] ? [h, c] : best, ['0', 0]);

    const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const dayCounts: Record<number, number> = {0:0,1:0,2:0,3:0,4:0,5:0,6:0};
    aCompletados.forEach(p => { const d = new Date(p.created_at).getDay(); dayCounts[d] = (dayCounts[d] || 0) + 1; });
    const bestDayEntry = (Object.entries(dayCounts) as [string, number][]).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    const bestDay = { day: Number(bestDayEntry[0]), name: dayNames[Number(bestDayEntry[0])], count: Number(bestDayEntry[1]) };

    const productSales: { [prodIdOrName: string]: { id: string; nombre: string; cantidad: number; total: number; imagen_url?: string } } = {};
    aCompletados.forEach(p => {
      if (Array.isArray(p.productos)) {
        p.productos.forEach((prod: any) => {
          const key = prod.id || prod.nombre;
          if (key) {
            if (!productSales[key]) {
              const fullProdObj = productos.find(pr => pr.id === prod.id || pr.nombre === prod.nombre);
              productSales[key] = {
                id: prod.id || '',
                nombre: prod.nombre,
                cantidad: 0,
                total: 0,
                imagen_url: fullProdObj?.imagen_url || ''
              };
            }
            productSales[key].cantidad += (prod.cantidad || 1);
            productSales[key].total += (prod.cantidad || 1) * (prod.precio || 0);
          }
        });
      }
    });
    const topSellingProducts = Object.values(productSales)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    const monthsMap: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthsMap[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`] = 0;
    }
    aCompletados.forEach(p => {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (key in monthsMap) monthsMap[key] = (monthsMap[key] || 0) + 1;
    });
    const monthEntries = Object.entries(monthsMap);
    const maxMonthCount = Math.max(1, ...monthEntries.map(([, c]) => c));

    return {
      aPedidos,
      aLeads,
      aCompletados,
      aPendientes,
      totalVentas,
      ticketProm,
      horasMap,
      maxHoraCount,
      bestHour,
      dayCounts,
      bestDay,
      topSellingProducts,
      monthEntries,
      maxMonthCount
    };
  };

  const renderAdvisorStatsView = (advStats: any) => {
    if (!advStats) return null;
    const {
      aPedidos, aLeads, aCompletados, aPendientes, totalVentas, ticketProm,
      horasMap, maxHoraCount, bestHour, dayCounts, bestDay, topSellingProducts,
      monthEntries, maxMonthCount
    } = advStats;

    const primaryColor = configuracion?.color_primario || '#6366f1';
    const orderOfWeek = [1, 2, 3, 4, 5, 6, 0]; // Lun, Mar, Mie, Jue, Vie, Sab, Dom
    const shortDayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

    const horaLabels = [
      '12:00 AM', '1:00 AM', '2:00 AM', '3:00 AM', '4:00 AM', '5:00 AM', '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
      '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM'
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
          {[
            { label: 'Ventas Completadas', value: aCompletados.length, icon: '✅', color: '#10b981', sub: `$${totalVentas.toLocaleString()} total` },
            { label: 'Pendientes de Pago', value: aPendientes.length, icon: '⏳', color: '#eab308', sub: 'Esperando comprobante' },
            { label: 'Abandonos', value: aLeads.length, icon: '🔴', color: '#ef4444', sub: 'Borradores / no interesados' },
            { label: 'Ticket Promedio', value: `$${ticketProm.toLocaleString()}`, icon: '💰', color: primaryColor, sub: 'Por venta completada' },
          ].map((kpi, i) => (
            <div key={i} style={{ background: '#f8fafc', borderRadius: '14px', padding: '1rem', border: `2px solid ${kpi.color}22`, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: '-8px', top: '-8px', fontSize: '3rem', opacity: 0.1 }}>{kpi.icon}</div>
              <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>{kpi.label}</div>
              <div style={{ fontSize: '1.7rem', fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.3rem' }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Row for Hourly and Weekly charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          
          {/* Horario de Mayor Venta */}
          <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>⏰ Horario de Mayor Venta</h4>
            <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.8rem' }}>
              {aCompletados.length > 0 ? (
                <>Pico máximo: <strong>{horaLabels[Number(bestHour[0])]}</strong> ({bestHour[1]} {bestHour[1] === 1 ? 'venta' : 'ventas'})</>
              ) : (
                'Sin datos suficientes'
              )}
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '90px', marginTop: '1.2rem' }}>
              {(Object.entries(horasMap) as [string, number][]).map(([h, count]) => {
                const pct = (count / maxHoraCount) * 100;
                const isWarm = Number(h) >= 8 && Number(h) <= 20;
                const isBest = Number(h) === Number(bestHour[0]) && count > 0;
                return (
                  <div key={h} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '11px' }} title={`${horaLabels[Number(h)]}: ${count} ${count === 1 ? 'venta' : 'ventas'}`}>
                    <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '3px 3px 0 0', height: '70px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: `${pct}%`, background: isBest ? 'linear-gradient(180deg,#fbbf24,#f59e0b)' : isWarm ? `${primaryColor}bb` : `${primaryColor}44`, borderRadius: '3px 3px 0 0', transition: 'height 0.8s ease' }} />
                    </div>
                    {Number(h) % 4 === 0 && (
                      <span style={{ fontSize: '0.55rem', color: '#94a3b8', marginTop: '2px', fontWeight: 600 }}>
                        {Number(h) === 0 ? '12 AM' : Number(h) === 12 ? '12 PM' : Number(h) > 12 ? `${Number(h) - 12} PM` : `${h} AM`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ventas por Día de la Semana */}
          <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>📅 Ventas por Día de la Semana</h4>
            <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.8rem' }}>
              {aCompletados.length > 0 && bestDay.count > 0 ? (
                <>Día más fuerte: <strong>{bestDay.name}</strong> ({bestDay.count} {bestDay.count === 1 ? 'venta' : 'ventas'})</>
              ) : (
                'Sin datos suficientes'
              )}
            </p>
            {(() => {
              const maxDayCount = Math.max(1, ...Object.values(dayCounts) as number[]);
              return (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '90px', marginTop: '1.2rem', padding: '0 0.5rem' }}>
                  {orderOfWeek.map((dayIdx) => {
                    const count = dayCounts[dayIdx] || 0;
                    const pct = (count / maxDayCount) * 100;
                    const isBest = dayIdx === bestDay.day && count > 0;
                    return (
                      <div key={dayIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }} title={`${dayNames[dayIdx]}: ${count} ${count === 1 ? 'venta' : 'ventas'}`}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: isBest ? '#f59e0b' : '#475569', marginBottom: '2px' }}>
                          {count > 0 ? count : ''}
                        </span>
                        <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '4px 4px 0 0', height: '55px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                          <div style={{ width: '100%', height: `${pct}%`, background: isBest ? 'linear-gradient(180deg,#fbbf24,#f59e0b)' : `${primaryColor}cc`, borderRadius: '4px 4px 0 0', transition: 'height 0.8s ease' }} />
                        </div>
                        <span style={{ fontSize: '0.7rem', color: isBest ? '#f59e0b' : '#64748b', marginTop: '4px', fontWeight: 600 }}>
                          {shortDayNames[dayIdx]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

        </div>

        {/* Row for Products and Months */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', minWidth: 0 }}>
          
          {/* Productos Más Vendidos */}
          <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>🛍️ Productos Más Vendidos</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {topSellingProducts.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', margin: '2rem 0' }}>Sin productos vendidos todavía</p>
              ) : (
                topSellingProducts.map((prod: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0.5rem', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {prod.imagen_url ? (
                        <img src={prod.imagen_url} alt={prod.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '1rem' }}>👕</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prod.nombre}</h4>
                      <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                        Total: <strong>${prod.total.toLocaleString()} COP</strong>
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', background: '#dcfce7', color: '#15803d', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800 }}>
                        {prod.cantidad} {prod.cantidad === 1 ? 'ud' : 'uds'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Histórico 6 meses / Distribución Pedidos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>📈 Ventas Últimos 6 Meses</h4>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '60px' }}>
                {monthEntries.map(([key, count]: any, idx: number) => {
                  const pct = (count / maxMonthCount) * 100;
                  const mo = parseInt(key.split('-')[1]) - 1;
                  const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                  return (
                    <div key={key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <span style={{ fontSize: '0.65rem', color: '#0f172a', fontWeight: 700 }}>{count > 0 ? count : ''}</span>
                      <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '4px 4px 0 0', height: '40px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                        <div style={{ width: '100%', height: `${pct}%`, background: `linear-gradient(180deg,${primaryColor},${primaryColor}88)`, borderRadius: '4px 4px 0 0', transition: `height ${0.4 + idx * 0.1}s ease` }} />
                      </div>
                      <span style={{ fontSize: '0.6rem', color: '#64748b' }}>{monthNames[mo]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '1rem 1.25rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>🥧 Distribución de Pedidos</h4>
              {aPedidos.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', margin: 0 }}>Sin pedidos</p>
              ) : (() => {
                const total = aPedidos.length;
                const segs = [
                  { label: 'Completados', count: aCompletados.length, color: '#10b981' },
                  { label: 'Pendientes', count: aPendientes.length, color: '#eab308' },
                  { label: 'Abandonos', count: aLeads.length, color: '#ef4444' },
                ];
                const r = 26, cx = 35, cy = 30, stroke = 10;
                let offset = 0;
                const circ = 2 * Math.PI * r;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <svg width="70" height="60" viewBox="0 0 70 60">
                      {segs.map((seg, i) => {
                        const dash = (seg.count / total) * circ;
                        const rotate = (offset / total) * 360 - 90;
                        offset += seg.count;
                        return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={stroke} strokeDasharray={`${dash} ${circ - dash}`} transform={`rotate(${rotate} ${cx} ${cy})`} />;
                      })}
                      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '10px', fontWeight: 800, fill: '#0f172a' }}>{total}</text>
                    </svg>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {segs.map((seg, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: seg.color }} />
                          <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>{seg.label}: <strong style={{ color: '#0f172a' }}>{seg.count}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

        </div>
      </div>
    );
  };

  const leadsFiltrados = useMemo(() => {
    let temp = leads.filter(l => {
      if (l.estado === 'completado') return false;
      const cleanLeadPhone = (l.telefono || '').replace(/\D/g, '');
      if (!cleanLeadPhone) return true;
      
      // Solo consideramos que tiene pedido si existe un pedido creado después del lead (o hasta 5 minutos antes para tolerar retrasos)
      const hasOrder = pedidos.some(p => {
        if ((p.cliente_telefono || '').replace(/\D/g, '') !== cleanLeadPhone) return false;
        const orderTime = new Date(p.created_at).getTime();
        const leadTime = new Date(l.created_at).getTime();
        return orderTime >= leadTime - 5 * 60 * 1000;
      });
      
      return !hasOrder;
    });

    if (orderSearchQuery) {
        const q = orderSearchQuery.toLowerCase().trim();
        temp = temp.filter(l => 
          (l.nombre || '').toLowerCase().includes(q) ||
          (l.telefono || '').toLowerCase().includes(q) ||
          (l.ciudad || '').toLowerCase().includes(q)
        ).sort((a, b) => {
          const aName = (a.nombre || '').toLowerCase();
          const bName = (b.nombre || '').toLowerCase();
          const aStarts = aName.startsWith(q);
          const bStarts = bName.startsWith(q);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return 0;
        });
      }
    if (orderFilterDate) {
      temp = temp.filter(l => l.created_at.startsWith(orderFilterDate));
    }
    if ((role === 'asesor' || role === 'mayorista') && loggedAsesorPhone) {
      temp = temp.filter(l => {
        if (!l.linea_whatsapp) return false;
        const cleanLead = l.linea_whatsapp.replace(/\D/g, '');
        const leadPhone = cleanLead.length === 12 && cleanLead.startsWith('57') ? cleanLead.substring(2) : cleanLead;
        const advisorPhones = loggedAsesorPhone.split(',').map(phone => {
          const clean = phone.replace(/\D/g, '');
          return clean.length === 12 && clean.startsWith('57') ? clean.substring(2) : clean;
        }).filter(Boolean);
        return advisorPhones.includes(leadPhone);
      });
    } else if (orderFilterAsesor !== 'todos') {
      temp = temp.filter(l => {
        const leadPhone = l.linea_whatsapp?.replace(/\D/g, '');
        const filterPhones = orderFilterAsesor.split(',').map(phone => phone.replace(/\D/g, '')).filter(Boolean);
        return leadPhone && filterPhones.includes(leadPhone);
      });
    }
    return temp;
  }, [leads, pedidos, orderSearchQuery, orderFilterDate, role, loggedAsesorPhone, orderFilterAsesor]);

  const pendientePagoFiltrados = useMemo(() => {
    return filteredPedidos.filter(p => (p.estado === 'pendiente' || p.estado === 'atendido' || !p.estado) && !p.pantallazo_url);
  }, [filteredPedidos]);

  const comprobarPagosFiltrados = useMemo(() => {
    return filteredPedidos.filter(p => (p.estado === 'pendiente' || p.estado === 'atendido' || !p.estado) && p.pantallazo_url);
  }, [filteredPedidos]);

  const clientesFiltrados = useMemo(() => {
    return filteredPedidos.filter(p => p.estado === 'completado');
  }, [filteredPedidos]);

  const filteredClientes = useMemo(() => {
    let list = [...clientes];
    if (clienteSearchQuery.trim()) {
      const q = clienteSearchQuery.toLowerCase();
      list = list.filter(c => 
        (c.nombre || '').toLowerCase().includes(q) ||
        (c.telefono || '').includes(q)
      );
    }
    return list;
  }, [clientes, clienteSearchQuery]);

  const activeNotifications = useMemo(() => {
    if (role === 'asesor' && currentAsesor) {
      const advStats = getAdvisorStats(currentAsesor);
      return getAdvisorNotifications(currentAsesor, advStats, false);
    }
    if (role === 'mayorista' && currentMayorista) {
      const advStats = getAdvisorStats(currentMayorista);
      return getAdvisorNotifications(currentMayorista, advStats, true);
    }
    return [];
  }, [role, currentAsesor, currentMayorista, leads, pedidos]);

  const activeNotificationsCount = activeNotifications.length;

  const [viewingAdvisorAlerts, setViewingAdvisorAlerts] = useState<{ advisor: any; alerts: any[] } | null>(null);

  const filteredAsesores = useMemo(() => {
    let list = asesores; // asesores table only contains asesores
    if (asesorSearchQuery.trim()) {
      const q = asesorSearchQuery.toLowerCase();
      list = list.filter(a => 
        (a.nombre || '').toLowerCase().includes(q) ||
        (a.telefono || '').includes(q)
      );
    }
    return list;
  }, [asesores, asesorSearchQuery]);

  const filteredMayoristas = useMemo(() => {
    let list = mayoristas;
    if (mayoristaBuscador.trim()) {
      const q = mayoristaBuscador.toLowerCase();
      list = list.filter(m =>
        (m.nombre || '').toLowerCase().includes(q) ||
        (m.telefono || '').includes(q)
      );
    }
    return list;
  }, [mayoristas, mayoristaBuscador]);

  async function handleEliminarDuplicados(nombre: string) {
    try {
      setCleaningDuplicates(true);
      
      // Encontrar todos los productos con este nombre
      const match = productos.filter(p => (p.nombre || '').toLowerCase().trim() === nombre.toLowerCase().trim());
      if (match.length <= 1) return;
      
      // Conservar el primero y borrar el resto
      const toKeep = match[0];
      const toDelete = match.slice(1);
      const deleteIds = toDelete.map(p => p.id);
      
      const { error } = await supabase
        .from('productos')
        .delete()
        .in('id', deleteIds);
        
      if (error) throw error;
      
      // Actualizar estado local
      setProductos(prev => prev.filter(p => !deleteIds.includes(p.id)));
      showToast(`Duplicados eliminados. Se conservó 1 versión de "${toKeep.nombre}".`);
    } catch (err: any) {
      console.error(err);
      showToast('Error al eliminar duplicados', 'error');
    } finally {
      setCleaningDuplicates(false);
    }
  }

  async function handleCrearMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoMaterialTitulo.trim() || !nuevoMaterialUrl.trim()) {
      showToast('Título y archivo son obligatorios.', 'error');
      return;
    }
    setLoading(true);
    try {
      const tenant = getTenantId();
      const { data, error } = await supabase
        .from('material_apoyo')
        .insert({
          tenant_id: tenant,
          titulo: nuevoMaterialTitulo.trim(),
          descripcion: nuevoMaterialDesc.trim() || null,
          tipo: nuevoMaterialTipo,
          url: nuevoMaterialUrl,
          campana: nuevoMaterialCampana.trim() || null
        })
        .select()
        .single();

      if (error) throw error;

      setMateriales([data, ...materiales]);
      setNuevoMaterialTitulo('');
      setNuevoMaterialDesc('');
      setNuevoMaterialUrl('');
      setNuevoMaterialCampana('');
      showToast('Material de apoyo agregado ✓', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Error registrando material: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleEliminarMaterial(id: string) {
    if (!window.confirm('¿Seguro que deseas eliminar este material de apoyo?')) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('material_apoyo')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMateriales(materiales.filter(m => m.id !== id));
      showToast('Material de apoyo eliminado ✓', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Error eliminando material: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCrearAsesor(e: React.FormEvent) {
    e.preventDefault();
    const activeTelefonos = nuevoAsesorTelefonos.map(t => t.trim()).filter(Boolean);
    if (!nuevoAsesorNombre.trim() || activeTelefonos.length === 0) {
      showToast('Por favor, ingresa el nombre y al menos un teléfono para el asesor.', 'error');
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = activeTelefonos.map(num => num.replace(/\D/g, '')).filter(Boolean).join(',');
      const tenant = getTenantId();

      const { data, error } = await supabase
        .from('asesores')
        .insert({
          nombre: nuevoAsesorNombre.trim(),
          telefono: cleanPhone,
          pin: nuevoAsesorPin.trim() || '1234',
          foto_url: nuevoAsesorFotoUrl.trim() || null,
          tenant_id: tenant
        })
        .select()
        .single();

      if (error) throw error;

      setAsesores(prev => [data, ...prev]);
      setNuevoAsesorNombre('');
      setNuevoAsesorTelefonos(['']);
      setNuevoAsesorFotoUrl('');
      setNuevoAsesorPin(Math.floor(1000 + Math.random() * 9000).toString());
      showToast('Asesor creado exitosamente ✓', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Error al crear asesor: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleGuardarAsesorEdicion(id: string) {
    const activeTelefonos = editingAsesorTelefonos.map(t => t.trim()).filter(Boolean);
    if (!editingAsesorNombre.trim() || activeTelefonos.length === 0 || !editingAsesorPin.trim()) {
      showToast('Por favor completa todos los campos del asesor y agrega al menos un teléfono.', 'error');
      return;
    }
    setLoading(true);
    try {
      const cleanPhone = activeTelefonos.map(num => num.replace(/\D/g, '')).filter(Boolean).join(',');
      const { error } = await supabase
        .from('asesores')
        .update({
          nombre: editingAsesorNombre.trim(),
          telefono: cleanPhone,
          pin: editingAsesorPin.trim(),
          foto_url: editingAsesorFotoUrl.trim() || null
        })
        .eq('id', id);

      if (error) throw error;

      setAsesores(prev => prev.map(item => item.id === id ? { ...item, nombre: editingAsesorNombre.trim(), telefono: cleanPhone, pin: editingAsesorPin.trim(), foto_url: editingAsesorFotoUrl.trim() || undefined } : item));
      setEditingAsesorId(null);
      showToast('Cambios guardados ✓', 'success');
      cargarDatos();
    } catch (err: any) {
      console.error(err);
      showToast('Error al guardar cambios: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleEliminarAsesor(id: string) {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este asesor?')) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('asesores')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAsesores(prev => prev.filter(a => a.id !== id));
      showToast('Asesor eliminado ✓', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Error al eliminar asesor: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleEliminarMayorista(id: string) {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este mayorista?')) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('mayoristas')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setMayoristas(prev => prev.filter(m => m.id !== id));
      showToast('Mayorista eliminado ✓', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Error al eliminar mayorista: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleEliminarPorFecha() {
    if (!deleteDate) return;
    if (!window.confirm(`¿Estás seguro de que deseas eliminar TODOS los productos creados el día ${deleteDate}? Esta acción no se puede deshacer.`)) return;
    
    setLoading(true);
    try {
      const startOfDay = `${deleteDate}T00:00:00.000Z`;
      const endOfDay = `${deleteDate}T23:59:59.999Z`;
      
      const { data, error } = await supabase
        .from('productos')
        .delete()
        .eq('tenant_id', getTenantId())
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .select();
        
      if (error) {
        showToast('Error al eliminar: ' + error.message, 'error');
      } else {
        showToast(`Se eliminaron ${data?.length || 0} productos creados el ${deleteDate} ✓`);
        cargarDatos();
        setDeleteDate('');
      }
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleVaciarCatalogo() {
    if (wipeConfirmText !== 'ELIMINAR TODO') {
      showToast('Por favor escribe ELIMINAR TODO exactamente', 'error');
      return;
    }
    
    try {
      setWipingCatalog(true);
      const tenant = getTenantId();
      
      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('tenant_id', tenant);
        
      if (error) throw error;
      
      setProductos([]);
      setShowToolsModal(false);
      setWipeConfirmText('');
      showToast('El catálogo ha sido vaciado por completo.');
    } catch (err: any) {
      console.error(err);
      showToast('Error al vaciar el catálogo', 'error');
    } finally {
      setWipingCatalog(false);
    }
  }

  // --- PURGE PEDIDOS / CLIENTES ---
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeTargets, setPurgeTargets] = useState<{ pedidos: boolean; clientes: boolean; leads: boolean }>({ pedidos: false, clientes: false, leads: false });
  const [purgeEstado, setPurgeEstado] = useState<string>('todos');
  const [purgeDesde, setPurgeDesde] = useState('');
  const [purgeHasta, setPurgeHasta] = useState('');
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [purging, setPurging] = useState(false);
  const [purgePreview, setPurgePreview] = useState<{ pedidos: number; clientes: number; leads: number } | null>(null);

  async function calcularPurgePreview() {
    const tenant = getTenantId();
    let pCount = 0, cCount = 0, lCount = 0;
    try {
      if (purgeTargets.pedidos) {
        let q = supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant);
        if (purgeEstado !== 'todos') q = q.eq('estado', purgeEstado);
        if (purgeDesde) q = q.gte('created_at', purgeDesde);
        if (purgeHasta) q = q.lte('created_at', purgeHasta + 'T23:59:59');
        const { count } = await q;
        pCount = count || 0;
      }
      if (purgeTargets.clientes) {
        let q = supabase.from('clientes_exitosos').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant);
        if (purgeDesde) q = q.gte('created_at', purgeDesde);
        if (purgeHasta) q = q.lte('created_at', purgeHasta + 'T23:59:59');
        const { count } = await q;
        cCount = count || 0;
      }
      if (purgeTargets.leads) {
        let q = supabase.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant);
        if (purgeEstado !== 'todos') {
          const dbState = purgeEstado;
          q = q.eq('estado', dbState);
        }
        if (purgeDesde) q = q.gte('created_at', purgeDesde);
        if (purgeHasta) q = q.lte('created_at', purgeHasta + 'T23:59:59');
        const { count } = await q;
        lCount = count || 0;
      }
      setPurgePreview({ pedidos: pCount, clientes: cCount, leads: lCount });
    } catch (err: any) {
      showToast('Error calculando preview: ' + err.message, 'error');
    }
  }

  async function handlePurge() {
    if (purgeConfirmText !== 'PURGAR') {
      showToast('Escribe PURGAR exactamente para confirmar', 'error');
      return;
    }
    if (!purgeTargets.pedidos && !purgeTargets.clientes && !purgeTargets.leads) {
      showToast('Selecciona al menos una tabla a limpiar', 'error');
      return;
    }
    try {
      setPurging(true);
      const tenant = getTenantId();
      let totalEliminados = 0;

      if (purgeTargets.pedidos) {
        let q = supabase.from('pedidos').delete({ count: 'exact' }).eq('tenant_id', tenant);
        if (purgeEstado !== 'todos') q = q.eq('estado', purgeEstado);
        if (purgeDesde) q = q.gte('created_at', purgeDesde);
        if (purgeHasta) q = q.lte('created_at', purgeHasta + 'T23:59:59');
        const { error, count } = await q;
        if (error) throw error;
        totalEliminados += count || 0;
        setPedidos(prev => {
          let filtered = prev;
          if (purgeEstado !== 'todos') filtered = filtered.filter(p => p.estado !== purgeEstado);
          if (purgeDesde) filtered = filtered.filter(p => p.created_at >= purgeDesde);
          if (purgeHasta) filtered = filtered.filter(p => p.created_at <= purgeHasta + 'T23:59:59');
          return filtered;
        });
      }

      if (purgeTargets.clientes) {
        let q = supabase.from('clientes_exitosos').delete({ count: 'exact' }).eq('tenant_id', tenant);
        if (purgeDesde) q = q.gte('created_at', purgeDesde);
        if (purgeHasta) q = q.lte('created_at', purgeHasta + 'T23:59:59');
        const { error, count } = await q;
        if (error) throw error;
        totalEliminados += count || 0;
        setClientes([]);
      }

      if (purgeTargets.leads) {
        let q = supabase.from('leads').delete({ count: 'exact' }).eq('tenant_id', tenant);
        if (purgeEstado !== 'todos') {
          const dbState = purgeEstado;
          q = q.eq('estado', dbState);
        }
        if (purgeDesde) q = q.gte('created_at', purgeDesde);
        if (purgeHasta) q = q.lte('created_at', purgeHasta + 'T23:59:59');
        const { error, count } = await q;
        if (error) throw error;
        totalEliminados += count || 0;
      }

      showToast(`✅ Purge completado — ${totalEliminados} registros eliminados`);
      setPurgeConfirmText('');
      setPurgePreview(null);
      setShowPurgeModal(false);
      cargarDatos();
    } catch (err: any) {
      showToast('Error en purge: ' + err.message, 'error');
    } finally {
      setPurging(false);
    }
  }

  let filteredProducts = productos.filter(p =>
    p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.categoria.toLowerCase().includes(searchQuery.toLowerCase())
  );
  if (productSort === 'alfabetico') {
    filteredProducts.sort((a, b) => a.nombre.localeCompare(b.nombre));
  } else if (productSort === 'visibles') {
    filteredProducts = filteredProducts.filter(p => !p.oculto);
  } else if (productSort === 'ocultos') {
    filteredProducts = filteredProducts.filter(p => p.oculto);
  }

  let mayoristaFilteredProducts = productos.filter(p =>
    (mayoristaCategoryFilter === 'todos' || p.categoria === mayoristaCategoryFilter) &&
    (p.nombre.toLowerCase().includes(mayoristaSearchQuery.toLowerCase()) ||
     p.categoria.toLowerCase().includes(mayoristaSearchQuery.toLowerCase()))
  );
  if (role === 'mayorista') {
    const tempMayorista = mayoristas.find(m => m.telefono === loggedAsesorPhone) || asesores.find(a => a.telefono === loggedAsesorPhone);
    if (mayoristaProductSort === 'alfabetico') {
      mayoristaFilteredProducts.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } else if (mayoristaProductSort === 'visibles') {
      mayoristaFilteredProducts = mayoristaFilteredProducts.filter(p => {
        const hiddenProducts = tempMayorista?.ajustes_productos?.hidden_products || [];
        return !hiddenProducts.includes(p.id);
      });
    } else if (mayoristaProductSort === 'ocultos') {
      mayoristaFilteredProducts = mayoristaFilteredProducts.filter(p => {
        const hiddenProducts = tempMayorista?.ajustes_productos?.hidden_products || [];
        return hiddenProducts.includes(p.id);
      });
    }
  }

  // ── LOGIN SCREEN ──
  const [dbCompanies, setDbCompanies] = useState<any[]>([]);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    if (!isAuthenticated) {
      supabase.from('configuracion').select('tenant_id, nombre_negocio, logo_url')
        .then(({ data, error }) => {
          if (data && !error) {
            setDbCompanies(data);
            setImageErrors({});
          }
        });
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    const baseCompanies = [
      { id: 'saramantha', name: 'Saramantha', logo: '/saramantha-logo.jpg' }, 
      { id: 'sublimados_majestic', name: 'Sublimados Majestic', logo: '/sublimados-logo.jpg' },
      { id: 'pijamas_lucerito', name: 'Pijamas Lucerito', logo: '/lucerito-logo.jpg' },
      { id: 'lovely', name: 'Lovely', logo: '/lovely-logo.jpg' },
    ];
    
    // Mezclar las bases con las de la base de datos
    const companies = baseCompanies.map(base => {
      const dbMatch = dbCompanies.find(c => c.tenant_id === base.id);
      return {
        id: base.id,
        name: dbMatch?.nombre_negocio || base.name,
        logo: dbMatch?.logo_url || base.logo
      };
    });

    return (
      <div className="admin-login-wrapper">
        <div className="admin-login-card" style={{ maxWidth: selectedCompany ? '400px' : '550px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              {!imageErrors['main'] ? (
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', overflow: 'hidden', border: '3px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
                  <img 
                    src="/indisutex-logo.png" 
                    alt="Indisutex Logo" 
                    style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(1.5)' }} 
                    onError={() => setImageErrors(prev => ({ ...prev, main: true }))} 
                  />
                </div>
              ) : (
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#0ea5e9', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 'bold' }}>IN</div>
              )}
            </div>
            <h1>Indisutex Admin</h1>
            <p>Selecciona tu empresa para gestionar el catálogo</p>
          </div>
          
          {!selectedCompany ? (
            <div className="company-selector">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                {companies.map(company => (
                  <button 
                    key={company.id}
                    className="company-btn"
                    onClick={() => {
                      setTenantId(company.id);
                      setSelectedCompany(company.id);
                      const newPath = `/${company.id}/admin`;
                      window.history.replaceState(null, '', newPath);
                    }}
                    style={{
                      background: 'white', border: '2px solid #eee', borderRadius: '12px', padding: '1rem',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem', cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {!imageErrors[company.id] ? (
                      <img 
                        src={company.logo} 
                        alt={company.name} 
                        style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} 
                        onError={() => setImageErrors(prev => ({ ...prev, [company.id]: true }))} 
                      />
                    ) : (
                      <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold' }}>
                        {company.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span style={{ fontWeight: 700, color: '#333', fontSize: '0.9rem', textAlign: 'center' }}>{company.name}</span>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: '1.5rem' }}>
                <button 
                  className="company-btn"
                  onClick={() => {
                    window.location.href = '/superadmin';
                  }}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px', 
                    padding: '1.25rem',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: '0.8rem', 
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontWeight: 800,
                    fontSize: '1rem',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                  }}
                >
                  <Building2 size={20} style={{ color: '#38bdf8' }} /> Administrar Superior (Indisutex)
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1rem', background: '#f8fafc', padding: '0.8rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {(() => {
                    const selectedComp = companies.find(c => c.id === selectedCompany);
                    return selectedComp ? (
                      <>
                        <img 
                          src={selectedComp.logo} 
                          alt={selectedComp.name} 
                          style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} 
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                        <span style={{ fontWeight: 600, color: '#333' }}>Empresa: {selectedComp.name}</span>
                      </>
                    ) : (
                      <span style={{ fontWeight: 600, color: '#333' }}>Empresa: {selectedCompany}</span>
                    );
                  })()}
                </div>
                <button type="button" onClick={() => {
                  setSelectedCompany(null);
                  window.history.replaceState(null, '', '/admin');
                }} style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Cambiar</button>
              </div>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="PIN (0000)"
                maxLength={6}
                autoFocus
              />
              <button type="submit" className="login-btn">Ingresar al Panel</button>
            </form>
          )}
          
          <p style={{ fontSize: '0.72rem', color: '#333', marginTop: '1.5rem' }}>Panel Administrativo v2.0</p>
        </div>
        {toast && (
          <div className={`admin-toast ${toast.type}`}>
            <span>{toast.type === 'error' ? '❌' : '✅'}</span>
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    );
  }

  // ── EDIT PRODUCT MODAL ──
  // Sync editExtraImages when editingProduct changes
  // (handled via setEditingProduct call site – pre-populate below at click)

  if (editingProduct) {
    return (
      <div className="admin-app">
        <aside className="admin-sidebar">
          <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} productos={productos} configuracion={configuracion} handleLogout={handleLogout} role={role} currentAsesor={role === 'mayorista' ? currentMayorista : currentAsesor} activeNotificationsCount={activeNotificationsCount} />
        </aside>
        <div className="admin-main">
          <div className="admin-topbar">
            <div className="topbar-title">
              <h2>✏️ Editando Producto</h2>
              <p>{editingProduct.nombre}</p>
            </div>
            <div className="topbar-actions">
              <button className="btn-secondary" onClick={() => setEditingProduct(null)}>Cancelar</button>
              <button className="btn-primary" form="edit-form" type="submit" disabled={loading}>
                <Check size={14} /> {loading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
          <div className="admin-content">
            <div className="admin-panel">
              <div className="panel-header">
                <div>
                  <h3><Pencil size={16} /> Editar Producto</h3>
                  <p>Modifica los datos y guarda</p>
                </div>
              </div>
              <div className="panel-body">
                <form id="edit-form" onSubmit={handleUpdateProduct}>
                  <div className="form-grid">
                    <div className="form-field full">
                      <label>Nombre</label>
                      <input required value={editingProduct.nombre} onChange={e => setEditingProduct({ ...editingProduct, nombre: e.target.value })} />
                    </div>
                    <div className="form-field full">
                      <label>Descripción</label>
                      <textarea value={editingProduct.descripcion || ''} onChange={e => setEditingProduct({ ...editingProduct, descripcion: e.target.value })} rows={3} />
                    </div>
                    <div className="form-field">
                       <label>Precio Detal (COP)</label>
                       <input required type="number" step="0.01" value={editingProduct.precio} onChange={e => setEditingProduct({ ...editingProduct, precio: parseFloat(e.target.value) })} />
                     </div>
                     <div className="form-field">
                       <label>Precio por Mayor (COP)</label>
                       <input type="number" step="0.01" value={editingProduct.precio_por_mayor || ''} onChange={e => setEditingProduct({ ...editingProduct, precio_por_mayor: parseFloat(e.target.value) || undefined })} />
                     </div>
                     <div className="form-field">
                       <label>Precio 50 Unidades (COP)</label>
                       <input type="number" step="0.01" value={editingProduct.precio_50_unidades || ''} onChange={e => setEditingProduct({ ...editingProduct, precio_50_unidades: parseFloat(e.target.value) || undefined })} />
                     </div>
                     <div className="form-field">
                       <label>Stock (Cantidad en inventario)</label>
                       <input type="number" min="0" value={editingProduct.stock || 0} onChange={e => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })} />
                     </div>
                     <div className="form-field full">
                        <label>Tallas</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                          {['Única', 'Plus', 'Oversize', 'S', 'M', 'L', 'XL', 'XXL'].map(sz => {
                            const currentTallas = (editingProduct.tallas || '').split(',').map(s => s.trim()).filter(Boolean);
                            const selected = currentTallas.includes(sz);
                            return (
                              <button
                                key={sz}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  let newTallas;
                                  if (selected) {
                                    newTallas = currentTallas.filter(s => s !== sz);
                                  } else {
                                    newTallas = [...currentTallas, sz];
                                  }
                                  setEditingProduct({ ...editingProduct, tallas: newTallas.join(', ') });
                                }}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '6px',
                                  border: selected ? '2px solid #e11d48' : '1px solid #cbd5e1',
                                  background: selected ? '#fff1f2' : '#f8fafc',
                                  color: selected ? '#be185d' : '#475569',
                                  fontSize: '0.85rem',
                                  fontWeight: selected ? 700 : 500,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease-in-out'
                                }}
                              >
                                {sz}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="form-field">
                        <label>Categoría</label>
                        <select value={editingProduct.categoria} onChange={e => setEditingProduct({ ...editingProduct, categoria: e.target.value })}>
                          {categoriasData.map(c => <option key={c.id} value={c.slug}>{c.nombre}</option>)}
                        </select>
                      </div>
                    <div className="form-field full" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'start', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      {/* -- FOTO PRINCIPAL -- */}
                      <div>
                        <label>Foto Principal</label>
                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem', alignItems: 'center', width: 'fit-content' }}>
                          {editingProduct.imagen_url ? (
                            <img src={editingProduct.imagen_url} alt="" style={{ width: 160, height: 160, objectFit: 'cover', borderRadius: 8, border: '2px solid #e2e8f0' }} />
                          ) : (
                            <div style={{ width: 160, height: 160, background: '#f1f5f9', borderRadius: 8, border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, gap: '0.5rem' }}>
                              <span style={{ fontSize: '2rem' }}>🖼️</span>
                              Sin imagen
                            </div>
                          )}
                          <label style={{ position: 'absolute', top: 0, left: 0, width: 160, height: 160, cursor: 'pointer', opacity: 0 }}>
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditMainImgUpload} />
                          </label>
                        </div>
                      </div>

                      {/* ── FOTOS EXTRA ── */}
                      <div>
                        <label>📸 Fotos Adicionales del Producto</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                        {editExtraImages.map((img, idx) => (
                          <div key={idx} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                            {img.url && <img src={img.url} alt="" style={{ width: 130, height: 130, objectFit: 'cover', borderRadius: 8, border: '2px solid #e2e8f0' }} />}
                            {!img.url && <div style={{ width: 130, height: 130, background: '#f1f5f9', borderRadius: 8, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📷</div>}
                            <input
                              value={img.ref}
                              onChange={e => {
                                const newArr = [...editExtraImages];
                                newArr[idx].ref = e.target.value;
                                setEditExtraImages(newArr);
                              }}
                              placeholder="Ref (Ej. Snoopy)"
                              style={{ width: '130px', fontSize: '0.9rem', padding: '0.4rem', textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                            />
                            <label htmlFor={`edit-extra-${idx}`} style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#0ea5e9', fontWeight: 600 }}>
                              {editUploadingIdx === idx ? '...' : '📤 Cambiar'}
                            </label>
                            <input id={`edit-extra-${idx}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleEditExtraUpload(e, idx)} />
                            <button type="button" onClick={() => setEditExtraImages(prev => prev.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: '50%', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                          </div>
                        ))}
                        {/* Botón agregar foto extra */}
                        <label htmlFor="edit-extra-new" style={{ width: 130, height: 130, background: '#f0fdf4', border: '2px dashed #22c55e', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.9rem', color: '#16a34a', fontWeight: 700, gap: '0.5rem' }}>
                          <span style={{ fontSize: '2rem' }}>+</span> Agregar foto
                        </label>
                        <input id="edit-extra-new" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={async e => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          setEditUploadingIdx(-1);
                          try {
                            const uploadedData: { url: string, ref: string }[] = [];
                            for (const file of files) {
                              const compFile = await compressImage(file);
                              const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${compFile.name.split('.').pop()}`;
                              const { error: uploadError } = await supabase.storage.from('archivos').upload(fileName, compFile);
                              if (uploadError) throw uploadError;
                              const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
                              const originalName = file.name.split('.').slice(0, -1).join('.').toUpperCase();
                              uploadedData.push({ url: data.publicUrl, ref: originalName });
                            }
                            setEditExtraImages(prev => [...prev, ...uploadedData]);
                            showToast(`${uploadedData.length} foto(s) agregada(s) ✓`);
                          } catch { showToast('Error al subir foto(s)', 'error'); }
                          finally { setEditUploadingIdx(null); }
                        }} />
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
          </div>
        </div>
      </div>
    );
  }

  // ── EDIT CATEGORY MODAL ──
  if (editingCategory) {
    return (
      <div className="admin-app">
        <aside className="admin-sidebar">
          <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} productos={productos} configuracion={configuracion} handleLogout={handleLogout} role={role} currentAsesor={role === 'mayorista' ? currentMayorista : currentAsesor} activeNotificationsCount={activeNotificationsCount} />
        </aside>
        <div className="admin-main">
          <div className="admin-topbar">
            <div className="topbar-title">
              <h2>✏️ Editando Categoría</h2>
              <p>{editingCategory.nombre}</p>
            </div>
            <div className="topbar-actions">
              <button className="btn-secondary" onClick={() => setEditingCategory(null)}>Cancelar</button>
              <button className="btn-primary" form="edit-category-form" type="submit" disabled={loading}>
                <Check size={14} /> {loading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
          <div className="admin-content">
            <div className="admin-panel">
              <div className="panel-header">
                <div>
                  <h3><Pencil size={16} /> Editar Categoría</h3>
                  <p>Modifica los datos y guarda</p>
                </div>
              </div>
              <div className="panel-body">
                <form id="edit-category-form" onSubmit={handleUpdateCategory}>
                  <div className="form-grid">
                    <div className="form-field full">
                      <label>Nombre de la Categoría</label>
                      <input required value={editingCategory.nombre} onChange={e => setEditingCategory({ ...editingCategory, nombre: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label>Slug (identificador)</label>
                      <input required value={editingCategory.slug} onChange={e => setEditingCategory({ ...editingCategory, slug: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label>Ícono (Emoji)</label>
                      <input value={editingCategory.icono || ''} onChange={e => setEditingCategory({ ...editingCategory, icono: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label>Color de Fondo</label>
                      <input value={editingCategory.color || ''} onChange={e => setEditingCategory({ ...editingCategory, color: e.target.value })} />
                    </div>
                    <div className="form-field full">
                      <label>URL de Imagen</label>
                      <div className="img-input-row">
                        {editingCategory.imagen_url && <img src={editingCategory.imagen_url} className="img-preview-thumb" alt="" />}
                        <input value={editingCategory.imagen_url || ''} onChange={e => setEditingCategory({ ...editingCategory, imagen_url: e.target.value })} placeholder="https://..." />
                        <label className="btn-upload-img" style={{ flexShrink: 0, cursor: 'pointer' }}>
                          <Upload size={12} /> Subir Imagen
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (ev) => {
                            const file = ev.target.files?.[0];
                            if (!file) return;
                            setLoading(true);
                            try {
                              const compFile = await compressImage(file);
                              const ext = compFile.name.split('.').pop() || 'jpg';
                              const fileName = `cat_${editingCategory.id}_${Date.now()}.${ext}`;
                              const { error: upErr } = await supabase.storage.from('archivos').upload(fileName, compFile, { upsert: true });
                              if (upErr) throw upErr;
                              const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
                              setEditingCategory({ ...editingCategory, imagen_url: data.publicUrl });
                              showToast('Imagen cargada ✓');
                            } catch (err: any) {
                              showToast(`Error al subir imagen: ${err.message || err}`, 'error');
                            } finally {
                              setLoading(false);
                            }
                          }} />
                        </label>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── EDIT SUBCATEGORY MODAL ──
  if (editingSubcategory) {
    return (
      <div className="admin-app">
        <aside className="admin-sidebar">
          <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} productos={productos} configuracion={configuracion} handleLogout={handleLogout} role={role} currentAsesor={role === 'mayorista' ? currentMayorista : currentAsesor} activeNotificationsCount={activeNotificationsCount} />
        </aside>
        <div className="admin-main">
          <div className="admin-topbar">
            <div className="topbar-title">
              <h2>✏️ Editando Subcategoría</h2>
              <p>{editingSubcategory.nombre}</p>
            </div>
            <div className="topbar-actions">
              <button className="btn-secondary" onClick={() => setEditingSubcategory(null)}>Cancelar</button>
              <button className="btn-primary" form="edit-subcategory-form" type="submit" disabled={loading}>
                <Check size={14} /> {loading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
          <div className="admin-content">
            <div className="admin-panel">
              <div className="panel-header">
                <div>
                  <h3><Pencil size={16} /> Editar Subcategoría</h3>
                  <p>Modifica los datos y guarda</p>
                </div>
              </div>
              <div className="panel-body">
                <form id="edit-subcategory-form" onSubmit={handleUpdateSubcategory}>
                  <div className="form-grid">
                    <div className="form-field full">
                      <label>Nombre de la Subcategoría</label>
                      <input required value={editingSubcategory.nombre} onChange={e => setEditingSubcategory({ ...editingSubcategory, nombre: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label>Slug (identificador)</label>
                      <input required value={editingSubcategory.slug} onChange={e => setEditingSubcategory({ ...editingSubcategory, slug: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label>Categoría Padre</label>
                      <select value={editingSubcategory.categoria_id} onChange={e => setEditingSubcategory({ ...editingSubcategory, categoria_id: e.target.value })}>
                        {categoriasData.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }


  // ── MAIN DASHBOARD ──
  return (
    <div className="admin-app">
      {/* SIDEBAR */}
      <aside className={`admin-sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <SidebarContent 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          productos={productos} 
          configuracion={configuracion} 
          handleLogout={handleLogout} 
          onClose={() => setIsMobileMenuOpen(false)} 
          role={role}
          currentAsesor={role === 'mayorista' ? currentMayorista : currentAsesor}
          activeNotificationsCount={activeNotificationsCount}
        />
      </aside>

      {isMobileMenuOpen && (
        <div 
          className="sidebar-overlay-mobile" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* MAIN */}
      <div className="admin-main">
        {/* TOP BAR */}
        <div className="admin-topbar">
          <button 
            type="button" 
            className="sidebar-collapse-toggle"
            onClick={toggleSidebar}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              color: '#64748b',
              border: 'none',
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              marginRight: '0.75rem',
              transition: 'all 0.2s',
            }}
            title={isSidebarCollapsed ? "Mostrar Menú Lateral" : "Ocultar Menú Lateral"}
          >
            <Menu size={20} style={{ color: '#475569' }} />
          </button>
          {!(role === 'asesor' || role === 'mayorista') && (
            <button 
              type="button" 
              className="mobile-menu-toggle" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
          <div className="topbar-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
            {((role === 'asesor' && currentAsesor) || (role === 'mayorista' && currentMayorista)) ? (
              (() => {
                const currentUser = role === 'mayorista' ? currentMayorista : currentAsesor;
                if (!currentUser) return null;
                return (
                  <>
                    <div style={{ background: currentUser.foto_url ? 'transparent' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '50%', border: '1px solid #cbd5e1', overflow: 'hidden', flexShrink: 0 }}>
                      {currentUser.foto_url ? (
                        <img src={currentUser.foto_url} alt={currentUser.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{currentUser.nombre.charAt(0)}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', minWidth: 0, flex: 1 }}>
                      <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {currentUser.nombre}
                      </h2>
                      <p className="topbar-motivational-quote" style={{ margin: '0.05rem 0 0 0', fontSize: '0.85rem', color: configuracion?.color_primario || '#6366f1', fontWeight: 700, fontStyle: 'normal', fontFamily: 'Nunito, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getMotivationalPhrase(currentUser.id)}
                      </p>
                    </div>
                  </>
                );
              })()
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                <h2 style={{ margin: 0 }}>
                  {activeTab === 'dashboard' && '📊 Dashboard'}
                  {activeTab === 'productos' && '📦 Productos'}
                  {activeTab === 'categorias' && '🗂️ Categorías'}
                  {activeTab === 'clientes' && '👥 Clientes'}
                  {activeTab === 'asesores' && '👥 Asesores'}
                  {activeTab === 'mayoristas' && '👥 Mayoristas'}
                  {activeTab === 'config' && '⚙️ Configuración'}
                </h2>
                <p style={{ margin: '0.15rem 0 0 0' }}>
                  {activeTab === 'productos' && `${productos.length} productos en total`}
                  {activeTab === 'categorias' && `${categoriasData.length} categorías activas`}
                  {activeTab === 'clientes' && `${clientes.length} clientes en total`}
                  {activeTab === 'asesores' && `${asesores.length} asesores en tu equipo`}
                  {activeTab === 'mayoristas' && `${mayoristas.length} mayoristas en tu equipo`}
                  {activeTab === 'config' && 'Ajustes globales de tu tienda'}
                </p>
              </div>
            )}
          </div>
          <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Botón de Sincronización Global */}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f1f5f9',
                color: '#475569',
                border: 'none',
                borderRadius: '8px',
                width: '36px',
                height: '36px',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
              title="Sincronizar Datos"
            >
              <RefreshCw size={16} className={isRefreshing ? 'spin-icon-active' : ''} />
            </button>
            {activeTab === 'productos' && (
              isAddingProduct ? (
                <button className="btn-secondary" onClick={() => setIsAddingProduct(false)}>
                  <X size={14} /> Volver al Inventario
                </button>
              ) : (
                <button className="btn-primary" onClick={() => { setBulkForms([{ ...emptyProduct }]); setIsAddingProduct(true); }}>
                  <Plus size={14} /> Nuevo Producto
                </button>
              )
            )}
            {activeTab === 'categorias' && (
              isAddingCategory || isAddingSubcategory ? (
                <button className="btn-secondary" onClick={() => { setIsAddingCategory(false); setIsAddingSubcategory(false); }}>
                  <X size={14} /> Volver a la Lista
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-primary" onClick={() => setIsAddingCategory(true)}>
                    <Plus size={14} /> Nueva Categoría
                  </button>
                  <button className="btn-primary" onClick={() => setIsAddingSubcategory(true)} style={{ background: '#10b981' }}>
                    <Plus size={14} /> Nueva Subcategoría
                  </button>
                </div>
              )
            )}
            {(role === 'asesor' || role === 'mayorista') && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowNotificationsPopover(!showNotificationsPopover)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.55rem',
                    borderRadius: '10px',
                    border: showNotificationsPopover ? '1px solid #fee2e2' : '1px solid #cbd5e1',
                    cursor: 'pointer',
                    background: showNotificationsPopover ? '#fee2e2' : 'white',
                    color: showNotificationsPopover ? '#ef4444' : '#475569',
                    position: 'relative',
                    transition: 'all 0.2s',
                    width: '38px',
                    height: '38px',
                    flexShrink: 0
                  }}
                  title="Notificaciones y Alertas"
                >
                  <Bell size={18} className={activeNotificationsCount > 0 ? 'pulse-bell' : ''} style={{ color: activeNotificationsCount > 0 ? '#ef4444' : 'inherit' }} />
                  {activeNotificationsCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      background: '#ef4444',
                      color: 'white',
                      fontSize: '0.65rem',
                      padding: '2px 5px',
                      borderRadius: '50%',
                      fontWeight: 800,
                      border: '2px solid white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '18px',
                      height: '18px'
                    }}>
                      {activeNotificationsCount}
                    </span>
                  )}
                </button>
                
                {showNotificationsPopover && (
                  <div style={{
                    position: 'absolute',
                    top: '120%',
                    right: 0,
                    width: '320px',
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Notificaciones</h4>
                      <button onClick={() => setShowNotificationsPopover(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <X size={16} />
                      </button>
                    </div>
                    <div style={{ maxHeight: '350px', overflowY: 'auto', padding: '0.5rem' }}>
                      {activeNotifications.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b' }}>
                          <p style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>🎉</p>
                          <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>¡Estás al día!</p>
                        </div>
                      ) : (
                        activeNotifications.map((notif: any) => {
                          const isDanger = notif.type === 'danger';
                          const isWarning = notif.type === 'warning';
                          const isSuccess = notif.type === 'success';
                          const primaryColor = configuracion?.color_primario || '#6366f1';
                          
                          return (
                            <div key={notif.id} style={{
                              padding: '0.75rem',
                              borderBottom: '1px solid #f1f5f9',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                              background: isDanger ? '#fef2f2' : isWarning ? '#fffbeb' : 'transparent',
                              borderRadius: '8px',
                              marginBottom: '0.25rem'
                            }}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '1.1rem' }}>
                                  {isDanger ? '🔴' : isWarning ? '🟡' : isSuccess ? '🟢' : '🔵'}
                                </span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                  <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>{notif.title}</h4>
                                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: 1.3 }}>{notif.message}</p>
                                </div>
                              </div>
                              {notif.actionTab && (
                                <button
                                  onClick={() => {
                                    setActiveTab(notif.actionTab);
                                    setShowNotificationsPopover(false);
                                  }}
                                  style={{
                                    background: isDanger ? '#ef4444' : isWarning ? '#f59e0b' : primaryColor,
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    alignSelf: 'flex-start',
                                    marginLeft: '1.6rem'
                                  }}
                                >
                                  Ir a atender
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button 
              type="button"
              className="btn-secondary btn-home-header" 
              onClick={handleLogout}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 1rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid #cbd5e1', cursor: 'pointer', background: 'white', color: '#475569', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
            >
              <Home size={15} /> <span className="btn-home-text">Ir al Inicio</span>
            </button>
          </div>
        </div>

        <div className="admin-content">

          {/* ── PRODUCTS TAB ── */}
          {activeTab === 'productos' && (
            <>
              {isAddingProduct ? (
                <div className="admin-panel">
                  <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}><Package size={18} /> Agregar Productos</h3>
                      <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Selecciona tu método preferido para subir productos</p>
                    </div>
                    <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px', gap: '0.25rem' }}>
                      <button 
                        type="button" 
                        className={`btn-tab ${uploadMethod === 'manual' ? 'active' : ''}`}
                        onClick={() => setUploadMethod('manual')}
                        style={{ border: 'none', background: uploadMethod === 'manual' ? '#ffffff' : 'transparent', color: uploadMethod === 'manual' ? '#0f172a' : '#64748b', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', boxShadow: uploadMethod === 'manual' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                      >
                        Subida Manual
                      </button>
                      <button 
                        type="button" 
                        className={`btn-tab ${uploadMethod === 'excel' ? 'active' : ''}`}
                        onClick={() => setUploadMethod('excel')}
                        style={{ border: 'none', background: uploadMethod === 'excel' ? '#ffffff' : 'transparent', color: uploadMethod === 'excel' ? '#0f172a' : '#64748b', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', boxShadow: uploadMethod === 'excel' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                      >
                        Importar Excel (Masivo)
                      </button>
                      <button 
                        type="button" 
                        className={`btn-tab ${uploadMethod === 'texto' ? 'active' : ''}`}
                        onClick={() => setUploadMethod('texto')}
                        style={{ border: 'none', background: uploadMethod === 'texto' ? '#ffffff' : 'transparent', color: uploadMethod === 'texto' ? '#0f172a' : '#64748b', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', boxShadow: uploadMethod === 'texto' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                      >
                        📋 Copiar y Pegar Texto
                      </button>
                    </div>
                  </div>

                  {uploadMethod === 'manual' ? (
                    <div className="panel-body">
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button className="btn-secondary" onClick={() => setBulkForms([...bulkForms, { ...emptyProduct }])}>
                          <Plus size={14} /> Añadir fila
                        </button>
                      </div>
                      <form onSubmit={handleBulkSubmit}>
                        {bulkForms.map((form, index) => (
                          <div key={index} className="bulk-product-card">
                            <div className="bulk-product-card-header">
                              <h4># Producto {index + 1}</h4>
                              <div className="bulk-actions-bar">
                                <label className="btn-upload-img">
                                  <Upload size={12} /> Subir Fotos
                                  <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFileUpload(e, index, 0)} />
                                </label>
                                {bulkForms.length > 1 && (
                                  <button type="button" className="btn-remove-row" onClick={() => {
                                    const f = [...bulkForms]; f.splice(index, 1); setBulkForms(f);
                                  }}>
                                    <X size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="form-grid">
                              <div className="form-field full">
                                <label>Nombre del Producto</label>
                                <input required value={form.nombre} onChange={e => updateBulkForm(index, 'nombre', e.target.value)} placeholder="Ej: Mameluco Oso Polar 0-3 Meses" />
                              </div>
                              <div className="form-field full">
                                <label>Descripción</label>
                                <textarea value={form.descripcion} onChange={e => updateBulkForm(index, 'descripcion', e.target.value)} placeholder="Detalles del producto..." rows={2} />
                              </div>
                              <div className="form-field">
                                <label>Precio Detal (COP)</label>
                                <input required type="number" step="0.01" value={form.precio} onChange={e => updateBulkForm(index, 'precio', e.target.value)} placeholder="25000" />
                              </div>
                              <div className="form-field">
                                <label>Precio por Mayor (COP)</label>
                                <input type="number" step="0.01" value={form.precio_por_mayor} onChange={e => updateBulkForm(index, 'precio_por_mayor', e.target.value)} placeholder="20000" />
                              </div>
                              <div className="form-field">
                                <label>Precio 50 Unidades (COP)</label>
                                <input type="number" step="0.01" value={form.precio_50_unidades} onChange={e => updateBulkForm(index, 'precio_50_unidades', e.target.value)} placeholder="18000" />
                              </div>
                              <div className="form-field">
                                <label>Stock (Cantidad en inventario)</label>
                                <input type="number" min="0" value={form.stock || 0} onChange={e => updateBulkForm(index, 'stock', parseInt(e.target.value) || 0)} placeholder="Ej: 100" />
                              </div>
                              <div className="form-field">
                                <label>Categoría</label>
                                <select value={form.categoria} onChange={e => updateBulkForm(index, 'categoria', e.target.value)}>
                                  <option value="">Seleccionar...</option>
                                  {categoriasData.map(c => <option key={c.id} value={c.slug}>{c.icono} {c.nombre}</option>)}
                                </select>
                              </div>
                              <div className="form-field full">
                                <label>Tallas (opcionales)</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                                  {['Única', 'Plus', 'Oversize', 'S', 'M', 'L', 'XL', 'XXL'].map(sz => {
                                    const currentTallas = (form.tallas || '').split(',').map(s => s.trim()).filter(Boolean);
                                    const selected = currentTallas.includes(sz);
                                    return (
                                      <button
                                        key={sz}
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          let newTallas;
                                          if (selected) {
                                            newTallas = currentTallas.filter(s => s !== sz);
                                          } else {
                                            newTallas = [...currentTallas, sz];
                                          }
                                          updateBulkForm(index, 'tallas', newTallas.join(', '));
                                        }}
                                        style={{
                                          padding: '0.35rem 0.75rem',
                                          borderRadius: '6px',
                                          border: selected ? '2px solid #e11d48' : '1px solid #cbd5e1',
                                          background: selected ? '#fff1f2' : '#f8fafc',
                                          color: selected ? '#be185d' : '#475569',
                                          fontSize: '0.85rem',
                                          fontWeight: selected ? 700 : 500,
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease-in-out'
                                        }}
                                      >
                                        {sz}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="form-field full">
                                <label>🖼️ Imágenes del Producto</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  {form.imagenes.map((img, imgIdx) => (
                                    <div key={imgIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', background: '#f8fafc', borderRadius: '12px', padding: '0.8rem', border: '1px solid #e2e8f0', minHeight: '170px' }}>
                                      {img.url ? (
                                        <img
                                          src={img.url}
                                          style={{ width: 160, height: 160, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '2px solid #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                                          alt=""
                                          onError={e => (e.currentTarget.style.display = 'none')}
                                        />
                                      ) : (
                                        <div style={{ width: 160, height: 160, borderRadius: 10, flexShrink: 0, background: '#e2e8f0', border: '2px dashed #94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.4rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                                          <span style={{ fontSize: '2rem' }}>🖼️</span>
                                          <span>Sin imagen</span>
                                        </div>
                                      )}
                                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <input
                                          value={img.url}
                                          onChange={e => updateImagenUrl(index, imgIdx, e.target.value)}
                                          placeholder={imgIdx === 0 ? 'URL de imagen principal...' : 'URL de imagen extra...'}
                                        />
                                        {imgIdx > 0 && (
                                          <input
                                            value={img.ref}
                                            onChange={e => updateImagenRef(index, imgIdx, e.target.value)}
                                            placeholder="Nombre de Estampado / Referencia (Ej. Snoopy)..."
                                            style={{ fontSize: '0.85rem' }}
                                          />
                                        )}
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                          <label className="btn-upload-img" style={{ fontSize: '0.75rem', padding: '0.4rem 0.9rem', cursor: 'pointer' }}>
                                            <Upload size={12} /> Subir archivo(s)
                                            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFileUpload(e, index, imgIdx)} />
                                          </label>
                                          {imgIdx === 0 && (
                                            <span style={{ fontSize: '0.7rem', color: '#0ea5e9', fontWeight: 700, alignSelf: 'center', background: 'rgba(14,165,233,0.1)', padding: '0.2rem 0.6rem', borderRadius: 6 }}>★ Principal</span>
                                          )}
                                        </div>
                                      </div>
                                      {form.imagenes.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => removeImagenRow(index, imgIdx)}
                                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.3rem', borderRadius: 6, marginLeft: 'auto' }}
                                        >
                                          <X size={16} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => addImagenRow(index)}
                                    style={{ alignSelf: 'flex-start', background: 'rgba(14,165,233,0.08)', border: '1px dashed #0ea5e9', color: '#0ea5e9', borderRadius: 8, padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                  >
                                    <Plus size={13} /> Agregar URL
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                          <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.7rem 2rem', fontSize: '0.9rem' }}>
                            {loading ? <><span className="loading-dot" /> Guardando...</> : <><Check size={14} /> Guardar Productos</>}
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="panel-body">
                      <div style={{ background: '#f8fafc', padding: '3rem 2rem', border: '2px dashed #cbd5e1', borderRadius: '16px', textAlign: 'center', marginBottom: '2rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1.1rem' }}>Selecciona tu archivo Excel (.xlsx, .xls, .csv)</h4>
                        <p style={{ margin: '0 0 1.5rem 0', color: '#64748b', fontSize: '0.85rem', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.4' }}>
                          Las columnas se detectan automáticamente de forma inteligente. Asegúrate de incluir encabezados claros como: <strong>Nombre, Descripción, Precio, Categoría, Subcategoría, Imagen, Tallas</strong>.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center' }}>
                          <button type="button" onClick={downloadExcelTemplate} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.7rem 1.8rem', borderRadius: '8px', fontSize: '0.9rem', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600 }}>
                            <Download size={14} /> Descargar Plantilla
                          </button>
                          <label className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.7rem 1.8rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                            <Upload size={14} /> Seleccionar Archivo Excel
                            <input type="file" accept=".xlsx, .xls, .csv" style={{ display: 'none' }} onChange={handleExcelImport} />
                          </label>
                        </div>
                      </div>

                      {excelProducts.length > 0 && (
                        <form onSubmit={handleExcelSubmit}>
                          <div className="panel-header" style={{ borderBottom: 'none', padding: 0, marginBottom: '1rem' }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '1rem' }}>Vista Previa de Productos ({excelProducts.length})</h4>
                              <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0.2rem 0 0 0' }}>Revisa la información antes de importarla en tu base de datos</p>
                            </div>
                          </div>
                          <div style={{ overflowX: 'auto', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '1.5rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                  <th style={{ padding: '0.8rem 1rem' }}>Referencia</th>
                                  <th style={{ padding: '0.8rem 1rem' }}>Nombre</th>
                                  <th style={{ padding: '0.8rem 1rem' }}>Categoría</th>
                                  <th style={{ padding: '0.8rem 1rem' }}>Costo</th>
                                  <th style={{ padding: '0.8rem 1rem' }}>Por Mayor</th>
                                  <th style={{ padding: '0.8rem 1rem' }}>Detal</th>
                                  <th style={{ padding: '0.8rem 1rem' }}>50 Unidades</th>
                                </tr>
                              </thead>
                              <tbody>
                                {excelProducts.map((p, i) => (
                                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '0.8rem 1rem', color: '#64748b' }}>{p.referencia || '-'}</td>
                                    <td style={{ padding: '0.8rem 1rem', fontWeight: 600, color: '#0f172a' }}>{p.nombre}</td>
                                    <td style={{ padding: '0.8rem 1rem', color: '#64748b' }}>{p.categoria}</td>
                                    <td style={{ padding: '0.8rem 1rem', color: '#64748b' }}>${(p.costo || 0).toLocaleString()}</td>
                                    <td style={{ padding: '0.8rem 1rem', color: '#64748b' }}>${(p.precio_por_mayor || 0).toLocaleString()}</td>
                                    <td style={{ padding: '0.8rem 1rem', color: '#10b981', fontWeight: 700 }}>${(p.precio || 0).toLocaleString()}</td>
                                    <td style={{ padding: '0.8rem 1rem', color: '#64748b' }}>${(p.precio_50_unidades || 0).toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.7rem 2rem' }}>
                              {loading ? <><span className="loading-dot" /> Guardando...</> : <><Check size={14} /> Importar {excelProducts.length} Productos</>}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {uploadMethod === 'texto' && (
                    <div className="panel-body" style={{ padding: '1.25rem' }}>
                      <div style={{ marginBottom: '1.25rem' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>📋 Importar Productos desde Texto Copiado</h4>
                        <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>
                          Pega las filas en formato CSV o separado por tabuladores. Incluye la cabecera en la primera línea.
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.78rem', fontWeight: 700, marginTop: '0.4rem', fontFamily: 'monospace', background: '#f1f5f9', padding: '0.4rem 0.6rem', borderRadius: '6px', display: 'inline-block' }}>
                          Formato: Referencia,Categoria,Descripcion,Costo,Por Mayor,Detal,50 Unidades
                        </p>
                      </div>

                      <textarea
                        style={{
                          width: '100%',
                          height: '240px',
                          padding: '1rem',
                          borderRadius: '12px',
                          border: '1px solid #cbd5e1',
                          outline: 'none',
                          fontSize: '0.82rem',
                          fontFamily: 'monospace',
                          marginBottom: '1rem',
                          resize: 'vertical'
                        }}
                        placeholder="Referencia,Categoria,Descripcion,Costo,Por Mayor,Detal,50 Unidades&#10;SHD-001,Short Dama,SHORT TIRA,8047,16500,26500,15500&#10;SHD-002,Short Dama,SHORT TIRA PLUS,10672,21500,31500,20500"
                        value={pastedText}
                        onChange={e => setPastedText(e.target.value)}
                      />

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={handleTextImport}
                          style={{ padding: '0.65rem 2rem', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          📋 Procesar Texto
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* PRODUCT LIST PANEL */
                <div className="admin-panel">
                  <div className="panel-header">
                    <div>
                      <h3><Package size={16} /> Inventario ({filteredProducts.length})</h3>
                      <p>Todos los productos publicados en tu tienda</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
                      <button 
                        className="btn-secondary hover-lift" 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: '1px solid #fca5a5', color: '#b91c1c', background: '#fee2e2', padding: '0.55rem 1rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
                        onClick={() => setShowToolsModal(true)}
                      >
                        🔧 Depurar Catálogo
                      </button>
                      
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <div className="search-input-container" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                          <Search size={15} />
                        </span>
                        <input
                          className="search-bar"
                          style={{ width: '240px', padding: '0.55rem 1rem 0.55rem 2.25rem', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.85rem', transition: 'all 0.2s', margin: 0 }}
                          placeholder="Buscar producto..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <select
                        value={productSort}
                        onChange={e => setProductSort(e.target.value)}
                        style={{ padding: '0.55rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.85rem', background: 'white', color: '#475569', cursor: 'pointer' }}
                      >
                        <option value="recientes">Más recientes</option>
                        <option value="alfabetico">A-Z</option>
                        <option value="visibles">Solo Visibles</option>
                        <option value="ocultos">Solo Ocultos</option>
                      </select>
                      </div>
                    </div>
                  </div>
                <div className="panel-body">
                  {filteredProducts.length === 0 ? (
                    <div className="empty-state" style={{ padding: '4rem 2rem' }}>
                      <div className="empty-icon"><Package size={48} /></div>
                      <p>No se encontraron productos.</p>
                      {searchQuery && <button className="btn-secondary" onClick={() => setSearchQuery('')}>Limpiar Búsqueda</button>}
                    </div>
                  ) : (
                    <div className="products-grid">
                      {filteredProducts.map(p => (
                        <div key={p.id} className="product-card" style={{ opacity: p.oculto ? 0.5 : 1, filter: p.oculto ? 'grayscale(100%)' : 'none', background: p.oculto ? '#f8fafc' : 'white' }}>
                          <div className="product-card-img">
                            {p.imagen_url ? (
                              <img src={p.imagen_url} alt={p.nombre} />
                            ) : (p.imagenes_extra && p.imagenes_extra.length > 0 && decodeExtraImage(p.imagenes_extra[0]).url) ? (
                              <img src={decodeExtraImage(p.imagenes_extra[0]).url} alt={p.nombre} />
                            ) : (
                              '🖼️'
                            )}
                          </div>
                          <div className="product-card-body">
                            <h4>{p.nombre}</h4>
                            <p className="p-cat" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{p.categoria}</span>
                              <span style={{ background: '#e0e7ff', color: '#4f46e5', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>Stock: {p.stock || 0}</span>
                            </p>
                            
                            <div style={{ marginTop: '0.5rem', padding: '0.6rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                 <small style={{ color: '#64748b' }}>Detal:</small>
                                 <strong style={{ color: '#0f172a' }}>${p.precio?.toLocaleString()}</strong>
                               </div>
                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                 <small style={{ color: '#64748b' }}>Mayor:</small>
                                 <strong style={{ color: '#0f172a' }}>{p.precio_por_mayor ? `$${p.precio_por_mayor.toLocaleString()}` : '-'}</strong>
                               </div>
                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                 <small style={{ color: '#64748b' }}>50 Unid:</small>
                                 <strong style={{ color: '#0f172a' }}>{p.precio_50_unidades ? `$${p.precio_50_unidades.toLocaleString()}` : '-'}</strong>
                               </div>
                               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                 <small style={{ color: '#64748b' }}>Tallas:</small>
                                 <strong style={{ fontSize: '0.8rem', color: '#0f172a', textAlign: 'right', wordBreak: 'break-word', maxWidth: '120px' }}>{deduplicateTallas(p.tallas)}</strong>
                               </div>
                            </div>

                            {p.descripcion && (
                              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {p.descripcion}
                              </p>
                            )}
                          </div>
                          <div className="product-card-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem', padding: '0.65rem 0.9rem', background: '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                            <button 
                              className="btn-edit" 
                              style={{ padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', border: '1px solid #bae6fd', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', width: '32px', height: '32px' }}
                              onClick={() => { setEditingProduct(p); setEditExtraImages((p.imagenes_extra || []).map(u => decodeExtraImage(u))); }}
                              title="Editar Producto"
                            >
                              <Pencil size={14} />
                            </button>
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', border: '1px solid #e2e8f0', background: 'white', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', width: '32px', height: '32px' }}
                              onClick={() => handleDuplicate(p)} 
                              title="Duplicar Producto"
                            >
                              <Copy size={14} />
                            </button>
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', border: p.oculto ? '1px solid #fca5a5' : '1px solid #e2e8f0', background: p.oculto ? '#fee2e2' : 'white', color: p.oculto ? '#dc2626' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', width: '32px', height: '32px' }}
                              onClick={() => handleToggleVisibility(p)} 
                              title={p.oculto ? "Mostrar Producto" : "Ocultar Producto"}
                            >
                              {p.oculto ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button 
                              className="btn-danger" 
                              style={{ padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', width: '32px', height: '32px' }}
                              onClick={() => handleDelete(p.id)}
                              title="Eliminar Producto"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              )}
            </>
          )}

          {/* ── CATEGORIES TAB ── */}
          {activeTab === 'categorias' && (
            <>
              {isAddingCategory && (
                <div className="admin-panel">
                  <div className="panel-header">
                    <div>
                      <h3><Tag size={16} /> Crear Nueva Categoría</h3>
                      <p>Agrega una categoría al catálogo de tu negocio</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const nombre = (form.elements.namedItem('nombre') as HTMLInputElement).value;
                      const slug = (form.elements.namedItem('slug') as HTMLInputElement).value || nombre.toLowerCase().replace(/ /g, '-');
                      const icono = (form.elements.namedItem('icono') as HTMLInputElement).value;
                      const color = (form.elements.namedItem('color') as HTMLInputElement).value;
                      setLoading(true);
                      const { error } = await supabase.from('categorias').insert([{ nombre, slug, icono, color, tenant_id: getTenantId() }]);
                      setLoading(false);
                      if (error) showToast('Error: ' + error.message, 'error');
                      else { form.reset(); cargarDatos(); setIsAddingCategory(false); showToast('Categoría creada ✓'); }
                    }}>
                      <div className="form-grid" style={{ marginBottom: '1.5rem' }}>
                        <div className="form-field">
                          <label>Nombre de la Categoría</label>
                          <input required name="nombre" placeholder="Ej: Ropa de Bebés" />
                        </div>
                        <div className="form-field">
                          <label>Slug (identificador)</label>
                          <input name="slug" placeholder="Ej: bebe (auto si vacío)" />
                        </div>
                        <div className="form-field">
                          <label>Ícono (Emoji)</label>
                          <input name="icono" placeholder="👶" />
                        </div>
                        <div className="form-field">
                          <label>Color de Fondo</label>
                          <input name="color" placeholder="Ej: #92d0db" />
                        </div>
                      </div>
                      <button type="submit" className="btn-primary" disabled={loading}>
                        <Plus size={14} /> {loading ? 'Creando...' : 'Crear Categoría'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {isAddingSubcategory && (
                <div className="admin-panel">
                  <div className="panel-header">
                    <div>
                      <h3><Tag size={16} /> Crear Nueva Subcategoría</h3>
                      <p>Agrega una subcategoría a una de tus categorías</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      await handleCreateSubcategory(e);
                      setIsAddingSubcategory(false);
                    }}>
                      <div className="form-grid" style={{ marginBottom: '1.5rem' }}>
                        <div className="form-field">
                          <label>Categoría Padre *</label>
                          <select value={subcatParentId} onChange={e => setSubcatParentId(e.target.value)} required>
                            <option value="">-- Seleccionar categoría --</option>
                            {categoriasData.map(c => (
                              <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-field">
                          <label>Nombre de la Subcategoría *</label>
                          <input required value={subcatNombre} onChange={e => setSubcatNombre(e.target.value)} placeholder="Ej: Pijamas" />
                        </div>
                        <div className="form-field">
                          <label>Slug (auto si vacío)</label>
                          <input value={subcatSlug} onChange={e => setSubcatSlug(e.target.value)} placeholder="Ej: pijamas" />
                        </div>
                      </div>
                      <button type="submit" className="btn-primary" disabled={loading}>
                        <Plus size={14} /> {loading ? 'Creando...' : 'Crear Subcategoría'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {!isAddingCategory && !isAddingSubcategory && (
                <>
                  <div className="admin-panel">
                    <div className="panel-header">
                      <div>
                        <h3><Tag size={16} /> Categorías y Subcategorías</h3>
                        <p>Visualiza y administra la estructura del catálogo</p>
                      </div>
                    </div>
                    <div className="panel-body">
                      {categoriasData.length === 0 ? (
                        <div className="empty-state">
                          <div className="es-icon">🗂️</div>
                          <h4>Sin categorías</h4>
                          <p>Usa los botones de arriba para empezar</p>
                        </div>
                      ) : (
                        categoriasData.map(c => (
                          <div key={c.id} className="category-row">
                            {/* Thumbnail: imagen si existe, de lo contrario emoji */}
                            {c.imagen_url ? (
                              <img
                                src={c.imagen_url}
                                alt={c.nombre}
                                style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #f36b8e' }}
                              />
                            ) : (
                              <div className="cat-color-dot" style={{ background: c.color || '#333' }}>{c.icono}</div>
                            )}
                            <div className="cat-row-info">
                              <h4>{c.nombre}</h4>
                              <p>/{c.slug} · {productos.filter(p => p.categoria === c.slug || p.categoria === c.nombre).length} productos</p>
                            </div>
                            {/* Botón subir imagen de categoría */}
                            <label
                              title="Subir imagen"
                              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', background: '#f0f0f0', border: '1px solid #ddd' }}
                            >
                              <Upload size={13} />
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={async (ev) => {
                                  const file = ev.target.files?.[0];
                                  if (!file) return;
                                  setLoading(true);
                                  try {
                                    // PASO 1: subir al storage
                                    const ext = file.name.split('.').pop() || 'jpg';
                                    const fileName = `cat_${c.id}_${Date.now()}.${ext}`;
                                    const { error: upErr } = await supabase.storage
                                      .from('archivos')
                                      .upload(fileName, file, { upsert: true });
                                    if (upErr) {
                                      showToast(`Error Storage: ${upErr.message}`, 'error');
                                      return;
                                    }

                                    // PASO 2: obtener URL pública
                                    const { data: urlData } = supabase.storage
                                      .from('archivos')
                                      .getPublicUrl(fileName);

                                    // PASO 3: guardar URL en la tabla categorias
                                    const { error: dbErr } = await supabase
                                      .from('categorias')
                                      .update({ imagen_url: urlData.publicUrl })
                                      .eq('id', c.id);
                                    if (dbErr) {
                                      showToast(`Error DB: ${dbErr.message}`, 'error');
                                      return;
                                    }

                                    await cargarDatos();
                                    showToast('Imagen de categoría actualizada ✓');
                                  } catch (err: any) {
                                    showToast(`Error inesperado: ${err?.message || err}`, 'error');
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                              />
                            </label>
                            <button 
                              className="btn-edit" 
                              onClick={() => {
                                const link = `${window.location.origin}/${getTenantId()}?categoria=${c.slug}`;
                                navigator.clipboard.writeText(link);
                                showToast('Enlace de categoría copiado ✓', 'success');
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                              title="Copiar enlace permanente"
                            >
                              <Link size={11} /> Enlace
                            </button>
                            <button className="btn-edit" onClick={() => setEditingCategory(c)}>
                              <Pencil size={11} /> Editar
                            </button>
                            <button className="btn-danger" onClick={async () => {
                              if (!window.confirm('¿Eliminar categoría?')) return;
                              await supabase.from('categorias').delete().eq('id', c.id);
                              cargarDatos();
                              showToast('Categoría eliminada');
                            }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))
                      )}

                      <hr className="divider" style={{ margin: '2rem 0 1.5rem' }} />
                      <p style={{ fontSize: '0.78rem', color: '#555', marginBottom: '1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subcategorías Activas</p>
                      <div className="category-list">
                        {subcategoriasData.length === 0 ? (
                          <div className="empty-state">
                            <div className="es-icon">📂</div>
                            <h4>Sin subcategorías</h4>
                            <p>Usa los botones de arriba para agregar subcategorías</p>
                          </div>
                        ) : (
                          subcategoriasData.map(s => {
                            const parentCat = categoriasData.find(c => c.id === s.categoria_id);
                            return (
                              <div key={s.id} className="category-row">
                                <div className="cat-color-dot" style={{ background: parentCat?.color || '#888' }}>
                                  {parentCat?.icono || '📂'}
                                </div>
                                <div className="cat-row-info">
                                  <h4>{s.nombre}</h4>
                                  <p>/{s.slug} · en {parentCat?.nombre || 'Categoría eliminada'}</p>
                                </div>
                                <button 
                                  className="btn-edit" 
                                  onClick={() => {
                                    const parentCat = categoriasData.find(c => c.id === s.categoria_id);
                                    const link = `${window.location.origin}/${getTenantId()}?categoria=${parentCat?.slug || ''}&subcategoria=${s.slug}`;
                                    navigator.clipboard.writeText(link);
                                    showToast('Enlace de subcategoría copiado ✓', 'success');
                                  }}
                                  style={{ padding: '0.4rem 0.6rem', height: 30, display: 'flex', alignItems: 'center', gap: '0.2rem', borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}
                                  title="Copiar enlace permanente"
                                >
                                  <Link size={11} /> Enlace
                                </button>
                                <button className="btn-edit" onClick={() => setEditingSubcategory(s)} style={{ padding: '0.4rem 0.6rem', height: 30, display: 'flex', alignItems: 'center', gap: '0.2rem', borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}>
                                  <Pencil size={11} /> Editar
                                </button>
                                <button className="btn-danger" onClick={() => handleDeleteSubcategory(s.id)}>
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── RESUMEN ASESOR TAB ── */}
          {activeTab === 'resumen_asesor' && (role === 'asesor' || role === 'mayorista') && (() => {
            const currentAsesorData = role === 'mayorista'
              ? mayoristas.find(m => m.telefono === loggedAsesorPhone) || asesores.find(a => a.telefono === loggedAsesorPhone)
              : asesores.find(a => a.telefono === loggedAsesorPhone);
            if (!currentAsesorData) return <p style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>Cargando datos...</p>;
            const advStats = getAdvisorStats(currentAsesorData);

            return (
              <>
                <div className="admin-panel" style={{ borderRadius: '20px', padding: '1.5rem 1.75rem' }}>
                  <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}>
                    <span style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📊</span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                      <h2 className="panel-header-title-custom">{role === 'mayorista' ? 'Mi Resumen de Negocio' : 'Mi Resumen de Ventas'}</h2>
                      <p style={{ margin: '0.15rem 0 0 0', color: '#64748b', fontSize: '0.85rem', textAlign: 'left' }}>{role === 'mayorista' ? 'Visualiza las métricas, mejores horarios y productos de tu negocio' : 'Visualiza tus métricas, mejores horarios y productos vendidos'}</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    {renderAdvisorStatsView(advStats)}
                  </div>
                </div>
              </>
            );
          })()}

          {/* ── NOTIFICACIONES ASESOR TAB ── */}
          {activeTab === 'notificaciones_asesor' && (role === 'asesor' || role === 'mayorista') && (() => {
            const currentAsesorData = role === 'mayorista'
              ? mayoristas.find(m => m.telefono === loggedAsesorPhone) || asesores.find(a => a.telefono === loggedAsesorPhone)
              : asesores.find(a => a.telefono === loggedAsesorPhone);
            if (!currentAsesorData) return <p style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>Cargando notificaciones...</p>;
            
            const stats = getAdvisorStats(currentAsesorData);
            const primaryColor = configuracion?.color_primario || '#6366f1';

            return (
              <div className="admin-panel" style={{ borderRadius: '20px', padding: '1.5rem 1.75rem' }}>
                <style>{`
                  @keyframes alertPulseDanger {
                    0% {
                      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
                      border-color: rgba(239, 68, 68, 0.7);
                    }
                    50% {
                      box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
                      border-color: rgba(239, 68, 68, 0.3);
                    }
                    100% {
                      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
                      border-color: rgba(239, 68, 68, 0.7);
                    }
                  }
                  @keyframes alertPulseWarning {
                    0% {
                      box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4);
                      border-color: rgba(245, 158, 11, 0.7);
                    }
                    50% {
                      box-shadow: 0 0 0 10px rgba(245, 158, 11, 0);
                      border-color: rgba(245, 158, 11, 0.3);
                    }
                    100% {
                      box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
                      border-color: rgba(245, 158, 11, 0.7);
                    }
                  }
                  .alert-card-danger {
                    animation: alertPulseDanger 2s infinite ease-in-out;
                  }
                  .alert-card-warning {
                    animation: alertPulseWarning 2s infinite ease-in-out;
                  }
                  .notif-hover {
                    transition: all 0.25s ease-in-out;
                  }
                  .notif-hover:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 16px -3px rgba(0, 0, 0, 0.06), 0 3px 6px -2px rgba(0, 0, 0, 0.03);
                  }
                `}</style>

                <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}>
                  <div style={{ background: '#fee2e2', padding: '0.5rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Lightbulb size={24} style={{ color: '#ef4444' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                    <h2 className="panel-header-title-custom">Centro de Notificaciones y Alertas</h2>
                    <p style={{ margin: '0.15rem 0 0 0', color: '#64748b', fontSize: '0.85rem', textAlign: 'left' }}>Alertas de tiempo de respuesta y recordatorios de retargeting</p>
                  </div>
                </div>

                <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Notifications list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 800, color: '#1e293b', textAlign: 'left' }}>Alertas Activas ({activeNotifications.length})</h3>
                    {activeNotifications.length === 0 ? (
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2.5rem 2rem', textAlign: 'center', color: '#64748b' }}>
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>🎉</p>
                        <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#475569' }}>¡Estás al día!</p>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>No tienes tareas ni alertas pendientes de respuesta en este momento.</p>
                      </div>
                    ) : (
                      activeNotifications.map((notif: any) => {
                        const isDanger = notif.type === 'danger';
                        const isWarning = notif.type === 'warning';
                        const isSuccess = notif.type === 'success';

                        let cardClass = "notif-hover ";
                        if (isDanger) cardClass += "alert-card-danger";
                        else if (isWarning) cardClass += "alert-card-warning";

                        return (
                          <div 
                            key={notif.id}
                            className={cardClass}
                            style={{
                              background: isDanger 
                                ? 'linear-gradient(135deg, #fff5f5, #fef2f2)' 
                                : isWarning 
                                  ? 'linear-gradient(135deg, #fffbeb, #fffcf0)' 
                                  : isSuccess 
                                    ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' 
                                    : 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
                              border: `1.5px solid ${isDanger ? '#f87171' : isWarning ? '#fbbf24' : isSuccess ? '#4ade80' : '#60a5fa'}`,
                              borderRadius: '16px',
                              padding: '1.1rem 1.25rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '1rem',
                              textAlign: 'left',
                              position: 'relative',
                              overflow: 'hidden'
                            }}
                          >
                            {/* Decorative background symbol */}
                            <div style={{
                              position: 'absolute',
                              right: '-10px',
                              top: '-10px',
                              fontSize: '4.5rem',
                              opacity: 0.05,
                              pointerEvents: 'none',
                              userSelect: 'none'
                            }}>
                              {isDanger ? '🚨' : isWarning ? '⏳' : isSuccess ? '🎉' : '🔔'}
                            </div>

                            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start', flex: 1, zIndex: 1 }}>
                              <span style={{ fontSize: '1.3rem', marginTop: '0.1rem' }}>
                                {isDanger ? '🔴' : isWarning ? '🟡' : isSuccess ? '🟢' : '🔵'}
                              </span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>{notif.title}</h4>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: 1.45, fontWeight: 500 }}>{notif.message}</p>
                                <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem', fontWeight: 600 }}>
                                  ⏰ {new Date(notif.time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>

                            {notif.actionTab && (
                              <button
                                onClick={() => setActiveTab(notif.actionTab)}
                                style={{
                                  background: isDanger ? '#ef4444' : isWarning ? '#f59e0b' : primaryColor,
                                  color: 'white',
                                  border: 'none',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '10px',
                                  fontSize: '0.8rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06)',
                                  transition: 'all 0.2s',
                                  zIndex: 1
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                  e.currentTarget.style.boxShadow = '0 6px 8px -1px rgba(0,0,0,0.1)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'none';
                                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.06)';
                                }}
                              >
                                Ir a atender →
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Collapsible Sales Tips */}
                  <details 
                    style={{ 
                      border: '1.5px solid #cbd5e1', 
                      borderRadius: '16px', 
                      overflow: 'hidden',
                      marginTop: '0.75rem',
                      background: '#f8fafc',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
                    }}
                  >
                    <summary 
                      style={{ 
                        padding: '1.1rem 1.4rem', 
                        fontSize: '0.96rem', 
                        fontWeight: 800, 
                        color: '#1e293b', 
                        background: '#f1f5f9', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        userSelect: 'none' 
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>💡 Consejos de Venta & Metas Diarias</span>
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>▼</span>
                    </summary>
                    <div style={{ padding: '1.5rem', background: 'white', borderTop: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Daily specific advisor advise */}
                      {stats && (() => {
                        const bestDay = stats.bestDay as { day: number; name: string; count: number };
                        const bestHour = stats.bestHour as [string, number];
                        const aLeads = stats.aLeads;
                        const topSellingProducts = stats.topSellingProducts;
                        const today = new Date();
                        const dayOfWeek = today.getDay();
                        const horaLabels = [
                          '12:00 AM', '1:00 AM', '2:00 AM', '3:00 AM', '4:00 AM', '5:00 AM', '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
                          '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM'
                        ];
                        const topProdName = topSellingProducts.length > 0 ? topSellingProducts[0].nombre : 'ninguno aún';
                        const topProdQty = topSellingProducts.length > 0 ? topSellingProducts[0].cantidad : 0;

                        return (
                          <>
                            {dayOfWeek === 1 && (
                              <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1.5px solid #bfdbfe', borderRadius: '12px', padding: '1.1rem 1.25rem', textAlign: 'left', position: 'relative' }}>
                                <div style={{ position: 'absolute', right: '15px', top: '10px', fontSize: '2.5rem', opacity: 0.15 }}>📊</div>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e40af', fontWeight: 800, fontSize: '0.92rem' }}>📊 Resumen de Ventas de la Semana</h4>
                                <p style={{ margin: 0, fontSize: '0.84rem', color: '#1e3a8a', lineHeight: 1.5, fontWeight: 500 }}>
                                  Tu mejor día histórico de ventas es el <strong>{bestDay.count > 0 ? bestDay.name : 'fin de semana'}</strong> con <strong>{bestDay.count} pedidos</strong>. Aprovecha para publicar contenido y pautar en esos días.
                                </p>
                              </div>
                            )}

                            <div style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '1.5px solid #fde68a', borderRadius: '12px', padding: '1.1rem 1.25rem', textAlign: 'left', position: 'relative' }}>
                              <div style={{ position: 'absolute', right: '15px', top: '10px', fontSize: '2.5rem', opacity: 0.15 }}>🎯</div>
                              <h4 style={{ margin: '0 0 0.4rem 0', color: '#b45309', fontWeight: 800, fontSize: '0.92rem' }}>🎯 Meta para hoy ({['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dayOfWeek]})</h4>
                              <p style={{ margin: 0, fontSize: '0.84rem', color: '#78350f', lineHeight: 1.5, fontWeight: 500 }}>
                                {(() => {
                                  switch (dayOfWeek) {
                                    case 0: return 'Planifica tu semana y define tus metas de comisiones.';
                                    case 1: return `Contacta a tus ${aLeads.length} carritos abandonados. ¡Recupera ventas perdidas hoy!`;
                                    case 2: return 'Haz seguimiento a clientes con estados "Pendiente de Pago".';
                                    case 3: return 'Saluda a tus clientes usando su nombre para aumentar la confianza.';
                                    case 4: return `Ofrece el artículo de alta demanda: "${topProdName}" (${topProdQty} vendidos) como recomendación.`;
                                    case 5: return `Tu pico máximo de ventas suele ser a las ${bestHour && Number(bestHour[1]) > 0 ? `${horaLabels[Number(bestHour[0])]}` : 'las tardes'}. Mantente alerta.`;
                                    case 6: return 'Responde al instante: Las respuestas rápidas multiplican por 3 el cierre de ventas.';
                                    default: return 'Actualiza tu stock y verifica las comisiones acumuladas.';
                                  }
                                })()}
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </details>
                </div>
              </div>
            );
          })()}


          {/* ── PERFIL ASESOR TAB ── */}
          {activeTab === 'perfil_asesor' && (role === 'asesor' || role === 'mayorista') && (
            <div className="admin-panel">
              <div className="panel-header">
                <div>
                  <h3><User size={16} /> Mi Perfil</h3>
                  <p>Configura tus datos personales</p>
                </div>
              </div>
              <div className="panel-body">
                {(() => {
                  const currentAsesorData = role === 'mayorista'
                    ? mayoristas.find(m => m.telefono === loggedAsesorPhone) || asesores.find(a => a.telefono === loggedAsesorPhone)
                    : asesores.find(a => a.telefono === loggedAsesorPhone);
                  if (!currentAsesorData) return <p style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>Cargando perfil...</p>;
                  return (
                    <>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      setLoading(true);
                      const tableName = role === 'mayorista' ? 'mayoristas' : 'asesores';
                      const { error } = await supabase
                        .from(tableName)
                        .update({
                          nombre: (document.getElementById('perfil-nombre') as HTMLInputElement).value,
                          foto_url: (document.getElementById('perfil-foto') as HTMLInputElement).value,
                        })
                        .eq('id', currentAsesorData.id);
                      if (error) throw error;
                      showToast('Perfil actualizado correctamente', 'success');
                      // Update local state
                      if (role === 'mayorista') {
                        setMayoristas(mayoristas.map(m =>
                          m.id === currentAsesorData.id
                            ? { ...m,
                                nombre: (document.getElementById('perfil-nombre') as HTMLInputElement).value,
                                foto_url: (document.getElementById('perfil-foto') as HTMLInputElement).value,
                              }
                            : m
                        ));
                      } else {
                        setAsesores(asesores.map(a =>
                          a.id === currentAsesorData.id
                            ? { ...a,
                                nombre: (document.getElementById('perfil-nombre') as HTMLInputElement).value,
                                foto_url: (document.getElementById('perfil-foto') as HTMLInputElement).value,
                              }
                            : a
                        ));
                      }
                  
                    } catch (err: any) {
                      showToast(err.message || 'Error al actualizar', 'error');
                    } finally {
                      setLoading(false);
                    }
                  }}>
                    <div className="form-grid">
                      <div className="form-field">
                        <label>Tu Nombre</label>
                        <input 
                          type="text" 
                          id="perfil-nombre"
                          defaultValue={currentAsesorData.nombre} 
                          required 
                        />
                      </div>
                      <div className="form-field">
                        <label>Teléfono (Línea WhatsApp)</label>
                        <input 
                          type="text" 
                          disabled
                          defaultValue={loggedAsesorPhone || ''} 
                        />
                        <small style={{color: '#64748b'}}>El número de teléfono no se puede cambiar aquí.</small>
                      </div>
                      <div className="form-field">
                        <label>PIN de Acceso</label>
                        <input 
                          type="text" 
                          id="perfil-pin"
                          disabled
                          defaultValue={currentAsesorData.pin} 
                          required 
                        />
                        <small style={{color: '#64748b'}}>Solo el administrador puede cambiar tu PIN de acceso.</small>
                      </div>
                      <div className="form-field">
                        <label>Foto de Perfil</label>
                        <div className="img-input-row" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {currentAsesorData.foto_url && (
                            <img src={currentAsesorData.foto_url ?? ''} className="img-preview-thumb" alt="Foto Perfil" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }} />
                          )}
                          <input 
                            type="url" 
                            id="perfil-foto"
                            defaultValue={currentAsesorData.foto_url || ''} 
                            placeholder="https://ejemplo.com/foto.jpg"
                            style={{ flex: 1 }}
                          />
                          <label className="btn-upload-img" style={{ flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.8rem', background: '#f1f5f9', borderRadius: '6px', fontSize: '0.85rem', border: '1px solid #cbd5e1', fontWeight: 600 }}>
                            <Upload size={14} /> Subir
                            <input type="file" style={{ display: 'none' }} accept="image/*" onChange={async (e) => {
                              if (!e.target.files || !e.target.files[0]) return;
                              try {
                                showToast('Subiendo foto...', 'success');
                                const file = e.target.files[0];
                                const compFile = await compressImage(file);
                                const fileName = `asesor_${Date.now()}.${compFile.name.split('.').pop()}`;
                                await supabase.storage.from('archivos').upload(fileName, compFile);
                                const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
                                const input = document.getElementById('perfil-foto') as HTMLInputElement;
                                if (input) input.value = data.publicUrl;
                                showToast('Foto subida. Recuerda Guardar Perfil ✅', 'success');
                                
                                // Actualizar previsualización local
                                // currentAsesorData ya existe en el scope exterior
                                if (currentAsesorData) {
                                  if (role === 'mayorista') {
                                    setMayoristas(mayoristas.map(m => m.id === currentAsesorData.id ? { ...m, foto_url: data.publicUrl } : m));
                                  } else {
                                    setAsesores(asesores.map(a => a.id === currentAsesorData.id ? { ...a, foto_url: data.publicUrl } : a));
                                  }
                                }
                              } catch {
                                showToast('Error al subir foto', 'error');
                              }
                            }} />
                          </label>
                        </div>
                        <small style={{color: '#64748b'}}>Esta foto aparecerá en tu panel y como asesor estrella.</small>
                      </div>
                      <div className="form-field full" style={{ marginTop: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <label style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', display: 'block' }}>🔗 Tus Enlaces de Venta Personalizados</label>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem 0' }}>Usa estos enlaces para compartirlos con tus clientes. Cuando compren a través de ellos, las ventas se te asignarán automáticamente.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {(loggedAsesorPhone || '').split(',').map(p => p.trim()).filter(Boolean).map((phone, idx) => {
                            const link = `${window.location.origin}/${getTenantId()}?ws=${phone.replace(/\D/g, '')}${role === 'mayorista' ? '&tipo=mayorista' : ''}`;
                            return (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>Línea {phone}:</span>
                                <input 
                                  readOnly 
                                  value={link} 
                                  style={{ flex: 1, fontSize: '0.8rem', background: 'transparent', border: 'none', color: 'var(--primary-color, #6366f1)', fontWeight: 600, padding: 0 }} 
                                  onClick={(e) => (e.target as HTMLInputElement).select()}
                                />
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '6px', cursor: 'pointer', border: '1px solid #cbd5e1', background: 'white' }}
                                  onClick={() => {
                                    navigator.clipboard.writeText(link);
                                    showToast('Enlace copiado al portapapeles ✅', 'success');
                                  }}
                                >
                                  Copiar
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="form-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Guardando...' : 'Guardar Perfil'}
                      </button>
                    </div>
                  </form>
                  {role === 'mayorista' && (
                    <MiNegocioSettings 
                      mayorista={currentAsesorData as Mayorista}
                      showToast={showToast}
                      onSave={async (data) => {
                        const { error } = await supabase
                          .from('mayoristas')
                          .update(data)
                          .eq('id', currentAsesorData.id);
                        if (error) throw error;
                        // Actualizar el estado local
                        setMayoristas(mayoristas.map(m => m.id === currentAsesorData.id ? { ...m, ...data } : m));
                      }}
                    />
                  )}
                  </>
                  );
                })()}
              </div>
            </div>
          )}


          
          {/* ── PRODUCTOS ASESOR TAB ── */}
          {activeTab === 'productos_asesor' && (
            <div className="admin-panel">
              <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Package size={18} /> Productos</h3>
                  <p className="panel-header-subtitle" style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                    Visualiza los productos disponibles en el catálogo de la empresa.
                  </p>
                </div>
              </div>
              <div className="panel-body">
                <div className="products-grid">
                  {productos.map(p => (
                    <div key={p.id} className="product-card">
                      <div className="product-card-img">
                        {p.imagen_url ? (
                          <img src={p.imagen_url} alt={p.nombre} />
                        ) : (p.imagenes_extra && p.imagenes_extra.length > 0 && decodeExtraImage(p.imagenes_extra[0]).url) ? (
                          <img src={decodeExtraImage(p.imagenes_extra[0]).url} alt={p.nombre} />
                        ) : (
                          <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'#f1f5f9'}}><Package size={24} color="#94a3b8" /></div>
                        )}
                      </div>
                      <div className="product-card-body">
                        <h4>{p.nombre}</h4>
                        <p className="p-cat" style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.referencia}</p>
                        
                        <div style={{ marginTop: '0.8rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                             <small style={{ color: '#64748b' }}>Detal:</small>
                             <strong style={{ color: '#0f172a' }}>${p.precio?.toLocaleString()}</strong>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                             <small style={{ color: '#64748b' }}>Mayor:</small>
                             <strong>{p.precio_por_mayor ? `${p.precio_por_mayor.toLocaleString()}` : '-'}</strong>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                             <small style={{ color: '#64748b' }}>50 Unid:</small>
                             <strong>{p.precio_50_unidades ? `$${p.precio_50_unidades.toLocaleString()}` : '-'}</strong>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                             <small style={{ color: '#64748b' }}>Tallas:</small>
                             <strong style={{ fontSize: '0.8rem', color: '#0f172a', textAlign: 'right', wordBreak: 'break-word', maxWidth: '120px' }}>{deduplicateTallas(p.tallas)}</strong>
                           </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}



          {/* ── PRODUCTOS MAYORISTA TAB ── */}
          {activeTab === 'productos_mayorista' && (
            <div className="admin-panel">
              <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Package size={18} /> Productos</h3>
                  <p className="panel-header-subtitle" style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                    Configura tu porcentaje de ganancia general o precios especiales por producto.
                  </p>
                </div>
              </div>
              <div className="panel-body">
                {role === 'mayorista' && (
                  !currentMayorista ? (
                    <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#fee2e2', borderRadius: '12px', color: '#991b1b' }}>
                      <strong>Error de Sesión:</strong> No se pudo cargar tu perfil de mayorista. Por favor, cierra sesión e ingresa nuevamente.
                    </div>
                  ) : (
                  <div className="wholesaler-markup-container">
                    <div className="wholesaler-markup-info">
                      <h4 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 800 }}>Ganancia Global</h4>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>Porcentaje de incremento (%) sobre el precio base de todos los productos</p>
                    </div>
                    <div className="wholesaler-markup-controls">
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input 
                          type="number" 
                          id="mayorista-markup"
                          defaultValue={currentMayorista.porcentaje_ganancia || 0}
                          min="0"
                          step="0.1"
                          style={{ width: '100px', padding: '0.55rem 1.5rem 0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700, textAlign: 'center', outline: 'none', margin: 0 }}
                        />
                        <span style={{ position: 'absolute', right: '0.75rem', color: '#64748b', fontWeight: 800, fontSize: '0.88rem' }}>%</span>
                      </div>
                      <button 
                        className="btn-primary"
                        style={{ margin: 0, padding: '0.55rem 1.25rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.88rem', background: configuracion?.color_primario || '#4f46e5', color: 'white', border: 'none', cursor: 'pointer' }}
                        onClick={async () => {
                          try {
                            setLoading(true);
                            const val = Number((document.getElementById('mayorista-markup') as HTMLInputElement).value);
                            const { error } = await supabase.from('mayoristas').update({ porcentaje_ganancia: val }).eq('id', currentMayorista.id);
                            if (error) throw error;
                            showToast('Porcentaje global actualizado correctamente', 'success');
                            // Fallback if setMayoristas doesn't work, wait 1 sec and reload or rely on state
                            setMayoristas(mayoristas.map(m => m.id === currentMayorista.id ? { ...m, porcentaje_ganancia: val } : m));
                          } catch(e: any) {
                            showToast(e.message || 'Error al actualizar', 'error');
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        Guardar Porcentaje
                      </button>
                    </div>
                  </div>
                )
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                  <div className="search-input-container" style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                    <span style={{ position: 'absolute', left: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                      <Search size={15} />
                    </span>
                    <input
                      className="search-bar"
                      style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', transition: 'all 0.2s', margin: 0, background: 'white' }}
                      placeholder="Buscar producto o ref..."
                      value={mayoristaSearchQuery}
                      onChange={e => setMayoristaSearchQuery(e.target.value)}
                    />
                  </div>
                  <select
                    value={mayoristaCategoryFilter}
                    onChange={e => setMayoristaCategoryFilter(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', background: 'white', color: '#475569', cursor: 'pointer' }}
                  >
                    <option value="todos">Todas las categorías</option>
                    {categoriasData.map(c => <option key={c.id} value={c.slug}>{c.nombre}</option>)}
                  </select>
                  <select
                    value={mayoristaProductSort}
                    onChange={e => setMayoristaProductSort(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', background: 'white', color: '#475569', cursor: 'pointer' }}
                  >
                    <option value="recientes">Más recientes</option>
                    <option value="alfabetico">A-Z</option>
                    <option value="visibles">Solo Visibles</option>
                    <option value="ocultos">Solo Ocultos</option>
                  </select>
                </div>

                <div className="products-grid">
                      {mayoristaFilteredProducts.map(p => {
                        let hasOverride = false;
                        let overrideVal = '';
                        let isHiddenLocally = false;
                        if (role === 'mayorista' && currentMayorista) {
                          const overrides = currentMayorista.ajustes_productos || {};
                          if (overrides[p.id]) {
                            hasOverride = true;
                            overrideVal = overrides[p.id];
                          }
                          const hiddenProducts = overrides.hidden_products || [];
                          isHiddenLocally = hiddenProducts.includes(p.id);
                        }
                        
                        return (
                        <div key={p.id} className="product-card" style={{ opacity: isHiddenLocally ? 0.5 : 1, filter: isHiddenLocally ? 'grayscale(100%)' : 'none', background: isHiddenLocally ? '#f8fafc' : 'white' }}>
                          <div className="product-card-img">
                            {p.imagen_url ? (
                              <img src={p.imagen_url} alt={p.nombre} />
                            ) : (p.imagenes_extra && p.imagenes_extra.length > 0 && decodeExtraImage(p.imagenes_extra[0]).url) ? (
                              <img src={decodeExtraImage(p.imagenes_extra[0]).url} alt={p.nombre} />
                            ) : (
                              <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'#f1f5f9'}}><Package size={24} color="#94a3b8" /></div>
                            )}
                          </div>
                          <div className="product-card-body">
                            <h4>{p.nombre}</h4>
                            <p className="p-cat" style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.referencia}</p>
                            
                            <div style={{ marginTop: '0.8rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                 <small style={{ color: '#64748b' }}>Detal:</small>
                                 <strong style={{ color: '#0f172a' }}>${p.precio?.toLocaleString()}</strong>
                               </div>
                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                 <small style={{ color: '#64748b' }}>Mayor:</small>
                                 <strong>{p.precio_por_mayor ? `${p.precio_por_mayor.toLocaleString()}` : '-'}</strong>
                               </div>
                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                 <small style={{ color: '#64748b' }}>50 Unid:</small>
                                 <strong>{p.precio_50_unidades ? `${p.precio_50_unidades.toLocaleString()}` : '-'}</strong>
                               </div>
                               
                               {role === 'mayorista' && currentMayorista && (
                                 <div style={{ borderTop: '1px dashed #cbd5e1', margin: '0.5rem 0 0 0', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                   <small style={{ color: '#64748b', fontWeight: 600 }}>Tu Precio Final:</small>
                                   <strong style={{ color: hasOverride ? '#94a3b8' : '#10b981', textDecoration: hasOverride ? 'line-through' : 'none' }}>
                                     ${Math.round(p.precio * (1 + (currentMayorista?.porcentaje_ganancia || 0) / 100)).toLocaleString()}
                                   </strong>
                                 </div>
                               )}
                            </div>
                          </div>
                          
                          {role === 'mayorista' && currentMayorista && (() => {
                              const hiddenProducts = currentMayorista.ajustes_productos?.hidden_products || [];
                              const isHiddenLocally = hiddenProducts.includes(p.id);
                              
                              return (
                                <div className="product-card-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem 0.9rem', background: '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                     <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Fijar Precio Especial Manual:</label>
                                     <button 
                                       style={{ background: isHiddenLocally ? '#fee2e2' : 'transparent', border: isHiddenLocally ? '1px solid #fca5a5' : '1px solid #cbd5e1', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isHiddenLocally ? '#dc2626' : '#64748b' }}
                                       title={isHiddenLocally ? 'Mostrar en mi catálogo' : 'Ocultar de mi catálogo'}
                                       onClick={async () => {
                                         try {
                                           setLoading(true);
                                           const currentOverrides = { ...(currentMayorista.ajustes_productos || {}) };
                                           let currentHidden = [...(currentOverrides.hidden_products || [])];
                                           if (isHiddenLocally) {
                                             currentHidden = currentHidden.filter((id: string) => id !== p.id);
                                           } else {
                                             currentHidden.push(p.id);
                                           }
                                           currentOverrides.hidden_products = currentHidden;
                                           const { error } = await supabase.from('mayoristas').update({ ajustes_productos: currentOverrides }).eq('id', currentMayorista.id);
                                           if (error) throw error;
                                           setMayoristas(mayoristas.map(m => m.id === currentMayorista.id ? { ...m, ajustes_productos: currentOverrides } : m));
                                           showToast(isHiddenLocally ? 'Producto visible en tu catálogo' : 'Producto oculto de tu catálogo', 'success');
                                         } catch (e: any) {
                                           showToast('Error cambiando visibilidad', 'error');
                                         } finally {
                                           setLoading(false);
                                         }
                                       }}
                                     >
                                       {isHiddenLocally ? <EyeOff size={14} /> : <Eye size={14} />}
                                     </button>
                                   </div>
                                   <div className="product-override-row">
                                 <input 
                                   type="number" 
                                   placeholder="Ej: 50000"
                                   defaultValue={overrideVal}
                                   id={`override-${p.id}`}
                                   style={{ flex: 1, minWidth: '0', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                                 />
                                 <button 
                                   className="btn-primary"
                                   style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', background: configuracion?.color_primario || '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                                   onClick={async () => {
                                     try {
                                       setLoading(true);
                                       const inputVal = (document.getElementById(`override-${p.id}`) as HTMLInputElement).value;
                                       const currentOverrides = { ...(currentMayorista.ajustes_productos || {}) };
                                       
                                       if (!inputVal) {
                                         delete currentOverrides[p.id];
                                       } else {
                                         currentOverrides[p.id] = Number(inputVal);
                                       }
                                       
                                       const { error } = await supabase.from('mayoristas').update({ ajustes_productos: currentOverrides }).eq('id', currentMayorista.id);
                                       if (error) throw error;
                                       showToast(!inputVal ? 'Precio especial removido' : 'Precio especial guardado', 'success');
                                       setMayoristas(mayoristas.map(m => m.id === currentMayorista.id ? { ...m, ajustes_productos: currentOverrides } : m));
                                     } catch(e: any) {
                                       showToast(e.message || 'Error al actualizar', 'error');
                                     } finally {
                                       setLoading(false);
                                     }
                                   }}
                                 >
                                   Guardar
                                 </button>
                               </div>
                               {hasOverride && (
                                 <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600, marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Check size={12} /> Aplicando precio de: ${Number(overrideVal).toLocaleString()}
                                 </div>
                               )}
                            </div>
                           );
                          })()}
                        </div>
                        );
                      })}
                    </div>
              </div>
            </div>
          )}



          {/* ── RANKING MAYORISTA TAB ── */}
          {activeTab === 'ranking_mayorista' && (role === 'asesor' || role === 'mayorista') && (() => {
            const currentAsesorData = role === 'mayorista'
              ? mayoristas.find(m => m.telefono === loggedAsesorPhone) || asesores.find(a => a.telefono === loggedAsesorPhone)
              : asesores.find(a => a.telefono === loggedAsesorPhone);
            if (!currentAsesorData) return <p style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>Cargando ranking...</p>;

            const mPhones2 = (currentAsesorData.telefono || '').split(',').map((ph: string) => {
              const clean = ph.trim().replace(/\D/g, '');
              return clean.length === 12 && clean.startsWith('57') ? clean.substring(2) : clean;
            }).filter(Boolean);
            const allMayoristas = mayoristas;
            const rankingData = allMayoristas.map(m => {
              const mPs = (m.telefono || '').split(',').map((ph: string) => {
                const clean = ph.replace(/\D/g, '');
                return clean.length === 12 && clean.startsWith('57') ? clean.substring(2) : clean;
              }).filter(Boolean);
              const total = pedidos
                .filter(p => {
                  if (p.estado !== 'completado') return false;
                  if (!p.linea_whatsapp) return false;
                  const cleanP = p.linea_whatsapp.replace(/\D/g, '');
                  const normP = cleanP.length === 12 && cleanP.startsWith('57') ? cleanP.substring(2) : cleanP;
                  return mPs.includes(normP);
                })
                .reduce((s, p) => s + (p.total || 0), 0);
              return { id: m.id, nombre: m.nombre, total, foto_url: m.foto_url, isMe: mPs.some(ph => mPhones2.includes(ph)) };
            }).sort((a, b) => b.total - a.total);

            const myPos = rankingData.findIndex(r => r.isMe);
            const myData = rankingData[myPos];
            const myTotal = myData ? myData.total : 0;
            const myPoints = Math.round(myTotal / 1000);
            
            const leader = rankingData[0];
            const gapToLeader = myData && leader && !myData.isMe ? leader.total - myData.total : 0;
            const medals = ['🥇','🥈','🥉'];
            const primaryColor = configuracion?.color_primario || '#6366f1';

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
                {/* Cabecera del Ranking */}
                <div className="admin-panel" style={{ borderRadius: '20px', padding: '1.5rem 1.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexDirection: 'row' }}>
                    <div style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)', width: '46px', height: '46px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 4px 8px rgba(217, 119, 6, 0.15)', flexShrink: 0 }}>
                      🏆
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Ranking de Mayoristas</h2>
                      <p style={{ margin: '0.1rem 0 0 0', color: '#64748b', fontSize: '0.78rem', lineHeight: 1.3 }}>Gamificación y puntaje en base a compras completadas</p>
                    </div>
                  </div>
                </div>

                {/* Métricas de Gamificación del Usuario */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
                  {/* Card 1: Puntos */}
                  <div className="metric-card" style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)`, color: 'white', border: 'none' }}>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.85, fontWeight: 700 }}>Tus Puntos de Crecimiento</span>
                    <h2 style={{ margin: '0.2rem 0', fontSize: '2rem', fontWeight: 800, color: 'white', fontFamily: 'Outfit' }}>
                      {myPoints.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 600 }}>pts</span>
                    </h2>
                    <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>1 punto por cada $1,000 COP en compras completadas</span>
                  </div>

                  {/* Card 2: Posición */}
                  <div className="metric-card" style={{ background: `linear-gradient(135deg, ${primaryColor}dd 0%, ${primaryColor}99 100%)`, color: 'white', border: 'none' }}>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.85, fontWeight: 700 }}>Tu Posición Global</span>
                    <h2 style={{ margin: '0.2rem 0', fontSize: '2rem', fontWeight: 800, color: 'white', fontFamily: 'Outfit' }}>
                      {myPos >= 0 ? `${medals[myPos] || ''} #${myPos + 1}` : 'Sin posición'}
                    </h2>
                    <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>De {rankingData.length} mayoristas registrados</span>
                  </div>

                  {/* Card 3: Compras */}
                  <div className="metric-card" style={{ background: `linear-gradient(135deg, ${primaryColor}bb 0%, ${primaryColor}77 100%)`, color: 'white', border: 'none' }}>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.85, fontWeight: 700 }}>Total Compras</span>
                    <h2 style={{ margin: '0.2rem 0', fontSize: '1.8rem', fontWeight: 800, color: 'white', fontFamily: 'Outfit' }}>
                      ${myTotal.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>COP</span>
                    </h2>
                    <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>Solo pedidos completados con éxito</span>
                  </div>
                </div>

                {/* Contenido Principal: Leaderboard y Gamificación */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
                  
                  {/* Columna Izquierda: Leaderboard completo */}
                  <div className="admin-panel" style={{ borderRadius: '20px', padding: '1.5rem 1.75rem' }}>
                    <h3 style={{ margin: '0 0 1.25rem 0', fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      🏆 Tabla de Clasificación
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {rankingData.map((r, idx) => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '12px', background: r.isMe ? `${primaryColor}15` : 'rgba(248,250,252,0.8)', border: r.isMe ? `1px solid ${primaryColor}4d` : '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '1.2rem', minWidth: '32px', fontWeight: 800, textAlign: 'center', color: idx < 3 ? '#d97706' : '#64748b' }}>
                            {medals[idx] || `#${idx + 1}`}
                          </span>
                          {r.foto_url ? (
                            <img src={r.foto_url} alt={r.nombre} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', color: '#475569', fontWeight: 700 }}>
                              {r.nombre.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span style={{ fontWeight: r.isMe ? 800 : 600, color: r.isMe ? primaryColor : '#0f172a', fontSize: '0.9rem', flex: 1 }}>
                            {r.nombre}{r.isMe ? ' (Tú)' : ''}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                              {Math.round(r.total / 1000).toLocaleString()} pts
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              ${r.total.toLocaleString()} COP
                            </span>
                          </div>
                        </div>
                      ))}
                      {rankingData.length === 0 && (
                        <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', margin: '1rem 0' }}>
                          Aún no hay datos de compras registradas.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Columna Derecha: Estado de Motivación y Reglas */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Tarjeta de Progreso y Motivación */}
                    <div className="admin-panel" style={{ borderRadius: '20px', padding: '1.5rem 1.75rem', background: '#fafafa', border: '1px solid #e2e8f0' }}>
                      <h3 style={{ margin: '0 0 1rem 0', fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>🎯 Progreso de Medalla</h3>
                      
                      {myData && gapToLeader > 0 && (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>Para alcanzar al líder del ranking te faltan:</p>
                          <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: primaryColor }}>
                            ${gapToLeader.toLocaleString()} COP
                          </p>
                          <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden', marginTop: '0.5rem' }}>
                            <div style={{ height: '100%', width: `${leader.total > 0 ? Math.min(100, (myData.total / leader.total) * 100) : 0}%`, background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}66)`, borderRadius: '9999px', transition: 'width 1s ease' }} />
                          </div>
                          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.74rem', color: '#475569', fontWeight: 600 }}>
                            {leader.total > 0 ? Math.round((myData.total / leader.total) * 100) : 0}% del puntaje de {leader.nombre}
                          </p>
                        </div>
                      )}

                      {myData && myPos === 0 && (
                        <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#15803d' }}>👑 ¡Eres el Líder Actual!</p>
                          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#166534' }}>
                            Has alcanzado la medalla de oro. Sigue subiendo stock y apoyando a tus clientes para mantener la corona.
                          </p>
                        </div>
                      )}

                      <div style={{ marginTop: '1.25rem' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.88rem', color: '#334155', fontWeight: 700 }}>💡 ¿Cómo sumar más puntos?</h4>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.82rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <li><strong>Comparte tu catálogo:</strong> Envía tu link a más clientes para aumentar tus pedidos.</li>
                          <li><strong>Cierra compras:</strong> Solo las compras que pases a estado <strong>"completado"</strong> en el panel suman puntos al ranking.</li>
                          <li><strong>Sube stock de alta demanda:</strong> Revisa el panel de apoyo y consolidador para saber qué productos prefieren tus clientes.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                </div>
              </div>
            );
          })()}



{/* ── MATERIAL DE APOYO ASESOR / MAYORISTA TAB ── */}
          {activeTab === 'material_asesor' && (
            <div className="admin-panel">
              <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Upload size={18} /> Material de Apoyo y Ventas</h3>
                  <p className="panel-header-subtitle" style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Visualiza, comparte and descarga los recursos de Google Drive provistos por el negocio</p>
                </div>
              </div>
              <div className="panel-body">
                <div className="materials-filter-bar" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                  <button type="button" className={materialFilter === 'todos' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMaterialFilter('todos')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '20px' }}>Todos</button>
                  <button type="button" className={materialFilter === 'video' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMaterialFilter('video')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '20px' }}>🎥 Videos</button>
                  <button type="button" className={materialFilter === 'imagen' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMaterialFilter('imagen')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '20px' }}>🖼️ Imágenes</button>
                  <button type="button" className={materialFilter === 'documento' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMaterialFilter('documento')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '20px' }}>📄 Documentos</button>
                  <button type="button" className={materialFilter === 'carpeta' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMaterialFilter('carpeta')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '20px' }}>📁 Carpetas</button>
                  
                  {uniqueCampanas.length > 0 && (
                    <select
                      value={campanaFilter}
                      onChange={e => setCampanaFilter(e.target.value)}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '20px', border: '1px solid #cbd5e1', outline: 'none', background: 'white', cursor: 'pointer', fontWeight: 600, color: campanaFilter !== 'todas' ? '#ec4899' : '#475569', marginLeft: 'auto' }}
                    >
                      <option value="todas">🎯 Todas las Campañas</option>
                      {uniqueCampanas.map(c => (
                        <option key={c as string} value={c as string}>🌟 {c as string}</option>
                      ))}
                    </select>
                  )}
                </div>
                {filteredMateriales.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📁</div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: '#0f172a' }}>No hay material de apoyo disponible</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>No se encontraron recursos con los filtros seleccionados.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
                    {filteredMateriales.map((m) => {
                      return (
                        <div key={m.id} className="material-card" style={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                          <div className="material-card-content-row" style={{ display: 'flex', flex: 1, flexDirection: 'column' }}>
                            {/* Preview Area / Thumbnail (Hybrid) */}
                            <div className="material-preview-area" style={{ background: '#f8fafc', height: '200px', position: 'relative', borderBottom: '1px solid #e2e8f0', overflow: 'hidden' }}>
                              {(() => {
                                const isBroken = failedThumbnails[m.id];
                                const thumbnailUrl = (!isBroken && m.tipo !== 'carpeta') ? getGoogleDriveThumbnailUrl(m.url) : '';
                                const embedUrl = getGoogleDriveEmbedUrl(m.url);
                                const isPlaying = playingVideoId === m.id;
                                
                                // If video is playing, show iframe
                                if (isPlaying && embedUrl) {
                                  return (
                                    <>
                                      <iframe
                                        src={embedUrl}
                                        width="100%"
                                        height="100%"
                                        frameBorder="0"
                                        allow="autoplay; encrypted-media"
                                        allowFullScreen
                                        style={{ border: 'none', background: '#000', display: 'block' }}
                                      ></iframe>
                                      <button
                                        onClick={() => setPlayingVideoId(null)}
                                        style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '6px', color: 'white', padding: '4px 8px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                                        title="Cerrar video"
                                      >
                                        ✕ Cerrar
                                      </button>
                                    </>
                                  );
                                }
                                
                                if (thumbnailUrl) {
                                  return (
                                    <>
                                      <img
                                        src={thumbnailUrl}
                                        alt={m.titulo}
                                        onError={() => setFailedThumbnails(prev => ({ ...prev, [m.id]: true }))}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                      />
                                      {m.tipo === 'video' && embedUrl && (
                                        <button
                                          onClick={() => setPlayingVideoId(m.id)}
                                          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.72)', border: 'none', width: '52px', height: '52px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', transition: 'transform 0.2s, background 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
                                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.9)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translate(-50%, -50%) scale(1.1)'; }}
                                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.72)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translate(-50%, -50%) scale(1)'; }}
                                          title="Reproducir video"
                                        >
                                          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                                            <path d="M8 5v14l11-7z" />
                                          </svg>
                                        </button>
                                      )}
                                      <a
                                        href={m.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)', padding: '5px', borderRadius: '6px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        title="Abrir en Drive"
                                      >
                                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
                                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                          <polyline points="15 3 21 3 21 9" />
                                          <line x1="10" y1="14" x2="21" y2="3" />
                                        </svg>
                                      </a>
                                    </>
                                  );
                                }
                                
                                if (embedUrl && m.tipo !== 'carpeta') {
                                  return (
                                    <>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#1e293b', color: '#94a3b8', fontSize: '2.5rem' }}>
                                        {m.tipo === 'video' ? '🎥' : m.tipo === 'imagen' ? '🖼️' : '📄'}
                                      </div>
                                      {m.tipo === 'video' && (
                                        <button
                                          onClick={() => setPlayingVideoId(m.id)}
                                          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.72)', border: 'none', width: '52px', height: '52px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
                                          title="Reproducir video"
                                        >
                                          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                                            <path d="M8 5v14l11-7z" />
                                          </svg>
                                        </button>
                                      )}
                                    </>
                                  );
                                }
                                
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '2rem' }}>
                                    {m.tipo === 'video' ? '🎥' : m.tipo === 'imagen' ? '🖼️' : m.tipo === 'carpeta' ? '📁' : '📄'}
                                  </div>
                                );
                              })()}
                            </div>
                            
                            {/* Info Area */}
                            <div className="material-info-area" style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'start', gap: '0.5rem' }}>
                                <span style={{ 
                                  fontSize: '0.68rem', 
                                  background: m.tipo === 'video' ? '#fee2e2' : m.tipo === 'imagen' ? '#dcfce7' : m.tipo === 'carpeta' ? '#fef3c7' : '#e0f2fe',
                                  color: m.tipo === 'video' ? '#ef4444' : m.tipo === 'imagen' ? '#22c55e' : m.tipo === 'carpeta' ? '#d97706' : '#0284c7',
                                  padding: '0.2rem 0.55rem', 
                                  borderRadius: '20px', 
                                  fontWeight: 800,
                                  textTransform: 'uppercase'
                                }}>
                                  {m.tipo === 'video' ? '🎥 Video' : m.tipo === 'imagen' ? '🖼️ Imagen' : m.tipo === 'carpeta' ? '📁 Carpeta' : '📄 PDF/Doc'}
                                </span>
                              </div>
                              <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: 800 }}>{m.titulo}</h4>
                              {m.descripcion && <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>{m.descripcion}</p>}
                              {m.campana && (
                                <div style={{ display: 'flex', marginTop: '2px' }}>
                                  <span style={{ fontSize: '0.68rem', background: '#fce7f3', color: '#db2777', padding: '0.2rem 0.55rem', borderRadius: '20px', fontWeight: 800 }}>
                                    🌟 {m.campana}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Action buttons */}
                          <div className="material-card-actions" style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary"
                              style={{ flex: 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.45rem' }}
                            >
                              <Eye size={12} /> Ver
                            </a>
                            {m.tipo !== 'carpeta' && (
                              <a
                                href={getGoogleDriveDownloadUrl(m.url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-secondary"
                                style={{ flex: 1, textDecoration: 'none', padding: '0.45rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#64748b', borderColor: '#e2e8f0', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 700 }}
                              >
                                <Download size={12} style={{ color: '#0ea5e9' }} /> Descargar
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(m.url);
                                showToast('Enlace de recurso copiado ✓', 'success');
                              }}
                              className="btn-secondary"
                              style={{ flex: 1.2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.45rem', borderRadius: '8px', background: 'white', color: '#ec4899', border: '1px solid #cbd5e1', fontWeight: 700, cursor: 'pointer' }}
                            >
                              <Link size={12} style={{ color: '#ec4899' }} /> Compartir
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}




          {/* ── CONFIG TAB ── */}

          {activeTab === 'config' && (
            <div className="admin-panel">
              <div className="panel-header">
                <div>
                  <h3><Settings size={16} /> Configuración Global</h3>
                  <p>Personaliza tu tienda al máximo</p>
                </div>
              </div>
              <div className="panel-body">
                {configuracion ? (
                  <>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setLoading(true);
                    
                    const updateData: any = {
                      nombre_negocio: configuracion.nombre_negocio,
                      whatsapp: configuracion.whatsapp,
                      logo_url: configuracion.logo_url,
                      descripcion_hero: configuracion.descripcion_hero,
                      link_dropshipper: configuracion.link_dropshipper,
                      link_ganar_dinero: configuracion.link_ganar_dinero,
                      video_hero_url: configuracion.video_hero_url,
                      color_primario: configuracion.color_primario || '#6366f1',
                      admin_nombre: configuracion.admin_nombre,
                      admin_foto_url: configuracion.admin_foto_url,
                      admin_pin: configuracion.admin_pin || '0000',
                      preguntar_tipo_cliente: configuracion.preguntar_tipo_cliente || false
                    };
                    
                    let { error } = await supabase.from('configuracion').update(updateData).eq('id', configuracion.id);
                    
                    if (error && error.message.includes('color_primario')) {
                      // Reintentar sin color_primario para no bloquear el guardado
                      delete updateData.color_primario;
                      const retryRes = await supabase.from('configuracion').update(updateData).eq('id', configuracion.id);
                      error = retryRes.error;
                      if (!error) {
                        showToast('Guardado (sin color). Ejecuta el comando SQL en Supabase para activar el color primario.', 'error');
                      }
                    } else if (error) {
                      showToast('Error: ' + error.message, 'error');
                    } else {
                      showToast('Configuración guardada ✓');
                    }
                    
                    setLoading(false);
                  }}>
                    <div className="config-section">
                      <div className="config-section-title">👤 Perfil del Administrador</div>
                      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '1.25rem' }}>
                        <div className="form-field">
                          <label>Nombre del Administrador</label>
                          <input 
                            value={configuracion.admin_nombre || ''} 
                            onChange={e => setConfiguracion({ ...configuracion, admin_nombre: e.target.value })} 
                            placeholder="Ej. Juan Pérez" 
                          />
                        </div>
                        <div className="form-field">
                          <label>PIN de Administrador (para inicio de sesión)</label>
                          <input 
                            type="text"
                            maxLength={6}
                            value={configuracion.admin_pin || ''} 
                            onChange={e => setConfiguracion({ ...configuracion, admin_pin: e.target.value })} 
                            placeholder="Ej. 0000" 
                          />
                        </div>
                        <div className="form-field">
                          <label>Foto de Perfil</label>
                          <div className="img-input-row" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {configuracion.admin_foto_url && <img src={configuracion.admin_foto_url} className="img-preview-thumb" alt="Admin" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />}
                            <input 
                              type="text" 
                              value={configuracion.admin_foto_url || ''} 
                              onChange={e => setConfiguracion({ ...configuracion, admin_foto_url: e.target.value })} 
                              placeholder="https://..." 
                              style={{ flex: 1 }} 
                            />
                            <label className="btn-upload-img" style={{ flexShrink: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.55rem 0.85rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                              <Upload size={12} /> Subir
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setLoading(true);
                                try {
                                  const compFile = await compressImage(file);
                                  const fileName = `admin_foto_${Date.now()}.${compFile.name.split('.').pop()}`;
                                  await supabase.storage.from('archivos').upload(fileName, compFile);
                                  const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
                                  setConfiguracion({ ...configuracion, admin_foto_url: data.publicUrl });
                                  showToast('Foto subida ✓');
                                } catch { showToast('Error subiendo foto', 'error'); }
                                setLoading(false);
                              }} />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="config-section" style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                      <div className="config-section-title">🏪 Datos del Negocio</div>
                      <div className="form-grid">
                        <div className="form-field">
                          <label>Nombre del Negocio</label>
                          <input required value={configuracion.nombre_negocio} onChange={e => setConfiguracion({ ...configuracion, nombre_negocio: e.target.value })} />
                        </div>
                        <div className="form-field">
                          <label>Número WhatsApp (sin +)</label>
                          <input required value={configuracion.whatsapp} onChange={e => setConfiguracion({ ...configuracion, whatsapp: e.target.value })} placeholder="573185637317" />
                        </div>
                        <div className="form-field">
                          <label>Color Temático (Primario)</label>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input 
                              type="color" 
                              value={configuracion.color_primario || '#6366f1'} 
                              onChange={e => setConfiguracion({ ...configuracion, color_primario: e.target.value })} 
                              style={{ width: '46px', height: '40px', padding: '2px', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer' }}
                            />
                            <input 
                              type="text" 
                              value={configuracion.color_primario || '#6366f1'} 
                              onChange={e => setConfiguracion({ ...configuracion, color_primario: e.target.value })} 
                              placeholder="#6366f1"
                              style={{ flex: 1 }}
                            />
                          </div>
                        </div>
                        <div className="form-field full">
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}>
                            <input 
                              type="checkbox" 
                              checked={configuracion.preguntar_tipo_cliente || false} 
                              onChange={e => setConfiguracion({ ...configuracion, preguntar_tipo_cliente: e.target.checked })} 
                              style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer', accentColor: configuracion.color_primario || '#6366f1' }}
                            />
                            Mostrar pantalla "¿Qué tipo de cliente eres?" al inicio
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="config-section" style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                      <div className="config-section-title">✨ Personalización del Catálogo</div>
                      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                        
                        {/* Logo del Negocio */}
                        <div className="form-field">
                          <label>Logo del Negocio</label>
                          <div className="img-input-row" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {configuracion.logo_url && <img src={configuracion.logo_url} alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />}
                            <input 
                              type="text" 
                              value={configuracion.logo_url || ''} 
                              onChange={e => setConfiguracion({ ...configuracion, logo_url: e.target.value })} 
                              placeholder="https://..." 
                              style={{ flex: 1 }}
                            />
                            <label className="btn-upload-img" style={{ flexShrink: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.55rem 0.85rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                              <Upload size={12} /> Subir
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setLoading(true);
                                try {
                                  const compFile = await compressImage(file);
                                  const fileName = `logo_${Date.now()}.${compFile.name.split('.').pop()}`;
                                  await supabase.storage.from('archivos').upload(fileName, compFile);
                                  const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
                                  setConfiguracion({ ...configuracion, logo_url: data.publicUrl });
                                  showToast('Logo subido ✓');
                                } catch { showToast('Error subiendo logo', 'error'); }
                                setLoading(false);
                              }} />
                            </label>
                          </div>
                        </div>

                        {/* Video de Fondo Hero */}
                        <div className="form-field">
                          <label>Video del Banner (Hero - Vertical)</label>
                          <div className="img-input-row" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {configuracion.video_hero_url && !configuracion.video_hero_url.toLowerCase().endsWith('.mov') && (
                              configuracion.video_hero_url.match(/\.(mp4|webm|mov|ogg)$/i) ? (
                                <video src={configuracion.video_hero_url} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', background: '#000' }} muted playsInline />
                              ) : (
                                <img src={configuracion.video_hero_url} alt="preview" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', background: '#000' }} />
                              )
                            )}
                            {configuracion.video_hero_url && configuracion.video_hero_url.toLowerCase().endsWith('.mov') && (
                              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>⚠️</div>
                            )}
                            <input 
                              type="text" 
                              value={configuracion.video_hero_url || ''} 
                              onChange={e => setConfiguracion({ ...configuracion, video_hero_url: e.target.value })} 
                              placeholder="https://..." 
                              style={{ flex: 1 }}
                            />
                            <label className="btn-upload-img" style={{ flexShrink: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.55rem 0.85rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                              <Upload size={12} /> Subir
                              <input type="file" accept="video/mp4,video/webm" style={{ display: 'none' }} onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setLoading(true);
                                try {
                                  const fileName = `video_hero_${Date.now()}.${file.name.split('.').pop()}`;
                                  await supabase.storage.from('archivos').upload(fileName, file);
                                  const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
                                  setConfiguracion({ ...configuracion, video_hero_url: data.publicUrl });
                                  showToast('Video subido ✓');
                                } catch { showToast('Error subiendo video', 'error'); }
                                setLoading(false);
                              }} />
                            </label>
                          </div>
                          {configuracion.video_hero_url?.toLowerCase().endsWith('.mov') ? (
                            <div style={{ marginTop: '0.4rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#b91c1c', lineHeight: 1.6 }}>
                              ⚠️ <strong>El video está en formato .mov</strong> — Este formato <strong>no funciona en Chrome, Firefox ni Edge</strong> (solo en Safari/iPhone). El banner aparecerá negro para la mayoría de clientes.<br />
                              👉 <strong>Solución:</strong> Conviértelo gratis en <a href="https://cloudconvert.com/mov-to-mp4" target="_blank" rel="noreferrer" style={{ color: '#dc2626', fontWeight: 700 }}>cloudconvert.com</a> y vuelve a subirlo aquí como .mp4
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>* Sube tu video en formato .mp4 para que funcione en todos los dispositivos</span>
                          )}
                        </div>

                        {/* Descripción Hero */}
                        <div className="form-field full">
                          <label>Descripción del Banner (Hero)</label>
                          <input 
                            value={configuracion.descripcion_hero || ''} 
                            onChange={e => setConfiguracion({ ...configuracion, descripcion_hero: e.target.value })} 
                            placeholder="Ej. Encuentra la mejor moda mayorista de Colombia"
                          />
                        </div>

                        {/* Link Dropshipper */}
                        <div className="form-field">
                          <label>Enlace de Dropshipping (Opcional)</label>
                          <input 
                            value={configuracion.link_dropshipper || ''} 
                            onChange={e => setConfiguracion({ ...configuracion, link_dropshipper: e.target.value })} 
                            placeholder="https://..."
                          />
                        </div>

                        {/* Link Ganar Dinero */}
                        <div className="form-field">
                          <label>Enlace 'Trabaja con Nosotros' (Opcional)</label>
                          <input 
                            value={configuracion.link_ganar_dinero || ''} 
                            onChange={e => setConfiguracion({ ...configuracion, link_ganar_dinero: e.target.value })} 
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.7rem 2rem' }}>
                        <Check size={14} /> {loading ? 'Guardando...' : 'Guardar Configuración'}
                      </button>
                    </div>
                  </form>

                  {/* ── BOTÓN PURGE ── */}
                  <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '2px dashed #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 0.2rem 0', fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>🧹 Purgar Registros</h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Elimina pedidos, clientes o leads de forma definitiva.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setPurgeTargets({ pedidos: false, clientes: false, leads: false }); setPurgeConfirmText(''); setShowPurgeModal(true); }}
                      style={{ padding: '0.65rem 1.4rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                    >
                      🧹 Purgar Registros
                    </button>
                  </div>

                  </>


                ) : (
                  <div className="empty-state">
                    <div className="loading-dot" />
                    <p style={{ marginTop: '1rem' }}>Cargando configuración...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          ﻿          ﻿          
          {/* ── SIIGO TAB ── */}
          {activeTab === 'siigo' && (
            <div className="admin-panel">
              <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1.25rem' }}>
                <div>
                  <h3><Code size={18} style={{ color: '#6366f1' }} /> Panel del Desarrollador</h3>
                  <p>Configura las integraciones de API de Siigo Nube y 99 Envíos</p>
                </div>
              </div>
              <div className="panel-body">
                {configuracion ? (
                  <div>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      setLoading(true);
                      const { error } = await supabase.from('configuracion').update({
                        siigo_username: configuracion.siigo_username,
                        siigo_access_key: configuracion.siigo_access_key,
                        envios_99_api_key: configuracion.envios_99_api_key,
                        google_analytics_id: configuracion.google_analytics_id,
                        meta_pixel_id: configuracion.meta_pixel_id,
                        clarity_project_id: configuracion.clarity_project_id
                      }).eq('id', configuracion.id);
                      setLoading(false);
                      if (error) showToast('Error al guardar credenciales: ' + error.message, 'error');
                      else showToast('Configuración del desarrollador guardada ✓');
                    }}>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', alignItems: 'start' }}>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                          
                          {/* SIIGO COMPLETO */}
                          <div style={{ border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1.5rem', background: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                            <h4 style={{ margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem', color: '#0369a1', fontWeight: 800 }}>
                              ☁️ Integración Completa con Siigo Nube
                            </h4>
                            
                            {/* Credenciales */}
                            <div className="form-grid" style={{ marginBottom: '1.5rem' }}>
                              <div className="form-field full">
                                <label>Usuario (Correo de Siigo Nube)</label>
                                <input 
                                  type="email" 
                                  value={configuracion.siigo_username || ''} 
                                  onChange={e => setConfiguracion({ ...configuracion, siigo_username: e.target.value })} 
                                  placeholder="ejemplo@correo.com"
                                />
                              </div>
                              <div className="form-field full">
                                <label>Access Key (Llave de API generada en Siigo)</label>
                                <input 
                                  type="password" 
                                  value={configuracion.siigo_access_key || ''} 
                                  onChange={e => setConfiguracion({ ...configuracion, siigo_access_key: e.target.value })} 
                                  placeholder="Ingresa tu access key de Siigo"
                                />
                              </div>
                            </div>
                            
                            {/* Botón Sincronizar y Estado */}
                            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                              <button 
                                type="button" 
                                className="btn-primary" 
                                style={{ padding: '0.6rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#0284c7' }}
                                disabled={siigoLoading || !configuracion.siigo_username || !configuracion.siigo_access_key}
                                onClick={async () => {
                                  setSiigoLoading(true);
                                  setSiigoLogs([]);
                                  const addLog = (msg: string) => setSiigoLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
                                  
                                  try {
                                    const creds = {
                                      username: configuracion.siigo_username || '',
                                      accessKey: configuracion.siigo_access_key || ''
                                    };
                                    const tenantId = getTenantId() || '';
                                    
                                    const result = await SiigoService.fetchAndCompare(tenantId, creds, addLog);
                                    setSyncPending(result);
                                    setShowSyncConfirm(true);
                                    addLog(`Comparación completada. Esperando confirmación para aplicar cambios...`);
                                  } catch (err: any) {
                                    addLog(`❌ Error: ${err.message}`);
                                    showToast('Error al conectar con Siigo: ' + err.message, 'error');
                                  } finally {
                                    setSiigoLoading(false);
                                  }
                                }}
                              >
                                <RefreshCw size={14} style={{ animation: siigoLoading ? 'spin 1s linear infinite' : 'none' }} /> {siigoLoading ? 'Conectando...' : 'Sincronizar Catálogo Ahora'}
                              </button>
                              
                              <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                                <strong>Última Sincronización Exitosa:</strong>{' '}
                                {configuracion.siigo_sincronizado_at ? (
                                  <span style={{ color: '#059669', fontWeight: 600 }}>
                                    {new Date(configuracion.siigo_sincronizado_at).toLocaleString()}
                                  </span>
                                ) : (
                                  <span style={{ color: '#64748b' }}>Nunca se ha sincronizado</span>
                                )}
                              </div>
                            </div>
                            
                            {/* Webhooks / Sincronización Automática */}
                            <div style={{ marginTop: '2rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b', marginBottom: '0.35rem' }}>⚡ Sincronización Automática (Tiempo Real)</div>
                              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1rem 0' }}>
                                Activa las notificaciones en tiempo real para que Siigo Nube nos notifique automáticamente cada vez que crees, edites precios o cambies el stock de un producto.
                              </p>
                              
                              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '300px' }}>
                                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>URL del Webhook de Supabase</label>
                                  <input 
                                    type="text" 
                                    value={webhookUrl}
                                    onChange={e => setWebhookUrl(e.target.value)}
                                    placeholder="URL de la Edge Function en Supabase"
                                    style={{ 
                                      width: '100%', 
                                      padding: '0.5rem 0.75rem', 
                                      border: '1px solid #cbd5e1', 
                                      borderRadius: '8px', 
                                      fontSize: '0.85rem' 
                                    }}
                                  />
                                </div>
                                <button 
                                  type="button" 
                                  className="btn-primary" 
                                  style={{ padding: '0.55rem 1.5rem', background: '#0284c7', fontSize: '0.85rem' }}
                                  disabled={siigoLoading || !webhookUrl}
                                  onClick={async () => {
                                    setSiigoLoading(true);
                                    setSiigoLogs([]);
                                    const addLog = (msg: string) => setSiigoLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
                                    
                                    try {
                                      const creds = {
                                        username: configuracion.siigo_username || '',
                                        accessKey: configuracion.siigo_access_key || ''
                                      };
                                      await SiigoService.registerWebhooks(creds, webhookUrl, addLog);
                                      showToast('Suscripción a Webhooks completada ✓');
                                    } catch (err: any) {
                                      addLog(`❌ Error: ${err.message}`);
                                      showToast('Error al registrar Webhooks: ' + err.message, 'error');
                                    } finally {
                                      setSiigoLoading(false);
                                    }
                                  }}
                                >
                                  Activar en Siigo Nube
                                </button>
                              </div>
                            </div>
                            
                            {/* LOGS */}
                            {siigoLogs.length > 0 && (
                              <div style={{ marginTop: '1.5rem' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.5rem' }}>Registro de Actividad (Logs):</label>
                                <div style={{ 
                                  background: '#0f172a', 
                                  color: '#38bdf8', 
                                  fontFamily: 'monospace', 
                                  padding: '1rem', 
                                  borderRadius: '8px', 
                                  fontSize: '0.8rem', 
                                  maxHeight: '200px', 
                                  overflowY: 'auto',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.35rem'
                                }}>
                                  {siigoLogs.map((log, i) => (
                                    <div key={i}>{log}</div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Modal de confirmación de sincronización */}
                            {showSyncConfirm && syncPending && (
                              <div style={{
                                marginTop: '2rem',
                                padding: '1.5rem',
                                background: '#f8fafc',
                                border: '1px solid #bfdbfe',
                                borderRadius: '16px',
                                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.05)'
                              }}>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  📢 Resumen de Cambios Detectados en Siigo Nube
                                </h4>
                                <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: '#475569' }}>
                                  Por favor confirma si deseas aplicar los siguientes cambios de categorías, productos e inventarios en tu Catálogo Digital:
                                </p>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                  <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <h5 style={{ margin: '0 0 0.75rem 0', color: '#16a34a', fontWeight: 700 }}>
                                      🆕 Productos Nuevos para Crear ({syncPending.toCreate.length})
                                    </h5>
                                    <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                      {syncPending.toCreate.map((p, i) => (
                                        <div key={i} style={{ fontSize: '0.78rem', padding: '0.4rem', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                          <strong>Ref: {p.referencia}</strong> - {p.nombre} (${p.precio.toLocaleString()} COP | Stock: {p.stock})
                                        </div>
                                      ))}
                                      {syncPending.toCreate.length === 0 && (
                                        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Ningún producto nuevo detectado.</p>
                                      )}
                                    </div>
                                  </div>

                                  <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <h5 style={{ margin: '0 0 0.75rem 0', color: '#2563eb', fontWeight: 700 }}>
                                      🔄 Productos para Actualizar ({syncPending.toUpdate.length})
                                    </h5>
                                    <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                      {syncPending.toUpdate.map((p, i) => (
                                        <div key={i} style={{ fontSize: '0.78rem', padding: '0.4rem', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                                          <strong>Ref: {p.referencia}</strong> - {p.nombre}
                                          <div style={{ color: '#475569', marginTop: '0.2rem', display: 'flex', gap: '1rem' }}>
                                            <span>Precio: ${p.precioViejo.toLocaleString()} ➔ <strong>${p.precioNuevo.toLocaleString()}</strong></span>
                                            <span>Stock: {p.stockViejo} ➔ <strong>{p.stockNuevo}</strong></span>
                                          </div>
                                        </div>
                                      ))}
                                      {syncPending.toUpdate.length === 0 && (
                                        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Ningún cambio de precio o stock detectado en productos existentes.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                  <button 
                                    type="button" 
                                    className="btn-secondary" 
                                    disabled={siigoLoading}
                                    style={{ padding: '0.5rem 1.5rem' }}
                                    onClick={() => {
                                      setShowSyncConfirm(false);
                                      setSyncPending(null);
                                    }}
                                  >
                                    Descartar Sincronización
                                  </button>
                                  <button 
                                    type="button" 
                                    className="btn-primary" 
                                    disabled={siigoLoading || (syncPending.toCreate.length === 0 && syncPending.toUpdate.length === 0)}
                                    style={{ padding: '0.5rem 1.5rem', background: '#16a34a' }}
                                    onClick={async () => {
                                      setSiigoLoading(true);
                                      const addLog = (msg: string) => setSiigoLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
                                      
                                      try {
                                        const tenantId = getTenantId() || '';
                                        await SiigoService.applySync(tenantId, syncPending.toCreate, syncPending.toUpdate, addLog);
                                        showToast('¡Sincronización finalizada con éxito! ✓');
                                        setConfiguracion(prev => prev ? { ...prev, siigo_sincronizado_at: new Date().toISOString() } : null);
                                        cargarDatos();
                                        setShowSyncConfirm(false);
                                        setSyncPending(null);
                                      } catch (err: any) {
                                        addLog(`❌ Error aplicando cambios: ${err.message}`);
                                        showToast('Error al guardar datos de Siigo', 'error');
                                      } finally {
                                        setSiigoLoading(false);
                                      }
                                    }}
                                  >
                                    {siigoLoading ? 'Aplicando...' : 'Confirmar e Importar'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', alignItems: 'start' }}>
                            
                            {/* 99 Envíos integration */}
                            <div className="config-section" style={{ margin: 0 }}>
                              <div className="config-section-title">🚚 Integración 99 Envíos</div>
                              <div className="form-grid">
                                <div className="form-field full">
                                  <label>API Key / Token de 99 Envíos</label>
                                  <input 
                                    type="password" 
                                    value={configuracion.envios_99_api_key || ''} 
                                    onChange={e => setConfiguracion({ ...configuracion, envios_99_api_key: e.target.value })} 
                                    placeholder="Ingresa tu API Key de 99 Envíos"
                                  />
                                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem', lineHeight: '1.4' }}>
                                    Esta llave permite conectar la tienda con el servicio de logística y distribución de 99 Envíos para generar guías de despacho.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Analítica y Tracking */}
                            <div className="config-section" style={{ margin: 0 }}>
                              <div className="config-section-title">📊 Analítica y Tracking</div>
                              <div className="form-grid">
                                <div className="form-field full">
                                  <label>Google Analytics 4 (Measurement ID)</label>
                                  <input 
                                    type="text" 
                                    value={configuracion.google_analytics_id || ''} 
                                    onChange={e => setConfiguracion({ ...configuracion, google_analytics_id: e.target.value })} 
                                    placeholder="Ej. G-XXXXXXXXXX"
                                  />
                                </div>
                                <div className="form-field full">
                                  <label>Meta (Facebook) Pixel ID</label>
                                  <input 
                                    type="text" 
                                    value={configuracion.meta_pixel_id || ''} 
                                    onChange={e => setConfiguracion({ ...configuracion, meta_pixel_id: e.target.value })} 
                                    placeholder="Ej. 123456789012345"
                                  />
                                </div>
                                <div className="form-field full">
                                  <label>Microsoft Clarity Project ID</label>
                                  <input 
                                    type="text" 
                                    value={configuracion.clarity_project_id || ''} 
                                    onChange={e => setConfiguracion({ ...configuracion, clarity_project_id: e.target.value })} 
                                    placeholder="Ej. 5abc123xyz"
                                  />
                                </div>
                              </div>
                            </div>

                          </div>
                          
                          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '2rem' }}>
                            <button type="submit" className="btn-secondary" disabled={loading} style={{ padding: '0.8rem 3rem', fontSize: '1rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600 }}>
                              Guardar Todas las Credenciales
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="loading-dot" />
                    <p style={{ marginTop: '1rem' }}>Cargando configuración...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── MATERIAL DE APOYO ADMIN TAB ── */}
          {activeTab === 'material_apoyo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Formulario de Subida/Registro */}
              <div className="admin-panel">
                <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}><Upload size={18} /> Registrar Recurso en Google Drive</h3>
                    <p className="panel-header-subtitle" style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Agrega carpetas, imágenes o videos compartidos desde Google Drive para el equipo</p>
                  </div>
                </div>
                <div className="panel-body">
                  <form onSubmit={handleCrearMaterial} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Título del Recurso</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Video Campaña Colección Invierno"
                        value={nuevoMaterialTitulo}
                        onChange={e => setNuevoMaterialTitulo(e.target.value)}
                        style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Descripción (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ej: Video para estados de WhatsApp"
                        value={nuevoMaterialDesc}
                        onChange={e => setNuevoMaterialDesc(e.target.value)}
                        style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Campaña (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ej: Navidad, Día del Padre"
                        value={nuevoMaterialCampana}
                        onChange={e => setNuevoMaterialCampana(e.target.value)}
                        style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Tipo de Recurso</label>
                      <select
                        value={nuevoMaterialTipo}
                        onChange={e => setNuevoMaterialTipo(e.target.value as any)}
                        style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', background: 'white' }}
                      >
                        <option value="video">🎥 Video (Google Drive)</option>
                        <option value="imagen">🖼️ Imagen / Catálogo (Google Drive)</option>
                        <option value="documento">📄 Documento / PDF (Google Drive)</option>
                        <option value="carpeta">📁 Carpeta Completa (Google Drive)</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Enlace de Google Drive (Compartido)</label>
                      <input
                        type="url"
                        required
                        placeholder="https://drive.google.com/..."
                        value={nuevoMaterialUrl}
                        onChange={e => setNuevoMaterialUrl(e.target.value)}
                        style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'transparent', userSelect: 'none' }}>Spacer</div>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading}
                        style={{ padding: '0.62rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, height: '43px' }}
                      >
                        <Plus size={16} /> Registrar Recurso
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Listado de Material de Apoyo */}
              <div className="admin-panel">
                <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: 0 }}>📁 Recursos y Material de Apoyo</h3>
                  <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Listado de materiales de apoyo activos para el equipo de ventas</p>
                </div>
                <div className="panel-body">
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                    <button type="button" className={materialFilter === 'todos' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMaterialFilter('todos')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '20px' }}>Todos</button>
                    <button type="button" className={materialFilter === 'video' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMaterialFilter('video')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '20px' }}>🎥 Videos</button>
                    <button type="button" className={materialFilter === 'imagen' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMaterialFilter('imagen')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '20px' }}>🖼️ Imágenes</button>
                    <button type="button" className={materialFilter === 'documento' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMaterialFilter('documento')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '20px' }}>📄 Documentos</button>
                    <button type="button" className={materialFilter === 'carpeta' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMaterialFilter('carpeta')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '20px' }}>📁 Carpetas</button>

                    {uniqueCampanas.length > 0 && (
                      <select
                        value={campanaFilter}
                        onChange={e => setCampanaFilter(e.target.value)}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '20px', border: '1px solid #cbd5e1', outline: 'none', background: 'white', cursor: 'pointer', fontWeight: 600, color: campanaFilter !== 'todas' ? '#ec4899' : '#475569', marginLeft: 'auto' }}
                      >
                        <option value="todas">🎯 Todas las Campañas</option>
                        {uniqueCampanas.map(c => (
                          <option key={c as string} value={c as string}>🌟 {c as string}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  {filteredMateriales.length === 0 ? (
                    <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📁</div>
                      <h4 style={{ margin: '0 0 0.25rem 0', color: '#0f172a' }}>No hay material de apoyo</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>No se encontraron recursos con los filtros seleccionados.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
                      {filteredMateriales.map((m) => {
                        return (
                          <div key={m.id} className="material-card" style={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <div className="material-card-content-row" style={{ display: 'flex', flex: 1, flexDirection: 'column' }}>
                              {/* Preview Area / Thumbnail (Hybrid) */}
                              <div className="material-preview-area" style={{ background: '#f8fafc', height: '200px', position: 'relative', borderBottom: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                {(() => {
                                  const isBroken = failedThumbnails[m.id];
                                  const thumbnailUrl = (!isBroken && m.tipo !== 'carpeta') ? getGoogleDriveThumbnailUrl(m.url) : '';
                                  const embedUrl = getGoogleDriveEmbedUrl(m.url);
                                  const isPlaying = playingVideoId === m.id;
                                  
                                  // If video is playing, show iframe
                                  if (isPlaying && embedUrl) {
                                    return (
                                      <>
                                        <iframe
                                          src={embedUrl}
                                          width="100%"
                                          height="100%"
                                          frameBorder="0"
                                          allow="autoplay; encrypted-media"
                                          allowFullScreen
                                          style={{ border: 'none', background: '#000', display: 'block' }}
                                        ></iframe>
                                        <button
                                          onClick={() => setPlayingVideoId(null)}
                                          style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '6px', color: 'white', padding: '4px 8px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                                          title="Cerrar video"
                                        >
                                          ✕ Cerrar
                                        </button>
                                      </>
                                    );
                                  }
                                  
                                  if (thumbnailUrl) {
                                    return (
                                      <>
                                        <img
                                          src={thumbnailUrl}
                                          alt={m.titulo}
                                          onError={() => setFailedThumbnails(prev => ({ ...prev, [m.id]: true }))}
                                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                        />
                                        {m.tipo === 'video' && embedUrl && (
                                          <button
                                            onClick={() => setPlayingVideoId(m.id)}
                                            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.72)', border: 'none', width: '52px', height: '52px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', transition: 'transform 0.2s, background 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.9)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translate(-50%, -50%) scale(1.1)'; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.72)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translate(-50%, -50%) scale(1)'; }}
                                            title="Reproducir video"
                                          >
                                            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                                              <path d="M8 5v14l11-7z" />
                                            </svg>
                                          </button>
                                        )}
                                        <a
                                          href={m.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)', padding: '5px', borderRadius: '6px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                          title="Abrir en Drive"
                                        >
                                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                            <polyline points="15 3 21 3 21 9" />
                                            <line x1="10" y1="14" x2="21" y2="3" />
                                          </svg>
                                        </a>
                                      </>
                                    );
                                  }
                                  
                                  if (embedUrl && m.tipo !== 'carpeta') {
                                    return (
                                      <>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#1e293b', color: '#94a3b8', fontSize: '2.5rem' }}>
                                          {m.tipo === 'video' ? '🎥' : m.tipo === 'imagen' ? '🖼️' : '📄'}
                                        </div>
                                        {m.tipo === 'video' && (
                                          <button
                                            onClick={() => setPlayingVideoId(m.id)}
                                            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.72)', border: 'none', width: '52px', height: '52px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
                                            title="Reproducir video"
                                          >
                                            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                                              <path d="M8 5v14l11-7z" />
                                            </svg>
                                          </button>
                                        )}
                                      </>
                                    );
                                  }
                                  
                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '2rem' }}>
                                      {m.tipo === 'video' ? '🎥' : m.tipo === 'imagen' ? '🖼️' : m.tipo === 'carpeta' ? '📁' : '📄'}
                                    </div>
                                  );
                                })()}
                              </div>
                              
                              {/* Info Area */}
                              <div className="material-info-area" style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'start', gap: '0.5rem' }}>
                                  <span style={{ 
                                    fontSize: '0.68rem', 
                                    background: m.tipo === 'video' ? '#fee2e2' : m.tipo === 'imagen' ? '#dcfce7' : m.tipo === 'carpeta' ? '#fef3c7' : '#e0f2fe',
                                    color: m.tipo === 'video' ? '#ef4444' : m.tipo === 'imagen' ? '#22c55e' : m.tipo === 'carpeta' ? '#d97706' : '#0284c7',
                                    padding: '0.2rem 0.5rem', 
                                    borderRadius: '20px', 
                                    fontWeight: 800,
                                    textTransform: 'uppercase'
                                  }}>
                                    {m.tipo === 'video' ? '🎥 Video' : m.tipo === 'imagen' ? '🖼️ Imagen' : m.tipo === 'carpeta' ? '📁 Carpeta' : '📄 PDF/Doc'}
                                  </span>
                                </div>
                                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: 800 }}>{m.titulo}</h4>
                                {m.descripcion && <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>{m.descripcion}</p>}
                                {m.campana && (
                                  <div style={{ display: 'flex', marginTop: '2px' }}>
                                    <span style={{ fontSize: '0.68rem', background: '#fce7f3', color: '#db2777', padding: '0.2rem 0.55rem', borderRadius: '20px', fontWeight: 800 }}>
                                      🌟 {m.campana}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Action buttons */}
                            <div className="material-card-actions" style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
                              <a
                                href={m.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-secondary"
                                style={{ flex: 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.45rem' }}
                              >
                                <Eye size={12} /> Ver
                              </a>
                              {m.tipo !== 'carpeta' && (
                                <a
                                  href={getGoogleDriveDownloadUrl(m.url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-secondary"
                                  style={{ flex: 1, textDecoration: 'none', padding: '0.45rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#64748b', borderColor: '#e2e8f0', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 700 }}
                                >
                                  <Download size={12} style={{ color: '#0ea5e9' }} /> Descargar
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(m.url);
                                  showToast('Enlace de recurso copiado ✓', 'success');
                                }}
                                className="btn-secondary"
                                style={{ flex: 1.2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.45rem', borderRadius: '8px', background: 'white', color: '#ec4899', border: '1px solid #cbd5e1', fontWeight: 700, cursor: 'pointer' }}
                              >
                                <Link size={12} style={{ color: '#ec4899' }} /> Compartir
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEliminarMaterial(m.id)}
                                className="btn-secondary"
                                style={{ color: '#ef4444', borderColor: '#fee2e2', background: '#fef2f2', padding: '0.45rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Eliminar Recurso"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}


          {/* ── CLIENTES TAB ── */}
          {activeTab === 'clientes' && (
            <div className="admin-panel">
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}><User size={18} /> Base de Clientes (Fidelización)</h3>
                  <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Visualiza y filtra los clientes registrados por catálogo y POS</p>
                </div>
                
                {/* Search input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0', minWidth: '280px' }}>
                  <Search size={16} style={{ color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o celular..."
                    value={clienteSearchQuery}
                    onChange={e => setClienteSearchQuery(e.target.value)}
                    style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.84rem', width: '100%', color: '#0f172a' }}
                  />
                  {clienteSearchQuery && (
                    <button type="button" onClick={() => setClienteSearchQuery('')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                  )}
                </div>
              </div>

              <div className="panel-body" style={{ overflowX: 'auto' }}>
                {filteredClientes.length === 0 ? (
                  <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👥</div>
                    <h4 style={{ color: '#0f172a', margin: '0 0 0.25rem 0' }}>No se encontraron clientes</h4>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                      {clienteSearchQuery ? 'Prueba con otro término de búsqueda.' : 'Los clientes se registrarán automáticamente cuando realicen pedidos.'}
                    </p>
                  </div>
                ) : (
                  <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f1f5f9', background: '#f8fafc' }}>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Cliente</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Celular</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Pedidos</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Total Comprado</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Origen</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Última Ciudad / Dirección</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClientes.map(c => {
                        // Calculate origin dynamically based on order history
                        const clientOrders = pedidos.filter(p => p.cliente_telefono?.trim() === c.telefono?.trim());
                        const posCount = clientOrders.filter(p => p.origen === 'pos').length;
                        const catalogoCount = clientOrders.filter(p => p.origen !== 'pos').length;
                        
                        let origenLabel = '📱 Catálogo';
                        let origenColor = 'rgba(14, 165, 233, 0.08)';
                        let origenTextColor = '#0284c7';
                        
                        if (posCount > 0 && catalogoCount > 0) {
                          origenLabel = '💻 POS / 📱 Cat';
                          origenColor = 'rgba(139, 92, 246, 0.08)';
                          origenTextColor = '#7c3aed';
                        } else if (posCount > 0) {
                          origenLabel = '💻 POS';
                          origenColor = 'rgba(16, 185, 129, 0.08)';
                          origenTextColor = '#059669';
                        }

                        // Last order address & city
                        const lastOrder = clientOrders[0];
                        const lastLocation = lastOrder ? `${lastOrder.ciudad || 'POS'} - ${lastOrder.direccion || 'Venta Presencial'}` : 'Sin datos';

                        return (
                          <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="table-row-hover">
                            <td style={{ padding: '1rem', fontWeight: 700, color: '#0f172a' }}>{c.nombre || 'Sin Nombre'}</td>
                            <td style={{ padding: '1rem' }}>
                              <a
                                href={`https://wa.me/${c.telefono?.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#10b981', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <Phone size={12} /> {c.telefono}
                              </a>
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 600, color: '#475569' }}>
                              {c.numero_pedidos || 0}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                              ${(c.total_compras || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                              <span style={{ display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: origenColor, color: origenTextColor }}>
                                {origenLabel}
                              </span>
                            </td>
                            <td style={{ padding: '1rem', fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }} title={lastLocation}>
                              {lastLocation}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── ASESORES TAB ── */}
          {activeTab === 'asesores' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Formulario de Registro */}
              <div className="admin-panel">
                <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}><Users size={18} /> Registrar Nuevo Asesor</h3>
                  <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Crea un enlace del catálogo personalizado para que las comisiones y chats lleguen a este asesor</p>
                </div>
                <div className="panel-body">
                  <form onSubmit={handleCrearAsesor} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Nombre del Asesor</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Carolina Gómez"
                        value={nuevoAsesorNombre}
                        onChange={e => setNuevoAsesorNombre(e.target.value)}
                        style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '220px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Números de WhatsApp</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {nuevoAsesorTelefonos.map((tel, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            <input
                              type="text"
                              required
                              placeholder="Ej: 3123456789"
                              value={tel}
                              onChange={e => {
                                const newTels = [...nuevoAsesorTelefonos];
                                newTels[idx] = e.target.value;
                                setNuevoAsesorTelefonos(newTels);
                              }}
                              style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', flex: 1 }}
                            />
                            {nuevoAsesorTelefonos.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setNuevoAsesorTelefonos(nuevoAsesorTelefonos.filter((_, i) => i !== idx));
                                }}
                                style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#ef4444', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setNuevoAsesorTelefonos([...nuevoAsesorTelefonos, ''])}
                        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#0ea5e9', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.25rem', padding: '0.2rem 0' }}
                      >
                        + Añadir más líneas
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>PIN de Acceso (4 dígitos)</label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        placeholder="Ej: 1234"
                        value={nuevoAsesorPin}
                        onChange={e => setNuevoAsesorPin(e.target.value)}
                        style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'transparent', userSelect: 'none' }}>Spacer</div>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading}
                        style={{ padding: '0.62rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, height: '43px' }}
                      >
                        <Plus size={16} /> Registrar Asesor
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Listado de Asesores */}
              <div className="admin-panel">
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>👥 Equipo de Asesores Registrados</h3>
                    <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Copia y comparte los enlaces exclusivos de catálogo de cada asesor</p>
                  </div>
                  
                  {/* Buscador */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0', minWidth: '280px' }}>
                    <Search size={16} style={{ color: '#64748b' }} />
                    <input
                      type="text"
                      placeholder="Buscar asesor por nombre..."
                      value={asesorSearchQuery}
                      onChange={e => setAsesorSearchQuery(e.target.value)}
                      style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.84rem', width: '100%', color: '#0f172a' }}
                    />
                    {asesorSearchQuery && (
                      <button type="button" onClick={() => setAsesorSearchQuery('')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                    )}
                  </div>
                </div>

                <div className="panel-body" style={{ overflowX: 'auto' }}>
                  {filteredAsesores.length === 0 ? (
                    <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👥</div>
                      <h4 style={{ color: '#0f172a', margin: '0 0 0.25rem 0' }}>No hay asesores registrados</h4>
                      <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                        {asesorSearchQuery ? 'Prueba con otro término de búsqueda.' : 'Ingresa los datos arriba para crear tu primer asesor de ventas.'}
                      </p>
                    </div>
                  ) : (
                    <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #f1f5f9', background: '#f8fafc' }}>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Asesor</th>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Línea WhatsApp</th>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>PIN de Acceso</th>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Pedidos Asignados</th>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Total Ventas (Pagados)</th>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Alertas</th>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Enlace de Catálogo Exclusivo</th>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAsesores.map(a => {
                          // Calculate advisor stats from orders database
                          const advisorOrders = pedidos.filter(p => {
                            const orderPhone = p.linea_whatsapp?.replace(/\D/g, '');
                            const advisorPhones = (a.telefono || '').split(',').map(phone => phone.replace(/\D/g, '')).filter(Boolean);
                            return orderPhone && advisorPhones.includes(orderPhone);
                          });

                          // RESTRICT Total Ventas ONLY to verified/completed payments
                          const completedOrders = advisorOrders.filter(p => p.estado === 'completado');
                          const totalVentas = completedOrders.reduce((sum, p) => sum + (p.total || 0), 0);

                          const isEditing = editingAsesorId === a.id;

                          return (
                            <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="table-row-hover">
                              <td style={{ padding: '1rem', fontWeight: 700, color: '#0f172a' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  {a.foto_url ? (
                                    <img src={a.foto_url} alt={a.nombre} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                                  ) : (
                                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 'bold', color: '#64748b' }}>
                                      {a.nombre.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        value={editingAsesorNombre}
                                        onChange={e => setEditingAsesorNombre(e.target.value)}
                                        style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', width: '130px' }}
                                      />
                                    ) : (
                                      a.nombre
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '1rem' }}>
                                {isEditing ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {editingAsesorTelefonos.map((tel, idx) => (
                                      <div key={idx} style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                        <input
                                          type="text"
                                          value={tel}
                                          onChange={e => {
                                            const newTels = [...editingAsesorTelefonos];
                                            newTels[idx] = e.target.value;
                                            setEditingAsesorTelefonos(newTels);
                                          }}
                                          placeholder="Ej: 3123456789"
                                          style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', width: '110px' }}
                                        />
                                        {editingAsesorTelefonos.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => setEditingAsesorTelefonos(editingAsesorTelefonos.filter((_, i) => i !== idx))}
                                            style={{ background: '#fee2e2', border: 'none', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', padding: '0.25rem' }}
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => setEditingAsesorTelefonos([...editingAsesorTelefonos, ''])}
                                      style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}
                                    >
                                      + Añadir línea
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {(a.telefono || '').split(',').map(p => p.trim()).filter(Boolean).map((phone, idx) => (
                                      <a
                                        key={idx}
                                        href={`https://wa.me/${phone}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: '#10b981', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}
                                      >
                                        <Phone size={12} /> {phone}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '1rem', textAlign: 'center' }}>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editingAsesorPin}
                                    onChange={e => setEditingAsesorPin(e.target.value)}
                                    style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', width: '70px', textAlign: 'center' }}
                                  />
                                ) : (
                                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#475569', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                                    {a.pin || '1234'}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 600, color: '#475569' }}>
                                {advisorOrders.length}
                              </td>
                              <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                                ${totalVentas.toLocaleString()}
                              </td>
                              {(() => {
                                const stats = getAdvisorStats(a);
                                const notifications = getAdvisorNotifications(a, stats);
                                const alerts = notifications.filter(n => n.type === 'danger' || n.type === 'warning' || n.type === 'info');
                                
                                return (
                                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                                    {alerts.length === 0 ? (
                                      <span style={{ fontSize: '0.78rem', color: '#10b981', background: '#dcfce7', padding: '0.2rem 0.55rem', borderRadius: '20px', fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block' }}>
                                        ✅ Al día
                                      </span>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
                                        <span 
                                          onClick={() => setViewingAdvisorAlerts({ advisor: a, alerts: alerts })}
                                          style={{ 
                                            fontSize: '0.74rem', 
                                            color: 'white', 
                                            background: alerts.some(n => n.type === 'danger') ? '#ef4444' : '#f59e0b', 
                                            padding: '0.2rem 0.55rem', 
                                            borderRadius: '20px', 
                                            fontWeight: 800,
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                            cursor: 'pointer',
                                            transition: 'transform 0.2s ease',
                                            whiteSpace: 'nowrap',
                                            display: 'inline-block'
                                          }}
                                          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
                                          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                          title="Haga clic para ver el detalle de las alertas"
                                        >
                                          ⚠️ {alerts.length} {alerts.length === 1 ? 'Alerta' : 'Alertas'}
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                );
                              })()}
                              <td style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                  {(a.telefono || '').split(',').map(p => p.trim()).filter(Boolean).map((phone, idx) => {
                                    const link = `${window.location.origin}/${getTenantId()}?ws=${phone}`;
                                    return (
                                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                        <a
                                          href={link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{ 
                                            fontSize: '0.78rem', 
                                            color: '#1e1b4b', 
                                            fontWeight: 700, 
                                            display: 'inline-flex', 
                                            alignItems: 'center', 
                                            gap: '0.25rem', 
                                            textDecoration: 'underline', 
                                            textDecorationColor: '#cbd5e1', 
                                            transition: 'all 0.2s',
                                            cursor: 'pointer'
                                          }}
                                          onMouseEnter={e => { e.currentTarget.style.color = '#10b981'; e.currentTarget.style.textDecorationColor = '#10b981'; }}
                                          onMouseLeave={e => { e.currentTarget.style.color = '#1e1b4b'; e.currentTarget.style.textDecorationColor = '#cbd5e1'; }}
                                          title="Click para ver catálogo de este asesor"
                                        >
                                          📲 {phone}
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(link);
                                            showToast(`Enlace (${phone}) copiado ✓`, 'success');
                                          }}
                                          className="btn-secondary"
                                          style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap' }}
                                        >
                                          <Copy size={10} /> Copiar
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                              <td style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                                  {isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleGuardarAsesorEdicion(a.id)}
                                        className="btn-primary"
                                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}
                                      >
                                        Guardar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingAsesorId(null)}
                                        className="btn-secondary"
                                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                                      >
                                        Cancelar
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedAsesorAnalytics(a)}
                                        className="btn-secondary"
                                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', color: 'var(--primary-color,#6366f1)', borderColor: 'var(--primary-color,#6366f1)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}
                                        title="Ver analítica del asesor"
                                      >
                                        <LayoutDashboard size={12} /> Resumen
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingAsesorId(a.id);
                                          setEditingAsesorNombre(a.nombre);
                                          setEditingAsesorTelefonos((a.telefono || '').split(',').map(t => t.trim()).filter(Boolean));
                                          setEditingAsesorPin(a.pin || '1234');
                                          setEditingAsesorFotoUrl(a.foto_url || '');
                                        }}
                                        className="btn-secondary"
                                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleEliminarAsesor(a.id)}
                                        className="btn-secondary"
                                        style={{ color: '#ef4444', borderColor: '#fee2e2', background: '#fef2f2', padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── MAYORISTAS TAB ── */}
          {/* ── MAYORISTAS TAB ── */}
          {activeTab === 'mayoristas' && (() => {
            // filteredMayoristas proviene del useMemo superior

            async function handleCrearMayorista(e: React.FormEvent) {
              e.preventDefault();
              const tels = nuevoMayoristaTelefonos.map(t => t.trim()).filter(Boolean);
              if (!nuevoMayoristaNombre.trim() || tels.length === 0) {
                showToast('Ingresa nombre y al menos un teléfono.', 'error'); return;
              }
              setLoading(true);
              try {
                const cleanPhone = tels.map(n => n.replace(/\D/g, '')).filter(Boolean).join(',');
                const { data, error } = await supabase.from('mayoristas').insert({
                  nombre: nuevoMayoristaNombre.trim(),
                  telefono: cleanPhone,
                  pin: nuevoMayoristaPin.trim() || '1234',
                  foto_url: nuevoMayoristaFotoUrl.trim() || null,
                  tenant_id: getTenantId()
                }).select().single();
                if (error) throw error;
                setMayoristas(prev => [data, ...prev]);
                setNuevoMayoristaNombre(''); setNuevoMayoristaTelefonos(['']); setNuevoMayoristaFotoUrl('');
                setNuevoMayoristaPin(Math.floor(1000 + Math.random() * 9000).toString());
                showToast('Mayorista registrado ✓', 'success');
              } catch (err: any) { showToast('Error: ' + err.message, 'error'); }
              finally { setLoading(false); }
            }

            async function handleGuardarMayorista(id: string) {
              const tels = editingMayoristaTelefonos.map(t => t.trim()).filter(Boolean);
              if (!editingMayoristaNombre.trim() || tels.length === 0) {
                showToast('Nombre y teléfono requeridos.', 'error'); return;
              }
              const cleanPhone = tels.map(n => n.replace(/\D/g, '')).filter(Boolean).join(',');
              try {
                const { error } = await supabase.from('mayoristas').update({
                  nombre: editingMayoristaNombre.trim(),
                  telefono: cleanPhone,
                  pin: editingMayoristaPin.trim(),
                  foto_url: editingMayoristaFotoUrl.trim() || null
                }).eq('id', id);
                if (error) throw error;
                setMayoristas(prev => prev.map(m => m.id === id ? { ...m, nombre: editingMayoristaNombre.trim(), telefono: cleanPhone, pin: editingMayoristaPin.trim(), foto_url: editingMayoristaFotoUrl.trim() || undefined } : m));
                setEditingMayoristaId(null);
                showToast('Mayorista actualizado ✓', 'success');
              } catch (err: any) { showToast('Error: ' + err.message, 'error'); }
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Formulario Registro */}
                <div className="admin-panel">
                  <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                      <Users size={18} /> Registrar Nuevo Mayorista
                    </h3>
                    <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                      Crea un acceso de catálogo con precios mayoristas para este cliente especial
                    </p>
                  </div>
                  <div className="panel-body">
                    <form onSubmit={handleCrearMayorista} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Nombre del Mayorista</label>
                        <input type="text" required placeholder="Ej: Distribuidora López" value={nuevoMayoristaNombre}
                          onChange={e => setNuevoMayoristaNombre(e.target.value)}
                          style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Números de WhatsApp</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {nuevoMayoristaTelefonos.map((tel, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                              <input type="text" required placeholder="Ej: 3123456789" value={tel}
                                onChange={e => { const t = [...nuevoMayoristaTelefonos]; t[idx] = e.target.value; setNuevoMayoristaTelefonos(t); }}
                                style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', flex: 1 }} />
                              {nuevoMayoristaTelefonos.length > 1 && (
                                <button type="button" onClick={() => setNuevoMayoristaTelefonos(nuevoMayoristaTelefonos.filter((_, i) => i !== idx))}
                                  style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#ef4444', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={() => setNuevoMayoristaTelefonos([...nuevoMayoristaTelefonos, ''])}
                          style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#0ea5e9', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.25rem', padding: '0.2rem 0' }}>+ Añadir más líneas</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>PIN de Acceso (4 dígitos)</label>
                        <input type="text" required maxLength={6} placeholder="Ej: 4321" value={nuevoMayoristaPin}
                          onChange={e => setNuevoMayoristaPin(e.target.value)}
                          style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'transparent', userSelect: 'none' }}>Spacer</div>
                        <button type="submit" className="btn-primary" disabled={loading}
                          style={{ padding: '0.62rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, height: '43px' }}>
                          <Plus size={16} /> Registrar Mayorista
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Listado */}
                <div className="admin-panel">
                  <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ margin: 0 }}>📦 Mayoristas Registrados</h3>
                      <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Clientes con acceso a precios y catálogo mayorista</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0', minWidth: '260px' }}>
                      <Search size={16} style={{ color: '#64748b' }} />
                      <input type="text" placeholder="Buscar mayorista..." value={mayoristaBuscador}
                        onChange={e => setMayoristaBuscador(e.target.value)}
                        style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.84rem', width: '100%', color: '#0f172a' }} />
                      {mayoristaBuscador && <button type="button" onClick={() => setMayoristaBuscador('')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>}
                    </div>
                  </div>
                  <div className="panel-body" style={{ overflowX: 'auto' }}>
                    {filteredMayoristas.length === 0 ? (
                      <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📦</div>
                        <h4 style={{ color: '#0f172a', margin: '0 0 0.25rem 0' }}>No hay mayoristas registrados</h4>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                          {mayoristaBuscador ? 'Prueba con otro término.' : 'Usa el formulario de arriba para agregar tu primer mayorista.'}
                        </p>
                      </div>
                    ) : (
                      <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #f1f5f9', background: '#f8fafc' }}>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Mayorista</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Línea WhatsApp</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>PIN de Acceso</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Pedidos</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Total Ventas (Pagados)</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Alertas</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Enlace de Catálogo Exclusivo</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMayoristas.map(m => {
                            const mOrders = pedidos.filter(p => {
                              const op = p.linea_whatsapp?.replace(/\D/g, '');
                              const mPhones = (m.telefono || '').split(',').map((ph: string) => ph.replace(/\D/g, '')).filter(Boolean);
                              return op && mPhones.includes(op);
                            });
                            const totalCompras = mOrders.filter(p => p.estado === 'completado').reduce((s, p) => s + (p.total || 0), 0);
                            const isEd = editingMayoristaId === m.id;
                            return (
                              <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="table-row-hover">
                                <td style={{ padding: '1rem', fontWeight: 700, color: '#0f172a' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    {m.foto_url ? (
                                      <img src={m.foto_url} alt={m.nombre} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                                    ) : (
                                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>
                                        {m.nombre.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    <div>
                                      {isEd ? (
                                        <input type="text" value={editingMayoristaNombre} onChange={e => setEditingMayoristaNombre(e.target.value)}
                                          style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', width: '130px' }} />
                                      ) : m.nombre}
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                  {isEd ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                      {editingMayoristaTelefonos.map((tel, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                          <input type="text" value={tel} onChange={e => { const t = [...editingMayoristaTelefonos]; t[idx] = e.target.value; setEditingMayoristaTelefonos(t); }}
                                            placeholder="3123456789" style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', width: '110px' }} />
                                          {editingMayoristaTelefonos.length > 1 && (
                                            <button type="button" onClick={() => setEditingMayoristaTelefonos(editingMayoristaTelefonos.filter((_, i) => i !== idx))}
                                              style={{ background: '#fee2e2', border: 'none', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', padding: '0.25rem' }}>✕</button>
                                          )}
                                        </div>
                                      ))}
                                      <button type="button" onClick={() => setEditingMayoristaTelefonos([...editingMayoristaTelefonos, ''])}
                                        style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}>+ Añadir línea</button>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                      {(m.telefono || '').split(',').map((p: string) => p.trim()).filter(Boolean).map((phone: string, idx: number) => (
                                        <a key={idx} href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer"
                                          style={{ color: '#10b981', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                                          <Phone size={12} /> {phone}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                  {isEd ? (
                                    <input type="text" value={editingMayoristaPin} onChange={e => setEditingMayoristaPin(e.target.value)}
                                      style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', width: '70px', textAlign: 'center' }} />
                                  ) : (
                                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#475569', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>{m.pin || '1234'}</span>
                                  )}
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 600, color: '#475569' }}>{mOrders.length}</td>
                                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>${totalCompras.toLocaleString()}</td>
                                {(() => {
                                  const stats = getAdvisorStats(m);
                                  const notifications = getAdvisorNotifications(m, stats, true);
                                  const alerts = notifications.filter(n => n.type === 'danger' || n.type === 'warning' || n.type === 'info');
                                  
                                  return (
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                      {alerts.length === 0 ? (
                                        <span style={{ fontSize: '0.78rem', color: '#10b981', background: '#dcfce7', padding: '0.2rem 0.55rem', borderRadius: '20px', fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block' }}>
                                          ✅ Al día
                                        </span>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
                                          <span 
                                            onClick={() => setViewingAdvisorAlerts({ advisor: m, alerts: alerts })}
                                            style={{ 
                                              fontSize: '0.74rem', 
                                              color: 'white', 
                                              background: alerts.some(n => n.type === 'danger') ? '#ef4444' : '#f59e0b', 
                                              padding: '0.2rem 0.55rem', 
                                              borderRadius: '20px', 
                                              fontWeight: 800,
                                              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                              cursor: 'pointer',
                                              transition: 'transform 0.2s ease',
                                              whiteSpace: 'nowrap',
                                              display: 'inline-block'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
                                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                            title="Haga clic para ver el detalle de las alertas"
                                          >
                                            ⚠️ {alerts.length} {alerts.length === 1 ? 'Alerta' : 'Alertas'}
                                          </span>
                                        </div>
                                      )}
                                    </td>
                                  );
                                })()}
                                <td style={{ padding: '1rem' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {(m.telefono || '').split(',').map((p: string) => p.trim()).filter(Boolean).map((phone: string, idx: number) => {
                                      const link = `${window.location.origin}/${getTenantId()}?ws=${phone}&tipo=mayorista`;
                                      return (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                          <a
                                            href={link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ 
                                              fontSize: '0.78rem', 
                                              color: '#1e1b4b', 
                                              fontWeight: 700, 
                                              display: 'inline-flex', 
                                              alignItems: 'center', 
                                              gap: '0.25rem', 
                                              textDecoration: 'underline', 
                                              textDecorationColor: '#cbd5e1', 
                                              transition: 'all 0.2s',
                                              cursor: 'pointer'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.color = '#0ea5e9'; e.currentTarget.style.textDecorationColor = '#0ea5e9'; }}
                                            onMouseLeave={e => { e.currentTarget.style.color = '#1e1b4b'; e.currentTarget.style.textDecorationColor = '#cbd5e1'; }}
                                            title="Click para ver catálogo de este mayorista"
                                          >
                                            📲 {phone}
                                          </a>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              navigator.clipboard.writeText(link);
                                              showToast(`Enlace mayorista copiado ✓`, 'success');
                                            }}
                                            className="btn-secondary"
                                            style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap' }}
                                          >
                                            <Copy size={10} /> Copiar
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                                    {isEd ? (
                                      <>
                                        <button type="button" onClick={() => handleGuardarMayorista(m.id)} className="btn-primary"
                                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>Guardar</button>
                                        <button type="button" onClick={() => setEditingMayoristaId(null)} className="btn-secondary"
                                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>Cancelar</button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedAsesorAnalytics(m)}
                                          className="btn-secondary"
                                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', color: 'var(--primary-color,#6366f1)', borderColor: 'var(--primary-color,#6366f1)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}
                                          title="Ver analítica del mayorista"
                                        >
                                          <LayoutDashboard size={12} /> Resumen
                                        </button>
                                        <button type="button" onClick={() => {
                                          setEditingMayoristaId(m.id);
                                          setEditingMayoristaNombre(m.nombre);
                                          setEditingMayoristaTelefonos((m.telefono || '').split(',').map((t: string) => t.trim()).filter(Boolean));
                                          setEditingMayoristaPin(m.pin || '1234');
                                          setEditingMayoristaFotoUrl(m.foto_url || '');
                                        }} className="btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>Editar</button>
                                        <button type="button" onClick={() => handleEliminarMayorista(m.id)} className="btn-secondary"
                                          style={{ color: '#ef4444', borderColor: '#fee2e2', background: '#fef2f2', padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}><Trash2 size={12} /></button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── DASHBOARD TAB ── */}
          {activeTab === 'dashboard' && (
            <>
               {/* Fila de Métricas Principales de Ventas */}
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                 <div className="metric-card" style={{ background: 'linear-gradient(135deg, var(--primary-color, #6366f1), rgba(var(--primary-rgb, 99, 102, 241), 0.75))', color: 'white', border: 'none', position: 'relative', overflow: 'hidden' }}>
                   <div style={{ position: 'absolute', right: '-10px', top: '-10px', fontSize: '5rem', opacity: 0.15 }}>💰</div>
                   <div className="mc-label" style={{ color: 'rgba(255,255,255,0.85)' }}>Total Ventas (Comprobado)</div>
                   <div className="mc-value" style={{ fontSize: '1.8rem', color: 'white' }}>${stats.totalVentasVal.toLocaleString()} COP</div>
                   <div className="mc-sub" style={{ color: 'rgba(255,255,255,0.75)' }}>Únicamente pagos verificados</div>
                 </div>

                  <div className="metric-card" style={{ background: 'linear-gradient(135deg, rgba(var(--primary-rgb, 99, 102, 241), 0.85), rgba(var(--primary-rgb, 99, 102, 241), 0.6))', color: 'white', border: 'none', position: 'relative', overflow: 'hidden' }}>
                    <style>{`
                      .party-particles {
                        position: absolute;
                        top: -50%;
                        left: -50%;
                        width: 200%;
                        height: 200%;
                        background-image: radial-gradient(circle at 50% 50%, #ffeb3b 2%, transparent 3%), radial-gradient(circle at 30% 70%, #ff9800 2%, transparent 3%), radial-gradient(circle at 70% 30%, #e91e63 2%, transparent 3%), radial-gradient(circle at 40% 40%, #00bcd4 2%, transparent 3%), radial-gradient(circle at 80% 80%, #4caf50 2%, transparent 3%);
                        background-size: 100px 100px;
                        animation: party-spin 10s linear infinite;
                        opacity: 0.6;
                        pointer-events: none;
                        z-index: 0;
                      }
                      @keyframes party-spin {
                        0% { transform: rotate(0deg) scale(1); }
                        50% { transform: rotate(180deg) scale(1.2); }
                        100% { transform: rotate(360deg) scale(1); }
                      }
                      @keyframes float-party {
                        0% { transform: translateY(0px) rotate(0deg); }
                        50% { transform: translateY(-5px) rotate(3deg); }
                        100% { transform: translateY(0px) rotate(0deg); }
                      }
                    `}</style>
                    {(() => {
                      const bestAsesorObj = stats.asesoresRanking?.[0];
                      const hasAdvisor = !!bestAsesorObj;
                      const hasPhoto = !!bestAsesorObj?.foto_url;
                      return (
                        <>
                          <div style={{ position: 'absolute', right: '15px', top: '15px', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {hasPhoto ? (
                              <img src={bestAsesorObj?.foto_url ?? ''} alt={bestAsesorObj?.nombre ?? ''} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.4)', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))', animation: 'float-party 3s ease-in-out infinite' }} />
                            ) : hasAdvisor ? (
                              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 800, border: '4px solid rgba(255,255,255,0.4)', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))', animation: 'float-party 3s ease-in-out infinite' }}>
                                {bestAsesorObj.nombre.charAt(0).toUpperCase()}
                              </div>
                            ) : (
                              <span style={{ fontSize: '4rem', opacity: 0.25, marginRight: '10px' }}>⭐</span>
                            )}
                          </div>
                          {hasPhoto && <div className="party-particles"></div>}
                        </>
                      );
                    })()}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div className="mc-label" style={{ color: 'rgba(255,255,255,0.85)' }}>Asesor Estrella</div>
                      <div className="mc-value" style={{ fontSize: '1.5rem', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{stats.asesoresRanking?.[0]?.nombre || 'Sin datos'}</div>
                      <div className="mc-sub" style={{ color: 'rgba(255,255,255,0.75)' }}>Ventas: ${(stats.asesoresRanking?.[0]?.total || 0).toLocaleString()} COP</div>
                    </div>
                  </div>

                  <div className="metric-card" style={{ background: 'linear-gradient(135deg, #ec4899, #be185d)', color: 'white', border: 'none', position: 'relative', overflow: 'hidden' }}>
                    {(() => {
                      const bestMayoristaObj = stats.mayoristasRanking?.[0];
                      const hasMayorista = !!bestMayoristaObj;
                      const hasPhoto = !!bestMayoristaObj?.foto_url;
                      return (
                        <>
                          <div style={{ position: 'absolute', right: '15px', top: '15px', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {hasPhoto ? (
                              <img src={bestMayoristaObj?.foto_url ?? ''} alt={bestMayoristaObj?.nombre ?? ''} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.4)', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))', animation: 'float-party 3s ease-in-out infinite' }} />
                            ) : hasMayorista ? (
                              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #4338ca)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 800, border: '4px solid rgba(255,255,255,0.4)', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))', animation: 'float-party 3s ease-in-out infinite' }}>
                                {bestMayoristaObj.nombre.charAt(0).toUpperCase()}
                              </div>
                            ) : (
                              <span style={{ fontSize: '4rem', opacity: 0.25, marginRight: '10px' }}>🌟</span>
                            )}
                          </div>
                          {hasPhoto && <div className="party-particles"></div>}
                        </>
                      );
                    })()}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div className="mc-label" style={{ color: 'rgba(255,255,255,0.85)' }}>Mayorista Estrella</div>
                      <div className="mc-value" style={{ fontSize: '1.5rem', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{stats.mayoristasRanking?.[0]?.nombre || 'Sin datos'}</div>
                      <div className="mc-sub" style={{ color: 'rgba(255,255,255,0.75)' }}>Ventas: ${(stats.mayoristasRanking?.[0]?.total || 0).toLocaleString()} COP</div>
                   </div>
                 </div>

                 <div className="metric-card" style={{ background: 'linear-gradient(135deg, rgba(var(--primary-rgb, 99, 102, 241), 0.7), rgba(var(--primary-rgb, 99, 102, 241), 0.45))', color: 'white', border: 'none', position: 'relative', overflow: 'hidden' }}>
                   <div style={{ position: 'absolute', right: '-10px', top: '-10px', fontSize: '5rem', opacity: 0.15 }}>⏳</div>
                   <div className="mc-label" style={{ color: 'rgba(255,255,255,0.85)' }}>Pedidos por Atender / Pendientes</div>
                   <div className="mc-value" style={{ fontSize: '2rem', color: 'white' }}>{stats.noResueltosCount}</div>
                   <div className="mc-sub" style={{ color: 'rgba(255,255,255,0.75)' }}>Pendientes de pago o revisión</div>
                 </div>

                 <div className="metric-card" style={{ background: 'linear-gradient(135deg, rgba(var(--primary-rgb, 99, 102, 241), 0.55), rgba(var(--primary-rgb, 99, 102, 241), 0.3))', color: 'white', border: 'none', position: 'relative', overflow: 'hidden' }}>
                   <div style={{ position: 'absolute', right: '-10px', top: '-10px', fontSize: '5rem', opacity: 0.15 }}>📦</div>
                   <div className="mc-label" style={{ color: 'rgba(255,255,255,0.85)' }}>Total Productos</div>
                   <div className="mc-value" style={{ fontSize: '2rem', color: 'white' }}>{productos.length}</div>
                   <div className="mc-sub" style={{ color: 'rgba(255,255,255,0.75)' }}>{categoriasData.length} categorías activas</div>
                 </div>
               </div>

               {/* Sección de Analítica y Gráficos Visuales */}
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                 
                 {/* Tarjeta: Canales de Venta (POS vs Catálogo) */}
                 <div className="admin-panel" style={{ height: '100%' }}>
                   <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                     <h3 style={{ margin: 0 }}>📊 Canales de Venta</h3>
                     <p style={{ margin: '0.1rem 0 0 0', color: '#64748b', fontSize: '0.8rem' }}>Distribución de pedidos según su procedencia</p>
                   </div>
                   <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                     {/* Canal Catálogo */}
                     <div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                         <span>📱 Catálogo Digital</span>
                         <span>{stats.catalogCount} pedidos ({pedidos.length > 0 ? Math.round((stats.catalogCount / pedidos.length) * 100) : 0}%)</span>
                       </div>
                       <div style={{ background: '#f1f5f9', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                         <div style={{ background: 'linear-gradient(90deg, var(--primary-color,#6366f1), rgba(var(--primary-rgb,99,102,241),0.7))', height: '100%', width: `${pedidos.length > 0 ? (stats.catalogCount / pedidos.length) * 100 : 0}%`, transition: 'width 1s ease-in-out' }}></div>
                       </div>
                     </div>

                     {/* Canal POS */}
                     <div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                         <span>💻 POS Ventas</span>
                         <span>{stats.posCount} pedidos ({pedidos.length > 0 ? Math.round((stats.posCount / pedidos.length) * 100) : 0}%)</span>
                       </div>
                       <div style={{ background: '#f1f5f9', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                         <div style={{ background: 'linear-gradient(90deg, rgba(var(--primary-rgb,99,102,241),0.6), rgba(var(--primary-rgb,99,102,241),0.35))', height: '100%', width: `${pedidos.length > 0 ? (stats.posCount / pedidos.length) * 100 : 0}%`, transition: 'width 1s ease-in-out' }}></div>
                       </div>
                     </div>

                     {/* Resumen Total */}
                     <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', fontSize: '0.8rem', color: '#475569', marginTop: 'auto' }}>
                       ✨ Total pedidos registrados en base de datos: <strong>{pedidos.length}</strong>
                     </div>
                   </div>
                 </div>

                 {/* Tarjeta: Destinos Principales (Ciudades) */}
                 <div className="admin-panel" style={{ height: '100%' }}>
                   <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                     <h3 style={{ margin: 0 }}>📍 Ciudades con Mayor Demanda</h3>
                     <p style={{ margin: '0.1rem 0 0 0', color: '#64748b', fontSize: '0.8rem' }}>Top 5 ciudades con más pedidos registrados</p>
                   </div>
                   <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                     {stats.sortedCities.length === 0 ? (
                       <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>No hay datos de ciudades registrados todavía</div>
                     ) : (
                       stats.sortedCities.map((city, idx) => {
                         const maxCount = stats.sortedCities[0]?.count || 1;
                         const pct = Math.round((city.count / maxCount) * 100);
                         return (
                           <div key={idx}>
                             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.3rem' }}>
                               <span>{idx + 1}. {city.name}</span>
                               <span style={{ fontWeight: 800 }}>{city.count} pedidos</span>
                             </div>
                             <div style={{ background: '#f1f5f9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                               <div style={{ background: 'linear-gradient(90deg, var(--primary-color,#6366f1), rgba(var(--primary-rgb,99,102,241),0.6))', height: '100%', width: `${pct}%`, transition: 'width 1s ease-in-out' }}></div>
                             </div>
                           </div>
                         );
                       })
                     )}
                   </div>
                 </div>

                 {/* Tarjeta: Productos Más Vendidos */}
                 <div className="admin-panel" style={{ height: '100%' }}>
                   <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                     <h3 style={{ margin: 0 }}>🛍️ Productos Más Vendidos</h3>
                     <p style={{ margin: '0.1rem 0 0 0', color: '#64748b', fontSize: '0.8rem' }}>Top 5 artículos más vendidos por unidades</p>
                   </div>
                   <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                     {stats.topSellingProducts.length === 0 ? (
                       <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>No hay datos de productos vendidos todavía</div>
                     ) : (
                       stats.topSellingProducts.map((prod, idx) => (
                         <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0.5rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                           <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                             {prod.imagen_url ? (
                               <img src={prod.imagen_url} alt={prod.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                             ) : (
                               <span style={{ fontSize: '1.2rem' }}>👕</span>
                             )}
                           </div>
                           <div style={{ flex: 1, minWidth: 0 }}>
                             <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prod.nombre}</h4>
                             <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                               Total: <strong>${prod.total.toLocaleString()} COP</strong>
                             </p>
                           </div>
                           <div style={{ textAlign: 'right', flexShrink: 0 }}>
                             <span style={{ display: 'inline-block', padding: '0.2rem 0.6rem', background: '#dcfce7', color: '#15803d', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800 }}>
                               {prod.cantidad} {prod.cantidad === 1 ? 'ud' : 'uds'}
                             </span>
                           </div>
                         </div>
                       ))
                     )}
                   </div>
                 </div>

               </div>

               {/* Fila: Horario y Días de Mayor Venta */}
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                 
                 {/* Tarjeta: Horario de Mayor Venta */}
                 <div className="admin-panel">
                   <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                     <h3 style={{ margin: 0 }}>⏰ Horario de Mayor Venta</h3>
                     <p style={{ margin: '0.1rem 0 0 0', color: '#64748b', fontSize: '0.8rem' }}>
                       {pedidos.filter(p => p.estado === 'completado').length > 0 && stats.bestHour.count > 0 ? (
                         <>Hora pico: <strong>{stats.hourLabels[stats.bestHour.hour]}</strong> ({stats.bestHour.count} {stats.bestHour.count === 1 ? 'venta' : 'ventas'})</>
                       ) : (
                         'Distribución de ventas por hora del día'
                       )}
                     </p>
                   </div>
                   <div className="panel-body">
                     {(() => {
                       const maxCount = Math.max(1, ...Object.values(stats.hourCounts));
                       return (
                         <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '100px', marginTop: '1.5rem' }}>
                           {Object.entries(stats.hourCounts).map(([h, count]) => {
                             const pct = (count / maxCount) * 100;
                             const isWarm = Number(h) >= 8 && Number(h) <= 20;
                             const isBest = Number(h) === stats.bestHour.hour && count > 0;
                             const primaryColor = configuracion?.color_primario || '#6366f1';
                             const label = stats.hourLabels[Number(h)];
                             return (
                               <div key={h} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '12px' }} title={`${label}: ${count} ${count === 1 ? 'venta' : 'ventas'}`}>
                                 <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '3px 3px 0 0', height: '80px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                                   <div style={{ width: '100%', height: `${pct}%`, background: isBest ? 'linear-gradient(180deg,#fbbf24,#f59e0b)' : isWarm ? `${primaryColor}bb` : `${primaryColor}44`, borderRadius: '3px 3px 0 0', transition: 'height 0.8s ease' }} />
                                 </div>
                                 {Number(h) % 4 === 0 && (
                                   <span style={{ fontSize: '0.55rem', color: '#94a3b8', marginTop: '4px', fontWeight: 600, transform: 'scale(0.9)', whiteSpace: 'nowrap' }}>
                                     {Number(h) === 0 ? '12 AM' : Number(h) === 12 ? '12 PM' : Number(h) > 12 ? `${Number(h) - 12} PM` : `${h} AM`}
                                   </span>
                                 )}
                               </div>
                             );
                           })}
                         </div>
                       );
                     })()}
                   </div>
                 </div>

                 {/* Tarjeta: Días de Mayor Venta */}
                 <div className="admin-panel">
                   <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                     <h3 style={{ margin: 0 }}>📅 Ventas por Día de la Semana</h3>
                     <p style={{ margin: '0.1rem 0 0 0', color: '#64748b', fontSize: '0.8rem' }}>
                       {pedidos.filter(p => p.estado === 'completado').length > 0 && stats.bestDay.count > 0 ? (
                         <>Día más fuerte: <strong>{stats.bestDay.name}</strong> ({stats.bestDay.count} {stats.bestDay.count === 1 ? 'venta' : 'ventas'})</>
                       ) : (
                         'Distribución de ventas según el día de la semana'
                       )}
                     </p>
                   </div>
                   <div className="panel-body">
                     {(() => {
                       const maxCount = Math.max(1, ...Object.values(stats.dayCounts));
                       const orderOfWeek = [1, 2, 3, 4, 5, 6, 0]; // Lun, Mar, Mie, Jue, Vie, Sab, Dom
                       const shortDayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                       return (
                         <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '100px', marginTop: '1.5rem', padding: '0 0.5rem' }}>
                           {orderOfWeek.map((dayIdx) => {
                             const count = stats.dayCounts[dayIdx] || 0;
                             const pct = (count / maxCount) * 100;
                             const isBest = dayIdx === stats.bestDay.day && count > 0;
                             const primaryColor = configuracion?.color_primario || '#6366f1';
                             const label = stats.dayNames[dayIdx];
                             return (
                               <div key={dayIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }} title={`${label}: ${count} ${count === 1 ? 'venta' : 'ventas'}`}>
                                 <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isBest ? '#f59e0b' : '#475569', marginBottom: '4px' }}>
                                   {count > 0 ? count : ''}
                                 </span>
                                 <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '4px 4px 0 0', height: '65px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                                   <div style={{ width: '100%', height: `${pct}%`, background: isBest ? 'linear-gradient(180deg,#fbbf24,#f59e0b)' : `${primaryColor}cc`, borderRadius: '4px 4px 0 0', transition: 'height 0.8s ease' }} />
                                 </div>
                                 <span style={{ fontSize: '0.75rem', color: isBest ? '#f59e0b' : '#64748b', marginTop: '4px', fontWeight: 600 }}>
                                   {shortDayNames[dayIdx]}
                                 </span>
                               </div>
                             );
                           })}
                         </div>
                       );
                     })()}
                   </div>
                 </div>

               </div>

               {/* Fila: Rendimiento de Asesores y Mayoristas */}
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                 
                 {/* Tarjeta: Rendimiento de Asesores */}
                 <div className="admin-panel">
                   <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                     <h3 style={{ margin: 0 }}>👥 Rendimiento de Asesores</h3>
                     <p style={{ margin: '0.1rem 0 0 0', color: '#64748b', fontSize: '0.8rem' }}>Ventas acumuladas de tus asesores de catálogo</p>
                   </div>
                   <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '320px', overflowY: 'auto' }}>
                     {stats.asesoresRanking.length === 0 ? (
                       <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>No hay asesores registrados todavía</div>
                     ) : (
                       stats.asesoresRanking.map((a, idx) => (
                         <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                           <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8', width: '20px', textAlign: 'center' }}>
                             #{idx + 1}
                           </div>
                           <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                             {a.foto_url ? (
                               <img src={a.foto_url} alt={a.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                             ) : (
                               <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#475569' }}>{a.nombre.charAt(0).toUpperCase()}</span>
                             )}
                           </div>
                           <div style={{ flex: 1, minWidth: 0 }}>
                             <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{a.nombre}</h4>
                             <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                               {a.ordersCount} {a.ordersCount === 1 ? 'pedido completado' : 'pedidos completados'}
                             </p>
                           </div>
                           <div style={{ textAlign: 'right' }}>
                             <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 800, color: configuracion?.color_primario || '#6366f1' }}>
                               ${a.total.toLocaleString()}
                             </span>
                             <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>COP</span>
                           </div>
                         </div>
                       ))
                     )}
                   </div>
                 </div>

                 {/* Tarjeta: Rendimiento de Mayoristas */}
                 <div className="admin-panel">
                   <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                     <h3 style={{ margin: 0 }}>👑 Clientes Mayoristas</h3>
                     <p style={{ margin: '0.1rem 0 0 0', color: '#64748b', fontSize: '0.8rem' }}>Compras acumuladas de tus clientes mayoristas</p>
                   </div>
                   <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '320px', overflowY: 'auto' }}>
                     {stats.mayoristasRanking.length === 0 ? (
                       <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>No hay mayoristas registrados todavía</div>
                     ) : (
                       stats.mayoristasRanking.map((m, idx) => (
                         <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                           <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8', width: '20px', textAlign: 'center' }}>
                             #{idx + 1}
                           </div>
                           <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                             {m.foto_url ? (
                               <img src={m.foto_url} alt={m.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                             ) : (
                               <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0ea5e9' }}>{m.nombre.charAt(0).toUpperCase()}</span>
                             )}
                           </div>
                           <div style={{ flex: 1, minWidth: 0 }}>
                             <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{m.nombre}</h4>
                             <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                               {m.ordersCount} {m.ordersCount === 1 ? 'compra completada' : 'compras completadas'}
                             </p>
                           </div>
                           <div style={{ textAlign: 'right' }}>
                             <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 800, color: '#0ea5e9' }}>
                               ${m.total.toLocaleString()}
                             </span>
                             <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>COP</span>
                           </div>
                         </div>
                       ))
                     )}
                   </div>
                 </div>

               </div>

              <div className="admin-panel">
                <div className="panel-header">
                  <h3>📋 Últimos Productos</h3>
                </div>
                <div className="panel-body">
                  <div className="products-grid">
                    {productos.slice(0, 8).map(p => (
                      <div key={p.id} className="product-card">
                        <div className="product-card-img">
                          {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} /> : '🖼️'}
                        </div>
                        <div className="product-card-body">
                          <h4>{p.nombre}</h4>
                          <p className="p-cat">{p.categoria}</p>
                          <p className="p-price">${p.precio.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── POS TAB ── */}
          {activeTab === 'pos' && (
            <div className="pos-layout">
              {posCheckoutSuccess ? (
                /* SUCCESS RECEIPT SCREEN */
                <div className="pos-success-screen" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '2rem', maxWidth: '560px', margin: '2rem auto', textAlign: 'center', boxShadow: '0 20px 40px -12px rgba(0,0,0,0.1)' }}>
                  <div style={{ width: '64px', height: '64px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
                    <span style={{ fontSize: '2rem' }}>✅</span>
                  </div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, fontSize: '1.4rem', color: '#14532d' }}>¡Venta Completada con Éxito!</h3>
                  <p style={{ margin: '0 0 1.5rem 0', color: '#475569', fontSize: '0.88rem' }}>El inventario ha sido actualizado y la venta se registró en el historial de pedidos.</p>

                  {/* Factura Detalle */}
                  {posLastInvoice && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', textAlign: 'left', marginBottom: '1.5rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      <div style={{ borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.75rem', marginBottom: '0.75rem', textAlign: 'center' }}>
                        <strong style={{ fontSize: '1rem', textTransform: 'uppercase' }}>{configuracion?.nombre_negocio || 'Indisutex'}</strong>
                        <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.75rem' }}>COMPROBANTE DE VENTA POS</p>
                        <p style={{ margin: '0.1rem 0 0 0', color: '#64748b', fontSize: '0.72rem' }}>Fecha: {new Date(posLastInvoice.created_at).toLocaleString()}</p>
                      </div>

                      <div style={{ marginBottom: '0.75rem' }}>
                        <strong>Cliente:</strong> {posLastInvoice.cliente_nombre}<br />
                        <strong>Teléfono:</strong> {posLastInvoice.cliente_telefono}<br />
                        {posLastInvoice.direccion && <><strong>Dirección:</strong> {posLastInvoice.direccion}, {posLastInvoice.ciudad}<br /></>}
                        <strong>Método de Pago:</strong> {posLastInvoice.metodo_pago.toUpperCase()}<br />
                      </div>

                      <div style={{ borderTop: '1px dashed #cbd5e1', borderBottom: '1px dashed #cbd5e1', padding: '0.5rem 0', margin: '0.75rem 0' }}>
                        {posLastInvoice.productos.map((item: any, idx: number) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                            <span>
                              {item.cantidad}x {item.nombre} 
                              {item.talla ? ` (${item.talla})` : ''} 
                              {item.estampado ? ` [${item.estampado}]` : ''}
                            </span>
                            <span>${(item.precio * item.cantidad).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1rem', marginTop: '0.5rem' }}>
                        <span>TOTAL PAGADO:</span>
                        <span style={{ color: '#10b981' }}>${posLastInvoice.total.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{
                        padding: '0.75rem 1rem',
                        background: '#25D366',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.92rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}
                      onClick={() => {
                        if (!posLastInvoice) return;
                        const itemsStr = posLastInvoice.productos.map((i: any) => `- ${i.cantidad}x ${i.nombre} ${i.talla ? `(${i.talla})` : ''}`).join('\n');
                        const msg = `¡Hola ${posLastInvoice.cliente_nombre}! 👋\nMuchas gracias por tu compra en *${configuracion?.nombre_negocio || 'nuestra tienda'}*.\n\n*Detalle de tu compra:*\n${itemsStr}\n\n*Total Pagado: ${posLastInvoice.total.toLocaleString()} COP*\n*Método de Pago: ${posLastInvoice.metodo_pago.toUpperCase()}*\n\n¡Esperamos que disfrutes tus productos! 😊`;
                        window.open(formatWhatsAppLink(posLastInvoice.cliente_telefono || '', msg), '_blank');
                      }}
                    >
                      💬 Enviar Recibo por WhatsApp
                    </button>
                    
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{
                        padding: '0.7rem 1rem',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.88rem'
                      }}
                      onClick={() => {
                        setPosCart([]);
                        setPosCustomerPhone('');
                        setPosCustomerName('');
                        setPosCustomerAddress('');
                        setPosCustomerCity('');
                        setPosCheckoutSuccess(false);
                        setPosLastInvoice(null);
                      }}
                    >
                      Nueva Venta (Limpiar)
                    </button>
                  </div>
                </div>
              ) : (
                /* MAIN POS SALES SCREEN */
                <div className="pos-grid-container">
                  
                  {/* LEFT COLUMN: PRODUCT SELECTION */}
                  <div className="admin-panel" style={{ minHeight: '650px' }}>
                    <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.15rem' }}><Calculator size={18} style={{ color: configuracion?.color_primario || '#4f46e5' }} /> POS Catálogo</h3>
                        <p style={{ fontSize: '0.8rem' }}>Busca y selecciona los productos del inventario</p>
                      </div>
                      
                      {/* Price Tier Selector */}
                      <div style={{ display: 'flex', gap: '0.35rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
                        {(['detal', 'por_mayor', 'precio_50_unidades'] as const).map(tier => (
                          <button
                            key={tier}
                            type="button"
                            onClick={() => setPosPriceTier(tier)}
                            style={{
                              border: 'none',
                              background: posPriceTier === tier ? (configuracion?.color_primario || '#4f46e5') : 'transparent',
                              color: posPriceTier === tier ? '#ffffff' : '#64748b',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              textTransform: 'capitalize'
                            }}
                          >
                            {tier.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="panel-body">
                      {/* Filters bar */}
                      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                          <span style={{ position: 'absolute', left: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                            <Search size={14} />
                          </span>
                          <input
                            type="text"
                            placeholder="Buscar producto por nombre o ref..."
                            value={posSearchQuery}
                            onChange={e => setPosSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '0.45rem 0.8rem 0.45rem 2rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.82rem' }}
                          />
                        </div>

                        <select
                          value={posCategoryFilter}
                          onChange={e => setPosCategoryFilter(e.target.value)}
                          style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.82rem', background: 'white' }}
                        >
                          <option value="todos">Todas las categorías</option>
                          {categoriasData.map(c => <option key={c.id} value={c.slug}>{c.nombre}</option>)}
                        </select>
                      </div>

                      {/* Products Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                        {productos
                          .filter(p => {
                            const matchesSearch = p.nombre.toLowerCase().includes(posSearchQuery.toLowerCase()) || (p.referencia || '').toLowerCase().includes(posSearchQuery.toLowerCase());
                            const matchesCat = posCategoryFilter === 'todos' || p.categoria === posCategoryFilter;
                            return matchesSearch && matchesCat;
                          })
                          .map(p => {
                            // Get active price based on tier
                            let activePrice = p.precio;
                            if (posPriceTier === 'por_mayor' && p.precio_por_mayor) activePrice = p.precio_por_mayor;
                            if (posPriceTier === 'precio_50_unidades' && p.precio_50_unidades) activePrice = p.precio_50_unidades;

                            const cartQty = posCart.filter(item => item.id === p.id).reduce((acc, item) => acc + item.cantidad, 0);
                            const remainingStock = (p.stock || 0) - cartQty;
                            const hasStockAvailable = remainingStock > 0 && (p.stock || 0) > 0;

                            return (
                              <div key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'white', position: 'relative' }}>
                                {/* Image or Placeholder */}
                                <div style={{ height: '110px', width: '100%', borderRadius: '8px', background: '#f1f5f9', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {p.imagen_url ? (
                                    <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <span style={{ fontSize: '1.5rem' }}>👕</span>
                                  )}
                                </div>

                                {p.referencia && (
                                  <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.62rem', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 800, alignSelf: 'flex-start' }}>
                                    Ref: {p.referencia}
                                  </span>
                                )}

                                <h5 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.nombre}>
                                  {p.nombre}
                                </h5>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                                  <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.88rem' }}>
                                    ${activePrice.toLocaleString()}
                                  </span>
                                  <span style={{ fontSize: '0.7rem', color: hasStockAvailable ? '#475569' : '#ef4444', fontWeight: 600 }}>
                                    Stock: {p.stock || 0} {cartQty > 0 && <span style={{ color: configuracion?.color_primario || '#4f46e5', fontWeight: 700 }}>({cartQty})</span>}
                                  </span>
                                </div>

                                {/* Quick add button */}
                                <button
                                  type="button"
                                  disabled={!hasStockAvailable}
                                  onClick={() => {
                                    // Helper function to insert directly
                                    // Tallas default
                                    const defaultTalla = p.tallas ? p.tallas.split(',')[0].trim() : undefined;
                                    const defaultEstampado = p.estampados ? p.estampados.split(',')[0].trim() : undefined;
                                    
                                    setPosCart(prev => {
                                      const exist = prev.find(item => item.id === p.id && item.talla === defaultTalla && item.estampado === defaultEstampado);
                                      if (exist) {
                                        return prev.map(item => (item.id === p.id && item.talla === defaultTalla && item.estampado === defaultEstampado) ? { ...item, cantidad: item.cantidad + 1 } : item);
                                      } else {
                                        return [...prev, {
                                          id: p.id,
                                          nombre: p.nombre,
                                          precio: activePrice,
                                          cantidad: 1,
                                          talla: defaultTalla,
                                          estampado: defaultEstampado,
                                          producto: p
                                        }];
                                      }
                                    });
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.4rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: hasStockAvailable ? (configuracion?.color_primario || '#4f46e5') : '#e2e8f0',
                                    color: hasStockAvailable ? 'white' : '#64748b',
                                    fontWeight: 700,
                                    fontSize: '0.78rem',
                                    cursor: hasStockAvailable ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.25rem'
                                  }}
                                >
                                  {hasStockAvailable ? <><Plus size={12} /> Agregar</> : ((p.stock || 0) > 0 ? 'Límite alcanzado' : 'Sin Stock')}
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: POS SALES CART */}
                  <div className="admin-panel" style={{ minHeight: '650px', background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
                    <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1.15rem' }}>🛍️ Venta Actual ({posCart.reduce((acc, i) => acc + i.cantidad, 0)} items)</h3>
                      <p style={{ fontSize: '0.8rem' }}>Carrito de cobro y datos del cliente para despacho</p>
                    </div>

                    <div className="panel-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Cart List */}
                      <div style={{ flex: 1, maxHeight: '220px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.5rem', background: '#f8fafc' }}>
                        {posCart.length === 0 ? (
                          <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.82rem', margin: '3rem 0', fontStyle: 'italic' }}>El carrito del POS está vacío.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {posCart.map((item, idx) => (
                              <div key={idx} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <h6 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.nombre}</h6>
                                  
                                  {/* Selectors for Talla/Estampado if available */}
                                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                    {item.producto.tallas && (
                                      <select
                                        value={item.talla || ''}
                                        onChange={e => {
                                          const val = e.target.value;
                                          setPosCart(prev => prev.map((it, i) => i === idx ? { ...it, talla: val } : it));
                                        }}
                                        style={{ fontSize: '0.7rem', padding: '1px 3px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc' }}
                                      >
                                        {item.producto.tallas.split(',').map((t: string) => <option key={t} value={t.trim()}>{t.trim()}</option>)}
                                      </select>
                                    )}

                                    {item.producto.estampados && (
                                      <select
                                        value={item.estampado || ''}
                                        onChange={e => {
                                          const val = e.target.value;
                                          setPosCart(prev => prev.map((it, i) => i === idx ? { ...it, estampado: val } : it));
                                        }}
                                        style={{ fontSize: '0.7rem', padding: '1px 3px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc' }}
                                      >
                                        {item.producto.estampados.split(',').map((t: string) => <option key={t} value={t.trim()}>{t.trim()}</option>)}
                                      </select>
                                    )}
                                  </div>
                                </div>

                                {/* Quantity & Price actions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (item.cantidad > 1) {
                                          setPosCart(prev => prev.map((it, i) => i === idx ? { ...it, cantidad: it.cantidad - 1 } : it));
                                        }
                                      }}
                                      style={{ border: 'none', background: 'white', padding: '2px 6px', fontSize: '0.75rem', cursor: 'pointer' }}
                                    >
                                      -
                                    </button>
                                    <span style={{ fontSize: '0.75rem', padding: '0 6px', fontWeight: 'bold' }}>{item.cantidad}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (item.cantidad < (item.producto.stock || 0)) {
                                          setPosCart(prev => prev.map((it, i) => i === idx ? { ...it, cantidad: it.cantidad + 1 } : it));
                                        }
                                      }}
                                      style={{ border: 'none', background: 'white', padding: '2px 6px', fontSize: '0.75rem', cursor: 'pointer' }}
                                    >
                                      +
                                    </button>
                                  </div>

                                  <div style={{ textAlign: 'right', minWidth: '70px' }}>
                                    <strong style={{ fontSize: '0.8rem', color: '#0f172a', display: 'block' }}>
                                      ${(item.precio * item.cantidad).toLocaleString()}
                                    </strong>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPosCart(prev => prev.filter((_, i) => i !== idx));
                                      }}
                                      style={{ border: 'none', background: 'transparent', color: '#ef4444', fontSize: '0.7rem', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                      Quitar
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Customer Data */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.4rem' }}>
                          👤 Datos del Cliente (Fidelización)
                        </h4>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Teléfono celular</label>
                            <input
                              type="text"
                              required
                              placeholder="Ej: 3122564284"
                              value={posCustomerPhone}
                              onChange={e => setPosCustomerPhone(e.target.value)}
                              style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                            />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Nombre completo</label>
                            <input
                              type="text"
                              required
                              placeholder="Nombre del cliente"
                              value={posCustomerName}
                              onChange={e => setPosCustomerName(e.target.value)}
                              style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Dirección</label>
                            <input
                              type="text"
                              placeholder="Calle, Manzana, Casa..."
                              value={posCustomerAddress}
                              onChange={e => setPosCustomerAddress(e.target.value)}
                              style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                            />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Ciudad</label>
                            <input
                              type="text"
                              placeholder="Ej: Cali"
                              value={posCustomerCity}
                              onChange={e => setPosCustomerCity(e.target.value)}
                              style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Payment Method Selector */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Método de Pago:</span>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          {(['efectivo', 'transferencia', 'tarjeta'] as const).map(method => (
                            <button
                              key={method}
                              type="button"
                              onClick={() => setPosPaymentMethod(method)}
                              style={{
                                border: posPaymentMethod === method ? `1px solid ${configuracion?.color_primario || '#0f172a'}` : '1px solid #cbd5e1',
                                background: posPaymentMethod === method ? (configuracion?.color_primario || '#0f172a') : 'white',
                                color: posPaymentMethod === method ? 'white' : '#475569',
                                padding: '0.3rem 0.6rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                textTransform: 'capitalize'
                              }}
                            >
                              {method === 'transferencia' ? 'Nequi / Transf.' : method}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Totals panel */}
                      <div style={{ borderTop: '2px dashed #cbd5e1', paddingTop: '1rem', marginTop: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#475569' }}>Total de la Venta:</span>
                          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
                            ${posCart.reduce((acc, i) => acc + (i.precio * i.cantidad), 0).toLocaleString()}
                          </span>
                        </div>

                        {/* Confirm/Checkout Action */}
                        <button
                          type="button"
                          disabled={posCart.length === 0 || !posCustomerPhone || !posCustomerName}
                          onClick={async () => {
                            setLoading(true);
                            try {
                              const totalSale = posCart.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);
                              const tenant = getTenantId();
                              
                              // 1. Deduct Stock in Supabase physical products table
                              for (const item of posCart) {
                                const newStock = Math.max(0, (item.producto.stock || 0) - item.cantidad);
                                const { error: errorStock } = await supabase
                                  .from('productos')
                                  .update({ stock: newStock })
                                  .eq('id', item.id);
                                if (errorStock) throw errorStock;
                              }

                              // 2. Insert Pedido in Supabase marked as POS
                              const serializedProducts = posCart.map(item => ({
                                id: item.id,
                                nombre: item.nombre,
                                cantidad: item.cantidad,
                                precio: item.precio,
                                talla: item.talla || null,
                                estampado: item.estampado || null
                              }));

                              const { error: errorOrder } = await supabase
                                .from('pedidos')
                                .insert({
                                  cliente_nombre: posCustomerName.trim(),
                                  cliente_telefono: posCustomerPhone.trim(),
                                  direccion: posCustomerAddress.trim() || 'Venta Presencial',
                                  ciudad: posCustomerCity.trim() || 'POS',
                                  total: totalSale,
                                  productos: serializedProducts,
                                  linea_whatsapp: configuracion?.whatsapp || 'POS',
                                  tenant_id: tenant,
                                  estado: 'completado',
                                  atendido: true,
                                  origen: 'pos'
                                })
                                .select('*')
                                .single();

                              if (errorOrder) throw errorOrder;

                              // 3. Register/Update Customer in clientes_exitosos
                              const telLimpio = posCustomerPhone.trim();
                              const { data: extExist, error: errorExist } = await supabase
                                .from('clientes_exitosos')
                                .select('*')
                                .eq('telefono', telLimpio)
                                .eq('tenant_id', tenant)
                                .maybeSingle();

                              if (!errorExist) {
                                if (extExist) {
                                  await supabase
                                    .from('clientes_exitosos')
                                    .update({
                                      nombre: posCustomerName.trim() || extExist.nombre,
                                      total_compras: (extExist.total_compras || 0) + totalSale,
                                      numero_pedidos: (extExist.numero_pedidos || 0) + 1,
                                      updated_at: new Date().toISOString()
                                    })
                                    .eq('id', extExist.id);
                                } else {
                                  await supabase
                                    .from('clientes_exitosos')
                                    .insert({
                                      nombre: posCustomerName.trim(),
                                      telefono: telLimpio,
                                      total_compras: totalSale,
                                      numero_pedidos: 1,
                                      tenant_id: tenant
                                    });
                                }
                              }

                              // 4. Update local states
                              setPosLastInvoice({
                                created_at: new Date().toISOString(),
                                cliente_nombre: posCustomerName.trim(),
                                cliente_telefono: telLimpio,
                                direccion: posCustomerAddress.trim(),
                                ciudad: posCustomerCity.trim(),
                                total: totalSale,
                                productos: serializedProducts,
                                metodo_pago: posPaymentMethod
                              });

                              setPosCheckoutSuccess(true);
                              showToast('Venta POS registrada y stock actualizado ✓', 'success');
                              
                              // Reload data
                              cargarDatos();
                            } catch (err: any) {
                              console.error(err);
                              showToast('Error al procesar checkout POS: ' + err.message, 'error');
                            } finally {
                              setLoading(false);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '12px',
                            border: 'none',
                            background: (posCart.length > 0 && posCustomerPhone && posCustomerName) ? '#10b981' : '#cbd5e1',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            cursor: (posCart.length > 0 && posCustomerPhone && posCustomerName) ? 'pointer' : 'not-allowed',
                            boxShadow: (posCart.length > 0 && posCustomerPhone && posCustomerName) ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          💸 Confirmar Venta y Cobro
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}


          {/* ── PEDIDOS TAB ── */}
          {activeTab === 'pedidos' && (() => {
            const pedItems = filteredPedidos.map(p => ({ ...p, isLead: false }));
            const leadItems = orderFilterStatus === 'comprobante' || orderFilterStatus === 'esperando_pago'
              ? []
              : leadsFiltrados.map(l => ({ ...l, isLead: true, cliente_nombre: l.nombre || 'Borrador Anónimo', cliente_telefono: l.telefono || 'Sin número', direccion: l.direccion || '', estado: 'abandonado' }));
            
            const combinedList = orderFilterStatus === 'abandonados'
              ? leadsFiltrados.map(l => ({ ...l, isLead: true, cliente_nombre: l.nombre || 'Borrador Anónimo', cliente_telefono: l.telefono || 'Sin número', direccion: l.direccion || '', estado: 'abandonado' })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              : [...pedItems, ...leadItems].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            return (
              <div className="admin-panel">
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: '1rem', width: '100%' }}>
                <div>
                  <h3 style={{ margin: 0, whiteSpace: 'nowrap' }}><ShoppingBag size={16} /> Registro de Pedidos</h3>
                  <p className="panel-header-subtitle" style={{ margin: '0.2rem 0 0 0' }}>Pedidos recibidos desde el catálogo digital y su asignación de línea</p>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {/* Botón Refrescar */}
                  <button
                    type="button"
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#f1f5f9',
                      color: '#475569',
                      border: 'none',
                      borderRadius: '8px',
                      width: '36px',
                      height: '36px',
                      cursor: isRefreshing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                    title="Sincronizar Datos"
                  >
                    <style>{`
                      @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                      }
                      .spin-icon-active {
                        animation: spin 1s linear infinite;
                      }
                    `}</style>
                    <RefreshCw size={16} className={isRefreshing ? 'spin-icon-active' : ''} />
                  </button>
                  {/* Toggles de Búsqueda y Filtros en Móvil */}
                  <div className="mobile-search-filter-toggles">
                    <button 
                      type="button" 
                      className={`toggle-button ${showMobileSearch ? 'active' : ''}`}
                      onClick={() => {
                        setShowMobileSearch(!showMobileSearch);
                        setShowMobileFilters(false);
                      }}
                    >
                      <Search size={16} />
                    </button>
                    <button 
                      type="button" 
                      className={`toggle-button ${showMobileFilters ? 'active' : ''}`}
                      onClick={() => {
                        setShowMobileFilters(!showMobileFilters);
                        setShowMobileSearch(false);
                      }}
                    >
                      <Filter size={16} />
                    </button>
                  </div>

                  {/* Switcher Vista */}
                  <div className="desktop-view-mode-switcher" style={{ display: 'flex', gap: '0.25rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setPedidosViewMode('lista')}
                    style={{
                      border: 'none',
                      background: pedidosViewMode === 'lista' ? '#ffffff' : 'transparent',
                      color: pedidosViewMode === 'lista' ? '#0f172a' : '#64748b',
                      padding: '0.4rem 1rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: pedidosViewMode === 'lista' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    📋 Lista
                  </button>
                  <button
                    type="button"
                    onClick={() => setPedidosViewMode('kanban')}
                    style={{
                      border: 'none',
                      background: pedidosViewMode === 'kanban' ? '#ffffff' : 'transparent',
                      color: pedidosViewMode === 'kanban' ? '#0f172a' : '#64748b',
                      padding: '0.4rem 1rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: pedidosViewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    📊 Kanban
                  </button>
                </div>
              </div>
            </div>
            <div className="panel-body">
              {pedidos.length === 0 && leads.length === 0 ? (
                <div className="empty-state">
                  <div className="es-icon">📋</div>
                  <p style={{ marginTop: '1rem' }}>No hay pedidos ni leads registrados todavía</p>
                </div>
              ) : (
                <>
                    <div className={`orders-search-filter-container ${showMobileSearch ? 'show-search-mobile' : ''} ${showMobileFilters ? 'show-filters-mobile' : ''}`}>
                      <div className="search-input-container">
                        <span className="search-icon-wrapper">
                          <Search size={15} />
                        </span>
                        <input
                          className="search-bar"
                          placeholder="Buscar por cliente, teléfono o ciudad..."
                          value={orderSearchQuery}
                          onChange={e => setOrderSearchQuery(e.target.value)}
                        />
                      </div>

                      <div className="filters-grid-container">
                        <div className="filter-item-col">
                          <label className="filter-label">Fecha</label>
                          <div style={{ display: 'flex', gap: '0.25rem', width: '100%', alignItems: 'center' }}>
                            <input 
                              type="date"
                              value={orderFilterDate}
                              onChange={e => setOrderFilterDate(e.target.value)}
                              className="filter-select-input"
                            />
                            {orderFilterDate && (
                              <button 
                                onClick={() => setOrderFilterDate('')}
                                className="btn-clear-date"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        {pedidosViewMode === 'lista' && (
                          <div className="filter-item-col desktop-order-filter-status">
                            <label className="filter-label">Estado</label>
                            <select 
                              value={orderFilterStatus} 
                              onChange={e => setOrderFilterStatus(e.target.value)}
                              className="filter-select-input"
                            >
                              <option value="todos">Todos los Pedidos y Leads</option>
                              <option value="comprobante">Con Comprobante</option>
                              <option value="esperando_pago">Esperando Pago</option>
                              <option value="exitosas">Ventas Exitosas</option>
                              <option value="abandonados">🛒 Abandonados (Leads)</option>
                            </select>
                          </div>
                        )}

                        <div className="filter-item-col">
                          <label className="filter-label">Origen</label>
                          <select 
                            value={orderFilterOrigin} 
                            onChange={e => setOrderFilterOrigin(e.target.value)}
                            className="filter-select-input"
                          >
                            <option value="todos">Todos los Orígenes</option>
                            <option value="catalogo">📱 Catálogo</option>
                            <option value="pos">💻 POS</option>
                          </select>
                        </div>

                        {role === 'admin' && (
                          <div className="filter-item-col">
                            <label className="filter-label">Asesor</label>
                            <select 
                              value={orderFilterAsesor} 
                              onChange={e => setOrderFilterAsesor(e.target.value)}
                              className="filter-select-input"
                            >
                              <option value="todos">Todos los Asesores</option>
                              {asesores.map(a => (
                                <option key={a.id} value={a.telefono}>👤 {a.nombre}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="filter-item-col">
                          <label className="filter-label">Ordenar por</label>
                          <select 
                            value={orderSortBy} 
                            onChange={e => setOrderSortBy(e.target.value)}
                            className="filter-select-input"
                          >
                            <option value="date_desc">Más recientes primero</option>
                            <option value="date_asc">Más antiguos primero</option>
                            <option value="total_desc">Mayor valor</option>
                            <option value="total_asc">Menor valor</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {(() => {
                      const leadsCount = leadsFiltrados.length;
                      const pendingCount = filteredPedidos.filter(p => !p.pantallazo_url && p.estado !== 'completado').length;
                      const comprobarCount = filteredPedidos.filter(p => p.pantallazo_url && p.estado !== 'completado').length;
                      const exitosasCount = filteredPedidos.filter(p => p.estado === 'completado').length;
                      const totalCount = leadsCount + pendingCount + comprobarCount + exitosasCount;

                      return (
                        <div className="mobile-order-filters">
                          <button
                            type="button"
                            className={`mobile-filter-pill pill-red ${orderFilterStatus === 'abandonados' ? 'active' : ''}`}
                            onClick={() => setOrderFilterStatus('abandonados')}
                          >
                            Abandonados <span className="pill-badge bg-red">{leadsCount}</span>
                          </button>
                          <button
                            type="button"
                            className={`mobile-filter-pill pill-yellow ${orderFilterStatus === 'esperando_pago' ? 'active' : ''}`}
                            onClick={() => setOrderFilterStatus('esperando_pago')}
                          >
                            Pendientes <span className="pill-badge bg-yellow">{pendingCount}</span>
                          </button>
                          <button
                            type="button"
                            className={`mobile-filter-pill pill-blue ${orderFilterStatus === 'comprobante' ? 'active' : ''}`}
                            onClick={() => setOrderFilterStatus('comprobante')}
                          >
                            Comprobar Pagos <span className="pill-badge bg-blue">{comprobarCount}</span>
                          </button>
                          <button
                            type="button"
                            className={`mobile-filter-pill pill-green ${orderFilterStatus === 'exitosas' ? 'active' : ''}`}
                            onClick={() => setOrderFilterStatus('exitosas')}
                          >
                            Ventas Exitosas <span className="pill-badge bg-green">{exitosasCount}</span>
                          </button>
                          <button
                            type="button"
                            className={`mobile-filter-pill pill-gray ${orderFilterStatus === 'todos' ? 'active' : ''}`}
                            onClick={() => setOrderFilterStatus('todos')}
                          >
                            Todos <span className="pill-badge bg-gray">{totalCount}</span>
                          </button>
                        </div>
                      );
                    })()}

                          <div className="orders-desktop-view">
                            {pedidosViewMode === 'kanban' ? (
                              <div className="super-crm-kanban" style={{ alignItems: 'start' }}>
                        {/* Columna 1: No Interesados (Abandonos) */}
                        <div className="kanban-column" style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '500px' }}>
                          <div className="kanban-column-header col-red" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ef4444', paddingBottom: '0.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#ef4444' }}>🔴 No Interesados (Abandonos)</h3>
                            <span className="badge" style={{ background: '#fee2e2', color: '#ef4444', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>{leadsFiltrados.length}</span>
                          </div>
                          <div className="kanban-cards-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
                            {leadsFiltrados.map(lead => renderLeadOrOrderCard(lead, true))}
                            {leadsFiltrados.length === 0 && (
                              <p className="empty-column-msg" style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic', margin: '2rem 0' }}>No hay carritos abandonados.</p>
                            )}
                          </div>
                        </div>

                        {/* Columna 2: Pendientes (Esperando Pago) */}
                        <div className="kanban-column" style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '500px' }}>
                          <div className="kanban-column-header col-yellow" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eab308', paddingBottom: '0.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#eab308' }}>🟡 Pendientes (Esperando Pago)</h3>
                            <span className="badge" style={{ background: '#fef9c3', color: '#eab308', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>{pendientePagoFiltrados.length}</span>
                          </div>
                          <div className="kanban-cards-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
                            {pendientePagoFiltrados.map(ped => renderLeadOrOrderCard(ped))}
                            {pendientePagoFiltrados.length === 0 && (
                              <p className="empty-column-msg" style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic', margin: '2rem 0' }}>No hay pedidos pendientes.</p>
                            )}
                          </div>
                        </div>

                        {/* Columna 3: Comprobante Recibido (Comprobar Pagos) */}
                        <div className="kanban-column" style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '500px' }}>
                          <div className="kanban-column-header col-blue" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #3b82f6', paddingBottom: '0.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#3b82f6' }}>📸 Comprobante Recibido</h3>
                            <span className="badge" style={{ background: '#eff6ff', color: '#3b82f6', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>{comprobarPagosFiltrados.length}</span>
                          </div>
                          <div className="kanban-cards-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
                            {comprobarPagosFiltrados.map(ped => renderLeadOrOrderCard(ped))}
                            {comprobarPagosFiltrados.length === 0 && (
                              <p className="empty-column-msg" style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic', margin: '2rem 0' }}>No hay comprobantes por revisar.</p>
                            )}
                          </div>
                        </div>

                        {/* Columna 3: Clientes (Venta Exitosa) */}
                        <div className="kanban-column" style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '500px' }}>
                          <div className="kanban-column-header col-green" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #22c55e', paddingBottom: '0.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#22c55e' }}>🟢 Clientes (Venta Exitosa)</h3>
                            <span className="badge" style={{ background: '#dcfce7', color: '#22c55e', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>{clientesFiltrados.length}</span>
                          </div>
                          <div className="kanban-cards-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
                            {clientesFiltrados.map(ped => renderLeadOrOrderCard(ped))}
                            {clientesFiltrados.length === 0 && (
                              <p className="empty-column-msg" style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic', margin: '2rem 0' }}>No hay ventas exitosas aún.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="orders-desktop-table-container" style={{ overflowX: 'auto', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>
                                  <th style={{ padding: '1rem' }}>Fecha</th>
                                  <th style={{ padding: '1rem' }}>Cliente</th>
                                  <th style={{ padding: '1rem' }}>Teléfono</th>
                                  <th style={{ padding: '1rem' }}>Dirección</th>
                                  <th style={{ padding: '1rem' }}>Productos</th>
                                  <th style={{ padding: '1rem' }}>Línea Receptora</th>
                                  <th style={{ padding: '1rem' }}>Estado de Pago</th>
                                  <th style={{ padding: '1rem' }}>Total</th>
                                  <th style={{ padding: '1rem', textAlign: 'center' }}>Acción</th>
                                </tr>
                              </thead>
                              <tbody>
                                {combinedList.map((ped) => (
                                  <tr key={ped.id} style={{ borderBottom: '1px solid #f1f5f9', background: ped.estado === 'completado' ? '#f0fdf4' : ped.isLead ? 'rgba(239, 68, 68, 0.02)' : 'transparent' }}>
                              <td style={{ padding: '1rem', color: ped.estado === 'completado' ? '#166534' : '#64748b', verticalAlign: 'middle' }}>
                                {new Date(ped.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td style={{ padding: '1rem', fontWeight: 600, color: ped.estado === 'completado' ? '#14532d' : '#0f172a', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                  <span>{ped.cliente_nombre}</span>
                                  {ped.isLead && (
                                    <span style={{ fontSize: '0.68rem', background: '#fee2e2', color: '#ef4444', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>🔴 Lead</span>
                                  )}
                                  {ped.origen === 'pos' ? (
                                    <span style={{ fontSize: '0.68rem', background: '#dcfce7', color: '#166534', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>💻 POS</span>
                                  ) : (
                                    <span style={{ fontSize: '0.68rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>📱 Catálogo</span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '1rem', color: ped.estado === 'completado' ? '#166534' : '#475569', verticalAlign: 'middle' }}>{ped.cliente_telefono}</td>
                              <td style={{ padding: '1rem', color: ped.estado === 'completado' ? '#166534' : '#475569', verticalAlign: 'middle' }}>{ped.direccion}, {ped.ciudad}</td>
                              <td style={{ padding: '1rem', color: ped.estado === 'completado' ? '#166534' : '#475569', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
                                  {Array.isArray(ped.productos) && ped.productos.map((prod: any, idx: number) => (
                                    <div key={idx} style={{ background: ped.estado === 'completado' ? 'white' : '#f8fafc', padding: '3px 6px', borderRadius: '4px', border: ped.estado === 'completado' ? '1px solid #bbf7d0' : '1px solid #e2e8f0', fontSize: '0.78rem', color: ped.estado === 'completado' ? '#14532d' : '#334155' }}>
                                      <strong>{prod.cantidad}x</strong> {prod.nombre} {prod.talla ? `(${prod.talla})` : ''} {prod.estampado ? `[${prod.estampado}]` : ''}
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                                <span style={{ background: ped.estado === 'completado' ? '#dcfce7' : '#e0f2fe', color: ped.estado === 'completado' ? '#166534' : '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                                  📞 {getAsesorNameByPhone(ped.linea_whatsapp)}
                                </span>
                              </td>
                              <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                                {ped.isLead ? (
                                  <span style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, display: 'inline-block', lineHeight: '1.2' }}>
                                    🛒 Abandonado
                                  </span>
                                ) : ped.estado === 'completado' ? (
                                  <span style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, display: 'inline-block', lineHeight: '1.2' }}>
                                    ✓ Pago Verificado
                                  </span>
                                ) : ped.pantallazo_url ? (
                                  <span style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, display: 'inline-block', lineHeight: '1.2' }}>
                                    ✅ Comprobante subido
                                  </span>
                                ) : (
                                  <span style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, display: 'inline-block', lineHeight: '1.2' }}>
                                    ⏳ Pendiente de pago
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '1rem', fontWeight: 700, color: ped.estado === 'completado' ? '#16a34a' : '#10b981', verticalAlign: 'middle' }}>
                                ${ped.total.toLocaleString()}
                              </td>
                              <td style={{ padding: '0.8rem', textAlign: 'center', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'stretch', justifyContent: 'center', maxWidth: '130px', margin: '0 auto' }}>
                                  <button 
                                    className="btn-secondary" 
                                    style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', background: 'white', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', transition: 'background 0.2s', fontWeight: 600 }}
                                    onClick={() => setSelectedPedido(ped)}
                                  >
                                    <Eye size={12} /> Ver Detalle
                                  </button>
                                  
                                  {ped.estado === 'completado' ? (
                                    <button
                                      disabled
                                      style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px', background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac', cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontWeight: 700, width: '100%' }}
                                    >
                                      <Check size={12} /> Completado
                                    </button>
                                  ) : ped.pantallazo_url ? (
                                    <button
                                      style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px', background: configuracion?.color_primario || '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontWeight: 700, width: '100%', transition: 'background 0.2s' }}
                                      onClick={() => setSelectedPedido(ped)}
                                    >
                                      <Check size={12} /> Verificar pago
                                    </button>
                                  ) : ped.atendido ? (
                                    <button
                                      disabled
                                      style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px', background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontWeight: 700, width: '100%' }}
                                    >
                                      <Check size={12} /> Atendido
                                    </button>
                                  ) : (
                                    <button
                                      style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px', background: '#25D366', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontWeight: 700, width: '100%', transition: 'background 0.2s' }}
                                      onClick={() => handleAtenderPedido(ped)}
                                    >
                                      <Phone size={12} /> Atender
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Vista Móvil - Tarjetas (Cards) */}
                <div className="orders-mobile-cards-container">
                      {combinedList.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</div>
                          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>No se encontraron registros</p>
                        </div>
                      ) : (
                        combinedList.map((ped) => {
                          const isLead = ped.isLead;
                          const elapsedMs = new Date().getTime() - new Date(ped.created_at).getTime();
                          const elapsedMins = Math.floor(elapsedMs / 60000);
                          let timeLabel = 'Hace un momento';
                          if (elapsedMins >= 60) {
                            const elapsedHours = Math.floor(elapsedMins / 60);
                            if (elapsedHours >= 24) {
                              const days = Math.floor(elapsedHours / 24);
                              timeLabel = `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
                            } else {
                              timeLabel = `Hace ${elapsedHours} ${elapsedHours === 1 ? 'hora' : 'horas'}`;
                            }
                          } else if (elapsedMins > 0) {
                            timeLabel = `Hace ${elapsedMins} ${elapsedMins === 1 ? 'minuto' : 'minutos'}`;
                          }

                          // Consistent probability for leads
                          // // let // probLabel = "50%";
                          // let // probClass = "prob-medium";
                          if (isLead) {
                            // const charCodeSum = (ped.cliente_nombre || '').split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                            // const randProb = 15 + (charCodeSum % 80);
                            // probLabel = `${randProb}%`;
                            // probClass = randProb > 70 ? 'prob-high' : randProb > 40 ? 'prob-medium' : 'prob-low';
                          }

                          // Advisor Info
                          const adv = getAsesorInfoByPhone(ped.linea_whatsapp);

                          return (
                            <div key={ped.id} className={`order-mobile-card ${isLead ? 'lead-abandonado' : ped.estado === 'completado' ? 'order-completado' : ped.pantallazo_url ? 'order-comprobante' : 'order-pendiente'}`}>
                              {/* Header Row: Client avatar, details, and status badges */}
                              <div className="card-header-row">
                                <div className="client-info-block">
                                  <div className="client-avatar">
                                    {(ped.cliente_nombre || '?').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="client-details">
                                    <h4>{ped.cliente_nombre}</h4>
                                    <p className="client-phone">📞 {ped.cliente_telefono}</p>
                                    <span className="client-time">{timeLabel}</span>
                                  </div>
                                </div>
                                <div className="status-badges-block">
                                  <div className="advisor-badge">
                                    <div className="advisor-avatar">
                                      {adv.foto_url ? (
                                        <img src={adv.foto_url} alt="" />
                                      ) : (
                                        adv.nombre.charAt(0).toUpperCase()
                                      )}
                                    </div>
                                    <div className="advisor-meta">
                                      <h5>{adv.nombre}</h5>
                                      <span className="advisor-role">{adv.role}</span>
                                    </div>
                                  </div>
                                  {!isLead && (
                                    <span className={`payment-badge-small ${ped.estado === 'completado' ? 'verified' : ped.pantallazo_url ? 'uploaded' : 'pending'}`} style={{ marginTop: '4px', display: 'inline-block' }}>
                                      {ped.estado === 'completado' ? '✅ Verificado' : ped.pantallazo_url ? '📸 Comprobante recibido' : '⏳ Esperando comprobante de pago'}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Body Row: 2 columns (Cart Summary & Assigned Advisor) */}
                              <div className="card-body-row">
                                <div className="cart-summary-block">
                                  <div className="cart-total-info">
                                    <span className="cart-total-icon">💰</span>
                                    <span className="cart-total-amount">${ped.total.toLocaleString()}</span>
                                    <span className="items-count">📦 {Array.isArray(ped.productos) ? ped.productos.reduce((acc: number, p: any) => acc + (p.cantidad || 1), 0) : 0} uds</span>
                                  </div>
                                  
                                  {Array.isArray(ped.productos) && ped.productos.length > 0 && (
                                    <div className="cart-products-box">
                                      <ul className="cart-products-list">
                                        {ped.productos.slice(0, 2).map((prod: any, idx: number) => (
                                          <li key={idx}>
                                            • {prod.nombre} {prod.talla ? `(${prod.talla})` : ''}
                                          </li>
                                        ))}
                                      </ul>
                                      {ped.productos.length > 2 && (
                                        <div className="more-products-badge" onClick={() => setSelectedPedido(ped)}>
                                          + Ver {ped.productos.length - 2} más
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>


                              </div>

                              {/* Footer Row: Quick contact buttons on left, WhatsApp action on right */}
                              <div className="card-footer-row">
                                <div className="quick-actions" style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                  {ped.cliente_telefono && (
                                    <button 
                                      type="button" 
                                      className="btn-circle-action"
                                      onClick={() => {
                                        const cleanPhone = ped.cliente_telefono.replace(/\D/g, '');
                                        const target = cleanPhone.length === 10 ? '57' + cleanPhone : cleanPhone;
                                        window.open(`https://wa.me/${target}`, '_blank');
                                      }}
                                    >
                                      <MessageSquare size={13} />
                                    </button>
                                  )}
                                  <button type="button" className="btn-details-action" onClick={() => setSelectedPedido(ped)}>
                                    Ver detalles
                                  </button>
                                  {isLead && (
                                    <select 
                                      className="lead-status-dropdown" 
                                      value={ped.retargeting_estado || ''}
                                      onChange={(e) => handleUpdateLeadStatus(ped.id, e.target.value)}
                                      style={{ fontSize: '0.75rem', padding: '0.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}
                                    >
                                      <option value="">Estado...</option>
                                      <option value="contactado">Contactado</option>
                                      <option value="descartado">Descartado</option>
                                    </select>
                                  )}
                                </div>

                                <div className="main-action-wrapper">
                                  {isLead ? (
                                    <button 
                                      type="button" 
                                      className="btn-main-recover green"
                                      onClick={() => {
                                        const cleanPhone = (ped.cliente_telefono || '').replace(/\D/g, '');
                                        if (!cleanPhone) {
                                          showToast('Teléfono inválido para WhatsApp', 'error');
                                          return;
                                        }
                                        const prodNames = Array.isArray(ped.productos) && ped.productos.length > 0
                                          ? ped.productos.map((p: any) => `${p.nombre} ${p.talla ? `(${p.talla})` : ''}`).join(', ')
                                          : '';
                                        const text = `¡Hola ${ped.cliente_nombre || ''}! 👋 Vimos que estás interesado en: ${prodNames ? `*${prodNames}*` : 'nuestros productos'}. ¿Tienes alguna duda o te ayudamos a completar tu pedido? Escríbenos y con gusto te colaboramos. 😊`;
                                        const targetPhone = cleanPhone.length === 10 ? '57' + cleanPhone : cleanPhone;
                                        // Open WhatsApp FIRST (synchronous, browser allows popup on direct click)
                                        window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`, '_blank');
                                        // Then update status asynchronously
                                        handleUpdateLeadStatus(ped.id, 'contactado');
                                      }}
                                    >
                                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ marginRight: '5px', display: 'inline-block', verticalAlign: 'middle' }}>
                  <path d="M12.012 2c-5.506 0-9.988 4.482-9.988 9.988 0 1.761.46 3.473 1.332 4.978L2 22l5.222-1.368a9.92 9.92 0 0 0 4.79 1.228h.004c5.502 0 9.984-4.482 9.984-9.988C22 6.482 17.514 2 12.012 2zm5.836 14.199c-.24.676-1.18 1.258-1.748 1.356-.572.096-1.28.18-3.79-.824-3.13-1.252-5.112-4.412-5.268-4.622-.156-.21-1.272-1.688-1.272-3.218 0-1.53.804-2.28 1.092-2.584.288-.304.624-.378.834-.378.21 0 .42.002.604.01.192.008.452-.074.708.536.26.622.888 2.164.966 2.322.078.158.13.342.024.552-.104.21-.156.342-.312.524-.156.182-.328.406-.468.546-.156.156-.32.326-.138.636.182.31.81 1.334 1.738 2.16.196.176.386.326.568.428 1.218.682 1.83.582 2.112.282.282-.3.626-.642.796-.89.17-.25.334-.208.562-.124.228.084 1.442.68 1.69 1.046.248.366.248.55.128.832z"/>
                </svg> Recuperar venta</button>
                                  ) : ped.estado === 'completado' ? (
                                    <button 
                                      type="button" 
                                      className="btn-main-recover blue"
                                      onClick={() => setSelectedPedido(ped)}
                                    >
                                      👁️ Ver Factura
                                    </button>
                                  ) : ped.pantallazo_url ? (
                                    <button 
                                      type="button" 
                                      className="btn-main-recover blue"
                                      onClick={() => setSelectedPedido(ped)}
                                    >
                                      💳 Verificar Pago
                                    </button>
                                  ) : (
                                    <button 
                                      type="button" 
                                      className="btn-main-recover green"
                                      onClick={() => {
                                        const cleanPhone = (ped.cliente_telefono || '').replace(/\D/g, '');
                                        if (!cleanPhone) { showToast('Teléfono inválido para WhatsApp', 'error'); return; }
                                        const prodNames = Array.isArray(ped.productos) && ped.productos.length > 0
                                          ? ped.productos.map((p: any) => p.nombre).join(', ')
                                          : '';
                                        const text = `¡Hola ${ped.cliente_nombre || ''}! 👋 Esperamos que estés muy bien. Recordamos que tu pedido de ${prodNames ? `*${prodNames}*` : 'nuestro catálogo'} por valor de *$${ped.total.toLocaleString()}* está pendiente de pago. ¿Te ayudamos a registrar el comprobante? 😊`;
                                        const targetPhone = cleanPhone.length === 10 ? '57' + cleanPhone : cleanPhone;
                                        window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`, '_blank');
                                      }}
                                    >
                                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ marginRight: '5px', display: 'inline-block', verticalAlign: 'middle' }}>
                                        <path d="M12.012 2c-5.506 0-9.988 4.482-9.988 9.988 0 1.761.46 3.473 1.332 4.978L2 22l5.222-1.368a9.92 9.92 0 0 0 4.79 1.228h.004c5.502 0 9.984-4.482 9.984-9.988C22 6.482 17.514 2 12.012 2zm5.836 14.199c-.24.676-1.18 1.258-1.748 1.356-.572.096-1.28.18-3.79-.824-3.13-1.252-5.112-4.412-5.268-4.622-.156-.21-1.272-1.688-1.272-3.218 0-1.53.804-2.28 1.092-2.584.288-.304.624-.378.834-.378.21 0 .42.002.604.01.192.008.452-.074.708.536.26.622.888 2.164.966 2.322.078.158.13.342.024.552-.104.21-.156.342-.312.524-.156.182-.328.406-.468.546-.156.156-.32.326-.138.636.182.31.81 1.334 1.738 2.16.196.176.386.326.568.428 1.218.682 1.83.582 2.112.282.282-.3.626-.642.796-.89.17-.25.334-.208.562-.124.228.084 1.442.68 1.69 1.046.248.366.248.55.128.832z"/>
                                      </svg>
                                      Recordar Pago
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        </div>
      </div>

      {/* MODAL DETALLE PEDIDO */}
      {selectedPedido && (
        <div className="modal-overlay" onClick={() => { setSelectedPedido(null); setShowSuccessScreen(false); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%', borderRadius: '16px', padding: '1.25rem', maxHeight: '92vh', overflowY: 'auto' }}>
            {showSuccessScreen ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ 
                  width: '64px', height: '64px', 
                  background: '#dcfce7', borderRadius: '50%', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  margin: '0 auto 1.25rem auto'
                }}>
                  <span style={{ fontSize: '2rem' }}>✅</span>
                </div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, fontSize: '1.3rem', color: '#14532d' }}>
                  ¡Pago Aprobado y Completado!
                </h3>
                <p style={{ margin: '0 0 1.25rem 0', color: '#475569', fontSize: '0.85rem' }}>
                  El pedido ha cambiado a estado completado (verde) y el cliente se ha registrado para fidelización.
                </p>

                {/* Seccion 99 Envios */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1rem', marginBottom: '1.25rem', textAlign: 'left' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    🚚 Logística (99 Envíos)
                  </h4>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.78rem', color: '#64748b' }}>
                    Genera la guía automática para despacho o digita la guía manualmente.
                  </p>

                  {numeroGuia ? (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.6rem 0.8rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Guía Generada</span>
                        <strong style={{ fontSize: '0.95rem', color: '#14532d' }}>{numeroGuia}</strong>
                      </div>
                      <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#166534', padding: '0.2rem 0.5rem', borderRadius: '12px', fontWeight: 700 }}>Activa</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={loadingGuia}
                      onClick={() => handleGenerarGuia99Envios(selectedPedido.id)}
                      style={{
                        width: '100%',
                        padding: '0.65rem',
                        background: '#4f46e5',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        marginBottom: '0.75rem',
                        opacity: loadingGuia ? 0.7 : 1
                      }}
                    >
                      {loadingGuia ? 'Generando guía...' : '🔌 Generar Guía con 99 Envíos'}
                    </button>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Número de guía manual..."
                      value={numeroGuia}
                      onChange={e => setNumeroGuia(e.target.value)}
                      style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleGuardarGuiaManual(selectedPedido.id, numeroGuia)}
                      style={{ padding: '0.5rem 0.85rem', background: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                    >
                      Guardar
                    </button>
                  </div>
                </div>

                {/* Botones de Envío / Cerrar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#25D366',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                    onClick={() => {
                      const name = selectedPedido.cliente_nombre;
                      const business = configuracion?.nombre_negocio || 'Indisutex';
                      const msg = `¡Felicidades ${name}! 🎉 Has hecho una compra exitosa con *${business}*.\n\nTu número de guía de envío es: *${numeroGuia || 'Pendiente'}*\n\n¡Muchas gracias por confiar en nosotros! 😊`;
                      window.open(formatWhatsAppLink(selectedPedido.cliente_telefono || '', msg), '_blank');
                    }}
                  >
                    💬 Enviar WhatsApp de Éxito y Guía
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPedido(null);
                      setShowSuccessScreen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      background: 'white',
                      color: '#64748b',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.82rem'
                    }}
                  >
                    Cerrar Ventana
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0 }}>📦 Detalle del Pedido</h3>
                  <button onClick={() => { setSelectedPedido(null); setShowSuccessScreen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                    <X size={20} />
                  </button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <h5 style={{ margin: '0 0 0.2rem 0', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Cliente</h5>
                    <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>{selectedPedido.cliente_nombre || (selectedPedido as any).nombre || 'Borrador Anónimo'}</p>
                    <p style={{ margin: '0.2rem 0 0 0', color: '#475569' }}>{selectedPedido.cliente_telefono || (selectedPedido as any).telefono || 'Sin teléfono'}</p>
                  </div>
                  <div>
                    <h5 style={{ margin: '0 0 0.2rem 0', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Línea WhatsApp Asignada</h5>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.2rem' }}>
                      {renderAsesorBadge(selectedPedido.linea_whatsapp, selectedPedido.origen)}
                    </div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <h5 style={{ margin: '0 0 0.2rem 0', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Dirección de Entrega</h5>
                    <p style={{ margin: 0, color: '#0f172a' }}>{selectedPedido.direccion}, {selectedPedido.ciudad}</p>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>Productos Solicitados</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '130px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {Array.isArray(selectedPedido.productos) && selectedPedido.productos.map((prod: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                        <div>
                          <h5 style={{ margin: 0, color: '#0f172a' }}>{prod.nombre}</h5>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            Cantidad: {prod.cantidad} {prod.talla ? ` | Talla: ${prod.talla}` : ''} {prod.estampado ? ` | Estampado: ${prod.estampado}` : ''}
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>
                          ${(prod.precio * prod.cantidad).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pantallazo Nequi */}
                {selectedPedido.pantallazo_url && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      💳 Comprobante de Pago (Nequi)
                    </h4>
                    <div onClick={() => setPagoModalUrl(selectedPedido.pantallazo_url || null)} style={{ cursor: 'pointer' }}>
                      <img
                        src={selectedPedido.pantallazo_url}
                        alt="Comprobante Nequi"
                        style={{ width: '100%', maxHeight: '120px', objectFit: 'contain', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      />
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, marginTop: '0.5rem', textAlign: 'center' }}>
                      ✅ Comprobante recibido — Click para ver en pantalla completa
                    </p>
                  </div>
                )}
                {!selectedPedido.pantallazo_url && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', textAlign: 'center' }}>
                    <p style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>
                      ⏳ Pendiente de comprobante
                    </p>
                  </div>
                )}

                {/* Seccion 99 Envios y Guía de Envío (para pedidos completados) */}
                {selectedPedido.estado === 'completado' && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      🚚 Datos de Envío (99 Envíos)
                    </h4>
                    
                    {numeroGuia ? (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.5rem 0.75rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div>
                          <span style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Número de Guía</span>
                          <strong style={{ fontSize: '0.9rem', color: '#14532d' }}>{numeroGuia}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const name = selectedPedido.cliente_nombre;
                            const business = configuracion?.nombre_negocio || 'Indisutex';
                            const msg = `¡Felicidades ${name}! 🎉 Has hecho una compra exitosa con *${business}*.\n\nTu número de guía de envío es: *${numeroGuia}*\n\n¡Muchas gracias por confiar en nosotros! 😊`;
                            window.open(formatWhatsAppLink(selectedPedido.cliente_telefono || '', msg), '_blank');
                          }}
                          style={{ padding: '0.3rem 0.6rem', background: '#25D366', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          💬 Enviar Guía
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <button
                          type="button"
                          disabled={loadingGuia}
                          onClick={() => handleGenerarGuia99Envios(selectedPedido.id)}
                          style={{ flex: 1, padding: '0.5rem', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
                        >
                          {loadingGuia ? 'Generando...' : '🔌 Generar Guía con 99 Envíos'}
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Número de guía manual..."
                        value={numeroGuia}
                        onChange={e => setNumeroGuia(e.target.value)}
                        style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleGuardarGuiaManual(selectedPedido.id, numeroGuia)}
                        style={{ padding: '0.4rem 0.75rem', background: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', marginTop: '1rem', paddingTop: '1rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Total del Pedido:</span>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
                    ${selectedPedido.total.toLocaleString()}
                  </span>
                </div>

                {/* Botones de acción */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap', flexDirection: 'column' }}>
                  {selectedPedido.estado !== 'completado' && (
                    <button
                      style={{
                        width: '100%',
                        padding: '0.65rem 1rem',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                      }}
                      onClick={() => handleAprobarPago(selectedPedido)}
                    >
                      <Check size={18} /> Aprobar y completar pago
                    </button>
                  )}
                  
                  <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                    <button
                      style={{ flex: 1, padding: '0.65rem 1rem', background: '#25D366', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                      onClick={() => {
                        const uploadLink = `${window.location.origin}/pago/${selectedPedido.id}`;
                        const msg = `¡Hola ${selectedPedido.cliente_nombre}! 👋\nGracias por tu pedido en *${configuracion?.nombre_negocio || 'nuestra tienda'}*.\n\n*Total a pagar: ${selectedPedido.total.toLocaleString()} COP*\n\n💳 *Datos del banco:*\nNúmero: ${configuracion?.whatsapp || ''}\nTitular: ${configuracion?.nombre_negocio || ''}\n\nPara poder completar tu pedido, haz la captura de pantalla de tu pago o de transacción y envíala por este enlace:\n${uploadLink}\n\n¡Tu pedido será despachado en cuanto verifiquemos el pago! 🚀`;
                        window.open(formatWhatsAppLink(selectedPedido.cliente_telefono || '', msg), '_blank');
                      }}
                    >
                      💳 Cobrar por Nequi/WhatsApp
                    </button>
                    <button
                      style={{ flex: 1, padding: '0.65rem 1rem', background: configuracion?.color_primario || '#0ea5e9', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                      onClick={() => {
                        const msg = `¡Hola ${selectedPedido.cliente_nombre}! 👋 Tu pedido ha sido *VERIFICADO y DESPACHADO* 🚚\n\nPedido: ${selectedPedido.productos?.map((p: any) => `${p.cantidad}x ${p.nombre}`).join(', ')}\nTotal: ${selectedPedido.total.toLocaleString()} COP\n\n📦 Tu paquete está en camino. ¡Gracias por tu compra!`;
                        window.open(formatWhatsAppLink(selectedPedido.cliente_telefono || '', msg), '_blank');
                      }}
                    >
                      🚚 Confirmar Despacho
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}      {/* MODAL PAGO SREENSHOT */}
      {pagoModalUrl && (
        <div className="modal-overlay" onClick={() => setPagoModalUrl(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px', width: '100%', borderRadius: '16px', padding: '1.5rem', textAlign: 'center', background: 'white' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>💳 Comprobante de Pago</h3>
              <button onClick={() => setPagoModalUrl(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} />
              </button>
            </div>
            <img src={pagoModalUrl} alt="Comprobante" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
          </div>
        </div>
      )}
      {/* MODAL HERRAMIENTAS DE DEPURACIÓN (DUPLICADOS / VACIAR) */}
      {showToolsModal && (
        <div className="modal-overlay" onClick={() => setShowToolsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', width: '100%', borderRadius: '16px', padding: '2rem', background: 'white', maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>🔧 Depuración y Limpieza del Catálogo</h3>
              <button onClick={() => setShowToolsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Sección 1: Duplicados por Nombre */}
              <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontWeight: 700 }}>🔍 Buscar Productos Duplicados</h4>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#475569' }}>
                  A continuación se listan los productos que tienen el mismo nombre en el catálogo. Puedes borrar los duplicados (se conservará solo el primero de ellos).
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {getDuplicados.map((dup) => (
                    <div key={dup.nombre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ textAlign: 'left' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{dup.nombre}</strong>
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#dc2626', fontWeight: 600 }}>Se repite {dup.count} veces</p>
                      </div>
                      <button 
                        className="btn-secondary" 
                        disabled={cleaningDuplicates}
                        style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', border: '1px solid #fca5a5', color: '#b91c1c', background: '#fee2e2', borderRadius: '6px', cursor: 'pointer' }}
                        onClick={() => handleEliminarDuplicados(dup.nombre)}
                      >
                        {cleaningDuplicates ? 'Borrando...' : 'Conservar 1 y Borrar'}
                      </button>
                    </div>
                  ))}
                  {getDuplicados.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: '#16a34a', fontWeight: 600, fontSize: '0.88rem' }}>
                      🎉 ¡Felicidades! No se encontraron productos duplicados en tu catálogo.
                    </div>
                  )}
                </div>
              </div>

              {/* Sección 3: Eliminar por Fecha de Creación */}
              <div style={{ background: '#fffbeb', padding: '1.5rem', borderRadius: '12px', border: '1px solid #fef3c7' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#b45309', fontWeight: 800, textAlign: 'left' }}>📅 Eliminar Productos por Fecha de Creación</h4>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#78350f', textAlign: 'left' }}>
                  Esta acción eliminará todos los productos del catálogo que fueron subidos/creados en el día seleccionado. Ideal para deshacer importaciones erróneas.
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input 
                    type="date" 
                    value={deleteDate}
                    onChange={e => setDeleteDate(e.target.value)}
                    style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: 'white' }}
                  />
                  <button 
                    className="btn-danger"
                    disabled={!deleteDate || loading}
                    onClick={handleEliminarPorFecha}
                    style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '8px', cursor: 'pointer', background: '#d97706', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    🗑️ Eliminar Productos de esta Fecha
                  </button>
                </div>
              </div>

              {/* Sección 2: Vaciar Catálogo */}
              <div style={{ background: '#fef2f2', padding: '1.5rem', borderRadius: '12px', border: '1px solid #fee2e2' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#991b1b', fontWeight: 800 }}>🚨 Acción Crítica: Vaciar Catálogo</h4>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#991b1b' }}>
                  Esta acción eliminará <strong>todos los {productos.length} productos</strong> de tu catálogo digital de forma permanente de Supabase. Esto NO afectará tus productos en Siigo Nube.
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input 
                    type="text" 
                    placeholder="Escribe ELIMINAR TODO para confirmar" 
                    value={wipeConfirmText}
                    onChange={e => setWipeConfirmText(e.target.value)}
                    style={{ flex: 1, padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #fca5a5', outline: 'none', fontSize: '0.85rem' }}
                  />
                  <button
                    className="btn-primary"
                    disabled={wipingCatalog || wipeConfirmText !== 'ELIMINAR TODO'}
                    style={{ padding: '0.6rem 1.2rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                    onClick={handleVaciarCatalogo}
                  >
                    {wipingCatalog ? 'Vaciando...' : '⚠️ Vaciar Todo'}
                  </button>
                </div>
              </div>



            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PURGE ── */}
      {showPurgeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '520px', padding: '2rem', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: '1.15rem' }}>🧹 Purgar Registros</h3>
                <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.82rem' }}>Selecciona qué eliminar y aplica filtros opcionales</p>
              </div>
              <button onClick={() => setShowPurgeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1.4rem', lineHeight: 1 }}>×</button>
            </div>

            {/* Paso 1: Qué purgar */}
            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
              <p style={{ margin: '0 0 0.75rem 0', fontWeight: 700, fontSize: '0.85rem', color: '#374151' }}>1️⃣ ¿Qué deseas purgar?</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {([
                  { key: 'pedidos', label: '📦 Pedidos', count: pedidos.length },
                  { key: 'clientes', label: '👤 Clientes', count: clientes.length },
                  { key: 'leads', label: '🛒 Leads / Carritos Abandonados', count: leads.length },
                ] as { key: 'pedidos' | 'clientes' | 'leads'; label: string; count: number }[]).map(({ key, label, count }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.65rem 0.9rem', borderRadius: '8px', border: `2px solid ${purgeTargets[key] ? '#ea580c' : '#e2e8f0'}`, background: purgeTargets[key] ? '#fff7ed' : 'white', transition: 'all 0.15s' }}>
                    <input
                      type="checkbox"
                      checked={purgeTargets[key]}
                      onChange={e => { setPurgeTargets(prev => ({ ...prev, [key]: e.target.checked })); setPurgePreview(null); }}
                      style={{ width: '16px', height: '16px', accentColor: '#ea580c' }}
                    />
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a' }}>{label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#64748b', background: '#f1f5f9', padding: '0.1rem 0.5rem', borderRadius: '9999px' }}>{count} registros</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Paso 2: Filtros */}
            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
              <p style={{ margin: '0 0 0.75rem 0', fontWeight: 700, fontSize: '0.85rem', color: '#374151' }}>2️⃣ Filtros opcionales (dejar vacío = todos)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Estado</label>
                  <select
                    value={purgeEstado}
                    onChange={e => { setPurgeEstado(e.target.value); setPurgePreview(null); }}
                    style={{ width: '100%', padding: '0.55rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }}
                  >
                    <option value="todos">Todos los estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="atendido">Atendido</option>
                    <option value="completado">Completado</option>
                    <option value="cancelado">Cancelado</option>
                    <option value="abandonado">Abandonado (leads)</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Desde (fecha)</label>
                    <input type="date" value={purgeDesde} onChange={e => { setPurgeDesde(e.target.value); setPurgePreview(null); }}
                      style={{ width: '100%', padding: '0.55rem 0.7rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.83rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Hasta (fecha)</label>
                    <input type="date" value={purgeHasta} onChange={e => { setPurgeHasta(e.target.value); setPurgePreview(null); }}
                      style={{ width: '100%', padding: '0.55rem 0.7rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.83rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <button
                  onClick={calcularPurgePreview}
                  disabled={!purgeTargets.pedidos && !purgeTargets.clientes && !purgeTargets.leads}
                  style={{ padding: '0.6rem 1rem', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.83rem', opacity: (!purgeTargets.pedidos && !purgeTargets.clientes && !purgeTargets.leads) ? 0.5 : 1 }}
                >
                  🔍 Previsualizar cuántos se eliminarán
                </button>
              </div>
            </div>

            {/* Preview */}
            {purgePreview && (
              <div style={{ background: '#fef9c3', borderRadius: '12px', padding: '1rem 1.25rem', border: '1px solid #fde047', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#713f12' }}>⚠️ Se eliminarán:</p>
                {purgeTargets.pedidos && <p style={{ margin: 0, fontSize: '0.83rem', color: '#92400e' }}>• <strong>{purgePreview.pedidos}</strong> pedidos</p>}
                {purgeTargets.clientes && <p style={{ margin: 0, fontSize: '0.83rem', color: '#92400e' }}>• <strong>{purgePreview.clientes}</strong> clientes</p>}
                {purgeTargets.leads && <p style={{ margin: 0, fontSize: '0.83rem', color: '#92400e' }}>• <strong>{purgePreview.leads}</strong> leads</p>}
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#b45309' }}>Total: <strong>{purgePreview.pedidos + purgePreview.clientes + purgePreview.leads}</strong> registros — Esta acción es <strong>irreversible</strong>.</p>
              </div>
            )}

            {/* Paso 3: Confirmar */}
            <div style={{ background: '#fef2f2', borderRadius: '12px', padding: '1.25rem', border: '1px solid #fee2e2' }}>
              <p style={{ margin: '0 0 0.75rem 0', fontWeight: 700, fontSize: '0.85rem', color: '#991b1b' }}>3️⃣ Confirmar — Escribe <strong>PURGAR</strong> para habilitar</p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Escribe PURGAR"
                  value={purgeConfirmText}
                  onChange={e => setPurgeConfirmText(e.target.value)}
                  style={{ flex: 1, padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #fca5a5', fontSize: '0.85rem', outline: 'none', minWidth: '160px' }}
                />
                <button
                  onClick={handlePurge}
                  disabled={purging || purgeConfirmText !== 'PURGAR' || (!purgeTargets.pedidos && !purgeTargets.clientes && !purgeTargets.leads)}
                  style={{ padding: '0.6rem 1.3rem', background: purging ? '#94a3b8' : '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: purging ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.85rem', opacity: (purgeConfirmText !== 'PURGAR' || (!purgeTargets.pedidos && !purgeTargets.clientes && !purgeTargets.leads)) ? 0.5 : 1 }}
                >
                  {purging ? '⏳ Purgando...' : '🗑️ Ejecutar Purge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          <span>{toast.type === 'error' ? '❌' : '✅'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* FLOATING NOTIFICATION REMINDER FOR ADVISOR */}
      {role === 'asesor' && activeNotifications.some(n => n.type === 'warning' || n.type === 'danger') && (() => {
        const criticalCount = activeNotifications.filter(n => n.type === 'warning' || n.type === 'danger').length;
        const key = `dismiss_notif_${currentAsesor?.id}_${new Date().toDateString()}`;
        const isDismissed = localStorage.getItem(key) === 'true';
        if (isDismissed) return null;
        
        return (
          <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'white',
            border: '1px solid #fca5a5',
            borderRadius: '16px',
            padding: '1rem',
            boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.15), 0 4px 6px -2px rgba(239, 68, 68, 0.05)',
            zIndex: 1000,
            maxWidth: '320px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                🔔 Tienes {criticalCount} pendientes
              </span>
              <button 
                onClick={() => localStorage.setItem(key, 'true')} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#94a3b8', padding: 0 }}
              >
                ×
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>
              Hay carritos abandonados o pedidos esperando atención. ¡Atiéndelos rápido para no perder la venta!
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button 
                onClick={() => {
                  setActiveTab('pedidos');
                  localStorage.setItem(key, 'true');
                }}
                style={{
                  flex: 1,
                  background: 'var(--primary-color, #6366f1)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Ir a Pedidos
              </button>
              <button 
                onClick={() => {
                  setActiveTab('notificaciones_asesor');
                  localStorage.setItem(key, 'true');
                }}
                style={{
                  flex: 1,
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Ver Alertas
              </button>
            </div>
          </div>
        );
      })()}

      {/* MODAL ANALÍTICA ASESOR */}
      {selectedAsesorAnalytics && (() => {
        const a = selectedAsesorAnalytics;
        const primaryColor = configuracion?.color_primario || '#6366f1';
        return (
          <div className="modal-overlay" onClick={() => setSelectedAsesorAnalytics(null)} style={{ zIndex: 1100 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()}
              style={{ maxWidth: '820px', width: '100%', borderRadius: '20px', padding: '0', maxHeight: '92vh', overflowY: 'auto', background: 'white' }}>
              <div style={{ padding: '1.5rem 1.75rem', background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`, borderRadius: '20px 20px 0 0', color: 'white', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {a.foto_url ? (
                  <img src={a.foto_url} alt={a.nombre} style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.4)' }} />
                ) : (
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 800, color: 'white', border: '3px solid rgba(255,255,255,0.4)' }}>
                    {a.nombre.charAt(0)}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>📊 Analítica — {a.nombre}</h2>
                  <p style={{ margin: '0.2rem 0 0 0', opacity: 0.85, fontSize: '0.88rem' }}>📲 {(a.telefono || '').split(',').join(' · ')}</p>
                </div>
                <button onClick={() => setSelectedAsesorAnalytics(null)}
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
              <div style={{ padding: '1.75rem' }}>
                {renderAdvisorStatsView(getAdvisorStats(a))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL VER DETALLE DE ALERTAS DE ASESOR */}
      {viewingAdvisorAlerts && (() => {
        const { advisor, alerts } = viewingAdvisorAlerts;
        return (
          <div className="modal-overlay" onClick={() => setViewingAdvisorAlerts(null)} style={{ zIndex: 1100 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%', borderRadius: '16px', padding: '1.5rem', background: 'white' }}>
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  ⚠️ Alertas Activas — {advisor.nombre}
                </h3>
                <button onClick={() => setViewingAdvisorAlerts(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {alerts.map((al, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      padding: '1rem', 
                      borderRadius: '12px', 
                      background: al.type === 'danger' ? '#fef2f2' : al.type === 'warning' ? '#fffbeb' : '#f0f9ff',
                      border: al.type === 'danger' ? '1px solid #fee2e2' : al.type === 'warning' ? '#fef3c7' : '#e0f2fe',
                      textAlign: 'left'
                    }}
                  >
                    <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.88rem', fontWeight: 800, color: al.type === 'danger' ? '#991b1b' : al.type === 'warning' ? '#92400e' : '#0369a1' }}>
                      {al.title}
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>
                      {al.message}
                    </p>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={() => setViewingAdvisorAlerts(null)} style={{ padding: '0.5rem 1.25rem' }}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      
      {(role === 'asesor' || role === 'mayorista') && (
        <div className="mobile-bottom-nav">
          {role === 'asesor' ? (
            <>
              <button 
                type="button"
                className={`bottom-nav-item ${activeTab === 'resumen_asesor' ? 'active' : ''}`} 
                onClick={() => setActiveTab('resumen_asesor')}
              >
                <div className="bottom-nav-icon-container">
                  <Home size={20} />
                </div>
                <span>Resumen</span>
                <div className="bottom-nav-indicator"></div>
              </button>

              <button 
                type="button"
                className={`bottom-nav-item ${activeTab === 'pedidos' ? 'active' : ''}`} 
                onClick={() => setActiveTab('pedidos')}
              >
                <div className="bottom-nav-icon-container">
                  <ShoppingBag size={20} />
                </div>
                <span>Pedidos</span>
                <div className="bottom-nav-indicator"></div>
              </button>

              <button 
                type="button"
                className={`bottom-nav-item ${activeTab === 'productos_asesor' ? 'active' : ''}`} 
                onClick={() => setActiveTab('productos_asesor')}
              >
                <div className="bottom-nav-icon-container">
                  <Package size={20} />
                </div>
                <span>Productos</span>
                <div className="bottom-nav-indicator"></div>
              </button>

              <button 
                type="button"
                className={`bottom-nav-item ${activeTab === 'notificaciones_asesor' ? 'active' : ''}`} 
                onClick={() => setActiveTab('notificaciones_asesor')}
              >
                <div className="bottom-nav-icon-container">
                  <Bell size={20} />
                  {activeNotificationsCount > 0 && (
                    <span className="bottom-nav-badge">{activeNotificationsCount}</span>
                  )}
                </div>
                <span>Alertas</span>
                <div className="bottom-nav-indicator"></div>
              </button>

              <button 
                type="button"
                className={`bottom-nav-item ${activeTab === 'material_asesor' ? 'active' : ''}`} 
                onClick={() => setActiveTab('material_asesor')}
              >
                <div className="bottom-nav-icon-container">
                  <Upload size={20} />
                </div>
                <span>Apoyo</span>
                <div className="bottom-nav-indicator"></div>
              </button>

              <button 
                type="button"
                className={`bottom-nav-item ${activeTab === 'perfil_asesor' ? 'active' : ''}`} 
                onClick={() => setActiveTab('perfil_asesor')}
              >
                <div className="bottom-nav-icon-container">
                  <Settings size={20} />
                </div>
                <span>Perfil</span>
                <div className="bottom-nav-indicator"></div>
              </button>
            </>
          ) : (
            <>
              <button 
                type="button"
                className={`bottom-nav-item ${activeTab === 'resumen_asesor' ? 'active' : ''}`} 
                onClick={() => setActiveTab('resumen_asesor')}
              >
                <div className="bottom-nav-icon-container">
                  <Home size={20} />
                </div>
                <span>Negocio</span>
                <div className="bottom-nav-indicator"></div>
              </button>

              <button 
                type="button"
                className={`bottom-nav-item ${activeTab === 'productos_mayorista' ? 'active' : ''}`} 
                onClick={() => setActiveTab('productos_mayorista')}
              >
                <div className="bottom-nav-icon-container">
                  <Package size={20} />
                </div>
                <span>Productos</span>
                <div className="bottom-nav-indicator"></div>
              </button>

              <button 
                type="button"
                className={`bottom-nav-item ${activeTab === 'pedidos' ? 'active' : ''}`} 
                onClick={() => setActiveTab('pedidos')}
              >
                <div className="bottom-nav-icon-container">
                  <ShoppingBag size={20} />
                </div>
                <span>Pedidos</span>
                <div className="bottom-nav-indicator"></div>
              </button>

              <button 
                type="button"
                className={`bottom-nav-item ${activeTab === 'notificaciones_asesor' ? 'active' : ''}`} 
                onClick={() => setActiveTab('notificaciones_asesor')}
              >
                <div className="bottom-nav-icon-container">
                  <Bell size={20} />
                  {activeNotificationsCount > 0 && (
                    <span className="bottom-nav-badge">{activeNotificationsCount}</span>
                  )}
                </div>
                <span>Alertas</span>
                <div className="bottom-nav-indicator"></div>
              </button>

              <button 
                type="button"
                className={`bottom-nav-item ${activeTab === 'ranking_mayorista' ? 'active' : ''}`} 
                onClick={() => setActiveTab('ranking_mayorista')}
              >
                <div className="bottom-nav-icon-container">
                  <Trophy size={20} />
                </div>
                <span>Ranking</span>
                <div className="bottom-nav-indicator"></div>
              </button>

              <button 
                type="button"
                className={`bottom-nav-item ${activeTab === 'material_asesor' ? 'active' : ''}`} 
                onClick={() => setActiveTab('material_asesor')}
              >
                <div className="bottom-nav-icon-container">
                  <Upload size={20} />
                </div>
                <span>Venta</span>
                <div className="bottom-nav-indicator"></div>
              </button>

              <button 
                type="button"
                className={`bottom-nav-item ${activeTab === 'perfil_asesor' ? 'active' : ''}`} 
                onClick={() => setActiveTab('perfil_asesor')}
              >
                <div className="bottom-nav-icon-container">
                  <Settings size={20} />
                </div>
                <span>Perfil</span>
                <div className="bottom-nav-indicator"></div>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── SIDEBAR COMPONENT ──
function SidebarContent({
  activeTab, setActiveTab, productos, configuracion, handleLogout, onClose, role, currentAsesor, activeNotificationsCount = 0
}: {
  activeTab: TabType;
  setActiveTab: (t: TabType) => void;
  productos: Producto[];
  configuracion: Configuracion | null;
  handleLogout: () => void;
  onClose?: () => void;
  role: 'admin' | 'asesor' | 'mayorista';
  currentAsesor?: any;
  activeNotificationsCount?: number;
}) {
  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    if (onClose) onClose();
  };

  return (
    <>
      <div className="sidebar-brand">
        <div className="brand-icon" style={configuracion?.logo_url ? { background: 'transparent', padding: 0 } : {}}>
          {configuracion?.logo_url ? (
            <img src={configuracion.logo_url} alt="Logo" style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover' }} />
          ) : (
            '🛍️'
          )}
        </div>
        <div className="brand-text">
          <h2 style={{ textTransform: 'capitalize', fontSize: '1.1rem', color: '#0f172a', fontWeight: 800 }}>
            {configuracion?.nombre_negocio ? `${configuracion.nombre_negocio} Admin` : 'Admin'}
          </h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            {role === 'mayorista' ? 'Panel Mayorista' : role === 'asesor' ? 'Panel de Asesor' : 'Panel Administrativo'}
          </p>
          {(role === 'asesor' || role === 'mayorista') && currentAsesor && (
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary-color, #6366f1)' }}>
              Sesión: {currentAsesor.nombre}
            </p>
          )}
          {(role === 'asesor' || role === 'mayorista') && currentAsesor ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.3rem' }}>
              {(currentAsesor.telefono || '').split(',').map((p: string) => p.trim()).filter(Boolean).map((phone: string, idx: number) => (
                <a 
                  key={idx}
                  href={`https://wa.me/${phone.replace(/\D/g, '')}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="sidebar-wa-link"
                  style={{ fontSize: '0.73rem', color: '#10b981', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
                >
                  <Phone size={11} style={{ strokeWidth: 2.5 }} /> Línea: {phone}
                </a>
              ))}
            </div>
          ) : configuracion?.whatsapp ? (
            <a 
              href={`https://wa.me/${configuracion.whatsapp.replace(/\D/g, '')}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="sidebar-wa-link"
              style={{ fontSize: '0.75rem', color: '#10b981', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.3rem', whiteSpace: 'nowrap' }}
            >
              <Phone size={12} style={{ strokeWidth: 2.5 }} /> Línea: {configuracion.whatsapp}
            </a>
          ) : null}
        </div>
      </div>

      <nav className="sidebar-nav" style={{ paddingTop: '0.5rem' }}>
        <div className="sidebar-nav-label">Navegación</div>
        {role === 'mayorista' ? (
          <>
            <button className={`nav-item ${activeTab === 'resumen_asesor' ? 'active' : ''}`} onClick={() => handleSelectTab('resumen_asesor')}>
              <span className="nav-icon"><Home size={14} /></span> Mi Negocio
              {activeTab === 'resumen_asesor' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'productos_mayorista' ? 'active' : ''}`} onClick={() => handleSelectTab('productos_mayorista')}>
              <span className="nav-icon"><Package size={14} /></span> Productos
              {activeTab === 'productos_mayorista' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'pedidos' ? 'active' : ''}`} onClick={() => handleSelectTab('pedidos')}>
              <span className="nav-icon"><ShoppingBag size={14} /></span> Pedidos
              {activeTab === 'pedidos' && <span className="active-dot"></span>}
            </button>
            <button
              className={`nav-item ${activeTab === 'notificaciones_asesor' ? 'active' : ''}`}
              onClick={() => handleSelectTab('notificaciones_asesor')}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: '0.75rem' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="nav-icon"><Bell size={14} /></span> Alertas
              </span>
              {activeNotificationsCount > 0 && (
                <span style={{ background: '#ef4444', color: 'white', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>
                  {activeNotificationsCount}
                </span>
              )}
              {activeTab === 'notificaciones_asesor' && activeNotificationsCount === 0 && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'ranking_mayorista' ? 'active' : ''}`} onClick={() => handleSelectTab('ranking_mayorista')}>
              <span className="nav-icon"><Trophy size={14} /></span> Ranking
              {activeTab === 'ranking_mayorista' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'material_asesor' ? 'active' : ''}`} onClick={() => handleSelectTab('material_asesor')}>
              <span className="nav-icon"><Upload size={14} /></span> Material de Venta
              {activeTab === 'material_asesor' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'perfil_asesor' ? 'active' : ''}`} onClick={() => handleSelectTab('perfil_asesor')}>
              <span className="nav-icon"><Settings size={14} /></span> Mi Perfil
              {activeTab === 'perfil_asesor' && <span className="active-dot"></span>}
            </button>
          </>
        ) : role === 'asesor' ? (
          <>
            <button className={`nav-item ${activeTab === 'resumen_asesor' ? 'active' : ''}`} onClick={() => handleSelectTab('resumen_asesor')}>
              <span className="nav-icon"><LayoutDashboard size={14} /></span> Resumen
              {activeTab === 'resumen_asesor' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'pedidos' ? 'active' : ''}`} onClick={() => handleSelectTab('pedidos')}>
              <span className="nav-icon"><ShoppingBag size={14} /></span> Pedidos
              {activeTab === 'pedidos' && <span className="active-dot"></span>}
            </button>
            <button
              className={`nav-item ${activeTab === 'notificaciones_asesor' ? 'active' : ''}`}
              onClick={() => handleSelectTab('notificaciones_asesor')}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: '0.75rem' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="nav-icon"><Lightbulb size={14} style={{ transform: 'rotate(180deg)' }} /></span> Notificaciones
              </span>
              {activeNotificationsCount > 0 && (
                <span style={{ background: '#ef4444', color: 'white', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>
                  {activeNotificationsCount}
                </span>
              )}
              {activeTab === 'notificaciones_asesor' && activeNotificationsCount === 0 && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'material_asesor' ? 'active' : ''}`} onClick={() => handleSelectTab('material_asesor')}>
              <span className="nav-icon"><Upload size={14} /></span> Material de Apoyo
              {activeTab === 'material_asesor' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'productos_asesor' ? 'active' : ''}`} onClick={() => handleSelectTab('productos_asesor')}>
              <span className="nav-icon"><Package size={14} /></span> Mis Productos
              {activeTab === 'productos_asesor' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'perfil_asesor' ? 'active' : ''}`} onClick={() => handleSelectTab('perfil_asesor')}>
              <span className="nav-icon"><Settings size={14} /></span> Mi Perfil
              {activeTab === 'perfil_asesor' && <span className="active-dot"></span>}
            </button>
          </>
        ) : (
          <>
            <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => handleSelectTab('dashboard')}>
              <span className="nav-icon"><LayoutDashboard size={14} /></span> Dashboard
              {activeTab === 'dashboard' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'pos' ? 'active' : ''}`} onClick={() => handleSelectTab('pos')}>
              <span className="nav-icon"><CreditCard size={14} /></span> POS
              {activeTab === 'pos' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'productos' ? 'active' : ''}`} onClick={() => handleSelectTab('productos')}>
              <span className="nav-icon"><Package size={14} /></span> Productos
              {activeTab === 'productos' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'categorias' ? 'active' : ''}`} onClick={() => handleSelectTab('categorias')}>
              <span className="nav-icon"><Tag size={14} /></span> Categorías
              {activeTab === 'categorias' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'pedidos' ? 'active' : ''}`} onClick={() => handleSelectTab('pedidos')}>
              <span className="nav-icon"><ShoppingBag size={14} /></span> Pedidos
              {activeTab === 'pedidos' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'clientes' ? 'active' : ''}`} onClick={() => handleSelectTab('clientes')}>
              <span className="nav-icon"><User size={14} /></span> Clientes
              {activeTab === 'clientes' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'asesores' ? 'active' : ''}`} onClick={() => handleSelectTab('asesores')}>
              <span className="nav-icon"><Users size={14} /></span> Asesores
              {activeTab === 'asesores' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'mayoristas' ? 'active' : ''}`} onClick={() => handleSelectTab('mayoristas')}>
              <span className="nav-icon"><Users size={14} /></span> Mayoristas
              {activeTab === 'mayoristas' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'siigo' ? 'active' : ''}`} onClick={() => handleSelectTab('siigo')}>
              <span className="nav-icon"><Code size={14} /></span> Desarrollador
              {activeTab === 'siigo' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'material_apoyo' ? 'active' : ''}`} onClick={() => handleSelectTab('material_apoyo')}>
              <span className="nav-icon"><Upload size={14} /></span> Material de Apoyo
              {activeTab === 'material_apoyo' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'config' ? 'active' : ''}`} onClick={() => handleSelectTab('config')}>
              <span className="nav-icon"><Settings size={14} /></span> Configuración
              {activeTab === 'config' && <span className="active-dot"></span>}
            </button>
          </>
        )}
      </nav>

      {role !== 'asesor' && (
        <div className="sidebar-storage-stats">
          <div className="storage-text">
            <strong>{productos.length} Productos</strong>
            <span>límite sugerido 500</span>
          </div>
          <div className="storage-bar">
            <div className="storage-progress" style={{ width: `${Math.min((productos.length / 500) * 100, 100)}%` }}></div>
          </div>
        </div>
      )}

      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1.2rem', borderTop: '1px solid #f1f5f9' }}>
        <a 
          href={(role === 'asesor' || role === 'mayorista') && currentAsesor?.telefono 
            ? `/${getTenantId()}?ws=${currentAsesor.telefono.split(',')[0].trim().replace(/\D/g, '')}${role === 'mayorista' ? '&tipo=mayorista' : ''}` 
            : `/${getTenantId()}?ws=clear`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn-primary" 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.8rem', borderRadius: '8px', textDecoration: 'none', background: 'var(--primary-color, #6366f1)' }}
        >
          <Eye size={16} /> Ver Catálogo
        </a>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="avatar" style={{ background: ((role === 'asesor' || role === 'mayorista') && currentAsesor?.foto_url) ? 'transparent' : (role === 'admin' && configuracion?.admin_foto_url) ? 'transparent' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', border: '1px solid #e2e8f0', color: '#64748b', padding: 0, overflow: 'hidden' }}>
              {(role === 'asesor' || role === 'mayorista') && currentAsesor?.foto_url ? (
                <img src={currentAsesor.foto_url} alt="Usuario" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (role === 'admin' && configuracion?.admin_foto_url) ? (
                <img src={configuracion.admin_foto_url} alt="Admin" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={24} />
              )}
            </div>
            <div className="user-info">
              <h4 style={{ fontSize: '0.9rem', margin: 0, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                {(role === 'asesor' || role === 'mayorista') && currentAsesor ? currentAsesor.nombre : (configuracion?.admin_nombre || 'Administrador')}
              </h4>
              <p style={{ fontSize: '0.75rem', color: role === 'mayorista' ? '#0ea5e9' : '#10b981', margin: 0 }}>
                {role === 'asesor' ? 'Asesor' : role === 'mayorista' ? 'Mayorista' : 'Sesión activa'}
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            title="Cerrar sesión"
            onMouseEnter={(e) => e.currentTarget.style.background = '#fecaca'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fee2e2'}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );
}

