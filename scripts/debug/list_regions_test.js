
const { createClient } = require('@supabase/supabase-js');

const FALLBACK_URL = "https://plruocrysgpyyfypcjwe.supabase.co";
const FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBscnVvY3J5c2dweXlmeXBjandlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MDY3MTAsImV4cCI6MjA4NzM4MjcxMH0.LE-vFHeyOIbmV4o5v5Y3cuP_-RHstYtU6oZywrm9gLU";

const supabase = createClient(FALLBACK_URL, FALLBACK_KEY);

async function listRegions() {
    const { data: regions, error } = await supabase
        .from('regions')
        .select('*');
    
    if (error) {
        console.error('Error fetching regions:', error);
        return;
    }
    
    console.log('Active Regions:');
    regions.forEach(r => {
        console.log(`- ${r.code}: ${r.domain} (${r.supabase_url})`);
    });
}

listRegions();
