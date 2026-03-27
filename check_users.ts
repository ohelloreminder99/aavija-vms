import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  console.log("Checking public.users...");
  const { data: users, error: usersErr } = await supabase.from('users').select('id, name, email');
  if (usersErr) console.error("users error:", usersErr);
  else {
    console.log(`public.users total count: ${users.length}`);
    console.log(users.slice(0, 5)); // First 5
  }

  console.log("\nChecking auth.users...");
  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) console.error("auth.users error:", authErr);
  else {
    console.log(`auth.users total count: ${authUsers?.users?.length}`);
  }

  console.log("\nChecking decrypted_users...");
  const { data: decUsers, error: decErr } = await supabase.from('decrypted_users').select('id, name, email');
  if (decErr) console.error("decrypted_users error:", decErr);
  else {
    console.log(`decrypted_users total count: ${decUsers.length}`);
  }
}

checkUsers();
