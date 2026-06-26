import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Producto } from '../types';
import { Loader2, MessageCircle } from 'lucide-react';
import './MenuDigital.css';

export default function MenuDigital() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');

  // Aquí pones tu número real de WhatsApp con código de país (ejemplo: 573001234567 para Colombia)
  const whatsappNumber = "1234567890"; 

  useEffect(() => {
    async function cargarProductos() {
      try {
        let query = supabase.from('productos').select('*').order('created_at', { ascending: false });
        
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

  const handleOrderWhatsApp = (producto: Producto) => {
    const message = `Hola! Me interesa pedir este producto del menú:\n\n*${producto.nombre}*\nPrecio: $${producto.precio}\n\n¿Tienen disponibilidad?`;
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="menu-digital-page">
      <div className="menu-header">
        <div className="menu-logo">
           <span className="logo-letter c1">B</span>
           <span className="logo-letter c2">i</span>
           <span className="logo-letter c3">b</span>
           <span className="logo-letter c4">o</span>
        </div>
        <h1>Menú Digital</h1>
      </div>

      <div className="menu-categories">
        <button 
          className={`menu-cat-btn ${filtroCategoria === 'todos' ? 'active' : ''}`}
          onClick={() => setFiltroCategoria('todos')}
        >
          Todos
        </button>
        <button 
          className={`menu-cat-btn ${filtroCategoria === 'bebe' ? 'active' : ''}`}
          onClick={() => setFiltroCategoria('bebe')}
        >
          Bebés
        </button>
        <button 
          className={`menu-cat-btn ${filtroCategoria === 'pijamas' ? 'active' : ''}`}
          onClick={() => setFiltroCategoria('pijamas')}
        >
          Pijamas
        </button>
      </div>

      <div className="menu-content">
        {cargando ? (
          <div className="loading-container">
            <Loader2 className="spinner" size={48} />
          </div>
        ) : productos.length === 0 ? (
          <div className="empty-state">
            <p>No se encontraron productos en esta categoría.</p>
          </div>
        ) : (
          <div className="menu-list">
            {productos.map((producto) => (
              <div key={producto.id} className="menu-item">
                <div className="menu-item-image">
                  {producto.imagen_url ? (
                    <img src={producto.imagen_url} alt={producto.nombre} />
                  ) : (
                    <div className="menu-image-placeholder"></div>
                  )}
                </div>
                <div className="menu-item-info">
                  <h4>{producto.nombre}</h4>
                  <p className="menu-item-desc">{producto.descripcion?.substring(0, 50)}...</p>
                  <div className="menu-item-bottom">
                    <span className="menu-item-price">${producto.precio.toFixed(2)}</span>
                    <button 
                      className="btn-whatsapp"
                      onClick={() => handleOrderWhatsApp(producto)}
                    >
                      <MessageCircle size={16} />
                      Pedir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
