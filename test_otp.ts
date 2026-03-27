import dotenv from 'dotenv';
import path from 'path';

// Setup environment first
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { sendWhatsAppOtp } from './src/app/dashboard/profile/actions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function testOtp() {
  const email = `test.otp.${Date.now()}@example.com`;
  
  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: 'testPassword123!',
      email_confirm: true,
      user_metadata: { name: "Test OTP" }
  });
  if (authError) {
      console.error("Auth creation failed:", authError);
      return;
  }
  const uid = authData.user.id;
  console.log(`Created auth user: ${uid}`);

  const premiseId = '00000000-0000-0000-0000-000000000000'; 

  // 2. Upsert into users
  const { error: upsertErr } = await supabase.from('users').upsert({
      id: uid,
      name: "Test OTP",
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

  // 3. Request OTP directly (this is exactly what UserSetupDialog does)
  // Wait, wait, sendWhatsAppOtp uses headers() from Next.js!
  // It won't work in a raw node script.
  console.log("Will check if userDoc is null with adminDb...");
  const adminDb = supabase;
  
  const { data: userDoc, error: userDocErr } = await adminDb.from('users')
    .select('id, name, phone, token_balance_visitor, action_timestamps')
    .eq('id', uid).single();
    
    if (!userDoc) {
      console.error("User profile not found! ->", userDocErr);
    } else {
      console.log("Found user profile!", userDoc.id);
    }
}

testOtp();
