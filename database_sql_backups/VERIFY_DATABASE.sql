-- ============================================================
-- AAVIJA VMS — DATABASE VERIFICATION CHECKLIST
-- ============================================================
-- HOW TO USE (for non-technical users):
--   1. Open your Supabase project → click "SQL Editor" in the left sidebar
--   2. Click "New Query"
--   3. Paste this ENTIRE file and click RUN (green button / Ctrl+Enter)
--   4. Read the results — every row should say PASS ✅
--   5. If anything says FAIL ❌ — send a screenshot to your developer
-- ============================================================

-- ── STEP 1: Check all expected tables exist ──────────────────
SELECT
  '📋 TABLE CHECK' AS category,
  table_name AS item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = t.table_name
  ) THEN '✅ PASS' ELSE '❌ FAIL — Table missing' END AS result
FROM (VALUES
  ('users'),
  ('premises'),
  ('visits'),
  ('logs'),
  ('settings'),
  ('cities'),
  ('states'),
  ('districts'),
  ('premise_categories'),
  ('premise_applications'),
  ('bills'),
  ('invoices'),
  ('announcements'),
  ('contact_submissions'),
  ('visitor_tokens'),
  ('owner_tokens'),
  ('agent_ledger'),
  ('blocklist'),
  ('gates'),
  ('staff_members')
) AS t(table_name)

UNION ALL

-- ── STEP 2: Check RLS (security) is enabled on all tables ────
SELECT
  '🔒 SECURITY (RLS)' AS category,
  tablename AS item,
  CASE WHEN rowsecurity = true
    THEN '✅ PASS — Security enabled'
    ELSE '❌ FAIL — Security OFF (data exposed!)'
  END AS result
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'users','premises','visits','logs','settings','cities','states',
    'districts','premise_categories','premise_applications','bills',
    'invoices','announcements','contact_submissions','visitor_tokens',
    'owner_tokens','agent_ledger','blocklist','gates','staff_members'
  )

UNION ALL

-- ── STEP 3: Check required PostgreSQL extensions ─────────────
SELECT
  '🔧 EXTENSIONS' AS category,
  extname AS item,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = e.extname
  ) THEN '✅ PASS — Installed' ELSE '❌ FAIL — Not installed (run: CREATE EXTENSION ' || e.extname || ')' END AS result
FROM (VALUES
  ('pgcrypto'),
  ('uuid-ossp'),
  ('pg_cron')
) AS e(extname)

UNION ALL

-- ── STEP 4: Check key database functions exist ───────────────
SELECT
  '⚙️ FUNCTIONS' AS category,
  routine_name AS item,
  '✅ PASS — Function exists' AS result
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'approve_premise_application',
    'is_admin',
    'search_premise_members',
    'handle_new_user'
  )

UNION ALL

SELECT
  '⚙️ FUNCTIONS' AS category,
  fn AS item,
  '❌ FAIL — Function missing' AS result
FROM (VALUES
  ('approve_premise_application'),
  ('is_admin'),
  ('search_premise_members'),
  ('handle_new_user')
) AS f(fn)
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.routines
  WHERE routine_schema = 'public' AND routine_name = f.fn
)

UNION ALL

-- ── STEP 5: Check settings row exists ────────────────────────
SELECT
  '⚙️ SETTINGS' AS category,
  'Global settings row' AS item,
  CASE WHEN EXISTS (SELECT 1 FROM public.settings WHERE id = 'global')
    THEN '✅ PASS — Settings configured'
    ELSE '❌ FAIL — Run Step 5 in NEW_COUNTRY_SETUP.md'
  END AS result

UNION ALL

-- ── STEP 6: Check cron jobs are registered ───────────────────
SELECT
  '⏰ CRON JOBS' AS category,
  jobname AS item,
  '✅ PASS — Job scheduled' AS result
FROM cron.job

UNION ALL

-- ── STEP 7: Check updated_at trigger on premises ────────────
SELECT
  '🔄 TRIGGERS' AS category,
  'premises.updated_at auto-trigger' AS item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'premises'
      AND trigger_name LIKE '%updated_at%'
  ) THEN '✅ PASS — Trigger active'
    ELSE '❌ FAIL — Run supabase/migrations/20260320_premises_updated_at.sql'
  END AS result

UNION ALL

-- ── STEP 8: Summary count ────────────────────────────────────
SELECT
  '📊 SUMMARY' AS category,
  'Total tables found' AS item,
  COUNT(*)::text || ' tables in public schema' AS result
FROM information_schema.tables
WHERE table_schema = 'public'

ORDER BY category, item;
