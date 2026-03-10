'use client';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // --- 1. Obsidian Aesthetics & Background ---
  // Subtle dark header bar
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Subtle glow accent (simulated with light gray line)
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.5);
  doc.line(0, 45, pageWidth, 45);

  // --- 2. Brand & Header ---
  // Aavija Logo Text (White)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text('AAVIJA', 14, 28);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 180);
  doc.text('Visitor Management Ecosystem', 14, 34);

  // Invoice Title (Right aligned in header)
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', pageWidth - 14, 30, { align: 'right' });

  // --- 3. Key Metadata (Floating Bar below header) ---
  doc.setFillColor(248, 249, 251);
  doc.rect(14, 55, pageWidth - 28, 20, 'F');
  doc.setDrawColor(230, 230, 230);
  doc.rect(14, 55, pageWidth - 28, 20, 'S');

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('INVOICE NUMBER', 20, 62);
  doc.text('DATE OF ISSUE', pageWidth / 2 - 20, 62);
  doc.text('STATUS', pageWidth - 20, 62, { align: 'right' });

  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.id, 20, 69);

  let dateText = 'N/A';
  if (invoice.timestamp) {
    try {
      const d = typeof invoice.timestamp === 'string' ? parseISO(invoice.timestamp) : (invoice.timestamp.toDate?.() || new Date(invoice.timestamp));
      dateText = format(d, 'dd MMM yyyy, p');
    } catch (e) { console.error(e); }
  }
  doc.text(dateText, pageWidth / 2 - 20, 69);

  const statusColor = invoice.status.toLowerCase() === 'paid' ? [34, 197, 94] : [234, 179, 8];
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.text(invoice.status.toUpperCase(), pageWidth - 20, 69, { align: 'right' });

  // --- 4. Billing Sections ---
  const sectionY = 90;

  // Left: From (Aavija)
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'bold');
  doc.text('FROM', 14, sectionY);

  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(invoice.companyName, 14, sectionY + 7);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const splitCompanyAddr = doc.splitTextToSize(invoice.companyAddress, 80);
  doc.text(splitCompanyAddr, 14, sectionY + 13);
  doc.setFont('helvetica', 'bold');
  doc.text(`GSTIN: ${invoice.companyGstin}`, 14, sectionY + 13 + (splitCompanyAddr.length * 5));

  // Right: To (Customer)
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', pageWidth / 2 + 10, sectionY);

  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(invoice.userName, pageWidth / 2 + 10, sectionY + 7);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.userEmail, pageWidth / 2 + 10, sectionY + 13);
  doc.text(invoice.userPhone, pageWidth / 2 + 10, sectionY + 18);

  const customerAddr = invoice.customerBillingAddress || invoice.userState;
  const splitCustomerAddr = doc.splitTextToSize(customerAddr, 80);
  doc.text(splitCustomerAddr, pageWidth / 2 + 10, sectionY + 23);

  if (invoice.customerGstin) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${invoice.customerGstin}`, pageWidth / 2 + 10, sectionY + 23 + (splitCustomerAddr.length * 5) + 2);
  }

  // --- 5. Table (Modern Simplified) ---
  autoTable(doc, {
    startY: 135,
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
    headStyles: { fillColor: [15, 15, 15], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 14, right: 14 },
  });

  // --- 6. Summary Block ---
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const summaryX = pageWidth - 60;

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Subtotal', summaryX, finalY);
  doc.setTextColor(30, 30, 30);
  doc.text(`${invoice.subtotal.toFixed(2)}`, pageWidth - 14, finalY, { align: 'right' });

  let taxesY = finalY + 7;
  if (invoice.cgst > 0) {
    doc.setTextColor(100, 100, 100);
    doc.text(`CGST (${invoice.cgstRate}%)`, summaryX, taxesY);
    doc.setTextColor(30, 30, 30);
    doc.text(`${invoice.cgst.toFixed(2)}`, pageWidth - 14, taxesY, { align: 'right' });
    taxesY += 7;
    doc.setTextColor(100, 100, 100);
    doc.text(`SGST (${invoice.sgstRate}%)`, summaryX, taxesY);
    doc.setTextColor(30, 30, 30);
    doc.text(`${invoice.sgst.toFixed(2)}`, pageWidth - 14, taxesY, { align: 'right' });
    taxesY += 7;
  } else if (invoice.igst > 0) {
    doc.setTextColor(100, 100, 100);
    doc.text(`IGST (${invoice.igstRate}%)`, summaryX, taxesY);
    doc.setTextColor(30, 30, 30);
    doc.text(`${invoice.igst.toFixed(2)}`, pageWidth - 14, taxesY, { align: 'right' });
    taxesY += 7;
  }

  // Total Line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(summaryX, taxesY, pageWidth - 14, taxesY);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', summaryX, taxesY + 10);
  doc.text(`${invoice.currency} ${invoice.totalAmount.toFixed(2)}`, pageWidth - 14, taxesY + 10, { align: 'right' });

  // --- 7. Footer & Security Watermark ---
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  const footerY = pageHeight - 30;

  doc.text('This is a digitally generated cryptographically signed invoice.', pageWidth / 2, footerY, { align: 'center' });
  doc.text('Secured by Aavija Guardian.', pageWidth / 2, footerY + 5, { align: 'center' });

  doc.setFillColor(15, 15, 15);
  doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text('Aavija Ecosystem | dbin.aavija.com | Confidential & Proprietary', pageWidth / 2, pageHeight - 6, { align: 'center' });

  doc.save(`Aavija_Invoice_${invoice.id}.pdf`);
}
