import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase, getTenantId } from '../lib/supabase';
import { updatePWAManifestAndIcons } from '../lib/pwa';
import type { Producto, Categoria, Subcategoria, Configuracion } from '../types';
import { Loader2, Search, Plus, ShoppingBag, X, ShoppingCart, Volume2, VolumeX, Package, HelpCircle, RefreshCw } from 'lucide-react';
import { useCart, getEffectivePrice } from '../context/CartContext';
import PqrsModal from '../components/PqrsModal';
import { getOptimizedImageUrl } from '../lib/imageOptimizer';
import { NochePerfectaGameModal, PromoWelcomeBanner as TemuWelcomeBanner } from '../components/NochePerfectaGameModal';
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
  if (!str) return { url: '', ref: '', estampado: '' };
  let url = str, estampado = '', ref = '';
  if (str.includes('|EST:')) {
    const parts = str.split('|EST:');
    url = parts[0];
    const rest = parts[1] || '';
    if (rest.includes('|REF:')) {
      const sub = rest.split('|REF:');
      estampado = sub[0] || '';
      ref = sub[1] || '';
    } else {
      estampado = rest;
    }
  } else if (str.includes('|REF:')) {
    const parts = str.split('|REF:');
    url = parts[0];
    estampado = parts[1] || ''; // old format: ref field holds estampado name
  }
  return { url: url || '', ref: ref || '', estampado: estampado || '' };
};

