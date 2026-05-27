import { useMemo, useState } from 'react';

export function useCart() {
  const [items, setItems] = useState([]);

  const addItem = (plat, quantity) => {
    setItems((current) => {
      const existing = current.find((item) => item.plat.id === plat.id);
      if (!existing) return [...current, { plat, quantity }];
      return current.map((item) =>
        item.plat.id === plat.id ? { ...item, quantity: item.quantity + quantity } : item,
      );
    });
  };

  const updateQuantity = (platId, quantity) => {
    setItems((current) =>
      current
        .map((item) => (item.plat.id === platId ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0),
    );
  };

  const clearCart = () => setItems([]);

  const totals = useMemo(() => {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.quantity * Number(item.plat.price), 0);
    const currency = items[0]?.plat.currency ?? 'CDF';
    return { totalQuantity, totalAmount, currency };
  }, [items]);

  return { items, totals, addItem, updateQuantity, clearCart };
}
