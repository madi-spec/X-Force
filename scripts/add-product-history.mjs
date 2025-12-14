import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Ergemedi123!@db.nezewucpbkuzoukomnlv.supabase.co:5432/postgres';
const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function addProductHistory() {
  console.log('Adding product history records...');

  // Get all company products that don't have history
  const companyProducts = await sql`
    SELECT cp.*, c.name as company_name, p.display_name as product_name, p.name as product_code,
           pc.owner as category_owner
    FROM company_products cp
    JOIN companies c ON cp.company_id = c.id
    JOIN products p ON cp.product_id = p.id
    JOIN product_categories pc ON p.category_id = pc.id
    WHERE NOT EXISTS (
      SELECT 1 FROM company_product_history cph
      WHERE cph.company_id = cp.company_id AND cph.product_id = cp.product_id
    )
  `;

  console.log('Found', companyProducts.length, 'products without history');

  // Get users for attribution
  const users = await sql`SELECT id, name, team FROM users`;
  const voiceUsers = users.filter(u => u.team === 'voice');
  const xraiUsers = users.filter(u => u.team === 'xrai');

  for (const cp of companyProducts) {
    // Determine which user to attribute based on product category
    const user = cp.category_owner === 'voice'
      ? voiceUsers[Math.floor(Math.random() * voiceUsers.length)]
      : xraiUsers[Math.floor(Math.random() * xraiUsers.length)];

    // Add purchased event
    await sql`
      INSERT INTO company_product_history (company_id, product_id, event_type, event_date, user_id, notes)
      VALUES (
        ${cp.company_id},
        ${cp.product_id},
        ${cp.status === 'churned' ? 'churned' : 'purchased'},
        ${cp.started_at},
        ${user.id},
        ${'Initial product setup'}
      )
    `;
    console.log('  Added history for', cp.company_name, '-', cp.product_name);
  }

  // Now verify
  const historyCount = await sql`SELECT COUNT(*) as count FROM company_product_history`;
  console.log('\nTotal product history records:', historyCount[0].count);

  await sql.end();
}

addProductHistory();
