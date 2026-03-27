-- Migration: 20260315_pii_encryption.sql
-- Description: Enables pgcrypto and adds PII encryption helpers.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Secure Key Management: In a real production env, this key should be in Vault/KMS.
-- For this MVP, we'll use a setting or an env variable.
-- We'll create a function to get the encryption key.

CREATE OR REPLACE FUNCTION public.get_encryption_key() RETURNS TEXT AS $$
BEGIN
    -- In production, replace 'your-secret-key' with a value from vault or a secret setting.
    RETURN 'AavijaSecureKey2026!!'; 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper to encrypt PII
CREATE OR REPLACE FUNCTION public.encrypt_pii(p_data TEXT) RETURNS TEXT AS $$
BEGIN
    IF p_data IS NULL OR p_data = '' THEN
        RETURN p_data;
    END IF;
    RETURN encode(pgp_sym_encrypt(p_data, public.get_encryption_key()), 'base64');
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, extensions;

-- Helper to decrypt PII
CREATE OR REPLACE FUNCTION public.decrypt_pii(p_encoded_data TEXT) RETURNS TEXT AS $$
BEGIN
    IF p_encoded_data IS NULL OR p_encoded_data = '' THEN
        RETURN p_encoded_data;
    END IF;
    -- If it doesn't look like base64 or valid encrypted data, return as is (to handle existing plain text)
    BEGIN
        RETURN pgp_sym_decrypt(decode(p_encoded_data, 'base64'), public.get_encryption_key());
    EXCEPTION WHEN OTHERS THEN
        RETURN p_encoded_data;
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, extensions;

-- Trigger to automatically encrypt phone on insert/update
CREATE OR REPLACE FUNCTION public.trig_encrypt_user_pii() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.phone IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.phone <> OLD.phone) THEN
        -- If it's already base64/encrypted (possibly from a retry/double trigger), don't double encrypt
        -- We'll just encrypt if it doesn't match the decrypt(encrypt) check or if it's plain text.
        -- For simplicity, we assume if it's being set, it's plain text from the app.
        NEW.phone := public.encrypt_pii(NEW.phone);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS tr_encrypt_user_pii ON public.users;
CREATE TRIGGER tr_encrypt_user_pii
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.trig_encrypt_user_pii();

-- View to decrypt data for internal admin use (optional)
CREATE OR REPLACE VIEW public.decrypted_users 
WITH (security_invoker = true)
AS
SELECT 
    *,
    public.decrypt_pii(phone) as decrypted_phone
FROM public.users;
