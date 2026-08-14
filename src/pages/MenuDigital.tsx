import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase, getTenantId, normalizeTenantId, findClosestTenant } from '../lib/supabase';
import { updatePWAManifestAndIcons } from '../lib/pwa';
import type { Producto, Categoria, Subcategoria, Configuracion } from '../types';
import { Loader2, Search, Plus, ShoppingBag, X, ShoppingCart, Volume2, VolumeX, Package, HelpCircle, RefreshCw, Menu, Check, Filter, LayoutGrid, Users, Sparkles, Shirt, Baby, Moon, Layers, Tag, Heart, Gift, ChevronDown, Share2, Trash2, CreditCard, MessageCircle, ArrowLeft, ChevronRight } from 'lucide-react';
import { useCart, getEffectivePrice } from '../context/CartContext';
import PqrsModal from '../components/PqrsModal';
import { getOptimizedImageUrl } from '../lib/imageOptimizer';
import { PromoWelcomeBanner as TemuWelcomeBanner } from '../components/NochePerfectaGameModal';
import { JuegosHubModal } from '../components/JuegosHubModal';
import { DEPARTAMENTOS_COLOMBIA, TODAS_LAS_CIUDADES_COLOMBIA } from '../data/colombiaData';
import WhatsAppPhoneVerifier, { validateWhatsAppPhone } from '../components/WhatsAppPhoneVerifier';
import AddressVerifier, { validateAddressFormat } from '../components/AddressVerifier';
import './MenuDigital.css';

const DEFAULT_LOGOS: Record<string, string> = {
  'saramantha': 'https://dowbsbxvxjzjjhyqmyfr.supabase.co/storage/v1/object/public/archivos/logo_1782527997229.jpg',
  'lucerito': 'https://dowbsbxvxjzjjhyqmyfr.supabase.co/storage/v1/object/public/archivos/logo_1785611120589.webp',
};

