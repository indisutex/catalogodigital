import { useState, useEffect, useMemo } from 'react';
import { supabase, getTenantId, setTenantId } from '../lib/supabase';
import { compressImage } from '../lib/imageCompression';
import { SiigoService } from '../lib/siigoService';
import type { Producto, Categoria, Subcategoria, Configuracion, Pedido, Asesor } from '../types';
import './Admin.css';
import { X, Upload, Package, Tag, Settings, LayoutDashboard, Plus, Trash2, Pencil, Check, Eye, Phone, LogOut, User, ShoppingBag, Copy, RefreshCw, Search, Calculator, Code, Menu, Users } from 'lucide-react';
import * as XLSX from 'xlsx';

const SECRET_PIN = '0000';

type ProductFormData = {
  nombre: string;
  descripcion: string;
  precio: string;
  precio_por_mayor: string;
  precio_50_unidades: string;
  categoria: string;
  subcategoria: string;
  imagenes: string[];
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
  imagenes: [''],
  video_url: '',
  tallas: '',
  estampados: '',
  stock: 0
};

type TabType = 'dashboard' | 'productos' | 'categorias' | 'config' | 'pedidos' | 'siigo' | 'pos' | 'clientes' | 'asesores' | 'perfil_asesor' | 'perfil_admin';

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

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem(`admin_auth_${getTenantId()}`) === 'true';
  });
  const [role, setRole] = useState<'admin' | 'asesor'>(() => {
    return (localStorage.getItem(`admin_role_${getTenantId()}`) as 'admin' | 'asesor') || 'admin';
  });
  const [loggedAsesorPhone, setLoggedAsesorPhone] = useState<string | null>(() => {
    return localStorage.getItem(`admin_asesor_phone_${getTenantId()}`);
  });
  const [pin, setPin] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const defaultTab = (localStorage.getItem(`admin_role_${getTenantId()}`) === 'asesor') ? 'pedidos' : 'productos';
    return (localStorage.getItem('admin_active_tab') as TabType) || defaultTab;
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

  const [bulkForms, setBulkForms] = useState<ProductFormData[]>([{ ...emptyProduct }]);

  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [editExtraImages, setEditExtraImages] = useState<string[]>([]);
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

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleLogout() {
    localStorage.removeItem(`admin_auth_${getTenantId()}`);
    localStorage.removeItem(`admin_role_${getTenantId()}`);
    localStorage.removeItem(`admin_asesor_id_${getTenantId()}`);
    localStorage.removeItem(`admin_asesor_phone_${getTenantId()}`);
    setIsAuthenticated(false);
    setRole('admin');
    setLoggedAsesorPhone(null);
    setSelectedCompany(null);
    setPin('');
  }

  const [pagoModalUrl, setPagoModalUrl] = useState<string | null>(null);

  // Filtros y Ordenamiento para la pestaña de Pedidos
  const [orderFilterStatus, setOrderFilterStatus] = useState<string>('todos');
  const [orderFilterOrigin, setOrderFilterOrigin] = useState<string>('todos');
  const [orderFilterAsesor, setOrderFilterAsesor] = useState<string>('todos');
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [orderFilterDate, setOrderFilterDate] = useState<string>('');
  const [orderSortBy, setOrderSortBy] = useState<string>('date_desc');

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
    
    const match = asesores.find(a => {
      const phones = (a.telefono || '').split(',').map(p => p.replace(/\D/g, '')).filter(Boolean);
      return phones.some(p => cleanInput.split(',').map(cp => cp.replace(/\D/g, '')).includes(p));
    });
    
    if (match) return match.nombre;
    return numSinIndicativo;
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

  useEffect(() => {
    if (isAuthenticated) cargarDatos();
  }, [isAuthenticated]);

  async function cargarDatos() {
    try {
      const tenant = getTenantId();

      // Fetch other data in parallel
      const [catRes, subcatRes, confRes, pedRes, leadRes, cliRes, aseRes] = await Promise.all([
        supabase.from('categorias').select('*').eq('tenant_id', tenant).order('orden', { ascending: true }),
        supabase.from('subcategorias').select('*').eq('tenant_id', tenant).order('orden', { ascending: true }),
        supabase.from('configuracion').select('*').eq('tenant_id', tenant).limit(1).single(),
        supabase.from('pedidos').select('*').eq('tenant_id', tenant).order('created_at', { ascending: false }),
        supabase.from('leads').select('*').eq('tenant_id', tenant).order('created_at', { ascending: false }),
        supabase.from('clientes_exitosos').select('*').eq('tenant_id', tenant).order('total_compras', { ascending: false }),
        supabase.from('asesores').select('*').eq('tenant_id', tenant).order('created_at', { ascending: false })
      ]);

      if (catRes.data) setCategoriasData(catRes.data);
      if (subcatRes.data) setSubcategoriasData(subcatRes.data);
      if (pedRes.data) setPedidos(pedRes.data);
      if (leadRes.data) setLeads(leadRes.data);
      if (cliRes.data) setClientes(cliRes.data);
      if (aseRes && aseRes.data) setAsesores(aseRes.data);

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
    if (pin === SECRET_PIN) {
      localStorage.setItem(`admin_auth_${getTenantId()}`, 'true');
      localStorage.setItem(`admin_role_${getTenantId()}`, 'admin');
      setRole('admin');
      setLoggedAsesorPhone(null);
      setIsAuthenticated(true);
      return;
    }

    try {
      setLoading(true);
      const tenant = getTenantId();
      const { data: advisorMatch, error } = await supabase
        .from('asesores')
        .select('*')
        .eq('tenant_id', tenant)
        .eq('pin', pin.trim())
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (advisorMatch) {
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
        showToast('PIN incorrecto o no registrado.', 'error');
        setPin('');
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
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const compFile = await compressImage(file);
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${compFile.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage.from('archivos').upload(fileName, compFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
        uploadedUrls.push(data.publicUrl);
      }
      // Insertar las URLs subidas a partir de la posición imgIndex
      const newForms = [...bulkForms];
      const newImagenes = [...newForms[formIndex].imagenes];
      newImagenes.splice(imgIndex, 1, ...uploadedUrls);
      // Agregar filas extra si se subieron más de una imagen
      newForms[formIndex] = { ...newForms[formIndex], imagenes: newImagenes };
      setBulkForms(newForms);
      showToast(`${uploadedUrls.length} foto(s) subida(s) ✓`);
    } catch {
      showToast('Error al subir foto(s)', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateImagenUrl = (formIndex: number, imgIndex: number, value: string) => {
    const newForms = [...bulkForms];
    const newImagenes = [...newForms[formIndex].imagenes];
    newImagenes[imgIndex] = value;
    newForms[formIndex] = { ...newForms[formIndex], imagenes: newImagenes };
    setBulkForms(newForms);
  };

  const addImagenRow = (formIndex: number) => {
    const newForms = [...bulkForms];
    newForms[formIndex] = { ...newForms[formIndex], imagenes: [...newForms[formIndex].imagenes, ''] };
    setBulkForms(newForms);
  };

  const removeImagenRow = (formIndex: number, imgIndex: number) => {
    const newForms = [...bulkForms];
    const newImagenes = newForms[formIndex].imagenes.filter((_, i) => i !== imgIndex);
    newForms[formIndex] = { ...newForms[formIndex], imagenes: newImagenes.length > 0 ? newImagenes : [''] };
    setBulkForms(newForms);
  };



  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const validForms = bulkForms.filter(f => f.nombre.trim() !== '' && f.precio !== '');
    const newProducts = validForms.map(f => ({
      nombre: f.nombre,
      descripcion: f.descripcion,
      precio: parseFloat(f.precio),
      precio_por_mayor: parseFloat(f.precio_por_mayor) || null,
      precio_50_unidades: parseFloat(f.precio_50_unidades) || null,
      categoria: f.categoria,
      subcategoria: f.subcategoria || null,
      imagen_url: f.imagenes.find(u => u.trim()) || '',
      video_url: f.video_url || null,
      tallas: f.tallas || null,
      estampados: f.estampados || null,
      stock: f.stock || 0,
      tenant_id: getTenantId()
    }));
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
    // 1. Abrir WhatsApp con cobro y enlace
    const num = (ped.cliente_telefono || '').replace(/\D/g, '');
    const uploadLink = `${window.location.origin}/pago/${ped.id}`;
    const msg = `¡Hola ${ped.cliente_nombre}! 👋\nGracias por tu pedido en *${configuracion?.nombre_negocio || 'nuestra tienda'}*.\n\n*Total a pagar: $${ped.total.toLocaleString()} COP*\n\n💳 *Datos del banco:*\nNúmero: ${configuracion?.whatsapp || ''}\nTitular: ${configuracion?.nombre_negocio || ''}\n\nPara poder completar tu pedido, haz la captura de pantalla de tu pago o de transacción y envíala por este enlace:\n${uploadLink}\n\n¡Tu pedido será despachado en cuanto verifiquemos el pago! 🚀`;
    window.open(`https://wa.me/57${num}?text=${encodeURIComponent(msg)}`, '_blank');

    // 2. Marcar en Base de Datos como atendido
    const { error } = await supabase.from('pedidos').update({ atendido: true }).eq('id', ped.id);
    if (!error) {
      setPedidos(prev => prev.map(p => p.id === ped.id ? { ...p, atendido: true } : p));
      showToast('Pedido marcado como atendido ✓');
    } else {
      showToast('Error al marcar como atendido en DB', 'error');
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setLoading(true);
    const { error } = await supabase.from('productos').update({
      nombre: editingProduct.nombre,
      descripcion: editingProduct.descripcion,
      precio: editingProduct.precio,
      precio_por_mayor: editingProduct.precio_por_mayor || null,
      precio_50_unidades: editingProduct.precio_50_unidades || null,
      categoria: editingProduct.categoria,
      subcategoria: editingProduct.subcategoria || null,
      imagen_url: editingProduct.imagen_url,
      imagenes_extra: editExtraImages.filter(u => u.trim()),
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
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const compFile = await compressImage(file);
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${compFile.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage.from('archivos').upload(fileName, compFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
        uploadedUrls.push(data.publicUrl);
      }
      setEditExtraImages(prev => {
        const next = [...prev];
        next.splice(idx, 1, ...uploadedUrls);
        return next;
      });
      showToast(`${uploadedUrls.length} foto(s) extra subida(s) ✓`);
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
      );
    }

    if (orderFilterStatus !== 'todos') {
      if (orderFilterStatus === 'comprobante') {
        result = result.filter(p => !!p.pantallazo_url);
      } else if (orderFilterStatus === 'esperando_pago') {
        result = result.filter(p => !p.pantallazo_url);
      }
    }

    if (orderFilterOrigin !== 'todos') {
      result = result.filter(p => {
        const o = p.origen || 'catalogo';
        return o === orderFilterOrigin;
      });
    }

    if (role === 'asesor' && loggedAsesorPhone) {
      result = result.filter(p => {
        const orderPhone = p.linea_whatsapp?.replace(/\D/g, '');
        const advisorPhones = loggedAsesorPhone.split(',').map(phone => phone.replace(/\D/g, '')).filter(Boolean);
        return orderPhone && advisorPhones.includes(orderPhone);
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

    return {
      totalVentasVal,
      noResueltosCount: noResueltos.length,
      posCount: posOrders.length,
      catalogCount: catalogOrders.length,
      sortedCities,
      bestAdvisorPhone: bestAdvisor.phone,
      bestAdvisorTotal: bestAdvisor.total
    };
  }, [pedidos, asesores]);

  const leadsFiltrados = useMemo(() => {
    let temp = [...leads];
    if (orderSearchQuery) {
      const q = orderSearchQuery.toLowerCase();
      temp = temp.filter(l => 
        (l.nombre || '').toLowerCase().includes(q) ||
        (l.telefono || '').toLowerCase().includes(q) ||
        (l.ciudad || '').toLowerCase().includes(q)
      );
    }
    if (orderFilterDate) {
      temp = temp.filter(l => l.created_at.startsWith(orderFilterDate));
    }
    if (role === 'asesor' && loggedAsesorPhone) {
      temp = temp.filter(l => {
        const leadPhone = l.linea_whatsapp?.replace(/\D/g, '');
        const advisorPhones = loggedAsesorPhone.split(',').map(phone => phone.replace(/\D/g, '')).filter(Boolean);
        return leadPhone && advisorPhones.includes(leadPhone);
      });
    } else if (orderFilterAsesor !== 'todos') {
      temp = temp.filter(l => {
        const leadPhone = l.linea_whatsapp?.replace(/\D/g, '');
        const filterPhones = orderFilterAsesor.split(',').map(phone => phone.replace(/\D/g, '')).filter(Boolean);
        return leadPhone && filterPhones.includes(leadPhone);
      });
    }
    return temp;
  }, [leads, orderSearchQuery, orderFilterDate, role, loggedAsesorPhone, orderFilterAsesor]);

  const interesadosFiltrados = useMemo(() => {
    return filteredPedidos.filter(p => p.estado === 'pendiente' || p.estado === 'atendido' || !p.estado);
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

  const filteredAsesores = useMemo(() => {
    let list = [...asesores];
    if (asesorSearchQuery.trim()) {
      const q = asesorSearchQuery.toLowerCase();
      list = list.filter(a => 
        (a.nombre || '').toLowerCase().includes(q) ||
        (a.telefono || '').includes(q)
      );
    }
    return list;
  }, [asesores, asesorSearchQuery]);

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

  const filteredProducts = productos.filter(p =>
    p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.categoria.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── LOGIN SCREEN ──
  const [dbCompanies, setDbCompanies] = useState<any[]>([]);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    if (!isAuthenticated) {
      supabase.from('configuracion').select('tenant_id, nombre_negocio, logo_url')
        .then(({ data, error }) => {
          if (data && !error) setDbCompanies(data);
        });
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    const baseCompanies = [
      { id: 'saramantha', name: 'Saramantha', logo: '/saramantha-logo.jpg' }, 
      { id: 'sublimados_majestic', name: 'Sublimados Majestic', logo: '/sublimados-logo.jpg' },
      { id: 'pijamas_lucerito', name: 'Pijamas Lucerito', logo: '/lucerito-logo.jpg' },
      { id: 'sueno_de_reina', name: 'Sueño de Reina', logo: '/sueno-de-reina-logo.jpg' },
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
            </div>
          ) : (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1rem', background: '#f8fafc', padding: '0.8rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: '#333' }}>Empresa: {companies.find(c => c.id === selectedCompany)?.name || selectedCompany}</span>
                <button type="button" onClick={() => setSelectedCompany(null)} style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Cambiar</button>
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
          <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} productos={productos} configuracion={configuracion} handleLogout={handleLogout} role={role} currentAsesor={role === 'asesor' ? asesores.find(a => a.id === localStorage.getItem(`admin_asesor_id_${getTenantId()}`)) : null} />
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
                     <div className="form-field">
                       <label>Categoría</label>
                       <select value={editingProduct.categoria} onChange={e => setEditingProduct({ ...editingProduct, categoria: e.target.value })}>
                         {categoriasData.map(c => <option key={c.id} value={c.slug}>{c.nombre}</option>)}
                       </select>
                     </div>
                     <div className="form-field full" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                       <div>
                         <label>Tallas (separadas por coma)</label>
                         <input value={editingProduct.tallas || ''} onChange={e => setEditingProduct({ ...editingProduct, tallas: e.target.value })} placeholder="Ej: S, M, L, XL" />
                       </div>
                       <div>
                         <label>Estampados / Temáticas</label>
                         <input value={editingProduct.estampados || ''} onChange={e => setEditingProduct({ ...editingProduct, estampados: e.target.value })} placeholder="Ej: Dinosaurios, Ositos, Rayas" />
                       </div>
                     </div>
                    <div className="form-field full">
                      <label>Foto Principal</label>
                      <div className="img-input-row">
                        {editingProduct.imagen_url && <img src={editingProduct.imagen_url} className="img-preview-thumb" alt="" />}
                        <input value={editingProduct.imagen_url || ''} onChange={e => setEditingProduct({ ...editingProduct, imagen_url: e.target.value })} placeholder="URL de imagen principal" />
                      </div>
                      <label htmlFor="edit-main-img-upload" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', cursor: 'pointer', background: '#f0f9ff', border: '1px dashed #0ea5e9', borderRadius: '8px', padding: '0.4rem 0.9rem', fontSize: '0.8rem', color: '#0ea5e9', fontWeight: 600 }}>
                        <Upload size={14} /> Subir foto principal
                      </label>
                      <input id="edit-main-img-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditMainImgUpload} />
                    </div>

                    {/* ── FOTOS EXTRA ── */}
                    <div className="form-field full">
                      <label>📸 Fotos Adicionales del Producto</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                        {editExtraImages.map((url, idx) => (
                          <div key={idx} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
                            {url && <img src={url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '2px solid #e2e8f0' }} />}
                            {!url && <div style={{ width: 80, height: 80, background: '#f1f5f9', borderRadius: 8, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📷</div>}
                            <label htmlFor={`edit-extra-${idx}`} style={{ cursor: 'pointer', fontSize: '0.7rem', color: '#0ea5e9', fontWeight: 600 }}>
                              {editUploadingIdx === idx ? '...' : '📤 Cambiar'}
                            </label>
                            <input id={`edit-extra-${idx}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleEditExtraUpload(e, idx)} />
                            <button type="button" onClick={() => setEditExtraImages(prev => prev.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                          </div>
                        ))}
                        {/* Botón agregar foto extra */}
                        <label htmlFor="edit-extra-new" style={{ width: 80, height: 80, background: '#f0fdf4', border: '2px dashed #22c55e', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.65rem', color: '#16a34a', fontWeight: 700, gap: '0.2rem' }}>
                          <span style={{ fontSize: '1.4rem' }}>+</span> Agregar foto
                        </label>
                        <input id="edit-extra-new" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={async e => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          setEditUploadingIdx(-1);
                          try {
                            const urls: string[] = [];
                            for (const file of files) {
                              const compFile = await compressImage(file);
                              const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${compFile.name.split('.').pop()}`;
                              const { error: uploadError } = await supabase.storage.from('archivos').upload(fileName, compFile);
                              if (uploadError) throw uploadError;
                              const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
                              urls.push(data.publicUrl);
                            }
                            setEditExtraImages(prev => [...prev, ...urls]);
                            showToast(`${urls.length} foto(s) agregada(s) ✓`);
                          } catch { showToast('Error al subir foto(s)', 'error'); }
                          finally { setEditUploadingIdx(null); }
                        }} />
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
          <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} productos={productos} configuracion={configuracion} handleLogout={handleLogout} role={role} currentAsesor={role === 'asesor' ? asesores.find(a => a.id === localStorage.getItem(`admin_asesor_id_${getTenantId()}`)) : null} />
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
          <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} productos={productos} configuracion={configuracion} handleLogout={handleLogout} role={role} currentAsesor={role === 'asesor' ? asesores.find(a => a.id === localStorage.getItem(`admin_asesor_id_${getTenantId()}`)) : null} />
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
      <aside className={`admin-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <SidebarContent 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          productos={productos} 
          configuracion={configuracion} 
          handleLogout={handleLogout} 
          onClose={() => setIsMobileMenuOpen(false)} 
          role={role}
          currentAsesor={role === 'asesor' ? asesores.find(a => a.id === localStorage.getItem(`admin_asesor_id_${getTenantId()}`)) : null}
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
            className="mobile-menu-toggle" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="topbar-title">
            <h2>
              {activeTab === 'dashboard' && '📊 Dashboard'}
              {activeTab === 'productos' && '📦 Productos'}
              {activeTab === 'categorias' && '🗂️ Categorías'}
              {activeTab === 'clientes' && '👥 Clientes'}
              {activeTab === 'asesores' && '👥 Asesores'}
              {activeTab === 'config' && '⚙️ Configuración'}
            </h2>
            <p>
              {activeTab === 'productos' && `${productos.length} productos en total`}
              {activeTab === 'categorias' && `${categoriasData.length} categorías activas`}
              {activeTab === 'clientes' && `${clientes.length} clientes en total`}
              {activeTab === 'asesores' && `${asesores.length} asesores en tu equipo`}
              {activeTab === 'config' && 'Ajustes globales de tu tienda'}
            </p>
          </div>
          <div className="topbar-actions">
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
                              <div className="form-field full" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                  <label>Tallas (separadas por coma, opcional)</label>
                                  <input value={form.tallas} onChange={e => updateBulkForm(index, 'tallas', e.target.value)} placeholder="Ej: S, M, L, XL" />
                                </div>
                                <div>
                                  <label>Estampados / Temáticas (opcional)</label>
                                  <input value={form.estampados} onChange={e => updateBulkForm(index, 'estampados', e.target.value)} placeholder="Ej: Dinosaurios, Ositos, Rayas" />
                                </div>
                              </div>
                              <div className="form-field full">
                                <label>🖼️ Imágenes del Producto</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  {form.imagenes.map((imgUrl, imgIdx) => (
                                    <div key={imgIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', background: '#f8fafc', borderRadius: '12px', padding: '0.8rem', border: '1px solid #e2e8f0', minHeight: '170px' }}>
                                      {imgUrl ? (
                                        <img
                                          src={imgUrl}
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
                                          value={imgUrl}
                                          onChange={e => updateImagenUrl(index, imgIdx, e.target.value)}
                                          placeholder={imgIdx === 0 ? 'URL de imagen principal...' : 'URL de imagen extra...'}
                                        />
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
                        <label className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.7rem 1.8rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                          <Upload size={14} /> Seleccionar Archivo Excel
                          <input type="file" accept=".xlsx, .xls, .csv" style={{ display: 'none' }} onChange={handleExcelImport} />
                        </label>
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
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button 
                        className="btn-secondary" 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: '1px solid #fca5a5', color: '#b91c1c', background: '#fee2e2', padding: '0.55rem 1rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', transition: 'all 0.2s' }}
                        onClick={() => setShowToolsModal(true)}
                      >
                        🔧 Depurar Catálogo
                      </button>
                      
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
                    </div>
                  </div>
                <div className="panel-body">
                  {filteredProducts.length === 0 ? (
                    <div className="empty-state">
                      <div className="es-icon">📦</div>
                      <h4>No hay productos aún</h4>
                      <p>Aún no tienes ningún producto en tu inventario.</p>
                      <button className="btn-primary" onClick={() => setIsAddingProduct(true)} style={{ marginTop: '1rem' }}>
                        + Agregar Primer Producto
                      </button>
                    </div>
                  ) : (
                    <div className="products-grid">
                      {filteredProducts.map(p => (
                        <div key={p.id} className="product-card">
                          <div className="product-card-img">
                            {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} /> : '🖼️'}
                          </div>
                          <div className="product-card-body">
                            <h4>{p.nombre}</h4>
                            <p className="p-cat">{p.categoria}</p>
                            <p className="p-price">${p.precio.toLocaleString()}</p>
                          </div>
                          <div className="product-card-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem', padding: '0.65rem 0.9rem', background: '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                            <button 
                              className="btn-edit" 
                              style={{ padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', border: '1px solid #bae6fd', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', width: '32px', height: '32px' }}
                              onClick={() => { setEditingProduct(p); setEditExtraImages(p.imagenes_extra || []); }}
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

          {/* ── PERFIL ASESOR TAB ── */}
          {activeTab === 'perfil_asesor' && role === 'asesor' && (
            <div className="admin-panel">
              <div className="panel-header">
                <div>
                  <h3><User size={16} /> Mi Perfil</h3>
                  <p>Configura tus datos personales</p>
                </div>
              </div>
              <div className="panel-body">
                {asesores.find(a => a.telefono === loggedAsesorPhone) ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      setLoading(true);
                      const currentAsesorData = asesores.find(a => a.telefono === loggedAsesorPhone);
                      if (!currentAsesorData) return;
                      const { error } = await supabase
                        .from('asesores')
                        .update({
                          nombre: (document.getElementById('perfil-nombre') as HTMLInputElement).value,
                          pin: (document.getElementById('perfil-pin') as HTMLInputElement).value,
                          foto_url: (document.getElementById('perfil-foto') as HTMLInputElement).value,
                        })
                        .eq('id', currentAsesorData.id);
                      if (error) throw error;
                      showToast('Perfil actualizado correctamente', 'success');
                      // Update local state
                      setAsesores(asesores.map(a => 
                        a.id === currentAsesorData.id 
                          ? { ...a, 
                              nombre: (document.getElementById('perfil-nombre') as HTMLInputElement).value,
                              pin: (document.getElementById('perfil-pin') as HTMLInputElement).value,
                              foto_url: (document.getElementById('perfil-foto') as HTMLInputElement).value,
                            } 
                          : a
                      ));
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
                          defaultValue={asesores.find(a => a.telefono === loggedAsesorPhone)?.nombre} 
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
                          defaultValue={asesores.find(a => a.telefono === loggedAsesorPhone)?.pin} 
                          required 
                        />
                      </div>
                      <div className="form-field">
                        <label>Foto de Perfil</label>
                        <div className="img-input-row" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {asesores.find(a => a.telefono === loggedAsesorPhone)?.foto_url && (
                            <img src={asesores.find(a => a.telefono === loggedAsesorPhone)?.foto_url} className="img-preview-thumb" alt="Foto Perfil" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }} />
                          )}
                          <input 
                            type="url" 
                            id="perfil-foto"
                            defaultValue={asesores.find(a => a.telefono === loggedAsesorPhone)?.foto_url || ''} 
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
                                const currentAsesorData = asesores.find(a => a.telefono === loggedAsesorPhone);
                                if (currentAsesorData) {
                                  setAsesores(asesores.map(a => 
                                    a.id === currentAsesorData.id 
                                      ? { ...a, foto_url: data.publicUrl } 
                                      : a
                                  ));
                                }
                              } catch {
                                showToast('Error al subir foto', 'error');
                              }
                            }} />
                          </label>
                        </div>
                        <small style={{color: '#64748b'}}>Esta foto aparecerá en tu panel y como asesor estrella.</small>
                      </div>
                    </div>
                    <div className="form-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Guardando...' : 'Guardar Perfil'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p>Cargando datos del perfil...</p>
                )}
              </div>
            </div>
          )}


          {/* ── PERFIL ADMIN TAB ── */}
          {activeTab === 'perfil_admin' && (
            <div className="admin-panel">
              <div className="panel-header">
                <div>
                  <h3><User size={16} /> Mi Perfil (Administrador)</h3>
                  <p>Configura tus datos personales</p>
                </div>
              </div>
              <div className="panel-body">
                {configuracion ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setLoading(true);
                    
                    const updateData = {
                      admin_nombre: configuracion.admin_nombre,
                      admin_foto_url: configuracion.admin_foto_url
                    };
                    
                    const { error } = await supabase.from('configuracion').update(updateData).eq('id', configuracion.id);
                    
                    if (error) {
                      showToast('Error: ' + error.message, 'error');
                    } else {
                      showToast('Perfil guardado ✓');
                    }
                    
                    setLoading(false);
                  }}>
                    <div className="config-section">
                      <div className="form-grid">
                        <div className="form-field">
                          <label>Nombre del Administrador</label>
                          <input 
                            value={configuracion.admin_nombre || ''} 
                            onChange={e => setConfiguracion({ ...configuracion, admin_nombre: e.target.value })} 
                            placeholder="Ej. Juan Pérez" 
                          />
                        </div>
                        <div className="form-field">
                          <label>Foto de Perfil</label>
                          <div className="img-input-row">
                            {configuracion.admin_foto_url && <img src={configuracion.admin_foto_url} className="img-preview-thumb" alt="Admin" />}
                            <input 
                              type="url" 
                              value={configuracion.admin_foto_url || ''} 
                              onChange={e => setConfiguracion({ ...configuracion, admin_foto_url: e.target.value })} 
                              placeholder="https://..." 
                              style={{ flex: 1 }} 
                            />
                            <label className="btn-upload-img" style={{ flexShrink: 0, cursor: 'pointer' }}>
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
                    <div className="form-actions" style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.6rem 2rem' }}>
                        {loading ? 'Guardando...' : 'Guardar Perfil'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="empty-state">
                    <div className="loading-dot" />
                    <p style={{ marginTop: '1rem' }}>Cargando perfil...</p>
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
                      admin_foto_url: configuracion.admin_foto_url
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

                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.7rem 2rem' }}>
                        <Check size={14} /> {loading ? 'Guardando...' : 'Guardar Configuración'}
                      </button>
                    </div>
                  </form>
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
                                    {isEditing && (
                                      <input
                                        type="url"
                                        placeholder="URL Foto (Opcional)"
                                        value={editingAsesorFotoUrl}
                                        onChange={e => setEditingAsesorFotoUrl(e.target.value)}
                                        style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', width: '130px' }}
                                      />
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
                              <td style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                  {(a.telefono || '').split(',').map(p => p.trim()).filter(Boolean).map((phone, idx) => {
                                    const link = `${window.location.origin}/${getTenantId()}?ws=${phone}`;
                                    return (
                                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, minWidth: '90px' }}>{phone}:</span>
                                        <input
                                          type="text"
                                          readOnly
                                          value={link}
                                          style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', width: '150px', background: '#f8fafc', color: '#64748b' }}
                                          onClick={e => (e.target as HTMLInputElement).select()}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(link);
                                            showToast(`Enlace (${phone}) copiado ✓`, 'success');
                                          }}
                                          className="btn-secondary"
                                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap' }}
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

          {/* ── DASHBOARD TAB ── */}
          {activeTab === 'dashboard' && (
            <>
               {/* Fila de Métricas Principales de Ventas */}
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                 <div className="metric-card" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', position: 'relative', overflow: 'hidden' }}>
                   <div style={{ position: 'absolute', right: '-10px', top: '-10px', fontSize: '5rem', opacity: 0.15 }}>💰</div>
                   <div className="mc-label" style={{ color: 'rgba(255,255,255,0.85)' }}>Total Ventas (Comprobado)</div>
                   <div className="mc-value" style={{ fontSize: '1.8rem', color: 'white' }}>${stats.totalVentasVal.toLocaleString()} COP</div>
                   <div className="mc-sub" style={{ color: 'rgba(255,255,255,0.75)' }}>Únicamente pagos verificados</div>
                 </div>

                 <div className="metric-card" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', border: 'none', position: 'relative', overflow: 'hidden' }}>
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
                     const bestAsesorObj = asesores.find(a => {
                       const phones = (a.telefono || '').split(',').map(p => p.replace(/\D/g, '')).filter(Boolean);
                       const bestPhones = (stats.bestAdvisorPhone || '').split(',').map(p => p.replace(/\D/g, '')).filter(Boolean);
                       return phones.some(p => bestPhones.includes(p));
                     });
                     const hasAdvisor = !!bestAsesorObj;
                     const hasPhoto = !!bestAsesorObj?.foto_url;
                     return (
                       <>
                         <div style={{ position: 'absolute', right: '15px', top: '15px', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           {hasPhoto ? (
                             <img src={bestAsesorObj.foto_url} alt={bestAsesorObj.nombre} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.4)', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))', animation: 'float-party 3s ease-in-out infinite' }} />
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
                     <div className="mc-label" style={{ color: 'rgba(255,255,255,0.85)' }}>Línea / Asesor Estrella</div>
                     <div className="mc-value" style={{ fontSize: '1.5rem', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{getAsesorNameByPhone(stats.bestAdvisorPhone)}</div>
                     <div className="mc-sub" style={{ color: 'rgba(255,255,255,0.75)' }}>Ventas: ${stats.bestAdvisorTotal.toLocaleString()} COP</div>
                   </div>
                 </div>

                 <div className="metric-card" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', border: 'none', position: 'relative', overflow: 'hidden' }}>
                   <div style={{ position: 'absolute', right: '-10px', top: '-10px', fontSize: '5rem', opacity: 0.15 }}>⏳</div>
                   <div className="mc-label" style={{ color: 'rgba(255,255,255,0.85)' }}>Pedidos por Atender / Pendientes</div>
                   <div className="mc-value" style={{ fontSize: '2rem', color: 'white' }}>{stats.noResueltosCount}</div>
                   <div className="mc-sub" style={{ color: 'rgba(255,255,255,0.75)' }}>Pendientes de pago o revisión</div>
                 </div>

                 <div className="metric-card" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', border: 'none', position: 'relative', overflow: 'hidden' }}>
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
                         <div style={{ background: '#3b82f6', height: '100%', width: `${pedidos.length > 0 ? (stats.catalogCount / pedidos.length) * 100 : 0}%`, transition: 'width 1s ease-in-out' }}></div>
                       </div>
                     </div>

                     {/* Canal POS */}
                     <div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                         <span>💻 POS Ventas</span>
                         <span>{stats.posCount} pedidos ({pedidos.length > 0 ? Math.round((stats.posCount / pedidos.length) * 100) : 0}%)</span>
                       </div>
                       <div style={{ background: '#f1f5f9', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                         <div style={{ background: '#10b981', height: '100%', width: `${pedidos.length > 0 ? (stats.posCount / pedidos.length) * 100 : 0}%`, transition: 'width 1s ease-in-out' }}></div>
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
                               <div style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', height: '100%', width: `${pct}%`, transition: 'width 1s ease-in-out' }}></div>
                             </div>
                           </div>
                         );
                       })
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
                        const num = posLastInvoice.cliente_telefono.replace(/\D/g, '');
                        const itemsStr = posLastInvoice.productos.map((i: any) => `- ${i.cantidad}x ${i.nombre} ${i.talla ? `(${i.talla})` : ''}`).join('\n');
                        const msg = `¡Hola ${posLastInvoice.cliente_nombre}! 👋\\nMuchas gracias por tu compra en *${configuracion?.nombre_negocio || 'nuestra tienda'}*.\\n\\n*Detalle de tu compra:*\\n${itemsStr}\\n\\n*Total Pagado: $${posLastInvoice.total.toLocaleString()} COP*\\n*Método de Pago: ${posLastInvoice.metodo_pago.toUpperCase()}*\\n\\n¡Esperamos que disfrutes tus productos! 😊`;
                        window.open(`https://wa.me/57${num}?text=${encodeURIComponent(msg)}`, '_blank');
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
          {activeTab === 'pedidos' && (
            <div className="admin-panel">
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3><ShoppingBag size={16} /> Registro de Pedidos</h3>
                  <p>Pedidos recibidos desde el catálogo digital y su asignación de línea</p>
                </div>
                
                {/* Switcher Vista */}
                <div style={{ display: 'flex', gap: '0.25rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
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
              <div className="panel-body">
                {pedidos.length === 0 && leads.length === 0 ? (
                  <div className="empty-state">
                    <div className="es-icon">📋</div>
                    <p style={{ marginTop: '1rem' }}>No hay pedidos ni leads registrados todavía</p>
                  </div>
                ) : (
                  <>
                    {/* Barra de Filtros y Búsqueda */}
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div className="search-input-container" style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: '220px' }}>
                        <span style={{ position: 'absolute', left: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                          <Search size={15} />
                        </span>
                        <input
                          className="search-bar"
                          style={{ width: '100%', padding: '0.55rem 1rem 0.55rem 2.25rem', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.85rem', background: 'white', margin: 0 }}
                          placeholder="Buscar por cliente, teléfono o ciudad..."
                          value={orderSearchQuery}
                          onChange={e => setOrderSearchQuery(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          <input 
                            type="date"
                            value={orderFilterDate}
                            onChange={e => setOrderFilterDate(e.target.value)}
                            style={{ padding: '0.55rem 0.8rem', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.85rem', background: 'white', cursor: 'pointer' }}
                          />
                          {orderFilterDate && (
                            <button 
                              onClick={() => setOrderFilterDate('')}
                              style={{ padding: '0.55rem 0.85rem', borderRadius: '10px', border: '1px solid #fca5a5', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                            >
                              Limpiar
                            </button>
                          )}
                        </div>

                        {pedidosViewMode === 'lista' && (
                          <select 
                            value={orderFilterStatus} 
                            onChange={e => setOrderFilterStatus(e.target.value)}
                            style={{ padding: '0.55rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.85rem', background: 'white', cursor: 'pointer' }}
                          >
                            <option value="todos">Todos los Pagos</option>
                            <option value="comprobante">Con Comprobante</option>
                            <option value="esperando_pago">Esperando Pago</option>
                          </select>
                        )}

                        <select 
                          value={orderFilterOrigin} 
                          onChange={e => setOrderFilterOrigin(e.target.value)}
                          style={{ padding: '0.55rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.85rem', background: 'white', cursor: 'pointer' }}
                        >
                          <option value="todos">Todos los Orígenes</option>
                          <option value="catalogo">📱 Catálogo</option>
                          <option value="pos">💻 POS</option>
                        </select>

                        {role !== 'asesor' && (
                          <select 
                            value={orderFilterAsesor} 
                            onChange={e => setOrderFilterAsesor(e.target.value)}
                            style={{ padding: '0.55rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.85rem', background: 'white', cursor: 'pointer' }}
                          >
                            <option value="todos">Todos los Asesores</option>
                            {asesores.map(a => (
                              <option key={a.id} value={a.telefono}>👤 {a.nombre} ({a.telefono})</option>
                            ))}
                          </select>
                        )}

                        <select 
                          value={orderSortBy} 
                          onChange={e => setOrderSortBy(e.target.value)}
                          style={{ padding: '0.55rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.85rem', background: 'white', cursor: 'pointer' }}
                        >
                          <option value="date_desc">Más recientes primero</option>
                          <option value="date_asc">Más antiguos primero</option>
                          <option value="total_desc">Mayor valor</option>
                          <option value="total_asc">Menor valor</option>
                        </select>
                      </div>
                    </div>

                    {pedidosViewMode === 'kanban' ? (
                      <div className="super-crm-kanban" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginTop: '1rem', alignItems: 'start' }}>
                        {/* Columna 1: No Interesados (Abandonos) */}
                        <div className="kanban-column" style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '500px' }}>
                          <div className="kanban-column-header col-red" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ef4444', paddingBottom: '0.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#ef4444' }}>🔴 No Interesados (Abandonos)</h3>
                            <span className="badge" style={{ background: '#fee2e2', color: '#ef4444', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>{leadsFiltrados.length}</span>
                          </div>
                          <div className="kanban-cards-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
                            {leadsFiltrados.map((lead) => (
                              <div key={lead.id} className="kanban-card lead-card" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>👤 {lead.nombre || 'Borrador Anónimo'}</h4>
                                  {lead.linea_whatsapp && (
                                    <span style={{ fontSize: '0.65rem', background: '#f8fafc', color: '#475569', padding: '2px 6px', borderRadius: '12px', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                                      🎯 {getAsesorNameByPhone(lead.linea_whatsapp)}
                                    </span>
                                  )}
                                </div>
                                <p className="phone" style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: '#475569' }}>📞 {lead.telefono || 'Sin número'}</p>
                                <p className="city" style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: '#475569' }}>📍 {lead.ciudad || 'No especificada'}</p>
                                <p className="date" style={{ margin: '0 0 0.6rem 0', fontSize: '0.75rem', color: '#64748b' }}>📅 {new Date(lead.created_at).toLocaleDateString('es-CO', { dateStyle: 'short' })}</p>
                                {lead.telefono && (
                                  <button 
                                    className="btn-whatsapp-retarget"
                                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.78rem', borderRadius: '8px', border: '1px solid #25D366', background: '#f0fdf4', color: '#166534', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', transition: 'all 0.2s' }}
                                    onClick={() => {
                                      const text = `¡Hola ${lead.nombre || ''}! 👋 Vimos que estabas mirando nuestro catálogo de *${configuracion?.nombre_negocio || ''}* y empezaste a llenar tus datos de envío pero no completaste el pedido. ¿Tuviste algún problema o tienes alguna duda con los productos? ¡Escríbenos y con gusto te ayudamos! 😊`;
                                      window.open(`https://wa.me/57${lead.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                                    }}
                                  >
                                    💬 WhatsApp Retargeting
                                  </button>
                                )}
                              </div>
                            ))}
                            {leadsFiltrados.length === 0 && (
                              <p className="empty-column-msg" style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic', margin: '2rem 0' }}>No hay carritos abandonados.</p>
                            )}
                          </div>
                        </div>

                        {/* Columna 2: Interesados (Pendiente Pago) */}
                        <div className="kanban-column" style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '500px' }}>
                          <div className="kanban-column-header col-yellow" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eab308', paddingBottom: '0.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#eab308' }}>🟡 Interesados (Pendiente Pago)</h3>
                            <span className="badge" style={{ background: '#fef9c3', color: '#eab308', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>{interesadosFiltrados.length}</span>
                          </div>
                          <div className="kanban-cards-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
                            {interesadosFiltrados.map((ped) => (
                              <div key={ped.id} className="kanban-card order-card" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 0.4rem 0', flexWrap: 'wrap', gap: '0.25rem' }}>
                                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>👤 {ped.cliente_nombre}</h4>
                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    {ped.linea_whatsapp && (
                                      <span style={{ fontSize: '0.65rem', background: '#f8fafc', color: '#475569', padding: '1px 5px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                        🎯 {getAsesorNameByPhone(ped.linea_whatsapp)}
                                      </span>
                                    )}
                                    {ped.origen === 'pos' ? (
                                      <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#166534', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>POS</span>
                                    ) : (
                                      <span style={{ fontSize: '0.65rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>Catálogo</span>
                                    )}
                                  </div>
                                </div>
                                <p className="phone" style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: '#475569' }}>📞 {ped.cliente_telefono}</p>
                                <p className="total" style={{ margin: '0 0 0.4rem 0', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>💰 Total: <span style={{ color: '#10b981' }}>${ped.total.toLocaleString()}</span></p>
                                
                                {/* Lista de productos comprados */}
                                {Array.isArray(ped.productos) && ped.productos.length > 0 && (
                                  <div className="card-products-summary" style={{ margin: '0.6rem 0', padding: '0.5rem 0.65rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <p style={{ margin: '0 0 0.3rem 0', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📦 Artículos:</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                      {ped.productos.map((prod: any, idx: number) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#334155' }}>
                                          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }} title={prod.nombre}>
                                            {prod.nombre} {prod.talla ? `(${prod.talla})` : ''} {prod.estampado ? `[${prod.estampado}]` : ''}
                                          </span>
                                          <span style={{ color: '#64748b', fontWeight: 700 }}>
                                            x{prod.cantidad}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="status" style={{ margin: '0.5rem 0' }}>
                                  {ped.pantallazo_url ? (
                                    <span className="status-badge upload-success" style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-block' }}>✅ Comprobante Subido</span>
                                  ) : (
                                    <span className="status-badge upload-wait" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-block' }}>⏳ Esperando Pago</span>
                                  )}
                                </div>
                                <p className="date" style={{ margin: '0 0 0.6rem 0', fontSize: '0.75rem', color: '#64748b' }}>📅 {new Date(ped.created_at).toLocaleDateString('es-CO', { dateStyle: 'short' })}</p>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                                  <button 
                                    className="btn-view-detail"
                                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.78rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                                    onClick={() => setSelectedPedido(ped)}
                                  >
                                    🔍 Ver Detalle
                                  </button>
                                  {ped.pantallazo_url ? (
                                    <button 
                                      className="btn-primary" 
                                      style={{ padding: '0.45rem', fontSize: '0.78rem', borderRadius: '8px', background: configuracion?.color_primario || '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                                      onClick={() => setSelectedPedido(ped)}
                                    >
                                      💳 Verificar pago
                                    </button>
                                  ) : ped.atendido ? (
                                    <button 
                                      disabled
                                      className="btn-secondary" 
                                      style={{ padding: '0.45rem', fontSize: '0.78rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#64748b', cursor: 'not-allowed', fontWeight: 600 }}
                                    >
                                      ⏳ Esperando comprobante
                                    </button>
                                  ) : (
                                    <button 
                                      className="btn-primary" 
                                      style={{ padding: '0.45rem', fontSize: '0.78rem', borderRadius: '8px', background: '#25D366', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                                      onClick={() => handleAtenderPedido(ped)}
                                    >
                                      📞 Atender
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                            {interesadosFiltrados.length === 0 && (
                              <p className="empty-column-msg" style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic', margin: '2rem 0' }}>No hay pedidos pendientes.</p>
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
                            {clientesFiltrados.map((ped) => (
                              <div key={ped.id} className="kanban-card client-card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.85rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 0.4rem 0', flexWrap: 'wrap', gap: '0.25rem' }}>
                                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#14532d', fontWeight: 700 }}>👤 {ped.cliente_nombre}</h4>
                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    {ped.linea_whatsapp && (
                                      <span style={{ fontSize: '0.65rem', background: '#f8fafc', color: '#475569', padding: '1px 5px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                        🎯 {asesores.find(a => a.telefono?.replace(/\D/g, '') === ped.linea_whatsapp?.replace(/\D/g, ''))?.nombre || ped.linea_whatsapp}
                                      </span>
                                    )}
                                    {ped.origen === 'pos' ? (
                                      <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#166534', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>POS</span>
                                    ) : (
                                      <span style={{ fontSize: '0.65rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>Catálogo</span>
                                    )}
                                  </div>
                                </div>
                                <p className="phone" style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: '#166534' }}>📞 {ped.cliente_telefono}</p>
                                <p className="total" style={{ margin: '0 0 0.4rem 0', fontSize: '0.82rem', fontWeight: 700, color: '#14532d' }}>💰 Facturado: <span style={{ color: '#16a34a' }}>${ped.total.toLocaleString()}</span></p>

                                {/* Lista de productos comprados */}
                                {Array.isArray(ped.productos) && ped.productos.length > 0 && (
                                  <div className="card-products-summary" style={{ margin: '0.6rem 0', padding: '0.5rem 0.65rem', background: 'white', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                                    <p style={{ margin: '0 0 0.3rem 0', fontSize: '0.72rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📦 Artículos:</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                      {ped.productos.map((prod: any, idx: number) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#166534' }}>
                                          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }} title={prod.nombre}>
                                            {prod.nombre} {prod.talla ? `(${prod.talla})` : ''} {prod.estampado ? `[${prod.estampado}]` : ''}
                                          </span>
                                          <span style={{ color: '#166534', fontWeight: 700 }}>
                                            x{prod.cantidad}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="status" style={{ margin: '0.5rem 0' }}>
                                  <span className="status-badge verified" style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-block' }}>✓ Pago Verificado</span>
                                </div>
                                <p className="date" style={{ margin: '0 0 0.6rem 0', fontSize: '0.75rem', color: '#166534' }}>📅 {new Date(ped.created_at).toLocaleDateString('es-CO', { dateStyle: 'short' })}</p>
                                <button 
                                  className="btn-view-detail"
                                  style={{ width: '100%', padding: '0.45rem', fontSize: '0.78rem', borderRadius: '8px', border: '1px solid #bbf7d0', background: 'white', color: '#14532d', cursor: 'pointer', fontWeight: 600 }}
                                  onClick={() => setSelectedPedido(ped)}
                                >
                                  🔍 Ver Factura
                                </button>
                              </div>
                            ))}
                            {clientesFiltrados.length === 0 && (
                              <p className="empty-column-msg" style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic', margin: '2rem 0' }}>No hay ventas exitosas aún.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
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
                            {filteredPedidos.map((ped) => (
                            <tr key={ped.id} style={{ borderBottom: '1px solid #f1f5f9', background: ped.estado === 'completado' ? '#f0fdf4' : 'transparent' }}>
                              <td style={{ padding: '1rem', color: ped.estado === 'completado' ? '#166534' : '#64748b', verticalAlign: 'middle' }}>
                                {new Date(ped.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td style={{ padding: '1rem', fontWeight: 600, color: ped.estado === 'completado' ? '#14532d' : '#0f172a', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                  <span>{ped.cliente_nombre}</span>
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
                                {ped.estado === 'completado' ? (
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
                  </>
                )}
              </div>
            </div>
          )}

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
                      const num = (selectedPedido.cliente_telefono || '').replace(/\D/g, '');
                      const name = selectedPedido.cliente_nombre;
                      const business = configuracion?.nombre_negocio || 'Indisutex';
                      const msg = `¡Felicidades ${name}! 🎉 Has hecho una compra exitosa con *${business}*.\n\nTu número de guía de envío es: *${numeroGuia || 'Pendiente'}*\n\n¡Muchas gracias por confiar en nosotros! 😊`;
                      window.open(`https://wa.me/57${num}?text=${encodeURIComponent(msg)}`, '_blank');
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
                    <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>{selectedPedido.cliente_nombre}</p>
                    <p style={{ margin: '0.2rem 0 0 0', color: '#475569' }}>{selectedPedido.cliente_telefono}</p>
                  </div>
                  <div>
                    <h5 style={{ margin: '0 0 0.2rem 0', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Línea WhatsApp Asignada</h5>
                    <p style={{ margin: 0, fontWeight: 700, color: '#0ea5e9' }}>📞 {getAsesorNameByPhone(selectedPedido.linea_whatsapp)}</p>
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
                            const num = (selectedPedido.cliente_telefono || '').replace(/\D/g, '');
                            const name = selectedPedido.cliente_nombre;
                            const business = configuracion?.nombre_negocio || 'Indisutex';
                            const msg = `¡Felicidades ${name}! 🎉 Has hecho una compra exitosa con *${business}*.\n\nTu número de guía de envío es: *${numeroGuia}*\n\n¡Muchas gracias por confiar en nosotros! 😊`;
                            window.open(`https://wa.me/57${num}?text=${encodeURIComponent(msg)}`, '_blank');
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
                        const num = (selectedPedido.cliente_telefono || '').replace(/\D/g, '');
                        const uploadLink = `${window.location.origin}/pago/${selectedPedido.id}`;
                        const msg = `¡Hola ${selectedPedido.cliente_nombre}! 👋\nGracias por tu pedido en *${configuracion?.nombre_negocio || 'nuestra tienda'}*.\n\n*Total a pagar: $${selectedPedido.total.toLocaleString()} COP*\n\n💳 *Datos del banco:*\nNúmero: ${configuracion?.whatsapp || ''}\nTitular: ${configuracion?.nombre_negocio || ''}\n\nPara poder completar tu pedido, haz la captura de pantalla de tu pago o de transacción y envíala por este enlace:\n${uploadLink}\n\n¡Tu pedido será despachado en cuanto verifiquemos el pago! 🚀`;
                        window.open(`https://wa.me/57${num}?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                    >
                      💳 Cobrar por Nequi/WhatsApp
                    </button>
                    <button
                      style={{ flex: 1, padding: '0.65rem 1rem', background: configuracion?.color_primario || '#0ea5e9', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                      onClick={() => {
                        const num = (selectedPedido.cliente_telefono || '').replace(/\D/g, '');
                        const msg = `¡Hola ${selectedPedido.cliente_nombre}! 👋 Tu pedido ha sido *VERIFICADO y DESPACHADO* 🚚\n\nPedido: ${selectedPedido.productos?.map((p: any) => `${p.cantidad}x ${p.nombre}`).join(', ')}\nTotal: $${selectedPedido.total.toLocaleString()} COP\n\n📦 Tu paquete está en camino. ¡Gracias por tu compra!`;
                        window.open(`https://wa.me/57${num}?text=${encodeURIComponent(msg)}`, '_blank');
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

      {/* TOAST */}
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          <span>{toast.type === 'error' ? '❌' : '✅'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

// ── SIDEBAR COMPONENT ──
function SidebarContent({
  activeTab, setActiveTab, productos, configuracion, handleLogout, onClose, role, currentAsesor
}: {
  activeTab: TabType;
  setActiveTab: (t: TabType) => void;
  productos: Producto[];
  configuracion: Configuracion | null;
  handleLogout: () => void;
  onClose?: () => void;
  role: 'admin' | 'asesor';
  currentAsesor?: any;
}) {
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
          <h2 style={{ textTransform: 'capitalize', fontSize: '1.1rem', color: '#0f172a' }}>
            {configuracion?.nombre_negocio || 'Catálogo'}
          </h2>
          <p style={{ margin: 0 }}>Panel Administrativo</p>
          {role === 'asesor' && currentAsesor ? (
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
        {role !== 'asesor' && (
          <>
            <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => handleSelectTab('dashboard')}>
              <span className="nav-icon"><LayoutDashboard size={14} /></span> Dashboard
              {activeTab === 'dashboard' && <span className="active-dot"></span>}
            </button>
             <button className={`nav-item ${activeTab === 'productos' ? 'active' : ''}`} onClick={() => handleSelectTab('productos')}>
              <span className="nav-icon"><Package size={14} /></span> Productos
              {activeTab === 'productos' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'categorias' ? 'active' : ''}`} onClick={() => handleSelectTab('categorias')}>
              <span className="nav-icon"><Tag size={14} /></span> Categorías
              {activeTab === 'categorias' && <span className="active-dot"></span>}
            </button>
          </>
        )}
        <button className={`nav-item ${activeTab === 'pedidos' ? 'active' : ''}`} onClick={() => handleSelectTab('pedidos')}>
          <span className="nav-icon"><ShoppingBag size={14} /></span> Pedidos
          {activeTab === 'pedidos' && <span className="active-dot"></span>}
        </button>
        {role === 'asesor' && (
          <button className={`nav-item ${activeTab === 'perfil_asesor' ? 'active' : ''}`} onClick={() => handleSelectTab('perfil_asesor')}>
            <span className="nav-icon"><Settings size={14} /></span> Mi Perfil
            {activeTab === 'perfil_asesor' && <span className="active-dot"></span>}
          </button>
        )}
        {role !== 'asesor' && (
          <>
            <button className={`nav-item ${activeTab === 'clientes' ? 'active' : ''}`} onClick={() => handleSelectTab('clientes')}>
              <span className="nav-icon"><User size={14} /></span> Clientes
              {activeTab === 'clientes' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'asesores' ? 'active' : ''}`} onClick={() => handleSelectTab('asesores')}>
              <span className="nav-icon"><Users size={14} /></span> Asesores
              {activeTab === 'asesores' && <span className="active-dot"></span>}
            </button>
            {getTenantId() !== 'indisutex' && (
              <button className={`nav-item ${activeTab === 'pos' ? 'active' : ''}`} onClick={() => handleSelectTab('pos')}>
                <span className="nav-icon"><Calculator size={14} /></span> POS Ventas
                {activeTab === 'pos' && <span className="active-dot"></span>}
              </button>
            )}
            <button className={`nav-item ${activeTab === 'siigo' ? 'active' : ''}`} onClick={() => handleSelectTab('siigo')}>
              <span className="nav-icon"><Code size={14} /></span> Desarrollador
              {activeTab === 'siigo' && <span className="active-dot"></span>}
            </button>
            <button className={`nav-item ${activeTab === 'config' ? 'active' : ''}`} onClick={() => handleSelectTab('config')}>
              <span className="nav-icon"><Settings size={14} /></span> Configuración
              {activeTab === 'config' && <span className="active-dot"></span>}
            </button>
          </>
        )}
      </nav>

      <div className="sidebar-storage-stats">
        <div className="storage-text">
          <strong>{productos.length} Productos</strong>
          <span>límite sugerido 500</span>
        </div>
        <div className="storage-bar">
          <div className="storage-progress" style={{ width: `${Math.min((productos.length / 500) * 100, 100)}%` }}></div>
        </div>
      </div>

      <div className="sidebar-network-status" style={{ padding: '0 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Estado de Red</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: isOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: isOnline ? '#059669' : '#dc2626', padding: '0.6rem 0.8rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? '#10b981' : '#ef4444', boxShadow: isOnline ? '0 0 8px #10b981' : '0 0 8px #ef4444', animation: 'pulse 2s infinite' }}></span>
          {isOnline ? 'Bueno' : 'Malo'}
        </div>
      </div>

      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1.2rem', borderTop: '1px solid #f1f5f9' }}>
        <a 
          href={`/${getTenantId()}${role === 'asesor' && currentAsesor?.telefono ? `?ws=${currentAsesor.telefono.replace(/\D/g, '')}` : '?ws=clear'}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn-primary" 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.8rem', borderRadius: '8px', textDecoration: 'none', background: 'var(--primary-color, #6366f1)' }}
        >
          <Eye size={16} /> Ver Catálogo
        </a>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="avatar" style={{ background: (role === 'asesor' && currentAsesor?.foto_url) ? 'transparent' : (role === 'admin' && configuracion?.admin_foto_url) ? 'transparent' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', border: '1px solid #e2e8f0', color: '#64748b', padding: 0, overflow: 'hidden' }}>
              {role === 'asesor' && currentAsesor?.foto_url ? (
                <img src={currentAsesor.foto_url} alt="Asesor" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (role === 'admin' && configuracion?.admin_foto_url) ? (
                <img src={configuracion.admin_foto_url} alt="Admin" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={24} />
              )}
            </div>
            <div className="user-info">
              <h4 style={{ fontSize: '0.9rem', margin: 0, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                {role === 'asesor' && currentAsesor ? currentAsesor.nombre : (configuracion?.admin_nombre || 'Administrador')}
              </h4>
              <p style={{ fontSize: '0.75rem', color: '#10b981', margin: 0 }}>{role === 'asesor' ? 'Asesor' : 'Sesión activa'}</p>
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
