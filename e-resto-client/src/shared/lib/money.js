export function formatMoney(amount, currency = 'CDF') {
  const value = Number(amount || 0);
  if (currency === 'USD') {
    return `$${new Intl.NumberFormat('fr-CD', {
      maximumFractionDigits: 2,
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value)}`;
  }

  return new Intl.NumberFormat('fr-CD', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'CDF' ? 0 : 2,
  }).format(value);
}
