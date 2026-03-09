-- Run this in the Supabase SQL Editor to manually make a user an admin.
-- Replace 'user@example.com' with the email of the person you want to make an admin.

DO $$ 
DECLARE
  target_email TEXT := 'samir.samnani.ai@gmail.com'; -- <--- CHANGE THIS EMAIL
  target_user_id UUID;
BEGIN
  -- Find the user ID based on email
  SELECT id INTO target_user_id FROM public.users WHERE email = target_email;

  IF target_user_id IS NOT NULL THEN
    -- Update the user's role to admin
    UPDATE public.users SET role = 'admin' WHERE id = target_user_id;

    -- Add them to the roles_admin table
    INSERT INTO public.roles_admin (id, "isAdmin")
    VALUES (target_user_id, true)
    ON CONFLICT (id) DO UPDATE SET "isAdmin" = true;

    RAISE NOTICE 'Successfully made % an admin!', target_email;
  ELSE
    RAISE NOTICE 'User with email % not found in the users table.', target_email;
  END IF;
END $$;
