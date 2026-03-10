-- fix-invoices-schema.sql
-- This script synchronizes the 'invoices' table with the Aavija VMS application code.
-- It resolves the UUID type mismatch and adds missing financial/customer columns.

-- 1. Create a temporary table with the correct schema
CREATE TABLE public.invoices_new (
    id TEXT PRIMARY KEY, -- Changed from UUID to TEXT to support 'INV-' prefix
    "userId" UUID REFERENCES public.users(id),
    "userName" TEXT,
    "userEmail" TEXT,
    "userPhone" TEXT,
    "userState" TEXT,
    "premiseId" UUID REFERENCES public.premises(id),
    "tokenAmount" INTEGER,
    subtotal NUMERIC(12,2),
    "totalAmount" NUMERIC(12,2),
    cgst NUMERIC(12,2),
    sgst NUMERIC(12,2),
    igst NUMERIC(12,2),
    "cgstRate" NUMERIC(5,2),
    "sgstRate" NUMERIC(5,2),
    "igstRate" NUMERIC(5,2),
    currency TEXT DEFAULT 'INR',
    "timestamp" TIMESTAMPTZ DEFAULT NOW(),
    "hsnSacCode" TEXT,
    "companyGstin" TEXT,
    "companyName" TEXT,
    "companyAddress" TEXT,
    status TEXT DEFAULT 'paid',
    "customerGstin" TEXT,
    "customerBillingAddress" TEXT,
    razorpay_order_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Migrate existing data (if any)
-- NOTE: If existing IDs are UUIDs, they will be converted to strings.
INSERT INTO public.invoices_new (
    id, "userId", "totalAmount", status, created_at, razorpay_order_id
)
SELECT 
    id::text, "userId", "totalAmount", status, created_at, razorpay_order_id
FROM public.invoices;

-- 3. Swap the tables
DROP TABLE public.invoices CASCADE;
ALTER TABLE public.invoices_new RENAME TO invoices;

-- 4. Re-enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 5. Restore Policies
CREATE POLICY "Admins can manage invoices" ON public.invoices
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can view own invoices" ON public.invoices
FOR SELECT USING (
    auth.uid() = "userId"
);
