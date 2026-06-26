import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Producto } from '../types';
import './Admin.css';

const SECRET_PIN = '0000';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('');
  const [categoria, setCategoria] = useState('bebe');
  const [imagenUrl, setImagenUrl] = useState('');

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

  const handleEditClick = (producto: Producto) => {
    setEditingId(producto.id);
    setNombre(producto.nombre);
    setDescripcion(producto.descripcion || '');
    setPrecio(producto.precio.toString());
    setCategoria(producto.categoria);
    setImagenUrl(producto.imagen_url || '');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNombre('');
    setDescripcion('');
    setPrecio('');
    setImagenUrl('');
  };

  const handleAddOrUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const productData = {
      nombre,
      descripcion,
      precio: parseFloat(precio),
      categoria,
      imagen_url: imagenUrl,
      stock: 100 // Default stock
    };

    let error;

    if (editingId) {
      // Update
      const response = await supabase
        .from('productos')
        .update(productData)
        .eq('id', editingId);
      error = response.error;
    } else {
      // Insert
      const response = await supabase
        .from('productos')
        .insert([productData]);
      error = response.error;
    }
    
    setLoading(false);
    
    if (error) {
      alert('Error guardando producto: ' + error.message);
    } else {
      alert(editingId ? '¡Producto actualizado exitosamente!' : '¡Producto subido exitosamente!');
      cancelEdit();
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
        
        <form onSubmit={handleAddOrUpdateProduct} className="admin-form">
          <h3>{editingId ? '✏️ Actualizar Producto' : 'Subir Nuevo Producto de Temu'}</h3>
          
          <div className="form-group">
            <label>Nombre del Producto</label>
            <input required type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Pijama Enterizo Dinosaurio" />
          </div>

          <div className="form-group">
            <label>Descripción (Opcional)</label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Talla, material, detalles..."></textarea>
          </div>

          <div className="form-group">
            <label>Precio de Venta ($ COP)</label>
            <input required type="number" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="Ej. 45000" />
          </div>

          <div className="form-group">
            <label>Categoría</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value)}>
              <option value="bebe">Ropa de Bebés</option>
              <option value="pijamas">Pijamas Infantiles</option>
              <option value="mamelucos">Mamelucos</option>
            </select>
          </div>

          <div className="form-group">
            <label>Enlace de la Foto (URL de Temu o de la web)</label>
            <input type="url" value={imagenUrl} onChange={e => setImagenUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div style={{display: 'flex', gap: '1rem'}}>
            <button type="submit" disabled={loading} style={{flex: 1}}>
              {loading ? 'Guardando...' : (editingId ? 'Guardar Cambios' : '🚀 Publicar en la Tienda')}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit} style={{backgroundColor: '#ccc', color: '#333'}}>
                Cancelar
              </button>
            )}
          </div>
        </form>

        <div className="product-list">
          <h3>Tus Productos Activos ({productos.length})</h3>
          {productos.map(p => (
            <div key={p.id} className="admin-product-item">
              <img src={p.imagen_url || ''} alt="" />
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
