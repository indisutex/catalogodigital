import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase, getTenantId } from '../lib/supabase';
import { updatePWAManifestAndIcons } from '../lib/pwa';
import type { Producto, Categoria, Subcategoria, Configuracion } from '../types';
import { Loader2, Search, Plus, ShoppingBag, X, ShoppingCart, Volume2, VolumeX, Package, HelpCircle, RefreshCw, Menu } from 'lucide-react';
import { useCart, getEffectivePrice } from '../context/CartContext';
import PqrsModal from '../components/PqrsModal';
import { getOptimizedImageUrl } from '../lib/imageOptimizer';
import { PromoWelcomeBanner as TemuWelcomeBanner } from '../components/NochePerfectaGameModal';
import { JuegosHubModal } from '../components/JuegosHubModal';
import { TemuOfferToast, TemuStickyHeaderBar } from '../components/TemuOfferBanner';
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
} catch (e) {
  console.error('Error setting initial CSS theme:', e);
}

import { decodeExtraImage, isMediaVideo } from '../lib/mediaUtils';

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
  const [isBurgerMenuOpen, setIsBurgerMenuOpen] = useState(false);
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
      } catch (err) {
        console.error("Error loading wholesaler markup: ", err);
      }
    }


    const params = new URLSearchParams(window.location.search);
    const wsParam = params.get('ws') || params.get('asesor') || params.get('wa') || params.get('linea') || params.get('telefono');
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

  const heroVideoUrl = mayoristaBranding?.video || configuracion?.video_hero_url;

  useEffect(() => {
    const v = heroVideoRef.current;
    if (v) {
      v.muted = heroMuted;
      v.defaultMuted = true;
      v.playsInline = true;
      const playPromise = v.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          v.muted = true;
          v.play().catch(() => {});
        });
      }
    }
  }, [heroVideoUrl, heroMuted]);
  
  // Product Detail Popup
  const [detailProduct, setDetailProduct] = useState<Producto | null>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [selectedTalla, setSelectedTalla] = useState<string>('');
  const [selectedEstampado, setSelectedEstampado] = useState<string>('');
  const [selectedCantidad, setSelectedCantidad] = useState(1);
  const [selectedMiembroFamilia, setSelectedMiembroFamilia] = useState<string>('');
  const [famOptionQuantities, setFamOptionQuantities] = useState<Record<string, number>>({});

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
    setFamOptionQuantities({
      dama_unica: 0,
      dama_plus: 0,
      caballero_unica: 0,
      unisex_2xl: 0,
      '2/4': 0,
      '6/8': 0,
      '10/12': 0,
      '14/16': 0,
      '18': 0
    });
    if (producto.es_producto_familiar && producto.precios_familia) {
      if (producto.precios_familia.nino) setSelectedMiembroFamilia('nino');
      else if (producto.precios_familia.hombre) setSelectedMiembroFamilia('hombre');
      else if (producto.precios_familia.mujer) setSelectedMiembroFamilia('mujer');
      else setSelectedMiembroFamilia('');
    } else {
      setSelectedMiembroFamilia('');
    }
  };

  const getActiveUnitPrice = (prod: Producto, miembro?: string, talla?: string, bType?: string | null) => {
    if (prod.es_producto_familiar && prod.precios_familia) {
      const fam = prod.precios_familia as any;
      const preciosDetallados = fam.precios_detallados || {};
      const preciosMap = fam.precios_tallas || {};

      const currentBuyerMode = bType || buyerType;

      const getOptionPrice = (optKey: string) => {
        const optObj = preciosDetallados[optKey];
        if (optObj) {
          if (currentBuyerMode === 'mayorista' && optObj.mayor > 0) return Number(optObj.mayor);
          if (currentBuyerMode === '50_unidades' && optObj.p50 > 0) return Number(optObj.p50);
          if (optObj.detal > 0) return Number(optObj.detal);
        }
        if (preciosMap[optKey] > 0) return Number(preciosMap[optKey]);
        return 0;
      };

      if (talla) {
        const p = getOptionPrice(talla);
        if (p > 0) return p;
      }

      if (miembro === 'dama_unica') {
        const p = getOptionPrice('Dama Única');
        if (p > 0) return p;
        if (fam.dama_unica) return Number(fam.dama_unica);
      }
      if (miembro === 'dama_plus') {
        const p = getOptionPrice('Dama Plus');
        if (p > 0) return p;
        if (fam.dama_plus) return Number(fam.dama_plus);
      }
      if (miembro === 'caballero_unica') {
        const p = getOptionPrice('Caballero Única');
        if (p > 0) return p;
        if (fam.caballero_unica) return Number(fam.caballero_unica);
      }
      if (miembro === 'unisex_2xl') {
        const p = getOptionPrice('2XL Unisex');
        if (p > 0) return p;
        if (fam.unisex_2xl) return Number(fam.unisex_2xl);
      }

      if (miembro === 'nino') {
        const p = getOptionPrice('2/4');
        if (p > 0) return p;
        return Number(fam.nino || 22000);
      }
    }
    return prod.precio;
  };

  const handleAddFromDetail = () => {
    if (!detailProduct) return;
    const tallas = detailProduct.tallas?.split(',').map(t => t.trim()).filter(Boolean) || [];
    const estampados = detailProduct.estampados?.split(',').map(e => e.trim()).filter(Boolean) || [];

    if (estampados.length > 0 && !selectedEstampado) {
      alert('Por favor selecciona un estampado');
      return;
    }

    if (detailProduct.es_producto_familiar) {
      const selectedEntries = Object.entries(famOptionQuantities).filter(([_, q]) => q > 0);
      if (selectedEntries.length === 0) {
        alert('Por favor selecciona al menos una cantidad en las opciones o tallas');
        return;
      }

      selectedEntries.forEach(([key, q]) => {
        let label = '';
        let tVal = 'Única';
        let memberVal = key;

        if (key === 'dama_unica') { label = 'Dama Única'; memberVal = 'dama_unica'; }
        else if (key === 'dama_plus') { label = 'Dama Plus'; memberVal = 'dama_plus'; }
        else if (key === 'caballero_unica') { label = 'Caballero Única'; memberVal = 'caballero_unica'; }
        else if (key === 'unisex_2xl') { label = '2XL Unisex'; memberVal = 'unisex_2xl'; }
        else {
          label = `Niño Talla ${key}`;
          tVal = key;
          memberVal = 'nino';
        }

        const unitPrice = getActiveUnitPrice(detailProduct, memberVal, tVal, buyerType);
        const productToAdd = {
          ...detailProduct,
          precio: unitPrice,
          nombre: `${detailProduct.nombre} (${label})`
        };

        addToCart(productToAdd, tVal, selectedEstampado, q);
      });

      setDetailProduct(null);
      return;
    }

    if (tallas.length > 0 && !selectedTalla) {
      alert('Por favor selecciona una talla');
      return;
    }

    const unitPrice = getActiveUnitPrice(detailProduct, selectedMiembroFamilia, selectedTalla, buyerType);
    let miembroLabel = '';
    if (selectedMiembroFamilia === 'dama_unica') miembroLabel = 'Dama Única';
    else if (selectedMiembroFamilia === 'dama_plus') miembroLabel = 'Dama Plus';
    else if (selectedMiembroFamilia === 'caballero_unica') miembroLabel = 'Caballero Única';
    else if (selectedMiembroFamilia === 'unisex_2xl') miembroLabel = '2XL Unisex';
    else if (selectedMiembroFamilia === 'nino') miembroLabel = 'Niños';

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
      if (!(configuracion.preguntar_tipo_cliente ?? false) && buyerType === null) {
        setBuyerType('detal');
      }
    }
  }, [configuracion, buyerType, setBuyerType, setDescuentoPromocional, setIsBulkDiscountEnabled]);

  const getMinijuegosActivos = () => {
    if (configuracion?.activar_minijuegos === false || (configuracion?.activar_minijuegos as any) === 'false') {
      return false;
    }
    try {
      const tenant = getTenantId();
      const globalFlag = localStorage.getItem('config_extra_global_activar_minijuegos');
      if (globalFlag === 'false') return false;

      const tenantFlag = localStorage.getItem(`config_extra_tenant_${tenant}`);
      if (tenantFlag) {
        const parsed = JSON.parse(tenantFlag);
        if (parsed.activar_minijuegos === false) return false;
      }

      if (configuracion?.id) {
        const savedExtra = localStorage.getItem(`config_extra_${configuracion.id}`);
        if (savedExtra) {
          const parsed = JSON.parse(savedExtra);
          if (parsed.activar_minijuegos === false) return false;
        }
      }
    } catch (e) {}

    return configuracion?.activar_minijuegos ?? true;
  };

  const minijuegosActivos = getMinijuegosActivos();

  useEffect(() => {
    if (cargando) return;
    if (!minijuegosActivos) return;
    
    const isTipoModalVisible = showTipoModal || (buyerType === null && (configuracion?.preguntar_tipo_cliente ?? false));
    
    if (isTipoModalVisible) return;

    try {
      const tenant = getTenantId();
      const dismissed = sessionStorage.getItem(`temu_banner_dismissed_${tenant}`);
      if (!dismissed) {
        const timer = setTimeout(() => {
          setShowTemuBanner(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    } catch (e) {}
  }, [cargando, buyerType, showTipoModal, configuracion, minijuegosActivos]);

  const [formData, setFormData] = useState({
    nombre: '',
    cedula: '',
    email: '',
    telefono: '',
    direccion: '',
    ciudad: ''
  });
  const [modalidadPago, setModalidadPago] = useState<'contra_entrega' | 'anticipado'>('contra_entrega');
  const [leadId, setLeadId] = useState<string | null>(null);

  const leadIdRef = useRef<string | null>(null);
  const isInsertingRef = useRef(false);
  const isOrderSubmittedRef = useRef(false);

  useEffect(() => {
    if (isOrderSubmittedRef.current) return;
    // Solo guardar el abandonado si llenó todos los datos
    if (!formData.nombre || !formData.telefono || !formData.direccion || !formData.ciudad) return;

    const delayDebounceFn = setTimeout(async () => {
      if (isOrderSubmittedRef.current) return;
      try {
        const tenant = getTenantId();
        const numeroWhatsApp = overrideWhatsApp || configuracion?.whatsapp || '573185637317';
        
        const productosProcesados = items.map(item => {
          const effectivePrice = getEffectivePrice(item, effectiveCartBuyerType, markupPorcentaje, ajustesProductos, descuentoPromocional);
          const isWholesale = effectiveCartBuyerType === 'mayorista' || isBulkDiscountApplied || buyerType === 'mayorista';
          return {
            ...item,
            precio_detal: item.precio_detal || item.precio,
            precio: effectivePrice,
            precio_aplicado_mayor: isWholesale
          };
        });

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
              productos: productosProcesados,
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
              productos: productosProcesados,
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
          let extraConfig: any = {};
          let cleanMetodos = bestConfig.metodos_pago || '';

          if (cleanMetodos && typeof cleanMetodos === 'string' && cleanMetodos.includes('__EXTRA_CONFIG__')) {
            const parts = cleanMetodos.split('__EXTRA_CONFIG__');
            cleanMetodos = parts[0];
            try {
              if (parts[1]) {
                const parsedExtra = JSON.parse(parts[1]);
                extraConfig = { ...extraConfig, ...parsedExtra };
              }
            } catch (e) {}
          }

          try {
            const globalMinijuegos = localStorage.getItem('config_extra_global_activar_minijuegos');
            if (globalMinijuegos !== null) {
              extraConfig.activar_minijuegos = globalMinijuegos === 'true';
            }
            const tenantExtra = localStorage.getItem(`config_extra_tenant_${tenant}`);
            if (tenantExtra) {
              const parsed = JSON.parse(tenantExtra);
              if (parsed.activar_minijuegos !== undefined) extraConfig.activar_minijuegos = parsed.activar_minijuegos;
            }
            const savedExtra = localStorage.getItem(`config_extra_${bestConfig.id}`);
            if (savedExtra) {
              const parsed = JSON.parse(savedExtra);
              extraConfig = { ...extraConfig, ...parsed };
            }
          } catch (e) {}
          setConfiguracion({ ...bestConfig, ...extraConfig, metodos_pago: cleanMetodos });
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
  }, [window.location.pathname, window.location.search]);



  const imageFitStyle = configuracion?.tarjeta_imagen_fit || 'cover';
  const imagePosStyle = configuracion?.tarjeta_imagen_posicion || 'top';
  const imageAspectStyle = configuracion?.tarjeta_imagen_aspecto || '1/1';

  const cardImageStyle = useMemo(() => {
    let aspect = '1 / 1';
    if (imageAspectStyle === '1/1') aspect = '1 / 1';
    else if (imageAspectStyle === '3/4') aspect = '3 / 4';
    else if (imageAspectStyle === '4/5') aspect = '4 / 5';
    else if (imageAspectStyle === '4/3') aspect = '4 / 3';
    else if (imageAspectStyle === '16/9') aspect = '16 / 9';
    else if (imageAspectStyle === 'auto') aspect = 'auto';

    return {
      objectFit: (imageFitStyle || 'contain') as any,
      objectPosition: (imagePosStyle || 'center') as any,
      aspectRatio: aspect,
      width: '100%',
      height: '100%',
      display: 'block',
      backgroundColor: '#ffffff'
    };
  }, [imageFitStyle, imagePosStyle, imageAspectStyle]);

  const productosFiltrados = useMemo(() => {
    const catActual = categorias.find(c => c.slug === filtroCategoria);
    let list = (filtroCategoria === 'todos' 
      ? productos 
      : productos.filter(p => {
          const pCat = (p.categoria || '').toLowerCase().trim();
          return pCat === filtroCategoria.toLowerCase().trim()
            || pCat === (catActual?.nombre || '').toLowerCase().trim()
            || pCat === (catActual?.slug || '').toLowerCase().trim();
        })).filter(p => !p.oculto);

    if (filtroCategoria !== 'todos' && filtroSubcategoria !== 'todas') {
      const subcatActual = subcategorias.find(s => s.slug === filtroSubcategoria);
      list = list.filter(p => {
        const pSub = (p.subcategoria || '').toLowerCase().trim();
        return pSub === filtroSubcategoria.toLowerCase().trim()
          || pSub === (subcatActual?.nombre || '').toLowerCase().trim()
          || pSub === (subcatActual?.slug || '').toLowerCase().trim();
      });
    }

    if (ajustesProductos) {
      list = list.filter(p => {
        const productSetting = ajustesProductos[p.id];
        const isHiddenObject = productSetting && typeof productSetting === 'object' && productSetting.oculto;
        const isHiddenArray = ajustesProductos.hidden_products?.includes(p.id);
        return !isHiddenObject && !isHiddenArray;
      });
    }

    if (busqueda.trim()) {
      const cleanStr = (str: string) => 
        (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const q = cleanStr(busqueda);
      list = list.filter(p =>
        cleanStr(p.nombre || '').includes(q) ||
        cleanStr(p.descripcion || '').includes(q) ||
        cleanStr(p.categoria || '').includes(q) ||
        cleanStr(p.referencia || '').includes(q)
      );
    }

    return list;
  }, [productos, filtroCategoria, filtroSubcategoria, categorias, subcategorias, ajustesProductos, busqueda]);

  const totalItems = items.reduce((sum, item) => sum + item.cantidad, 0);

  const recommendedProducts = useMemo(() => {
    if (items.length === 0) return [];
    const inCartIds = items.map(i => i.id);
    const available = productos.filter(p => !inCartIds.includes(p.id) && !p.oculto);
    return available.slice(0, 2);
  }, [productos, items]);

  const handleEnviarPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (buyerType === 'mayorista' && totalUnits < 6) {
      alert(`Tienes que comprar mínimo 6 unidades para poder comprar en nuestro catálogo mayorista. Actualmente llevas ${totalUnits} ${totalUnits === 1 ? 'unidad' : 'unidades'}. Agrega ${6 - totalUnits} más a tu carrito.`);
      return;
    }
    
    // Construir el mensaje para WhatsApp
    let buyerLabel = '';
    if (buyerType === 'mayorista') buyerLabel = 'Mayorista';
    if (buyerType === 'detal' || buyerType === null) buyerLabel = isBulkDiscountApplied ? 'Al detal (Con descuento por mayor aplicable)' : 'Al detal';
    if (buyerType === '50_unidades') buyerLabel = '50+ unidades';

    let mensaje = `Hola, mi nombre es ${formData.nombre}.\n`;
    if (formData.cedula) {
      mensaje += `*Cédula:* ${formData.cedula}\n`;
    }
    if (formData.email) {
      mensaje += `*Correo:* ${formData.email}\n`;
    }
    mensaje += `*Tipo de compra:* ${buyerLabel}\n`;
    mensaje += `*Método de pago:* ${modalidadPago === 'contra_entrega' ? '🚚 Contra Entrega' : '💳 Pago Anticipado'}\n`;
    if (modalidadPago === 'contra_entrega') {
      mensaje += `📌 *Nota de pago:* Al momento de recibir cancelas el valor de las prendas + el valor del envío.\n`;
    } else {
      mensaje += `📌 *Nota de pago:* Recuerda que al momento de recibir solo cancelas el valor del envío.\n`;
    }
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
      const productosProcesados = items.map(item => {
        const effectivePrice = getEffectivePrice(item, effectiveCartBuyerType, markupPorcentaje, ajustesProductos, descuentoPromocional);
        const isWholesale = effectiveCartBuyerType === 'mayorista' || isBulkDiscountApplied || buyerType === 'mayorista';
        return {
          ...item,
          precio_detal: item.precio_detal || item.precio,
          precio: effectivePrice,
          precio_aplicado_mayor: isWholesale
        };
      });

      let insertPayload: any = {
        cliente_nombre: formData.nombre,
        cliente_cedula: formData.cedula,
        cliente_email: formData.email,
        cliente_telefono: formData.telefono,
        direccion: formData.direccion,
        ciudad: formData.ciudad,
        total: total,
        productos: productosProcesados,
        linea_whatsapp: numeroWhatsApp,
        metodo_pago: modalidadPago === 'contra_entrega' ? 'Contra Entrega' : 'Pago Anticipado',
        tenant_id: getTenantId()
      };

      let { data: newOrder, error: dbErr } = await supabase.from('pedidos').insert(insertPayload).select('id').single();

      if (dbErr && dbErr.message && dbErr.message.includes('metodo_pago')) {
        console.warn('Columna metodo_pago no encontrada en DB, reintentando insert sin esa columna...');
        delete insertPayload.metodo_pago;
        const retry = await supabase.from('pedidos').insert(insertPayload).select('id').single();
        newOrder = retry.data;
        dbErr = retry.error;
      }

      if (dbErr) {
        console.error('Error al registrar pedido en base de datos:', dbErr);
      } else if (newOrder) {
        orderId = newOrder.id;
      }

      isOrderSubmittedRef.current = true;
      const currentLeadId = leadIdRef.current || leadId;
      if (currentLeadId) {
        await supabase.from('leads').update({ estado: 'completado' }).eq('id', currentLeadId);
        setLeadId(null);
        leadIdRef.current = null;
      }
    } catch (dbErr) {
      console.error('Error al registrar pedido en base de datos:', dbErr);
    }

    if (modalidadPago === 'anticipado') {
      let metodosStr = '';
      if (configuracion?.metodos_pago) {
        try {
          const parsed = JSON.parse(configuracion.metodos_pago);
          if (Array.isArray(parsed) && parsed.length > 0) {
            metodosStr = `\n💳 *Métodos de pago:*\n` + parsed.map((m: any) => `• ${m.banco} ${m.tipo ? `(${m.tipo})` : ''}: ${m.numero}`).join('\n') + `\n`;
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
        mensaje += `\n📸 *Sube tu comprobante de pago en el siguiente enlace:* ${uploadLink}\n`;
      }
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
    setFormData({ nombre: '', cedula: '', email: '', telefono: '', direccion: '', ciudad: '' });
    setTimeout(() => {
      isOrderSubmittedRef.current = false;
    }, 2000);
  };

  return (
    <div className="menu-app-container">
      <div className={`menu-app-header ${isMediaVideo(mayoristaBranding?.video || configuracion?.video_hero_url) ? 'has-video' : ''}`} style={{ position: 'relative' }}>
        {(mayoristaBranding?.video || configuracion?.video_hero_url) && (
          isMediaVideo(mayoristaBranding?.video || configuracion?.video_hero_url) ? (
            <video 
              key={heroVideoUrl || 'hero-video-key'}
              src={heroVideoUrl} 
              autoPlay 
              loop 
              muted={heroMuted}
              playsInline 
              preload="auto"
              className="hero-background-video"
              ref={(el) => {
                (heroVideoRef as any).current = el;
                if (el) {
                  el.muted = heroMuted;
                  el.defaultMuted = true;
                  el.playsInline = true;
                  const promise = el.play();
                  if (promise !== undefined) {
                    promise.catch(() => {
                      el.muted = true;
                      el.play().catch(() => {});
                    });
                  }
                }
              }}
              onCanPlay={el => { 
                const v = (el.target as HTMLVideoElement); 
                v.muted = heroMuted; 
                v.defaultMuted = true; 
                v.play().catch(() => {}); 
              }}
              onLoadedData={el => {
                const v = (el.target as HTMLVideoElement);
                v.muted = heroMuted;
                v.defaultMuted = true;
                v.play().catch(() => {});
              }}
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

        {/* ── BURGER MENU BUTTON ── */}
        <button
          onClick={() => setIsBurgerMenuOpen(true)}
          className="burger-menu-btn"
          aria-label="Abrir menú"
        >
          <Menu size={28} strokeWidth={3} className="burger-menu-icon" color="var(--primary, #000)" />
        </button>

        {/* ── CENTRAL LOGO ── */}
        <div className="hero-center-logo">
          {(mayoristaBranding?.logo || configuracion?.logo_url) ? (
            <img
              src={mayoristaBranding?.logo || configuracion?.logo_url || ''}
              alt="Logo"
              className="store-logo-round"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          ) : (
            <div className="store-logo-round store-logo-placeholder">
              <span className="logo-letter c1" style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {(mayoristaBranding?.nombre || configuracion?.nombre_negocio || 'T').substring(0, 1).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* ── BURGER MENU PANEL (SIDEBAR) ── */}
        <div className={`burger-menu-overlay ${isBurgerMenuOpen ? 'open' : ''}`} onClick={() => setIsBurgerMenuOpen(false)}></div>
        <div className={`burger-menu-panel ${isBurgerMenuOpen ? 'open' : ''}`}>
          <div className="burger-menu-header">
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, background: 'linear-gradient(135deg, #d946ef 0%, #8b5cf6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Opciones
            </h3>
            <button className="burger-menu-close" onClick={() => setIsBurgerMenuOpen(false)}>
              <X size={24} />
            </button>
          </div>
          
          <div className="burger-menu-content">
            {/* Juegos & Premios */}
            {minijuegosActivos && (
              <button
                onClick={() => { setIsBurgerMenuOpen(false); setIsGameModalOpen(true); }}
                className="burger-item-btn"
                style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)', color: 'white' }}
              >
                <span className="burger-item-icon">🎮</span>
                <div className="burger-item-text">
                  <strong>Juegos & Premios</strong>
                  <span className="burger-item-sub">Gana descuentos y regalos</span>
                </div>
              </button>
            )}

            {/* Tipo de Compra */}
            <button
              onClick={() => { setIsBurgerMenuOpen(false); setShowTipoModal(true); }}
              className="burger-item-btn"
              style={{ background: configuracion?.color_primario || 'var(--primary, #0ea5e9)', color: 'white' }}
            >
              <RefreshCw size={20} className="burger-item-icon svg-icon" />
              <div className="burger-item-text">
                <strong>Tipo: {buyerType === 'mayorista' ? 'Mayorista' : buyerType === '50_unidades' ? '50+ Unid' : 'Detal'}</strong>
                <span className="burger-item-sub">Cambiar tipo de compra</span>
              </div>
            </button>

            {/* Info & PQRS */}
            <button
              onClick={() => { setIsBurgerMenuOpen(false); setIsPqrsOpen(true); }}
              className="burger-item-btn"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }}
            >
              <HelpCircle size={20} className="burger-item-icon svg-icon" style={{ color: configuracion?.color_primario || '#0284c7' }} />
              <div className="burger-item-text">
                <strong>Info & PQRS</strong>
                <span className="burger-item-sub">Ubicación, contacto y soporte</span>
              </div>
            </button>

            {/* Dropshipper */}
            {(ajustesProductos?.botones_extra?.dropshipper_enabled ?? true) && (
              <a 
                href={ajustesProductos?.botones_extra?.dropshipper_link || configuracion?.link_dropshipper || (() => {
                  let clean = (overrideWhatsApp || configuracion?.whatsapp || '').replace(/\D/g, '');
                  if (clean.length === 10) clean = '57' + clean;
                  return `https://wa.me/${clean}?text=Hola,%20soy%20dropshipper,%20me%20interesa%20trabajar%20con%20ustedes`;
                })()} 
                target="_blank" 
                rel="noopener noreferrer"
                className="burger-item-btn outline-btn"
                onClick={() => setIsBurgerMenuOpen(false)}
              >
                <span className="burger-item-icon">🚀</span>
                <div className="burger-item-text">
                  <strong>{ajustesProductos?.botones_extra?.dropshipper_text || '¿Eres Dropshipper?'}</strong>
                </div>
              </a>
            )}

            {/* Ganar Dinero */}
            {(ajustesProductos?.botones_extra?.earn_money_enabled ?? true) && (
              <a 
                href={ajustesProductos?.botones_extra?.earn_money_link || configuracion?.link_ganar_dinero || (() => {
                  let clean = (overrideWhatsApp || configuracion?.whatsapp || '').replace(/\D/g, '');
                  if (clean.length === 10) clean = '57' + clean;
                  return `https://wa.me/${clean}?text=Hola,%20quiero%20saber%20cómo%20ganar%20dinero%20con%20ustedes`;
                })()} 
                target="_blank" 
                rel="noopener noreferrer"
                className="burger-item-btn outline-btn ganar-dinero-pulse"
                onClick={() => setIsBurgerMenuOpen(false)}
              >
                <span className="burger-item-icon">💸</span>
                <div className="burger-item-text">
                  <strong>{ajustesProductos?.botones_extra?.earn_money_text || 'Ganar Dinero'}</strong>
                </div>
              </a>
            )}

            {/* Sonido (Solo si hay video) */}
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
                className="burger-item-btn"
                style={{ background: '#f1f5f9', color: '#475569', marginTop: 'auto' }}
              >
                {heroMuted ? <VolumeX size={20} className="burger-item-icon svg-icon" /> : <Volume2 size={20} className="burger-item-icon svg-icon" />}
                <div className="burger-item-text">
                  <strong>{heroMuted ? 'Activar sonido del video' : 'Silenciar video'}</strong>
                </div>
              </button>
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
        <TemuStickyHeaderBar />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', width: '100%', marginTop: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="categories-carousel" style={{ paddingBottom: '0.25rem' }}>
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
          </div>
          <button
            className="search-icon-btn"
            onClick={() => { setSearchVisible(v => !v); if (searchVisible) setBusqueda(''); }}
            aria-label="Buscar"
            style={{ margin: 0 }}
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
                <div className="item-img" style={{ aspectRatio: cardImageStyle.aspectRatio !== 'auto' ? cardImageStyle.aspectRatio : undefined, position: 'relative', overflow: 'hidden', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {producto.video_url ? (
                    <video 
                      src={producto.video_url} 
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      preload="metadata"
                      style={cardImageStyle}
                      ref={el => { if (el && el.paused) el.play().catch(() => {}); }}
                    />
                  ) : producto.imagen_url ? (
                    <img
                      src={getOptimizedImageUrl(producto.imagen_url, 500, 75)}
                      alt={producto.nombre}
                      loading={idx < 4 ? "eager" : "lazy"}
                      fetchPriority={idx < 4 ? "high" : "auto"}
                      decoding="async"
                      style={cardImageStyle}
                    />
                  ) : (producto.imagenes_extra && producto.imagenes_extra.length > 0 && decodeExtraImage(producto.imagenes_extra[0]).url) ? (
                    <img
                      src={getOptimizedImageUrl(decodeExtraImage(producto.imagenes_extra[0]).url, 500, 75)}
                      alt={producto.nombre}
                      loading={idx < 4 ? "eager" : "lazy"}
                      fetchPriority={idx < 4 ? "high" : "auto"}
                      decoding="async"
                      style={cardImageStyle}
                    />
                  ) : (
                    <div className="img-placeholder" style={cardImageStyle}></div>
                  )}
                  {producto.es_producto_familiar && (
                    <div className="sku-badge" style={{ top: '0.5rem', background: '#0284c7' }}>👨‍👩‍👧‍👦 Opción Familiar</div>
                  )}
                  
                  <button 
                    className="item-add-btn" 
                    style={{ background: configuracion?.color_primario || 'var(--primary)' }}
                    onClick={e => { 
                      e.stopPropagation(); 
                      const hasOptions = (producto.tallas && producto.tallas.length > 0) || 
                                        (producto.imagenes_extra && producto.imagenes_extra.some(u => Boolean(decodeExtraImage(u).estampado || decodeExtraImage(u).ref))) ||
                                        producto.es_producto_familiar;
                      if (hasOptions) {
                        openDetail(producto);
                      } else {
                        addToCart(producto, 'Única', 'Estándar', 1);
                      }
                    }}
                    aria-label="Añadir al carrito"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="item-details" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{producto.nombre}</h4>
                  
                  {(() => {
                    const priceDetal = getEffectivePrice(producto, 'detal', markupPorcentaje, ajustesProductos, descuentoPromocional);
                    const priceMayor = getEffectivePrice(producto, 'mayorista', markupPorcentaje, ajustesProductos, descuentoPromocional);
                    const hasWholesalePrice = priceMayor > 0 && priceMayor < priceDetal;

                    if (producto.es_producto_familiar) {
                      return (
                        <div style={{ marginTop: '0.1rem' }}>
                          <span style={{ color: '#0284c7', fontWeight: 800, fontSize: '0.92rem' }}>
                            Desde ${priceMayor > 0 ? priceMayor.toLocaleString('es-CO') : priceDetal.toLocaleString('es-CO')}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Opción familiar disponible</span>
                        </div>
                      );
                    }

                    if (hasWholesalePrice) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.1rem' }}>
                          {/* Precio Mayorista Principal con etiqueta de condición */}
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
                            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#166534' }}>
                              ${priceMayor.toLocaleString('es-CO')}
                            </span>
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '0.1rem 0.35rem', borderRadius: '4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                              Por mayor (6+ unds)
                            </span>
                          </div>
                          {/* Precio al Detal */}
                          <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>
                            Detal: <span style={{ textDecoration: ((producto.descuento !== undefined && producto.descuento > 0) || descuentoPromocional > 0) ? 'line-through' : 'none', color: '#475569' }}>${priceDetal.toLocaleString('es-CO')}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div style={{ marginTop: '0.1rem' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                          ${priceDetal.toLocaleString('es-CO')}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '0.35rem' }}>al detal</span>
                      </div>
                    );
                  })()}
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
        <>
          {buyerType === 'mayorista' && totalUnits < 6 && (
            <div style={{ position: 'fixed', bottom: '85px', right: '1.25rem', zIndex: 998, background: 'rgba(15, 23, 42, 0.95)', color: 'white', padding: '0.45rem 0.85rem', borderRadius: '20px', fontSize: '0.76rem', fontWeight: 800, boxShadow: '0 4px 14px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid #38bdf8', backdropFilter: 'blur(6px)' }}>
              <span>📦 Te faltan <strong style={{ color: '#38bdf8' }}>{6 - totalUnits}</strong> {6 - totalUnits === 1 ? 'unidad' : 'unidades'} para compra por mayor (Mín 6 U)</span>
            </div>
          )}
          <button className="floating-cart-btn" onClick={() => setIsCartOpen(true)}>
            <div className="cart-icon-wrapper">
              <ShoppingBag size={22} />
              <span className="cart-badge">{totalItems}</span>
              <span>Ver Carrito</span>
            </div>
            <span className="cart-total-float">${total.toLocaleString('es-CO')}</span>
          </button>
        </>
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

            {/* Temu Multi-Tier Offer Progress Bar inside Cart */}
            {items.length > 0 && (
              <div className="shrine-shipping-bar" style={{ padding: '0.65rem 1.1rem', background: '#ffffff', color: '#0f172a', borderBottom: '1.5px solid var(--primary, #6366f1)' }}>
                {(() => {
                  if (totalUnits < 6) {
                    const remaining = 6 - totalUnits;
                    const pct = Math.min(100, (totalUnits / 6) * 100);
                    return (
                      <div>
                        <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                          <span>🔥 Te faltan <strong style={{ color: 'var(--primary, #6366f1)' }}>{remaining} {remaining === 1 ? 'prenda' : 'prendas'}</strong> para <strong>POR MAYOR</strong></span>
                          <span style={{ fontSize: '0.72rem', background: 'var(--primary, #6366f1)', padding: '0.15rem 0.5rem', borderRadius: '10px', color: '#ffffff', fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0 }}>{totalUnits}/6 unds</span>
                        </p>
                        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary, #6366f1)', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    );
                  } else if (totalUnits < 50) {
                    const remaining50 = 50 - totalUnits;
                    const pct50 = Math.min(100, Math.round(((totalUnits - 6) / 44) * 100));
                    return (
                      <div>
                        <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                          <span>🎉 <strong>¡Por Mayor Activo!</strong> Te faltan <strong style={{ color: '#d97706' }}>{remaining50} prendas</strong> para <strong>50+ Unidades</strong></span>
                          <span style={{ fontSize: '0.72rem', background: '#10b981', padding: '0.15rem 0.5rem', borderRadius: '10px', color: '#ffffff', fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0 }}>{totalUnits}/50 unds</span>
                        </p>
                        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct50}%`, background: 'linear-gradient(90deg, #10b981, #f59e0b)', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#d97706', fontSize: '0.82rem', fontWeight: 800 }}>
                        <span>🏆 ¡MÁXIMO DESCUENTO ACTIVADO (50+ PRENDAS)!</span>
                        <span style={{ background: '#f59e0b', color: '#ffffff', padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.72rem', whiteSpace: 'nowrap', flexShrink: 0 }}>✅ {totalUnits} unds</span>
                      </div>
                    );
                  }
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
                  <label>Número de Cédula / DNI</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.cedula}
                    onChange={e => setFormData({...formData, cedula: e.target.value})}
                    placeholder="Ej. 1098765432"
                  />
                </div>
                <div className="form-group">
                  <label>Correo Electrónico</label>
                  <input 
                    type="email" 
                    required 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    placeholder="Ej. cliente@gmail.com"
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
                  <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '0.2rem', marginBottom: '0.75rem', fontSize: '0.82rem' }}>
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

                {/* ── SELECCIÓN DE MÉTODO / MODALIDAD DE PAGO ── */}
                <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '14px', border: '1.5px solid #cbd5e1', marginTop: '0.2rem', marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                  <label style={{ color: '#0f172a', fontWeight: 800, display: 'block', marginBottom: '0.65rem', fontSize: '0.88rem' }}>
                    📦 Selecciona tu Método de Pago:
                  </label>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <label 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '0.65rem', 
                        padding: '0.75rem 0.85rem', 
                        borderRadius: '12px', 
                        border: `2px solid ${modalidadPago === 'contra_entrega' ? '#ea580c' : '#e2e8f0'}`, 
                        background: modalidadPago === 'contra_entrega' ? '#fff7ed' : '#f8fafc', 
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: modalidadPago === 'contra_entrega' ? '0 2px 8px rgba(234, 88, 12, 0.12)' : 'none'
                      }}
                    >
                      <input 
                        type="radio" 
                        name="modalidadPago" 
                        value="contra_entrega"
                        checked={modalidadPago === 'contra_entrega'}
                        onChange={() => setModalidadPago('contra_entrega')}
                        style={{ accentColor: '#ea580c', width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: modalidadPago === 'contra_entrega' ? '#ea580c' : '#0f172a' }}>
                          🚚 Pago contra entrega
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem', fontWeight: 500, lineHeight: 1.35 }}>
                          Pagas tus productos y el domicilio al recibir.
                        </div>
                      </div>
                    </label>

                    <label 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '0.65rem', 
                        padding: '0.75rem 0.85rem', 
                        borderRadius: '12px', 
                        border: `2px solid ${modalidadPago === 'anticipado' ? '#ea580c' : '#e2e8f0'}`, 
                        background: modalidadPago === 'anticipado' ? '#fff7ed' : '#f8fafc', 
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: modalidadPago === 'anticipado' ? '0 2px 8px rgba(234, 88, 12, 0.12)' : 'none'
                      }}
                    >
                      <input 
                        type="radio" 
                        name="modalidadPago" 
                        value="anticipado"
                        checked={modalidadPago === 'anticipado'}
                        onChange={() => setModalidadPago('anticipado')}
                        style={{ accentColor: '#ea580c', width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: modalidadPago === 'anticipado' ? '#ea580c' : '#0f172a' }}>
                          💳 Pago anticipado
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem', fontWeight: 500, lineHeight: 1.35 }}>
                          Pagas los productos ahora. El domicilio se cancela al recibir.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="cart-footer" style={{ marginTop: 'auto' }}>
                  <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '0.85rem', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    {/* Subtotal Productos */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem', color: '#0f172a', fontWeight: 600 }}>
                      <span>Productos</span>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>${total.toLocaleString('es-CO')}</span>
                    </div>

                    {/* Envío */}
                    <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '0.55rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#0f172a', fontWeight: 600 }}>
                        <span>Envío</span>
                        <span style={{ color: '#d97706', fontWeight: 700, fontSize: '0.78rem', background: '#fef3c7', padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                          ⏳ Pendiente de calcular
                        </span>
                      </div>
                      <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.74rem', color: '#64748b', lineHeight: 1.35, fontWeight: 500 }}>
                        Antes de despachar tu pedido, te enviaremos por WhatsApp el valor exacto del envío para tu confirmación.
                      </p>
                    </div>

                    {/* Total pagado por productos */}
                    <div style={{ borderTop: '1.5px solid #0f172a', paddingTop: '0.55rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>Total pagado por productos</span>
                      <span style={{ fontWeight: 900, fontSize: '1.15rem', color: '#166534' }}>${total.toLocaleString('es-CO')}</span>
                    </div>
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
                            <button onClick={() => updateQuantity(item.id, item.cantidad - 1, item.talla, item.estampado, item.nombre)}>-</button>
                            <span>{item.cantidad}</span>
                            <button onClick={() => updateQuantity(item.id, item.cantidad + 1, item.talla, item.estampado, item.nombre)}>+</button>
                          </div>
                        </div>
                        <button className="cart-item-remove" onClick={() => removeFromCart(item.id, item.talla, item.estampado, item.nombre)}>
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
                  {buyerType === 'mayorista' && totalUnits < 6 && (
                    <div style={{ marginBottom: '0.5rem', background: '#fef2f2', border: '1px solid #fecdd3', color: '#991b1b', padding: '0.45rem 0.65rem', borderRadius: '8px', fontSize: '0.76rem', fontWeight: 700, textAlign: 'center' }}>
                      ⚠️ Mínimo 6 unidades para comprar al por mayor. Agrega {6 - totalUnits} {6 - totalUnits === 1 ? 'unidad más' : 'unidades más'} a tu carrito.
                    </div>
                  )}
                  <button 
                    className="checkout-btn" 
                    disabled={items.length === 0}
                    onClick={() => {
                      if (buyerType === 'mayorista' && totalUnits < 6) {
                        alert(`Tienes que comprar mínimo 6 unidades para poder comprar en nuestro catálogo mayorista. Actualmente llevas ${totalUnits} ${totalUnits === 1 ? 'unidad' : 'unidades'}. Agrega ${6 - totalUnits} más a tu carrito o cambia a modo Detal.`);
                        return;
                      }
                      setIsCheckoutMode(true);
                    }}
                    style={{ padding: '0.75rem', fontSize: '0.95rem', borderRadius: '12px', background: (buyerType === 'mayorista' && totalUnits < 6) ? '#cbd5e1' : undefined, opacity: (buyerType === 'mayorista' && totalUnits < 6) ? 0.85 : 1 }}
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
        let rawTallas = detailProduct.tallas?.split(',').map(t => t.trim()).filter(Boolean) || [];
        if (detailProduct.es_producto_familiar) {
          if (selectedMiembroFamilia === 'nino') {
            const childSizes = ['4', '6', '8', '10', '12', '14', '16'];
            const customChildSizes = Object.keys((detailProduct.precios_familia as any)?.precios_tallas || {}).filter(k => k !== 'Dama' && k !== 'Caballero');
            rawTallas = Array.from(new Set([...childSizes, ...customChildSizes]));
          } else if (selectedMiembroFamilia === 'hombre' || selectedMiembroFamilia === 'mujer') {
            rawTallas = ['Única'];
          }
        }
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
                {/* ── LABELS REFERENCIA Y ESTAMPADO (ABAJO IZQUIERDO) ── */}
                <div style={{ position: 'absolute', bottom: '0.65rem', left: '0.65rem', right: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', zIndex: 10, alignItems: 'flex-start', pointerEvents: 'none' }}>
                  <div style={{ fontSize: '0.72rem', padding: '0.28rem 0.65rem', background: 'rgba(15, 23, 42, 0.92)', color: 'white', fontWeight: 700, borderRadius: '8px', backdropFilter: 'blur(4px)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', maxWidth: '100%', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}>
                    Ref: {detailProduct.nombre} {(detailProduct.referencia || detailProduct.sku) ? `(${detailProduct.referencia || detailProduct.sku})` : ''}
                  </div>
                  {currentImgRef && (
                    <div style={{ fontSize: '0.74rem', padding: '0.3rem 0.7rem', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: 'white', fontWeight: 800, borderRadius: '8px', backdropFilter: 'blur(4px)', boxShadow: '0 2px 10px rgba(2, 132, 199, 0.4)', maxWidth: '100%', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}>
                      Estampado: {currentImgRef}
                    </div>
                  )}
                </div>
              </div>

              {/* ── INFO ── */}
              <div className="detail-info">
                <div className="detail-header-row">
                  <h3 className="detail-name">{detailProduct.nombre}</h3>
                  <div className="detail-price-wrap" style={{ textAlign: 'right' }}>
                    {(() => {
                      const activeUnitPriceDetal = getActiveUnitPrice(detailProduct, selectedMiembroFamilia, selectedTalla, 'detal');
                      const activeUnitPriceMayor = getActiveUnitPrice(detailProduct, selectedMiembroFamilia, selectedTalla, 'mayorista');
                      const priceDetal = getEffectivePrice({ ...detailProduct, precio: activeUnitPriceDetal }, 'detal', markupPorcentaje, ajustesProductos, descuentoPromocional);
                      const priceMayor = getEffectivePrice({ ...detailProduct, precio: activeUnitPriceMayor }, 'mayorista', markupPorcentaje, ajustesProductos, descuentoPromocional);
                      const hasWholesale = priceMayor > 0 && priceMayor < priceDetal;

                      if (hasWholesale) {
                        return (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end' }}>
                              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#166534' }}>
                                ${priceMayor.toLocaleString('es-CO')}
                              </span>
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '0.15rem 0.4rem', borderRadius: '6px' }}>
                                Por mayor (6+ unds)
                              </span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                              Detal: ${priceDetal.toLocaleString('es-CO')}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div>
                          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                            ${priceDetal.toLocaleString('es-CO')}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.3rem' }}>al detal</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                {detailProduct.descripcion && (
                  <p className="detail-desc">{detailProduct.descripcion}</p>
                )}

                {/* ── PRODUCTO FAMILIAR OPTION SELECTOR WITH QUANTITIES ── */}
                {detailProduct.es_producto_familiar && detailProduct.precios_familia ? (
                  <div className="detail-tallas" style={{ width: '100%', background: '#f0f9ff', padding: '0.85rem', borderRadius: '14px', border: '1.5px solid #bae6fd', marginBottom: '0.85rem' }}>
                    <p className="detail-section-label" style={{ color: '#0369a1', fontWeight: 800, marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.88rem' }}>
                      👨‍👩‍👧‍👦 Selecciona la Cantidad para cada Opción y Talla:
                    </p>

                    {/* ADULTOS / UNISEX */}
                    <div style={{ marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                        👔 Opciones Adultos / Unisex
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: '0.4rem' }}>
                        {[
                          { key: 'dama_unica', label: '👩 Dama Única' },
                          { key: 'dama_plus', label: '👩 Dama Plus' },
                          { key: 'caballero_unica', label: '👨 Caballero Única' },
                          { key: 'unisex_2xl', label: '🧑 2XL Unisex' }
                        ].map(opt => {
                          const optUnitPrice = getActiveUnitPrice(detailProduct, opt.key, 'Única', buyerType);
                          const optPrice = getEffectivePrice({ ...detailProduct, precio: optUnitPrice }, buyerType, markupPorcentaje, ajustesProductos, descuentoPromocional);
                          const qty = famOptionQuantities[opt.key] || 0;
                          return (
                            <div
                              key={opt.key}
                              style={{
                                padding: '0.5rem 0.35rem',
                                borderRadius: '10px',
                                border: qty > 0 ? '2px solid #0284c7' : '1px solid #cbd5e1',
                                background: qty > 0 ? '#e0f2fe' : '#ffffff',
                                textAlign: 'center',
                                boxShadow: qty > 0 ? '0 2px 8px rgba(2,132,199,0.2)' : 'none'
                              }}
                            >
                              <div style={{ fontWeight: 800, fontSize: '0.76rem', color: '#0f172a' }}>{opt.label}</div>
                              <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 800, margin: '0.15rem 0 0.35rem' }}>
                                ${optPrice.toLocaleString('es-CO')}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                                <button
                                  type="button"
                                  onClick={() => setFamOptionQuantities(prev => ({ ...prev, [opt.key]: Math.max(0, (prev[opt.key] || 0) - 1) }))}
                                  style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                                >
                                  −
                                </button>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, minWidth: '16px', textAlign: 'center', color: '#0f172a' }}>{qty}</span>
                                <button
                                  type="button"
                                  onClick={() => setFamOptionQuantities(prev => ({ ...prev, [opt.key]: (prev[opt.key] || 0) + 1 }))}
                                  style={{ width: '24px', height: '24px', borderRadius: '6px', border: 'none', background: '#0284c7', color: 'white', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* NIÑOS POR TALLAS */}
                    <div>
                      <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0369a1', display: 'block', marginBottom: '0.35rem' }}>
                        👶 Tallas Infantiles (Niños)
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.4rem' }}>
                        {['2/4', '6/8', '10/12', '14/16', '18'].map(sz => {
                          const optUnitPrice = getActiveUnitPrice(detailProduct, 'nino', sz, buyerType);
                          const optPrice = getEffectivePrice({ ...detailProduct, precio: optUnitPrice }, buyerType, markupPorcentaje, ajustesProductos, descuentoPromocional);
                          const qty = famOptionQuantities[sz] || 0;
                          return (
                            <div
                              key={sz}
                              style={{
                                padding: '0.55rem 0.35rem',
                                borderRadius: '10px',
                                border: qty > 0 ? '2px solid #0284c7' : '1px solid #bae6fd',
                                background: qty > 0 ? '#e0f2fe' : '#ffffff',
                                textAlign: 'center',
                                boxShadow: qty > 0 ? '0 2px 8px rgba(2,132,199,0.2)' : 'none'
                              }}
                            >
                              <div style={{ fontWeight: 800, fontSize: '0.76rem', color: '#0f172a' }}>Talla {sz}</div>
                              <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 800, margin: '0.15rem 0 0.35rem' }}>
                                ${optPrice.toLocaleString('es-CO')}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                                <button
                                  type="button"
                                  onClick={() => setFamOptionQuantities(prev => ({ ...prev, [sz]: Math.max(0, (prev[sz] || 0) - 1) }))}
                                  style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                                >
                                  −
                                </button>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, minWidth: '16px', textAlign: 'center', color: '#0f172a' }}>{qty}</span>
                                <button
                                  type="button"
                                  onClick={() => setFamOptionQuantities(prev => ({ ...prev, [sz]: (prev[sz] || 0) + 1 }))}
                                  style={{ width: '24px', height: '24px', borderRadius: '6px', border: 'none', background: '#0284c7', color: 'white', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* ── ESTAMPADOS + TALLAS + CANTIDAD ── */}
                <div className="detail-controls-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', alignItems: 'stretch' }}>
                  {(() => {
                    const imgEstampados = allImages.map(img => (img.estampado || img.ref)?.trim().toUpperCase()).filter(Boolean);
                    const estampados = imgEstampados.length > 0 ? Array.from(new Set(imgEstampados)) : legacyEstampados;
                    
                    if (estampados.length === 0) return null;
                    return (
                      <div className="detail-tallas" style={{ width: '100%' }}>
                        <p className="detail-section-label" style={{ marginBottom: '0.4rem' }}>Estampado / Temática</p>
                        
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

                  {!detailProduct.es_producto_familiar && (
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
                  )}
                </div>

                <div style={{ marginTop: '0.85rem' }} />

                {/* ── ADD TO CART ── */}
                {(() => {
                  if (detailProduct.es_producto_familiar) {
                    const totalFamUnits = Object.values(famOptionQuantities).reduce((sum, q) => sum + (q > 0 ? q : 0), 0);
                    const totalFamPrice = Object.entries(famOptionQuantities).reduce((sum, [key, q]) => {
                      if (q <= 0) return sum;
                      let tVal = 'Única';
                      let memberVal = key;
                      if (['2/4', '6/8', '10/12', '14/16', '18'].includes(key)) {
                        tVal = key;
                        memberVal = 'nino';
                      }
                      const uPrice = getActiveUnitPrice(detailProduct, memberVal, tVal, buyerType);
                      const effPrice = getEffectivePrice({ ...detailProduct, precio: uPrice }, buyerType, markupPorcentaje, ajustesProductos, descuentoPromocional);
                      return sum + (effPrice * q);
                    }, 0);

                    return (
                      <button className="detail-add-btn" onClick={handleAddFromDetail}>
                        <ShoppingCart size={18} />
                        {totalFamUnits > 0
                          ? `Añadir al carrito • $${totalFamPrice.toLocaleString('es-CO')} (${totalFamUnits} prenda${totalFamUnits > 1 ? 's' : ''})`
                          : 'Añadir al carrito (Selecciona cantidades)'}
                      </button>
                    );
                  }
                  return (
                    <button className="detail-add-btn" onClick={handleAddFromDetail}>
                      <ShoppingCart size={18} />
                      Añadir al carrito • ${(getEffectivePrice({ ...detailProduct, precio: getActiveUnitPrice(detailProduct, selectedMiembroFamilia, selectedTalla, buyerType) }, buyerType, markupPorcentaje, ajustesProductos, descuentoPromocional) * selectedCantidad).toLocaleString('es-CO')}
                    </button>
                  );
                })()}
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
      {/* ── Modal Aviso de Bienvenida Estilo Temu & Hub de Juegos ── */}
      {minijuegosActivos && (
        <>
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

          <JuegosHubModal
            isOpen={isGameModalOpen}
            onClose={() => setIsGameModalOpen(false)}
            onApplyCoupon={(porcentaje) => setDescuentoPromocional(porcentaje)}
            onApplyFreeShipping={() => {
              try {
                const shippingGift: Producto = {
                  id: 'regalo-envio-gratis-' + Date.now(),
                  nombre: '🚚 REGALO: Envío Gratis en tu Pedido',
                  precio: 0,
                  categoria: 'regalo',
                  subcategoria: 'regalo',
                  stock: 999,
                  imagen_url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=400',
                  descripcion: '¡Ganado en el juego Supervivencia Stitch!',
                  created_at: new Date().toISOString()
                };
                addToCart(shippingGift, 'Única', 'Estándar', 1);
              } catch (e) {}
            }}
            onAddFreeGift={(nombreGift) => {
              try {
                const giftItem: Producto = {
                  id: 'regalo-juego-' + Date.now(),
                  nombre: nombreGift,
                  precio: 0,
                  categoria: 'regalo',
                  subcategoria: 'regalo',
                  stock: 999,
                  imagen_url: 'https://images.unsplash.com/photo-1596814234568-19ebcc1af3fa?auto=format&fit=crop&q=80&w=400',
                  descripcion: '¡Premio ganado en el centro de juegos!',
                  created_at: new Date().toISOString()
                };
                addToCart(giftItem, 'Única', 'Estándar', 1);
              } catch (e) {}
            }}
            tenantId={getTenantId()}
          />
        </>
      )}

      {/* Temu-Style Offer Toast */}
      <TemuOfferToast />
    </div>
  );
}
