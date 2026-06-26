import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Producto } from '../types';
import { Loader2, Search, Plus, Info, Calendar, ShoppingBag, X, Minus } from 'lucide-react';
import { useCart } from '../context/CartContext';
import './MenuDigital.css';

export default function MenuDigital() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutMode, setIsCheckoutMode] = useState(false);
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
        setProductos(data || []);
      } catch (error) {
        console.error('Error cargando menú:', error);
      } finally {
        setCargando(false);
      }
    }

    cargarProductos();
  }, []);

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
    items.forEach(item => {
      mensaje += `- ${item.cantidad}x ${item.nombre} ($${(item.precio * item.cantidad).toFixed(2)})\n`;
    });
    
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
                  onClick={() => addToCart(producto)}
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
                      <div key={item.id} className="cart-item">
                        <div className="cart-item-img">
                          {item.imagen_url ? <img src={item.imagen_url} alt={item.nombre} /> : <div className="img-placeholder-small"></div>}
                        </div>
                        <div className="cart-item-info">
                          <h5>{item.nombre}</h5>
                          <p>${item.precio.toFixed(2)}</p>
                        </div>
                        <div className="cart-item-actions">
                          <button onClick={() => updateQuantity(item.id, item.cantidad - 1)} disabled={item.cantidad <= 1}><Minus size={14}/></button>
                          <span>{item.cantidad}</span>
                          <button onClick={() => updateQuantity(item.id, item.cantidad + 1)}><Plus size={14}/></button>
                          <button className="remove-btn" onClick={() => removeFromCart(item.id)}><X size={14}/></button>
                        </div>
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
    </div>
  );
}
