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

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const newProduct = {
      nombre,
      descripcion,
      precio: parseFloat(precio),
      categoria,
      imagen_url: imagenUrl,
      stock: 100 // Default stock
    };

    const { error } = await supabase.from('productos').insert([newProduct]);
    
    setLoading(false);
    
    if (error) {
      alert('Error subiendo producto: ' + error.message);
    } else {
      alert('¡Producto subido exitosamente!');
      // Reset form
      setNombre('');
      setDescripcion('');
      setPrecio('');
      setImagenUrl('');
      cargarProductos();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que quieres borrar este producto?')) return;
    
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (error) {
      alert('Error borrando: ' + error.message);
    } else {
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
        
        <form onSubmit={handleAddProduct} className="admin-form">
          <h3>Subir Nuevo Producto de Temu</h3>
          
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
            </select>
          </div>

          <div className="form-group">
            <label>Enlace de la Foto (URL de Temu)</label>
            <input type="url" value={imagenUrl} onChange={e => setImagenUrl(e.target.value)} placeholder="https://..." />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Subiendo...' : '🚀 Publicar en la Tienda'}
          </button>
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
              <button className="delete-btn" onClick={() => handleDelete(p.id)}>Borrar</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
