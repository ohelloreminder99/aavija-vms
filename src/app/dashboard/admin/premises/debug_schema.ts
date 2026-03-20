
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSchema() {
  console.log('--- Premises Table Schema ---');
  const { data, error } = await supabase
    .from('premises')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching from premises:', error.message);
  } else if (data && data.length > 0) {
    console.log('Columns found:', Object.keys(data[0]));
  } else {
    console.log('No data in premises table or table not found.');
  }

  console.log('\n--- Premise Applications Table Schema ---');
  const { data: appData, error: appError } = await supabase
    .from('premise_applications')
    .select('*')
    .limit(1);

  if (appError) {
    console.error('Error fetching from premise_applications:', appError.message);
  } else if (appData && appData.length > 0) {
    console.log('Columns found:', Object.keys(appData[0]));
  } else {
    console.log('No data in premise_applications table.');
  }
}

debugSchema();
