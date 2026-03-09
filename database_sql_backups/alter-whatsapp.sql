-- Adds the missing table used by the Visitor Profile actions to verify WhatsApp numbers.

CREATE TABLE IF NOT EXISTS public.whatsapp_otps (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  otp TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: Because OTPs are deeply sensitive and only used during server-side verification actions (in src/app/dashboard/visitor/profile/actions.ts),
-- we DO NOT create any public or authenticated RLS access policies for this table. 
-- The Server Actions already use the Admin DB to safely read/write to it. This keeps the OTPs perfectly secure from frontend scraping!