// Ejecutar sincrónicamente para evitar parpadeo de color
try {
  const tId = getTenantId();
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

const toTitleCase = (str?: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '')
    .join(' ');
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
  const [isBurgerCatOpen, setIsBurgerCatOpen] = useState(false);

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
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  const getCategoryCount = (catSlug: string, catNombre: string) => {
    return productos.filter(p => {
      const pCat = (p.categoria || '').toLowerCase().trim();
      return pCat === catSlug.toLowerCase().trim() || pCat === catNombre.toLowerCase().trim();
    }).length;
  };
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isPqrsOpen, setIsPqrsOpen] = useState(false);
  const [isCheckoutMode, setIsCheckoutMode] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1);
  const [metodoRecepcion, setMetodoRecepcion] = useState<'domicilio' | 'tienda'>('domicilio');
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>('');
  const [isCityFocused, setIsCityFocused] = useState<boolean>(false);
  const [orderSummaryData, setOrderSummaryData] = useState<{
    orderCode: string;
    subtotal: number;
    total: number;
    metodoPagoLabel: string;
    modalidadPago: 'transferencia' | 'contra_entrega' | 'whatsapp';
    whatsappUrl: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState(false);
  const [overrideWhatsApp, setOverrideWhatsApp] = useState<string | null>(null);
  const [heroMuted, setHeroMuted] = useState(true);
  const [showTipoModal, setShowTipoModal] = useState(false);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [showTemuBanner, setShowTemuBanner] = useState(false);
  const [isBurgerMenuOpen, setIsBurgerMenuOpen] = useState(false);
  const [recommendedIdx, setRecommendedIdx] = useState(0);
  const [isRecommendedAnimating, setIsRecommendedAnimating] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [activeAsesor, setActiveAsesor] = useState<{ nombre: string; foto_url?: string; telefono?: string } | null>(null);
  const [typoModal, setTypoModal] = useState<{ rawSlug: string; targetName: string; canonicalSlug: string } | null>(null);
  const [countdown, setCountdown] = useState(5);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const rawPath = window.location.pathname.replace(/^\/+/g, '').trim().split('/')[0].toLowerCase();
    if (rawPath) {
      const match = findClosestTenant(rawPath);
      if (match && match.isTypo) {
        setTypoModal({
          rawSlug: rawPath,
          targetName: match.name,
          canonicalSlug: match.canonicalSlug
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!typoModal) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          const params = window.location.search;
          window.location.href = `/${typoModal.canonicalSlug}${params}`;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [typoModal]);

  useEffect(() => {
    async function loadWholesalerMarkup(phone: string) {
      try {
        const tenant = getTenantId();
        let matchAsesor: any = null;

        if (phone) {
          const cleanQuery = phone.replace(/\D/g, '');
          const normQuery = cleanQuery.length === 12 && cleanQuery.startsWith('57') ? cleanQuery.substring(2) : cleanQuery;

          // 1. Buscar por número de teléfono
          const { data: allAsesores } = await supabase
            .from('asesores')
            .select('id, nombre, telefono, foto_url, tenant_id')
            .like('telefono', `%${normQuery}%`);

          matchAsesor = allAsesores?.[0] || null;

          if (!matchAsesor) {
            const { data: allFallback } = await supabase
              .from('asesores')
              .select('id, nombre, telefono, foto_url, tenant_id');

            matchAsesor = allFallback?.find(a => {
              if (!a.telefono) return false;
              const phoneList = a.telefono.split(',').map((p: string) => {
                const clean = p.replace(/\D/g, '');
                return clean.length === 12 && clean.startsWith('57') ? clean.substring(2) : clean;
              }).filter(Boolean);
              return phoneList.some((p: string) => p === normQuery || p.includes(normQuery) || normQuery.includes(p));
            }) || null;
          }
        }

        // Si no hay teléfono o no hubo coincidencia por teléfono, seleccionar asesor mediante rotación equitativa por turnos (Round-Robin)
        if (!matchAsesor) {
          const { data: tenantAsesores } = await supabase
            .from('asesores')
            .select('id, nombre, telefono, foto_url, tenant_id')
            .eq('tenant_id', tenant);

          if (tenantAsesores && tenantAsesores.length > 0) {
            // Ordenar de forma estable por ID para garantizar siempre la misma secuencia
            tenantAsesores.sort((a, b) => (a.id || '').localeCompare(b.id || ''));

            const storageKey = `last_asesor_idx_${tenant}`;
            let lastIdx = parseInt(localStorage.getItem(storageKey) || '-1', 10);
            if (isNaN(lastIdx) || lastIdx < 0 || lastIdx >= tenantAsesores.length) {
              lastIdx = -1;
            }

            const nextIdx = (lastIdx + 1) % tenantAsesores.length;
            localStorage.setItem(storageKey, nextIdx.toString());
            matchAsesor = tenantAsesores[nextIdx];
          } else {
            // Si el tenant no tiene asesores específicos, cargar de forma secuencial global
            const { data: globalAsesores } = await supabase
              .from('asesores')
              .select('id, nombre, telefono, foto_url, tenant_id');
            if (globalAsesores && globalAsesores.length > 0) {
              globalAsesores.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
              const storageKey = `last_asesor_idx_global`;
              let lastIdx = parseInt(localStorage.getItem(storageKey) || '-1', 10);
              if (isNaN(lastIdx) || lastIdx < 0 || lastIdx >= globalAsesores.length) {
                lastIdx = -1;
              }
              const nextIdx = (lastIdx + 1) % globalAsesores.length;
              localStorage.setItem(storageKey, nextIdx.toString());
              matchAsesor = globalAsesores[nextIdx];
            }
          }
        }

        if (matchAsesor) {
          const primerTel = (matchAsesor.telefono || '').split(',')[0].trim();
          const cleanAssignedPhone = (phone || primerTel).replace(/\D/g, '');

          setActiveAsesor({
            nombre: matchAsesor.nombre || 'Asesor Comercial',
            foto_url: matchAsesor.foto_url || '',
            telefono: phone || primerTel
          });

          // Guardar el asesor asignado en la sesión
          if (cleanAssignedPhone) {
            setOverrideWhatsApp(cleanAssignedPhone);
            sessionStorage.setItem(`ws_override_${tenant}`, cleanAssignedPhone);
          }
        }

        // 2. Buscar en mayoristas para markup y branding
        if (phone) {
          const cleanQuery = phone.replace(/\D/g, '');
          const normQuery = cleanQuery.length === 12 && cleanQuery.startsWith('57') ? cleanQuery.substring(2) : cleanQuery;

          const { data: mayoristasTenant } = await supabase
            .from('mayoristas')
            .select('id, telefono, porcentaje_ganancia, ajustes_productos, nombre_negocio, logo_url, video_hero_url')
            .eq('tenant_id', tenant);

          let matchMayorista = mayoristasTenant?.find(m => {
            const phones = (m.telefono || '').split(',').map((p: string) => {
              const clean = p.replace(/\D/g, '');
              return clean.length === 12 && clean.startsWith('57') ? clean.substring(2) : clean;
            }).filter(Boolean);
            return phones.includes(normQuery);
          });

          if (!matchMayorista) {
            const { data: mayoristasGlobal } = await supabase
              .from('mayoristas')
              .select('id, telefono, porcentaje_ganancia, ajustes_productos, nombre_negocio, logo_url, video_hero_url');
            matchMayorista = mayoristasGlobal?.find(m => {
              const phones = (m.telefono || '').split(',').map((p: string) => {
                const clean = p.replace(/\D/g, '');
                return clean.length === 12 && clean.startsWith('57') ? clean.substring(2) : clean;
              }).filter(Boolean);
              return phones.includes(normQuery);
            });
          }

          if (matchMayorista) {
            setMarkupPorcentaje(Number((matchMayorista as any).porcentaje_ganancia) || 0);
            setAjustesProductos((matchMayorista as any).ajustes_productos || {});
            setMayoristaBranding({ 
              nombre: (matchMayorista as any).nombre_negocio || '', 
              logo: (matchMayorista as any).logo_url || '', 
              video: (matchMayorista as any).video_hero_url || '' 
            });
            setBuyerType('detal');
          }
        }
      } catch (err) {
        console.error("Error loading wholesaler markup: ", err);
      }
    }

    const params = new URLSearchParams(window.location.search);
    const wsParam = params.get('ws') || params.get('asesor') || params.get('wa') || params.get('linea') || params.get('telefono') || params.get('ref');
    let phoneToQuery = '';
    if (wsParam) {
      if (wsParam === 'clear') {
        sessionStorage.removeItem(`ws_override_${getTenantId()}`);
        sessionStorage.removeItem(`ws_explicit_${getTenantId()}`);
        setOverrideWhatsApp(null);
        setMarkupPorcentaje(0);
      } else {
        const cleanNum = wsParam.replace(/\D/g, '');
        if (cleanNum) {
          setOverrideWhatsApp(cleanNum);
          sessionStorage.setItem(`ws_override_${getTenantId()}`, cleanNum);
          sessionStorage.setItem(`ws_explicit_${getTenantId()}`, 'true');
          phoneToQuery = cleanNum;
        }
      }
    } else {
      const isExplicit = sessionStorage.getItem(`ws_explicit_${getTenantId()}`) === 'true';
      const savedOverride = sessionStorage.getItem(`ws_override_${getTenantId()}`);
      if (isExplicit && savedOverride) {
        setOverrideWhatsApp(savedOverride);
        phoneToQuery = savedOverride;
      } else {
        // Enlaces directos a la tienda sin asesor previo: rotación secuencial (Round-Robin) en cada nueva visita
        sessionStorage.removeItem(`ws_override_${getTenantId()}`);
        phoneToQuery = '';
      }
    }

    // Siempre ejecutar para cargar el asesor por turno o específico
    loadWholesalerMarkup(phoneToQuery);

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
    const storeLogo = mayoristaBranding?.logo || configuracion?.logo_url || DEFAULT_LOGOS[tenant] || '';

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

  const isFamOptionDisabled = (prod: Producto, adminKey: string): boolean => {
    if (!prod.es_producto_familiar || !prod.precios_familia) return false;
    const fam = prod.precios_familia as any;
    const disabledList: string[] = fam.opciones_deshabilitadas || [];
    if (disabledList.includes(adminKey)) return true;
    const det = fam.precios_detallados?.[adminKey];
    if (det && det.deshabilitado === true) return true;
    return false;
  };

  const getFamilyPriceRange = (prod: Producto) => {
    if (!prod.es_producto_familiar || !prod.precios_familia) {
      return { minDetal: prod.precio || 0, minMayor: prod.precio_por_mayor || 0 };
    }
    const fam = prod.precios_familia as any || {};
    const preciosDetallados = fam.precios_detallados || {};
    const preciosMap = fam.precios_tallas || {};
    const disabledList: string[] = fam.opciones_deshabilitadas || [];

    const optionKeys = ['Dama Única', 'Dama Plus', 'Caballero Única', '2XL Unisex', '2/4', '6/8', '10/12', '14/16', '18'];
    Object.keys(preciosDetallados).forEach(k => { if (!optionKeys.includes(k)) optionKeys.push(k); });
    Object.keys(preciosMap).forEach(k => { if (!optionKeys.includes(k)) optionKeys.push(k); });

    const detalPrices: number[] = [];
    const mayorPrices: number[] = [];

    optionKeys.forEach(key => {
      const isOff = disabledList.includes(key) || preciosDetallados[key]?.deshabilitado === true;
      if (isOff) return;

      const optObj = preciosDetallados[key];
      let d = 0;
      let m = 0;
      if (optObj) {
        d = Number(optObj.detal || 0);
        m = Number(optObj.mayor || 0);
      }
      if (d <= 0 && preciosMap[key] > 0) d = Number(preciosMap[key]);

      if (d <= 0) {
        if (key === 'Dama Única' && fam.dama_unica) d = Number(fam.dama_unica);
        else if (key === 'Dama Plus' && fam.dama_plus) d = Number(fam.dama_plus);
        else if (key === 'Caballero Única' && fam.caballero_unica) d = Number(fam.caballero_unica);
        else if (key === '2XL Unisex' && fam.unisex_2xl) d = Number(fam.unisex_2xl);
        else if (['2/4', '6/8', '10/12', '14/16', '18'].includes(key) && fam.nino) d = Number(fam.nino);
      }

      if (d > 5) detalPrices.push(d);
      if (m > 5) mayorPrices.push(m);
    });

    const minDetalRaw = detalPrices.length > 0 ? Math.min(...detalPrices) : (prod.precio > 5 ? prod.precio : 0);
    const minMayorRaw = mayorPrices.length > 0 ? Math.min(...mayorPrices) : 0;

    const minDetal = minDetalRaw > 0 ? getEffectivePrice({ ...prod, precio: minDetalRaw }, 'detal', markupPorcentaje, ajustesProductos, descuentoPromocional) : 0;
    const minMayor = minMayorRaw > 0 ? getEffectivePrice({ ...prod, precio: minMayorRaw }, 'mayorista', markupPorcentaje, ajustesProductos, descuentoPromocional) : 0;

    return { minDetal, minMayor };
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

      const { minDetal, minMayor } = getFamilyPriceRange(prod);
      if (currentBuyerMode === 'mayorista' && minMayor > 0) return minMayor;
      if (minDetal > 0) return minDetal;
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
    barrio: '',
    ciudad: ''
  });
  const [modalidadPago, setModalidadPago] = useState<'transferencia' | 'contra_entrega' | 'whatsapp'>('transferencia');
  const [leadId, setLeadId] = useState<string | null>(null);

  const leadIdRef = useRef<string | null>(null);
  const isInsertingRef = useRef(false);
  const isOrderSubmittedRef = useRef(false);
  const [isPagoSeleccionado, setIsPagoSeleccionado] = useState(true);  // Transferencia Bancaria predefinida
  const [isEnvioSeleccionado, setIsEnvioSeleccionado] = useState(true); // Domicilio predefinido

  const getStoreWhatsAppNumber = (customerPhone?: string) => {
    const cleanCustomer = (customerPhone || formData?.telefono || '').replace(/\D/g, '');
    const cleanOverride = (overrideWhatsApp || '').replace(/\D/g, '');
    if (cleanOverride && cleanOverride !== cleanCustomer && cleanOverride.length >= 7) {
      return cleanOverride;
    }
    return (configuracion?.whatsapp || '573185637317').replace(/\D/g, '');
  };

  const saveOrUpdateLead = async (customFormData = formData) => {
    if (isOrderSubmittedRef.current) return;
    const cleanPhone = (customFormData.telefono || '').replace(/\D/g, '');
    const currentLeadId = leadIdRef.current || leadId;
    
    // Guardar borrador desde que ingresa al menos 7 dígitos en el teléfono y tenga productos en el carrito.
    // Si ya existe un leadId, actualiza la información con cada cambio.
    if ((!currentLeadId && cleanPhone.length < 7) || items.length === 0) return;

    try {
      const tenant = getTenantId();
      const numeroWhatsApp = getStoreWhatsAppNumber(customFormData.telefono);
      
      const metodoEnvioLabel = isEnvioSeleccionado 
        ? (metodoRecepcion === 'tienda' 
          ? `Recoger en Tienda (${configuracion?.direccion || 'Sede Principal'})` 
          : `Envío a domicilio`)
        : 'Por definir';

      const metodoPagoLabel = isPagoSeleccionado 
        ? (modalidadPago === 'transferencia' 
          ? '[ Transferencia Bancaria ]' 
          : modalidadPago === 'contra_entrega' 
          ? '[ Pago Contra Entrega ]' 
          : '[ Coordinar por WhatsApp ]')
        : 'Por definir';

      let buyerLabel = '';
      if (buyerType === 'mayorista') buyerLabel = 'Mayorista';
      else if (buyerType === '50_unidades') buyerLabel = '50+ unidades';
      else buyerLabel = isBulkDiscountApplied ? 'Al detal (Con descuento por mayor)' : 'Al detal';

      const productosProcesados = items.map(item => {
        const effectivePrice = getEffectivePrice(item, effectiveCartBuyerType, markupPorcentaje, ajustesProductos, descuentoPromocional);
        const isWholesale = effectiveCartBuyerType === 'mayorista' || isBulkDiscountApplied || buyerType === 'mayorista';
        return {
          ...item,
          precio_detal: item.precio_detal || item.precio,
          precio: effectivePrice,
          precio_aplicado_mayor: isWholesale,
          _metodo_pago: metodoPagoLabel,
          _metodo_envio: metodoEnvioLabel,
          _tipo_compra: buyerLabel,
          _departamento: selectedDepartamento || ''
        };
      });

      const ciudadFormateada = customFormData.ciudad 
        ? (selectedDepartamento && !customFormData.ciudad.includes(selectedDepartamento) ? `${customFormData.ciudad}, ${selectedDepartamento}` : customFormData.ciudad)
        : (selectedDepartamento || '');

      let direccionFormateada = '';
      if (isEnvioSeleccionado && metodoRecepcion === 'tienda') {
        direccionFormateada = `Recoger en Tienda (${configuracion?.direccion || 'Sede Principal'})`;
      } else {
        const barrioTxt = customFormData.barrio ? ` (Barrio: ${customFormData.barrio.trim()})` : '';
        direccionFormateada = customFormData.direccion ? `${customFormData.direccion.trim()}${barrioTxt}` : '';
      }

      const cedVal = (customFormData.cedula || '').trim();
      const emailVal = (customFormData.email || '').trim();

      // Payload completo para alimentar en tiempo real el Lead / Carrito Abandonado
      const basePayload: any = {
        nombre: customFormData.nombre.trim() || 'Cliente Anónimo',
        telefono: customFormData.telefono.trim(),
        ciudad: ciudadFormateada || 'Por definir',
        direccion: direccionFormateada,
        cedula: cedVal,
        cliente_cedula: cedVal,
        email: emailVal,
        cliente_email: emailVal,
        tenant_id: tenant,
        estado: 'abandonado',
        linea_whatsapp: numeroWhatsApp,
        productos: productosProcesados,
        total: total,
        metodo_pago: metodoPagoLabel,
        metodo_envio: metodoEnvioLabel,
        modalidad_pago: isPagoSeleccionado ? modalidadPago : 'por_definir',
        metodo_recepcion: isEnvioSeleccionado ? metodoRecepcion : 'por_definir',
        tipo_compra: buyerLabel,
        departamento: selectedDepartamento || ''
      };

      const currentId = leadIdRef.current || leadId;

      if (currentId) {
        // Intento 1: payload completo
        let { error: updateErr } = await supabase.from('leads').update(basePayload).eq('id', currentId);
        
        if (updateErr) {
          console.warn('Lead update con campos completos falló, reintentando sin columnas extendidas:', updateErr.message);
          const p1 = { ...basePayload }; 
          delete p1.metodo_envio; delete p1.modalidad_pago; delete p1.metodo_recepcion; delete p1.tipo_compra; delete p1.departamento;
          let { error: err1 } = await supabase.from('leads').update(p1).eq('id', currentId);
          if (err1) {
            console.warn('Lead update p1 falló, probando sin campos opcionales:', err1.message);
            const p2 = { ...basePayload }; 
            delete p2.cliente_cedula; delete p2.cliente_email; delete p2.cedula; delete p2.email; delete p2.metodo_envio; delete p2.modalidad_pago; delete p2.metodo_recepcion; delete p2.tipo_compra; delete p2.departamento;
            let { error: err2 } = await supabase.from('leads').update(p2).eq('id', currentId);
            if (err2) {
              const p3 = {
                nombre: basePayload.nombre,
                telefono: basePayload.telefono,
                ciudad: basePayload.ciudad,
                direccion: basePayload.direccion,
                tenant_id: basePayload.tenant_id,
                estado: 'abandonado',
                productos: basePayload.productos,
                total: basePayload.total
              };
              await supabase.from('leads').update(p3).eq('id', currentId);
            }
          }
        }
      } else {
        if (isInsertingRef.current) return;
        isInsertingRef.current = true;
        
        // Intento 1: payload completo
        let { data, error } = await supabase.from('leads').insert(basePayload).select('id').single();

        if (error) {
          console.warn('Lead insert completo falló, reintentando sin columnas extendidas:', error.message);
          const p1 = { ...basePayload }; 
          delete p1.metodo_envio; delete p1.modalidad_pago; delete p1.metodo_recepcion; delete p1.tipo_compra; delete p1.departamento;
          const res1 = await supabase.from('leads').insert(p1).select('id').single();
          data = res1.data; error = res1.error;

          if (error) {
            console.warn('Lead insert p1 falló, probando sin campos opcionales:', error.message);
            const p2 = { ...basePayload }; 
            delete p2.cliente_cedula; delete p2.cliente_email; delete p2.cedula; delete p2.email; delete p2.metodo_envio; delete p2.modalidad_pago; delete p2.metodo_recepcion; delete p2.tipo_compra; delete p2.departamento;
            const res2 = await supabase.from('leads').insert(p2).select('id').single();
            data = res2.data; error = res2.error;

            if (error) {
              console.warn('Lead insert p2 falló, probando con payload ultra esencial p3:', error.message);
              const p3 = {
                nombre: basePayload.nombre,
                telefono: basePayload.telefono,
                ciudad: basePayload.ciudad,
                direccion: basePayload.direccion,
                tenant_id: basePayload.tenant_id,
                estado: 'abandonado',
                productos: basePayload.productos,
                total: basePayload.total
              };
              const res3 = await supabase.from('leads').insert(p3).select('id').single();
              data = res3.data; error = res3.error;
            }
          }
        }

        if (data?.id) {
          setLeadId(data.id);
          leadIdRef.current = data.id;
        }
        isInsertingRef.current = false;
      }
    } catch (err) {
      console.error('Error guardando borrador / carrito abandonado:', err);
      isInsertingRef.current = false;
    }
  };


  // Auto-buscar cliente anterior por teléfono para autocompletar Nombre, Cédula, Ciudad y Dirección
  useEffect(() => {
    const cleanPhone = (formData.telefono || '').replace(/\D/g, '');
    if (cleanPhone.length < 7) return;

    const timer = setTimeout(async () => {
      try {
        const tenant = getTenantId();
        // 1. Buscar en clientes_exitosos
        const { data: clienteExito } = await supabase
          .from('clientes_exitosos')
          .select('*')
          .eq('telefono', cleanPhone)
          .eq('tenant_id', tenant)
          .maybeSingle();

        if (clienteExito && clienteExito.nombre) {
          setFormData(prev => ({
            ...prev,
            nombre: prev.nombre.trim() ? prev.nombre : (clienteExito.nombre || prev.nombre)
          }));
          return;
        }

        // 2. Si no está en clientes_exitosos, buscar en el último pedido realizado
        const { data: ultimoPedido } = await supabase
          .from('pedidos')
          .select('cliente_nombre, cliente_cedula, cliente_email, direccion, ciudad')
          .eq('cliente_telefono', cleanPhone)
          .eq('tenant_id', tenant)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (ultimoPedido && ultimoPedido.cliente_nombre) {
          setFormData(prev => ({
            ...prev,
            nombre: prev.nombre.trim() ? prev.nombre : (ultimoPedido.cliente_nombre || prev.nombre),
            cedula: prev.cedula.trim() ? prev.cedula : (ultimoPedido.cliente_cedula || prev.cedula),
            email: prev.email.trim() ? prev.email : (ultimoPedido.cliente_email || prev.email),
            direccion: prev.direccion.trim() ? prev.direccion : (ultimoPedido.direccion || prev.direccion),
            ciudad: prev.ciudad.trim() ? prev.ciudad : (ultimoPedido.ciudad || prev.ciudad)
          }));
        }
      } catch (e) {
        console.warn('Error autocompletando datos por teléfono:', e);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [formData.telefono]);

  // Disparar o actualizar lead en tiempo real tan pronto el cliente llena o modifica cualquier campo
  useEffect(() => {
    if (isOrderSubmittedRef.current) return;
    const cleanPhone = (formData.telefono || '').replace(/\D/g, '');
    const currentLeadId = leadIdRef.current || leadId;

    // Se dispara desde que hay al menos 7 dígitos en teléfono (o ya existe un leadId) y hay items en el carrito
    if ((!currentLeadId && cleanPhone.length < 7) || items.length === 0) return;

    const delayDebounceFn = setTimeout(() => {
      saveOrUpdateLead(formData);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [formData.nombre, formData.telefono, formData.cedula, formData.email, formData.direccion, formData.ciudad, selectedDepartamento, metodoRecepcion, modalidadPago, items, total, leadId]);

  // Re-disparar lead cuando configuracion cargue (fix race condition: config llega tarde)
  useEffect(() => {
    if (!configuracion) return;
    if (isOrderSubmittedRef.current) return;
    const cleanPhone = (formData.telefono || '').replace(/\D/g, '');
    if (cleanPhone.length < 7 || items.length === 0) return;
    if (leadIdRef.current || leadId) return; // ya existe el lead, no crear duplicado
    
    const t = setTimeout(() => {
      saveOrUpdateLead(formData);
    }, 600);
    return () => clearTimeout(t);
  }, [configuracion]);

  useEffect(() => {
    async function cargarDatos() {
      try {
        const tenant = getTenantId();
        const normT = normalizeTenantId(tenant);
        const tenantFilter = `tenant_id.eq.${tenant},tenant_id.eq.${normT}`;

        const [catRes, subcatRes, confRes] = await Promise.all([
          supabase.from('categorias').select('*').or(tenantFilter).order('orden', { ascending: true }),
          supabase.from('subcategorias').select('*').or(tenantFilter).order('orden', { ascending: true }),
          supabase.from('configuracion').select('*').or(tenantFilter)
        ]);
        
        if (catRes.data) setCategorias(catRes.data);
        if (subcatRes.data) setSubcategorias(subcatRes.data);
        if (confRes.data && confRes.data.length > 0) {
          const matchingTenantConfigs = confRes.data.filter(c => c.tenant_id === tenant || c.tenant_id === normT);
          const bestConfig = matchingTenantConfigs.find(c => c.logo_url || c.video_hero_url) || matchingTenantConfigs[0] || confRes.data[0];
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
    return available.slice(0, 5);
  }, [productos, items]);

  // Auto-rotación de productos recomendados en el carrito cada 3.5s
  useEffect(() => {
    if (!isCartOpen || recommendedProducts.length <= 1) return;
    const interval = setInterval(() => {
      setIsRecommendedAnimating(true);
      setTimeout(() => {
        setRecommendedIdx(prev => (prev + 1) % Math.min(5, recommendedProducts.length));
        setIsRecommendedAnimating(false);
      }, 300);
    }, 3500);
    return () => clearInterval(interval);
  }, [isCartOpen, recommendedProducts.length]);

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
    const metodoPagoLabel = modalidadPago === 'transferencia' 
      ? '[ Transferencia Bancaria ]' 
      : modalidadPago === 'contra_entrega' 
      ? '[ Pago Contra Entrega ]' 
      : '[ Coordinar por WhatsApp ]';

    mensaje += `*Tipo de compra:* ${buyerLabel}\n`;
    mensaje += `*Método de pago:* ${metodoPagoLabel}\n`;
    if (isBulkDiscountApplied) {
      mensaje += `*DESCUENTO AL POR MAYOR APLICADO* (Llevas 6 o mas productos)\n`;
    }
    mensaje += `*Teléfono:* ${formData.telefono}\n`;
    if (formData.email) {
      mensaje += `*Correo:* ${formData.email}\n`;
    }
    const dirTexto = formData.barrio ? `${formData.direccion} (Barrio ${formData.barrio})` : formData.direccion;
    mensaje += `*Dirección:* ${dirTexto}, ${formData.ciudad}\n\n`;
    
    mensaje += `*PRODUCTOS:*\n`;
    const mensajeProductos = items.map(item => 
      `- ${item.cantidad}x ${item.nombre} ${item.talla ? `(Talla: ${item.talla}) ` : ''}${item.estampado ? `(Estampado: ${item.estampado}) ` : ''}- $${(getEffectivePrice(item, effectiveCartBuyerType, markupPorcentaje, ajustesProductos, descuentoPromocional) * item.cantidad).toLocaleString('es-CO')}`
    ).join('\n');
    mensaje += mensajeProductos;
    
    if (modalidadPago === 'transferencia') {
      mensaje += `\n\n*TOTAL PRODUCTOS:* $${total.toLocaleString('es-CO')}`;
      mensaje += `\n*ENVIO:* Pendiente por calcular.`;
      mensaje += `\n\n*Nota de pago:* Por favor solicita los datos de transferencia bancaria para realizar el pago de *$${total.toLocaleString('es-CO')} COP*.`;
    } else if (modalidadPago === 'contra_entrega') {
      mensaje += `\n\n*TOTAL PRODUCTOS:* $${total.toLocaleString('es-CO')}`;
      mensaje += `\n*ENVÍO:* PAGO CONTRA ENTREGA\n\nCancela al momento de recibir tu pedido el valor de las prendas + el costo del envío. ¡Fácil, seguro y sin pagos anticipados!`;
    } else {
      mensaje += `\n\n*TOTAL PRODUCTOS:* $${total.toLocaleString('es-CO')}`;
      mensaje += `\n\n*Coordinacion por WhatsApp:* Acordaremos el pago y envio directamente por este chat.`;
    }

    const numeroWhatsApp = getStoreWhatsAppNumber(formData.telefono);

    let orderId = '';
    // Guardar en la base de datos de pedidos
    try {
      const metodoEnvioLabel = metodoRecepcion === 'tienda' 
        ? `Recoger en Tienda (${configuracion?.direccion || 'Sede Principal'})` 
        : `Envío a domicilio`;

      const metodoPagoStr = metodoPagoLabel;

      const ciudadFormateada = formData.ciudad 
        ? (selectedDepartamento && !formData.ciudad.includes(selectedDepartamento) ? `${formData.ciudad}, ${selectedDepartamento}` : formData.ciudad)
        : (selectedDepartamento || '');

      const direccionFormateada = formData.direccion 
        ? formData.direccion 
        : (metodoRecepcion === 'tienda' ? `Recoger en Tienda (${configuracion?.direccion || 'Sede Principal'})` : '');

      const productosProcesados = items.map(item => {
        const effectivePrice = getEffectivePrice(item, effectiveCartBuyerType, markupPorcentaje, ajustesProductos, descuentoPromocional);
        const isWholesale = effectiveCartBuyerType === 'mayorista' || isBulkDiscountApplied || buyerType === 'mayorista';
        return {
          ...item,
          precio_detal: item.precio_detal || item.precio,
          precio: effectivePrice,
          precio_aplicado_mayor: isWholesale,
          _metodo_pago: metodoPagoStr,
          _metodo_envio: metodoEnvioLabel,
          _tipo_compra: buyerLabel,
          _departamento: selectedDepartamento || ''
        };
      });

      const cedVal = (formData.cedula || '').trim();
      const emailVal = (formData.email || '').trim();

      let direccionConDatos = direccionFormateada;
      if (cedVal && !direccionConDatos.includes(cedVal)) {
        direccionConDatos += ` | CC: ${cedVal}`;
      }
      if (emailVal && !direccionConDatos.includes(emailVal)) {
        direccionConDatos += ` | Email: ${emailVal}`;
      }

      let insertPayload: any = {
        cliente_nombre: formData.nombre,
        cliente_telefono: formData.telefono,
        cliente_cedula: cedVal,
        cliente_email: emailVal,
        direccion: direccionConDatos,
        ciudad: ciudadFormateada,
        total: total,
        productos: productosProcesados,
        linea_whatsapp: numeroWhatsApp,
        tenant_id: getTenantId(),
        metodo_pago: metodoPagoStr,
        metodo_envio: metodoEnvioLabel,
        modalidad_pago: modalidadPago,
        metodo_recepcion: metodoRecepcion,
        tipo_compra: buyerLabel,
        departamento: selectedDepartamento || '',
        estado: modalidadPago === 'contra_entrega' ? 'contra_entrega' : 'pendiente'
      };

      let { data: newOrder, error: dbErr } = await supabase.from('pedidos').insert(insertPayload).select('id').single();

      if (dbErr) {
        console.warn('Insert pedido falló:', dbErr.message);
        // Reintento sin columnas opcionales por si alguna falta
        const pClean = { ...insertPayload };
        delete pClean.cliente_cedula; delete pClean.cliente_email;
        delete pClean.metodo_pago; delete pClean.metodo_envio; delete pClean.modalidad_pago;
        delete pClean.metodo_recepcion; delete pClean.tipo_compra; delete pClean.departamento;
        const retry = await supabase.from('pedidos').insert(pClean).select('id').single();
        if (!retry.error) {
          newOrder = retry.data;
          dbErr = null;
        } else {
          console.error('Error en reintento de pedido:', retry.error);
        }
      }

      if (newOrder) {
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

    if (modalidadPago === 'transferencia') {
      let metodosStr = '';
      if (configuracion?.metodos_pago) {
        try {
          const parsed = JSON.parse(configuracion.metodos_pago);
          if (Array.isArray(parsed) && parsed.length > 0) {
            metodosStr = `\n*Metodos de pago:*\n` + parsed.map((m: any) => `  - ${m.banco} ${m.tipo ? `(${m.tipo})` : ''}: ${m.numero}`).join('\n') + `\n`;
          } else if (typeof configuracion.metodos_pago === 'string' && configuracion.metodos_pago.trim() !== '') {
            metodosStr = `\n*Metodos de pago:*\n${configuracion.metodos_pago}\n`;
          }
        } catch {
          if (typeof configuracion.metodos_pago === 'string' && configuracion.metodos_pago.trim() !== '') {
            metodosStr = `\n*Metodos de pago:*\n${configuracion.metodos_pago}\n`;
          }
        }
      }

      if (metodosStr) {
        mensaje += metodosStr;
      }

      const finalTargetId = orderId || (leadIdRef.current || leadId);
      if (finalTargetId) {
        const shortOrderId = finalTargetId.slice(0, 8);
        const uploadLink = `${window.location.origin}/pago/${shortOrderId}`;
        mensaje += `\n*Sube tu comprobante de pago aqui:* ${uploadLink}\n`;
      }
    } else if (modalidadPago === 'contra_entrega') {
      const finalTargetId = orderId || (leadIdRef.current || leadId);
      if (finalTargetId) {
        const shortOrderId = finalTargetId.slice(0, 8);
        const guiaLink = `${window.location.origin}/guia/${shortOrderId}`;
        mensaje += `\n*Ver guia / evidencia de envio:* ${guiaLink}\n`;
      }
    }


    let cleanWhatsApp = numeroWhatsApp.replace(/\D/g, '');
    if (cleanWhatsApp.length === 10) {
      cleanWhatsApp = '57' + cleanWhatsApp;
    }
    const whatsappUrl = `https://wa.me/${cleanWhatsApp}?text=${encodeURIComponent(mensaje)}`;

    const dateCode = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const seqNum = orderId ? orderId.slice(0,4).toUpperCase() : Math.floor(1000 + Math.random() * 9000).toString();
    const formattedOrderCode = `#HER-${dateCode}-${seqNum}`;

    setOrderSummaryData({
      orderCode: formattedOrderCode,
      subtotal: total,
      total: total,
      metodoPagoLabel: metodoPagoLabel,
      modalidadPago: modalidadPago,
      whatsappUrl: whatsappUrl
    });

    // Limpiar después de enviar
    setIsCartOpen(false);
    setIsCheckoutMode(false);
    clearCart();
    setFormData({ nombre: '', cedula: '', email: '', telefono: '', direccion: '', barrio: '', ciudad: '' });
    setTimeout(() => {
      isOrderSubmittedRef.current = false;
    }, 2000);
  };

  return (
    <div className="menu-app-container">
      <div className={`menu-app-header ${isMediaVideo(mayoristaBranding?.video || configuracion?.video_hero_url) ? 'has-video' : ''}`} style={{ position: 'relative', overflow: 'visible' }}>
        <div className="hero-media-wrap" style={{ position: 'relative', overflow: 'visible', height: 'clamp(240px, 60vw, 360px)', width: '100%' }}>
          {/* ── CLIPPED VIDEO / IMAGE BACKGROUND ── */}
          <div className="hero-video-clipper" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            {/* ── TICKER STRIP (TOP EDGE OF HERO) ── */}
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
                  style={{ height: '100%', width: '100%', objectFit: 'cover' }}
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
                  style={{ height: '100%', width: '100%', objectFit: 'cover' }}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              )
            )}
          </div>

          {/* ── TOP RIGHT ACTION BUTTONS (SEARCH | CART | BURGER) ── */}
          <div className="hero-top-right-actions">
            {/* 1. Lupa / Buscador */}
            <button
              onClick={() => {
                setSearchVisible(true);
                setTimeout(() => {
                  const el = document.querySelector('.search-takeover-bar') || document.querySelector('.search-bar-input');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
              }}
              className="hero-action-circle-btn"
              aria-label="Buscar productos"
            >
              <Search size={17} strokeWidth={2.2} color="var(--primary, #000)" />
            </button>

            {/* 2. Carrito con Badge */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="hero-action-circle-btn hero-cart-circle-btn"
              aria-label="Ver Carrito"
            >
              <ShoppingCart size={17} strokeWidth={2.2} color="var(--primary, #000)" />
              {totalItems > 0 && (
                <span className="hero-cart-badge">{totalItems}</span>
              )}
            </button>

            {/* 3. Menú Hamburguesa */}
            <button
              onClick={() => setIsBurgerMenuOpen(true)}
              className="hero-action-circle-btn"
              aria-label="Abrir menú"
            >
              <Menu size={17} strokeWidth={2.2} className="burger-menu-icon" color="var(--primary, #000)" />
            </button>
          </div>

          {/* ── CENTRAL OVERLAPPING LOGO (HERBARIA STYLE - ANCHORED DIRECTLY TO HERO MEDIA BOTTOM) ── */}
          <div className="hero-center-logo">
            {(() => {
              const logoSrc = mayoristaBranding?.logo || configuracion?.logo_url || DEFAULT_LOGOS[getTenantId()];
              if (logoSrc && !logoError) {
                return (
                  <img
                    src={logoSrc}
                    alt="Logo"
                    className="store-logo-round"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    onError={() => setLogoError(true)}
                  />
                );
              }
              return (
                <div className="store-logo-round store-logo-placeholder">
                  <span className="logo-letter c1" style={{ fontSize: '24px', fontWeight: 'bold' }}>
                    {(mayoristaBranding?.nombre || configuracion?.nombre_negocio || 'T').substring(0, 1).toUpperCase()}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── TOP RIGHT SEARCH BUTTON ── */}
        <button
          onClick={() => {
            setSearchVisible(true);
            setTimeout(() => {
              const el = document.querySelector('.search-takeover-bar') || document.querySelector('.search-bar-input');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }}
          className="hero-top-right-search-btn"
          aria-label="Buscar productos"
        >
          <Search size={22} strokeWidth={2.5} color="var(--primary, #000)" />
        </button>

        {/* ── BURGER MENU PANEL (SIDEBAR - HERBARIA STYLE) ── */}
        <div className={`burger-menu-overlay ${isBurgerMenuOpen ? 'open' : ''}`} onClick={() => setIsBurgerMenuOpen(false)}></div>
        <div className={`burger-menu-panel ${isBurgerMenuOpen ? 'open' : ''}`}>
          
          {/* 1. Header with Close Button, Center Logo & Store Name */}
          <div className="burger-menu-top-header">
            <button className="burger-menu-close" onClick={() => setIsBurgerMenuOpen(false)} aria-label="Cerrar menú">
              <X size={20} />
            </button>
            <div className="burger-store-info">
              {(mayoristaBranding?.logo || configuracion?.logo_url) && (
                <img 
                  src={mayoristaBranding?.logo || configuracion?.logo_url} 
                  alt="Logo" 
                  className="burger-store-logo" 
                />
              )}
              <h3 className="burger-store-title">
                {toTitleCase(mayoristaBranding?.nombre || configuracion?.nombre_negocio || 'Catálogo Digital')}
              </h3>
              {activeAsesor && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.4rem 0.65rem',
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  border: '1px solid #a7f3d0',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  boxSizing: 'border-box',
                  fontFamily: "'Poppins', sans-serif"
                }}>
                  {activeAsesor.foto_url ? (
                    <img
                      src={activeAsesor.foto_url}
                      alt={activeAsesor.nombre}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '1.5px solid #10b981',
                        flexShrink: 0
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: '#10b981',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 500,
                      fontSize: '0.8rem',
                      flexShrink: 0
                    }}>
                      {activeAsesor.nombre.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 500, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.2px', lineHeight: 1.1 }}>
                      Estás con el asesor:
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 500, color: '#065f46', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
                      {activeAsesor.nombre} {activeAsesor.telefono ? `· 📱 ${activeAsesor.telefono.split(',')[0].trim()}` : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="burger-menu-body">
            {/* 2. Search Input */}
            <div className="burger-search-wrap">
              <Search size={16} className="burger-search-icon" />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setIsBurgerMenuOpen(false);
                    setSearchVisible(true);
                  }
                }}
                className="burger-search-input"
              />
              {busqueda && (
                <button onClick={() => setBusqueda('')} className="burger-search-clear">×</button>
              )}
            </div>

            {/* 3. CATEGORÍAS Section (Dropdown Accordion) */}
            <div className="burger-section">
              <button 
                className="burger-section-accordion-btn"
                onClick={() => setIsBurgerCatOpen(!isBurgerCatOpen)}
                type="button"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <h4 className="burger-section-title">CATEGORÍAS</h4>
                  <span className="burger-cat-badge-pill">{categorias.length}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span className="burger-cat-toggle-text">{isBurgerCatOpen ? 'Ocultar' : 'Ver todas'}</span>
                  <ChevronDown 
                    size={16} 
                    style={{ transform: isBurgerCatOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#78716c' }} 
                  />
                </div>
              </button>

              {!isBurgerCatOpen ? (
                <div className="burger-active-cat-preview" onClick={() => setIsBurgerCatOpen(true)}>
                  <span className="burger-cat-item active" style={{ margin: 0, padding: '0.45rem 0.65rem' }}>
                    <span>{filtroCategoria === 'todos' ? 'Todos los productos' : toTitleCase(categorias.find(c => c.slug === filtroCategoria)?.nombre || filtroCategoria)}</span>
                    <span className="burger-cat-count">{filtroCategoria === 'todos' ? productos.length : getCategoryCount(filtroCategoria, filtroCategoria)}</span>
                  </span>
                </div>
              ) : (
                <ul className="burger-cat-list">
                  <li 
                    className={`burger-cat-item ${filtroCategoria === 'todos' ? 'active' : ''}`}
                    onClick={() => {
                      selectCategoria('todos');
                      setIsBurgerMenuOpen(false);
                    }}
                  >
                    <span>Todos los productos</span>
                    <span className="burger-cat-count">{productos.length}</span>
                  </li>

                  {categorias.map(cat => {
                    const count = getCategoryCount(cat.slug, cat.nombre);
                    return (
                      <li 
                        key={cat.id}
                        className={`burger-cat-item ${filtroCategoria === cat.slug ? 'active' : ''}`}
                        onClick={() => {
                          selectCategoria(cat.slug);
                          setIsBurgerMenuOpen(false);
                        }}
                      >
                        <span>{toTitleCase(cat.nombre)}</span>
                        {count > 0 && <span className="burger-cat-count">{count}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* 4. OPCIONES Section */}
            <div className="burger-section">
              <h4 className="burger-section-title">OPCIONES & SERVICIOS</h4>
              
              <div className="burger-tools-grid">
                {/* Info & PQRS */}
                <button
                  onClick={() => { setIsBurgerMenuOpen(false); setIsPqrsOpen(true); }}
                  className="burger-tool-btn"
                >
                  <HelpCircle size={18} color="var(--primary, #f36b8e)" />
                  <span>Info & PQRS</span>
                </button>

                {/* Tipo de Compra */}
                <button
                  onClick={() => { setIsBurgerMenuOpen(false); setShowTipoModal(true); }}
                  className="burger-tool-btn"
                >
                  <RefreshCw size={18} color="var(--primary, #f36b8e)" />
                  <span>Tipo: {buyerType === 'mayorista' ? 'Mayorista' : buyerType === '50_unidades' ? '50+ Unid' : 'Detal'}</span>
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
                    className="burger-tool-btn"
                    onClick={() => setIsBurgerMenuOpen(false)}
                  >
                    <span style={{ fontSize: '1.1rem' }}>🚀</span>
                    <span>{ajustesProductos?.botones_extra?.dropshipper_text || '¿Eres Dropshipper?'}</span>
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
                    className="burger-tool-btn"
                    onClick={() => setIsBurgerMenuOpen(false)}
                  >
                    <span style={{ fontSize: '1.1rem' }}>💸</span>
                    <span>{ajustesProductos?.botones_extra?.earn_money_text || 'Ganar Dinero'}</span>
                  </a>
                )}

                {/* Juegos & Premios */}
                {minijuegosActivos && (
                  <button
                    onClick={() => { setIsBurgerMenuOpen(false); setIsGameModalOpen(true); }}
                    className="burger-tool-btn"
                  >
                    <span style={{ fontSize: '1.1rem' }}>🎮</span>
                    <span>Juegos & Premios</span>
                  </button>
                )}

                {/* Activar / Silenciar Sonido (Si hay video) */}
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
                    className="burger-tool-btn"
                  >
                    {heroMuted ? <VolumeX size={18} color="var(--primary, #f36b8e)" /> : <Volume2 size={18} color="var(--primary, #f36b8e)" />}
                    <span>{heroMuted ? 'Activar sonido video' : 'Silenciar video'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* 5. SÍGUENOS Section */}
            <div className="burger-section">
              <h4 className="burger-section-title">SÍGUENOS</h4>
              <div className="burger-social-row">
                {/* WhatsApp */}
                <a 
                  href={(() => {
                    let clean = (overrideWhatsApp || configuracion?.whatsapp || '').replace(/\D/g, '');
                    if (clean.length === 10) clean = '57' + clean;
                    return `https://wa.me/${clean}?text=Hola!%20Vengo%20del%20cat%C3%A1logo%20digital`;
                  })()}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="burger-social-btn burger-whatsapp-btn"
                >
                  <span style={{ fontSize: '1.1rem' }}>📲</span> WhatsApp
                </a>

                {/* Instagram */}
                {((configuracion as any)?.instagram || (configuracion as any)?.link_instagram) && (
                  <a 
                    href={(configuracion as any)?.link_instagram || `https://instagram.com/${((configuracion as any)?.instagram || '').replace('@', '')}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="burger-social-icon-btn"
                    title="Instagram"
                  >
                    <span style={{ fontSize: '1.2rem' }}>📸</span>
                  </a>
                )}

                {/* TikTok */}
                {((configuracion as any)?.tiktok || (configuracion as any)?.link_tiktok) && (
                  <a 
                    href={(configuracion as any)?.link_tiktok || `https://tiktok.com/@${((configuracion as any)?.tiktok || '').replace('@', '')}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="burger-social-icon-btn"
                    title="TikTok"
                  >
                    <span style={{ fontSize: '1.2rem' }}>🎵</span>
                  </a>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      <div className="menu-app-body">
        {/* Header Search Takeover vs Normal Row */}

        {searchVisible ? (
          <div className="search-takeover-bar" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
            <Search size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <input
              className="search-bar-input"
              type="text"
              autoFocus
              placeholder="Buscar producto, categoría, referencia..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: '0.9rem', fontWeight: 600 }}
            />
            {busqueda && (
              <button 
                onClick={() => setBusqueda('')}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer', padding: '0 4px' }}
              >
                ×
              </button>
            )}
            <button
              onClick={() => { setSearchVisible(false); setBusqueda(''); }}
              style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', flexShrink: 0 }}
              aria-label="Cerrar búsqueda"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div style={{ width: '100%', marginBottom: '0.5rem', marginTop: 0 }}>
            <div className="categories-carousel" style={{ paddingBottom: '0.25rem' }}>
              <div 
                className={`category-card story-card ${filtroCategoria === 'todos' ? 'active' : ''}`}
                onClick={() => selectCategoria('todos')}
              >
                <div className="story-avatar-wrapper">
                  <div className="story-avatar-inner" style={{ backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LayoutGrid size={22} color="var(--primary, #f36b8e)" strokeWidth={2.2} />
                  </div>
                  <span className="cat-story-count">{productos.length}</span>
                </div>
                <div className="cat-info">
                  <h3>Todos</h3>
                </div>
              </div>
              
              {categorias.map(cat => {
                const count = getCategoryCount(cat.slug, cat.nombre);
                const nameLower = (cat.nombre || '').toLowerCase();
                const slugLower = (cat.slug || '').toLowerCase();

                let CategoryIcon = Tag;
                if (nameLower.includes('familiar') || slugLower.includes('familiar') || nameLower.includes('familia') || nameLower.includes('pareja')) {
                  CategoryIcon = Users;
                } else if (nameLower.includes('vestido') || slugLower.includes('vestido') || nameLower.includes('dama') || nameLower.includes('mujer')) {
                  CategoryIcon = Sparkles;
                } else if (nameLower.includes('body') || nameLower.includes('bodies') || nameLower.includes('bebe') || nameLower.includes('bebê') || nameLower.includes('mameluco')) {
                  CategoryIcon = Baby;
                } else if (nameLower.includes('juanita') || nameLower.includes('niña') || nameLower.includes('princesa')) {
                  CategoryIcon = Heart;
                } else if (nameLower.includes('pijama') || nameLower.includes('noche') || nameLower.includes('dormir')) {
                  CategoryIcon = Moon;
                } else if (nameLower.includes('conjunto') || nameLower.includes('set') || nameLower.includes('duo')) {
                  CategoryIcon = Layers;
                } else if (nameLower.includes('hombre') || nameLower.includes('caballero') || nameLower.includes('niño')) {
                  CategoryIcon = Shirt;
                } else if (nameLower.includes('oferta') || nameLower.includes('promo') || nameLower.includes('descuento') || nameLower.includes('regalo')) {
                  CategoryIcon = Gift;
                }

                return (
                  <div 
                    key={cat.id}
                    className={`category-card story-card ${filtroCategoria === cat.slug ? 'active' : ''}`}
                    onClick={() => selectCategoria(cat.slug)}
                  >
                    <div className="story-avatar-wrapper">
                      <div 
                        className="story-avatar-inner" 
                        style={{ 
                          backgroundColor: '#ffffff', 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {cat.imagen_url ? (
                          <img
                            src={cat.imagen_url}
                            alt={cat.nombre}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <CategoryIcon size={22} color="var(--primary, #f36b8e)" strokeWidth={2.2} />
                        )}
                      </div>
                      {count > 0 && <span className="cat-story-count">{count}</span>}
                    </div>
                    <div className="cat-info">
                      <h3>{toTitleCase(cat.nombre)}</h3>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Subcategories Filter Chips */}
        {filtroCategoria !== 'todos' && subcategorias.filter(s => s.categoria_id === categorias.find(c => c.slug === filtroCategoria)?.id).length > 0 && (
          <div style={{display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', overflowX: 'auto', paddingBottom: '0.25rem', paddingLeft: '0.25rem'}}>
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
                >{toTitleCase(subcat.nombre)}</button>
              ))
            }
          </div>
        )}

        {/* Active Filter Badges Bar */}
        {(filtroCategoria !== 'todos' || filtroSubcategoria !== 'todas' || busqueda) && (
          <div className="active-filters-bar">
            <span className="active-filter-title">
              <Filter size={13} /> Filtros:
            </span>
            {filtroCategoria !== 'todos' && (
              <span className="active-filter-pill">
                Cat: <strong>{toTitleCase(categorias.find(c => c.slug === filtroCategoria)?.nombre || filtroCategoria)}</strong>
                <button onClick={() => selectCategoria('todos')} title="Quitar filtro de categoría">×</button>
              </span>
            )}
            {filtroSubcategoria !== 'todas' && (
              <span className="active-filter-pill">
                Sub: <strong>{subcategorias.find(s => s.slug === filtroSubcategoria)?.nombre || filtroSubcategoria}</strong>
                <button onClick={() => selectSubcategoria('todas')} title="Quitar filtro de subcategoría">×</button>
              </span>
            )}
            {busqueda && (
              <span className="active-filter-pill">
                Búsqueda: <strong>"{busqueda}"</strong>
                <button onClick={() => setBusqueda('')} title="Limpiar búsqueda">×</button>
              </span>
            )}
            <button 
              className="clear-all-filters-btn"
              onClick={() => {
                selectCategoria('todos');
                selectSubcategoria('todas');
                setBusqueda('');
              }}
            >
              Limpiar todo
            </button>
          </div>
        )}



        {/* Product List */}
        <div id="catalog-products-grid" className="menu-list">
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
                    className={`item-add-btn ${addedProductId === producto.id ? 'btn-added' : ''}`}
                    style={{ background: addedProductId === producto.id ? '#16a34a' : (configuracion?.color_primario || 'var(--primary)') }}
                    onClick={e => { 
                      e.stopPropagation(); 
                      const hasOptions = (producto.tallas && producto.tallas.length > 0) || 
                                        (producto.imagenes_extra && producto.imagenes_extra.some(u => Boolean(decodeExtraImage(u).estampado || decodeExtraImage(u).ref))) ||
                                        producto.es_producto_familiar;
                      if (hasOptions) {
                        openDetail(producto);
                      } else {
                        addToCart(producto, 'Única', 'Estándar', 1);
                        setAddedProductId(producto.id);
                        setTimeout(() => setAddedProductId(null), 1500);
                      }
                    }}
                    aria-label="Añadir al carrito"
                  >
                    {addedProductId === producto.id ? <Check size={18} /> : <Plus size={20} />}
                  </button>
                </div>
                <div className="item-details" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <h4 className="item-title-poppins">{toTitleCase(producto.nombre)}</h4>
                  
                  {(() => {
                    const priceDetal = getEffectivePrice(producto, 'detal', markupPorcentaje, ajustesProductos, descuentoPromocional);
                    const priceMayor = getEffectivePrice(producto, 'mayorista', markupPorcentaje, ajustesProductos, descuentoPromocional);
                    const hasWholesalePrice = priceMayor > 0 && priceMayor < priceDetal;
                    const companyColor = configuracion?.color_primario || 'var(--primary, #f36b8e)';

                    if (producto.es_producto_familiar) {
                      return (
                        <div style={{ marginTop: '0.15rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <strong style={{ fontSize: '0.92rem', fontWeight: 600, color: companyColor, fontFamily: "'Poppins', sans-serif" }}>
                            Ver opciones disponibles
                          </strong>
                          <span style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>
                            👨‍👩‍👧‍👦 Opción familiar disponible
                          </span>
                        </div>
                      );
                    }

                    if (hasWholesalePrice) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.1rem' }}>
                          {/* 1. PRIMERO: PRECIO DETAL */}
                          <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                            <strong style={{ fontSize: '1.05rem', fontWeight: 600, color: companyColor, fontFamily: "'Poppins', sans-serif", textDecoration: ((producto.descuento !== undefined && producto.descuento > 0) || descuentoPromocional > 0) ? 'line-through' : 'none' }}>
                              ${priceDetal.toLocaleString('es-CO')}
                            </strong>
                          </div>

                          {/* 2. ABAJO: PRECIO AL POR MAYOR */}
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#15803d', background: '#dcfce7', padding: '0.15rem 0.45rem', borderRadius: '5px', display: 'inline-block', fontFamily: "'Poppins', sans-serif", border: '1px solid #bbf7d0' }}>
                              Por mayor +6:
                            </span>
                            <strong style={{ fontSize: '1.08rem', fontWeight: 600, color: '#166534', fontFamily: "'Poppins', sans-serif" }}>
                              ${priceMayor.toLocaleString('es-CO')}
                            </strong>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div style={{ marginTop: '0.1rem' }}>
                        <strong style={{ fontSize: '1.05rem', fontWeight: 600, color: companyColor, fontFamily: "'Poppins', sans-serif" }}>
                          ${priceDetal.toLocaleString('es-CO')}
                        </strong>
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

      {/* Floating Cart Button (Color Sólido Único de la Empresa) */}
      {totalItems > 0 && !isCartOpen && (
        <button 
          className="floating-cart-btn" 
          onClick={() => setIsCartOpen(true)}
          style={{ 
            background: configuracion?.color_primario || 'var(--primary, #f36b8e)',
            boxShadow: `0 -4px 20px ${(configuracion?.color_primario || '#f36b8e')}35`
          }}
        >
          <div className="cart-icon-wrapper">
            <ShoppingBag size={22} />
            <span className="cart-badge" style={{ color: configuracion?.color_primario || '#0f172a' }}>{totalItems}</span>
            <span>Ver Carrito</span>
          </div>
          <span className="cart-total-float" style={{ fontWeight: 700, fontSize: '1.05rem' }}>${total.toLocaleString('es-CO')}</span>
        </button>
      )}

      {/* Cart Modal */}
      {isCartOpen && (
        <div className="cart-modal-overlay">
          <div className="cart-modal">
             {isCheckoutMode ? (
              <>
                {/* TOP ROW HEADER WITH BACK BUTTON & TITLE & CLOSE BUTTON */}
                <div className="checkout-top-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', background: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (checkoutStep > 1) {
                        setCheckoutStep(prev => (prev - 1) as 1 | 2 | 3);
                      } else {
                        setIsCheckoutMode(false);
                      }
                    }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#0f172a', display: 'flex', alignItems: 'center', padding: '0.2rem' }}
                  >
                    <ArrowLeft size={22} />
                  </button>

                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>
                    Formulario de compra
                  </h3>

                  <button 
                    type="button"
                    onClick={() => {
                      setIsCartOpen(false);
                      setIsCheckoutMode(false);
                    }} 
                    className="close-btn"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.2rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Cerrar"
                  >
                    <X size={22} />
                  </button>
                </div>

                {/* SEPARATE STEPPER PROGRESS BAR ROW WITH DIVIDER (EN OTRO CAMPO SEPARADO) */}
                <div className="checkout-stepper-row" style={{ padding: '0.95rem 1.25rem', background: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                    {/* STEP 1 */}
                    <div 
                      onClick={() => setCheckoutStep(1)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}
                    >
                      <div 
                        style={{ 
                          width: '26px', 
                          height: '26px', 
                          borderRadius: '50%', 
                          backgroundColor: checkoutStep >= 1 ? (configuracion?.color_primario || 'var(--primary, #f36b8e)') : '#f1f5f9', 
                          color: checkoutStep >= 1 ? '#ffffff' : '#64748b', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          fontSize: '0.8rem', 
                          fontWeight: 700,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        1
                      </div>
                      <span style={{ fontSize: '0.84rem', fontWeight: checkoutStep === 1 ? 700 : 500, color: checkoutStep === 1 ? '#0f172a' : '#64748b' }}>
                        Contacto
                      </span>
                    </div>

                    <div style={{ flex: 1, height: '2px', background: checkoutStep >= 2 ? (configuracion?.color_primario || 'var(--primary, #f36b8e)') : '#e2e8f0', transition: 'all 0.3s ease', margin: '0 0.3rem' }} />

                    {/* STEP 2 */}
                    <div 
                      onClick={() => { if (formData.nombre && formData.telefono) setCheckoutStep(2); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}
                    >
                      <div 
                        style={{ 
                          width: '26px', 
                          height: '26px', 
                          borderRadius: '50%', 
                          backgroundColor: checkoutStep >= 2 ? (configuracion?.color_primario || 'var(--primary, #f36b8e)') : '#f1f5f9', 
                          color: checkoutStep >= 2 ? '#ffffff' : '#64748b', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          fontSize: '0.8rem', 
                          fontWeight: 700,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        2
                      </div>
                      <span style={{ fontSize: '0.84rem', fontWeight: checkoutStep === 2 ? 700 : 500, color: checkoutStep === 2 ? '#0f172a' : '#64748b' }}>
                        Envío
                      </span>
                    </div>

                    <div style={{ flex: 1, height: '2px', background: checkoutStep >= 3 ? (configuracion?.color_primario || 'var(--primary, #f36b8e)') : '#e2e8f0', transition: 'all 0.3s ease', margin: '0 0.3rem' }} />

                    {/* STEP 3 */}
                    <div 
                      onClick={() => { if (formData.nombre && formData.telefono && formData.ciudad && formData.direccion) setCheckoutStep(3); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}
                    >
                      <div 
                        style={{ 
                          width: '26px', 
                          height: '26px', 
                          borderRadius: '50%', 
                          backgroundColor: checkoutStep >= 3 ? (configuracion?.color_primario || 'var(--primary, #f36b8e)') : '#f1f5f9', 
                          color: checkoutStep >= 3 ? '#ffffff' : '#64748b', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          fontSize: '0.8rem', 
                          fontWeight: 700,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        3
                      </div>
                      <span style={{ fontSize: '0.84rem', fontWeight: checkoutStep === 3 ? 700 : 500, color: checkoutStep === 3 ? '#0f172a' : '#64748b' }}>
                        Pago
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="cart-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.15rem', background: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '14px', background: `${configuracion?.color_primario || 'var(--primary, #f36b8e)'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ShoppingBag size={20} color={configuracion?.color_primario || 'var(--primary, #f36b8e)'} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                      Tu carrito
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 400, marginTop: '2px', display: 'block' }}>
                      {totalUnits} {totalUnits === 1 ? 'producto' : 'productos'}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsCartOpen(false);
                    setIsCheckoutMode(false);
                  }} 
                  className="close-btn"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.4rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Cerrar carrito"
                >
                  <X size={22} />
                </button>
              </div>
            )}

            {/* Temu Multi-Tier Offer Progress Bar inside Cart */}
            {!isCheckoutMode && items.length > 0 && (
              <div className="shrine-shipping-bar" style={{ padding: '0.75rem 1.1rem', background: '#ffffff', color: '#0f172a', borderBottom: '1px solid #f1f5f9' }}>
                {(() => {
                  const brandColor = configuracion?.color_primario || 'var(--primary, #f36b8e)';

                  if (totalUnits < 6) {
                    const remaining = 6 - totalUnits;
                    const pct = Math.min(100, (totalUnits / 6) * 100);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', fontWeight: 500, color: '#0f172a' }}>
                          <span>
                            <span className="animated-flame">🔥</span> Te faltan <span style={{ color: brandColor, fontWeight: 600 }}>{remaining} {remaining === 1 ? 'prenda' : 'prendas'}</span> para <span style={{ fontWeight: 600 }}>por mayor</span>
                          </span>
                          <span style={{ fontSize: '0.76rem', background: brandColor, padding: '0.2rem 0.65rem', borderRadius: '20px', color: '#ffffff', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {totalUnits}/6 unds
                          </span>
                        </div>
                        <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: brandColor, borderRadius: '6px', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    );
                  } else if (totalUnits < 50) {
                    const remaining50 = 50 - totalUnits;
                    const pct50 = Math.min(100, Math.round(((totalUnits - 6) / 44) * 100));
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', fontWeight: 500, color: '#0f172a' }}>
                          <span>
                            🎉 <span style={{ fontWeight: 600 }}>¡Por mayor activo!</span> Te faltan <span style={{ color: brandColor, fontWeight: 600 }}>{remaining50} prendas</span> para <span style={{ fontWeight: 600 }}>50+ unidades</span>
                          </span>
                          <span style={{ fontSize: '0.76rem', background: '#10b981', padding: '0.2rem 0.65rem', borderRadius: '20px', color: '#ffffff', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {totalUnits}/50 unds
                          </span>
                        </div>
                        <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct50}%`, background: `linear-gradient(90deg, #10b981, ${brandColor})`, borderRadius: '6px', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#10b981', fontSize: '0.84rem', fontWeight: 600 }}>
                        <span>🏆 ¡Máximo descuento activado (50+ prendas)!</span>
                      </div>
                    );
                  }
                })()}
              </div>
            )}
            
            {isCheckoutMode ? (
              <form className="checkout-form" onSubmit={handleEnviarPedido} style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '1rem', overflowY: 'auto' }}>
                {(() => {
                  const brandColor = configuracion?.color_primario || 'var(--primary, #f36b8e)';

                  return (
                    <>
                      {/* ── PASO 1: CONTACTO ── */}
                      {checkoutStep === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                          <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '1.05rem', fontWeight: 600, color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>
                            Tus datos de contacto
                          </h4>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#334155', marginBottom: '0.4rem', display: 'block', fontFamily: "'Poppins', sans-serif" }}>
                              Nombre *
                            </label>
                            <input 
                              type="text" 
                              required 
                              value={formData.nombre}
                              onChange={e => setFormData({...formData, nombre: e.target.value})}
                              placeholder="Ej. Juan Pérez"
                              style={{ width: '100%', padding: '0.78rem 0.95rem', borderRadius: '14px', border: '1.5px solid #e2e8f0', background: '#fafafa', fontSize: '0.9rem', outline: 'none', color: '#0f172a', fontFamily: "'Poppins', sans-serif", fontWeight: 400 }}
                            />
                          </div>

                          {(() => {
                            const phoneVal = validateWhatsAppPhone(formData.telefono);
                            let inputBorder = '1.5px solid #e2e8f0';
                            if (phoneVal.status === 'valid') inputBorder = '1.5px solid #22c55e';
                            else if (phoneVal.status === 'invalid_landline') inputBorder = '1.5px solid #f59e0b';
                            else if (phoneVal.status === 'invalid_length') inputBorder = '1.5px solid #ea580c';

                            return (
                              <div className="form-group" style={{ margin: 0 }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#334155', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: "'Poppins', sans-serif" }}>
                                  <span>Teléfono / WhatsApp *</span>
                                  {phoneVal.status === 'valid' && (
                                    <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                      <Check size={13} style={{ strokeWidth: 3 }} /> WhatsApp Válido
                                    </span>
                                  )}
                                </label>
                                <div style={{ display: 'flex', gap: '0.55rem' }}>
                                  <div style={{ padding: '0.78rem 0.85rem', background: '#fafafa', border: '1.5px solid #e2e8f0', borderRadius: '14px', fontSize: '0.88rem', fontWeight: 500, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0, fontFamily: "'Poppins', sans-serif" }}>
                                    <span>CO +57</span>
                                    <ChevronDown size={14} color="#64748b" />
                                  </div>
                                  <input 
                                    type="tel" 
                                    required 
                                    value={formData.telefono}
                                    onChange={e => setFormData({...formData, telefono: e.target.value})}
                                    placeholder="300 123 4567"
                                    style={{ flex: 1, minWidth: 0, padding: '0.78rem 0.95rem', borderRadius: '14px', border: inputBorder, background: phoneVal.status === 'valid' ? '#f0fdf4' : '#fafafa', fontSize: '0.9rem', outline: 'none', color: '#0f172a', fontFamily: "'Poppins', sans-serif", transition: 'border-color 0.2s ease, background 0.2s ease' }}
                                  />
                                </div>
                                <WhatsAppPhoneVerifier phone={formData.telefono} showTestButton={true} />
                              </div>
                            );
                          })()}

                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#334155', marginBottom: '0.4rem', display: 'block', fontFamily: "'Poppins', sans-serif" }}>
                              Correo Electrónico *
                            </label>
                            <input 
                              type="email" 
                              required 
                              value={formData.email}
                              onChange={e => setFormData({...formData, email: e.target.value})}
                              placeholder="tu@correo.com"
                              style={{ width: '100%', padding: '0.78rem 0.95rem', borderRadius: '14px', border: '1.5px solid #e2e8f0', background: '#fafafa', fontSize: '0.9rem', outline: 'none', color: '#0f172a', fontFamily: "'Poppins', sans-serif", fontWeight: 400 }}
                            />
                          </div>

                          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', fontSize: '0.8rem', color: '#475569', cursor: 'pointer', marginTop: '0.15rem', lineHeight: 1.35 }}>
                            <input 
                              type="checkbox" 
                              defaultChecked 
                              style={{ accentColor: brandColor, width: '18px', height: '18px', borderRadius: '4px', cursor: 'pointer', flexShrink: 0, marginTop: '2px' }} 
                            />
                            <span>Acepto recibir novedades y promociones de {toTitleCase(configuracion?.nombre_negocio || 'la tienda')}</span>
                          </label>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              if (!formData.nombre.trim()) {
                                alert('Por favor ingresa tu nombre completo.');
                                return;
                              }
                              if (!formData.telefono.trim()) {
                                alert('Por favor ingresa tu número de teléfono.');
                                return;
                              }
                              const phoneVal = validateWhatsAppPhone(formData.telefono);
                              if (phoneVal.status === 'invalid_landline') {
                                alert('El número ingresado parece ser un teléfono fijo y los fijos no tienen WhatsApp. Por favor ingresa tu número celular de 10 dígitos (inicia por 3) para enviarte la información de tu pedido.');
                                return;
                              }
                              if (phoneVal.status === 'invalid_length') {
                                alert('Por favor verifica tu número celular. Debe tener exactamente 10 dígitos (ej: 300 123 4567).');
                                return;
                              }
                              if (!formData.email.trim() || !formData.email.includes('@')) {
                                alert('Por favor ingresa un correo electrónico válido.');
                                return;
                              }
                              saveOrUpdateLead(formData);
                              setCheckoutStep(2);
                            }}
                            style={{
                              width: '100%',
                              padding: '0.88rem 1rem',
                              borderRadius: '14px',
                              border: 'none',
                              background: brandColor,
                              color: '#ffffff',
                              fontSize: '0.98rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.4rem',
                              marginTop: '0.5rem',
                              boxShadow: `0 4px 14px ${brandColor}35`
                            }}
                          >
                            <span>Continuar</span>
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      )}

                      {/* ── PASO 2: ENVÍO ── */}
                      {checkoutStep === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                          <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '1.08rem', fontWeight: 700, color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>
                            ¿Cómo quieres recibir tu pedido?
                          </h4>

                          {/* SELECTOR DE MÉTODO DE RECEPCIÓN (DOMICILIO vs RECOGER EN TIENDA) */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            <label 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.75rem', 
                                padding: '0.85rem 1rem', 
                                borderRadius: '14px', 
                                border: `2px solid ${metodoRecepcion === 'domicilio' ? brandColor : '#e2e8f0'}`, 
                                background: metodoRecepcion === 'domicilio' ? `${brandColor}0d` : '#fafafa', 
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <input 
                                type="radio" 
                                name="metodoRecepcion" 
                                value="domicilio"
                                checked={metodoRecepcion === 'domicilio'}
                                onChange={() => setMetodoRecepcion('domicilio')}
                                style={{ accentColor: brandColor, width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: metodoRecepcion === 'domicilio' ? brandColor : '#1e293b', fontFamily: "'Poppins', sans-serif" }}>
                                  🚚 Envío a domicilio
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>
                                  Te lo enviamos a tu dirección exacta
                                </div>
                              </div>
                            </label>

                            <label 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.75rem', 
                                padding: '0.85rem 1rem', 
                                borderRadius: '14px', 
                                border: `2px solid ${metodoRecepcion === 'tienda' ? brandColor : '#e2e8f0'}`, 
                                background: metodoRecepcion === 'tienda' ? `${brandColor}0d` : '#fafafa', 
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <input 
                                type="radio" 
                                name="metodoRecepcion" 
                                value="tienda"
                                checked={metodoRecepcion === 'tienda'}
                                onChange={() => {
                                  setMetodoRecepcion('tienda');
                                  setFormData({ ...formData, direccion: `Recoger en Tienda (${configuracion?.direccion || 'Sede Principal'})` });
                                }}
                                style={{ accentColor: brandColor, width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontSize: '0.92rem', fontWeight: 600, color: metodoRecepcion === 'tienda' ? brandColor : '#1e293b', fontFamily: "'Poppins', sans-serif" }}>
                                    🏪 Recoger en tienda
                                  </div>
                                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#10b981', background: '#d1fae5', padding: '2px 8px', borderRadius: '10px', fontFamily: "'Poppins', sans-serif" }}>
                                    Gratis
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>
                                  📍 {configuracion?.direccion || 'Calle 45 # 33-26 (Sede Principal)'}
                                </div>
                              </div>
                            </label>
                          </div>

                          {metodoRecepcion === 'domicilio' ? (
                            <>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label style={{ fontSize: '0.86rem', fontWeight: 500, color: '#1e293b', marginBottom: '0.4rem', display: 'block', fontFamily: "'Poppins', sans-serif" }}>
                                  Departamento *
                                </label>
                                <select
                                  value={selectedDepartamento}
                                  onChange={(e) => {
                                    setSelectedDepartamento(e.target.value);
                                    setFormData({ ...formData, ciudad: '' });
                                  }}
                                  style={{ width: '100%', padding: '0.78rem 0.95rem', borderRadius: '14px', border: '1.5px solid #e2e8f0', background: '#fafafa', fontSize: '0.9rem', outline: 'none', color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}
                                >
                                  <option value="">Selecciona tu departamento</option>
                                  {Object.keys(DEPARTAMENTOS_COLOMBIA).map(depto => (
                                    <option key={depto} value={depto}>{depto}</option>
                                  ))}
                                </select>
                              </div>

                              {/* ── DESPLEGABLE PERSONALIZADO DE CIUDADES (POP-OVER BLANCO Y ELEGANTE) ── */}
                              <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                                <label style={{ fontSize: '0.86rem', fontWeight: 500, color: '#1e293b', marginBottom: '0.4rem', display: 'block', fontFamily: "'Poppins', sans-serif" }}>
                                  Ciudad / Municipio *
                                </label>
                                <div style={{ position: 'relative' }}>
                                  <input 
                                    type="text" 
                                    required 
                                    value={formData.ciudad}
                                    onFocus={() => setIsCityFocused(true)}
                                    onBlur={() => setTimeout(() => setIsCityFocused(false), 200)}
                                    onChange={e => {
                                      setFormData({...formData, ciudad: e.target.value});
                                      setIsCityFocused(true);
                                    }}
                                    placeholder="Ej. Cali, Bogotá, Medellín, Rionegro..."
                                    style={{ width: '100%', padding: '0.78rem 2.2rem 0.78rem 0.95rem', borderRadius: '14px', border: '1.5px solid #e2e8f0', background: '#fafafa', fontSize: '0.9rem', outline: 'none', color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}
                                  />
                                  <ChevronDown size={18} color="#64748b" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                </div>

                                {isCityFocused && (
                                  <div 
                                    style={{ 
                                      position: 'absolute', 
                                      top: 'calc(100% + 4px)', 
                                      left: 0, 
                                      right: 0, 
                                      zIndex: 9999, 
                                      background: '#ffffff', 
                                      borderRadius: '16px', 
                                      border: '1px solid #e2e8f0', 
                                      boxShadow: '0 12px 28px rgba(15, 23, 42, 0.15)', 
                                      maxHeight: '210px', 
                                      overflowY: 'auto',
                                      fontFamily: "'Poppins', sans-serif"
                                    }}
                                  >
                                    {(() => {
                                      const availableCities = selectedDepartamento && DEPARTAMENTOS_COLOMBIA[selectedDepartamento]
                                        ? DEPARTAMENTOS_COLOMBIA[selectedDepartamento].map(muni => ({ ciudad: `${muni}, ${selectedDepartamento}` }))
                                        : TODAS_LAS_CIUDADES_COLOMBIA;
                                      
                                      const filtered = availableCities.filter(item => 
                                        !formData.ciudad || item.ciudad.toLowerCase().includes(formData.ciudad.toLowerCase())
                                      ).slice(0, 35);

                                      if (filtered.length === 0) {
                                        return (
                                          <div style={{ padding: '0.75rem 1rem', fontSize: '0.84rem', color: '#94a3b8', textAlign: 'center' }}>
                                            No se encontraron municipios coincidentes
                                          </div>
                                        );
                                      }

                                      return filtered.map((item, idx) => (
                                        <div 
                                          key={idx}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            setFormData({ ...formData, ciudad: item.ciudad });
                                            setIsCityFocused(false);
                                          }}
                                          style={{ 
                                            padding: '0.65rem 1rem', 
                                            fontSize: '0.86rem', 
                                            color: '#1e293b', 
                                            cursor: 'pointer', 
                                            borderBottom: idx < filtered.length - 1 ? '1px solid #f1f5f9' : 'none',
                                            transition: 'background 0.12s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            fontWeight: 500
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                          onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                                        >
                                          <span>{item.ciudad}</span>
                                          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>📍 Colombia</span>
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                )}
                              </div>

                              <div className="form-group" style={{ margin: 0 }}>
                                <label style={{ fontSize: '0.86rem', fontWeight: 500, color: '#1e293b', marginBottom: '0.4rem', display: 'block', fontFamily: "'Poppins', sans-serif" }}>
                                  Barrio *
                                </label>
                                <input 
                                  type="text" 
                                  required 
                                  value={formData.barrio}
                                  onChange={e => setFormData({...formData, barrio: e.target.value})}
                                  placeholder="Ej. El Poblado, Chapinero, San Fernando..."
                                  style={{ width: '100%', padding: '0.78rem 0.95rem', borderRadius: '14px', border: '1.5px solid #e2e8f0', background: '#fafafa', fontSize: '0.9rem', outline: 'none', color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}
                                />
                              </div>

                              <div className="form-group" style={{ margin: 0 }}>
                                <label style={{ fontSize: '0.86rem', fontWeight: 500, color: '#1e293b', marginBottom: '0.4rem', display: 'block', fontFamily: "'Poppins', sans-serif" }}>
                                  Dirección exacta de residencia (Calle / Carrera #) *
                                </label>
                                <textarea 
                                  required 
                                  rows={2}
                                  value={formData.direccion}
                                  onChange={e => setFormData({...formData, direccion: e.target.value})}
                                  placeholder="Ej. Calle 45 # 23-15 Apt 302, Edificio Los Pinos"
                                  style={{ width: '100%', padding: '0.78rem 0.95rem', borderRadius: '14px', border: '1.5px solid #e2e8f0', background: '#fafafa', fontSize: '0.9rem', outline: 'none', resize: 'vertical', color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}
                                />
                              </div>

                              {/* ── AUTO VERIFICADOR DE DIRECCIÓN ── */}
                              <AddressVerifier 
                                direccion={formData.direccion}
                                barrio={formData.barrio}
                                ciudad={formData.ciudad}
                                departamento={selectedDepartamento}
                              />
                            </>
                          ) : (
                            <div style={{ background: '#ecfdf5', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '0.86rem' }}>
                              <strong>📍 Dirección para retirar tu pedido:</strong>
                              <p style={{ margin: '0.25rem 0 0 0', fontWeight: 500 }}>
                                {configuracion?.direccion || 'Calle 45 # 33-26 (Sede Principal)'}
                              </p>
                            </div>
                          )}

                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.86rem', fontWeight: 500, color: '#1e293b', marginBottom: '0.4rem', display: 'block', fontFamily: "'Poppins', sans-serif" }}>
                              Número de Cédula / DNI *
                            </label>
                            <input 
                              type="text" 
                              required 
                              value={formData.cedula}
                              onChange={e => setFormData({...formData, cedula: e.target.value})}
                              placeholder="Ej. 1098765432"
                              style={{ width: '100%', padding: '0.78rem 0.95rem', borderRadius: '14px', border: '1.5px solid #e2e8f0', background: '#fafafa', fontSize: '0.9rem', outline: 'none', color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              if (metodoRecepcion === 'domicilio') {
                                if (!selectedDepartamento.trim()) {
                                  alert('Por favor selecciona tu departamento de residencia.');
                                  return;
                                }
                                if (!formData.ciudad.trim()) {
                                  alert('Por favor ingresa o selecciona tu ciudad/municipio.');
                                  return;
                                }
                                if (!formData.barrio.trim()) {
                                  alert('Por favor ingresa el nombre de tu barrio.');
                                  return;
                                }
                                if (!formData.direccion.trim()) {
                                  alert('Por favor ingresa tu dirección exacta de residencia (Calle, Carrera, número, etc.).');
                                  return;
                                }
                                const addrVal = validateAddressFormat(formData.direccion, formData.barrio, formData.ciudad, selectedDepartamento);
                                if (!addrVal.isValidFormat) {
                                  alert(addrVal.message);
                                  return;
                                }
                              }
                              if (!formData.cedula.trim()) {
                                alert('Por favor ingresa tu número de cédula o DNI para la factura.');
                                return;
                              }
                              saveOrUpdateLead(formData);
                              setIsEnvioSeleccionado(true);
                              setCheckoutStep(3);
                            }}
                            style={{
                              width: '100%',
                              padding: '0.88rem 1rem',
                              borderRadius: '14px',
                              border: 'none',
                              background: brandColor,
                              color: '#ffffff',
                              fontSize: '0.98rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.4rem',
                              marginTop: '0.5rem',
                              boxShadow: `0 4px 14px ${brandColor}35`
                            }}
                          >
                            <span>Continuar a Pago</span>
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      )}

                      {/* ── PASO 3: PAGO ── */}
                      {checkoutStep === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                          <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '1.08rem', fontWeight: 700, color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>
                            ¿Cómo quieres pagar?
                          </h4>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {/* OPCIÓN 1: TRANSFERENCIA BANCARIA */}
                            <label 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.75rem', 
                                padding: '0.85rem 1rem', 
                                borderRadius: '14px', 
                                border: `2px solid ${modalidadPago === 'transferencia' ? brandColor : '#e2e8f0'}`, 
                                background: modalidadPago === 'transferencia' ? `${brandColor}0d` : '#fafafa', 
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.1rem' }}>
                                🏦
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: modalidadPago === 'transferencia' ? brandColor : '#1e293b', fontFamily: "'Poppins', sans-serif" }}>
                                  Transferencia Bancaria
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>
                                  Bancolombia · Nequi · Daviplata
                                </div>
                              </div>
                              <input 
                                type="radio" 
                                name="modalidadPago" 
                                value="transferencia"
                                checked={modalidadPago === 'transferencia'}
                                onChange={() => {
                                  setModalidadPago('transferencia');
                                  setIsPagoSeleccionado(true);
                                }}
                                style={{ accentColor: brandColor, width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                              />
                            </label>

                            {/* OPCIÓN 2: PAGO CONTRA ENTREGA */}
                            <label 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.75rem', 
                                padding: '0.85rem 1rem', 
                                borderRadius: '14px', 
                                border: `2px solid ${modalidadPago === 'contra_entrega' ? brandColor : '#e2e8f0'}`, 
                                background: modalidadPago === 'contra_entrega' ? `${brandColor}0d` : '#fafafa', 
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.1rem' }}>
                                🚚
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: modalidadPago === 'contra_entrega' ? brandColor : '#1e293b', fontFamily: "'Poppins', sans-serif" }}>
                                  Pago contra entrega
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>
                                  Pagas tus prendas y domicilio al recibir en tu puerta
                                </div>
                              </div>
                              <input 
                                type="radio" 
                                name="modalidadPago" 
                                value="contra_entrega"
                                checked={modalidadPago === 'contra_entrega'}
                                onChange={() => {
                                  setModalidadPago('contra_entrega');
                                  setIsPagoSeleccionado(true);
                                }}
                                style={{ accentColor: brandColor, width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                              />
                            </label>

                            {/* OPCIÓN 3: COORDINAR POR WHATSAPP */}
                            <label 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.75rem', 
                                padding: '0.85rem 1rem', 
                                borderRadius: '14px', 
                                border: `2px solid ${modalidadPago === 'whatsapp' ? brandColor : '#e2e8f0'}`, 
                                background: modalidadPago === 'whatsapp' ? `${brandColor}0d` : '#fafafa', 
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.1rem' }}>
                                💬
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: modalidadPago === 'whatsapp' ? brandColor : '#1e293b', fontFamily: "'Poppins', sans-serif" }}>
                                  Coordinar por WhatsApp
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>
                                  Coordina el pago y el costo del envío con la tienda
                                </div>
                              </div>
                              <input 
                                type="radio" 
                                name="modalidadPago" 
                                value="whatsapp"
                                checked={modalidadPago === 'whatsapp'}
                                onChange={() => setModalidadPago('whatsapp')}
                                style={{ accentColor: brandColor, width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                              />
                            </label>
                          </div>

                          {/* MOSTRAR CUENTAS BANCARIAS SI SELECCIONA TRANSFERENCIA */}
                          {modalidadPago === 'transferencia' && (
                            <div style={{ background: '#f8fafc', padding: '0.9rem 1rem', borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '0.84rem' }}>
                              <strong style={{ color: '#1e293b', display: 'block', marginBottom: '0.45rem', fontSize: '0.86rem' }}>
                                💳 Datos para la Transferencia:
                              </strong>
                              {(() => {
                                if (configuracion?.metodos_pago) {
                                  try {
                                    const parsed = JSON.parse(configuracion.metodos_pago);
                                    if (Array.isArray(parsed) && parsed.length > 0) {
                                      return parsed.map((m: any, idx: number) => (
                                        <div key={idx} style={{ padding: '0.35rem 0', color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: idx < parsed.length - 1 ? '1px dashed #e2e8f0' : 'none' }}>
                                          <span><strong>{m.banco}</strong> {m.tipo ? `(${m.tipo})` : ''}</span>
                                          <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{m.numero}</span>
                                        </div>
                                      ));
                                    }
                                  } catch {}
                                }
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', color: '#475569' }}>
                                    <div><strong>Bancolombia Ahorros:</strong> 456-789456-01</div>
                                    <div><strong>Nequi / Daviplata:</strong> 318 563 7317</div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* BOTONES INFERIORES (BOTÓN VOLVER Y CONFIRMAR PEDIDO) */}
                          <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => setCheckoutStep(2)}
                              style={{
                                padding: '0.85rem 1.1rem',
                                borderRadius: '14px',
                                border: '1.5px solid #e2e8f0',
                                background: '#ffffff',
                                color: '#0f172a',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease'
                              }}
                              title="Volver"
                            >
                              <ArrowLeft size={20} />
                            </button>

                            <button 
                              type="submit" 
                              style={{
                                flex: 1,
                                padding: '0.88rem 1rem',
                                borderRadius: '14px',
                                border: 'none',
                                background: brandColor,
                                color: '#ffffff',
                                fontSize: '0.98rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                boxShadow: `0 4px 14px ${brandColor}35`
                              }}
                            >
                              <Check size={20} />
                              <span>Confirmar pedido</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── RESUMEN DEL PEDIDO (SE MUESTRA ABAJO EN CADA PASO CON CONTENEDOR DE FONDO #f8fafc) ── */}
                      <div style={{ marginTop: '1.25rem', padding: '1.2rem 1.25rem', background: '#f8fafc', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.95rem' }}>
                          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>
                            Resumen del pedido <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.82rem' }}>({totalUnits} {totalUnits === 1 ? 'producto' : 'productos'})</span>
                          </h4>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.95rem' }}>
                          {items.map(item => {
                            const itemUnitPrice = getEffectivePrice(item, buyerType, markupPorcentaje, ajustesProductos, descuentoPromocional);
                            const itemTotal = itemUnitPrice * item.cantidad;
                            const thumbUrl = item.imagen_url || (item.imagenes_extra && item.imagenes_extra.length > 0 ? decodeExtraImage(item.imagenes_extra[0]).url : '');

                            return (
                              <div key={`${item.id}-${item.talla}-${item.estampado}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ position: 'relative', width: '46px', height: '46px', flexShrink: 0 }}>
                                  {thumbUrl ? (
                                    <img src={getOptimizedImageUrl(thumbUrl, 150, 75)} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                  ) : (
                                    <div style={{ width: '100%', height: '100%', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <Package size={18} color="#94a3b8" />
                                    </div>
                                  )}
                                  <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: '#fff', fontSize: '0.68rem', fontWeight: 700, width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.18)' }}>
                                    {item.cantidad}
                                  </span>
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <h5 style={{ margin: 0, fontSize: '0.84rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "'Poppins', sans-serif" }}>
                                    {toTitleCase(item.nombre)}
                                  </h5>
                                  {(item.talla || item.estampado) && (
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', display: 'block', fontFamily: "'Poppins', sans-serif" }}>
                                      {[item.talla ? `Talla: ${toTitleCase(item.talla)}` : '', item.estampado ? `Estampado: ${toTitleCase(item.estampado)}` : ''].filter(Boolean).join(' • ')}
                                    </span>
                                  )}
                                </div>

                                <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0f172a', flexShrink: 0, fontFamily: "'Poppins', sans-serif" }}>
                                  ${itemTotal.toLocaleString('es-CO')}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {isBulkDiscountApplied && (
                          <div 
                            className="wholesale-congrats-banner"
                            style={{ 
                              margin: '0.2rem 0 0.65rem 0', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.4rem',
                              color: '#059669',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              fontFamily: "'Poppins', sans-serif"
                            }}
                          >
                            <span>🎉</span>
                            <span>¡Felicidades! Aplicaste a compra por mayor</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.8rem', fontSize: '0.86rem', fontFamily: "'Poppins', sans-serif" }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                            <span>Subtotal</span>
                            <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.86rem' }}>${total.toLocaleString('es-CO')}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                            <span>Envío</span>
                            <span style={{ fontWeight: 500, color: '#0f172a', fontSize: '0.84rem' }}>Por calcular</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: '#0f172a', fontWeight: 700, fontSize: '0.96rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.6rem', marginTop: '0.25rem' }}>
                            <span>Total</span>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                              <span>${total.toLocaleString('es-CO')}</span>
                              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>+ envío</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </form>
            ) : (
              <>


                <div className="cart-items">
                  {items.length === 0 ? (
                    <p className="empty-cart">Tu carrito está vacío.</p>
                  ) : (
                    items.map(item => {
                      const brandColor = configuracion?.color_primario || 'var(--primary, #f36b8e)';
                      const itemUnitPrice = getEffectivePrice(item, effectiveCartBuyerType, markupPorcentaje, ajustesProductos, descuentoPromocional);
                      const itemTotalPrice = itemUnitPrice * item.cantidad;
                      const isItemDiscounted = isBulkDiscountApplied && getEffectivePrice(item, 'detal', markupPorcentaje, ajustesProductos, descuentoPromocional) > getEffectivePrice(item, 'mayorista', markupPorcentaje, ajustesProductos, descuentoPromocional);
                      const regularTotalPrice = getEffectivePrice(item, 'detal', markupPorcentaje, ajustesProductos, descuentoPromocional) * item.cantidad;

                      return (
                        <div 
                          key={`${item.id}-${item.talla || 'none'}-${item.estampado || 'none'}`} 
                          className="cart-item"
                          style={{ 
                            background: '#ffffff', 
                            borderRadius: '16px', 
                            border: '1px solid #e2e8f0', 
                            padding: '0.85rem', 
                            display: 'flex', 
                            gap: '0.85rem', 
                            alignItems: 'center', 
                            position: 'relative', 
                            marginBottom: '0.75rem',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                          }}
                        >
                          {/* FOTO CUADRADA CON BORDES REDONDEADOS */}
                          <div className="cart-item-img" style={{ width: '72px', height: '72px', borderRadius: '14px', overflow: 'hidden', flexShrink: 0 }}>
                            {item.imagen_url ? (
                              <img src={getOptimizedImageUrl(item.imagen_url, 150, 75)} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" decoding="async" />
                            ) : (item.imagenes_extra && item.imagenes_extra.length > 0 && decodeExtraImage(item.imagenes_extra[0]).url) ? (
                              <img src={getOptimizedImageUrl(decodeExtraImage(item.imagenes_extra[0]).url, 150, 75)} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" decoding="async" />
                            ) : (
                              <div className="img-placeholder-small" style={{ width: '100%', height: '100%', background: '#f1f5f9' }}></div>
                            )}
                          </div>

                          {/* DETALLES Y CONTROLES */}
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {/* TÍTULO Y BOTÓN DE ELIMINAR */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                              <h4 style={{ fontSize: '0.9rem', fontWeight: 500, color: '#0f172a', margin: 0, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                {toTitleCase(item.nombre)}
                              </h4>
                              <button 
                                className="cart-item-remove" 
                                onClick={() => removeFromCart(item.id, item.talla, item.estampado, item.nombre)}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                title="Eliminar producto"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>

                            {/* ETIQUETAS DE TALLA / ESTAMPADO */}
                            {(item.talla || item.estampado) && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', fontSize: '0.72rem', color: '#64748b' }}>
                                {item.talla && <span style={{ background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Talla: {item.talla}</span>}
                                {item.estampado && <span style={{ background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Estampado: {toTitleCase(item.estampado)}</span>}
                              </div>
                            )}

                            {/* FILA DE PRECIO Y STEPPER DE CANTIDAD */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                                  $ {itemTotalPrice.toLocaleString('es-CO')}
                                </span>
                                {isItemDiscounted && (
                                  <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '0.78rem' }}>
                                    ${regularTotalPrice.toLocaleString('es-CO')}
                                  </span>
                                )}
                              </div>

                              {/* STEPPER PILL CON COLOR DE MARCA DINÁMICO */}
                              <div style={{ background: '#f4f4f5', borderRadius: '12px', padding: '0.2rem 0.3rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <button 
                                  onClick={() => updateQuantity(item.id, item.cantidad - 1, item.talla, item.estampado, item.nombre)}
                                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontWeight: 500, fontSize: '1rem', cursor: 'pointer', padding: '0 0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  −
                                </button>
                                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', minWidth: '16px', textAlign: 'center' }}>
                                  {item.cantidad}
                                </span>
                                <button 
                                  onClick={() => updateQuantity(item.id, item.cantidad + 1, item.talla, item.estampado, item.nombre)}
                                  style={{ width: '26px', height: '26px', borderRadius: '8px', background: `${brandColor}18`, border: 'none', color: brandColor, fontWeight: 600, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Seccion de Upsell / Recomendados (Carrusel Auto-deslizante) */}
                {items.length > 0 && recommendedProducts.length > 0 && (() => {
                  const maxRecs = Math.min(5, recommendedProducts.length);
                  const currentRecIndex = recommendedIdx % maxRecs;
                  const p = recommendedProducts[currentRecIndex];
                  if (!p) return null;
                  const brandColor = configuracion?.color_primario || 'var(--primary, #f36b8e)';
                  const recPrice = getEffectivePrice(p, buyerType, markupPorcentaje, ajustesProductos, descuentoPromocional);

                  return (
                    <div style={{ margin: '0.5rem 1.15rem 0.65rem', padding: '0.65rem 0.85rem', backgroundColor: `${brandColor}0d`, borderRadius: '16px', border: `1px solid ${brandColor}25`, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Sparkles size={14} color={brandColor} />
                          <span style={{ color: '#0f172a', fontSize: '0.78rem', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
                            También te puede interesar:
                          </span>
                        </div>
                        {maxRecs > 1 && (
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {Array.from({ length: maxRecs }).map((_, idx) => (
                              <div
                                key={idx}
                                onClick={() => setRecommendedIdx(idx)}
                                style={{
                                  width: idx === currentRecIndex ? '14px' : '5px',
                                  height: '5px',
                                  borderRadius: '4px',
                                  background: idx === currentRecIndex ? brandColor : `${brandColor}40`,
                                  transition: 'all 0.3s ease',
                                  cursor: 'pointer'
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* TARJETA DE PRODUCTO CON TRANSICIÓN DE DERECHA A IZQUIERDA */}
                      <div 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.65rem', 
                          backgroundColor: '#ffffff', 
                          padding: '0.5rem 0.65rem', 
                          borderRadius: '12px', 
                          boxShadow: '0 2px 6px rgba(0,0,0,0.03)', 
                          border: '1px solid #f1f5f9',
                          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
                          transform: isRecommendedAnimating ? 'translateX(-16px)' : 'translateX(0)',
                          opacity: isRecommendedAnimating ? 0.3 : 1
                        }}
                      >
                        <div style={{ width: '46px', height: '46px', flexShrink: 0, borderRadius: '10px', overflow: 'hidden', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {p.imagen_url ? (
                            <img src={getOptimizedImageUrl(p.imagen_url, 150, 75)} alt={p.nombre} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (p.imagenes_extra && p.imagenes_extra.length > 0 && decodeExtraImage(p.imagenes_extra[0]).url) ? (
                            <img src={getOptimizedImageUrl(decodeExtraImage(p.imagenes_extra[0]).url, 150, 75)} alt={p.nombre} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Package size={18} color="#94a3b8" />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h5 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 500, color: '#0f172a', lineHeight: '1.2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {toTitleCase(p.nombre)}
                          </h5>
                          <p style={{ margin: '2px 0 0 0', color: '#0f172a', fontWeight: 700, fontSize: '0.86rem' }}>
                            ${recPrice.toLocaleString('es-CO')}
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
                          style={{ 
                            backgroundColor: brandColor, 
                            color: '#ffffff', 
                            border: 'none', 
                            padding: '0.4rem 0.75rem', 
                            borderRadius: '10px', 
                            fontSize: '0.78rem', 
                            fontWeight: 600, 
                            cursor: 'pointer', 
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            boxShadow: `0 2px 8px ${brandColor}35`
                          }}
                        >
                          <Plus size={14} /> Agregar
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <div className="cart-footer" style={{ padding: '1rem 1.15rem', background: '#ffffff', borderTop: '1px solid #f1f5f9' }}>
                  {/* SUBTOTAL ROW */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', fontSize: '0.92rem' }}>
                    <span style={{ color: '#64748b', fontWeight: 400 }}>Subtotal</span>
                    <strong style={{ color: '#0f172a', fontWeight: 600, fontSize: '0.96rem' }}>${total.toLocaleString('es-CO')}</strong>
                  </div>

                  {/* ENVÍO ROW */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.92rem' }}>
                    <span style={{ color: '#64748b', fontWeight: 400 }}>Envío</span>
                    <strong style={{ color: '#0f172a', fontWeight: 600, fontSize: '0.92rem' }}>Por calcular</strong>
                  </div>

                  {/* ENVÍO NOTE */}
                  <div style={{ textAlign: 'right', fontSize: '0.74rem', color: '#94a3b8', marginTop: '0.15rem', marginBottom: '0.65rem' }}>
                    Envío gratis o tarifas según tu ciudad
                  </div>

                  <div style={{ height: '1px', background: '#e2e8f0', margin: '0.6rem 0 0.75rem 0' }} />

                  {/* TOTAL ESTIMADO ROW */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.85rem' }}>
                    <span style={{ fontSize: '1.02rem', fontWeight: 600, color: '#0f172a' }}>Total estimado</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                      <strong style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>${total.toLocaleString('es-CO')}</strong>
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 400 }}>+ envío</span>
                    </div>
                  </div>

                  {buyerType === 'mayorista' && totalUnits < 6 && (
                    <div style={{ marginBottom: '0.6rem', background: '#fef2f2', border: '1px solid #fecdd3', color: '#991b1b', padding: '0.45rem 0.65rem', borderRadius: '8px', fontSize: '0.76rem', fontWeight: 700, textAlign: 'center' }}>
                      ⚠️ Mínimo 6 unidades para comprar al por mayor. Agrega {6 - totalUnits} {6 - totalUnits === 1 ? 'unidad más' : 'unidades más'}.
                    </div>
                  )}

                  {/* MAIN CTA BUTTON */}
                  <button 
                    className="checkout-btn" 
                    disabled={items.length === 0}
                    onClick={() => {
                      if (buyerType === 'mayorista' && totalUnits < 6) {
                        alert(`Tienes que comprar mínimo 6 unidades para poder comprar en nuestro catálogo mayorista. Actualmente llevas ${totalUnits} ${totalUnits === 1 ? 'unidad' : 'unidades'}. Agrega ${6 - totalUnits} más a tu carrito o cambia a modo Detal.`);
                        return;
                      }
                      setCheckoutStep(1);
                      setIsCheckoutMode(true);
                    }}
                    style={{ 
                      width: '100%',
                      padding: '0.88rem 1rem', 
                      fontSize: '0.98rem', 
                      fontWeight: 600,
                      borderRadius: '14px', 
                      background: (buyerType === 'mayorista' && totalUnits < 6) ? '#cbd5e1' : (configuracion?.color_primario || 'var(--primary, #f36b8e)'), 
                      color: '#ffffff',
                      border: 'none',
                      cursor: (buyerType === 'mayorista' && totalUnits < 6) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.55rem',
                      boxShadow: (buyerType === 'mayorista' && totalUnits < 6) ? 'none' : `0 4px 14px ${(configuracion?.color_primario || '#f36b8e')}40`
                    }}
                  >
                    <CreditCard size={18} />
                    Continuar con tu compra
                  </button>

                  {/* HELP LINK */}
                  <div 
                    onClick={() => {
                      const rawNum = overrideWhatsApp || configuracion?.whatsapp || configuracion?.telefono || '573185637317';
                      let cleanNum = rawNum.replace(/\D/g, '');
                      if (cleanNum.length === 10) {
                        cleanNum = '57' + cleanNum;
                      }
                      const msg = encodeURIComponent(`¡Hola! Tengo una duda sobre mi compra/pedido en la tienda.`);
                      window.open(`https://wa.me/${cleanNum}?text=${msg}`, '_blank');
                    }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginTop: '0.75rem', fontSize: '0.82rem', color: '#64748b', cursor: 'pointer' }}
                  >
                    <MessageCircle size={15} color="#25D366" />
                    <span>¿Preguntas? Escríbenos</span>
                  </div>
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

                {/* Share button (bottom-left INSIDE image frame) */}
                <button 
                  className="detail-share-btn" 
                  onClick={() => {
                    const shareUrl = window.location.href;
                    const shareData = {
                      title: detailProduct.nombre,
                      text: `Mira este producto en el catálogo digital: ${detailProduct.nombre}`,
                      url: shareUrl,
                    };
                    if (navigator.share) {
                      navigator.share(shareData).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(shareUrl);
                      alert('¡Enlace del producto copiado al portapapeles!');
                    }
                  }}
                  title="Compartir producto"
                >
                  <Share2 size={16} color="#0f172a" />
                  <span>Compartir</span>
                </button>

                {/* ── LABELS REFERENCIA Y ESTAMPADO (ABAJO DERECHO - EFECTO GLASS) ── */}
                <div style={{ position: 'absolute', bottom: '0.65rem', right: '0.65rem', left: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', zIndex: 10, alignItems: 'flex-end', pointerEvents: 'none', maxWidth: '60%' }}>
                  <div style={{ fontSize: '0.72rem', padding: '0.28rem 0.65rem', background: 'rgba(255, 255, 255, 0.88)', color: '#0f172a', fontWeight: 500, borderRadius: '8px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.7)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '100%', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3, textAlign: 'right' }}>
                    Ref: {toTitleCase(detailProduct.nombre)} {(detailProduct.referencia || detailProduct.sku) ? `(${detailProduct.referencia || detailProduct.sku})` : ''}
                  </div>
                  {currentImgRef && (
                    <div style={{ fontSize: '0.74rem', padding: '0.3rem 0.7rem', background: 'rgba(255, 255, 255, 0.88)', color: '#0f172a', fontWeight: 500, borderRadius: '8px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.7)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '100%', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3, textAlign: 'right' }}>
                      Estampado: {toTitleCase(currentImgRef)}
                    </div>
                  )}
                </div>
              </div>

              {/* ── INFO ── */}
              <div className="detail-info">
                <div className="detail-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', width: '100%', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <h3 className="detail-name" style={{ fontFamily: "'Poppins', sans-serif", fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.25 }}>
                      {toTitleCase(detailProduct.nombre)}
                    </h3>
                    {detailProduct.descripcion ? (
                      <span style={{ fontSize: '0.78rem', fontWeight: 400, color: '#64748b', marginTop: '0.18rem' }}>
                        {toTitleCase(detailProduct.descripcion)}
                      </span>
                    ) : tallas.length > 0 ? (
                      <span style={{ fontSize: '0.74rem', fontWeight: 500, color: '#64748b', letterSpacing: '0.4px', marginTop: '0.18rem' }}>
                        Tallas {tallas.join(' • ')}
                      </span>
                    ) : null}
                  </div>
                  <div className="detail-price-wrap" style={{ textAlign: 'right', flexShrink: 0, minWidth: '115px' }}>
                    {(() => {
                      const activeUnitPriceDetal = getActiveUnitPrice(detailProduct, selectedMiembroFamilia, selectedTalla, 'detal');
                      const activeUnitPriceMayor = getActiveUnitPrice(detailProduct, selectedMiembroFamilia, selectedTalla, 'mayorista');
                      let priceDetal = getEffectivePrice({ ...detailProduct, precio: activeUnitPriceDetal }, 'detal', markupPorcentaje, ajustesProductos, descuentoPromocional);
                      let priceMayor = getEffectivePrice({ ...detailProduct, precio: activeUnitPriceMayor }, 'mayorista', markupPorcentaje, ajustesProductos, descuentoPromocional);

                      if (detailProduct.es_producto_familiar && (priceDetal <= 5 || !selectedMiembroFamilia)) {
                        const { minDetal, minMayor } = getFamilyPriceRange(detailProduct);
                        if (minDetal > 0) priceDetal = minDetal;
                        if (minMayor > 0) priceMayor = minMayor;
                      }

                      const hasWholesale = priceMayor > 0 && priceMayor < priceDetal;

                      if (hasWholesale) {
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'right', alignItems: 'flex-end', fontFamily: "'Poppins', sans-serif" }}>
                            {/* 1. PRIMERO: PRECIO AL DETAL */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: '0.86rem', color: '#64748b', fontWeight: 500 }}>Detal:</span>
                              <strong style={{ fontSize: '1.12rem', fontWeight: 600, color: configuracion?.color_primario || 'var(--primary, #f36b8e)' }}>
                                ${priceDetal.toLocaleString('es-CO')}
                              </strong>
                            </div>

                            {/* 2. ABAJO: PRECIO AL POR MAYOR */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#15803d', background: '#dcfce7', padding: '0.18rem 0.5rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                Por mayor +6:
                              </span>
                              <strong style={{ fontSize: '1.12rem', fontWeight: 600, color: '#166534' }}>
                                ${priceMayor.toLocaleString('es-CO')}
                              </strong>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div style={{ textAlign: 'right', whiteSpace: 'nowrap', fontFamily: "'Poppins', sans-serif" }}>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>Detal</div>
                          <span style={{ fontSize: '1.18rem', fontWeight: 600, color: configuracion?.color_primario || 'var(--primary, #f36b8e)' }}>
                            ${priceDetal.toLocaleString('es-CO')}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* ── PRODUCTO FAMILIAR OPTION SELECTOR WITH QUANTITIES ── */}
                {detailProduct.es_producto_familiar && detailProduct.precios_familia ? (
                  <div className="detail-tallas" style={{ width: '100%', background: '#f0f9ff', padding: '0.85rem', borderRadius: '14px', border: '1.5px solid #bae6fd', marginBottom: '0.85rem' }}>
                    <p className="detail-section-label" style={{ color: '#0369a1', fontWeight: 600, marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.88rem' }}>
                      👨‍👩‍👧‍👦 Selecciona la Cantidad para cada Opción y Talla:
                    </p>

                    {/* ADULTOS / UNISEX */}
                    {(() => {
                      const adultOpts = [
                        { key: 'dama_unica', label: '👩 Dama Única', adminKey: 'Dama Única' },
                        { key: 'dama_plus', label: '👩 Dama Plus', adminKey: 'Dama Plus' },
                        { key: 'caballero_unica', label: '👨 Caballero Única', adminKey: 'Caballero Única' },
                        { key: 'unisex_2xl', label: '🧑 2XL Unisex', adminKey: '2XL Unisex' }
                      ].filter(opt => !isFamOptionDisabled(detailProduct, opt.adminKey));

                      if (adultOpts.length === 0) return null;

                      return (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem', fontFamily: "'Poppins', sans-serif" }}>
                            👔 Opciones Adultos / Unisex
                          </span>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: '0.4rem' }}>
                            {adultOpts.map(opt => {
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
                                  <div style={{ fontWeight: 600, fontSize: '0.76rem', color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>{opt.label}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600, margin: '0.15rem 0 0.35rem', fontFamily: "'Poppins', sans-serif" }}>
                                    ${optPrice.toLocaleString('es-CO')}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => setFamOptionQuantities(prev => ({ ...prev, [opt.key]: Math.max(0, (prev[opt.key] || 0) - 1) }))}
                                      style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}
                                    >
                                      −
                                    </button>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '16px', textAlign: 'center', color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>{qty}</span>
                                    <button
                                      type="button"
                                      onClick={() => setFamOptionQuantities(prev => ({ ...prev, [opt.key]: (prev[opt.key] || 0) + 1 }))}
                                      style={{ width: '24px', height: '24px', borderRadius: '6px', border: 'none', background: '#0284c7', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* NIÑOS POR TALLAS */}
                    {(() => {
                      const kidOpts = ['2/4', '6/8', '10/12', '14/16', '18'].filter(sz => !isFamOptionDisabled(detailProduct, sz));

                      if (kidOpts.length === 0) return null;

                      return (
                        <div>
                          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#0369a1', display: 'block', marginBottom: '0.35rem', fontFamily: "'Poppins', sans-serif" }}>
                            👶 Tallas Infantiles (Niños)
                          </span>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.4rem' }}>
                            {kidOpts.map(sz => {
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
                                  <div style={{ fontWeight: 600, fontSize: '0.76rem', color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>Talla {sz}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600, margin: '0.15rem 0 0.35rem', fontFamily: "'Poppins', sans-serif" }}>
                                    ${optPrice.toLocaleString('es-CO')}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => setFamOptionQuantities(prev => ({ ...prev, [sz]: Math.max(0, (prev[sz] || 0) - 1) }))}
                                      style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}
                                    >
                                      −
                                    </button>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '16px', textAlign: 'center', color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>{qty}</span>
                                    <button
                                      type="button"
                                      onClick={() => setFamOptionQuantities(prev => ({ ...prev, [sz]: (prev[sz] || 0) + 1 }))}
                                      style={{ width: '24px', height: '24px', borderRadius: '6px', border: 'none', background: '#0284c7', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : null}

                {/* ── FILA EN 2 COLUMNAS: ESTAMPADO + TALLAS ── */}
                {(() => {
                  const imgEstampados = allImages.map(img => (img.estampado || img.ref)?.trim().toUpperCase()).filter(Boolean);
                  const estampados = imgEstampados.length > 0 ? Array.from(new Set(imgEstampados)) : legacyEstampados;
                  const hasEstampados = estampados.length > 0;
                  const hasTallas = !detailProduct.es_producto_familiar && tallas.length > 0;

                  if (!hasEstampados && !hasTallas) return null;

                  return (
                    <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', width: '100%', marginTop: '1.15rem', marginBottom: '1.15rem' }}>
                      {/* COLUMNA 1: ESTAMPADO / TEMÁTICA */}
                      {hasEstampados && (
                        <div className="detail-tallas" style={{ flex: 1, minWidth: 0 }}>
                          <p className="detail-section-label" style={{ marginBottom: '0.55rem', fontWeight: 600 }}>Estampado / Temática</p>
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
                              padding: '0.55rem 0.65rem',
                              borderRadius: '12px',
                              border: '1.5px solid var(--primary, #f36b8e)',
                              background: '#ffffff',
                              color: '#0f172a',
                              fontWeight: 600,
                              fontSize: '0.84rem',
                              cursor: 'pointer',
                              outline: 'none',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {estampados.map(est => (
                              <option key={est} value={est}>
                                🎨 {toTitleCase(est)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* COLUMNA 2: TALLA */}
                      {hasTallas && (
                        <div className="detail-tallas" style={{ flex: hasEstampados ? '0 0 auto' : 1, minWidth: 0 }}>
                          <p className="detail-section-label" style={{ marginBottom: '0.55rem', fontWeight: 600 }}>Talla</p>
                          <div className="tallas-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
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
                    </div>
                  );
                })()}

                  {/* ── FILA EN 2 COLUMNAS: CANTIDAD + AÑADIR AL CARRITO ── */}
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', width: '100%', marginTop: '1.1rem' }}>
                    {!detailProduct.es_producto_familiar && (
                      <div className="detail-cantidad" style={{ flexShrink: 0, minWidth: '110px' }}>
                        <div className="cantidad-control" style={{ height: '44px', borderRadius: '12px' }}>
                          <button className="qty-btn" onClick={() => setSelectedCantidad(q => Math.max(1, q - 1))}>−</button>
                          <span className="qty-value">{selectedCantidad}</span>
                          <button className="qty-btn" onClick={() => setSelectedCantidad(q => q + 1)}>+</button>
                        </div>
                      </div>
                    )}

                    {/* BOTÓN AÑADIR AL CARRITO (COLOR ESTÁTICO DE LA EMPRESA, ROUNDED) */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {(() => {
                        const brandColor = configuracion?.color_primario || 'var(--primary, #f36b8e)';
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
                            <button 
                              className="detail-add-btn" 
                              style={{ background: brandColor, borderRadius: '12px' }} 
                              onClick={handleAddFromDetail}
                            >
                              <ShoppingCart size={18} />
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {totalFamUnits > 0
                                  ? `Añadir • $${totalFamPrice.toLocaleString('es-CO')} (${totalFamUnits})`
                                  : 'Añadir al carrito'}
                              </span>
                            </button>
                          );
                        }
                        return (
                          <button 
                            className="detail-add-btn" 
                            style={{ background: brandColor, borderRadius: '12px' }} 
                            onClick={handleAddFromDetail}
                          >
                            <ShoppingCart size={18} />
                            <span>Añadir • ${(getEffectivePrice({ ...detailProduct, precio: getActiveUnitPrice(detailProduct, selectedMiembroFamilia, selectedTalla, buyerType) }, buyerType, markupPorcentaje, ajustesProductos, descuentoPromocional) * selectedCantidad).toLocaleString('es-CO')}</span>
                          </button>
                        );
                      })()}
                    </div>
                  </div>
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

      {/* ── MODAL DE CONFIRMACIÓN / RESUMEN DEL PEDIDO ("Pedido reservado") ── */}
      {orderSummaryData && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              maxWidth: '440px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '1.75rem 1.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              fontFamily: "'Poppins', sans-serif",
              textAlign: 'center',
              position: 'relative'
            }}
          >
            {/* BADGE DE RELOJ / CONFIRMACIÓN */}
            <div 
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#fef3c7',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto'
              }}
            >
              <span style={{ fontSize: '1.6rem' }}>🕒</span>
            </div>

            {/* TÍTULO Y SUBTÍTULO */}
            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>
              {orderSummaryData.modalidadPago === 'contra_entrega' ? 'Pedido Registrado' : 'Pedido Reservado'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b', lineHeight: 1.45, padding: '0 0.5rem' }}>
              {orderSummaryData.modalidadPago === 'contra_entrega' ? (
                <>Tu pedido <span style={{ color: '#0f172a', fontWeight: 600 }}>{orderSummaryData.orderCode}</span> ha sido registrado en modalidad <strong>Pago Contra Entrega</strong>. Pagarás al recibir tus productos.</>
              ) : (
                <>Tu pedido <span style={{ color: '#0f172a', fontWeight: 600 }}>{orderSummaryData.orderCode}</span> está reservado. Realiza el pago y envía tu comprobante mediante el enlace adjunto.</>
              )}
            </p>


            {/* TABLA DE DETALLES DEL PEDIDO */}
            <div style={{ margin: '1.25rem 0 1.15rem 0', textAlign: 'left', fontSize: '0.86rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', color: '#64748b' }}>
                <span>Pedido</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{orderSummaryData.orderCode}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', color: '#64748b' }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>${orderSummaryData.subtotal.toLocaleString('es-CO')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', color: '#64748b' }}>
                <span>Envío</span>
                <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '12px' }}>
                  Por acordar
                </span>
              </div>
              
              <div style={{ borderTop: '1px solid #f1f5f9', margin: '0.5rem 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontWeight: 600, color: '#0f172a', fontSize: '0.92rem' }}>
                <span>Total</span>
                <span>${orderSummaryData.total.toLocaleString('es-CO')} + envío</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                <span style={{ color: '#64748b' }}>Estado</span>
                <span style={{ 
                  color: orderSummaryData.modalidadPago === 'contra_entrega' ? '#059669' : orderSummaryData.modalidadPago === 'whatsapp' ? '#0284c7' : '#d97706', 
                  fontWeight: 600 
                }}>
                  {orderSummaryData.modalidadPago === 'contra_entrega' ? 'Pago contra entrega' : orderSummaryData.modalidadPago === 'whatsapp' ? 'Por acordar en WhatsApp' : 'Pendiente de pago'}
                </span>
              </div>
            </div>

            {/* DETALLES DE LA FORMA DE PAGO */}
            <div style={{ background: '#fafafa', border: '1px solid #f1f5f9', borderRadius: '16px', padding: '0.95rem 1rem', textAlign: 'left', marginBottom: '1.4rem', fontSize: '0.84rem' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.65rem' }}>
                {orderSummaryData.modalidadPago === 'transferencia' ? '🏦 Transferencia Bancaria' : orderSummaryData.modalidadPago === 'contra_entrega' ? '🚚 Pago contra entrega' : '💬 Coordinar por WhatsApp'}
              </div>

              {orderSummaryData.modalidadPago === 'transferencia' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>
                    💳 Cuentas para Transferencia / Nequi:
                  </div>
                  {(() => {
                    if (configuracion?.metodos_pago) {
                      try {
                        const parsed = JSON.parse(configuracion.metodos_pago);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                          return parsed.map((m: any, idx: number) => (
                            <div key={idx} style={{ padding: '0.35rem 0', color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: idx < parsed.length - 1 ? '1px dashed #e2e8f0' : 'none', fontFamily: "'Poppins', sans-serif" }}>
                              <span><strong>{m.banco}</strong> {m.tipo ? `(${m.tipo})` : ''}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>{m.numero}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(m.numero);
                                    setCopiedField(true);
                                    setTimeout(() => setCopiedField(false), 2000);
                                  }}
                                  style={{ background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', padding: '2px 6px', fontSize: '0.74rem', color: '#0f172a', fontWeight: 500 }}
                                  title="Copiar número de cuenta"
                                >
                                  {copiedField ? '✓ Copiado' : '📋 Copiar'}
                                </button>
                              </div>
                            </div>
                          ));
                        } else if (typeof configuracion.metodos_pago === 'string' && configuracion.metodos_pago.trim() !== '') {
                          return <div style={{ whiteSpace: 'pre-line', color: '#334155', fontFamily: "'Poppins', sans-serif", fontSize: '0.82rem' }}>{configuracion.metodos_pago}</div>;
                        }
                      } catch {
                        if (typeof configuracion.metodos_pago === 'string' && configuracion.metodos_pago.trim() !== '') {
                          return <div style={{ whiteSpace: 'pre-line', color: '#334155', fontFamily: "'Poppins', sans-serif", fontSize: '0.82rem' }}>{configuracion.metodos_pago}</div>;
                        }
                      }
                    }
                    return (
                      <div style={{ color: '#475569', fontSize: '0.8rem', fontFamily: "'Poppins', sans-serif" }}>
                        Solicita los datos bancarios directamente por WhatsApp al asesor.
                      </div>
                    );
                  })()}
                </div>
              )}

              {orderSummaryData.modalidadPago === 'contra_entrega' && (
                <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.4, fontFamily: "'Poppins', sans-serif" }}>
                  Cancela al momento de recibir tu pedido el valor de las prendas + el costo del envío. ¡Fácil, seguro y sin pagos anticipados!
                </div>
              )}

              {orderSummaryData.modalidadPago === 'whatsapp' && (
                <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>
                  Coordina la cuenta de pago y el valor del envío directamente a través del chat de WhatsApp con la tienda.
                </div>
              )}
            </div>

            {/* BOTONES INFERIORES */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <button
                type="button"
                onClick={() => {
                  window.open(orderSummaryData.whatsappUrl, '_blank');
                }}
                style={{
                  width: '100%',
                  padding: '0.88rem',
                  borderRadius: '14px',
                  border: 'none',
                  background: '#10b981',
                  color: '#ffffff',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                }}
              >
                <span>
                  {orderSummaryData.modalidadPago === 'contra_entrega'
                    ? '🚚 Enviar pedido por WhatsApp'
                    : '📲 Enviar pedido por WhatsApp con enlace de pago'}
                </span>

              </button>

              <button
                type="button"
                onClick={() => setOrderSummaryData(null)}
                style={{
                  width: '100%',
                  padding: '0.82rem',
                  borderRadius: '14px',
                  border: '1.5px solid #fca5a5',
                  background: '#fff5f5',
                  color: '#e11d48',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                <span>🏪 Volver a la tienda</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── MODAL ALERTA ERROR DE ESCRITURA EN ENLACE (TYPO AUTO-CORRECTION) ── */}
      {typoModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.78)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem',
          boxSizing: 'border-box',
          fontFamily: "'Poppins', sans-serif"
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '2rem 1.5rem',
            maxWidth: '440px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #f1f5f9',
            boxSizing: 'border-box'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
              fontSize: '2rem',
              border: '2px solid #fde68a'
            }}>
              🔍
            </div>
            
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
              ¿Buscabas {typoModal.targetName}?
            </h3>
            
            <p style={{ fontSize: '0.88rem', fontWeight: 400, color: '#64748b', margin: '0 0 1.25rem 0', lineHeight: '1.5' }}>
              El enlace ingresado (<code style={{ background: '#fff1f2', color: '#e11d48', padding: '0.2rem 0.45rem', borderRadius: '6px', fontSize: '0.82rem', border: '1px solid #fecdd3' }}>/{typoModal.rawSlug}</code>) contiene un pequeño error de escritura.
            </p>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '1rem',
              marginBottom: '1.5rem',
              textAlign: 'left'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b', display: 'block', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                Te estamos dirigiendo al catálogo oficial:
              </span>
              <span style={{ fontSize: '0.98rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                🛍️ Catálogo Oficial de {typoModal.targetName}
              </span>
            </div>

            <button
              onClick={() => {
                const params = window.location.search;
                window.location.href = `/${typoModal.canonicalSlug}${params}`;
              }}
              style={{
                width: '100%',
                padding: '0.85rem 1.2rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.2s',
                fontFamily: "'Poppins', sans-serif"
              }}
            >
              🚀 Ir al catálogo de {typoModal.targetName}
            </button>

            <p style={{ fontSize: '0.78rem', fontWeight: 400, color: '#94a3b8', marginTop: '1.1rem', marginBottom: 0 }}>
              Redirigiendo automáticamente en <strong style={{ fontWeight: 600, color: '#059669' }}>{countdown} segundos</strong>...
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
