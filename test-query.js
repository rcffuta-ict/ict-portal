const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data, error } = await supabase.from('event_registrations').select(`gender, level, profiles!event_registrations_email_fkey ( entry_year )`).limit(5);
  console.log("Data:", JSON.stringify(data, null, 2));
  console.log("Error:", error);
  const { data: d2, error: e2 } = await supabase.from('event_registrations').select(`gender, level, profiles ( entry_year )`).limit(5);
  console.log("D2 Error:", e2);
  const { data: d3, error: e3 } = await supabase.from('event_registrations').select(`gender, level, profiles:email ( entry_year )`).limit(5);
  console.log("D3 Error:", e3);
}
test();
