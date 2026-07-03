import { useState, useEffect, useMemo } from 'react';
import { supabase, getTenantId, setTenantId } from '../lib/supabase';
import { compressImage } from '../lib/imageCompression';
import { SiigoService } from '../lib/siigoService';
import type { Producto, Categoria, Subcategoria, Configuracion, Pedido } from '../types';
import './Admin.css';
import { X, Video, Upload, Package, Tag, Settings, LayoutDashboard, Plus, Trash2, Pencil, Check, Eye, Phone, LogOut, User, ShoppingBag, Copy, RefreshCw, Database, Search } from 'lucide-react';
import * as XLSX from 'xlsx';

const SECRET_PIN = '0000';

type ProductFormData = {
  nombre: string;
  descripcion: string;
  precio: string;
  categoria: string;
  subcategoria: string;
  imagenes: string[];
  video_url: string;
  tallas: string;
};

const emptyProduct: ProductFormData = {
  nombre: '',
  descripcion: '',
  precio: '',
  categoria: '',
  subcategoria: '',
  imagenes: [''],
  video_url: '',
  tallas: ''
};

type TabType = 'dashboard' | 'productos' | 'categorias' | 'config' | 'pedidos' | 'siigo';

type Toast = { message: string; type: 'success' | 'error' } | null;

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem(`admin_auth_${getTenantId()}`) === 'true';
  });
  const [pin, setPin] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('productos');
  const [toast, setToast] = useState<Toast>(null);
  
  const [selectedCompany, setSelectedCompany] = useState<string | null>(getTenantId() || null);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [categoriasData, setCategoriasData] = useState<Categoria[]>([]);
  const [subcategoriasData, setSubcategoriasData] = useState<Subcategoria[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
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
  const [uploadMethod, setUploadMethod] = useState<'manual' | 'excel'>('manual');
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
    setIsAuthenticated(false);
    setSelectedCompany(null);
    setPin('');
  }

  const [pagoModalUrl, setPagoModalUrl] = useState<string | null>(null);

  // Filtros y Ordenamiento para la pestaña de Pedidos
  const [orderFilterStatus, setOrderFilterStatus] = useState<string>('todos');
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [orderSortBy, setOrderSortBy] = useState<string>('date_desc');

  useEffect(() => {
    if (configuracion?.nombre_negocio) {
      document.title = `${configuracion.nombre_negocio} - Panel Administrativo`;
    } else {
      document.title = 'Panel Administrativo';
    }

    if (configuracion?.color_primario) {
      document.documentElement.style.setProperty('--primary-color', configuracion.color_primario);
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
    }
  }, [configuracion]);

  useEffect(() => {
    if (isAuthenticated) cargarDatos();
  }, [isAuthenticated]);

  async function cargarDatos() {
    try {
      const tenant = getTenantId();

      // Fetch other data in parallel
      const [catRes, subcatRes, confRes, pedRes] = await Promise.all([
        supabase.from('categorias').select('*').eq('tenant_id', tenant).order('orden', { ascending: true }),
        supabase.from('subcategorias').select('*').eq('tenant_id', tenant).order('orden', { ascending: true }),
        supabase.from('configuracion').select('*').eq('tenant_id', tenant).limit(1).single(),
        supabase.from('pedidos').select('*').eq('tenant_id', tenant).order('created_at', { ascending: false })
      ]);

      if (catRes.data) setCategoriasData(catRes.data);
      if (subcatRes.data) setSubcategoriasData(subcatRes.data);
      if (pedRes.data) setPedidos(pedRes.data);

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
    } catch (err) {
      console.error('Error cargando datos:', err);
    }
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === SECRET_PIN) {
      localStorage.setItem(`admin_auth_${getTenantId()}`, 'true');
      setIsAuthenticated(true);
    } else {
      showToast('PIN incorrecto. Intenta de nuevo.', 'error');
      setPin('');
    }
  };

  const updateBulkForm = (index: number, field: keyof ProductFormData, value: string) => {
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
      categoria: f.categoria,
      subcategoria: f.subcategoria || null,
      imagen_url: f.imagenes.find(u => u.trim()) || '',
      video_url: f.video_url || null,
      tallas: f.tallas || null,
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
          return {
            nombre: findVal(['nombre', 'titulo', 'title', 'name']),
            descripcion: findVal(['descripcion', 'detalles', 'description']),
            precio: parseFloat(findVal(['precio', 'valor', 'price'])) || 0,
            categoria: findVal(['categoria', 'category', 'cat']),
            subcategoria: findVal(['subcategoria', 'subcategory', 'subcat']),
            imagen_url: findVal(['imagen', 'imagen_url', 'image', 'image_url']),
            video_url: findVal(['video', 'video_url', 'url_video']),
            tallas: findVal(['tallas', 'talla', 'sizes', 'size'])
          };
        });
        
        const valid = mapped.filter(p => p.nombre);
        setExcelProducts(valid);
        showToast(`Se cargaron ${valid.length} productos del Excel ✓`);
      } catch (err) {
        showToast('Error leyendo el archivo Excel', 'error');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
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
      categoria: editingProduct.categoria,
      subcategoria: editingProduct.subcategoria || null,
      imagen_url: editingProduct.imagen_url,
      imagenes_extra: editExtraImages.filter(u => u.trim()),
      video_url: editingProduct.video_url,
      tallas: editingProduct.tallas
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
    } catch (err) {
      console.error(err);
      showToast('Error al eliminar duplicados', 'error');
    } finally {
      setCleaningDuplicates(false);
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
    } catch (err) {
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
          <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} productos={productos} configuracion={configuracion} handleLogout={handleLogout} />
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
                      <label>Precio (COP)</label>
                      <input required type="number" step="0.01" value={editingProduct.precio} onChange={e => setEditingProduct({ ...editingProduct, precio: parseFloat(e.target.value) })} />
                    </div>
                    <div className="form-field">
                      <label>Categoría</label>
                      <select value={editingProduct.categoria} onChange={e => setEditingProduct({ ...editingProduct, categoria: e.target.value })}>
                        {categoriasData.map(c => <option key={c.id} value={c.slug}>{c.nombre}</option>)}
                      </select>
                    </div>
                    <div className="form-field full">
                      <label>Tallas (separadas por coma)</label>
                      <input value={editingProduct.tallas || ''} onChange={e => setEditingProduct({ ...editingProduct, tallas: e.target.value })} placeholder="Ej: S, M, L, XL" />
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

                    <div className="form-field full">
                      <label>URL de Video (Opcional)</label>
                      <input value={editingProduct.video_url || ''} onChange={e => setEditingProduct({ ...editingProduct, video_url: e.target.value })} placeholder="https://..." />
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
          <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} productos={productos} configuracion={configuracion} handleLogout={handleLogout} />
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
          <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} productos={productos} configuracion={configuracion} handleLogout={handleLogout} />
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
      <aside className="admin-sidebar">
        <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} productos={productos} configuracion={configuracion} handleLogout={handleLogout} />
      </aside>

      {/* MAIN */}
      <div className="admin-main">
        {/* TOP BAR */}
        <div className="admin-topbar">
          <div className="topbar-title">
            <h2>
              {activeTab === 'dashboard' && '📊 Dashboard'}
              {activeTab === 'productos' && '📦 Productos'}
              {activeTab === 'categorias' && '🗂️ Categorías'}
              {activeTab === 'config' && '⚙️ Configuración'}
            </h2>
            <p>
              {activeTab === 'productos' && `${productos.length} productos en total`}
              {activeTab === 'categorias' && `${categoriasData.length} categorías activas`}
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
                                <label>Precio (COP)</label>
                                <input required type="number" step="0.01" value={form.precio} onChange={e => updateBulkForm(index, 'precio', e.target.value)} placeholder="25000" />
                              </div>
                              <div className="form-field">
                                <label>Categoría</label>
                                <select value={form.categoria} onChange={e => updateBulkForm(index, 'categoria', e.target.value)}>
                                  <option value="">Seleccionar...</option>
                                  {categoriasData.map(c => <option key={c.id} value={c.slug}>{c.icono} {c.nombre}</option>)}
                                </select>
                              </div>
                              <div className="form-field full">
                                <label>Tallas (separadas por coma, opcional)</label>
                                <input value={form.tallas} onChange={e => updateBulkForm(index, 'tallas', e.target.value)} placeholder="Ej: 6 Meses, 12 Meses, 18 Meses" />
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
                              <div className="form-field full">
                                <label>URL de Video (Opcional)</label>
                                <input value={form.video_url} onChange={e => updateBulkForm(index, 'video_url', e.target.value)} placeholder="https://..." />
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
                          Las columnas se detectan automáticamente de forma inteligente. Asegúrate de incluir encabezados claros como: <strong>Nombre, Descripción, Precio, Categoría, Subcategoría, Imagen, Video, Tallas</strong>.
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
                                  <th style={{ padding: '0.8rem 1rem' }}>Nombre</th>
                                  <th style={{ padding: '0.8rem 1rem' }}>Precio</th>
                                  <th style={{ padding: '0.8rem 1rem' }}>Categoría</th>
                                  <th style={{ padding: '0.8rem 1rem' }}>Subcategoría</th>
                                  <th style={{ padding: '0.8rem 1rem' }}>Tallas</th>
                                </tr>
                              </thead>
                              <tbody>
                                {excelProducts.map((p, i) => (
                                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '0.8rem 1rem', fontWeight: 600, color: '#0f172a' }}>{p.nombre}</td>
                                    <td style={{ padding: '0.8rem 1rem', color: '#10b981', fontWeight: 700 }}>${p.precio.toLocaleString()}</td>
                                    <td style={{ padding: '0.8rem 1rem', color: '#64748b' }}>{p.categoria}</td>
                                    <td style={{ padding: '0.8rem 1rem', color: '#64748b' }}>{p.subcategoria || '-'}</td>
                                    <td style={{ padding: '0.8rem 1rem', color: '#64748b' }}>{p.tallas || '-'}</td>
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
                            {p.video_url && (
                              <div style={{ position: 'absolute', top: 8, right: 8 }}>
                                <span className="badge badge-purple"><Video size={10} /> Video</span>
                              </div>
                            )}
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
                    const { error } = await supabase.from('configuracion').update({
                      nombre_negocio: configuracion.nombre_negocio,
                      whatsapp: configuracion.whatsapp,
                      logo_url: configuracion.logo_url,
                      descripcion_hero: configuracion.descripcion_hero,
                      link_dropshipper: configuracion.link_dropshipper,
                      link_ganar_dinero: configuracion.link_ganar_dinero,
                      video_hero_url: configuracion.video_hero_url,
                      color_primario: configuracion.color_primario || '#6366f1'
                    }).eq('id', configuracion.id);
                    setLoading(false);
                    if (error) showToast('Error: ' + error.message, 'error');
                    else showToast('Configuración guardada ✓');
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
                          <label>Texto Principal de la Tienda (Hero)</label>
                          <input value={configuracion.descripcion_hero || ''} onChange={e => setConfiguracion({ ...configuracion, descripcion_hero: e.target.value })} placeholder="TIENDA & BABY" />
                        </div>
                      </div>
                    </div>

                    <div className="config-section" style={{ marginTop: '1.5rem' }}>
                      <div className="config-section-title">🔗 Enlaces Especiales</div>
                      <div className="form-grid">
                        <div className="form-field full">
                          <label>Enlace para Dropshippers (Opcional, vacío usa WhatsApp)</label>
                          <input type="url" value={configuracion.link_dropshipper || ''} onChange={e => setConfiguracion({ ...configuracion, link_dropshipper: e.target.value })} placeholder="https://..." />
                        </div>
                        <div className="form-field full">
                          <label>Enlace "Quieres Ganar Dinero?" (Opcional, vacío usa WhatsApp)</label>
                          <input type="url" value={configuracion.link_ganar_dinero || ''} onChange={e => setConfiguracion({ ...configuracion, link_ganar_dinero: e.target.value })} placeholder="https://..." />
                        </div>
                      </div>
                    </div>

                    <div className="config-section" style={{ marginTop: '1.5rem' }}>
                      <div className="config-section-title">🖼️ Logo de la Tienda</div>
                      <div className="form-field">
                        <label>URL del Logo</label>
                        <div className="img-input-row">
                          {configuracion.logo_url && <img src={configuracion.logo_url} className="img-preview-thumb" alt="Logo" />}
                          <input type="url" value={configuracion.logo_url || ''} onChange={e => setConfiguracion({ ...configuracion, logo_url: e.target.value })} placeholder="https://..." style={{ flex: 1 }} />
                          <label className="btn-upload-img" style={{ flexShrink: 0, cursor: 'pointer' }}>
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
                    </div>

                    <div className="config-section" style={{ marginTop: '1.5rem' }}>
                      <div className="config-section-title">📹 Video de Portada (Hero Section)</div>
                      <div className="form-field">
                        <label>Subir Video de Fondo (.mp4 / .webm)</label>
                        <div className="img-input-row">
                          {configuracion.video_hero_url && (
                            <video src={configuracion.video_hero_url} muted style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', background: '#0f172a' }} />
                          )}
                          <input type="url" value={configuracion.video_hero_url || ''} onChange={e => setConfiguracion({ ...configuracion, video_hero_url: e.target.value })} placeholder="https://..." style={{ flex: 1 }} />
                          <label className="btn-upload-img" style={{ flexShrink: 0, cursor: 'pointer' }}>
                            <Upload size={12} /> Subir Video
                            <input type="file" accept="video/*" style={{ display: 'none' }} onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setLoading(true);
                              try {
                                const fileName = `hero_video_${Date.now()}.${file.name.split('.').pop()}`;
                                await supabase.storage.from('archivos').upload(fileName, file);
                                const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
                                setConfiguracion({ ...configuracion, video_hero_url: data.publicUrl });
                                showToast('Video de portada subido ✓');
                              } catch { showToast('Error subiendo video', 'error'); }
                              setLoading(false);
                            }} />
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

          {/* ── SIIGO TAB ── */}
          {activeTab === 'siigo' && (
            <div className="admin-panel">
              <div className="panel-header">
                <div>
                  <h3><Database size={16} /> Integración Siigo Nube</h3>
                  <p>Sincroniza tus productos, precios e inventario automáticamente</p>
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
                        siigo_access_key: configuracion.siigo_access_key
                      }).eq('id', configuracion.id);
                      setLoading(false);
                      if (error) showToast('Error al guardar credenciales: ' + error.message, 'error');
                      else showToast('Credenciales de Siigo guardadas ✓');
                    }}>
                      <div className="config-section">
                        <div className="config-section-title">🔑 Credenciales de la API</div>
                        <div className="form-grid">
                          <div className="form-field full">
                            <label>Usuario (Correo de Siigo Nube)</label>
                            <input 
                              type="email" 
                              required 
                              value={configuracion.siigo_username || ''} 
                              onChange={e => setConfiguracion({ ...configuracion, siigo_username: e.target.value })} 
                              placeholder="ejemplo@correo.com"
                            />
                          </div>
                          <div className="form-field full">
                            <label>Access Key (Llave de API generada en Siigo)</label>
                            <input 
                              type="password" 
                              required 
                              value={configuracion.siigo_access_key || ''} 
                              onChange={e => setConfiguracion({ ...configuracion, siigo_access_key: e.target.value })} 
                              placeholder="Ingresa tu access key de Siigo"
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button type="submit" className="btn-secondary" disabled={loading} style={{ padding: '0.6rem 1.5rem' }}>
                          Guardar Credenciales
                        </button>

                        <button 
                          type="button" 
                          className="btn-primary" 
                          style={{ padding: '0.6rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
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
                          <RefreshCw size={14} style={{ animation: siigoLoading ? 'spin 1s linear infinite' : 'none' }} /> {siigoLoading ? 'Conectando...' : 'Sincronizar Catálogo'}
                        </button>
                      </div>
                    </form>

                    {/* Modal/Caja de Confirmación de Sincronización */}
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
                          {/* Nuevos */}
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

                          {/* Actualizaciones */}
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

                    <div className="config-section" style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                      <div className="config-section-title">📊 Estado de Sincronización</div>
                      <div style={{ fontSize: '0.9rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div>
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
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="loading-dot" />
                    <p style={{ marginTop: '1rem' }}>Cargando datos de integración...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── DASHBOARD TAB ── */}
          {activeTab === 'dashboard' && (
            <>
              <div className="metrics-row">
                <div className="metric-card">
                  <div className="mc-icon">📦</div>
                  <div className="mc-label">Total Productos</div>
                  <div className="mc-value">{productos.length}</div>
                  <div className="mc-sub">en tu catálogo</div>
                </div>
                <div className="metric-card">
                  <div className="mc-icon">🗂️</div>
                  <div className="mc-label">Categorías</div>
                  <div className="mc-value">{categoriasData.length}</div>
                  <div className="mc-sub">activas en tienda</div>
                </div>
                <div className="metric-card">
                  <div className="mc-icon">🎬</div>
                  <div className="mc-label">Con Video</div>
                  <div className="mc-value">{productos.filter(p => p.video_url).length}</div>
                  <div className="mc-sub">productos con video</div>
                </div>
                <div className="metric-card">
                  <div className="mc-icon">👕</div>
                  <div className="mc-label">Con Tallas</div>
                  <div className="mc-value">{productos.filter(p => p.tallas).length}</div>
                  <div className="mc-sub">productos con tallas</div>
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

          {/* ── PEDIDOS TAB ── */}
          {activeTab === 'pedidos' && (
            <div className="admin-panel">
              <div className="panel-header">
                <div>
                  <h3><ShoppingBag size={16} /> Registro de Pedidos</h3>
                  <p>Pedidos recibidos desde el catálogo digital y su asignación de línea</p>
                </div>
              </div>
              <div className="panel-body">
                {pedidos.length === 0 ? (
                  <div className="empty-state">
                    <div className="es-icon">📋</div>
                    <p style={{ marginTop: '1rem' }}>No hay pedidos registrados todavía</p>
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
                        {pedidos.map((ped) => (
                          <tr key={ped.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '1rem', color: '#64748b', verticalAlign: 'middle' }}>
                              {new Date(ped.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td style={{ padding: '1rem', fontWeight: 600, color: '#0f172a', verticalAlign: 'middle' }}>{ped.cliente_nombre}</td>
                            <td style={{ padding: '1rem', color: '#475569', verticalAlign: 'middle' }}>{ped.cliente_telefono}</td>
                            <td style={{ padding: '1rem', color: '#475569', verticalAlign: 'middle' }}>{ped.direccion}, {ped.ciudad}</td>
                            <td style={{ padding: '1rem', color: '#475569', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
                                {Array.isArray(ped.productos) && ped.productos.map((prod: any, idx: number) => (
                                  <div key={idx} style={{ background: '#f8fafc', padding: '3px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
                                    <strong>{prod.cantidad}x</strong> {prod.nombre} {prod.talla ? `(${prod.talla})` : ''}
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                              <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                                📞 {ped.linea_whatsapp}
                              </span>
                            </td>
                            <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                              {ped.pantallazo_url ? (
                                <span style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, display: 'inline-block', lineHeight: '1.2' }}>
                                  ✅ Comprobante subido
                                </span>
                              ) : (
                                <span style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, display: 'inline-block', lineHeight: '1.2' }}>
                                  ⏳ Pendiente de comprobante
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '1rem', fontWeight: 700, color: '#10b981', verticalAlign: 'middle' }}>
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
                                
                                {ped.atendido ? (
                                  <button
                                    disabled
                                    style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontWeight: 700, width: '100%' }}
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
            </div>
          )}

        </div>
      </div>

      {/* MODAL DETALLE PEDIDO */}
      {selectedPedido && (
        <div className="modal-overlay" onClick={() => setSelectedPedido(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%', borderRadius: '16px', padding: '2rem' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>📦 Detalle del Pedido</h3>
              <button onClick={() => setSelectedPedido(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <h5 style={{ margin: '0 0 0.2rem 0', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Cliente</h5>
                <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>{selectedPedido.cliente_nombre}</p>
                <p style={{ margin: '0.2rem 0 0 0', color: '#475569' }}>{selectedPedido.cliente_telefono}</p>
              </div>
              <div>
                <h5 style={{ margin: '0 0 0.2rem 0', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Línea WhatsApp Asignada</h5>
                <p style={{ margin: 0, fontWeight: 700, color: '#0ea5e9' }}>📞 {selectedPedido.linea_whatsapp}</p>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <h5 style={{ margin: '0 0 0.2rem 0', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Dirección de Entrega</h5>
                <p style={{ margin: 0, color: '#0f172a' }}>{selectedPedido.direccion}, {selectedPedido.ciudad}</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem' }}>Productos Solicitados</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {Array.isArray(selectedPedido.productos) && selectedPedido.productos.map((prod: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                    <div>
                      <h5 style={{ margin: 0, color: '#0f172a' }}>{prod.nombre}</h5>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Cantidad: {prod.cantidad} {prod.talla ? ` | Talla: ${prod.talla}` : ''}
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
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  💳 Comprobante de Pago (Nequi)
                </h4>
                <div onClick={() => setPagoModalUrl(selectedPedido.pantallazo_url)} style={{ cursor: 'pointer' }}>
                  <img
                    src={selectedPedido.pantallazo_url}
                    alt="Comprobante Nequi"
                    style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  />
                </div>
                <p style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, marginTop: '0.5rem', textAlign: 'center' }}>
                  ✅ Comprobante recibido — Click para ver en pantalla completa
                </p>
              </div>
            )}
            {!selectedPedido.pantallazo_url && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', textAlign: 'center' }}>
                <p style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>
                  ⏳ Pendiente de comprobante
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', marginTop: '1.5rem', paddingTop: '1.5rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Total del Pedido:</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
                ${selectedPedido.total.toLocaleString()}
              </span>
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
              <button
                style={{ flex: 1, padding: '0.85rem 1rem', background: '#25D366', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
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
                style={{ flex: 1, padding: '0.85rem 1rem', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
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
        </div>
      )}

      {/* MODAL PAGO SREENSHOT */}
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
  activeTab, setActiveTab, productos, configuracion, handleLogout
}: {
  activeTab: TabType;
  setActiveTab: (t: TabType) => void;
  productos: Producto[];
  configuracion: Configuracion | null;
  handleLogout: () => void;
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
          <h2 style={{ textTransform: 'capitalize', fontSize: '1.1rem', color: '#0f172a' }}>{configuracion?.nombre_negocio || 'Catálogo'}</h2>
          <p style={{ margin: 0 }}>Panel Administrativo</p>
          {configuracion?.whatsapp && (
            <a 
              href={`https://wa.me/${configuracion.whatsapp.replace(/\D/g, '')}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="sidebar-wa-link"
              style={{ fontSize: '0.75rem', color: '#10b981', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.3rem', whiteSpace: 'nowrap' }}
            >
              <Phone size={12} style={{ strokeWidth: 2.5 }} /> Línea: {configuracion.whatsapp}
            </a>
          )}
        </div>
      </div>

      <nav className="sidebar-nav" style={{ paddingTop: '0.5rem' }}>
        <div className="sidebar-nav-label">Navegación</div>
        <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <span className="nav-icon"><LayoutDashboard size={14} /></span> Dashboard
          {activeTab === 'dashboard' && <span className="active-dot"></span>}
        </button>
         <button className={`nav-item ${activeTab === 'productos' ? 'active' : ''}`} onClick={() => setActiveTab('productos')}>
          <span className="nav-icon"><Package size={14} /></span> Productos
          {activeTab === 'productos' && <span className="active-dot"></span>}
        </button>
        <button className={`nav-item ${activeTab === 'categorias' ? 'active' : ''}`} onClick={() => setActiveTab('categorias')}>
          <span className="nav-icon"><Tag size={14} /></span> Categorías
          {activeTab === 'categorias' && <span className="active-dot"></span>}
        </button>
        <button className={`nav-item ${activeTab === 'pedidos' ? 'active' : ''}`} onClick={() => setActiveTab('pedidos')}>
          <span className="nav-icon"><ShoppingBag size={14} /></span> Pedidos
          {activeTab === 'pedidos' && <span className="active-dot"></span>}
        </button>
        <button className={`nav-item ${activeTab === 'siigo' ? 'active' : ''}`} onClick={() => setActiveTab('siigo')}>
          <span className="nav-icon"><Database size={14} /></span> Sincronizar Siigo
          {activeTab === 'siigo' && <span className="active-dot"></span>}
        </button>
        <button className={`nav-item ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
          <span className="nav-icon"><Settings size={14} /></span> Configuración
          {activeTab === 'config' && <span className="active-dot"></span>}
        </button>
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
          href={`/${getTenantId()}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn-primary" 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.8rem', borderRadius: '8px', textDecoration: 'none', background: '#0ea5e9' }}
        >
          <Eye size={16} /> Ver Catálogo
        </a>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="avatar" style={{ background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #e2e8f0', color: '#64748b' }}>
              <User size={18} />
            </div>
            <div className="user-info">
              <h4 style={{ fontSize: '0.9rem', margin: 0, color: '#334155' }}>Administrador</h4>
              <p style={{ fontSize: '0.75rem', color: '#10b981', margin: 0 }}>Sesión activa</p>
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
