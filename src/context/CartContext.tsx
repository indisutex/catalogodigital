import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { Producto } from '../types';

export interface CartItem extends Producto {
  cantidad: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (producto: Producto) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, cantidad: number) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('moztacito_cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('moztacito_cart', JSON.stringify(items));
  }, [items]);

  const addToCart = (producto: Producto) => {
    setItems(current => {
      const existing = current.find(item => item.id === producto.id);
      if (existing) {
        return current.map(item => 
          item.id === producto.id 
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [...current, { ...producto, cantidad: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setItems(current => current.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, cantidad: number) => {
    if (cantidad < 1) return;
    setItems(current => 
      current.map(item => 
        item.id === id ? { ...item, cantidad } : item
      )
    );
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, total }}>
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
