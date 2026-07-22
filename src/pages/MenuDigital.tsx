import { useEffect, useState, useRef } from 'react';
import { supabase, getTenantId } from '../lib/supabase';
import type { Producto, Categoria, Subcategoria, Configuracion } from '../types';
import { Loader2, Search, Plus, ShoppingBag, X, ChevronLeft, ChevronRight, ShoppingCart, Volume2, VolumeX } from 'lucide-react';
import { useCart, getEffectivePrice } from '../context/CartContext';
import './MenuDigital.css';

// Ejecutar sincrónicamente para evitar parpadeo de color
try {
  let tId = 'indisutex';
  const pathParts = window.location.pathname.split('/');
  if (pathParts[1] && pathParts[1] !== 'admin' && pathParts[1] !== 'superadmin' && pathParts[1] !== 'menu') {
    tId = pathParts[1].toLowerCase().replace(/-/g, '_');
  } else {
    tId = localStorage.getItem('tenant_id') || 'saramantha';
  }
  const cachedColor = localStorage.getItem(`admin_primary_color_${tId}`);
  if (cachedColor) {
    document.documentElement.style.setProperty('--primary', cachedColor);
    document.documentElement.style.setProperty('--primary-color', cachedColor);
    const hex = cachedColor.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
      }
    }
  }
} catch (e) {}

