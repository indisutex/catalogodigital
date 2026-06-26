import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Producto, Categoria, Subcategoria, Configuracion } from '../types';
import './Admin.css';
import { X, Video, Upload, Package, Tag, Settings, LayoutDashboard, Zap, Plus, Trash2, Pencil, Check } from 'lucide-react';

const SECRET_PIN = '0000';

type ProductFormData = {
  nombre: string;
  descripcion: string;
  precio: string;
  categoria: string;
  subcategoria: string;
  imagen_url: string;
  video_url: string;
  tallas: string;
};

const emptyProduct: ProductFormData = {
  nombre: '',
  descripcion: '',
  precio: '',
  categoria: '',
  subcategoria: '',
  imagen_url: '',
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

  const [productos, setProductos] = useState<Producto[]>([]);
  const [categoriasData, setCategoriasData] = useState<Categoria[]>([]);
  const [_subcategoriasData, _setSubcategoriasData] = useState<Subcategoria[]>([]);
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [bulkForms, setBulkForms] = useState<ProductFormData[]>([{ ...emptyProduct }]);

  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    if (isAuthenticated) cargarDatos();
  }, [isAuthenticated]);

  async function cargarDatos() {
    try {
      const [prodRes, catRes, subcatRes, confRes] = await Promise.all([
        supabase.from('productos').select('*').order('created_at', { ascending: false }),
        supabase.from('categorias').select('*').order('orden', { ascending: true }),
        supabase.from('subcategorias').select('*').order('orden', { ascending: true }),
        supabase.from('configuracion').select('*').limit(1).single()
      ]);
      if (prodRes.data) setProductos(prodRes.data);
      if (catRes.data) setCategoriasData(catRes.data);
      if (subcatRes.data) _setSubcategoriasData(subcatRes.data);
      if (confRes.data) setConfiguracion(confRes.data);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('archivos').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
      updateBulkForm(index, 'imagen_url', data.publicUrl);
      showToast('Foto subida exitosamente ✓');
    } catch {
      showToast('Error al subir foto', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFill = async (index: number) => {
    const url = prompt('🔗 Pega el enlace de Temu o cualquier tienda:');
    if (!url) return;
    setLoading(true);
    try {
      const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.replace(/\| Temu.*/g, '').trim() || '';
      const desc = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
      const img = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      const newForms = [...bulkForms];
      newForms[index] = { ...newForms[index], nombre: title, descripcion: desc, imagen_url: img };
      setBulkForms(newForms);
      showToast('Datos extraídos automáticamente ✓');
    } catch {
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
      imagen_url: f.imagen_url,
      video_url: f.video_url || null,
      tallas: f.tallas || null
    }));
    const { error } = await supabase.from('productos').insert(newProducts);
    setLoading(false);
    if (error) {
      showToast('Error al guardar: ' + error.message, 'error');
    } else {
      showToast(`${validForms.length} producto(s) guardado(s) exitosamente ✓`);
      setBulkForms([{ ...emptyProduct }]);
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
      imagen_url: editingProduct.imagen_url,
      video_url: editingProduct.video_url,
      tallas: editingProduct.tallas
    }).eq('id', editingProduct.id);
    setLoading(false);
    if (error) showToast('Error al actualizar', 'error');
    else { showToast('Producto actualizado ✓'); setEditingProduct(null); cargarDatos(); }
  };

  const filteredProducts = productos.filter(p =>
    p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.categoria.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── LOGIN SCREEN ──
  if (!isAuthenticated) {
    return (
      <div className="admin-login-wrapper">
        <div className="admin-login-card">
          <div>
            <div className="login-logo">🛍️</div>
            <h1>Moztacito Admin</h1>
            <p>Centro de control de tu tienda</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="• • • •"
              maxLength={6}
              autoFocus
            />
            <button type="submit" className="login-btn">Ingresar al Panel</button>
          </form>
          <p style={{ fontSize: '0.72rem', color: '#333' }}>Panel Administrativo v2.0</p>
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
          <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} productos={productos} categoriasData={categoriasData} />
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
        <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} productos={productos} categoriasData={categoriasData} />
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
              <button className="btn-primary" onClick={() => { setBulkForms([{ ...emptyProduct }]); }}>
                <Plus size={14} /> Nuevo Producto
              </button>
            )}
          </div>
        </div>

        <div className="admin-content">

          {/* ── PRODUCTS TAB ── */}
          {activeTab === 'productos' && (
            <>
              {/* QUICK ADD PANEL */}
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
                              <Upload size={12} /> Subir Foto
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileUpload(e, index)} />
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
                            <label>URL de Imagen</label>
                            <div className="img-input-row">
                              {form.imagen_url && <img src={form.imagen_url} className="img-preview-thumb" alt="" onError={e => (e.currentTarget.style.display = 'none')} />}
                              <input value={form.imagen_url} onChange={e => updateBulkForm(index, 'imagen_url', e.target.value)} placeholder="https://..." />
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

              {/* PRODUCT LIST PANEL */}
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
                      <p>Usa el formulario de arriba para agregar tu primer producto</p>
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
            </>
          )}

          {/* ── CATEGORIES TAB ── */}
          {activeTab === 'categorias' && (
            <div className="admin-panel">
              <div className="panel-header">
                <div>
                  <h3><Tag size={16} /> Gestión de Categorías</h3>
                  <p>Crea y elimina categorías de tu tienda</p>
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
                  const { error } = await supabase.from('categorias').insert([{ nombre, slug, icono, color }]);
                  setLoading(false);
                  if (error) showToast('Error: ' + error.message, 'error');
                  else { form.reset(); cargarDatos(); showToast('Categoría creada ✓'); }
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

                <hr className="divider" style={{ margin: '1.5rem 0' }} />
                <p style={{ fontSize: '0.78rem', color: '#555', marginBottom: '1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Categorías Activas</p>
                <div className="category-list">
                  {categoriasData.length === 0 ? (
                    <div className="empty-state">
                      <div className="es-icon">🗂️</div>
                      <h4>Sin categorías</h4>
                      <p>Crea tu primera categoría arriba</p>
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
                </div>
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
  activeTab, setActiveTab, productos, categoriasData
}: {
  activeTab: TabType;
  setActiveTab: (t: TabType) => void;
  productos: Producto[];
  categoriasData: Categoria[];
}) {
  return (
    <>
      <div className="sidebar-brand">
        <div className="brand-icon">🛍️</div>
        <div className="brand-text">
          <h2>Moztacito</h2>
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

      <div className="sidebar-footer">
        <div className="avatar">👑</div>
        <div className="user-info">
          <h4>Administrador</h4>
          <p>Sesión activa</p>
        </div>
      </div>
    </>
  );
}
