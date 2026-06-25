const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
const lines = env.split('\n');
let url, key;
for (const line of lines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    url = line.split('=')[1].trim().replace(/['"]/g, '');
  }
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    key = line.split('=')[1].trim().replace(/['"]/g, '');
  }
}

if (!url || !key) {
  console.error('Keys not found');
  process.exit(1);
}

const supabase = createClient(url, key);
supabase.rpc('execute_sql', { sql: `
  SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
  FROM pg_policies 
  WHERE tablename = 'appointments';
` }).then(({ data, error }) => {
  if (error) {
    // If RPC execute_sql is not defined, query via custom sql or direct API if possible
    console.log("RPC Error, trying direct query...");
    supabase.from('appointments').select('*').limit(1).then(({ error: err2 }) => {
      // Just run raw sql through postgres extension if we can't do RPC
      // Wait, let's write a direct query using postgres module if we have it,
      // or check if we can query pg_policies using supabase.rpc or a sql endpoint.
      // Wait! supabase client doesn't let you query pg_policies directly via REST unless exposed.
      // Let's print out the error first
      console.error(error);
    });
  } else {
    console.log(data);
  }
});
