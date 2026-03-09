-- Run this script in your Supabase SQL Editor to remove the highly vulnerable and unused table.

DROP TABLE IF EXISTS public.roles_admin CASCADE;

-- Note: The application now natively relies on public.users.role = 'admin' instead, so dropping this table is 100% safe and removes a critical attack vector.
