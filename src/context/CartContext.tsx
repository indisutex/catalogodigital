import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Producto } from '../types';
import { getTenantId } from '../lib/supabase';

export interface CartItem extends Producto {
  cantidad: number;
  talla?: string; // Talla seleccionada
  estampado?: string; // Estampado seleccionado
  precio_detal?: number;
  precio_aplicado_mayor?: boolean;
}

export type BuyerType = 'detal' | 'mayorista' | '50_unidades' | null;

export const getEffectivePrice = (producto: Producto, buyerType: BuyerType, markup: number = 0, ajustesProductos?: any, descuentoPromo: number = 0, ignoreDiscounts: boolean = false): number => {
  if (!producto) return 0;
  let price = Number(producto.precio) || 0;
  if (buyerType === 'mayorista' && producto.precio_por_mayor) {
    price = Number(producto.precio_por_mayor) || price;
  } else if (buyerType === '50_unidades' && producto.precio_50_unidades) {
    price = Number(producto.precio_50_unidades) || price;
  }

  let finalPrice = price;
  let hasCustomPrice = false;

  // Si hay ajustes específicos para este producto
  if (ajustesProductos && ajustesProductos[producto.id]) {
    const setting = ajustesProductos[producto.id];
    if (setting !== null && typeof setting === 'object') {
      if (setting.precio_personalizado !== undefined && setting.precio_personalizado !== null && Number(setting.precio_personalizado) > 0) {
        finalPrice = Number(setting.precio_personalizado);
        hasCustomPrice = true;
      } else if (setting.porcentaje_personalizado !== undefined && setting.porcentaje_personalizado !== null) {
        const customMarkup = Number(setting.porcentaje_personalizado);
        if (customMarkup > 0) {
          finalPrice = Math.round(price * (1 + customMarkup / 100));
          hasCustomPrice = true;
        }
      }
    } else if (typeof setting === 'number' || typeof setting === 'string') {
      const customPrice = Number(setting);
      if (customPrice > 0) {
        finalPrice = customPrice;
        hasCustomPrice = true;
      }
    }
  }

  if (!hasCustomPrice && markup > 0) {
    finalPrice = Math.round(price * (1 + markup / 100));
  }

  if (ignoreDiscounts) {
    return finalPrice;
  }

  // Aplicar descuento (el descuento del producto específico tiene prioridad, sino se usa el global)
  const desc = (producto.descuento !== undefined && producto.descuento > 0)
    ? producto.descuento
    : descuentoPromo;

  if (desc > 0) {
    finalPrice = Math.round(finalPrice * (1 - desc / 100));
  }

  return finalPrice;
};

