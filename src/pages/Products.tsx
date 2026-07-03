import { useEffect, useState } from 'react';
import { supabase, getTenantId } from '../lib/supabase';
import type { Producto } from '../types';
import { Loader2, Search } from 'lucide-react';
import './Products.css';

export default function Products() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');

  useEffect(() => {
    async function cargarProductos() {
      try {
        let query = supabase.from('productos').select('*').eq('tenant_id', getTenantId()).order('created_at', { ascending: false });
        
        if (filtroCategoria !== 'todos') {
          query = query.eq('categoria', filtroCategoria);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        setProductos(data || []);
      } catch (error) {
        console.error('Error cargando productos:', error);
      } finally {
        setCargando(false);
      }
    }

    cargarProductos();
  }, [filtroCategoria]);

  return (
    <div className="products-page container animate-fade-in">
      <div className="products-header">
        <h1>Catálogo de Productos</h1>
        <p className="products-subtitle">Encuentra lo mejor para tu bebé y las pijamas más tiernas.</p>
      </div>

      <div className="products-filters glass-panel">
        <div className="filter-group">
          <label>Filtrar por categoría:</label>
          <div className="filter-buttons">
            <button 
              className={`filter-btn ${filtroCategoria === 'todos' ? 'active' : ''}`}
              onClick={() => setFiltroCategoria('todos')}
            >
              Todos
            </button>
            <button 
              className={`filter-btn ${filtroCategoria === 'bebe' ? 'active' : ''}`}
              onClick={() => setFiltroCategoria('bebe')}
            >
              Bebés
            </button>
            <button 
              className={`filter-btn ${filtroCategoria === 'pijamas' ? 'active' : ''}`}
              onClick={() => setFiltroCategoria('pijamas')}
            >
              Pijamas
            </button>
          </div>
        </div>
        <div className="search-bar">
          <Search size={20} className="search-icon" />
          <input type="text" placeholder="Buscar..." className="search-input" />
        </div>
      </div>

      {cargando ? (
        <div className="loading-container">
          <Loader2 className="spinner" size={48} />
          <p>Cargando catálogo...</p>
        </div>
      ) : productos.length === 0 ? (
        <div className="empty-state glass-panel">
          <p>No se encontraron productos en esta categoría.</p>
        </div>
      ) : (
        <div className="products-grid">
          {productos.map((producto) => (
            <div key={producto.id} className="product-card glass-panel">
              <div className="product-image-container">
                {producto.imagen_url ? (
                  <img src={producto.imagen_url} alt={producto.nombre} className="product-image" />
                ) : (
                  <div className="product-image-placeholder"></div>
                )}
                <span className="product-category-badge">{producto.categoria === 'bebe' ? 'Bebés' : 'Pijamas'}</span>
              </div>
              <div className="product-info">
                <h4>{producto.nombre}</h4>
                <p className="product-description">{producto.descripcion?.substring(0, 80)}...</p>
                <div className="product-bottom-row">
                  <p className="product-price">${producto.precio.toFixed(2)}</p>
                  <button 
                    className="btn-whatsapp"
                    onClick={() => {
                      const msg = `Hola! Me interesa pedir:\n\n*${producto.nombre}*\nPrecio: $${producto.precio}`;
                      window.open(`https://wa.me/1234567890?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                  >
                    Pedir por WhatsApp
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
