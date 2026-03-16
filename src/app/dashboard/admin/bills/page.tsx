'use client';

import * as React from 'react';
import {
    ArrowLeft,
    Loader2,
    Download,
    FileText,
    Search,
    IndianRupee,
    CalendarDays
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { getMonthlyInvoices, getReconciliationData, type SerializableInvoice } from './actions';
import { generateInvoicePdf } from '@/services/invoice-service';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

const months = [
    // ... (rest of months remains same)
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
];

const years = [2024, 2025, 2026, 2027];

export default function AdminBillsPage() {
    const { toast } = useToast();
    const [invoices, setInvoices] = React.useState<SerializableInvoice[]>([]);
    const [reconData, setReconData] = React.useState<{
        totalInvoiceAmount: number;
        invoiceCount: number;
        paymentLogCount: number;
        isReconciled: boolean;
    } | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isReconLoading, setIsReconLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedMonth, setSelectedMonth] = React.useState((new Date().getMonth() + 1).toString());
    const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear().toString());
    const [isExporting, setIsExporting] = React.useState(false);

    const fetchInvoices = React.useCallback(async () => {
        setIsLoading(true);
        const result = await getMonthlyInvoices(parseInt(selectedMonth), parseInt(selectedYear));
        if (result.invoices) {
            setInvoices(result.invoices);
        } else {
            toast({ variant: 'destructive', title: 'Fetch Error', description: result.error });
        }
        setIsLoading(false);
    }, [selectedMonth, selectedYear, toast]);

    const fetchRecon = React.useCallback(async () => {
        setIsReconLoading(true);
        const result = await getReconciliationData(parseInt(selectedMonth), parseInt(selectedYear));
        if (result.data) {
            setReconData(result.data);
        }
        setIsReconLoading(false);
    }, [selectedMonth, selectedYear]);

    React.useEffect(() => {
        fetchInvoices();
        fetchRecon();
    }, [fetchInvoices, fetchRecon]);

    const filteredInvoices = React.useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return invoices.filter(inv =>
            inv.userName.toLowerCase().includes(lower) ||
            inv.id.toLowerCase().includes(lower) ||
            inv.userEmail.toLowerCase().includes(lower)
        );
    }, [invoices, searchTerm]);

    const handleDownloadAllCsv = async () => {
        if (filteredInvoices.length === 0) return;
        setIsExporting(true);
        const Papa = (await import('papaparse')).default;
        const data = filteredInvoices.map(inv => ({
            'Invoice No': inv.id,
            'Date': format(parseISO(inv.timestamp), 'PPpp'),
            'Customer': inv.userName,
            'Buyer GSTIN': inv.customerGstin || 'N/A',
            'HSN/SAC': inv.hsnSacCode || '997331',
            'Email': inv.userEmail,
            'Phone': inv.userPhone,
            'State': inv.userState,
            'Subtotal': inv.subtotal,
            'CGST': inv.cgst,
            'SGST': inv.sgst,
            'IGST': inv.igst,
            'Total': inv.totalAmount,
            'Status': inv.status
        }));
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.body.appendChild(document.createElement('a'));
        link.href = URL.createObjectURL(blob);
        link.download = `Invoices_${selectedMonth}_${selectedYear}.csv`;
        link.click();
        document.body.removeChild(link);
        setIsExporting(false);
    };

    const handleDownloadSinglePdf = async (invoice: SerializableInvoice) => {
        try {
            // Re-wrap timestamp for the service
            const readyInvoice = {
                ...invoice,
                timestamp: { toDate: () => parseISO(invoice.timestamp) }
            };
            await generateInvoicePdf(readyInvoice as any);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate PDF.' });
        }
    };

    return (
        <div className="container py-10 max-w-6xl mx-auto">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <Button asChild variant="outline">
                    <Link href="/dashboard/admin">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Link>
                </Button>
                <div className='flex items-center gap-2'>
                    <CalendarDays className='h-5 w-5 text-muted-foreground' />
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                            {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={handleDownloadAllCsv} disabled={filteredInvoices.length === 0 || isExporting}>
                        <Download className="mr-2 h-4 w-4" />
                        Export Month CSV
                    </Button>
                </div>
            </div>

            {/* GST Reconciliation Block */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className={cn(
                    "border-l-4",
                    isReconLoading ? "border-gray-300" : (reconData?.isReconciled ? "border-green-500" : "border-red-500")
                )}>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-500" />
                            GST RECONCILIATION
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isReconLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-2xl font-bold">
                                        {reconData?.isReconciled ? "Perfect" : "Mismatch"}
                                    </span>
                                    {reconData?.isReconciled ? (
                                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                                    ) : (
                                        <AlertTriangle className="h-6 w-6 text-red-500" />
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Invoices: {reconData?.invoiceCount} vs. Logs: {reconData?.paymentLogCount}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-emerald-600">
                    <CardHeader className="pb-2">
                        <CardDescription>TOTAL REVENUE (MONTH)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1 text-2xl font-bold">
                            <IndianRupee className="h-5 w-5" />
                            {isReconLoading ? "---" : (reconData?.totalInvoiceAmount.toLocaleString() || "0")}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Based on generated invoices</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-teal-500">
                    <CardHeader className="pb-2">
                        <CardDescription>TAX COMPLIANCE</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isReconLoading ? "---" : (reconData?.invoiceCount || 0)} Invoices
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Ready for GST return filing</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Bill Management</CardTitle>
                    <CardDescription>
                        Review and download tax invoices for token purchases made in {months.find(m => m.value === selectedMonth)?.label} {selectedYear}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by customer name, email or invoice no..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : filteredInvoices.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                            <p>No invoices found for the selected period.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Invoice No</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>State</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredInvoices.map((inv) => (
                                        <TableRow key={inv.id}>
                                            <TableCell className="font-mono text-xs">{inv.id}</TableCell>
                                            <TableCell>
                                                <div className='flex flex-col'>
                                                    <span className='font-medium'>{inv.userName}</span>
                                                    <span className='text-xs text-muted-foreground'>{inv.userEmail}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="capitalize text-xs">{inv.userState}</TableCell>
                                            <TableCell className="text-xs">
                                                {format(parseISO(inv.timestamp), 'PP p')}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                <div className='flex items-center justify-end gap-1'>
                                                    <IndianRupee className='h-3 w-3' />
                                                    {inv.totalAmount.toFixed(2)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => handleDownloadSinglePdf(inv)}>
                                                    <FileText className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
