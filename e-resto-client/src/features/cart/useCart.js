import { useMemo, useState } from 'react';

function itemPrice(plat) {
  if (plat?.is_promotion_active && Number(plat?.promotion_price) > 0) {
    return Number(plat.promotion_price);
  }

  return Number(plat?.price || 0);
}

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

  const removeItem = (platId) => {
    setItems((current) => current.filter((item) => item.plat.id !== platId));
  };

  const clearCart = () => setItems([]);
  const replaceItems = (nextItems) => setItems(nextItems);

  const totals = useMemo(() => {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.quantity * itemPrice(item.plat), 0);
    const currency = items[0]?.plat.currency ?? 'CDF';
    return { totalQuantity, totalAmount, currency };
  }, [items]);

  return { items, totals, addItem, updateQuantity, removeItem, clearCart, replaceItems };
}
