export function formatMoney(amount, currency = 'CDF') {
  return new Intl.NumberFormat('fr-CD', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'CDF' ? 0 : 2,
  }).format(Number(amount || 0));
}
