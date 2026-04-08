const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableType() {
  console.log("Checking if 'users' is a TABLE or a VIEW...");
  
  // We can query the information_schema via RPC if a helper exists, 
  // or we can try to infer it. 
  // Actually, let's try to find any triggers on the 'users' table.
  
  const { data: triggerData, error: trigErr } = await supabase.rpc('get_table_info', { table_name: 'users' });
  if (trigErr) {
    console.log("RPC 'get_table_info' not found. Checking existence of potential tables again...");
  } else {
    console.log("Table info:", triggerData);
  }

  // Another way: try to delete a non-existent row.
  // If it's a view, it might give a specific "cannot delete from view" error.
  const { error: delErr } = await supabase.from('users').delete().eq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) {
    console.log("Delete error on 'users':", delErr.message);
  } else {
    console.log("Delete operation on 'users' allowed (even if 0 rows affected), likely a table or updatable view.");
  }

  const { error: delErrView } = await supabase.from('decrypted_users').delete().eq('id', '00000000-0000-0000-0000-000000000000');
  if (delErrView) {
    console.log("Delete error on 'decrypted_users':", delErrView.message);
  } else {
    console.log("Delete operation on 'decrypted_users' allowed.");
  }
}

checkTableType();
