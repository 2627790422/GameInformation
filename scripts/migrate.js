const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '001_init.sql'), 'utf-8');
const REF = 'gfzkhdhzqhphzteflxxk';

async function tryConn(connStr, label) {
  const client = new Client({ connectionString: connStr, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    console.log(label + ': connected');
    await client.query(sql);
    console.log(label + ': MIGRATION EXECUTED SUCCESSFULLY');
    await client.end();
    return true;
  } catch(e) {
    console.log(label + ': ' + e.message.split('\n')[0]);
    try { await client.end(); } catch(_) {}
    return false;
  }
}

(async () => {
  // Try pooler + direct with project ref as password
  if (await tryConn(`postgresql://postgres.${REF}:${REF}@aws-0-us-west-1.pooler.supabase.co:6543/postgres`, 'pooler/ref')) process.exit(0);
  if (await tryConn(`postgresql://postgres:${REF}@db.${REF}.supabase.co:5432/postgres`, 'direct/ref')) process.exit(0);
  console.log('\nAll connection attempts failed.');
  console.log('Options to create the table:');
  console.log('1. Open https://supabase.com/dashboard/project/' + REF + '/sql/new');
  console.log('2. Paste supabase/migrations/001_init.sql and run it');
  console.log('3. Then re-run: node scripts/import.js');
})();
