import { jsPDF } from 'jspdf';
import { formatMoney } from '../../shared/lib/money';

function paymentMethodLabel(order) {
  if (order.payment_method === 'mobile_money') {
    const provider = String(order.payment_provider || '').replace('_', ' ').trim();
    return provider ? provider.toUpperCase() : 'Mobile Money';
  }

  return order.payment_method === 'cash' ? 'Cash' : (order.payment_method || 'Non renseigne');
}

export function buildReceiptPdf(order, brand = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 42;
  const receiptNumber = `ER-${String(order.id).slice(0, 8).toUpperCase()}`;
  const paidAt = order.updated_at ? new Date(order.updated_at) : new Date();
  const items = order.items ?? [];
  const paymentMethod = paymentMethodLabel(order);
  const restaurantName = brand.name || order.restaurant?.name || 'Restaurant Scan';
  const restaurantSubtitle = brand.slogan || brand.description || 'Fast Food & Restaurant';
  const initials = restaurantName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || 'RS';

  doc.setFillColor(17, 17, 17);
  doc.rect(0, 0, pageWidth, 118, 'F');

  doc.setFillColor(249, 161, 27);
  doc.circle(margin + 25, 52, 25, 'F');
  doc.setTextColor(17, 17, 17);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(initials, margin + 11, 57);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text(restaurantName, margin + 62, 48);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(restaurantSubtitle, margin + 64, 66);

  doc.setFillColor(249, 161, 27);
  doc.roundedRect(pageWidth - margin - 82, 36, 82, 30, 15, 15, 'F');
  doc.setTextColor(17, 17, 17);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PAYEE', pageWidth - margin - 60, 56);

  let y = 155;
  doc.setTextColor(17, 17, 17);
  doc.setFontSize(12);
  doc.text('Recu de paiement', margin, y);
  doc.setFontSize(28);
  doc.text(receiptNumber, margin, y + 34);

  y += 72;
  doc.setDrawColor(235, 235, 235);
  doc.line(margin, y, pageWidth - margin, y);

  y += 28;
  const meta = [
    ['Table', order.table?.name ?? 'N/A'],
    ['Date', paidAt.toLocaleDateString('fr-FR')],
    ['Heure', paidAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })],
    ['Paiement', paymentMethod],
  ];
  const metaWidth = (pageWidth - margin * 2) / 4;
  meta.forEach(([label, value], index) => {
    const x = margin + index * metaWidth;
    doc.setTextColor(130, 130, 130);
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x, y);
    doc.setTextColor(17, 17, 17);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(String(value), x, y + 18);
    doc.setFont('helvetica', 'normal');
  });

  y += 58;
  doc.setFillColor(17, 17, 17);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 30, 8, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Article', margin + 14, y + 20);
  doc.text('Qte', pageWidth - margin - 190, y + 20);
  doc.text('Prix', pageWidth - margin - 130, y + 20);
  doc.text('Total', pageWidth - margin - 58, y + 20);

  y += 48;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(17, 17, 17);

  items.forEach((item) => {
    const quantity = Number(item.quantity ?? 1);
    const price = Number(item.price_at_order ?? item.plat?.price ?? 0);
    const name = item.plat?.name ?? 'Plat';
    const description = item.plat?.description ?? '';

    if (y > 700) {
      doc.addPage();
      y = 60;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(name, margin + 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(description, 240), margin + 14, y + 14);

    doc.setTextColor(17, 17, 17);
    doc.setFontSize(10);
    doc.text(String(quantity), pageWidth - margin - 185, y);
    doc.text(formatMoney(price, order.currency), pageWidth - margin - 145, y);
    doc.setFont('helvetica', 'bold');
    doc.text(formatMoney(price * quantity, order.currency), pageWidth - margin - 72, y);

    y += 44;
    doc.setDrawColor(238, 238, 238);
    doc.line(margin, y - 16, pageWidth - margin, y - 16);
  });

  if (order.note) {
    y += 12;
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 54, 8, 8, 'F');
    doc.setTextColor(130, 130, 130);
    doc.setFontSize(8);
    doc.text('NOTE CLIENT', margin + 14, y + 18);
    doc.setTextColor(17, 17, 17);
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(order.note, pageWidth - margin * 2 - 28), margin + 14, y + 34);
    y += 74;
  }

  y += 14;
  doc.setFillColor(249, 161, 27);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 54, 10, 10, 'F');
  doc.setTextColor(17, 17, 17);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Total paye', margin + 18, y + 34);
  doc.setFontSize(18);
  doc.text(formatMoney(order.total_amount, order.currency), pageWidth - margin - 150, y + 34);

  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Merci pour votre visite chez ${restaurantName}.`, pageWidth / 2, 790, { align: 'center' });
  doc.text('Recu genere automatiquement par Restaurant Scan.', pageWidth / 2, 806, { align: 'center' });

  return {
    doc,
    filename: `recu-${receiptNumber}.pdf`,
    receiptNumber,
  };
}
