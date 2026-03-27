import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_table_info', { table_name: 'users' });
  if (error) {
    // maybe RPC doesn't exist, let's query raw SQL via REST implicitly? we can't easily execute arbitrary SQL.
    console.log("Cannot run arbitrary SQL via supabase js without an RPC.");
  }
}

async function checkOTP() {
  // Let's just create a test auth user and see if it fails to insert into `users`!
  const email = `test.gatekeeper.${Date.now()}@example.com`;
  
  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: 'testPassword123!',
      email_confirm: true,
      user_metadata: { name: "Test GK" }
  });
  if (authError) {
      console.error("Auth creation failed:", authError);
      return;
  }
  const uid = authData.user.id;
  console.log(`Created auth user: ${uid}`);

  // 2. Upsert into users
  const { error: upsertErr } = await supabase.from('users').upsert({
      id: uid,
      name: "Test GK",
      email,
      role: 'visitor',
      is_active: true,
      is_verified: false,
  });
  
  if (upsertErr) {
      console.error("Upsert into users failed!! ->", upsertErr);
  } else {
      console.log("Upsert into users succeeded!");
  }
}

checkOTP();
