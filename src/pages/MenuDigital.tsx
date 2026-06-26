import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Producto } from '../types';
import { Loader2, Search, Plus, Info, Calendar, ShoppingBag, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import './MenuDigital.css';

export default function MenuDigital() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutMode, setIsCheckoutMode] = useState(false);
  
  // Size Selection State
  const [sizeModalProduct, setSizeModalProduct] = useState<Producto | null>(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    direccion: '',
    ciudad: ''
  });

  const { items, addToCart, removeFromCart, updateQuantity, total, clearCart } = useCart();

  useEffect(() => {
    async function cargarProductos() {
      try {
        const { data, error } = await supabase
          .from('productos')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        if (data) setProductos(data);
      } catch (err) {
        console.error('Error cargando productos:', err);
      } finally {
        setCargando(false);
      }
    }
    cargarProductos();
  }, []);

  const handleAddClick = (producto: Producto) => {
    if (producto.tallas) {
      setSizeModalProduct(producto);
    } else {
      addToCart(producto);
    }
  };

  const handleSizeSelect = (talla: string) => {
    if (sizeModalProduct) {
      addToCart(sizeModalProduct, talla);
      setSizeModalProduct(null);
    }
  };

  const productosFiltrados = filtroCategoria === 'todos' 
    ? productos 
    : productos.filter(p => p.categoria === filtroCategoria);

  const totalItems = items.reduce((sum, item) => sum + item.cantidad, 0);

  const handleEnviarPedido = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Construir el mensaje para WhatsApp
    let mensaje = `*¡NUEVO PEDIDO!*\n\n`;
    mensaje += `*Cliente:* ${formData.nombre}\n`;
    mensaje += `*Teléfono:* ${formData.telefono}\n`;
    mensaje += `*Dirección:* ${formData.direccion}, ${formData.ciudad}\n\n`;
    
    mensaje += `*PRODUCTOS:*\n`;
    const mensajeProductos = items.map(item => 
      `- ${item.cantidad}x ${item.nombre} ${item.talla ? `(Talla: ${item.talla}) ` : ''}- $${(item.precio * item.cantidad).toFixed(2)}`
    ).join('\n');
    mensaje += mensajeProductos;
    
    mensaje += `\n*TOTAL:* $${total.toFixed(2)}\n\n`;
    mensaje += `Por favor indícame los métodos de pago para confirmar mi compra.`;

    const numeroWhatsApp = '573185637317'; // Actualizado con tu número
    const url = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
    
    window.open(url, '_blank');
    
    // Limpiar después de enviar
    setIsCartOpen(false);
    setIsCheckoutMode(false);
    clearCart();
    setFormData({ nombre: '', telefono: '', direccion: '', ciudad: '' });
  };

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
                  {producto.video_url ? (
                    <video 
                      src={producto.video_url} 
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      style={{width: '100%', height: '100%', objectFit: 'cover'}}
                    />
                  ) : producto.imagen_url ? (
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
                  onClick={() => handleAddClick(producto)}
                  aria-label="Añadir al carrito"
                >
                  <Plus size={20} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Floating Cart Button */}
      {totalItems > 0 && !isCartOpen && (
        <button className="floating-cart-btn" onClick={() => setIsCartOpen(true)}>
          <div className="cart-icon-wrapper">
            <ShoppingBag size={24} />
            <span className="cart-badge">{totalItems}</span>
          </div>
          <span className="cart-total-float">Ver Carrito - ${total.toFixed(2)}</span>
        </button>
      )}

      {/* Cart Modal */}
      {isCartOpen && (
        <div className="cart-modal-overlay">
          <div className="cart-modal">
            <div className="cart-header">
              <h3>{isCheckoutMode ? 'Datos de Envío' : 'Tu Pedido'}</h3>
              <button 
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutMode(false);
                }} 
                className="close-btn"
              >
                <X size={24} />
              </button>
            </div>
            
            {isCheckoutMode ? (
              <form className="checkout-form" onSubmit={handleEnviarPedido}>
                <div className="form-group">
                  <label>Nombre Completo</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.nombre}
                    onChange={e => setFormData({...formData, nombre: e.target.value})}
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                <div className="form-group">
                  <label>Teléfono (WhatsApp)</label>
                  <input 
                    type="tel" 
                    required 
                    value={formData.telefono}
                    onChange={e => setFormData({...formData, telefono: e.target.value})}
                    placeholder="Ej. +52 123 456 7890"
                  />
                </div>
                <div className="form-group">
                  <label>Ciudad</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.ciudad}
                    onChange={e => setFormData({...formData, ciudad: e.target.value})}
                    placeholder="Ej. Ciudad de México"
                  />
                </div>
                <div className="form-group">
                  <label>Dirección Exacta de Envío</label>
                  <textarea 
                    required 
                    rows={3}
                    value={formData.direccion}
                    onChange={e => setFormData({...formData, direccion: e.target.value})}
                    placeholder="Calle, Número, Colonia, Código Postal, Referencias..."
                  />
                </div>

                <div className="cart-footer" style={{ marginTop: 'auto' }}>
                  <div className="cart-total">
                    <span>Total a Pagar:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                  <button type="submit" className="checkout-btn whatsapp-submit">
                    Enviar Pedido por WhatsApp
                  </button>
                  <button 
                    type="button" 
                    className="back-btn" 
                    onClick={() => setIsCheckoutMode(false)}
                  >
                    Volver al Carrito
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="cart-items">
                  {items.length === 0 ? (
                    <p className="empty-cart">Tu carrito está vacío.</p>
                  ) : (
                    items.map(item => (
                      <div key={`${item.id}-${item.talla || 'none'}`} className="cart-item">
                        <div className="cart-item-img">
                          {item.imagen_url ? <img src={item.imagen_url} alt={item.nombre} /> : <div className="img-placeholder-small"></div>}
                        </div>
                        <div className="cart-item-details">
                          <h4>{item.nombre}</h4>
                          {item.talla && <p style={{fontSize: '0.8rem', color: '#666', margin: '2px 0'}}>Talla: {item.talla}</p>}
                          <p className="cart-item-price">${(item.precio * item.cantidad).toFixed(2)}</p>
                          <div className="cart-item-qty">
                            <button onClick={() => updateQuantity(item.id, item.cantidad - 1, item.talla)}>-</button>
                            <span>{item.cantidad}</span>
                            <button onClick={() => updateQuantity(item.id, item.cantidad + 1, item.talla)}>+</button>
                          </div>
                        </div>
                        <button className="cart-item-remove" onClick={() => removeFromCart(item.id, item.talla)}>
                          <X size={20} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="cart-footer">
                  <div className="cart-total">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                  <button 
                    className="checkout-btn" 
                    disabled={items.length === 0}
                    onClick={() => setIsCheckoutMode(true)}
                  >
                    Continuar Pedido
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SIZE SELECTION MODAL */}
      {sizeModalProduct && (
        <div className="cart-modal-overlay" onClick={() => setSizeModalProduct(null)}>
          <div className="cart-modal" onClick={e => e.stopPropagation()} style={{textAlign: 'center', padding: '2rem'}}>
            <button className="close-modal-btn" onClick={() => setSizeModalProduct(null)}><X size={24} /></button>
            <h3>Selecciona la Talla</h3>
            <p style={{marginBottom: '1rem', color: '#666'}}>{sizeModalProduct.nombre}</p>
            
            <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center'}}>
              {sizeModalProduct.tallas?.split(',').map((t, idx) => {
                const talla = t.trim();
                if (!talla) return null;
                return (
                  <button 
                    key={idx} 
                    onClick={() => handleSizeSelect(talla)}
                    style={{
                      padding: '0.8rem 1.5rem',
                      border: '2px solid var(--primary)',
                      borderRadius: '8px',
                      background: 'white',
                      color: 'var(--primary)',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    {talla}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
