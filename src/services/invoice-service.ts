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

  // 1. Header (Logo Text on Right, Title in Center)
  doc.setFontSize(24);
  doc.setTextColor(44, 62, 80);
  doc.setFont('helvetica', 'bold');
  doc.text('AAVIJA', pageWidth - 14, 20, { align: 'right' });

  doc.setFontSize(20);
  doc.text('TAX INVOICE', pageWidth / 2, 35, { align: 'center' });

  // 2. Company Details (Top Left)
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.companyName, 14, 50);
  doc.setFont('helvetica', 'normal');
  const splitAddress = doc.splitTextToSize(invoice.companyAddress, 80);
  doc.text(splitAddress, 14, 55);
  const companyGstinY = 55 + (splitAddress.length * 5);
  doc.text(`GSTIN: ${invoice.companyGstin}`, 14, companyGstinY);

  // 3. Invoice Metadata (Top Right)
  doc.setFont('helvetica', 'bold');
  doc.text(`Invoice No: ${invoice.id}`, pageWidth - 14, 50, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  
  let dateText = 'N/A';
  if (invoice.timestamp) {
      try {
          const d = typeof invoice.timestamp === 'string' ? parseISO(invoice.timestamp) : (invoice.timestamp.toDate?.() || new Date(invoice.timestamp));
          dateText = format(d, 'PPP p');
      } catch (e) {
          console.error("Date formatting error:", e);
      }
  }
  doc.text(`Date: ${dateText}`, pageWidth - 14, 55, { align: 'right' });
  doc.text(`Status: ${invoice.status.toUpperCase()}`, pageWidth - 14, 60, { align: 'right' });

  // 4. Billing Details
  const dividerY = Math.max(companyGstinY + 10, 75);
  doc.setDrawColor(200, 200, 200);
  doc.line(14, dividerY, pageWidth - 14, dividerY);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 14, dividerY + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.userName, 14, dividerY + 15);
  
  let currentY = dividerY + 20;
  if (invoice.customerGstin) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${invoice.customerGstin}`, 14, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 5;
  }
  
  doc.text(invoice.userEmail, 14, currentY);
  currentY += 5;
  doc.text(`Phone: ${invoice.userPhone}`, 14, currentY);
  currentY += 5;
  
  const addressToPrint = invoice.customerBillingAddress || invoice.userState;
  const splitCustomerAddress = doc.splitTextToSize(`Address: ${addressToPrint}`, 100);
  doc.text(splitCustomerAddress, 14, currentY);
  currentY += (splitCustomerAddress.length * 5);

  // 5. Item Table
  autoTable(doc, {
    startY: currentY + 10,
    head: [['Description', 'HSN/SAC', 'Qty', 'Unit Price', 'Total']],
    body: [
      [
        `Aavija Token Recharge (${invoice.tokenAmount} units)`,
        invoice.hsnSacCode,
        invoice.tokenAmount,
        (invoice.subtotal / invoice.tokenAmount).toFixed(2),
        invoice.subtotal.toFixed(2),
      ]
    ],
    theme: 'striped',
    headStyles: { fillColor: [44, 62, 80] },
  });

  // 6. Totals Breakdown
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  const labelX = pageWidth - 95; 
  const valueX = pageWidth - 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Subtotal:', labelX, finalY);
  doc.text(`${invoice.subtotal.toFixed(2)}`, valueX, finalY, { align: 'right' });

  let totalsY = finalY + 8;
  
  if (invoice.cgst > 0) {
    const cgstLabel = invoice.cgstRate ? `CGST (${invoice.cgstRate.toFixed(1)}%):` : 'CGST:';
    const sgstLabel = invoice.sgstRate ? `SGST (${invoice.sgstRate.toFixed(1)}%):` : 'SGST:';
    
    doc.text(cgstLabel, labelX, totalsY);
    doc.text(`${invoice.cgst.toFixed(2)}`, valueX, totalsY, { align: 'right' });
    totalsY += 8;
    doc.text(sgstLabel, labelX, totalsY);
    doc.text(`${invoice.sgst.toFixed(2)}`, valueX, totalsY, { align: 'right' });
    totalsY += 10;
  } else if (invoice.igst > 0) {
    const igstLabel = invoice.igstRate ? `IGST (${invoice.igstRate.toFixed(1)}%):` : 'IGST:';
    doc.text(igstLabel, labelX, totalsY);
    doc.text(`${invoice.igst.toFixed(2)}`, valueX, totalsY, { align: 'right' });
    totalsY += 10;
  }

  doc.setLineWidth(0.5);
  doc.line(labelX, totalsY - 4, valueX, totalsY - 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total Payable:', labelX, totalsY + 4);
  doc.text(`${invoice.currency} ${invoice.totalAmount.toFixed(2)}`, valueX, totalsY + 4, { align: 'right' });

  // 7. Footer & Disclaimers
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  
  const footerBaseY = doc.internal.pageSize.height - 20;
  doc.text('Disclaimer: Any convenience fees for online payments are charged directly by the Razorpay Payment Gateway.', pageWidth / 2, footerBaseY, { align: 'center' });
  doc.text('Thank you for choosing Aavija!', pageWidth / 2, footerBaseY + 5, { align: 'center' });
  doc.text('This is a computer-generated invoice and does not require a signature.', pageWidth / 2, footerBaseY + 10, { align: 'center' });

  doc.save(`Invoice_${invoice.id}.pdf`);
}
