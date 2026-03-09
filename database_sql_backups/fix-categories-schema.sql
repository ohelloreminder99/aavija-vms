-- Patch to fix the premise_categories schema to accept pricing columns
-- The original migration script created the table but forgot to add the financial fields.

ALTER TABLE public.premise_categories
ADD COLUMN IF NOT EXISTS deduction_rate_visitor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS deduction_rate_premise NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS pdf_export_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS csv_export_cost NUMERIC DEFAULT 0;

-- Ensure RLS is enabled and admins can manage it
ALTER TABLE public.premise_categories ENABLE ROW LEVEL SECURITY;

-- If it doesn't exist, allow Admins to manage categories
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'premise_categories' 
        AND policyname = 'Admins can manage premise categories'
    ) THEN
        CREATE POLICY "Admins can manage premise categories" ON public.premise_categories
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;
