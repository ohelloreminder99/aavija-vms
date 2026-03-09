require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndFixSettingsRow() {
    console.log("Checking if the 'global' settings row exists...");

    const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'global')
        .single();

    if (error && error.code === 'PGRST116') {
        console.log("❌ The row 'global' DOES NOT EXIST! This is why updates fail silently.");
        console.log("Creating the row now...");

        const { error: insertError } = await supabase
            .from('settings')
            .insert({ id: 'global' });

        if (insertError) {
            console.error("Failed to insert:", insertError);
        } else {
            console.log("✅ Row 'global' created successfully! Updates should now work.");
        }
    } else if (data) {
        console.log("✅ The row already exists!");
    } else if (error) {
        console.error("Fetch error:", error);
    }
}

checkAndFixSettingsRow();
