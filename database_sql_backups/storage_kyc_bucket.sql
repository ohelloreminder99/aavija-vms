-- =============================================================================
-- AAVIJA VMS — Supabase Storage: KYC Documents Bucket
-- Run this in Supabase SQL Editor.
-- Creates the bucket and sets all RLS policies in one shot.
-- =============================================================================

-- STEP 1: Create the storage bucket (private, not public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,      -- NOT public — files are never directly accessible via URL
  5242880,    -- 5 MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;  -- safe to re-run


-- =============================================================================
-- STEP 2: RLS Policies on storage.objects
-- =============================================================================

-- Policy 1: Users can UPLOAD (INSERT) their own KYC documents
-- Files must be stored in a folder named after the user's own UUID:
-- e.g. kyc-documents/user-uuid-here/pan_card.jpg
CREATE POLICY "Users can upload their own KYC documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


-- Policy 2: Users can VIEW their own KYC documents
-- So the user can see their own uploaded PAN card on their profile
CREATE POLICY "Users can view their own KYC documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


-- Policy 3: Admins can VIEW all KYC documents
-- Admin needs to see PAN cards to approve KYC
CREATE POLICY "Admins can view all KYC documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);


-- Policy 4: Users can UPDATE (replace) their own KYC documents
-- So they can re-upload if the image was rejected
CREATE POLICY "Users can update their own KYC documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


-- Policy 5: Admins can DELETE KYC documents (cleanup)
CREATE POLICY "Admins can delete KYC documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);


-- =============================================================================
-- DONE. Verify with:
-- SELECT * FROM storage.buckets WHERE id = 'kyc-documents';
-- =============================================================================
