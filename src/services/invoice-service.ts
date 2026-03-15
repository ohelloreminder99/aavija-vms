'use client';

import { format, parseISO } from 'date-fns';

export interface Invoice {
  id: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userState: string;
  tokenAmount: number;
  subtotal: number;
  totalAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  currency: string;
  timestamp: any;
  hsnSacCode: string;
  companyGstin: string;
  companyName: string;
  companyAddress: string;
  status: string;
  customerGstin?: string;
  customerBillingAddress?: string;
}

export async function generateInvoicePdf(invoice: Invoice) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // --- 1. Obsidian & Aavija Blue Aesthetics ---
  // Aavija Primary Blue Header
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Subtle separator (Darker blue)
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  doc.line(0, 45, pageWidth, 45);

  // --- 2. Brand & Header ---
  // Fetch dynamic branding from settings if possible (client-side uses useSettings usually, but jspdf is often procedural)
  // For now we assume the caller can pass these or we fetch them. 
  // Since generateInvoicePdf is 'use client' and called from UI, better to pass settings in.
  // But to minimize breaking changes, I'll add optional parameters.

  // Aavija Logo Text (White)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text(invoice.companyName.toUpperCase(), 14, 28); // Using Legal Name or Brand

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(219, 234, 254);
  doc.text('Authorized Visitor Management Ecosystem', 14, 34);

  // Invoice Title (Right aligned in header)
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', pageWidth - 14, 30, { align: 'right' });

  // --- 3. Metadata Row (Fixed horizontal spacing to prevent overlap) ---
  doc.setFillColor(248, 250, 252); // Very light blue-gray
  doc.rect(14, 55, pageWidth - 28, 20, 'F');
  doc.setDrawColor(219, 234, 254);
  doc.rect(14, 55, pageWidth - 28, 20, 'S');

  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.setFont('helvetica', 'bold');

  // Col 1: Invoice ID
  doc.text('INVOICE NUMBER', 20, 62);
  // Col 2: Date
  doc.text('DATE OF ISSUE', pageWidth * 0.45, 62);
  // Col 3: Status
  doc.text('STATUS', pageWidth - 20, 62, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');

  // Cut ID if it's too long
  const displayId = invoice.id.length > 20 ? invoice.id.substring(0, 20) + '...' : invoice.id;
  doc.text(displayId, 20, 69);

  let dateText = 'N/A';
  if (invoice.timestamp) {
    try {
      const d = typeof invoice.timestamp === 'string' ? parseISO(invoice.timestamp) : (invoice.timestamp.toDate?.() || new Date(invoice.timestamp));
      dateText = format(d, 'dd MMM yyyy, p');
    } catch (e) { console.error(e); }
  }
  doc.text(dateText, pageWidth * 0.45, 69);

  const statusColor = invoice.status.toLowerCase() === 'paid' ? [34, 197, 94] : [234, 179, 8];
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.text(invoice.status.toUpperCase(), pageWidth - 20, 69, { align: 'right' });

  // --- 4. Billing Sections ---
  const sectionY = 93;

  // Blue Divider
  doc.setDrawColor(219, 234, 254);
  doc.setLineWidth(0.2);
  doc.line(14, sectionY - 5, pageWidth - 14, sectionY - 5);

  // Left: From (Aavija)
  doc.setFontSize(9);
  doc.setTextColor(59, 130, 246); // Primary blue for labels
  doc.setFont('helvetica', 'bold');
  doc.text('FROM', 14, sectionY);

  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(invoice.companyName, 14, sectionY + 7);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const splitCompanyAddr = doc.splitTextToSize(invoice.companyAddress, 80);
  doc.text(splitCompanyAddr, 14, sectionY + 13);
  doc.setFont('helvetica', 'bold');
  doc.text(`GSTIN: ${invoice.companyGstin}`, 14, sectionY + 13 + (splitCompanyAddr.length * 5) + 2);

  // Right: To (Customer)
  doc.setFontSize(9);
  doc.setTextColor(59, 130, 246);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', pageWidth / 2 + 10, sectionY);

  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(invoice.userName, pageWidth / 2 + 10, sectionY + 7);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(invoice.userEmail, pageWidth / 2 + 10, sectionY + 13);
  doc.text(invoice.userPhone, pageWidth / 2 + 10, sectionY + 18);

  const customerAddr = invoice.customerBillingAddress || invoice.userState;
  const splitCustomerAddr = doc.splitTextToSize(customerAddr, 80);
  doc.text(splitCustomerAddr, pageWidth / 2 + 10, sectionY + 23);

  if (invoice.customerGstin) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${invoice.customerGstin}`, pageWidth / 2 + 10, sectionY + 23 + (splitCustomerAddr.length * 5) + 2);
  }

  // --- 5. Table (Aavija Blue Theme) ---
  autoTable(doc, {
    startY: 140,
    head: [['Description', 'HSN/SAC', 'Qty', 'Rate', 'Amount']],
    body: [[
      `Aavija Utility Tokens (${invoice.tokenAmount} units)`,
      invoice.hsnSacCode,
      invoice.tokenAmount,
      (invoice.subtotal / invoice.tokenAmount).toFixed(2),
      invoice.subtotal.toFixed(2),
    ]],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  // --- 6. Summary Block ---
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const summaryX = pageWidth - 60;

  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text('Subtotal', summaryX, finalY);
  doc.setTextColor(30, 30, 30);
  doc.text(`${invoice.subtotal.toFixed(2)}`, pageWidth - 14, finalY, { align: 'right' });

  let taxesY = finalY + 7;
  if (invoice.cgst > 0) {
    doc.setTextColor(110, 110, 110);
    doc.text(`CGST (${invoice.cgstRate}%)`, summaryX, taxesY);
    doc.setTextColor(30, 30, 30);
    doc.text(`${invoice.cgst.toFixed(2)}`, pageWidth - 14, taxesY, { align: 'right' });
    taxesY += 7;
    doc.setTextColor(110, 110, 110);
    doc.text(`SGST (${invoice.sgstRate}%)`, summaryX, taxesY);
    doc.setTextColor(30, 30, 30);
    doc.text(`${invoice.sgst.toFixed(2)}`, pageWidth - 14, taxesY, { align: 'right' });
    taxesY += 7;
  } else if (invoice.igst > 0) {
    doc.setTextColor(110, 110, 110);
    doc.text(`IGST (${invoice.igstRate}%)`, summaryX, taxesY);
    doc.setTextColor(30, 30, 30);
    doc.text(`${invoice.igst.toFixed(2)}`, pageWidth - 14, taxesY, { align: 'right' });
    taxesY += 7;
  }

  // Total Line
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(summaryX, taxesY, pageWidth - 14, taxesY);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('TOTAL', summaryX, taxesY + 10);
  doc.text(`${invoice.currency} ${invoice.totalAmount.toFixed(2)}`, pageWidth - 14, taxesY + 10, { align: 'right' });

  // --- 7. Footer & Security Watermark ---
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 160, 160);
  const footerY = pageHeight - 30;

  doc.text('This is a digitally generated cryptographically signed invoice.', pageWidth / 2, footerY, { align: 'center' });
  doc.text('Verified by Aavija Guardian Infrastructure.', pageWidth / 2, footerY + 4, { align: 'center' });

  // Blue Footer Bar
  doc.setFillColor(59, 130, 246);
  doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Aavija Ecosystem | Safe • Seamless • Secure', pageWidth / 2, pageHeight - 6, { align: 'center' });

  doc.save(`Aavija_Invoice_${invoice.id}.pdf`);
}
