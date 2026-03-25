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
  // Header Stripe
  doc.setFillColor(16, 185, 129); // Emerald Green
  doc.rect(0, 0, 210, 40, 'F');

  // Header Separator Shadow
  doc.setDrawColor(6, 95, 70); // Deep Emerald
  doc.setLineWidth(0.5);
  doc.line(0, 40, 210, 40);

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

  // --- 3. Metadata Rows (Stacked for better readability and full ID display) ---
  const metadataStartY = 50;
  doc.setFillColor(248, 250, 252); 
  doc.rect(14, metadataStartY, pageWidth - 28, 30, 'F');
  doc.setDrawColor(219, 234, 254);
  doc.rect(14, metadataStartY, pageWidth - 28, 30, 'S');

  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.setFont('helvetica', 'normal');

  // Row 1: Invoice Number
  doc.text('INVOICE NUMBER:', 20, metadataStartY + 8);
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.id.toUpperCase(), 55, metadataStartY + 8);

  // Row 2: Date
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.setFont('helvetica', 'normal');
  doc.text('DATE OF ISSUE:', 20, metadataStartY + 16);
  
  let dateText = 'N/A';
  if (invoice.timestamp) {
    try {
      const d = typeof invoice.timestamp === 'string' ? parseISO(invoice.timestamp) : (invoice.timestamp.toDate?.() || new Date(invoice.timestamp));
      dateText = format(d, 'dd MMMM yyyy, hh:mm a');
    } catch (e) { console.error(e); }
  }
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.text(dateText, 55, metadataStartY + 16);

  // Row 3: Status
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.setFont('helvetica', 'normal');
  doc.text('PAYMENT STATUS:', 20, metadataStartY + 24);
  
  const isPaid = invoice.status.toLowerCase() === 'paid';
  const statusColor = isPaid ? [16, 185, 129] : [234, 179, 8]; // Emerald vs Amber
  doc.setFontSize(10);
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.status.toUpperCase(), 55, metadataStartY + 24);

  // --- 4. Billing Sections ---
  const sectionY = 95;

  // Blue Divider
  doc.setDrawColor(219, 234, 254);
  doc.setLineWidth(0.2);
  doc.line(14, sectionY - 5, pageWidth - 14, sectionY - 5);

  // Left: From (Aavija)
  doc.setFontSize(9);
  doc.setTextColor(16, 185, 129); // Primary emerald for labels
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
  doc.setTextColor(16, 185, 129); // Primary emerald for labels
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
    headStyles: {
      fillColor: [16, 185, 129], // Emerald Green
      textColor: 255,
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
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
  doc.setDrawColor(16, 185, 129); // Emerald
  doc.setLineWidth(0.5);
  doc.line(summaryX, taxesY, pageWidth - 14, taxesY);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129); // Emerald
  doc.text('TOTAL', summaryX, taxesY + 10);
  doc.text(`${invoice.currency} ${invoice.totalAmount.toFixed(2)}`, pageWidth - 14, taxesY + 10, { align: 'right' });

  // --- 7. Footer & Security Watermark ---
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 160, 160);
  const footerY = pageHeight - 30;

  doc.text('This is a digitally generated cryptographically signed invoice.', pageWidth / 2, footerY, { align: 'center' });
  doc.text('Verified by Aavija Guardian Infrastructure.', pageWidth / 2, footerY + 4, { align: 'center' });

  doc.setFillColor(16, 185, 129);
  doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Aavija VMS — Safe • Seamless • Secure | aavija.com', pageWidth / 2, pageHeight - 6, { align: 'center' });

  doc.save(`Aavija_Invoice_${invoice.id}.pdf`);
}
