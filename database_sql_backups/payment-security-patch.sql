-- Add Razorpay Order ID to Invoices for Idempotency and Replay Protection
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT UNIQUE;
