const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  console.log("Listing all tables and views in 'public' schema...");
  
  const tablesToCheck = ['users', 'User', 'Profiles', 'profiles', 'decrypted_users'];
  
  for (const table of tablesToCheck) {
    try {
      const { data, error, count } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`Table/View '${table}': NOT FOUND or ERROR (${error.message})`);
      } else {
        console.log(`Table/View '${table}': FOUND, Count: ${count}`);
        
        // Try to get one row to see columns
        const { data: rows, error: rowErr } = await supabase.from(table).select('*').limit(1);
        if (!rowErr && rows && rows.length > 0) {
          console.log(`Columns for '${table}':`, Object.keys(rows[0]));
        } else if (rowErr) {
          console.log(`Error getting rows for '${table}':`, rowErr.message);
        }
      }
    } catch (e) {
      console.log(`Exception checking '${table}':`, e.message);
    }
  }
}

inspectSchema();
