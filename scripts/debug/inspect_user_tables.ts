import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function inspectSchema() {
  console.log("Listing all tables and views in 'public' schema...");
  
  // Querying pg_catalog via RPC isn't enabled by default usually, 
  // but we can try common introspection techniques or just check existence.
  
  const tablesToCheck = ['users', 'User', 'Profiles', 'profiles', 'decrypted_users'];
  
  for (const table of tablesToCheck) {
    const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true });
    if (error) {
      console.log(`Table/View '${table}': NOT FOUND or ERROR (${error.message})`);
    } else {
      console.log(`Table/View '${table}': FOUND, Count: ${data === null ? '0' : 'Unknown'}`);
      
      // Try to get one row to see columns
      const { data: rows, error: rowErr } = await supabase.from(table).select('*').limit(1);
      if (!rowErr && rows && rows.length > 0) {
        console.log(`Columns for '${table}':`, Object.keys(rows[0]));
      }
    }
  }

  // Check if decrypted_users is a view or table
  // We can't do this easily without SQL access, but we can infer from the user's deletion experience.
}

inspectSchema();
