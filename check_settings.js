
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://plruocrysgpyyfypcjwe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBscnVvY3J5c2dweXlmeXBjandlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MDY3MTAsImV4cCI6MjA4NzM4MjcxMH0.LE-vFHeyOIbmV4o5v5Y3cuP_-RHstYtU6oZywrm9gLU'; // Using Anon key first to see if I can read settings (which are usually public)

async function checkSettings() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.from('settings').select('*').eq('id', 'global').single();
  
  if (error) {
    console.error('Error fetching settings:', error);
    return;
  }
  
  console.log('Global Settings:');
  console.log(JSON.stringify(data, null, 2));
}

checkSettings();
