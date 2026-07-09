import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Producto } from '../types';
import { getTenantId } from '../lib/supabase';

export interface CartItem extends Producto {
  cantidad: number;
  talla?: string; // Talla seleccionada
  estampado?: string; // Estampado seleccionado
}

export type BuyerType = 'detal' | 'mayorista' | '50_unidades' | null;

export const getEffectivePrice = (producto: Producto, buyerType: BuyerType, markup: number = 0, ajustesProductos?: any): number => {
  let price = producto.precio;
  if (buyerType === 'mayorista' && producto.precio_por_mayor) {
    price = producto.precio_por_mayor;
  } else if (buyerType === '50_unidades' && producto.precio_50_unidades) {
    price = producto.precio_50_unidades;
  }

  // Si hay ajustes específicos para este producto
  if (ajustesProductos && ajustesProductos[producto.id]) {
    const setting = ajustesProductos[producto.id];
    if (setting.precio_personalizado !== undefined && setting.precio_personalizado !== null && Number(setting.precio_personalizado) > 0) {
      return Number(setting.precio_personalizado);
    }
    if (setting.porcentaje_personalizado !== undefined && setting.porcentaje_personalizado !== null) {
      const customMarkup = Number(setting.porcentaje_personalizado);
      if (customMarkup > 0) {
        return Math.round(price * (1 + customMarkup / 100));
      }
    }
  }

  if (markup > 0) {
    return Math.round(price * (1 + markup / 100));
  }
  return price;
};

interface CartContextType {
  items: CartItem[];
  addToCart: (producto: Producto, talla?: string, estampado?: string, cantidad?: number) => void;
  removeFromCart: (id: string, talla?: string, estampado?: string) => void;
  updateQuantity: (id: string, cantidad: number, talla?: string, estampado?: string) => void;
  clearCart: () => void;
  total: number;
  buyerType: BuyerType;
  setBuyerType: (type: BuyerType) => void;
  markupPorcentaje: number;
  setMarkupPorcentaje: (val: number) => void;
  ajustesProductos: any;
  setAjustesProductos: (val: any) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    const tenantId = getTenantId() || 'saramantha';
    const saved = localStorage.getItem(`indisutex_cart_${tenantId}`);
    return saved ? JSON.parse(saved) : [];
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
    const tenantId = getTenantId() || 'saramantha';
    const saved = sessionStorage.getItem(`indisutex_ajustes_productos_${tenantId}`);
    return saved ? JSON.parse(saved) : {};
  });

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

  const addToCart = (producto: Producto, talla?: string, estampado?: string, cantidad: number = 1) => {
    setItems(prevItems => {
      const existingItem = prevItems.find(
        item => item.id === producto.id && item.talla === talla && item.estampado === estampado
      );
      if (existingItem) {
        return prevItems.map(item =>
          (item.id === producto.id && item.talla === talla && item.estampado === estampado)
            ? { ...item, cantidad: item.cantidad + cantidad }
            : item
        );
      }
      return [...prevItems, { ...producto, cantidad, talla, estampado }];
    });
  };

  const removeFromCart = (id: string, talla?: string, estampado?: string) => {
    setItems(prevItems => prevItems.filter(item => !(item.id === id && item.talla === talla && item.estampado === estampado)));
  };

  const updateQuantity = (id: string, cantidad: number, talla?: string, estampado?: string) => {
    if (cantidad < 1) {
      removeFromCart(id, talla, estampado);
      return;
    }
    setItems(prevItems =>
      prevItems.map(item =>
        (item.id === id && item.talla === talla && item.estampado === estampado) ? { ...item, cantidad } : item
      )
    );
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, item) => sum + (getEffectivePrice(item, buyerType, markupPorcentaje, ajustesProductos) * item.cantidad), 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, total, buyerType, setBuyerType, markupPorcentaje, setMarkupPorcentaje, ajustesProductos, setAjustesProductos }}>
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
