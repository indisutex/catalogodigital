import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Producto } from '../types';

export interface CartItem extends Producto {
  cantidad: number;
  talla?: string; // Talla seleccionada
  estampado?: string; // Estampado seleccionado
}

interface CartContextType {
  items: CartItem[];
  addToCart: (producto: Producto, talla?: string, estampado?: string, cantidad?: number) => void;
  removeFromCart: (id: string, talla?: string, estampado?: string) => void;
  updateQuantity: (id: string, cantidad: number, talla?: string, estampado?: string) => void;
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
