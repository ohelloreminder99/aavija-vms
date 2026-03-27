import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function testCreateGatekeeper() {
  const email = `test.real.gk.${Date.now()}@example.com`;
  
  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: 'testPassword123!',
      email_confirm: true,
      user_metadata: { name: "Real Test GK" }
  });
  if (authError) {
      console.error("Auth creation failed:", authError);
      return;
  }
  const uid = authData.user.id;
  console.log(`Created auth user: ${uid}`);

  const premiseId = '00000000-0000-0000-0000-000000000000'; // dummy premise for roles

  // 2. Upsert into users (EXACTLY LIKE ACTIONS.TS)
  const { error: upsertErr } = await supabase.from('users').upsert({
      id: uid,
      name: "Real Test GK",
      email,
      role: 'visitor',
      premise_roles: {
        [premiseId]: ['gatekeeper']
      },
      is_active: true,
      is_verified: false,
  });
  
  if (upsertErr) {
      console.error("Upsert into users failed!! ->", upsertErr);
  } else {
      console.log("Upsert into users succeeded!");
  }
}

testCreateGatekeeper();