const decodeExtraImage = (str: string) => {
  if (!str) return { url: '', ref: '' };
  const [url, ref] = str.split('|REF:');
  return { url: url || '', ref: ref || '' };
};
export default function MenuDigital() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null);
  const [mayoristaBranding, setMayoristaBranding] = useState<{nombre: string, logo: string, video: string} | null>(null);
  const [cargando, setCargando] = useState(true);
  
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');
  const [filtroSubcategoria, setFiltroSubcategoria] = useState<string>('todas');

  const selectCategoria = (catSlug: string) => {
    setFiltroCategoria(catSlug);
    setFiltroSubcategoria('todas');
    const params = new URLSearchParams(window.location.search);
    if (catSlug === 'todos') {
      params.delete('categoria');
    } else {
      params.set('categoria', catSlug);
    }
    params.delete('subcategoria');
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState(null, '', newUrl);
  };

  const selectSubcategoria = (subcatSlug: string) => {
    setFiltroSubcategoria(subcatSlug);
    const params = new URLSearchParams(window.location.search);
    if (subcatSlug === 'todas') {
      params.delete('subcategoria');
    } else {
      params.set('subcategoria', subcatSlug);
    }
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState(null, '', newUrl);
  };

  const [busqueda, setBusqueda] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutMode, setIsCheckoutMode] = useState(false);
  const [overrideWhatsApp, setOverrideWhatsApp] = useState<string | null>(null);
  const [heroMuted, setHeroMuted] = useState(true);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  // Auto-unmute on first user interaction (browsers block autoplay with sound)
  useEffect(() => {
    const unmuteOnInteraction = () => {
      if (heroVideoRef.current && heroVideoRef.current.muted) {
        heroVideoRef.current.muted = false;
        setHeroMuted(false);
      }
      // Remove listeners after first interaction
      document.removeEventListener('click', unmuteOnInteraction);
      document.removeEventListener('touchstart', unmuteOnInteraction);
      document.removeEventListener('keydown', unmuteOnInteraction);
    };
    document.addEventListener('click', unmuteOnInteraction);
    document.addEventListener('touchstart', unmuteOnInteraction);
    document.addEventListener('keydown', unmuteOnInteraction);
    return () => {
      document.removeEventListener('click', unmuteOnInteraction);
      document.removeEventListener('touchstart', unmuteOnInteraction);
      document.removeEventListener('keydown', unmuteOnInteraction);
    };
  }, []);

  useEffect(() => {
    async function loadWholesalerMarkup(phone: string) {
      try {
        const tenant = getTenantId();

        // Primero buscar en asesores
        const { data: asesoresData } = await supabase
          .from('asesores')
          .select('id, telefono, porcentaje_ganancia, ajustes_productos')
          .eq('tenant_id', tenant);

        const cleanQuery = phone.replace(/\D/g, '');
        const normQuery = cleanQuery.length === 12 && cleanQuery.startsWith('57') ? cleanQuery.substring(2) : cleanQuery;

        if (asesoresData) {
          const match = asesoresData.find(a => {
            const phones = (a.telefono || '').split(',').map((p: string) => {
              const clean = p.replace(/\D/g, '');
              return clean.length === 12 && clean.startsWith('57') ? clean.substring(2) : clean;
            }).filter(Boolean);
            return phones.includes(normQuery);
          });
          if (match) {
            setMarkupPorcentaje(Number((match as any).porcentaje_ganancia) || 0);
            setAjustesProductos((match as any).ajustes_productos || {});
            return;
          }
        }

        // Si no se encontró en asesores, buscar en mayoristas (tabla independiente)
        const { data: mayoristasData } = await supabase
          .from('mayoristas')
          .select('id, telefono, porcentaje_ganancia, ajustes_productos, nombre_negocio, logo_url, video_hero_url')
          .eq('tenant_id', tenant);

        if (mayoristasData) {
          const match = mayoristasData.find(m => {
            const phones = (m.telefono || '').split(',').map((p: string) => {
              const clean = p.replace(/\D/g, '');
              return clean.length === 12 && clean.startsWith('57') ? clean.substring(2) : clean;
            }).filter(Boolean);
            return phones.includes(normQuery);
          });
          if (match) {
            setMarkupPorcentaje(Number((match as any).porcentaje_ganancia) || 0);
            setAjustesProductos((match as any).ajustes_productos || {});
            setMayoristaBranding({ 
              nombre: (match as any).nombre_negocio || '', 
              logo: (match as any).logo_url || '', 
              video: (match as any).video_hero_url || '' 
            });
            setBuyerType('detal'); // Bypass clients selection screen for mayoristas
            return;
          }
        }

        setMarkupPorcentaje(0);
        setAjustesProductos({});
        setAjustesProductos({});
      } catch (err) {
        console.error("Error loading wholesaler markup: ", err);
      }
    }


    const params = new URLSearchParams(window.location.search);
    const wsParam = params.get('ws');
    let phoneToQuery = '';
    if (wsParam) {
      if (wsParam === 'clear') {
        sessionStorage.removeItem(`ws_override_${getTenantId()}`);
        setOverrideWhatsApp(null);
        setMarkupPorcentaje(0);
      } else {
        const cleanNum = wsParam.replace(/\D/g, '');
        if (cleanNum) {
          setOverrideWhatsApp(cleanNum);
          sessionStorage.setItem(`ws_override_${getTenantId()}`, cleanNum);
          phoneToQuery = cleanNum;
        }
      }
    } else {
      const savedOverride = sessionStorage.getItem(`ws_override_${getTenantId()}`);
      if (savedOverride) {
        setOverrideWhatsApp(savedOverride);
        phoneToQuery = savedOverride;
      }
    }

    if (phoneToQuery) {
      loadWholesalerMarkup(phoneToQuery);
    }

    const catParam = params.get('categoria');
    if (catParam) {
      setFiltroCategoria(catParam);
    }
    const subcatParam = params.get('subcategoria');
    if (subcatParam) {
      setFiltroSubcategoria(subcatParam);
    }

    const tipoParam = params.get('tipo');
    if (tipoParam === 'mayorista' || tipoParam === 'detal' || tipoParam === '50_unidades') {
      setBuyerType(tipoParam);
    }
  }, []);
  
  useEffect(() => {
    if (configuracion) {
      if (configuracion.nombre_negocio) {
        document.title = configuracion.nombre_negocio;
      } else {
        document.title = 'Catálogo Digital';
      }
      
      if (configuracion.color_primario) {
        document.documentElement.style.setProperty('--primary', configuracion.color_primario);
        document.documentElement.style.setProperty('--primary-color', configuracion.color_primario);
        localStorage.setItem(`admin_primary_color_${getTenantId()}`, configuracion.color_primario);
        const hex = configuracion.color_primario.replace('#', '');
        if (hex.length === 6) {
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
        }
      }
    } else {
      document.title = 'Catálogo Digital';
    }
  }, [configuracion]);
  
  // Product Detail Popup
  const [detailProduct, setDetailProduct] = useState<Producto | null>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [selectedTalla, setSelectedTalla] = useState<string>('');
  const [selectedEstampado, setSelectedEstampado] = useState<string>('');
  const [selectedCantidad, setSelectedCantidad] = useState(1);

  const openDetail = (producto: Producto) => {
    setDetailProduct(producto);
    setCarouselIdx(0);
    setSelectedTalla('');
    setSelectedEstampado('');
    setSelectedCantidad(1);
  };

  const handleAddFromDetail = () => {
    if (!detailProduct) return;
    const tallas = detailProduct.tallas?.split(',').map(t => t.trim()).filter(Boolean) || [];
    const estampados = detailProduct.estampados?.split(',').map(e => e.trim()).filter(Boolean) || [];

    if (tallas.length > 0 && !selectedTalla) {
      alert('Por favor selecciona una talla');
      return;
    }
    if (estampados.length > 0 && !selectedEstampado) {
      alert('Por favor selecciona un estampado / temática');
      return;
    }

    addToCart(detailProduct, selectedTalla || undefined, selectedEstampado || undefined, selectedCantidad);
    setDetailProduct(null);
  };
  
  const { items, addToCart, removeFromCart, updateQuantity, total, clearCart, buyerType, setBuyerType, markupPorcentaje, setMarkupPorcentaje, ajustesProductos, setAjustesProductos } = useCart();

  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    direccion: '',
    ciudad: ''
  });
  const [leadId, setLeadId] = useState<string | null>(null);

  useEffect(() => {
    if (!formData.nombre && !formData.telefono) return;

    const delayDebounceFn = setTimeout(async () => {
      try {
        const tenant = getTenantId();
        const numeroWhatsApp = overrideWhatsApp || configuracion?.whatsapp || '573185637317';
        if (leadId) {
          await supabase
            .from('leads')
            .update({
              nombre: formData.nombre,
              telefono: formData.telefono,
              ciudad: formData.ciudad,
              estado: 'abandonado',
              linea_whatsapp: numeroWhatsApp,
              productos: items,
              total: total
            })
            .eq('id', leadId);
        } else {
          const { data, error } = await supabase
            .from('leads')
            .insert({
              nombre: formData.nombre,
              telefono: formData.telefono,
              ciudad: formData.ciudad,
              tenant_id: tenant,
              estado: 'abandonado',
              linea_whatsapp: numeroWhatsApp,
              productos: items,
              total: total
            })
            .select('id')
            .single();

          if (!error && data) {
            setLeadId(data.id);
          }
        }
      } catch (err) {
        console.error('Error saving draft lead:', err);
      }
    }, 1500); // 1.5s debounce

    return () => clearTimeout(delayDebounceFn);
  }, [formData.nombre, formData.telefono, formData.ciudad, overrideWhatsApp, configuracion, items, total, leadId]);

  useEffect(() => {
    async function cargarDatos() {
      try {
        const tenant = getTenantId();
        const [catRes, subcatRes, confRes] = await Promise.all([
          supabase.from('categorias').select('*').eq('tenant_id', tenant).order('orden', { ascending: true }),
          supabase.from('subcategorias').select('*').eq('tenant_id', tenant).order('orden', { ascending: true }),
          supabase.from('configuracion').select('*').eq('tenant_id', tenant).limit(1).single()
        ]);
        
        if (catRes.data) setCategorias(catRes.data);
        if (subcatRes.data) setSubcategorias(subcatRes.data);
        if (confRes.data) setConfiguracion(confRes.data);

        // Fetch products in chunks of 1000 to bypass Supabase defaults
        let allProducts: any[] = [];
        let from = 0;
        let to = 999;
        let hasMore = true;

        while (hasMore) {
          const { data: chunk, error: prodError } = await supabase
            .from('productos')
            .select('*')
            .eq('tenant_id', tenant)
            .order('created_at', { ascending: false })
            .range(from, to);

          if (prodError || !chunk || chunk.length === 0) {
            hasMore = false;
          } else {
            allProducts = [...allProducts, ...chunk];
            if (chunk.length < 1000) {
              hasMore = false;
            } else {
              from += 1000;
              to += 1000;
            }
          }
        }

        setProductos(allProducts);
      } catch (err) {
        console.error('Error cargando datos:', err);
      } finally {
        setCargando(false);
      }
    }
    cargarDatos();
  }, []);



  const catActual = categorias.find(c => c.slug === filtroCategoria);
  let productosFiltrados = (filtroCategoria === 'todos' 
    ? productos 
    : productos.filter(p => {
        const pCat = (p.categoria || '').toLowerCase().trim();
        return pCat === filtroCategoria.toLowerCase().trim()
          || pCat === (catActual?.nombre || '').toLowerCase().trim()
          || pCat === (catActual?.slug || '').toLowerCase().trim();
      })).filter(p => !p.oculto);

  if (filtroCategoria !== 'todos' && filtroSubcategoria !== 'todas') {
    const subcatActual = subcategorias.find(s => s.slug === filtroSubcategoria);
    productosFiltrados = productosFiltrados.filter(p => {
      const pSub = (p.subcategoria || '').toLowerCase().trim();
      return pSub === filtroSubcategoria.toLowerCase().trim()
        || pSub === (subcatActual?.nombre || '').toLowerCase().trim()
        || pSub === (subcatActual?.slug || '').toLowerCase().trim();
    });
  }

  // Ocultar productos desactivados por el mayorista/asesor
  if (ajustesProductos) {
    productosFiltrados = productosFiltrados.filter(p => {
      const productSetting = ajustesProductos[p.id];
      const isHiddenObject = productSetting && typeof productSetting === 'object' && productSetting.oculto;
      const isHiddenArray = ajustesProductos.hidden_products?.includes(p.id);
      return !isHiddenObject && !isHiddenArray;
    });
  }

  // Text search filter
  if (busqueda.trim()) {
    const q = busqueda.toLowerCase().trim();
    productosFiltrados = productosFiltrados.filter(p =>
      (p.nombre || '').toLowerCase().includes(q) ||
      (p.descripcion || '').toLowerCase().includes(q) ||
      (p.categoria || '').toLowerCase().includes(q)
    );
  }

  const totalItems = items.reduce((sum, item) => sum + item.cantidad, 0);

  const handleEnviarPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Construir el mensaje para WhatsApp
    let buyerLabel = '';
    if (buyerType === 'mayorista') buyerLabel = 'Mayorista';
    if (buyerType === 'detal') buyerLabel = 'Al detal';
    if (buyerType === '50_unidades') buyerLabel = '50+ unidades';

    let mensaje = `Hola, mi nombre es ${formData.nombre}.\n`;
    mensaje += `*Tipo de compra:* ${buyerLabel}\n`;
    mensaje += `*Teléfono:* ${formData.telefono}\n`;
    mensaje += `*Dirección:* ${formData.direccion}, ${formData.ciudad}\n\n`;
    
    mensaje += `*PRODUCTOS:*\n`;
    const mensajeProductos = items.map(item => 
      `- ${item.cantidad}x ${item.nombre} ${item.talla ? `(Talla: ${item.talla}) ` : ''}${item.estampado ? `(Estampado: ${item.estampado}) ` : ''}- $${(getEffectivePrice(item, buyerType, markupPorcentaje, ajustesProductos) * item.cantidad).toLocaleString('es-CO')}`
    ).join('\n');
    mensaje += mensajeProductos;
    
    mensaje += `\n*TOTAL:* $${total.toLocaleString('es-CO')}`;

    const numeroWhatsApp = overrideWhatsApp || configuracion?.whatsapp || '573185637317';

    let orderId = '';
    // Guardar en la base de datos de pedidos
    try {
      const { data: newOrder, error: dbErr } = await supabase.from('pedidos').insert({
        cliente_nombre: formData.nombre,
        cliente_telefono: formData.telefono,
        direccion: formData.direccion,
        ciudad: formData.ciudad,
        total: total,
        productos: items,
        linea_whatsapp: numeroWhatsApp,
        tenant_id: getTenantId()
      }).select('id').single();

      if (dbErr) {
        console.error('Error al registrar pedido en base de datos:', dbErr);
      } else if (newOrder) {
        orderId = newOrder.id;
      }

      if (leadId) {
        await supabase.from('leads').update({ estado: 'completado' }).eq('id', leadId);
        setLeadId(null);
      }
    } catch (dbErr) {
      console.error('Error al registrar pedido en base de datos:', dbErr);
    }

    if (orderId) {
      const uploadLink = `${window.location.origin}/pago/${orderId}`;
      mensaje += `\n\n*Sube el comprobante de pago en el siguiente link:* ${uploadLink}`;
    }

    let cleanWhatsApp = numeroWhatsApp.replace(/\D/g, '');
    if (cleanWhatsApp.length === 10) {
      cleanWhatsApp = '57' + cleanWhatsApp;
    }
    const url = `https://wa.me/${cleanWhatsApp}?text=${encodeURIComponent(mensaje)}`;
    
    window.open(url, '_blank');
    
    // Limpiar después de enviar
    setIsCartOpen(false);
    setIsCheckoutMode(false);
    clearCart();
    setFormData({ nombre: '', telefono: '', direccion: '', ciudad: '' });
  };

  if (buyerType === null && !cargando && configuracion?.preguntar_tipo_cliente) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: configuracion?.color_primario || '#10b981', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999, color: '#fff', padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', fontWeight: 800 }}>Bienvenido a {mayoristaBranding?.nombre || configuracion?.nombre_negocio || 'Nuestro Catálogo'}</h1>
        <p style={{ marginBottom: '2.5rem', fontSize: '1.2rem', opacity: 0.9 }}>Por favor, selecciona tu tipo de compra para mostrarte los precios correctos:</p>
        <button onClick={() => setBuyerType('detal')} style={{ padding: '1.2rem 2rem', fontSize: '1.1rem', margin: '0.6rem', width: '100%', maxWidth: '350px', backgroundColor: '#fff', color: configuracion?.color_primario || '#10b981', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', transition: 'transform 0.2s' }}>
          🛍️ Compras al detal
        </button>
        <button onClick={() => setBuyerType('mayorista')} style={{ padding: '1.2rem 2rem', fontSize: '1.1rem', margin: '0.6rem', width: '100%', maxWidth: '350px', backgroundColor: '#fff', color: configuracion?.color_primario || '#10b981', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', transition: 'transform 0.2s' }}>
          📦 Soy mayorista
        </button>
        <button onClick={() => setBuyerType('50_unidades')} style={{ padding: '1.2rem 2rem', fontSize: '1.1rem', margin: '0.6rem', width: '100%', maxWidth: '350px', backgroundColor: '#fff', color: configuracion?.color_primario || '#10b981', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', transition: 'transform 0.2s' }}>
          🏭 Compras por 50 unidades
        </button>
      </div>
    );
  }

  return (
    <div className="menu-app-container">
      <div className={`menu-app-header ${(mayoristaBranding?.video || configuracion?.video_hero_url) ? 'has-video' : ''}`} style={{ position: 'relative' }}>
        {(mayoristaBranding?.video || configuracion?.video_hero_url) && (
          (mayoristaBranding?.video || configuracion?.video_hero_url)?.match(/\.(mp4|webm|mov|ogg)$/i) ? (
          <>
            <video 
              src={mayoristaBranding?.video || configuracion?.video_hero_url} 
              autoPlay 
              loop 
              muted={heroMuted}
              playsInline 
              className="hero-background-video"
              ref={heroVideoRef}
              onCanPlay={el => { const v = (el.target as HTMLVideoElement); v.muted = heroMuted; v.play().catch(() => {}); }}
            />
            <button
              onClick={() => {
                const newMuted = !heroMuted;
                setHeroMuted(newMuted);
                if (heroVideoRef.current) {
                  heroVideoRef.current.muted = newMuted;
                  if (!newMuted) heroVideoRef.current.play().catch(() => {});
                }
              }}
              style={{
                position: 'absolute',
                bottom: '3.8rem',
                right: '0.75rem',
                zIndex: 30,
                background: 'rgba(0,0,0,0.45)',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
                color: '#fff',
                transition: 'background 0.2s'
              }}
              title={heroMuted ? 'Activar sonido' : 'Silenciar'}
            >
              {heroMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </>
          ) : (
            <img 
              src={mayoristaBranding?.video || configuracion?.video_hero_url}
              className="hero-background-video"
              alt="Hero"
              style={{ objectFit: 'cover' }}
            />
          )
        )}
        <div className="header-bottom-bar" style={{
          position: 'absolute',
          top: '4.8rem',
          transform: 'translateY(-50%)',
          width: '100%',
          padding: '0 2rem',
          boxSizing: 'border-box',
          display: 'flex',
          justifyContent: 'space-between',
          zIndex: 20,
          pointerEvents: 'none' /* so the space between doesn't block clicks */
        }}>
          {/* Enlace Especial Dropshipper en la Esquina Inferior Izquierda */}
          <a 
            href={configuracion?.link_dropshipper || (() => {
              let clean = (overrideWhatsApp || configuracion?.whatsapp || '').replace(/\D/g, '');
              if (clean.length === 10) clean = '57' + clean;
              return `https://wa.me/${clean}?text=Hola,%20soy%20dropshipper,%20me%20interesa%20trabajar%20con%20ustedes`;
            })()} 
            target="_blank" 
            rel="noopener noreferrer"
            className="special-header-btn"
            style={{ 
              background: configuracion?.color_primario || '#f36b8e', 
              color: '#ffffff', 
              padding: '0.3rem 0.75rem', 
              borderRadius: '20px', 
              fontSize: '0.82rem', 
              fontFamily: "'Bebas Neue', sans-serif",
              letterSpacing: '0.8px',
              fontWeight: 400, 
              textDecoration: 'none', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.25rem', 
              border: 'none',
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
              pointerEvents: 'auto'
            }}
          >
            🚀 ¿Dropshipper?
          </a>

          {/* Enlace Especial Ganar Dinero en la Esquina Inferior Derecha */}
          <a 
            href={configuracion?.link_ganar_dinero || (() => {
              let clean = (overrideWhatsApp || configuracion?.whatsapp || '').replace(/\D/g, '');
              if (clean.length === 10) clean = '57' + clean;
              return `https://wa.me/${clean}?text=Hola,%20quiero%20saber%20cómo%20ganar%20dinero%20con%20ustedes`;
            })()} 
            target="_blank" 
            rel="noopener noreferrer"
            className="ganar-dinero-pulse special-header-btn"
            style={{ 
              background: configuracion?.color_primario || '#f36b8e', 
              color: '#ffffff', 
              padding: '0.3rem 0.75rem', 
              borderRadius: '20px', 
              fontSize: '0.82rem', 
              fontFamily: "'Bebas Neue', sans-serif",
              letterSpacing: '0.8px',
              fontWeight: 400, 
              textDecoration: 'none', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.25rem', 
              border: 'none',
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
              pointerEvents: 'auto'
            }}
          >
            💸 ¿Ganar dinero?
          </a>
        </div>



        <div className="hero-content-overlay" style={{ paddingTop: '1.5rem' }}>
          <div className="menu-app-logo" style={{ marginTop: '-1rem' }}>
            {(mayoristaBranding?.logo || configuracion?.logo_url) ? (
              <img
                src={mayoristaBranding?.logo || configuracion?.logo_url}
                alt="Logo"
                className="store-logo-round"
              />
            ) : (
              <div className="store-logo-round store-logo-placeholder">
                <span className="logo-letter c1" style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {(mayoristaBranding?.nombre || configuracion?.nombre_negocio || 'T').substring(0, 1).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── TICKER STRIP ── */}
        <div className="hero-ticker-wrap">
          <div className="hero-ticker-track">
            {[
              '🇨🇴 Fabricación colombiana · Indisutex SAS',
              '🚚 Pago contra entrega en todo Colombia',
              '📲 Catálogo mayorista por WhatsApp',
              '💰 Margen de reventa hasta 116%',
              '📦 Pedido mínimo: 6 unidades',
              '✅ Precios mayoristas por WhatsApp',
              '🌟 Envíos a toda Colombia',
              '💎 Calidad garantizada',
            ].concat([
              '🇨🇴 Fabricación colombiana · Indisutex SAS',
              '🚚 Pago contra entrega en todo Colombia',
              '📲 Catálogo mayorista por WhatsApp',
              '💰 Margen de reventa hasta 116%',
              '📦 Pedido mínimo: 6 unidades',
              '✅ Precios mayoristas por WhatsApp',
              '🌟 Envíos a toda Colombia',
              '💎 Calidad garantizada',
            ]).map((item, i) => (
              <span key={i} className="hero-ticker-item">{item}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="menu-app-body">
        <div className="explore-header" style={{ position: 'relative' }}>
          <h2>EXPLORAR CATÁLOGO DIGITAL</h2>
          {configuracion?.preguntar_tipo_cliente && buyerType && (
            <button
              onClick={() => setBuyerType(null)}
              style={{
                position: 'absolute',
                top: '-25px',
                right: '0',
                background: 'none',
                border: 'none',
                color: configuracion?.color_primario || '#10b981',
                fontSize: '0.75rem',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: '0'
              }}
            >
              Cambiar tipo de compra ({buyerType === 'detal' ? 'Detal' : buyerType === 'mayorista' ? 'Mayorista' : '50 Unds'})
            </button>
          )}
          <button
            className="search-icon-btn"
            onClick={() => { setSearchVisible(v => !v); if (searchVisible) setBusqueda(''); }}
            aria-label="Buscar"
          >
            <Search size={18} />
          </button>
        </div>

        {/* Search bar */}
        {searchVisible && (
          <div className="search-bar-wrap">
            <Search size={16} className="search-bar-icon" />
            <input
              className="search-bar-input"
              type="text"
              autoFocus
              placeholder="Buscar producto, categoría..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button className="search-bar-clear" onClick={() => setBusqueda('')}>×</button>
            )}
          </div>
        )}

        {/* Categories Carousel */}
        <div className="categories-carousel">
          <div 
            className={`category-card ${filtroCategoria === 'todos' ? 'active' : ''}`}
            onClick={() => selectCategoria('todos')}
          >
            <div className="cat-img-placeholder" style={{backgroundColor: '#f36b8e'}}>⭐</div>
            <div className="cat-info">
              <h3>TODOS LOS PRODUCTOS</h3>
            </div>
          </div>
          
          {categorias.map(cat => (
            <div 
              key={cat.id}
              className={`category-card ${filtroCategoria === cat.slug ? 'active' : ''}`}
              onClick={() => selectCategoria(cat.slug)}
            >
              {cat.imagen_url ? (
                <img
                  src={cat.imagen_url}
                  alt={cat.nombre}
                  className="cat-img-placeholder"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div className="cat-img-placeholder" style={{backgroundColor: cat.color || '#eee'}}>{cat.icono}</div>
              )}
              <div className="cat-info">
                <h3>{cat.nombre.toUpperCase()}</h3>
              </div>
            </div>
          ))}
        </div>

        {/* Subcategories Filter Chips */}
        {filtroCategoria !== 'todos' && subcategorias.filter(s => s.categoria_id === categorias.find(c => c.slug === filtroCategoria)?.id).length > 0 && (
          <div style={{display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem', paddingLeft: '0.5rem'}}>
            <button 
              onClick={() => selectSubcategoria('todas')}
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
                  onClick={() => selectSubcategoria(subcat.slug)}
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
              <div key={producto.id} className="menu-list-item" onClick={() => openDetail(producto)} style={{cursor:'pointer'}}>
                <div className="item-img">
                  {producto.video_url ? (
                    <video 
                      src={producto.video_url} 
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      style={{width: '100%', height: '100%', objectFit: 'cover'}}
                      ref={el => { if (el) el.play().catch(() => {}); }}
                    />
                  ) : producto.imagen_url ? (
                    <img src={producto.imagen_url} alt={producto.nombre} />
                  ) : (producto.imagenes_extra && producto.imagenes_extra.length > 0 && decodeExtraImage(producto.imagenes_extra[0]).url) ? (
                    <img src={decodeExtraImage(producto.imagenes_extra[0]).url} alt={producto.nombre} />
                  ) : (
                    <div className="img-placeholder"></div>
                  )}
                  <div className="sku-badge">Ref: {producto.nombre}</div>
                  
                  <button 
                    className="item-add-btn" 
                    onClick={e => { e.stopPropagation(); openDetail(producto); }}
                    aria-label="Añadir al carrito"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="item-details">
                  <h4>{producto.nombre}</h4>
                  <p className="item-price">${getEffectivePrice(producto, buyerType, markupPorcentaje, ajustesProductos).toLocaleString('es-CO')}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Floating Cart Button */}
      {totalItems > 0 && !isCartOpen && (
        <button className="floating-cart-btn" onClick={() => setIsCartOpen(true)}>
          <div className="cart-icon-wrapper">
            <ShoppingBag size={22} />
            <span className="cart-badge">{totalItems}</span>
            <span>Ver Carrito</span>
          </div>
          <span className="cart-total-float">${total.toLocaleString('es-CO')}</span>
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

            {/* Shrine Free Shipping Progress Bar */}
            {items.length > 0 && (
              <div className="shrine-shipping-bar" style={{ padding: '0.75rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {(() => {
                  const limit = 150000; // $150.000 COP
                  const diff = limit - total;
                  const pct = Math.min(100, (total / limit) * 100);
                  return (
                    <div>
                      <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {diff > 0 ? (
                          <>
                            <span>Te faltan <strong style={{ color: '#0ea5e9' }}>${diff.toLocaleString('es-CO')}</strong> para envío gratis</span>
                            <span>🚚</span>
                          </>
                        ) : (
                          <>
                            <span style={{ color: '#10b981' }}>🎉 ¡Felicidades! Tienes Envío Gratis</span>
                            <span>🚚</span>
                          </>
                        )}
                      </p>
                      <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#10b981' : '#0ea5e9', transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            
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
                    placeholder="Ej. 3001234567"
                  />
                </div>
                <div className="form-group">
                  <label>Ciudad</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.ciudad}
                    onChange={e => setFormData({...formData, ciudad: e.target.value})}
                    placeholder="Ej. Cali, Bogotá, Medellín..."
                  />
                </div>
                <div className="form-group">
                  <label>Dirección exacta (Barrio, Calle, Casa/Apto)</label>
                  <textarea 
                    required 
                    rows={3}
                    value={formData.direccion}
                    onChange={e => setFormData({...formData, direccion: e.target.value})}
                    placeholder="Barrio, Calle #, Casa o Apto, referencias..."
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
                      <div key={`${item.id}-${item.talla || 'none'}-${item.estampado || 'none'}`} className="cart-item">
                        <div className="cart-item-img">
                          {item.imagen_url ? (
                            <img src={item.imagen_url} alt={item.nombre} />
                          ) : (item.imagenes_extra && item.imagenes_extra.length > 0 && decodeExtraImage(item.imagenes_extra[0]).url) ? (
                            <img src={decodeExtraImage(item.imagenes_extra[0]).url} alt={item.nombre} />
                          ) : (
                            <div className="img-placeholder-small"></div>
                          )}
                        </div>
                        <div className="cart-item-details">
                          <h4>{item.nombre}</h4>
                          {item.talla && <p style={{fontSize: '0.8rem', color: '#666', margin: '2px 0'}}>Talla: {item.talla}</p>}
                          {item.estampado && <p style={{fontSize: '0.8rem', color: '#666', margin: '2px 0'}}>Estampado: {item.estampado}</p>}
                          <p className="cart-item-price">${(getEffectivePrice(item, buyerType, markupPorcentaje, ajustesProductos) * item.cantidad).toLocaleString('es-CO')}</p>
                          <div className="cart-item-qty">
                            <button onClick={() => updateQuantity(item.id, item.cantidad - 1, item.talla, item.estampado)}>-</button>
                            <span>{item.cantidad}</span>
                            <button onClick={() => updateQuantity(item.id, item.cantidad + 1, item.talla, item.estampado)}>+</button>
                          </div>
                        </div>
                        <button className="cart-item-remove" onClick={() => removeFromCart(item.id, item.talla, item.estampado)}>
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


      {/* ── PRODUCT DETAIL POPUP ── */}
      {detailProduct && (() => {
        const allImages = [
          ...(detailProduct.imagen_url ? [{ url: detailProduct.imagen_url, ref: '' }] : []),
          ...(detailProduct.imagenes_extra || []).map(u => decodeExtraImage(u)).filter(i => i.url)
        ];
        const tallas = detailProduct.tallas?.split(',').map(t => t.trim()).filter(Boolean) || [];
        const safeIdx = Math.min(carouselIdx, allImages.length - 1);
        const currentImgRef = allImages[safeIdx]?.ref;
        return (
          <div className="detail-overlay" onClick={() => setDetailProduct(null)}>
            <div className="detail-modal" onClick={e => e.stopPropagation()}>
              {/* Close button */}
              <button className="detail-close" onClick={() => setDetailProduct(null)}><X size={20} /></button>

              {/* ── CAROUSEL ── */}
              <div className="detail-carousel">
                {detailProduct.video_url ? (
                  <video src={detailProduct.video_url} autoPlay loop muted playsInline className="detail-carousel-img" ref={el => { if (el) el.play().catch(() => {}); }} />
                ) : allImages.length > 0 ? (
                  <img src={allImages[safeIdx].url} alt={detailProduct.nombre} className="detail-carousel-img" />
                ) : (
                  <div className="detail-carousel-placeholder" />
                )}
                <div className="sku-badge" style={{ fontSize: '0.6rem', padding: '0.15rem 0.4rem', left: '0.5rem', right: 'auto' }}>
                  Ref: {detailProduct.nombre}
                </div>
                {currentImgRef && (
                  <div className="sku-badge" style={{ fontSize: '0.6rem', padding: '0.15rem 0.4rem', left: '0.5rem', top: '2rem', right: 'auto', background: 'rgba(14, 165, 233, 0.9)' }}>
                    Estampado: {currentImgRef}
                  </div>
                )}

                {allImages.length > 1 && (
                  <>
                    <button className="carousel-btn carousel-btn-left" onClick={() => setCarouselIdx(i => (i - 1 + allImages.length) % allImages.length)}>
                      <ChevronLeft size={20} />
                    </button>
                    <button className="carousel-btn carousel-btn-right" onClick={() => setCarouselIdx(i => (i + 1) % allImages.length)}>
                      <ChevronRight size={20} />
                    </button>
                    <div className="carousel-dots">
                      {allImages.map((_, i) => (
                        <button key={i} className={`carousel-dot${i === safeIdx ? ' active' : ''}`} onClick={() => setCarouselIdx(i)} />
                      ))}
                    </div>
                  </>
                )}
              </div>




              {/* ── INFO ── */}
              <div className="detail-info">
                <div className="detail-header-row">
                  <h3 className="detail-name">{detailProduct.nombre}</h3>
                  <p className="detail-price">${getEffectivePrice(detailProduct, buyerType, markupPorcentaje, ajustesProductos).toLocaleString('es-CO')}</p>
                </div>
                {detailProduct.descripcion && (
                  <p className="detail-desc">{detailProduct.descripcion}</p>
                )}

                {/* ── ESTAMPADOS + TALLAS + CANTIDAD ── */}
                <div className="detail-controls-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', alignItems: 'stretch' }}>
                  {(() => {
                    const imageEstampados = (detailProduct.imagenes_extra || []).map(u => decodeExtraImage(u).ref?.trim().toUpperCase()).filter(Boolean);
                    const legacyEstampados = detailProduct.estampados?.split(',').map(e => e.trim().toUpperCase()).filter(Boolean) || [];
                    
                    let estampados = Array.from(new Set(imageEstampados));
                    if (estampados.length === 0) {
                      estampados = Array.from(new Set(legacyEstampados));
                    }
                    
                    if (estampados.length === 0) return null;
                    return (
                      <div className="detail-tallas" style={{ width: '100%' }}>
                        <p className="detail-section-label" style={{ marginBottom: '0.4rem' }}>Estampado / Temática</p>
                        <select
                          value={selectedEstampado || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedEstampado(val);
                            const imgIdx = allImages.findIndex(img => img.ref?.toUpperCase() === val);
                            if (imgIdx !== -1) {
                              setCarouselIdx(imgIdx);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '0.8rem',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.95rem',
                            color: '#334155',
                            background: 'white',
                            outline: 'none',
                            appearance: 'none',
                            backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23475569%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 0.8rem top 50%',
                            backgroundSize: '0.65rem auto',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                          }}
                        >
                          <option value="" disabled>Seleccione una opción...</option>
                          {estampados.map(est => (
                            <option key={est} value={est}>{est}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}

                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    {tallas.length > 0 && (
                      <div className="detail-tallas" style={{ flex: 1 }}>
                        <p className="detail-section-label">Talla</p>
                        <div className="tallas-grid">
                          {tallas.map(t => (
                            <button
                              key={t}
                              className={`talla-chip${selectedTalla === t ? ' active' : ''}`}
                              onClick={() => setSelectedTalla(t)}
                            >{t}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="detail-cantidad" style={{ flexGrow: 0, minWidth: '110px' }}>
                      <p className="detail-section-label">Cantidad</p>
                      <div className="cantidad-control">
                        <button className="qty-btn" onClick={() => setSelectedCantidad(q => Math.max(1, q - 1))}>−</button>
                        <span className="qty-value">{selectedCantidad}</span>
                        <button className="qty-btn" onClick={() => setSelectedCantidad(q => q + 1)}>+</button>
                      </div>
                    </div>
                  </div>
                </div>


                {/* Scarcity & Trust Badges (Shrine inspired) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: '0.85rem 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '0.4rem 0.6rem', borderRadius: '8px', fontSize: '0.74rem', fontWeight: 700 }}>
                    <span>🔥</span>
                    <span>Quedan muy pocas unidades de esta referencia</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f0fdf4', border: '1px solid #dcfce7', color: '#166534', padding: '0.4rem 0.6rem', borderRadius: '8px', fontSize: '0.74rem', fontWeight: 600 }}>
                    <span>🛡️</span>
                    <span>Compra protegida y despachada por WhatsApp</span>
                  </div>
                </div>

                {/* ── ADD TO CART ── */}
                <button className="detail-add-btn" onClick={handleAddFromDetail}>
                  <ShoppingCart size={18} />
                  Añadir al carrito • ${(getEffectivePrice(detailProduct, buyerType, markupPorcentaje, ajustesProductos) * selectedCantidad).toLocaleString('es-CO')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
