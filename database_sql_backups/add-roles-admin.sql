-- Run this snippet in your Supabase SQL Editor to add the missing roles_admin table

CREATE TABLE IF NOT EXISTS public.roles_admin (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  "isAdmin" BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.roles_admin ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (to check if they are an admin)
CREATE POLICY "Allow public select on roles_admin" ON public.roles_admin FOR SELECT USING (true);

-- Allow insertions (since your auth form automatically adds the user to roles_admin if emails match)
CREATE POLICY "Allow insertions to roles_admin" ON public.roles_admin FOR INSERT WITH CHECK (true);
