import React, { createContext, useContext, useReducer, useEffect } from 'react';

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

interface CartState {
  vendorId: string | null;
  vendorName: string | null;
  items: CartItem[];
}

interface CartContextType extends CartState {
  addItem: (vendorId: string, vendorName: string, item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
}

type CartAction =
  | { type: 'ADD_ITEM'; vendorId: string; vendorName: string; item: CartItem }
  | { type: 'REMOVE_ITEM'; menuItemId: string }
  | { type: 'UPDATE_QUANTITY'; menuItemId: string; quantity: number }
  | { type: 'CLEAR_CART' }
  | { type: 'LOAD'; state: CartState };

const STORAGE_KEY = 'fooda_cart';

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const isSameVendor = !state.vendorId || state.vendorId === action.vendorId;
      const base: CartState = isSameVendor
        ? state
        : { vendorId: action.vendorId, vendorName: action.vendorName, items: [] };
      const idx = base.items.findIndex(i => i.menuItemId === action.item.menuItemId);
      const items = idx >= 0
        ? base.items.map((i, n) => n === idx ? { ...i, quantity: i.quantity + action.item.quantity } : i)
        : [...base.items, action.item];
      return { vendorId: action.vendorId, vendorName: action.vendorName, items };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(i => i.menuItemId !== action.menuItemId) };
    case 'UPDATE_QUANTITY':
      if (action.quantity <= 0)
        return { ...state, items: state.items.filter(i => i.menuItemId !== action.menuItemId) };
      return {
        ...state,
        items: state.items.map(i =>
          i.menuItemId === action.menuItemId ? { ...i, quantity: action.quantity } : i
        ),
      };
    case 'CLEAR_CART':
      return { vendorId: null, vendorName: null, items: [] };
    case 'LOAD':
      return action.state;
    default:
      return state;
  }
}

const CartContext = createContext<CartContextType>({} as CartContextType);

export const useCart = () => useContext(CartContext);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, { vendorId: null, vendorName: null, items: [] });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) dispatch({ type: 'LOAD', state: JSON.parse(saved) });
    } catch { /* ignore corrupt storage */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addItem = (vendorId: string, vendorName: string, item: Omit<CartItem, 'quantity'>, qty = 1) =>
    dispatch({ type: 'ADD_ITEM', vendorId, vendorName, item: { ...item, quantity: qty } });

  const removeItem = (menuItemId: string) => dispatch({ type: 'REMOVE_ITEM', menuItemId });

  const updateQuantity = (menuItemId: string, quantity: number) =>
    dispatch({ type: 'UPDATE_QUANTITY', menuItemId, quantity });

  const clearCart = () => dispatch({ type: 'CLEAR_CART' });

  const itemCount = state.items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = state.items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ ...state, addItem, removeItem, updateQuantity, clearCart, itemCount, subtotal }}>
      {children}
    </CartContext.Provider>
  );
};
