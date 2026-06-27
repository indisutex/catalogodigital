import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, getTenantId } from '../lib/supabase';
import type { Producto } from '../types';
import './Home.css';

// Using lucide-react just for stars and loaders
import { Star, Loader2 } from 'lucide-react';

export default function Home() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargarProductosDestacados() {
      try {
        const tenant = getTenantId();
        const { data, error } = await supabase
          .from('productos')
          .select('*')
          .eq('tenant_id', tenant)
          .order('created_at', { ascending: false })
          .limit(4);
        
        if (error) throw error;
        setProductos(data || []);
      } catch (error) {
        console.error('Error cargando productos:', error);
      } finally {
        setCargando(false);
      }
    }

    cargarProductosDestacados();
  }, []);

  return (
    <div className="home-page animate-fade-in">
      {/* Hero Slider Area */}
      <section className="hero-banner">
        <div className="hero-text-content">
          <h1>Babies shoes</h1>
          <p>One of the many benefits of being a baby is that you do not have to worry about color-matching your outfits - babies look good regardless of what they wear.</p>
          <Link to="/products" className="btn-primary hero-btn">
            Discover Now
          </Link>
        </div>
        <div className="hero-image-placeholder">
          {/* Unsplash Baby shoes image */}
          <img src="https://images.unsplash.com/photo-1596814234568-19ebcc1af3fa?auto=format&fit=crop&q=80&w=800" alt="Baby Shoes" />
        </div>
      </section>

      {/* Welcome Section */}
      <section className="welcome-section">
        <div className="welcome-text">
          <h2 className="section-title">Welcome To BiboStore</h2>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
          <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.</p>
        </div>
        <div className="welcome-image">
          <img src="https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&q=80&w=400" alt="Kids playing" />
        </div>
      </section>

      {/* New Arrivals (Products from DB) */}
      <section className="new-arrivals">
        <div className="section-header">
          <h2 className="section-title">New Arrivals</h2>
        </div>
        
        {cargando ? (
          <div className="loading-container">
            <Loader2 className="spinner" size={48} />
          </div>
        ) : (
          <div className="products-grid">
            {productos.map((producto) => (
              <div key={producto.id} className="product-card">
                <div className="product-image-container">
                  {producto.imagen_url ? (
                    <img src={producto.imagen_url} alt={producto.nombre} className="product-image" />
                  ) : (
                    <div className="product-image-placeholder"></div>
                  )}
                </div>
                <div className="product-info">
                  <h4>{producto.nombre}</h4>
                  <div className="product-rating">
                    <Star size={14} fill="#eab951" color="#eab951" />
                    <Star size={14} fill="#eab951" color="#eab951" />
                    <Star size={14} fill="#eab951" color="#eab951" />
                    <Star size={14} fill="#eab951" color="#eab951" />
                    <Star size={14} fill="#eab951" color="#eab951" />
                    <span>( 5 reviews )</span>
                  </div>
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
      </section>

      {/* Promos */}
      <section className="promos-section">
        <div className="promo-banner banner-green">
          <div className="promo-text">
            <h3>Big Sale</h3>
            <p>Discount 25% for Summer Holiday</p>
          </div>
        </div>
        <div className="promo-banner banner-yellow">
          <div className="promo-text">
            <h3>Educational Toys</h3>
            <p>Open new worlds of imagination and discovery.</p>
            <Link to="/products" className="promo-link">View All Collection &gt;</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
