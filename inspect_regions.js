
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://plruocrysgpyyfypcjwe.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_367-uJmL1bW0YznDe5jBKA_bBOOGdK4";

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectRegions() {
  const { data, error } = await supabase.from('regions').select('*').limit(1);
  if (error) {
    console.error('Error fetching regions:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns in regions table:', Object.keys(data[0]));
  } else {
    console.log('Regions table is empty.');
  }
}

inspectRegions();
