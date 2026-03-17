-- Migration: 20260317_fix_pgcrypto.sql
-- Description: Enables pgcrypto extension to fix "pgp_sym_encrypt does not exist" error.

-- 1. Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Validate the extension is active
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
        RAISE EXCEPTION 'pgcrypto extension could not be enabled';
    END IF;
END $$;

-- 3. Re-verify PII helper functions (just in case)
-- These should already exist from 20260315_pii_encryption.sql, 
-- but ensuring they are using public schema explicitly.

CREATE OR REPLACE FUNCTION public.encrypt_pii(p_data TEXT) RETURNS TEXT AS $$
BEGIN
    IF p_data IS NULL OR p_data = '' THEN
        RETURN p_data;
    END IF;
    RETURN encode(pgp_sym_encrypt(p_data, public.get_encryption_key()), 'base64');
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.decrypt_pii(p_encoded_data TEXT) RETURNS TEXT AS $$
BEGIN
    IF p_encoded_data IS NULL OR p_encoded_data = '' THEN
        RETURN p_encoded_data;
    END IF;
    BEGIN
        RETURN pgp_sym_decrypt(decode(p_encoded_data, 'base64'), public.get_encryption_key());
    EXCEPTION WHEN OTHERS THEN
        RETURN p_encoded_data;
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;
