const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local
const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('Fetching auth users...');
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error('Error fetching Auth users:', authError);
    return;
  }

  console.log(`Found ${authData.users.length} auth users. Creating profiles...`);

  for (const user of authData.users) {
    const email = user.email;
    const fullName = user.raw_user_meta_data?.full_name || email.split('@')[0];
    let role = user.raw_user_meta_data?.role || 'worker';
    
    // Set admin role for specific users if known
    if (email === 'marina@tramiteconomistes.com' || email === 'rosa@tramiteconomistes.com') {
      role = 'admin';
    }

    const { error: insertError } = await supabase.from('profiles').upsert({
      id: user.id,
      email: email,
      full_name: fullName,
      role: role,
      color: '#3B82F6',
      active: true
    });

    if (insertError) {
      console.error(`Error inserting profile for ${email}:`, insertError);
    } else {
      console.log(`Profile created/updated for: ${email} (${role})`);
    }
  }

  console.log('Done creating profiles!');
}

run();