interface OfferNotification {
  show: boolean;
  message: string;
  submessage?: string;
  type: 'progress' | 'unlocked';
  unitsNeeded: number;
  targetTierName: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (producto: Producto, talla?: string, estampado?: string, cantidad?: number) => void;
  removeFromCart: (id: string, talla?: string, estampado?: string, nombre?: string) => void;
  updateQuantity: (id: string, cantidad: number, talla?: string, estampado?: string, nombre?: string) => void;
  clearCart: () => void;
  total: number;
  buyerType: BuyerType;
  setBuyerType: (type: BuyerType) => void;
  markupPorcentaje: number;
  setMarkupPorcentaje: (val: number) => void;
  ajustesProductos: any;
  setAjustesProductos: (val: any) => void;
  descuentoPromocional: number;
  setDescuentoPromocional: (val: number) => void;
  isBulkDiscountEnabled: boolean;
  setIsBulkDiscountEnabled: (val: boolean) => void;
  totalUnits: number;
  isBulkDiscountApplied: boolean;
  effectiveCartBuyerType: BuyerType;
  nextTierTarget: number;
  unitsNeededForNextTier: number;
  tierProgressPercent: number;
  currentTierName: string;
  offerNotification: OfferNotification | null;
  dismissOfferNotification: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const tenantId = getTenantId() || 'saramantha';
      const saved = localStorage.getItem(`indisutex_cart_${tenantId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [buyerType, setBuyerType] = useState<BuyerType>(() => {
    const tenantId = getTenantId() || 'saramantha';
    const saved = localStorage.getItem(`indisutex_buyer_type_${tenantId}`);
    return saved ? (saved as BuyerType) : null;
  });

  const [markupPorcentaje, setMarkupPorcentaje] = useState<number>(() => {
    const tenantId = getTenantId() || 'saramantha';
    const saved = sessionStorage.getItem(`indisutex_markup_${tenantId}`);
    return saved ? Number(saved) : 0;
  });

  const [ajustesProductos, setAjustesProductos] = useState<any>(() => {
    try {
      const tenantId = getTenantId() || 'saramantha';
      const saved = sessionStorage.getItem(`indisutex_ajustes_productos_${tenantId}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [descuentoPromocional, setDescuentoPromocional] = useState<number>(0);
  const [isBulkDiscountEnabled, setIsBulkDiscountEnabled] = useState<boolean>(true);
  const [offerNotification, setOfferNotification] = useState<OfferNotification | null>(null);

  useEffect(() => {
    const tenantId = getTenantId() || 'saramantha';
    sessionStorage.setItem(`indisutex_ajustes_productos_${tenantId}`, JSON.stringify(ajustesProductos));
  }, [ajustesProductos]);

  useEffect(() => {
    const tenantId = getTenantId() || 'saramantha';
    localStorage.setItem(`indisutex_cart_${tenantId}`, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    const tenantId = getTenantId() || 'saramantha';
    if (buyerType) {
      localStorage.setItem(`indisutex_buyer_type_${tenantId}`, buyerType);
    } else {
      localStorage.removeItem(`indisutex_buyer_type_${tenantId}`);
    }
  }, [buyerType]);

  useEffect(() => {
    const tenantId = getTenantId() || 'saramantha';
    sessionStorage.setItem(`indisutex_markup_${tenantId}`, String(markupPorcentaje));
  }, [markupPorcentaje]);

  const totalUnits = items.reduce((sum, item) => sum + item.cantidad, 0);

  // Offer calculation
  let nextTierTarget = 6;
  let currentTierName = 'Detal';

  if (totalUnits < 6) {
    nextTierTarget = 6;
    currentTierName = 'Detal';
  } else if (totalUnits < 50) {
    nextTierTarget = 50;
    currentTierName = 'Por Mayor';
  } else {
    nextTierTarget = 50;
    currentTierName = '50+ Unidades';
  }

  const unitsNeededForNextTier = Math.max(0, nextTierTarget - totalUnits);

  let tierProgressPercent = 0;
  if (totalUnits < 6) {
    tierProgressPercent = Math.min(100, Math.round((totalUnits / 6) * 100));
  } else if (totalUnits < 50) {
    tierProgressPercent = Math.min(100, Math.round(((totalUnits - 6) / (50 - 6)) * 100));
  } else {
    tierProgressPercent = 100;
  }

  const triggerNotification = (newUnits: number) => {
    let msg = '';
    let submsg = '';
    let type: 'progress' | 'unlocked' = 'progress';
    let needed = 0;
    let targetName = 'Por Mayor';

    if (newUnits < 6) {
      needed = 6 - newUnits;
      targetName = 'Por Mayor';
      type = 'progress';
      msg = `¡Agregado al carrito! 🛍️`;
      submsg = `Te faltan solo ${needed} ${needed === 1 ? 'prenda' : 'prendas'} para desbloquear el PRECIO POR MAYOR 🔥`;
    } else if (newUnits === 6) {
      needed = 0;
      targetName = 'Por Mayor';
      type = 'unlocked';
      msg = `🎉 ¡FELICIDADES! ¡ALCANZASTE EL PRECIO POR MAYOR!`;
      submsg = `Ahora todas tus prendas se calculan con tarifa mayorista 🔥`;
    } else if (newUnits < 50) {
      needed = 50 - newUnits;
      targetName = '50+ Unidades';
      type = 'progress';
      msg = `¡Excelente elección! 🛍️`;
      submsg = `¡Oferta Por Mayor Activa! Te faltan ${needed} ${needed === 1 ? 'prenda' : 'prendas'} para el SÚPER PRECIO 50+ UNIDADES 🏆`;
    } else {
      needed = 0;
      targetName = '50+ Unidades';
      type = 'unlocked';
      msg = `🏆 ¡MÁXIMO DESCUENTO ACTIVADO!`;
      submsg = `Estás disfrutando la mejor tarifa distribuidor de 50+ unidades.`;
    }

    setOfferNotification({
      show: true,
      message: msg,
      submessage: submsg,
      type,
      unitsNeeded: needed,
      targetTierName: targetName
    });
  };

  const addToCart = (producto: Producto, talla?: string, estampado?: string, cantidad: number = 1) => {
    const newTotalUnits = totalUnits + cantidad;
    setItems(prevItems => {
      const existingItem = prevItems.find(
        item => item.id === producto.id && item.nombre === producto.nombre && item.talla === talla && item.estampado === estampado
      );
      if (existingItem) {
        return prevItems.map(item =>
          (item.id === producto.id && item.nombre === producto.nombre && item.talla === talla && item.estampado === estampado)
            ? { ...item, cantidad: item.cantidad + cantidad }
            : item
        );
      }
      return [...prevItems, { ...producto, cantidad, talla, estampado }];
    });
    triggerNotification(newTotalUnits);
  };

  const removeFromCart = (id: string, talla?: string, estampado?: string, nombre?: string) => {
    setItems(prevItems => prevItems.filter(item => !(item.id === id && (nombre ? item.nombre === nombre : true) && item.talla === talla && item.estampado === estampado)));
  };

  const updateQuantity = (id: string, cantidad: number, talla?: string, estampado?: string, nombre?: string) => {
    if (cantidad < 1) {
      removeFromCart(id, talla, estampado, nombre);
      return;
    }
    const targetItem = items.find(i => i.id === id && (nombre ? i.nombre === nombre : true) && i.talla === talla && i.estampado === estampado);
    const diff = targetItem ? cantidad - targetItem.cantidad : 0;
    const newTotal = totalUnits + diff;
    
    setItems(prevItems =>
      prevItems.map(item =>
        (item.id === id && (nombre ? item.nombre === nombre : true) && item.talla === talla && item.estampado === estampado) ? { ...item, cantidad } : item
      )
    );
    if (diff > 0) {
      triggerNotification(newTotal);
    }
  };

  const clearCart = () => setItems([]);
  const dismissOfferNotification = () => setOfferNotification(null);

  const isBulkDiscountApplied = isBulkDiscountEnabled && (buyerType === 'detal' || buyerType === null) && totalUnits >= 6;
  const effectiveCartBuyerType: BuyerType = isBulkDiscountApplied ? 'mayorista' : buyerType;

  const total = items.reduce(
    (sum, item) => sum + (getEffectivePrice(item, effectiveCartBuyerType, markupPorcentaje, ajustesProductos, descuentoPromocional) * item.cantidad),
    0
  );

  return (
    <CartContext.Provider value={{ 
      items, 
      addToCart, 
      removeFromCart, 
      updateQuantity, 
      clearCart, 
      total, 
      buyerType, 
      setBuyerType, 
      markupPorcentaje, 
      setMarkupPorcentaje, 
      ajustesProductos, 
      setAjustesProductos, 
      descuentoPromocional, 
      setDescuentoPromocional,
      isBulkDiscountEnabled,
      setIsBulkDiscountEnabled,
      totalUnits,
      isBulkDiscountApplied,
      effectiveCartBuyerType,
      nextTierTarget,
      unitsNeededForNextTier,
      tierProgressPercent,
      currentTierName,
      offerNotification,
      dismissOfferNotification
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
