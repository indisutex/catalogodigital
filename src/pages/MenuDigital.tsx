import { useEffect, useState } from 'react';
import { supabase, getTenantId } from '../lib/supabase';
import type { Producto, Categoria, Subcategoria, Configuracion } from '../types';
import { Loader2, Search, Plus, Info, Calendar, ShoppingBag, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import './MenuDigital.css';

export default function MenuDigital() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null);
  const [cargando, setCargando] = useState(true);
  
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');
  const [filtroSubcategoria, setFiltroSubcategoria] = useState<string>('todas');
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutMode, setIsCheckoutMode] = useState(false);
  const [overrideWhatsApp, setOverrideWhatsApp] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wsParam = params.get('ws');
    if (wsParam) {
      const cleanNum = wsParam.replace(/\D/g, '');
      if (cleanNum) {
        setOverrideWhatsApp(cleanNum);
        sessionStorage.setItem(`ws_override_${getTenantId()}`, cleanNum);
      }
    } else {
      const savedOverride = sessionStorage.getItem(`ws_override_${getTenantId()}`);
      if (savedOverride) {
        setOverrideWhatsApp(savedOverride);
      }
    }
  }, []);
  
  useEffect(() => {
    if (configuracion?.nombre_negocio) {
      document.title = configuracion.nombre_negocio;
    } else {
      document.title = 'Catálogo Digital';
    }
  }, [configuracion]);
  
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
    async function cargarDatos() {
      try {
        const tenant = getTenantId();
        const [prodRes, catRes, subcatRes, confRes] = await Promise.all([
          supabase.from('productos').select('*').eq('tenant_id', tenant).order('created_at', { ascending: false }),
          supabase.from('categorias').select('*').eq('tenant_id', tenant).order('orden', { ascending: true }),
          supabase.from('subcategorias').select('*').eq('tenant_id', tenant).order('orden', { ascending: true }),
          supabase.from('configuracion').select('*').eq('tenant_id', tenant).limit(1).single()
        ]);
        
        if (prodRes.data) setProductos(prodRes.data);
        if (catRes.data) setCategorias(catRes.data);
        if (subcatRes.data) setSubcategorias(subcatRes.data);
        if (confRes.data) setConfiguracion(confRes.data);
      } catch (err) {
        console.error('Error cargando datos:', err);
      } finally {
        setCargando(false);
      }
    }
    cargarDatos();
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

  const catActual = categorias.find(c => c.slug === filtroCategoria);
  let productosFiltrados = filtroCategoria === 'todos' 
    ? productos 
    : productos.filter(p => {
        const pCat = (p.categoria || '').toLowerCase().trim();
        return pCat === filtroCategoria.toLowerCase().trim()
          || pCat === (catActual?.nombre || '').toLowerCase().trim()
          || pCat === (catActual?.slug || '').toLowerCase().trim();
      });

  if (filtroCategoria !== 'todos' && filtroSubcategoria !== 'todas') {
    const subcatActual = subcategorias.find(s => s.slug === filtroSubcategoria);
    productosFiltrados = productosFiltrados.filter(p => {
      const pSub = (p.subcategoria || '').toLowerCase().trim();
      return pSub === filtroSubcategoria.toLowerCase().trim()
        || pSub === (subcatActual?.nombre || '').toLowerCase().trim()
        || pSub === (subcatActual?.slug || '').toLowerCase().trim();
    });
  }

  const totalItems = items.reduce((sum, item) => sum + item.cantidad, 0);

  const handleEnviarPedido = async (e: React.FormEvent) => {
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

    const numeroWhatsApp = overrideWhatsApp || configuracion?.whatsapp || '573185637317';

    // Guardar en la base de datos de pedidos
    try {
      await supabase.from('pedidos').insert({
        cliente_nombre: formData.nombre,
        cliente_telefono: formData.telefono,
        direccion: formData.direccion,
        ciudad: formData.ciudad,
        total: total,
        productos: items,
        linea_whatsapp: numeroWhatsApp,
        tenant_id: getTenantId()
      });
    } catch (dbErr) {
      console.error('Error al registrar pedido en base de datos:', dbErr);
    }

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
      <div className={`menu-app-header ${configuracion?.video_hero_url ? 'has-video' : ''}`} style={{ position: 'relative' }}>
        {configuracion?.video_hero_url && (
          <video 
            src={configuracion.video_hero_url} 
            autoPlay 
            loop 
            muted 
            playsInline 
            className="hero-background-video"
          />
        )}
        <div className="header-bottom-bar">
          {/* Enlace Especial Dropshipper en la Esquina Inferior Izquierda */}
          <a 
            href={configuracion?.link_dropshipper || `https://wa.me/${overrideWhatsApp || (configuracion?.whatsapp || '').replace(/\D/g, '')}?text=Hola,%20soy%20dropshipper,%20me%20interesa%20trabajar%20con%20ustedes`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="special-header-btn"
            style={{ 
              background: '#f36b8e', 
              color: '#ffffff', 
              padding: '0.45rem 0.9rem', 
              borderRadius: '20px', 
              fontSize: '0.72rem', 
              fontWeight: 800, 
              textDecoration: 'none', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.2rem', 
              border: 'none',
              boxShadow: '0 4px 10px rgba(243, 107, 142, 0.35)'
            }}
          >
            🚀 ¿Dropshipper?
          </a>

          <p className="menu-app-subtitle">{configuracion?.descripcion_hero || 'TIENDA & BABY'}</p>

          {/* Enlace Especial Ganar Dinero en la Esquina Inferior Derecha */}
          <a 
            href={configuracion?.link_ganar_dinero || `https://wa.me/${overrideWhatsApp || (configuracion?.whatsapp || '').replace(/\D/g, '')}?text=Hola,%20quiero%20saber%20cómo%20ganar%20dinero%20con%20ustedes`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="ganar-dinero-pulse special-header-btn"
            style={{ 
              background: '#f36b8e', 
              color: '#ffffff', 
              padding: '0.45rem 0.9rem', 
              borderRadius: '20px', 
              fontSize: '0.72rem', 
              fontWeight: 800, 
              textDecoration: 'none', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.2rem', 
              border: 'none',
              boxShadow: '0 4px 10px rgba(243, 107, 142, 0.35)'
            }}
          >
            💸 ¿Ganar dinero?
          </a>
        </div>

        <div className="hero-content-overlay">
          <div className="menu-app-logo">
            {configuracion?.logo_url ? (
              <img
                src={configuracion.logo_url}
                alt="Logo"
                className="store-logo-round"
              />
            ) : (
              <div className="store-logo-round store-logo-placeholder">
                <span className="logo-letter c1" style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {(configuracion?.nombre_negocio || 'T').substring(0, 1).toUpperCase()}
                </span>
              </div>
            )}
          </div>
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
          
          {categorias.map(cat => (
            <div 
              key={cat.id}
              className={`category-card ${filtroCategoria === cat.slug ? 'active' : ''}`}
              onClick={() => {
                setFiltroCategoria(cat.slug);
                setFiltroSubcategoria('todas');
              }}
            >
              <div className="cat-img-placeholder" style={{backgroundColor: cat.color || '#eee'}}>{cat.icono}</div>
              <div className="cat-info">
                <h3>{cat.nombre.toUpperCase()}</h3>
                <p>{productos.filter(p=>p.categoria === cat.slug || p.categoria === cat.nombre).length} ITEMS</p>
              </div>
            </div>
          ))}
        </div>

        {/* Subcategories Filter Chips */}
        {filtroCategoria !== 'todos' && subcategorias.filter(s => s.categoria_id === categorias.find(c => c.slug === filtroCategoria)?.id).length > 0 && (
          <div style={{display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem', paddingLeft: '0.5rem'}}>
            <button 
              onClick={() => setFiltroSubcategoria('todas')}
              style={{
                padding: '0.4rem 1rem', borderRadius: '20px', border: 'none', fontWeight: 700, fontSize: '0.8rem',
                backgroundColor: filtroSubcategoria === 'todas' ? 'var(--primary)' : '#eee',
                color: filtroSubcategoria === 'todas' ? 'white' : '#555', cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >Todas</button>
            
            {subcategorias
              .filter(s => s.categoria_id === categorias.find(c => c.slug === filtroCategoria)?.id)
              .map(subcat => (
                <button 
                  key={subcat.id}
                  onClick={() => setFiltroSubcategoria(subcat.slug)}
                  style={{
                    padding: '0.4rem 1rem', borderRadius: '20px', border: 'none', fontWeight: 700, fontSize: '0.8rem',
                    backgroundColor: filtroSubcategoria === subcat.slug ? 'var(--primary)' : '#eee',
                    color: filtroSubcategoria === subcat.slug ? 'white' : '#555', cursor: 'pointer', whiteSpace: 'nowrap'
                  }}
                >{subcat.nombre}</button>
              ))
            }
          </div>
        )}

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
                  <p className="item-price">${producto.precio.toLocaleString('es-CO')}</p>
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
          <span className="cart-total-float">Ver Carrito - ${total.toLocaleString('es-CO')}</span>
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
                    <span>${total.toLocaleString('es-CO')}</span>
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
                          <p className="cart-item-price">${(item.precio * item.cantidad).toLocaleString('es-CO')}</p>
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
                    <span>${total.toLocaleString('es-CO')}</span>
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
