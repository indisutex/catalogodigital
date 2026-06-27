import { useState, useEffect } from 'react';
import { supabase, getTenantId, setTenantId } from '../lib/supabase';
import type { Producto, Categoria, Subcategoria, Configuracion } from '../types';
import './Admin.css';
import { X, Video, Upload, Package, Tag, Settings, LayoutDashboard, Zap, Plus, Trash2, Pencil, Check, Eye, Phone, LogOut, User } from 'lucide-react';

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

type TabType = 'dashboard' | 'productos' | 'categorias' | 'config';

type Toast = { message: string; type: 'success' | 'error' } | null;

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('productos');
  const [toast, setToast] = useState<Toast>(null);
  
  const [selectedCompany, setSelectedCompany] = useState<string | null>(getTenantId() || null);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [categoriasData, setCategoriasData] = useState<Categoria[]>([]);
  const [subcategoriasData, setSubcategoriasData] = useState<Subcategoria[]>([]);
  const [subcatNombre, setSubcatNombre] = useState('');
  const [subcatSlug, setSubcatSlug] = useState('');
  const [subcatParentId, setSubcatParentId] = useState('');
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [bulkForms, setBulkForms] = useState<ProductFormData[]>([{ ...emptyProduct }]);

  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);

  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingSubcategory, setIsAddingSubcategory] = useState(false);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleLogout() {
    setIsAuthenticated(false);
    setSelectedCompany(null);
    setPin('');
  }

  useEffect(() => {
    if (configuracion?.nombre_negocio) {
      document.title = `${configuracion.nombre_negocio} - Panel Administrativo`;
    } else {
      document.title = 'Panel Administrativo';
    }
  }, [configuracion]);

  useEffect(() => {
    if (isAuthenticated) cargarDatos();
  }, [isAuthenticated]);

  async function cargarDatos() {
    try {
      const tenant = getTenantId();
      const [prodRes, catRes, subcatRes, confRes] = await Promise.all([
        supabase.from('productos').select('*').eq('tenant_id', tenant).order('created_at', { ascending: false }),
        supabase.from('categorias').select('*').eq('tenant_id', tenant).order('orden', { ascending: true }),
        supabase.from('subcategorias').select('*').eq('tenant_id', tenant).order('orden', { ascending: true }),
        supabase.from('configuracion').select('*').eq('tenant_id', tenant).limit(1).single()
      ]);
      if (prodRes.data) setProductos(prodRes.data);
      if (catRes.data) setCategoriasData(catRes.data);
      if (subcatRes.data) setSubcategoriasData(subcatRes.data);
      
      if (confRes.data) {
        setConfiguracion(confRes.data);
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
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${file.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage.from('archivos').upload(fileName, file);
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

  const handleAutoFill = async (index: number) => {
    const url = prompt('🔗 Pega el enlace de Temu o cualquier tienda:');
    if (!url) return;
    setLoading(true);

    const translateToSpanish = async (text: string): Promise<string> => {
      if (!text) return '';
      const clean = text.replace(/<[^>]*>/g, '').trim();
      if (!clean) return '';
      try {
        const transUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(clean)}`;
        const res = await fetch(transUrl);
        const json = await res.json();
        if (json && json[0]) {
          return json[0].map((item: any) => item[0]).join('').trim();
        }
        return clean;
      } catch (e) {
        console.error('Translation error:', e);
        return clean;
      }
    };

    const extractSizes = (htmlStr: string, docObj: Document): string => {
      const textToSearch = (htmlStr + ' ' + docObj.title + ' ' + 
        (docObj.querySelector('meta[name="description"]')?.getAttribute('content') || '') + ' ' + 
        (docObj.querySelector('meta[property="og:description"]')?.getAttribute('content') || '')
      ).toLowerCase();
      
      const foundSizes = new Set<string>();

      // Buscar rangos de meses como: 0-3m, 3-6m, 6-9m, etc.
      const babyRegex = /\b(0[-_]3|3[-_]6|6[-_]9|9[-_]12|12[-_]18|18[-_]24)\s*([mM])\b/g;
      let match;
      while ((match = babyRegex.exec(textToSearch)) !== null) {
        foundSizes.add(`${match[1]}M`);
      }

      // Buscar meses individuales como: 3m, 6m, 12m, 18m, 24m
      const singleMonthRegex = /\b(3|6|9|12|18|24)\s*(meses|mes|m)\b/g;
      while ((match = singleMonthRegex.exec(textToSearch)) !== null) {
        foundSizes.add(`${match[1]}M`);
      }

      // Buscar tallas T: 2t, 3t, 4t, 5t, 6t
      const tRegex = /\b([2-6])\s*t\b/g;
      while ((match = tRegex.exec(textToSearch)) !== null) {
        foundSizes.add(`${match[1].toUpperCase()}T`);
      }

      // JSON-LD scripts
      const jsonLdScripts = docObj.querySelectorAll('script[type="application/ld+json"]');
      jsonLdScripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent || '');
          const searchSizes = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            if ('size' in obj && typeof obj.size === 'string') {
              const sz = obj.size.trim();
              if (sz.length < 10) foundSizes.add(sz);
            }
            if ('offers' in obj && Array.isArray(obj.offers)) {
              obj.offers.forEach((o: any) => {
                if (o && typeof o === 'object') {
                  if (o.size && typeof o.size === 'string' && o.size.length < 10) {
                    foundSizes.add(o.size.trim());
                  }
                  if (o.name && typeof o.name === 'string' && o.name.length < 10) {
                    foundSizes.add(o.name.trim());
                  }
                }
              });
            }
            for (const key in obj) {
              searchSizes(obj[key]);
            }
          };
          searchSizes(data);
        } catch (e) {}
      });

      // Tallas estándar de adultos
      if (foundSizes.size === 0) {
        const stdSizes = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl'];
        stdSizes.forEach(size => {
          const regex = new RegExp(`\\b${size}\\b`, 'i');
          const shortText = (docObj.title + ' ' + (docObj.querySelector('meta[name="description"]')?.getAttribute('content') || '')).toLowerCase();
          if (regex.test(shortText)) {
            foundSizes.add(size.toUpperCase());
          }
        });
      }

      const sizeList = Array.from(foundSizes).filter(s => s && s.length < 15);
      
      // Ordenar tallas cronológicamente si son de bebé/niño
      const sortSizes = (a: string, b: string) => {
        const parseAge = (s: string) => {
          const m = s.match(/^(\d+)/);
          return m ? parseInt(m[1]) : 999;
        };
        return parseAge(a) - parseAge(b);
      };
      
      sizeList.sort(sortSizes);
      return sizeList.join(', ');
    };

    try {
      const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const rawTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')
        ?.replace(/[-|]\s*(Temu|temu)[\s\S]*/g, '')
        ?.replace(/\s+/g, ' ')
        .trim() || '';
      const rawDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content') || doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';

      const translatedTitle = await translateToSpanish(rawTitle);
      const translatedDesc = await translateToSpanish(rawDesc);

      let img = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      if (img && img.startsWith('//')) {
        img = 'https:' + img;
      }

      // Si og:image no dio resultado, buscar en el HTML crudo la primera imagen del CDN de Temu
      if (!img) {
        const temuImgMatch = html.match(/https:\/\/img\.kwcdn\.com\/product\/[^"'\s]+/);
        if (temuImgMatch) {
          // Limpiar parámetros de tamaño y obtener imagen grande
          img = temuImgMatch[0].split('?')[0];
        }
      }
      // Si sigue vacío, buscar cualquier imagen con 'product' en la URL de Temu
      if (!img) {
        const fallbackMatch = html.match(/https:\/\/[^"'\s]*temu[^"'\s]*\.(?:jpg|jpeg|png|webp)/);
        if (fallbackMatch) img = fallbackMatch[0];
      }

      let extractedPrice: number | null = null;
      const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
      jsonLdScripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent || '');
          const searchPrice = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            if ('price' in obj && (typeof obj.price === 'string' || typeof obj.price === 'number')) {
              const p = parseFloat(String(obj.price).replace(/[^\d.]/g, ''));
              if (!isNaN(p) && p > 0) {
                extractedPrice = p;
                return;
              }
            }
            if ('lowPrice' in obj && (typeof obj.lowPrice === 'string' || typeof obj.lowPrice === 'number')) {
              const p = parseFloat(String(obj.lowPrice).replace(/[^\d.]/g, ''));
              if (!isNaN(p) && p > 0) {
                extractedPrice = p;
                return;
              }
            }
            for (const key in obj) {
              searchPrice(obj[key]);
            }
          };
          searchPrice(data);
        } catch (e) {}
      });

      if (!extractedPrice) {
        const priceMeta = doc.querySelector('meta[property="product:price:amount"], meta[property="og:price:amount"], meta[name="twitter:data1"]');
        if (priceMeta) {
          const pStr = priceMeta.getAttribute('content') || priceMeta.getAttribute('value') || '';
          const p = parseFloat(pStr.replace(/[^\d.]/g, ''));
          if (!isNaN(p) && p > 0) {
            extractedPrice = p;
          }
        }
      }

      let finalPrice = '';
      if (extractedPrice) {
        let p = extractedPrice;
        if (p < 200) {
          p = p * 4000;
        }
        const priceWithTax = p * 1.10;
        finalPrice = String(Math.round(priceWithTax / 100) * 100);
      }

      const sizesStr = extractSizes(html, doc);

      const newForms = [...bulkForms];
      newForms[index] = {
        ...newForms[index],
        nombre: translatedTitle,
        descripcion: translatedDesc,
        precio: finalPrice,
        imagenes: img ? [img] : [''],
        tallas: sizesStr
      };
      setBulkForms(newForms);
      showToast('Datos extraídos automáticamente ✓');
    } catch (err) {
      console.error(err);
      showToast('No se pudo extraer. Completa manualmente.', 'error');
    }
    setLoading(false);
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

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este producto?')) return;
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (!error) { cargarDatos(); showToast('Producto eliminado'); }
    else showToast('Error al eliminar', 'error');
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
      video_url: editingProduct.video_url,
      tallas: editingProduct.tallas
    }).eq('id', editingProduct.id);
    setLoading(false);
    if (error) showToast('Error al actualizar', 'error');
    else { showToast('Producto actualizado ✓'); setEditingProduct(null); cargarDatos(); }
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
  if (editingProduct) {
    return (
      <div className="admin-app">
        <aside className="admin-sidebar">
          <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} productos={productos} categoriasData={categoriasData} configuracion={configuracion} handleLogout={handleLogout} />
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
                      <label>URL de Imagen</label>
                      <div className="img-input-row">
                        {editingProduct.imagen_url && <img src={editingProduct.imagen_url} className="img-preview-thumb" alt="" />}
                        <input value={editingProduct.imagen_url || ''} onChange={e => setEditingProduct({ ...editingProduct, imagen_url: e.target.value })} />
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

  // ── MAIN DASHBOARD ──
  return (
    <div className="admin-app">
      {/* SIDEBAR */}
      <aside className="admin-sidebar">
        <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} productos={productos} categoriasData={categoriasData} configuracion={configuracion} handleLogout={handleLogout} />
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
                /* QUICK ADD PANEL */
                <div className="admin-panel">
                  <div className="panel-header">
                  <div>
                    <h3><Zap size={16} /> Subida Rápida de Productos</h3>
                    <p>Usa AutoFill para llenar datos desde Temu u otras tiendas</p>
                  </div>
                  <button className="btn-secondary" onClick={() => setBulkForms([...bulkForms, { ...emptyProduct }])}>
                    <Plus size={14} /> Añadir fila
                  </button>
                </div>
                <div className="panel-body">
                  <form onSubmit={handleBulkSubmit}>
                    {bulkForms.map((form, index) => (
                      <div key={index} className="bulk-product-card">
                        <div className="bulk-product-card-header">
                          <h4># Producto {index + 1}</h4>
                          <div className="bulk-actions-bar">
                            <button type="button" className="btn-autofill" onClick={() => handleAutoFill(index)}>
                              <Zap size={12} /> AutoFill
                            </button>
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
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.7rem 2rem', fontSize: '0.9rem' }}>
                        {loading ? <><span className="loading-dot" /> Guardando...</> : <><Check size={14} /> Guardar Productos</>}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
              ) : (
                /* PRODUCT LIST PANEL */
                <div className="admin-panel">
                  <div className="panel-header">
                  <div>
                    <h3><Package size={16} /> Inventario ({filteredProducts.length})</h3>
                    <p>Todos los productos publicados en tu tienda</p>
                  </div>
                  <input
                    className="search-bar"
                    style={{ width: '220px' }}
                    placeholder="Buscar producto..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
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
                          <div className="product-card-actions">
                            <button className="btn-edit" onClick={() => setEditingProduct(p)}><Pencil size={12} /> Editar</button>
                            <button className="btn-danger" onClick={() => handleDelete(p.id)}><Trash2 size={12} /> Borrar</button>
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
                            <div className="cat-color-dot" style={{ background: c.color || '#333' }}>{c.icono}</div>
                            <div className="cat-row-info">
                              <h4>{c.nombre}</h4>
                              <p>/{c.slug} · {productos.filter(p => p.categoria === c.slug || p.categoria === c.nombre).length} productos</p>
                            </div>
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
                      descripcion_hero: configuracion.descripcion_hero
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
                        <div className="form-field full">
                          <label>Texto Principal de la Tienda (Hero)</label>
                          <input value={configuracion.descripcion_hero || ''} onChange={e => setConfiguracion({ ...configuracion, descripcion_hero: e.target.value })} placeholder="TIENDA & BABY" />
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
                                const fileName = `logo_${Date.now()}.${file.name.split('.').pop()}`;
                                await supabase.storage.from('archivos').upload(fileName, file);
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

        </div>
      </div>

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
  activeTab, setActiveTab, productos, categoriasData, configuracion, handleLogout
}: {
  activeTab: TabType;
  setActiveTab: (t: TabType) => void;
  productos: Producto[];
  categoriasData: Categoria[];
  configuracion: Configuracion | null;
  handleLogout: () => void;
}) {
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
          <h2 style={{ textTransform: 'capitalize', fontSize: '1.1rem' }}>{configuracion?.nombre_negocio || 'Catálogo'}</h2>
          <p>Panel Administrativo</p>
        </div>
      </div>

      <div className="sidebar-stats">
        <div className="stat-pill">
          <span className="label">Productos</span>
          <span className="value">{productos.length}</span>
        </div>
        <div className="stat-pill">
          <span className="label">Categorías</span>
          <span className="value">{categoriasData.length}</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-nav-label">Navegación</div>
        <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <span className="nav-icon"><LayoutDashboard size={14} /></span> Dashboard
        </button>
        <button className={`nav-item ${activeTab === 'productos' ? 'active' : ''}`} onClick={() => setActiveTab('productos')}>
          <span className="nav-icon"><Package size={14} /></span> Productos
        </button>
        <button className={`nav-item ${activeTab === 'categorias' ? 'active' : ''}`} onClick={() => setActiveTab('categorias')}>
          <span className="nav-icon"><Tag size={14} /></span> Categorías
        </button>
        <button className={`nav-item ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
          <span className="nav-icon"><Settings size={14} /></span> Configuración
        </button>
      </nav>

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
        
        {configuracion?.whatsapp && (
          <a 
            href={`https://wa.me/${configuracion.whatsapp.replace(/\D/g, '')}`} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.8rem', borderRadius: '8px', textDecoration: 'none', background: '#25D366', color: 'white', fontWeight: 600, fontSize: '0.9rem' }}
          >
            <Phone size={16} /> Línea WhatsApp: {configuracion.whatsapp}
          </a>
        )}
        
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