const isMediaVideo = (url?: string): boolean => {
  if (!url) return false;
  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
  return (
    /\.(mp4|webm|mov|ogg|m4v|3gp)$/i.test(cleanUrl) ||
    cleanUrl.includes('video') ||
    cleanUrl.includes('mp4')
  );
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
  const [isPqrsOpen, setIsPqrsOpen] = useState(false);
  const [isCheckoutMode, setIsCheckoutMode] = useState(false);
  const [overrideWhatsApp, setOverrideWhatsApp] = useState<string | null>(null);
  const [heroMuted, setHeroMuted] = useState(true);
  const [showTipoModal, setShowTipoModal] = useState(false);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [showTemuBanner, setShowTemuBanner] = useState(false);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    async function loadWholesalerMarkup(phone: string) {
      try {
        const tenant = getTenantId();

        // Primero buscar en asesores
        const { data: asesoresData } = await supabase
          .from('asesores')
          .select('id, nombre, telefono, porcentaje_ganancia, ajustes_productos, foto_url')
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
            if ((match as any).foto_url || (match as any).nombre) {
              setMayoristaBranding({
                nombre: (match as any).nombre || '',
                logo: (match as any).foto_url || '',
                video: ''
              });
            }
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
    const tenant = getTenantId();
    const storeName = mayoristaBranding?.nombre || configuracion?.nombre_negocio || (tenant ? tenant.charAt(0).toUpperCase() + tenant.slice(1) : 'Catálogo Digital');
    const storeLogo = mayoristaBranding?.logo || configuracion?.logo_url;

    document.title = storeName;

    // Actualizar URL en la barra de navegación para incluir el slug permanente del tenant
    if (window.location.pathname === '/' || window.location.pathname === '/menu') {
      window.history.replaceState(null, '', `/${tenant}${window.location.search}${window.location.hash}`);
    }

    updatePWAManifestAndIcons(storeLogo, storeName, configuracion?.color_primario);

    if (configuracion?.color_primario) {
      document.documentElement.style.setProperty('--primary', configuracion.color_primario);
      document.documentElement.style.setProperty('--primary-color', configuracion.color_primario);
      localStorage.setItem(`admin_primary_color_${tenant}`, configuracion.color_primario);
      const hex = configuracion.color_primario.replace('#', '');
      if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
      }
    }

    // Dynamic Analytics & Pixel Tracking
    try {
      const masterTracking = JSON.parse(localStorage.getItem('master_tracking_config') || '{}');
      const clarityId = configuracion?.clarity_project_id || masterTracking.clarity_project_id || 'qawomw67u5';
      const gaId = configuracion?.google_analytics_id || masterTracking.google_analytics_id;
      const pixelId = configuracion?.meta_pixel_id || masterTracking.meta_pixel_id;

      if (clarityId && typeof window !== 'undefined' && !(window as any).clarity) {
        (function(c: any, l: any, a: any, r: any, i: any, t?: any, y?: any) {
          c[a] = c[a] || function() { (c[a].q = c[a].q || []).push(arguments); };
          t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
          y = l.getElementsByTagName(r)[0]; if (y && y.parentNode) y.parentNode.insertBefore(t, y);
        })(window, document, "clarity", "script", clarityId);
      }
      if (gaId && typeof window !== 'undefined' && !document.getElementById('ga-gtag-script')) {
        const gaScript = document.createElement('script');
        gaScript.id = 'ga-gtag-script';
        gaScript.async = true;
        gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
        document.head.appendChild(gaScript);
        (window as any).dataLayer = (window as any).dataLayer || [];
        function gtag(...args: any[]) { ((window as any).dataLayer).push(args); }
        gtag('js', new Date());
        gtag('config', gaId);
      }
      if (pixelId && typeof window !== 'undefined' && !(window as any).fbq) {
        (function(f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
          if (f.fbq) return; n = f.fbq = function() {
            n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
          };
          if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
          n.queue = []; t = b.createElement(e); t.async = !0;
          t.src = v; s = b.getElementsByTagName(e)[0];
          if (s && s.parentNode) s.parentNode.insertBefore(t, s);
        })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
        (window as any).fbq('init', pixelId);
        (window as any).fbq('track', 'PageView');
      }
    } catch (e) {}
  }, [configuracion, mayoristaBranding]);
  
  // Product Detail Popup
  const [detailProduct, setDetailProduct] = useState<Producto | null>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [selectedTalla, setSelectedTalla] = useState<string>('');
  const [selectedEstampado, setSelectedEstampado] = useState<string>('');
  const [selectedCantidad, setSelectedCantidad] = useState(1);
  const [selectedMiembroFamilia, setSelectedMiembroFamilia] = useState<'nino' | 'hombre' | 'mujer' | ''>('');

  // Prevenir scroll del body cuando algún modal está abierto
  useEffect(() => {
    if (isCartOpen || isPqrsOpen || !!detailProduct) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isCartOpen, isPqrsOpen, detailProduct]);

  useEffect(() => {
    if (detailProduct) {
      // Use imagenes_extra as the single source of truth for the carousel.
      // imagen_url is stored as the first item in imagenes_extra after saving.
      const rawAllImages = (detailProduct.imagenes_extra || []).map(u => decodeExtraImage(u)).filter(i => i.url);
      // Fallback: if no imagenes_extra, use imagen_url alone
      const allImages = rawAllImages.length > 0
        ? rawAllImages
        : (detailProduct.imagen_url ? [{ url: detailProduct.imagen_url, ref: '', estampado: '' }] : []);
      const safeIdx = Math.min(carouselIdx, Math.max(0, allImages.length - 1));
      const currentImage = allImages[safeIdx];
      const estName = (currentImage?.estampado || currentImage?.ref)?.trim().toUpperCase();
      if (estName) {
        setSelectedEstampado(estName);
      }
    }
  }, [carouselIdx, detailProduct]);

  const openDetail = (producto: Producto) => {
    setDetailProduct(producto);
    setCarouselIdx(0);
    setSelectedTalla('');
    setSelectedEstampado('');
    setSelectedCantidad(1);
    if (producto.es_producto_familiar && producto.precios_familia) {
      if (producto.precios_familia.nino) setSelectedMiembroFamilia('nino');
      else if (producto.precios_familia.hombre) setSelectedMiembroFamilia('hombre');
      else if (producto.precios_familia.mujer) setSelectedMiembroFamilia('mujer');
      else setSelectedMiembroFamilia('');
    } else {
      setSelectedMiembroFamilia('');
    }
  };

  const getActiveUnitPrice = (prod: Producto, miembro?: 'nino' | 'hombre' | 'mujer' | '') => {
    if (prod.es_producto_familiar && prod.precios_familia && miembro) {
      const famPrice = prod.precios_familia[miembro];
      if (famPrice && famPrice > 0) return famPrice;
    }
    return prod.precio;
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
      alert('Por favor selecciona un estampado');
      return;
    }
    if (detailProduct.es_producto_familiar && !selectedMiembroFamilia) {
      alert('Por favor selecciona la opción de la familia (Niño, Hombre o Mujer)');
      return;
    }

    const unitPrice = getActiveUnitPrice(detailProduct, selectedMiembroFamilia);
    const miembroLabel = selectedMiembroFamilia === 'nino' ? 'Niño/a' : selectedMiembroFamilia === 'hombre' ? 'Hombre' : selectedMiembroFamilia === 'mujer' ? 'Mujer' : '';

    const productToAdd = {
      ...detailProduct,
      precio: unitPrice,
      nombre: miembroLabel ? `${detailProduct.nombre} (${miembroLabel})` : detailProduct.nombre
    };

    addToCart(productToAdd, selectedTalla, selectedEstampado, selectedCantidad);
    setDetailProduct(null);
  };


  
  const { 
    items, addToCart, removeFromCart, updateQuantity, total, clearCart, 
    buyerType, setBuyerType, markupPorcentaje, setMarkupPorcentaje, 
    ajustesProductos, setAjustesProductos, descuentoPromocional, setDescuentoPromocional,
    setIsBulkDiscountEnabled, totalUnits, isBulkDiscountApplied, effectiveCartBuyerType 
  } = useCart();

  useEffect(() => {
    setDescuentoPromocional(configuracion?.descuento_promocional || 0);
    if (configuracion) {
      setIsBulkDiscountEnabled(configuracion.descuento_mayor_carrito_activo ?? true);
    }
  }, [configuracion, setDescuentoPromocional, setIsBulkDiscountEnabled]);

  useEffect(() => {
    try {
      const tenant = getTenantId();
      const hasWon = localStorage.getItem(`noche_perfecta_coupon_won_${tenant}`);
      const dismissed = sessionStorage.getItem(`temu_banner_dismissed_${tenant}`);
      if (!hasWon && !dismissed) {
        const timer = setTimeout(() => {
          setShowTemuBanner(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    } catch (e) {}
  }, []);

  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    direccion: '',
    ciudad: ''
  });
  const [leadId, setLeadId] = useState<string | null>(null);

  const leadIdRef = useRef<string | null>(null);
  const isInsertingRef = useRef(false);

  useEffect(() => {
    // Solo guardar el abandonado si llenó todos los datos
    if (!formData.nombre || !formData.telefono || !formData.direccion || !formData.ciudad) return;

    const delayDebounceFn = setTimeout(async () => {
      try {
        const tenant = getTenantId();
        const numeroWhatsApp = overrideWhatsApp || configuracion?.whatsapp || '573185637317';
        
        const currentLeadId = leadIdRef.current || leadId;

        if (currentLeadId) {
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
            .eq('id', currentLeadId);
        } else {
          if (isInsertingRef.current) return;
          isInsertingRef.current = true;
          
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
            leadIdRef.current = data.id;
          }
          isInsertingRef.current = false;
        }
      } catch (err) {
        console.error('Error saving draft lead:', err);
        isInsertingRef.current = false;
      }
    }, 1500); // 1.5s debounce

    return () => clearTimeout(delayDebounceFn);
  }, [formData.nombre, formData.telefono, formData.direccion, formData.ciudad, overrideWhatsApp, configuracion, items, total, leadId]);

  useEffect(() => {
    async function cargarDatos() {
      try {
        const tenant = getTenantId();
        const [catRes, subcatRes, confRes] = await Promise.all([
          supabase.from('categorias').select('*').eq('tenant_id', tenant).order('orden', { ascending: true }),
          supabase.from('subcategorias').select('*').eq('tenant_id', tenant).order('orden', { ascending: true }),
          supabase.from('configuracion').select('*').eq('tenant_id', tenant)
        ]);
        
        if (catRes.data) setCategorias(catRes.data);
        if (subcatRes.data) setSubcategorias(subcatRes.data);
        if (confRes.data && confRes.data.length > 0) {
          const bestConfig = confRes.data.find(c => c.logo_url || c.video_hero_url) || confRes.data[0];
          setConfiguracion(bestConfig);
        }

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

  // Text search filter (diacritics-insensitive and searches references)
  if (busqueda.trim()) {
    const cleanStr = (str: string) => 
      (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const q = cleanStr(busqueda);
    productosFiltrados = productosFiltrados.filter(p =>
      cleanStr(p.nombre || '').includes(q) ||
      cleanStr(p.descripcion || '').includes(q) ||
      cleanStr(p.categoria || '').includes(q) ||
      cleanStr(p.referencia || '').includes(q)
    );
  }

  const totalItems = items.reduce((sum, item) => sum + item.cantidad, 0);

  const recommendedProducts = useMemo(() => {
    if (items.length === 0) return [];
    const inCartIds = items.map(i => i.id);
    const available = productos.filter(p => !inCartIds.includes(p.id) && !p.oculto);
    return available.slice(0, 2);
  }, [productos, items]);

  const handleEnviarPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Construir el mensaje para WhatsApp
    let buyerLabel = '';
    if (buyerType === 'mayorista') buyerLabel = 'Mayorista';
    if (buyerType === 'detal' || buyerType === null) buyerLabel = isBulkDiscountApplied ? 'Al detal (Con descuento por mayor aplicable)' : 'Al detal';
    if (buyerType === '50_unidades') buyerLabel = '50+ unidades';

    let mensaje = `Hola, mi nombre es ${formData.nombre}.\n`;
    mensaje += `*Tipo de compra:* ${buyerLabel}\n`;
    if (isBulkDiscountApplied) {
      mensaje += `🎁 *¡Descuento al Por Mayor Aplicado!* (Llevas 6 o más productos)\n`;
    }
    mensaje += `*Teléfono:* ${formData.telefono}\n`;
    mensaje += `*Dirección:* ${formData.direccion}, ${formData.ciudad}\n\n`;
    
    mensaje += `*PRODUCTOS:*\n`;
    const mensajeProductos = items.map(item => 
      `- ${item.cantidad}x ${item.nombre} ${item.talla ? `(Talla: ${item.talla}) ` : ''}${item.estampado ? `(Estampado: ${item.estampado}) ` : ''}- $${(getEffectivePrice(item, effectiveCartBuyerType, markupPorcentaje, ajustesProductos, descuentoPromocional) * item.cantidad).toLocaleString('es-CO')}`
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

    let metodosStr = '';
    if (configuracion?.metodos_pago) {
      try {
        const parsed = JSON.parse(configuracion.metodos_pago);
        if (Array.isArray(parsed) && parsed.length > 0) {
          metodosStr = `\n💳 *Métodos de pago:*\n` + parsed.map((m: any) => `- ${m.banco} ${m.tipo ? `(${m.tipo})` : ''}: ${m.numero}`).join('\n') + `\n`;
        } else if (typeof configuracion.metodos_pago === 'string' && configuracion.metodos_pago.trim() !== '') {
          metodosStr = `\n💳 *Métodos de pago:*\n${configuracion.metodos_pago}\n`;
        }
      } catch {
        if (typeof configuracion.metodos_pago === 'string' && configuracion.metodos_pago.trim() !== '') {
          metodosStr = `\n💳 *Métodos de pago:*\n${configuracion.metodos_pago}\n`;
        }
      }
    }

    if (metodosStr) {
      mensaje += metodosStr;
    }

    if (orderId) {
      const uploadLink = `${window.location.origin}/pago/${orderId}`;
      mensaje += `\n*Sube el comprobante de pago en el siguiente link:* ${uploadLink}`;
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

  return (
    <div className="menu-app-container">
      <div className={`menu-app-header ${isMediaVideo(mayoristaBranding?.video || configuracion?.video_hero_url) ? 'has-video' : ''}`} style={{ position: 'relative' }}>
        {(mayoristaBranding?.video || configuracion?.video_hero_url) && (
          isMediaVideo(mayoristaBranding?.video || configuracion?.video_hero_url) ? (
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
          ) : (
            <img 
              src={getOptimizedImageUrl(mayoristaBranding?.video || configuracion?.video_hero_url, 1000, 80)}
              className="hero-background-video"
              alt="Hero"
              style={{ objectFit: 'cover' }}
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          )
        )}

        {/* Controles Flotantes Derecha: Juego + Tipo de Compra + Sonido */}
        <div className="hero-right-controls">
          <button
            onClick={() => setIsGameModalOpen(true)}
            className="hero-tipo-compra-pill"
            style={{ 
              background: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)', 
              boxShadow: '0 4px 15px rgba(217, 70, 239, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.85)'
            }}
            title="¡Juega La Noche Perfecta y gana 30% de descuento!"
          >
            <span style={{ fontSize: '0.85rem' }}>😴</span>
            <span className="hero-tipo-label" style={{ color: '#ffffff', fontWeight: 900 }}>Pijama Gratis</span>
          </button>

          <button
            onClick={() => setShowTipoModal(true)}
            className="hero-tipo-compra-pill"
            style={{ background: configuracion?.color_primario || 'var(--primary, #0ea5e9)' }}
            title="Cambiar tipo de compra"
          >
            <RefreshCw size={11} className="hero-tipo-icon" />
            <span className="hero-tipo-label">Tipo:</span>
            <span className="hero-tipo-badge">
              {buyerType === 'mayorista' ? 'Mayorista' : buyerType === '50_unidades' ? '50+ Unid' : 'Detal'}
            </span>
            <span className="hero-tipo-cambiar">Cambiar</span>
          </button>

          {isMediaVideo(mayoristaBranding?.video || configuracion?.video_hero_url) && (
            <button
              onClick={() => {
                const newMuted = !heroMuted;
                setHeroMuted(newMuted);
                if (heroVideoRef.current) {
                  heroVideoRef.current.muted = newMuted;
                  if (!newMuted) heroVideoRef.current.play().catch(() => {});
                }
              }}
              className="hero-sound-btn"
              title={heroMuted ? 'Activar sonido' : 'Silenciar'}
            >
              {heroMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          )}
        </div>

        {/* Botón Flotante Info & PQRS / Ubicación */}
        <button
          onClick={() => setIsPqrsOpen(true)}
          className="hero-pqrs-btn"
          style={{ background: configuracion?.color_primario || 'var(--primary, #0284c7)' }}
          title="Ubicación del Negocio, Teléfono, Correo e Info & PQRS"
        >
          <HelpCircle size={16} className="hero-pqrs-icon" />
          <span className="hero-pqrs-text">Info & PQRS</span>
        </button>
        {/* ── HERO TOP HEADER ROW ── */}
        <div className="header-bottom-bar" style={{
          position: 'absolute',
          top: '0.85rem',
          left: 0,
          width: '100%',
          padding: '0 0.5rem',
          boxSizing: 'border-box',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 25,
          pointerEvents: 'none'
        }}>
          {/* Top Left: Dropshipper Button */}
          {(ajustesProductos?.botones_extra?.dropshipper_enabled ?? true) ? (
            <a 
              href={ajustesProductos?.botones_extra?.dropshipper_link || configuracion?.link_dropshipper || (() => {
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
                padding: '0.25rem 0.55rem', 
                borderRadius: '20px', 
                fontSize: '0.74rem', 
                fontFamily: "'Bebas Neue', sans-serif",
                letterSpacing: '0.5px',
                fontWeight: 400, 
                textDecoration: 'none', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.2rem', 
                border: 'none',
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.35)',
                pointerEvents: 'auto',
                whiteSpace: 'nowrap'
              }}
            >
              {ajustesProductos?.botones_extra?.dropshipper_text || '🚀 ¿Dropshipper?'}
            </a>
          ) : <div />}

          {/* Top Center: Logo del Negocio */}
          <div className="menu-app-logo" style={{ pointerEvents: 'auto', margin: '0 0.2rem' }}>
            {(mayoristaBranding?.logo || configuracion?.logo_url) ? (
              <img
                src={getOptimizedImageUrl(mayoristaBranding?.logo || configuracion?.logo_url, 160, 85)}
                alt="Logo"
                className="store-logo-round"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            ) : (
              <div className="store-logo-round store-logo-placeholder">
                <span className="logo-letter c1" style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  {(mayoristaBranding?.nombre || configuracion?.nombre_negocio || 'T').substring(0, 1).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Top Right: Ganar Dinero Button */}
          {(ajustesProductos?.botones_extra?.earn_money_enabled ?? true) ? (
            <a 
              href={ajustesProductos?.botones_extra?.earn_money_link || configuracion?.link_ganar_dinero || (() => {
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
                padding: '0.25rem 0.55rem', 
                borderRadius: '20px', 
                fontSize: '0.74rem', 
                fontFamily: "'Bebas Neue', sans-serif",
                letterSpacing: '0.5px',
                fontWeight: 400, 
                textDecoration: 'none', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.2rem', 
                border: 'none',
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.35)',
                pointerEvents: 'auto',
                whiteSpace: 'nowrap'
              }}
            >
              {ajustesProductos?.botones_extra?.earn_money_text || '💸 Ganar Dinero'}
            </a>
          ) : <div />}
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
        <div className="explore-header">
          <h2>EXPLORAR CATÁLOGO DIGITAL</h2>
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
            productosFiltrados.map((producto, idx) => (
              <div key={producto.id} className="menu-list-item" onClick={() => openDetail(producto)} style={{cursor:'pointer'}}>
                <div className="item-img">
                  {producto.video_url ? (
                    <video 
                      src={producto.video_url} 
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      preload="metadata"
                      style={{width: '100%', height: '100%', objectFit: 'cover'}}
                      ref={el => { if (el && el.paused) el.play().catch(() => {}); }}
                    />
                  ) : producto.imagen_url ? (
                    <img
                      src={getOptimizedImageUrl(producto.imagen_url, 500, 75)}
                      alt={producto.nombre}
                      loading={idx < 4 ? "eager" : "lazy"}
                      fetchPriority={idx < 4 ? "high" : "auto"}
                      decoding="async"
                    />
                  ) : (producto.imagenes_extra && producto.imagenes_extra.length > 0 && decodeExtraImage(producto.imagenes_extra[0]).url) ? (
                    <img
                      src={getOptimizedImageUrl(decodeExtraImage(producto.imagenes_extra[0]).url, 500, 75)}
                      alt={producto.nombre}
                      loading={idx < 4 ? "eager" : "lazy"}
                      fetchPriority={idx < 4 ? "high" : "auto"}
                      decoding="async"
                    />
                  ) : (
                    <div className="img-placeholder"></div>
                  )}
                  {producto.es_producto_familiar && (
                    <div className="sku-badge" style={{ top: '0.5rem', background: '#0284c7' }}>👨‍👩‍👧‍👦 Opción Familiar</div>
                  )}
                  
                  <button 
                    className="item-add-btn" 
                    style={{ background: configuracion?.color_primario || 'var(--primary)' }}
                    onClick={e => { e.stopPropagation(); openDetail(producto); }}
                    aria-label="Añadir al carrito"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="item-details">
                  <h4>{producto.nombre}</h4>
                  <p className="item-price">
                    {producto.es_producto_familiar ? (
                      <span style={{ color: '#0284c7', fontWeight: 800 }}>Desde ${getEffectivePrice(producto, buyerType, markupPorcentaje, ajustesProductos, descuentoPromocional).toLocaleString('es-CO')}</span>
                    ) : ((producto.descuento !== undefined && producto.descuento > 0) || descuentoPromocional > 0) ? (
                      <>
                        <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '0.82em', marginRight: '0.4rem', fontWeight: 500 }}>
                          ${getEffectivePrice(producto, buyerType, markupPorcentaje, ajustesProductos, 0, true).toLocaleString('es-CO')}
                        </span>
                        ${getEffectivePrice(producto, buyerType, markupPorcentaje, ajustesProductos, descuentoPromocional).toLocaleString('es-CO')}
                      </>
                    ) : (
                      `$${getEffectivePrice(producto, buyerType, markupPorcentaje, ajustesProductos).toLocaleString('es-CO')}`
                    )}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* PQRS Modal */}
      {isPqrsOpen && <PqrsModal onClose={() => setIsPqrsOpen(false)} configuracion={configuracion} />}

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

            {/* Wholesale Discount 6-Product Progress Bar */}
            {items.length > 0 && (configuracion?.descuento_mayor_carrito_activo ?? true) && (buyerType === 'detal' || buyerType === null) && (
              <div className="shrine-shipping-bar" style={{ padding: '0.45rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {(() => {
                  const remaining = Math.max(0, 6 - totalUnits);
                  const pct = Math.min(100, (totalUnits / 6) * 100);
                  return (
                    <div>
                      <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {remaining > 0 ? (
                          <>
                            <span>Agrega <strong style={{ color: '#059669' }}>{remaining} {remaining === 1 ? 'producto más' : 'productos más'}</strong> para obtener <strong style={{ color: '#059669' }}>Precio al por mayor</strong></span>
                            <span style={{ fontSize: '0.85rem' }}>📦 {totalUnits}/6</span>
                          </>
                        ) : (
                          <>
                            <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>🎉 <strong>¡Felicidades! Precio al Por Mayor Aplicado</strong></span>
                            <span>🎁</span>
                          </>
                        )}
                      </p>
                      <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #34d399, #10b981)', transition: 'width 0.3s ease' }} />
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

                {configuracion?.metodos_pago && (
                  <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '0.2rem', marginBottom: '1rem', fontSize: '0.82rem' }}>
                    <strong style={{ color: '#1e293b', display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem' }}>💳 Métodos de Pago Disponibles:</strong>
                    {(() => {
                      try {
                        const parsed = JSON.parse(configuracion.metodos_pago);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                          return parsed.map((m: any, idx: number) => (
                            <div key={idx} style={{ padding: '0.3rem 0', color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: idx < parsed.length - 1 ? '1px dashed #e2e8f0' : 'none' }}>
                              <span><strong>{m.banco}</strong> {m.tipo ? `(${m.tipo})` : ''}</span>
                              <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{m.numero}</span>
                            </div>
                          ));
                        }
                      } catch {}
                      return <p style={{ margin: 0, color: '#64748b' }}>{configuracion.metodos_pago}</p>;
                    })()}
                  </div>
                )}

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
                            <img src={getOptimizedImageUrl(item.imagen_url, 150, 75)} alt={item.nombre} loading="lazy" decoding="async" />
                          ) : (item.imagenes_extra && item.imagenes_extra.length > 0 && decodeExtraImage(item.imagenes_extra[0]).url) ? (
                            <img src={getOptimizedImageUrl(decodeExtraImage(item.imagenes_extra[0]).url, 150, 75)} alt={item.nombre} loading="lazy" decoding="async" />
                          ) : (
                            <div className="img-placeholder-small"></div>
                          )}
                        </div>
                        <div className="cart-item-details">
                          <h4>{item.nombre}</h4>
                          {item.talla && <p style={{fontSize: '0.8rem', color: '#666', margin: '2px 0'}}>Talla: {item.talla}</p>}
                          {item.estampado && <p style={{fontSize: '0.8rem', color: '#666', margin: '2px 0'}}>Estampado: {item.estampado}</p>}
                          <p className="cart-item-price">
                            {isBulkDiscountApplied && getEffectivePrice(item, 'detal', markupPorcentaje, ajustesProductos, descuentoPromocional) > getEffectivePrice(item, 'mayorista', markupPorcentaje, ajustesProductos, descuentoPromocional) ? (
                              <>
                                <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '0.85em', marginRight: '0.4rem' }}>
                                  ${(getEffectivePrice(item, 'detal', markupPorcentaje, ajustesProductos, descuentoPromocional) * item.cantidad).toLocaleString('es-CO')}
                                </span>
                                ${(getEffectivePrice(item, effectiveCartBuyerType, markupPorcentaje, ajustesProductos, descuentoPromocional) * item.cantidad).toLocaleString('es-CO')}
                                <span style={{ marginLeft: '0.4rem', fontSize: '0.68rem', background: '#dcfce7', color: '#166534', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>Al por mayor</span>
                              </>
                            ) : (
                              `$${(getEffectivePrice(item, effectiveCartBuyerType, markupPorcentaje, ajustesProductos, descuentoPromocional) * item.cantidad).toLocaleString('es-CO')}`
                            )}
                          </p>
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

                {/* Seccion de Upsell / Recomendados (Compacto) */}
                {items.length > 0 && recommendedProducts.length > 0 && (
                  <div style={{ margin: '0.35rem 0.75rem 0.5rem', padding: '0.45rem 0.65rem', backgroundColor: '#fff0f6', borderRadius: '10px', border: '1px solid #fbcfe8' }}>
                    <h4 style={{ color: '#be185d', fontSize: '0.78rem', margin: '0 0 0.35rem 0', fontWeight: 800, textAlign: 'center', fontFamily: 'Outfit, sans-serif' }}>
                      También te pueden interesar:
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {recommendedProducts.map((p: Producto) => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'white', padding: '0.35rem 0.5rem', borderRadius: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                          <div style={{ width: '38px', height: '38px', flexShrink: 0, borderRadius: '4px', overflow: 'hidden', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {p.imagen_url ? (
                              <img src={getOptimizedImageUrl(p.imagen_url, 150, 75)} alt={p.nombre} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (p.imagenes_extra && p.imagenes_extra.length > 0 && decodeExtraImage(p.imagenes_extra[0]).url) ? (
                              <img src={getOptimizedImageUrl(decodeExtraImage(p.imagenes_extra[0]).url, 150, 75)} alt={p.nombre} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <Package size={16} color="#94a3b8" />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h5 style={{ margin: 0, fontSize: '0.78rem', color: '#1e293b', lineHeight: '1.15', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</h5>
                            <p style={{ margin: '1px 0 0 0', color: '#e11d48', fontWeight: 800, fontSize: '0.82rem' }}>
                              ${getEffectivePrice(p, buyerType, markupPorcentaje, ajustesProductos, descuentoPromocional).toLocaleString('es-CO')}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              const pTalla = p.tallas?.split(',')[0]?.trim();
                              const imgEstampados = (p.imagenes_extra || []).map(u => { const d = decodeExtraImage(u); return (d.estampado || d.ref)?.trim(); }).filter(Boolean);
                              const legacyEstampados = p.estampados?.split(',').map(e => e.trim()).filter(Boolean) || [];
                              const allEstampados = imgEstampados.length > 0 ? Array.from(new Set(imgEstampados)) : legacyEstampados;
                              const pEstampado = allEstampados[0] || undefined;
                              addToCart(p, pTalla, pEstampado, 1);
                            }}
                            style={{ backgroundColor: '#e11d48', color: 'white', border: 'none', padding: '0.25rem 0.55rem', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            + Agregar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="cart-footer" style={{ padding: '0.65rem 0.85rem' }}>
                  {/* Trust & Urgency Badges inside Cart (Compact 1-row) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem', marginBottom: '0.5rem', background: '#f8fafc', padding: '0.35rem 0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.72rem', color: '#334155', fontWeight: 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>🔥 <strong>Pocas unidades</strong></span>
                    <span style={{ color: '#cbd5e1' }}>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>🛡️ <strong>Despacho protegido</strong></span>
                  </div>

                  <div className="cart-total" style={{ margin: '0 0 0.45rem 0', fontSize: '1.1rem' }}>
                    <span>Total:</span>
                    <span>${total.toLocaleString('es-CO')}</span>
                  </div>
                  <button 
                    className="checkout-btn" 
                    disabled={items.length === 0}
                    onClick={() => setIsCheckoutMode(true)}
                    style={{ padding: '0.75rem', fontSize: '0.95rem', borderRadius: '12px' }}
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
        const legacyEstampados = detailProduct.estampados?.split(',').map(e => e.trim().toUpperCase()).filter(Boolean) || [];


        // Single source of truth: imagenes_extra + imagen_url (main image is ALWAYS included 1st)
        const rawAllImages = (detailProduct.imagenes_extra || []).map(u => decodeExtraImage(u)).filter(i => i.url);
        let allImages = [...rawAllImages];
        if (detailProduct.imagen_url && !allImages.some(img => img.url === detailProduct.imagen_url)) {
          const mainRef = (detailProduct.referencia && !detailProduct.referencia.includes('-') ? detailProduct.referencia : '');
          allImages.unshift({ url: detailProduct.imagen_url, ref: mainRef, estampado: '' });
        }
        if (allImages.length === 0 && detailProduct.imagen_url) {
          allImages = [{ url: detailProduct.imagen_url, ref: '', estampado: '' }];
        }
        const rawTallas = detailProduct.tallas?.split(',').map(t => t.trim()).filter(Boolean) || [];
        const tallasMap = new Map();
        rawTallas.forEach(t => {
          let key = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          if (key === 'talla unica' || key === 'unica' || key === 'tallaunica') {
            key = 'unica';
          }
          
          let displayVal = t;
          if (key === 'unica') displayVal = 'Única';

          if (!tallasMap.has(key)) tallasMap.set(key, displayVal);
        });
        const tallas = Array.from(tallasMap.values());
        const safeIdx = Math.min(carouselIdx, allImages.length - 1);
        const currentImgRef = (allImages[safeIdx]?.estampado || allImages[safeIdx]?.ref)?.trim();
        return (
          <div className="detail-overlay" onClick={() => setDetailProduct(null)}>
            <div className="detail-modal" onClick={e => e.stopPropagation()}>
              {/* Close button */}
              <button className="detail-close" onClick={() => setDetailProduct(null)}><X size={20} /></button>

              {/* ── CAROUSEL ── */}
              <div className="detail-carousel">
                {detailProduct.video_url ? (
                  <video src={detailProduct.video_url} autoPlay loop muted playsInline preload="metadata" className="detail-carousel-img" ref={el => { if (el && el.paused) el.play().catch(() => {}); }} />
                ) : allImages.length > 0 ? (
                  <img src={getOptimizedImageUrl(allImages[safeIdx].url, 800, 80)} alt={detailProduct.nombre} className="detail-carousel-img" loading="eager" fetchPriority="high" decoding="async" />
                ) : (
                  <div className="detail-carousel-placeholder" />
                )}
                <div className="sku-badge" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', left: '0.5rem', right: 'auto', background: 'rgba(15, 23, 42, 0.88)', color: 'white', fontWeight: 700 }}>
                  Ref: {detailProduct.nombre} {(detailProduct.referencia || detailProduct.sku) ? `(${detailProduct.referencia || detailProduct.sku})` : ''}
                </div>
                {currentImgRef && (
                  <div className="sku-badge" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', left: '0.5rem', top: '2.2rem', right: 'auto', background: 'rgba(14, 165, 233, 0.95)', color: 'white', fontWeight: 700 }}>
                    Estampado: {currentImgRef}
                  </div>
                )}
              </div>

              {/* ── INFO ── */}
              <div className="detail-info">
                <div className="detail-header-row">
                  <h3 className="detail-name">{detailProduct.nombre}</h3>
                   <p className="detail-price">
                    {((detailProduct.descuento !== undefined && detailProduct.descuento > 0) || descuentoPromocional > 0) ? (
                      <>
                        <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '0.82em', marginRight: '0.5rem', fontWeight: 500 }}>
                          ${getActiveUnitPrice(detailProduct, selectedMiembroFamilia).toLocaleString('es-CO')}
                        </span>
                        ${getEffectivePrice({ ...detailProduct, precio: getActiveUnitPrice(detailProduct, selectedMiembroFamilia) }, buyerType, markupPorcentaje, ajustesProductos, descuentoPromocional).toLocaleString('es-CO')}
                      </>
                    ) : (
                      `$${getEffectivePrice({ ...detailProduct, precio: getActiveUnitPrice(detailProduct, selectedMiembroFamilia) }, buyerType, markupPorcentaje, ajustesProductos).toLocaleString('es-CO')}`
                    )}
                  </p>
                </div>
                {detailProduct.descripcion && (
                  <p className="detail-desc">{detailProduct.descripcion}</p>
                )}

                {/* ── PRODUCTO FAMILIAR OPTION SELECTOR ── */}
                {detailProduct.es_producto_familiar && detailProduct.precios_familia && (
                  <div className="detail-tallas" style={{ width: '100%', background: '#f0f9ff', padding: '0.75rem', borderRadius: '12px', border: '1px solid #bae6fd', marginBottom: '0.85rem' }}>
                    <p className="detail-section-label" style={{ color: '#0369a1', fontWeight: 800, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      👨‍👩‍👧‍👦 Opción del Producto Familiar:
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                      {detailProduct.precios_familia.nino !== undefined && detailProduct.precios_familia.nino !== null && (
                        <button
                          type="button"
                          onClick={() => setSelectedMiembroFamilia('nino')}
                          style={{
                            padding: '0.55rem 0.25rem',
                            borderRadius: '10px',
                            border: selectedMiembroFamilia === 'nino' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                            background: selectedMiembroFamilia === 'nino' ? '#e0f2fe' : '#ffffff',
                            color: selectedMiembroFamilia === 'nino' ? '#0369a1' : '#334155',
                            fontWeight: selectedMiembroFamilia === 'nino' ? 800 : 600,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div>👦 Niño/a</div>
                          <div style={{ fontSize: '0.75rem', color: selectedMiembroFamilia === 'nino' ? '#0284c7' : '#64748b' }}>
                            ${detailProduct.precios_familia.nino.toLocaleString('es-CO')}
                          </div>
                        </button>
                      )}
                      {detailProduct.precios_familia.hombre !== undefined && detailProduct.precios_familia.hombre !== null && (
                        <button
                          type="button"
                          onClick={() => setSelectedMiembroFamilia('hombre')}
                          style={{
                            padding: '0.55rem 0.25rem',
                            borderRadius: '10px',
                            border: selectedMiembroFamilia === 'hombre' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                            background: selectedMiembroFamilia === 'hombre' ? '#e0f2fe' : '#ffffff',
                            color: selectedMiembroFamilia === 'hombre' ? '#0369a1' : '#334155',
                            fontWeight: selectedMiembroFamilia === 'hombre' ? 800 : 600,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div>👨 Hombre</div>
                          <div style={{ fontSize: '0.75rem', color: selectedMiembroFamilia === 'hombre' ? '#0284c7' : '#64748b' }}>
                            ${detailProduct.precios_familia.hombre.toLocaleString('es-CO')}
                          </div>
                        </button>
                      )}
                      {detailProduct.precios_familia.mujer !== undefined && detailProduct.precios_familia.mujer !== null && (
                        <button
                          type="button"
                          onClick={() => setSelectedMiembroFamilia('mujer')}
                          style={{
                            padding: '0.55rem 0.25rem',
                            borderRadius: '10px',
                            border: selectedMiembroFamilia === 'mujer' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                            background: selectedMiembroFamilia === 'mujer' ? '#e0f2fe' : '#ffffff',
                            color: selectedMiembroFamilia === 'mujer' ? '#0369a1' : '#334155',
                            fontWeight: selectedMiembroFamilia === 'mujer' ? 800 : 600,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div>👩 Mujer</div>
                          <div style={{ fontSize: '0.75rem', color: selectedMiembroFamilia === 'mujer' ? '#0284c7' : '#64748b' }}>
                            ${detailProduct.precios_familia.mujer.toLocaleString('es-CO')}
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── ESTAMPADOS + TALLAS + CANTIDAD ── */}
                <div className="detail-controls-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', alignItems: 'stretch' }}>
                  {(() => {
                    const imgEstampados = allImages.map(img => (img.estampado || img.ref)?.trim().toUpperCase()).filter(Boolean);
                    const estampados = imgEstampados.length > 0 ? Array.from(new Set(imgEstampados)) : legacyEstampados;
                    
                    if (estampados.length === 0) return null;
                    return (
                      <div className="detail-tallas" style={{ width: '100%' }}>
                        <p className="detail-section-label" style={{ marginBottom: '0.4rem' }}>Estampado / Temática</p>
                        
                        {/* Dropdown Menu for Estampados */}
                        <select
                          value={selectedEstampado}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedEstampado(val);
                            const valClean = val.trim().toUpperCase();
                            const imgIdx = allImages.findIndex(img => {
                              const est = (img.estampado || img.ref || '').trim().toUpperCase();
                              return est === valClean || (est && valClean && (est.includes(valClean) || valClean.includes(est)));
                            });
                            if (imgIdx !== -1) {
                              setCarouselIdx(imgIdx);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '0.6rem 0.85rem',
                            borderRadius: '12px',
                            border: '1.5px solid var(--primary, #f36b8e)',
                            background: '#ffffff',
                            color: '#0f172a',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            outline: 'none',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                          }}
                        >
                          {estampados.map(est => (
                            <option key={est} value={est}>
                              🎨 {est}
                            </option>
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


                <div style={{ marginTop: '0.85rem' }} />

                {/* ── ADD TO CART ── */}
                <button className="detail-add-btn" onClick={handleAddFromDetail}>
                  <ShoppingCart size={18} />
                  Añadir al carrito • ${(getEffectivePrice({ ...detailProduct, precio: getActiveUnitPrice(detailProduct, selectedMiembroFamilia) }, buyerType, markupPorcentaje, ajustesProductos, descuentoPromocional) * selectedCantidad).toLocaleString('es-CO')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal Selección Tipo de Compra ── */}
      {(showTipoModal || (buyerType === null && !cargando && (configuracion?.preguntar_tipo_cliente ?? false))) && (
        <div className="welcome-tipo-overlay" onClick={() => setShowTipoModal(false)}>
          <div className="welcome-tipo-card" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowTipoModal(false)}
              className="welcome-tipo-close-btn"
              title="Cerrar"
            >
              <X size={18} />
            </button>
            <div className="welcome-logo-badge">
              {(mayoristaBranding?.logo || configuracion?.logo_url) ? (
                <img src={mayoristaBranding?.logo || configuracion?.logo_url} alt="Logo" className="welcome-logo-img" />
              ) : (
                <span className="welcome-logo-icon">🛍️</span>
              )}
            </div>
            <h1 className="welcome-title">
              Selecciona tu <span className="highlight-name">Tipo de Compra</span>
            </h1>
            <p className="welcome-subtitle">
              Por favor, selecciona tu modalidad para mostrarte los precios y catálogo correcto:
            </p>

            <div className="welcome-buttons-list">
              <button 
                onClick={() => { setBuyerType('detal'); setShowTipoModal(false); }} 
                className={`welcome-btn btn-detal ${buyerType === 'detal' || buyerType === null ? 'active' : ''}`}
              >
                <span className="btn-icon">🛍️</span>
                <div className="btn-text-wrap">
                  <span className="btn-title">Compras al detal</span>
                  <span className="btn-desc">Para compras individuales y al por menor</span>
                </div>
              </button>

              <button 
                onClick={() => { setBuyerType('mayorista'); setShowTipoModal(false); }} 
                className={`welcome-btn btn-mayorista ${buyerType === 'mayorista' ? 'active' : ''}`}
              >
                <span className="btn-icon">📦</span>
                <div className="btn-text-wrap">
                  <span className="btn-title">Soy mayorista</span>
                  <span className="btn-desc">Precios especiales para distribuidores</span>
                </div>
              </button>

              <button 
                onClick={() => { setBuyerType('50_unidades'); setShowTipoModal(false); }} 
                className={`welcome-btn btn-bulk ${buyerType === '50_unidades' ? 'active' : ''}`}
              >
                <span className="btn-icon">🏭</span>
                <div className="btn-text-wrap">
                  <span className="btn-title">Compras por 50 unidades</span>
                  <span className="btn-desc">Descuentos por volumen alto</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal Aviso de Bienvenida Estilo Temu ── */}
      <TemuWelcomeBanner
        isOpen={showTemuBanner}
        onClose={() => {
          setShowTemuBanner(false);
          try { sessionStorage.setItem(`temu_banner_dismissed_${getTenantId()}`, 'true'); } catch (e) {}
        }}
        onStartGame={() => {
          setShowTemuBanner(false);
          try { sessionStorage.setItem(`temu_banner_dismissed_${getTenantId()}`, 'true'); } catch (e) {}
          setIsGameModalOpen(true);
        }}
      />

      {/* ── Modal Juego La Noche Perfecta ── */}
      <NochePerfectaGameModal
        isOpen={isGameModalOpen}
        onClose={() => setIsGameModalOpen(false)}
        onApplyCoupon={() => {
          try {
            const giftItem: Producto = {
              id: 'regalo-pijama-short-tira-' + Date.now(),
              nombre: '🎁 REGALO: Pijama Short Tira',
              precio: 0,
              categoria: 'regalo',
              subcategoria: 'regalo',
              stock: 999,
              imagen_url: 'https://images.unsplash.com/photo-1596814234568-19ebcc1af3fa?auto=format&fit=crop&q=80&w=400',
              descripcion: '¡Premio de bienvenida ganado en el juego La Noche Perfecta!',
              created_at: new Date().toISOString()
            };
            addToCart(giftItem, 'Única', 'Estándar', 1);
          } catch (e) {}
        }}
        tenantId={getTenantId()}
      />
    </div>
  );
}
