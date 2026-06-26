import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Producto, Categoria, Subcategoria, Configuracion } from '../types';
import './Admin.css';
import { X, Video, Upload } from 'lucide-react';

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
  categoria: 'bebe',
  subcategoria: '',
  imagen_url: '',
  video_url: '',
  tallas: ''
};

type TabType = 'productos' | 'categorias' | 'config';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  
  const [activeTab, setActiveTab] = useState<TabType>('productos');
  
  // Products State
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categoriasData, setCategoriasData] = useState<Categoria[]>([]);
  const [subcategoriasData, setSubcategoriasData] = useState<Subcategoria[]>([]);
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null);
  const [loading, setLoading] = useState(false);

  // Bulk Add State
  const [bulkForms, setBulkForms] = useState<ProductFormData[]>([{ ...emptyProduct }]);
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProductFormData>({ ...emptyProduct });

  useEffect(() => {
    if (isAuthenticated) {
      cargarProductos();
    }
  }, [isAuthenticated]);

  async function cargarProductos() {
    try {
      const [prodRes, catRes, subcatRes, confRes] = await Promise.all([
        supabase.from('productos').select('*').order('created_at', { ascending: false }),
        supabase.from('categorias').select('*').order('orden', { ascending: true }),
        supabase.from('subcategorias').select('*').order('orden', { ascending: true }),
        supabase.from('configuracion').select('*').limit(1).single()
      ]);

      if (prodRes.data) setProductos(prodRes.data);
      if (catRes.data) setCategoriasData(catRes.data);
      if (subcatRes.data) setSubcategoriasData(subcatRes.data);
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
      alert('PIN Incorrecto');
      setPin('');
    }
  };

  // --- EDIT LOGIC ---
  const handleEditClick = (producto: Producto) => {
    setEditingId(producto.id);
    setEditForm({
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      precio: producto.precio.toString(),
      categoria: producto.categoria,
      subcategoria: producto.subcategoria || '',
      imagen_url: producto.imagen_url || '',
      video_url: producto.video_url || '',
      tallas: producto.tallas || ''
    });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ ...emptyProduct });
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setLoading(true);

    const productData = {
      nombre: editForm.nombre,
      descripcion: editForm.descripcion,
      precio: parseFloat(editForm.precio),
      categoria: editForm.categoria,
      subcategoria: editForm.subcategoria || null,
      imagen_url: editForm.imagen_url,
      video_url: editForm.video_url || null,
      tallas: editForm.tallas || null,
    };

    const { error } = await supabase
      .from('productos')
      .update(productData)
      .eq('id', editingId);
    
    setLoading(false);
    
    if (error) {
      alert('Error actualizando producto: ' + error.message);
    } else {
      alert('¡Producto actualizado exitosamente!');
      cancelEdit();
      cargarProductos();
    }
  };

  // --- BULK ADD LOGIC ---
  const addBulkRow = () => {
    setBulkForms([...bulkForms, { ...emptyProduct }]);
  };

  const removeBulkRow = (index: number) => {
    const newForms = [...bulkForms];
    newForms.splice(index, 1);
    setBulkForms(newForms.length ? newForms : [{ ...emptyProduct }]);
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('archivos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
      updateBulkForm(index, 'imagen_url', data.publicUrl);
    } catch (error) {
      console.error('Error uploading:', error);
      alert('Error al subir archivo');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFill = async (index: number) => {
    const url = prompt('🔗 Pega el enlace de Temu:');
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
    } catch (err) {
      alert('Error al extraer datos. Intenta manualmente.');
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
      alert('Error: ' + error.message);
    } else {
      alert('¡Productos subidos!');
      setBulkForms([{ ...emptyProduct }]);
      cargarProductos();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro?')) return;
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (!error) cargarProductos();
  };

  if (!isAuthenticated) {
    return (
      <div className="pin-screen">
        <form onSubmit={handleLogin} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'}}>
          <h2>🔐 Acceso Administrativo</h2>
          <input 
            type="password" 
            value={pin} 
            onChange={e => setPin(e.target.value)} 
            placeholder="Introduce el PIN" 
            autoFocus
          />
          <button type="submit" style={{padding: '0.8rem 2rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer'}}>Ingresar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Centro de Control Moztacito</h1>
        <p>Gestiona todo tu negocio desde aquí</p>
      </div>

      <div className="admin-tabs">
        <button className={`tab-btn ${activeTab === 'productos' ? 'active' : ''}`} onClick={() => setActiveTab('productos')}>📦 Productos</button>
        <button className={`tab-btn ${activeTab === 'categorias' ? 'active' : ''}`} onClick={() => setActiveTab('categorias')}>🗂️ Categorías</button>
        <button className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>⚙️ Configuración</button>
      </div>

      {activeTab === 'productos' && (
        <>
          <div className="admin-box bulk-upload-box">
            <form onSubmit={handleBulkSubmit} className="admin-form">
              <h3>🚀 Subida Rápida</h3>
              {bulkForms.map((form, index) => (
                <div key={index} className="bulk-row">
                  <div className="bulk-header">
                    <h4>Producto {index + 1}</h4>
                    <div style={{display: 'flex', gap: '0.5rem'}}>
                      <button type="button" onClick={() => handleAutoFill(index)} className="autofill-btn">✨ AutoFill</button>
                      <label className="file-upload-btn">
                        <Upload size={16}/>
                        <input type="file" onChange={(e) => handleFileUpload(e, index)} style={{display: 'none'}} />
                      </label>
                      {bulkForms.length > 1 && <button type="button" onClick={() => removeBulkRow(index)}><X size={16}/></button>}
                    </div>
                  </div>
                  <div className="form-group">
                    <input required type="text" value={form.nombre} onChange={e => updateBulkForm(index, 'nombre', e.target.value)} placeholder="Nombre del Producto" />
                  </div>
                  
                  <div className="form-group">
                    <textarea value={form.descripcion} onChange={e => updateBulkForm(index, 'descripcion', e.target.value)} placeholder="Descripción (Opcional)" rows={2} style={{width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ccc', fontFamily: 'inherit'}}></textarea>
                  </div>

                  <div className="bulk-grid" style={{display: 'flex', gap: '0.5rem', marginBottom: '0.5rem'}}>
                    <div className="form-group" style={{flex: 1, marginBottom: 0}}>
                      <input required type="number" step="0.01" value={form.precio} onChange={e => updateBulkForm(index, 'precio', e.target.value)} placeholder="Precio ($ COP)" />
                    </div>
                    <div className="form-group" style={{flex: 1, marginBottom: 0}}>
                      <select value={form.categoria} onChange={e => updateBulkForm(index, 'categoria', e.target.value)} style={{width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: 'white'}}>
                        {categoriasData.map(c => <option key={c.id} value={c.slug}>{c.nombre}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <input type="text" value={form.tallas} onChange={e => updateBulkForm(index, 'tallas', e.target.value)} placeholder="Tallas (separadas por coma, Ej: 6 Meses, 12 Meses)" />
                  </div>

                  <div className="form-group">
                    <input required type="url" value={form.imagen_url} onChange={e => updateBulkForm(index, 'imagen_url', e.target.value)} placeholder="URL de la Foto" />
                  </div>
                  
                  <div className="form-group">
                    <input type="url" value={form.video_url} onChange={e => updateBulkForm(index, 'video_url', e.target.value)} placeholder="URL del Video (Opcional)" />
                  </div>
                </div>
              ))}
              <div className="actions">
                <button type="button" onClick={addBulkRow}>+ Añadir fila</button>
                <button type="submit" disabled={loading}>{loading ? 'Subiendo...' : 'Subir productos'}</button>
              </div>
            </form>
          </div>

          <div className="product-list">
            <h3>Tus Productos ({productos.length})</h3>
            {productos.map(p => (
              <div key={p.id} className="admin-product-item">
                <div className="admin-product-media">
                  <img src={p.imagen_url || ''} alt="" />
                  {p.video_url && <div className="video-badge"><Video size={12}/> Video</div>}
                </div>
                <div className="admin-product-info">
                  <h4>{p.nombre}</h4>
                  <p>${p.precio} - {p.categoria}</p>
                </div>
                <div style={{display: 'flex', gap: '0.5rem'}}>
                  <button className="edit-btn" onClick={() => handleEditClick(p)}>Editar</button>
                  <button className="delete-btn" onClick={() => handleDelete(p.id)}>Borrar</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'categorias' && (
        <div className="admin-box">
          <h2>🗂️ Gestión de Categorías</h2>
          <p>Crea las categorías principales de tu tienda.</p>
          
          <form className="admin-form" onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const nombre = (form.elements.namedItem('nombre') as HTMLInputElement).value;
            const slug = (form.elements.namedItem('slug') as HTMLInputElement).value || nombre.toLowerCase().replace(/ /g, '-');
            const icono = (form.elements.namedItem('icono') as HTMLInputElement).value;
            const color = (form.elements.namedItem('color') as HTMLInputElement).value;
            
            setLoading(true);
            const { error } = await supabase.from('categorias').insert([{ nombre, slug, icono, color }]);
            setLoading(false);
            
            if (error) alert('Error: ' + error.message);
            else { form.reset(); cargarProductos(); }
          }}>
            <div className="bulk-grid">
              <input required name="nombre" placeholder="Nombre (Ej: Ropa Bebés)" />
              <input name="slug" placeholder="Slug (Opcional, ej: bebe)" />
            </div>
            <div className="bulk-grid">
              <input name="icono" placeholder="Ícono (Emoji, ej: 👶)" />
              <input name="color" placeholder="Color Fondo (Ej: #92d0db)" />
            </div>
            <button type="submit" disabled={loading}>Crear Categoría</button>
          </form>

          <div className="product-list" style={{marginTop: '2rem'}}>
            <h3>Categorías Actuales</h3>
            {categoriasData.map(c => (
              <div key={c.id} className="admin-product-item" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <h4>{c.icono} {c.nombre}</h4>
                  <p style={{color: c.color}}>Slug: {c.slug} - Color: {c.color}</p>
                </div>
                <button className="delete-btn" onClick={async () => {
                  if (!window.confirm('¿Seguro?')) return;
                  await supabase.from('categorias').delete().eq('id', c.id);
                  cargarProductos();
                }}>Borrar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'config' && (
        <div className="admin-box">
          <h2>⚙️ Configuración Global</h2>
          <p>Ajusta los detalles principales de tu tienda.</p>
          
          {configuracion ? (
            <form className="admin-form" onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              const { error } = await supabase.from('configuracion').update({
                nombre_negocio: configuracion.nombre_negocio,
                whatsapp: configuracion.whatsapp,
                logo_url: configuracion.logo_url,
                descripcion_hero: configuracion.descripcion_hero
              }).eq('id', configuracion.id);
              setLoading(false);
              if (error) alert('Error: ' + error.message);
              else alert('Configuración guardada!');
            }}>
              <div className="form-group">
                <label>Nombre del Negocio</label>
                <input required type="text" value={configuracion.nombre_negocio} onChange={e => setConfiguracion({...configuracion, nombre_negocio: e.target.value})} />
              </div>
              <div className="form-group">
                <label>WhatsApp (Sin el +)</label>
                <input required type="text" value={configuracion.whatsapp} onChange={e => setConfiguracion({...configuracion, whatsapp: e.target.value})} />
              </div>
              <div className="form-group">
                <label>URL del Logo (Opcional)</label>
                <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                  <input type="url" value={configuracion.logo_url || ''} onChange={e => setConfiguracion({...configuracion, logo_url: e.target.value})} style={{flex: 1}} />
                  <label className="pill-btn" style={{cursor: 'pointer', padding: '0.8rem'}}>
                    <Upload size={16} /> Subir
                    <input type="file" style={{display: 'none'}} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setLoading(true);
                      try {
                        const fileExt = file.name.split('.').pop();
                        const fileName = `logo_${Date.now()}.${fileExt}`;
                        await supabase.storage.from('archivos').upload(fileName, file);
                        const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
                        setConfiguracion({...configuracion, logo_url: data.publicUrl});
                      } catch (err) { alert('Error subiendo logo'); }
                      setLoading(false);
                    }} />
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label>Texto Principal (Hero)</label>
                <input type="text" value={configuracion.descripcion_hero || ''} onChange={e => setConfiguracion({...configuracion, descripcion_hero: e.target.value})} />
              </div>
              <button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar Configuración'}</button>
            </form>
          ) : (
            <p>Cargando configuración...</p>
          )}
        </div>
      )}
    </div>
  );
}
