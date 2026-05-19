// packages/db/src/seed/index.ts
// Development seed — Pakistani salon, PKR amounts.
// Run: pnpm db:seed

import { sql } from 'drizzle-orm';
import { db } from '../client';
import * as schema from '../schema';

async function seed() {
  console.log('🌱 Seeding database...');

  // Idempotency: skip if already seeded
  const existing = await db.select({ id: schema.tenants.id })
    .from(schema.tenants)
    .where(sql`slug = 'saloni-studio-lahore'`);
  if (existing.length > 0) {
    console.log('ℹ️  Seed data already present, skipping.');
    console.log(`   Tenant ID: ${existing[0]!.id}`);
    process.exit(0);
  }

  // Tenant
  const [tenant] = await db.insert(schema.tenants).values({
    slug: 'saloni-studio-lahore',
    name: 'Saloni Studio',
    country: 'PK',
    timezone: 'Asia/Karachi',
    plan: 'pro',
  }).returning();

  if (!tenant) throw new Error('Failed to create tenant');
  console.log('✓ Tenant:', tenant.name);

  // Location
  const [location] = await db.insert(schema.locations).values({
    tenantId: tenant.id,
    name: 'Main Branch',
    address: 'Phase 5, DHA',
    city: 'Lahore',
  }).returning();

  if (!location) throw new Error('Failed to create location');

  // Staff
  const staffRows = await db.insert(schema.staff).values([
    { tenantId: tenant.id, locationId: location.id, name: 'Ayesha Malik',   role: 'stylist' },
    { tenantId: tenant.id, locationId: location.id, name: 'Sana Khan',      role: 'colorist' },
    { tenantId: tenant.id, locationId: location.id, name: 'Hira Ahmed',     role: 'esthetician' },
    { tenantId: tenant.id, locationId: location.id, name: 'Zoya Butt',      role: 'nail_tech' },
  ]).returning();
  console.log(`✓ Staff: ${staffRows.length} members`);

  // Services (price in paisa = PKR × 100)
  const serviceRows = await db.insert(schema.services).values([
    { tenantId: tenant.id, name: 'Cut + Blow Dry',      category: 'hair',   durationMin: 90,  pricePaisa: 450000 },
    { tenantId: tenant.id, name: 'Global Color',        category: 'hair',   durationMin: 120, pricePaisa: 850000 },
    { tenantId: tenant.id, name: 'Highlights',          category: 'hair',   durationMin: 150, pricePaisa: 1200000 },
    { tenantId: tenant.id, name: 'Balayage',            category: 'hair',   durationMin: 150, pricePaisa: 1400000 },
    { tenantId: tenant.id, name: 'Keratin Treatment',   category: 'hair',   durationMin: 150, pricePaisa: 1500000 },
    { tenantId: tenant.id, name: 'Hydrating Facial',    category: 'skin',   durationMin: 60,  pricePaisa: 550000 },
    { tenantId: tenant.id, name: 'Threading',           category: 'skin',   durationMin: 15,  pricePaisa: 80000 },
    { tenantId: tenant.id, name: 'Mani + Pedi',         category: 'nails',  durationMin: 90,  pricePaisa: 550000 },
    { tenantId: tenant.id, name: 'Gel Manicure',        category: 'nails',  durationMin: 60,  pricePaisa: 350000 },
    { tenantId: tenant.id, name: 'Bridal Makeup Trial', category: 'makeup', durationMin: 120, pricePaisa: 1800000 },
    { tenantId: tenant.id, name: 'Bridal Makeup',       category: 'makeup', durationMin: 240, pricePaisa: 3500000 },
  ]).returning();
  console.log(`✓ Services: ${serviceRows.length}`);

  // Owner user
  await db.insert(schema.users).values({
    tenantId: tenant.id,
    email: 'owner@saloni.pk',
    name: 'Sana Aslam',
    role: 'owner',
  });
  console.log('✓ User: owner@saloni.pk (password: devpassword123)');

  console.log('\n✅ Seed complete.');
  console.log(`   Tenant ID: ${tenant.id}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
