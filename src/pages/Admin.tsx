import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Producto } from '../types';
import './Admin.css';
import { Plus, X, Video } from 'lucide-react';

const SECRET_PIN = '0000';

type ProductFormData = {
  nombre: string;
  descripcion: string;
  precio: string;
  categoria: string;
  imagen_url: string;
  video_url: string;
  tallas: string;
};

const emptyProduct: ProductFormData = {
  nombre: '',
  descripcion: '',
  precio: '',
  categoria: 'bebe',
  imagen_url: '',
  video_url: '',
  tallas: ''
};

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  
  const [productos, setProductos] = useState<Producto[]>([]);
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
    const { data } = await supabase
      .from('productos')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setProductos(data);
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === SECRET_PIN) {
      setIsAuthenticated(true);
    } else {
      alert('PIN Incorrecto');
      setPinInput('');
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
      imagen_url: producto.imagen_url || '',
      video_url: producto.video_url || '',
      tallas: producto.tallas || ''
    });
    
    // Scroll to top
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

  const handleAutoFill = async (index: number) => {
    const url = prompt('🔗 Pega el enlace completo de Temu aquí:');
    if (!url) return;
    
    setLoading(true);
    try {
      // Usamos el endpoint raw para obtener el HTML directo
      const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
      if (!response.ok) throw new Error('Proxy falló');
      
      const html = await response.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      let title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || doc.querySelector('title')?.innerText || '';
      title = title.replace(/\| Temu.*/g, '').trim();
      
      const desc = doc.querySelector('meta[name="description"]')?.getAttribute('content') || doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      
      const img = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      
      if (!title && !img) {
        throw new Error('No se encontraron metaetiquetas. Temu bloqueó la petición por ser un robot.');
      }

      const newForms = [...bulkForms];
      newForms[index] = {
        ...newForms[index],
        nombre: title || newForms[index].nombre,
        descripcion: desc || newForms[index].descripcion,
        imagen_url: img || newForms[index].imagen_url
      };
      setBulkForms(newForms);
    } catch (err) {
      console.error('AutoFill Error:', err);
      alert('Error al extraer datos de Temu. Puede que el enlace sea inválido o Temu esté bloqueando la conexión. Por favor, ingresa los datos manualmente.');
    }
    setLoading(false);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Filter out completely empty rows
    const validForms = bulkForms.filter(f => f.nombre.trim() !== '' && f.precio !== '');

    if (validForms.length === 0) {
      alert('Por favor, llena al menos un producto.');
      setLoading(false);
      return;
    }

    const newProducts = validForms.map(f => ({
      nombre: f.nombre,
      descripcion: f.descripcion,
      precio: parseFloat(f.precio),
      categoria: f.categoria,
      imagen_url: f.imagen_url,
      video_url: f.video_url || null,
      tallas: f.tallas || null,
      stock: 100
    }));

    const { error } = await supabase.from('productos').insert(newProducts);
    
    setLoading(false);
    
    if (error) {
      alert('Error subiendo productos: ' + error.message);
    } else {
      alert(`¡${validForms.length} productos subidos exitosamente!`);
      setBulkForms([{ ...emptyProduct }]);
      cargarProductos();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que quieres borrar este producto?')) return;
    
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (error) {
      alert('Error borrando: ' + error.message);
    } else {
      if (editingId === id) cancelEdit();
      cargarProductos();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-page">
        <form onSubmit={handleLogin} className="pin-screen">
          <h2>Panel Secreto de Administración</h2>
          <p>Ingresa tu PIN para continuar</p>
          <input 
            type="password" 
            value={pinInput} 
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="****"
            maxLength={4}
            autoFocus
          />
          <button type="submit" className="pill-btn" style={{backgroundColor: 'var(--primary)', color: 'white', marginTop: '1rem'}}>
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-dashboard">
        <h2>Gestor de Productos Moztacito</h2>
        
        {editingId ? (
          // EDIT FORM
          <form onSubmit={handleUpdateProduct} className="admin-form">
            <h3>✏️ Actualizar Producto</h3>
            
            <div className="form-group">
              <label>Nombre del Producto</label>
              <input required type="text" value={editForm.nombre} onChange={e => setEditForm({...editForm, nombre: e.target.value})} />
            </div>

            <div className="form-group">
              <label>Descripción (Opcional)</label>
              <textarea value={editForm.descripcion} onChange={e => setEditForm({...editForm, descripcion: e.target.value})}></textarea>
            </div>

            <div className="form-row" style={{display: 'flex', gap: '1rem'}}>
              <div className="form-group" style={{flex: 1}}>
                <label>Precio de Venta ($ COP)</label>
                <input required type="number" step="0.01" value={editForm.precio} onChange={e => setEditForm({...editForm, precio: e.target.value})} />
              </div>
              <div className="form-group" style={{flex: 1}}>
                <label>Categoría</label>
                <select value={editForm.categoria} onChange={e => setEditForm({...editForm, categoria: e.target.value})}>
                  <option value="bebe">Ropa de Bebés</option>
                  <option value="pijamas">Pijamas Infantiles</option>
                  <option value="mamelucos">Mamelucos</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Tallas (Separadas por coma, Ej: 6 Meses, 12 Meses)</label>
              <input type="text" value={editForm.tallas} onChange={e => setEditForm({...editForm, tallas: e.target.value})} />
            </div>

            <div className="form-group">
              <label>Enlace de la Foto (Obligatorio)</label>
              <input required type="url" value={editForm.imagen_url} onChange={e => setEditForm({...editForm, imagen_url: e.target.value})} />
            </div>

            <div className="form-group">
              <label>Enlace del Video de Temu (Opcional)</label>
              <input type="url" value={editForm.video_url} onChange={e => setEditForm({...editForm, video_url: e.target.value})} placeholder="https://...mp4" />
            </div>

            <div style={{display: 'flex', gap: '1rem'}}>
              <button type="submit" disabled={loading} style={{flex: 1}}>
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
              <button type="button" onClick={cancelEdit} style={{backgroundColor: '#ccc', color: '#333'}}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          // BULK ADD FORM
          <form onSubmit={handleBulkSubmit} className="admin-form">
            <h3>🚀 Subida Rápida (Carga Múltiple)</h3>
            <p style={{fontSize: '0.85rem', color: '#666', marginBottom: '1rem'}}>Llena tantas filas como quieras y súbelas todas al mismo tiempo.</p>
            
            <div className="bulk-container">
              {bulkForms.map((form, index) => (
                <div key={index} className="bulk-row">
                  <div className="bulk-header">
                    <h4>Producto {index + 1}</h4>
                    <div style={{display: 'flex', gap: '0.5rem'}}>
                      <button type="button" onClick={() => handleAutoFill(index)} className="autofill-btn" title="Extraer datos de Temu">
                        ✨ AutoFill
                      </button>
                      {bulkForms.length > 1 && (
                        <button type="button" onClick={() => removeBulkRow(index)} className="bulk-remove"><X size={16}/></button>
                      )}
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <input required type="text" value={form.nombre} onChange={e => updateBulkForm(index, 'nombre', e.target.value)} placeholder="Nombre del Producto" />
                  </div>

                  <div className="form-group">
                    <textarea value={form.descripcion} onChange={e => updateBulkForm(index, 'descripcion', e.target.value)} placeholder="Descripción del producto (Opcional)" rows={2} style={{width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ccc', fontFamily: 'inherit'}}></textarea>
                  </div>

                  <div className="bulk-grid" style={{display: 'flex', gap: '0.5rem', marginBottom: '0.5rem'}}>
                    <div className="form-group" style={{flex: 1, marginBottom: 0}}>
                      <input required type="number" step="0.01" value={form.precio} onChange={e => updateBulkForm(index, 'precio', e.target.value)} placeholder="Precio ($ COP)" />
                    </div>
                    <div className="form-group" style={{flex: 1, marginBottom: 0}}>
                      <select value={form.categoria} onChange={e => updateBulkForm(index, 'categoria', e.target.value)} style={{width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: 'white'}}>
                        <option value="bebe">Categoría: Ropa Bebés</option>
                        <option value="pijamas">Categoría: Pijamas</option>
                        <option value="mamelucos">Categoría: Mamelucos</option>
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
            </div>

            <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
              <button type="button" onClick={addBulkRow} style={{backgroundColor: '#f36b8e', color: 'white', flex: 1, display: 'flex', justifyContent: 'center', gap: '0.5rem'}}>
                <Plus size={20} /> Añadir otra fila
              </button>
              <button type="submit" disabled={loading} style={{flex: 2}}>
                {loading ? 'Subiendo...' : `Subir ${bulkForms.length} producto(s) ahora`}
              </button>
            </div>
          </form>
        )}

        <div className="product-list">
          <h3>Tus Productos Activos ({productos.length})</h3>
          {productos.map(p => (
            <div key={p.id} className="admin-product-item">
              <div className="admin-product-media">
                <img src={p.imagen_url || ''} alt="" />
                {p.video_url && <div className="video-badge"><Video size={12}/> Video</div>}
              </div>
              <div className="admin-product-info">
                <h4>{p.nombre}</h4>
                <p>${p.precio} - Categoría: {p.categoria}</p>
              </div>
              <div style={{display: 'flex', gap: '0.5rem'}}>
                <button className="edit-btn" onClick={() => handleEditClick(p)}>Editar</button>
                <button className="delete-btn" onClick={() => handleDelete(p.id)}>Borrar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
