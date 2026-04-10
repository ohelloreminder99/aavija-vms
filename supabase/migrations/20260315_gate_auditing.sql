-- Add gate tracking to visits table
ALTER TABLE public.visits 
ADD COLUMN IF NOT EXISTS checkin_gate_id UUID REFERENCES public.premise_gates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS checkout_gate_id UUID REFERENCES public.premise_gates(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_visits_checkin_gate ON public.visits(checkin_gate_id);
CREATE INDEX IF NOT EXISTS idx_visits_checkout_gate ON public.visits(checkout_gate_id);
