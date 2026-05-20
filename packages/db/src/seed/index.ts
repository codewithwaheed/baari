// packages/db/src/seed/index.ts
// Dev seed — Waheed Barber Studio, barbershop context.
// Run: pnpm db:seed
//
// Creates (idempotent — skips if +923062298688 already has bookings):
//   · Tenant + location for +923062298688
//   · 4 barbers, 13 barbershop services
//   · 8 customers + today's 13 bookings + 5 pending requests

import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db } from '../client';
import * as schema from '../schema';

const DEV_PHONE    = '+923062298688';
const DEV_PASSWORD = 'dev123456';
const DEV_NAME     = 'Ahmad Waheed';
const SLUG         = 'waheed-barber-lahore';

/** Returns a Date for today at the given hour + minute in Asia/Karachi (UTC+5). */
function k(hour: number, min = 0): Date {
  const todayKarachi = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  return new Date(`${todayKarachi}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00+05:00`);
}

async function seed() {
  console.log('🌱  Baari dev seed starting…');

  // ── Find or create tenant ──────────────────────────────────────────────────

  let tenantId: string;
  let locationId: string;

  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.phoneE164, DEV_PHONE),
  });

  if (existingUser) {
    tenantId = existingUser.tenantId;
    console.log(`ℹ️  User ${DEV_PHONE} exists → tenant ${tenantId}`);

    const existingBooking = await db.query.bookings.findFirst({
      where: eq(schema.bookings.tenantId, tenantId),
    });
    if (existingBooking) {
      console.log('ℹ️  Seed data already present for this tenant. Skipping.');
      process.exit(0);
    }

    const loc = await db.query.locations.findFirst({
      where: eq(schema.locations.tenantId, tenantId),
    });
    locationId = loc!.id;

    // Ensure onboarding is complete for dev
    await db.update(schema.tenants)
      .set({ onboardingComplete: true, city: 'Lahore' })
      .where(eq(schema.tenants.id, tenantId));

  } else {
    // Fresh install — create full account
    const [tenant] = await db.insert(schema.tenants).values({
      slug:               SLUG,
      name:               'Waheed Barber Studio',
      country:            'PK',
      timezone:           'Asia/Karachi',
      plan:               'pro',
      city:               'Lahore',
      ownerName:          DEV_NAME,
      onboardingComplete: true,
      onboardingStep:     3,
    }).returning();
    if (!tenant) throw new Error('Failed to create tenant');
    tenantId = tenant.id;
    console.log('✓ Tenant:', tenant.name);

    const [location] = await db.insert(schema.locations).values({
      tenantId,
      name:    'Main Branch',
      address: 'DHA Phase 5',
      city:    'Lahore',
    }).returning();
    if (!location) throw new Error('Failed to create location');
    locationId = location.id;

    const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
    await db.insert(schema.users).values({
      tenantId,
      name:          DEV_NAME,
      role:          'owner',
      phoneE164:     DEV_PHONE,
      phoneVerified: true,
      passwordHash,
    });
    console.log(`✓ User: ${DEV_PHONE} / password: ${DEV_PASSWORD}`);
  }

  // ── Staff (idempotent: reuse existing rows if present) ────────────────────

  let staffRows = await db.select().from(schema.staff)
    .where(eq(schema.staff.tenantId, tenantId));

  if (staffRows.length === 0) {
    staffRows = await db.insert(schema.staff).values([
      { tenantId, locationId, name: 'Usman',  role: 'barber'   },
      { tenantId, locationId, name: 'Hassan', role: 'colorist' },
      { tenantId, locationId, name: 'Bilal',  role: 'barber'   },
      { tenantId, locationId, name: 'Ahmed',  role: 'barber'   },
    ]).returning();
    console.log(`✓ Staff: ${staffRows.length} barbers`);
  } else {
    console.log(`ℹ️  Staff: ${staffRows.length} already exist`);
  }
  const usman  = staffRows.find(s => s.name === 'Usman');
  const hassan = staffRows.find(s => s.name === 'Hassan');
  const bilal  = staffRows.find(s => s.name === 'Bilal');
  const ahmed  = staffRows.find(s => s.name === 'Ahmed');
  if (!usman || !hassan || !bilal || !ahmed) throw new Error('Staff rows incomplete');

  // ── Services (idempotent: reuse existing rows if present) ─────────────────

  let svcRows = await db.select().from(schema.services)
    .where(eq(schema.services.tenantId, tenantId));

  if (svcRows.length === 0) {
    svcRows = await db.insert(schema.services).values([
      { tenantId, name: 'Haircut',            category: 'hair',  durationMin:  30, pricePaisa:  120000 },
      { tenantId, name: 'Fade Cut',           category: 'hair',  durationMin:  45, pricePaisa:  160000 },
      { tenantId, name: 'Fade + Beard Trim',  category: 'hair',  durationMin:  60, pricePaisa:  180000 },
      { tenantId, name: 'Hair + Beard Combo', category: 'hair',  durationMin:  60, pricePaisa:  150000 },
      { tenantId, name: 'Beard Trim',         category: 'beard', durationMin:  30, pricePaisa:   80000 },
      { tenantId, name: 'Beard Sculpt',       category: 'beard', durationMin:  30, pricePaisa:  100000 },
      { tenantId, name: 'Clean Shave',        category: 'beard', durationMin:  30, pricePaisa:   80000 },
      { tenantId, name: 'Head Massage',       category: 'spa',   durationMin:  30, pricePaisa:  120000 },
      { tenantId, name: 'Facial for Men',     category: 'skin',  durationMin:  60, pricePaisa:  250000 },
      { tenantId, name: 'Hair Spa',           category: 'spa',   durationMin:  60, pricePaisa:  300000 },
      { tenantId, name: 'Global Color',       category: 'hair',  durationMin: 120, pricePaisa:  650000 },
      { tenantId, name: 'Highlights',         category: 'hair',  durationMin: 120, pricePaisa:  850000 },
      { tenantId, name: 'Keratin Treatment',  category: 'hair',  durationMin: 150, pricePaisa:  800000 },
    ]).returning();
    console.log(`✓ Services: ${svcRows.length}`);
  } else {
    console.log(`ℹ️  Services: ${svcRows.length} already exist`);
  }
  const svc = Object.fromEntries(svcRows.map(s => [s.name, s]));

  // ── Customers (idempotent: ON CONFLICT DO NOTHING) ─────────────────────────

  const custRows = await db.insert(schema.customers).values([
    { tenantId, phoneE164: '+923001234567', name: 'Saad Butt',       isVip: true,  waOptIn: true,  notes: 'Low fade on sides, medium top. Beard squared. Regular every 3 weeks.' },
    { tenantId, phoneE164: '+923214567890', name: 'Ali Raza',        isVip: false, waOptIn: true,  notes: 'New client. Sensitive scalp — sulfate-free only.' },
    { tenantId, phoneE164: '+923332345678', name: 'Hamza Sheikh',    isVip: true,  waOptIn: true,  notes: 'VIP. Quarterly keratin. Always afternoon. Cash only.' },
    { tenantId, phoneE164: '+923019876543', name: 'Zain Malik',      isVip: false, waOptIn: false, notes: 'Came via Instagram. Prefers call, not WhatsApp.' },
    { tenantId, phoneE164: '+923115544332', name: 'Talha Ahmed',     isVip: false, waOptIn: true,  notes: 'Quick in-and-out. No product. Straight razor only.' },
    { tenantId, phoneE164: '+923123344556', name: 'Asad Khan',       isVip: true,  waOptIn: true,  notes: 'Every two weeks. Head massage + cut. Prefers Ahmed.' },
    { tenantId, phoneE164: '+923457788990', name: 'Omar Farooq',     isVip: false, waOptIn: true,  notes: 'Experimenting with color. Patch test done.' },
    { tenantId, phoneE164: '+923359988776', name: 'Bilal Chaudhry',  isVip: false, waOptIn: true,  notes: '' },
  ]).onConflictDoNothing().returning();

  // If rows were skipped due to conflict, fetch them
  const allCusts = custRows.length === 8
    ? custRows
    : await db.select().from(schema.customers).where(eq(schema.customers.tenantId, tenantId));

  const cust = Object.fromEntries(allCusts.map(c => [c.name!, c]));
  console.log(`✓ Customers: ${allCusts.length}`);

  // ── Bookings for today ─────────────────────────────────────────────────────
  // Valid DB states: INITIATED, PAYMENT_PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW, EXPIRED

  await db.insert(schema.bookings).values([
    // Usman
    { tenantId, locationId, staffId: usman!.id,  serviceId: svc['Fade + Beard Trim']!.id,  customerId: cust['Saad Butt']!.id,      startTime: k(9,0),  endTime: k(10,0), state: 'COMPLETED',      pricePaisa: 180000, source: 'manual' },
    { tenantId, locationId, staffId: usman!.id,  serviceId: svc['Hair + Beard Combo']!.id, customerId: cust['Ali Raza']!.id,       startTime: k(11,0), endTime: k(12,0), state: 'CONFIRMED',      pricePaisa: 150000, source: 'manual' },
    { tenantId, locationId, staffId: usman!.id,  serviceId: svc['Keratin Treatment']!.id,  customerId: cust['Hamza Sheikh']!.id,   startTime: k(14,0), endTime: k(16,30),state: 'CONFIRMED',      pricePaisa: 800000, source: 'whatsapp' },
    // Hassan
    { tenantId, locationId, staffId: hassan!.id, serviceId: svc['Global Color']!.id,       customerId: cust['Zain Malik']!.id,     startTime: k(10,0), endTime: k(12,0), state: 'PAYMENT_PENDING',pricePaisa: 650000, source: 'whatsapp' },
    { tenantId, locationId, staffId: hassan!.id, serviceId: svc['Highlights']!.id,         customerId: cust['Omar Farooq']!.id,    startTime: k(13,0), endTime: k(15,0), state: 'CONFIRMED',      pricePaisa: 850000, source: 'manual' },
    { tenantId, locationId, staffId: hassan!.id, serviceId: svc['Hair Spa']!.id,           customerId: cust['Bilal Chaudhry']!.id, startTime: k(15,30),endTime: k(16,30),state: 'CONFIRMED',      pricePaisa: 300000, source: 'manual' },
    // Bilal
    { tenantId, locationId, staffId: bilal!.id,  serviceId: svc['Clean Shave']!.id,        customerId: cust['Talha Ahmed']!.id,    startTime: k(9,30), endTime: k(10,0), state: 'COMPLETED',      pricePaisa:  80000, source: 'manual' },
    { tenantId, locationId, staffId: bilal!.id,  serviceId: svc['Haircut']!.id,            customerId: cust['Talha Ahmed']!.id,    startTime: k(11,0), endTime: k(11,30),state: 'NO_SHOW',        pricePaisa: 120000, source: 'manual' },
    { tenantId, locationId, staffId: bilal!.id,  serviceId: svc['Fade Cut']!.id,           customerId: cust['Zain Malik']!.id,     startTime: k(14,0), endTime: k(15,0), state: 'CONFIRMED',      pricePaisa: 160000, source: 'manual' },
    // Ahmed
    { tenantId, locationId, staffId: ahmed!.id,  serviceId: svc['Head Massage']!.id,       customerId: cust['Asad Khan']!.id,      startTime: k(10,0), endTime: k(10,30),state: 'CONFIRMED',      pricePaisa: 120000, source: 'manual' },
    { tenantId, locationId, staffId: ahmed!.id,  serviceId: svc['Facial for Men']!.id,     customerId: cust['Omar Farooq']!.id,    startTime: k(11,30),endTime: k(12,30),state: 'PAYMENT_PENDING',pricePaisa: 250000, source: 'whatsapp' },
    { tenantId, locationId, staffId: ahmed!.id,  serviceId: svc['Beard Sculpt']!.id,       customerId: cust['Saad Butt']!.id,      startTime: k(15,0), endTime: k(15,30),state: 'CONFIRMED',      pricePaisa: 100000, source: 'manual' },
  ]);
  console.log('✓ Bookings: 12 for today');

  // ── Booking requests ────────────────────────────────────────────────────────

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKarachi = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  function t(hour: number, min = 0): Date {
    return new Date(`${tomorrowKarachi}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00+05:00`);
  }

  await db.insert(schema.bookingRequests).values([
    { tenantId, customerId: cust['Saad Butt']!.id,    serviceId: svc['Fade + Beard Trim']!.id, staffId: usman!.id,  requestedAt: k(17,0), requestedPricePaisa: 180000, paid: true,  state: 'pending' },
    { tenantId, customerId: cust['Bilal Chaudhry']!.id,serviceId: svc['Facial for Men']!.id,   staffId: ahmed!.id,  requestedAt: t(11,0), requestedPricePaisa: 250000, paid: false, state: 'pending' },
    { tenantId, customerId: cust['Zain Malik']!.id,   serviceId: svc['Global Color']!.id,      staffId: hassan!.id, requestedAt: t(14,30),requestedPricePaisa: 650000, paid: true,  state: 'pending' },
    { tenantId, customerId: cust['Omar Farooq']!.id,  serviceId: svc['Hair Spa']!.id,          staffId: hassan!.id, requestedAt: t(10,0), requestedPricePaisa: 300000, paid: false, state: 'pending' },
    { tenantId, customerId: cust['Hamza Sheikh']!.id, serviceId: svc['Keratin Treatment']!.id, staffId: usman!.id,  requestedAt: t(16,0), requestedPricePaisa: 800000, paid: true,  state: 'pending' },
  ]);
  console.log('✓ Requests: 5 pending');

  console.log('\n✅ Seed complete.');
  console.log(`   Tenant:   ${tenantId}`);
  console.log(`   Login:    ${DEV_PHONE} / ${DEV_PASSWORD}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
