-- ============================================================
-- AAVIJA VMS — SCHEMA FINGERPRINT (Hash Comparison)
-- ============================================================
-- Generates a single MD5 hash of the entire database schema.
-- Run this on your REFERENCE database → save the hash.
-- Run this on your NEW database → compare the hash.
-- Same hash = databases are identical ✅
-- Different hash = something is missing or different ❌
--
-- HOW TO USE:
--   1. Open SQL Editor in your REFERENCE Supabase project
--   2. Paste and Run this script → copy the "schema_fingerprint" value
--   3. Open SQL Editor in your NEW Supabase project
--   4. Paste and Run this script → compare the "schema_fingerprint" value
--   5. If both match → your databases are identical ✅
-- ============================================================

WITH

-- All tables
tables_hash AS (
  SELECT string_agg(table_name, ',' ORDER BY table_name) AS val
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
),

-- All columns with their types and order
columns_hash AS (
  SELECT string_agg(
    table_name || '.' || column_name || ':' || data_type || ':' || ordinal_position::text,
    '|' ORDER BY table_name, ordinal_position
  ) AS val
  FROM information_schema.columns
  WHERE table_schema = 'public'
),

-- RLS status per table
rls_hash AS (
  SELECT string_agg(tablename || ':' || rowsecurity::text, ',' ORDER BY tablename) AS val
  FROM pg_tables
  WHERE schemaname = 'public'
),

-- All functions (name + argument types)
functions_hash AS (
  SELECT string_agg(
    routine_name || '(' || coalesce(routine_definition, '') || ')',
    '|' ORDER BY routine_name
  ) AS val
  FROM information_schema.routines
  WHERE routine_schema = 'public'
),

-- All indexes
indexes_hash AS (
  SELECT string_agg(indexname || ':' || indexdef, '|' ORDER BY indexname) AS val
  FROM pg_indexes
  WHERE schemaname = 'public'
),

-- All triggers
triggers_hash AS (
  SELECT string_agg(trigger_name || ':' || event_object_table, ',' ORDER BY trigger_name) AS val
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
),

-- All extensions
extensions_hash AS (
  SELECT string_agg(extname, ',' ORDER BY extname) AS val
  FROM pg_extension
),

-- Cron jobs
cron_hash AS (
  SELECT string_agg(jobname || ':' || schedule, ',' ORDER BY jobname) AS val
  FROM cron.job
),

-- Combine everything into one string and hash it
combined AS (
  SELECT
    coalesce(t.val, '') || '||' ||
    coalesce(c.val, '') || '||' ||
    coalesce(r.val, '') || '||' ||
    coalesce(f.val, '') || '||' ||
    coalesce(i.val, '') || '||' ||
    coalesce(tr.val, '') || '||' ||
    coalesce(e.val, '') || '||' ||
    coalesce(cr.val, '') AS full_schema
  FROM tables_hash t, columns_hash c, rls_hash r,
       functions_hash f, indexes_hash i, triggers_hash tr,
       extensions_hash e, cron_hash cr
)

SELECT
  md5(full_schema) AS schema_fingerprint,
  '← Copy this value and compare with the other database' AS instructions,
  length(full_schema) AS schema_string_length_chars
FROM combined;
