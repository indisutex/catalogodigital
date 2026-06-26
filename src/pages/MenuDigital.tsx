import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Producto } from '../types';
import { Loader2, Search, MessageCircle, Info, Calendar } from 'lucide-react';
import './MenuDigital.css';

export default function MenuDigital() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');

  // Asegúrate de cambiar esto por tu número real
  const whatsappNumber = '1234567890'; 

  useEffect(() => {
    async function cargarProductos() {
      try {
        const { data, error } = await supabase
          .from('productos')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setProductos(data || []);
      } catch (error) {
        console.error('Error cargando menú:', error);
      } finally {
        setCargando(false);
      }
    }

    cargarProductos();
  }, []);

  const handlePedir = (producto: Producto) => {
    const message = `Hola! Me interesa pedir del menú:\n\n*${producto.nombre}*\nPrecio: $${producto.precio.toFixed(2)}`;
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const productosFiltrados = filtroCategoria === 'todos' 
    ? productos 
    : productos.filter(p => p.categoria === filtroCategoria);

  return (
    <div className="menu-app-container">
      {/* Dark Header */}
      <div className="menu-app-header">
        <div className="stars-overlay"></div>
        <div className="menu-app-logo">
           <span className="logo-letter c1">M</span>
           <span className="logo-letter c2">o</span>
           <span className="logo-letter c3">z</span>
           <span className="logo-letter c4">t</span>
           <span className="logo-letter c1">a</span>
           <span className="logo-letter c2">c</span>
           <span className="logo-letter c3">i</span>
           <span className="logo-letter c4">t</span>
           <span className="logo-letter c1">o</span>
        </div>
        <p className="menu-app-subtitle">TIENDA & BABY</p>
        
        <div className="menu-app-actions">
          <button className="pill-btn"><span className="status-dot"></span> ABIERTO</button>
          <button className="pill-btn"><Info size={14} /> NOSOTROS</button>
          <button className="pill-btn"><Calendar size={14} /> CONTACTO</button>
        </div>
      </div>

      <div className="menu-app-body">
        <div className="explore-header">
          <h2>EXPLORAR MENÚ</h2>
          <div className="search-icon-btn"><Search size={18} /></div>
        </div>

        {/* Categories Carousel */}
        <div className="categories-carousel">
          <div 
            className={`category-card ${filtroCategoria === 'todos' ? 'active' : ''}`}
            onClick={() => setFiltroCategoria('todos')}
          >
            <div className="cat-img-placeholder" style={{backgroundColor: '#f36b8e'}}>⭐</div>
            <div className="cat-info">
              <h3>TODOS LOS PRODUCTOS</h3>
              <p>{productos.length} ITEMS</p>
            </div>
          </div>
          
          <div 
            className={`category-card ${filtroCategoria === 'bebe' ? 'active' : ''}`}
            onClick={() => setFiltroCategoria('bebe')}
          >
            <div className="cat-img-placeholder" style={{backgroundColor: '#92d0db'}}>👶</div>
            <div className="cat-info">
              <h3>ROPA DE BEBÉS</h3>
              <p>{productos.filter(p=>p.categoria === 'bebe').length} ITEMS</p>
            </div>
          </div>

          <div 
            className={`category-card ${filtroCategoria === 'pijamas' ? 'active' : ''}`}
            onClick={() => setFiltroCategoria('pijamas')}
          >
            <div className="cat-img-placeholder" style={{backgroundColor: '#eab951'}}>🌙</div>
            <div className="cat-info">
              <h3>PIJAMAS INFANTILES</h3>
              <p>{productos.filter(p=>p.categoria === 'pijamas').length} ITEMS</p>
            </div>
          </div>
        </div>

        {/* Product List */}
        <div className="menu-list">
          {cargando ? (
            <div className="menu-loading">
              <Loader2 className="spinner" size={32} />
            </div>
          ) : productosFiltrados.length === 0 ? (
            <p className="no-items">No hay productos aquí.</p>
          ) : (
            productosFiltrados.map(producto => (
              <div key={producto.id} className="menu-list-item">
                <div className="item-img">
                  {producto.imagen_url ? (
                    <img src={producto.imagen_url} alt={producto.nombre} />
                  ) : (
                    <div className="img-placeholder"></div>
                  )}
                </div>
                <div className="item-details">
                  <h4>{producto.nombre}</h4>
                  <p className="item-desc">{producto.descripcion?.substring(0, 60)}...</p>
                  <p className="item-price">${producto.precio.toFixed(2)}</p>
                </div>
                <button 
                  className="item-add-btn" 
                  onClick={() => handlePedir(producto)}
                  aria-label="Pedir por WhatsApp"
                >
                  <MessageCircle size={20} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
