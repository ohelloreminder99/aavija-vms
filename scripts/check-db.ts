import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
    console.log("🔍 Starting Supabase Database Health Check...\n");

    let missingScripts: string[] = [];

    // 1. Check if roles_admin table is dropped
    process.stdout.write("1. Checking if vulnerable 'roles_admin' table is dropped... ");
    const { error: rolesAdminError } = await supabase.from('roles_admin').select('id').limit(1);
    if (rolesAdminError && (rolesAdminError.code === 'PGRST116' || rolesAdminError.code === '42P01' || rolesAdminError.code === 'PGRST200')) {
        console.log("✅ Passed (Table no longer exists)");
    } else if (!rolesAdminError) {
        console.log("❌ FAILED. Table still exists!");
        missingScripts.push("drop_roles_admin.sql");
    } else {
        console.log(`⚠️ Warning: ${rolesAdminError.message} (${rolesAdminError.code})`);
    }

    // 2. Check invoices table for razorpay_order_id
    process.stdout.write("2. Checking 'invoices' for 'razorpay_order_id' column... ");
    const { error: invoiceError } = await supabase.from('invoices').select('razorpay_order_id').limit(1);
    // PGRST200 = schema cache could not find column.
    if (invoiceError && (invoiceError.code === 'PGRST200' || invoiceError.code === '42703')) {
        console.log("❌ FAILED. Column missing!");
        missingScripts.push("payment-security-patch.sql");
    } else if (!invoiceError) {
        console.log("✅ Passed");
    } else {
        console.log(`⚠️ Warning: ${invoiceError.message} (${invoiceError.code})`);
    }

    // 3. Check fixed RLS policies exist on admin tables (like premise_categories logic or agent table existence)
    process.stdout.write("3. Checking if 'agents' table exists... ");
    const { error: agentsError } = await supabase.from('agents').select('id').limit(1);
    if (agentsError && (agentsError.code === 'PGRST116' || agentsError.code === 'PGRST200' || agentsError.code === '42P01')) {
        console.log("❌ FAILED. Table missing!");
        missingScripts.push("create-agents-table.sql");
    } else {
        console.log("✅ Passed");
    }

    console.log("\n--------------------------------------------------");
    if (missingScripts.length === 0) {
        console.log("🎉 SUCCESS! Your Supabase database is completely up to date.");
        console.log("You have successfully run all necessary SQL migration scripts.");
    } else {
        console.log("⚠️ ACTION REQUIRED: Your database is missing some critical schema updates.");
        console.log("Please copy and run the following files in your Supabase SQL Editor:");
        missingScripts.forEach(script => console.log(`   - database_sql_backups/${script}`));
    }
}

checkDatabase().catch(console.error);
