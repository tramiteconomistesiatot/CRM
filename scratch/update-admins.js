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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const admins = [
    'marina@tramiteconomistes.com',
    'marinarecioyanez@gmail.com',
    'rosa@tramiteconomistes.com',
    'aitor.tendero@gmail.com',
    'aitortenderoguirado@gmail.com'
  ];

  console.log('Updating admin roles...');

  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .in('email', admins)
    .select('email, role');

  if (error) {
    console.error('Error updating roles:', error);
  } else {
    console.log('Updated users:', data);
  }
}

run();
