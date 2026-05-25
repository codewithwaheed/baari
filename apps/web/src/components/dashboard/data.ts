// apps/web/src/components/dashboard/data.ts
// Seed data + shared types for the dashboard.
// Reflects a male barbershop context.
// All monetary values are stored in paisa (PKR × 100) per spec.

import type { BookingStatus } from './primitives';

export type NavId =
  | 'calendar' | 'requests' | 'clients' | 'pos' | 'settings'
  | 'waitlist' | 'messages' | 'inventory' | 'marketing' | 'reports' | 'billie';

export interface Staff {
  id: string;
  name: string;
  role: string;
  color: string;
}

export interface ServiceLine {
  name: string;
  durationMin: number;
  pricePaisa: number;
}

export interface Appointment {
  id: string;
  staff: string;            // staffId
  staffName?: string;
  client: string;           // clientName
  phone?: string;
  customerId?: string;      // DB customer UUID — present on API-loaded appointments
  customerCreatedAt?: string; // ISO string — for "Member since"
  service: string;          // primary service name (services[0].name)
  services: ServiceLine[];  // full ordered list — use this for line items
  start: number;            // decimal hours e.g. 9.5 = 9:30am
  end: number;
  status: BookingStatus;
  price: number;            // paisa — total of all services
  source?: 'manual' | 'whatsapp' | 'web';
  notes?: string;           // customer-level notes (customers.notes, not bookings.notes)
}

export interface BookingRequest {
  id: string;
  client: string;
  phone: string;
  services: Array<{ id: string; name: string; durationMin: number; pricePaisa: number }>;
  staff: string;
  day: string;
  time: number; // decimal hours
  paid: boolean;
  amount: number; // paisa
}

export interface VisitRecord {
  service: string;
  date: string;
  staff: string;
  amount?: number; // paisa
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  vip: boolean;
  lastVisit: string;
  visits: number;
  whatsappOptIn: boolean;
  notes: string;
  history: VisitRecord[];
}

export interface ServiceItem {
  name: string;
  price: number; // paisa
  dur: number;   // hours
}

export const STAFF: Staff[] = [
  { id: 'usman',  name: 'Usman',  role: 'Senior Barber',     color: '#322B20' },
  { id: 'hassan', name: 'Hassan', role: 'Color Specialist',  color: '#4F6E89' },
  { id: 'bilal',  name: 'Bilal',  role: 'Barber',            color: '#4E7C58' },
  { id: 'ahmed',  name: 'Ahmed',  role: 'Grooming Expert',   color: '#8A6B3A' },
];

function mkServices(name: string, pricePaisa: number, durationMin: number): ServiceLine[] {
  return [{ name, pricePaisa, durationMin }];
}

export const SEED_APPTS: Appointment[] = [
  { id: 'a1', staff: 'usman',  client: 'Saad Butt',       phone: '0300 1234 567', service: 'Fade + Beard Trim',  services: mkServices('Fade + Beard Trim',  180000, 60), start:  9.0, end: 10.0, status: 'completed',      price:  180000 },
  { id: 'a2', staff: 'usman',  client: 'Ali Raza',        phone: '0321 4567 890', service: 'Hair + Beard Combo', services: mkServices('Hair + Beard Combo', 150000, 60), start: 11.0, end: 12.0, status: 'checkedIn',      price:  150000 },
  { id: 'a3', staff: 'usman',  client: 'Hamza Sheikh',    phone: '0333 2345 678', service: 'Keratin Treatment',  services: mkServices('Keratin Treatment',  800000, 150), start: 14.0, end: 16.5, status: 'confirmed',     price:  800000 },
  { id: 'b1', staff: 'hassan', client: 'Zain Malik',      phone: '0301 9876 543', service: 'Global Color',       services: mkServices('Global Color',       650000, 120), start: 10.0, end: 12.0, status: 'pendingPayment', price:  650000 },
  { id: 'b2', staff: 'hassan', client: 'Faisal Qureshi',  phone: '0322 1122 334', service: 'Highlights',         services: mkServices('Highlights',         850000, 120), start: 13.0, end: 15.0, status: 'confirmed',     price:  850000 },
  { id: 'b3', staff: 'hassan', client: 'Omar Farooq',     phone: '0345 7788 990', service: 'Hair Spa',           services: mkServices('Hair Spa',           300000, 60),  start: 15.5, end: 16.5, status: 'confirmed',     price:  300000 },
  { id: 'c1', staff: 'bilal',  client: 'Talha Ahmed',     phone: '0311 5544 332', service: 'Clean Shave',        services: mkServices('Clean Shave',         80000, 30),  start:  9.5, end: 10.0, status: 'completed',     price:   80000 },
  { id: 'c2', staff: 'bilal',  client: 'Umar Hayat',      phone: '0334 6677 889', service: 'Haircut',            services: mkServices('Haircut',            120000, 30),  start: 11.0, end: 11.5, status: 'noShow',        price:  120000 },
  { id: 'c3', staff: 'bilal',  client: 'Shahzaib Mirza',  phone: '0302 8899 776', service: 'Fade + Lineup',      services: mkServices('Fade + Lineup',      160000, 60),  start: 14.0, end: 15.0, status: 'confirmed',     price:  160000 },
  { id: 'd1', staff: 'ahmed',  client: 'Asad Khan',       phone: '0312 3344 556', service: 'Head Massage',       services: mkServices('Head Massage',       120000, 30),  start: 10.0, end: 10.5, status: 'confirmed',     price:  120000 },
  { id: 'd2', staff: 'ahmed',  client: 'Bilal Chaudhry',  phone: '0335 9988 776', service: 'Facial for Men',     services: mkServices('Facial for Men',     250000, 60),  start: 11.5, end: 12.5, status: 'pendingPayment', price:  250000 },
  { id: 'd3', staff: 'ahmed',  client: 'Raza Hussain',    phone: '0303 4455 667', service: 'Beard Sculpt',       services: mkServices('Beard Sculpt',       100000, 30),  start: 15.0, end: 15.5, status: 'confirmed',     price:  100000 },
];

export const SEED_REQUESTS: BookingRequest[] = [
  { id: 'r1', client: 'Ahsan Tariq',   phone: '0300 5566 778', services: [{ id: 's1', name: 'Fade + Beard Trim',  durationMin: 60,  pricePaisa: 180000 }], staff: 'Usman',  day: 'Today',    time: 17.0, paid: true,  amount: 180000 },
  { id: 'r2', client: 'Junaid Iqbal',  phone: '0321 8899 220', services: [{ id: 's2', name: 'Facial for Men',     durationMin: 60,  pricePaisa: 250000 }, { id: 's3', name: 'Head Massage', durationMin: 30, pricePaisa: 120000 }], staff: 'Ahmed',  day: 'Tomorrow', time: 11.0, paid: false, amount: 370000 },
  { id: 'r3', client: 'Waqas Noor',    phone: '0345 1100 234', services: [{ id: 's4', name: 'Global Color',       durationMin: 120, pricePaisa: 650000 }], staff: 'Hassan', day: 'Tomorrow', time: 14.5, paid: true,  amount: 650000 },
  { id: 'r4', client: 'Imran Siddiq',  phone: '0333 6677 010', services: [{ id: 's5', name: 'Hair Spa',           durationMin: 60,  pricePaisa: 300000 }], staff: 'Hassan', day: 'May 19',   time: 10.0, paid: false, amount: 300000 },
  { id: 'r5', client: 'Kamran Bajwa',  phone: '0301 2233 445', services: [{ id: 's6', name: 'Keratin Treatment',  durationMin: 150, pricePaisa: 800000 }, { id: 's7', name: 'Haircut', durationMin: 30, pricePaisa: 120000 }], staff: 'Usman',  day: 'May 20',   time: 16.0, paid: true,  amount: 920000 },
];

export const SEED_CLIENTS: Client[] = [
  {
    id: 'cl1', name: 'Saad Butt', phone: '0300 1234 567', vip: true,
    lastVisit: 'May 17, 2026', visits: 14, whatsappOptIn: true,
    notes: 'Prefers low fade on sides, medium on top. Beard sculpted square. Regular every 3 weeks.',
    history: [
      { service: 'Fade + Beard Trim',  date: 'May 17, 2026', staff: 'Usman',  amount: 180000 },
      { service: 'Hair + Beard Combo', date: 'Apr 26, 2026', staff: 'Usman',  amount: 150000 },
      { service: 'Highlights',         date: 'Apr 02, 2026', staff: 'Hassan', amount: 850000 },
      { service: 'Clean Shave',        date: 'Mar 15, 2026', staff: 'Bilal',  amount:  80000 },
    ],
  },
  {
    id: 'cl2', name: 'Ali Raza', phone: '0321 4567 890', vip: false,
    lastVisit: 'May 17, 2026', visits: 4, whatsappOptIn: true,
    notes: 'New client. Sensitive scalp — use sulfate-free products.',
    history: [
      { service: 'Hair + Beard Combo', date: 'May 17, 2026', staff: 'Usman', amount: 150000 },
      { service: 'Haircut',            date: 'Apr 19, 2026', staff: 'Bilal', amount: 120000 },
    ],
  },
  {
    id: 'cl3', name: 'Hamza Sheikh', phone: '0333 2345 678', vip: true,
    lastVisit: 'May 17, 2026', visits: 22, whatsappOptIn: true,
    notes: 'VIP. Books quarterly for keratin. Always in afternoon slots. Pays cash only.',
    history: [
      { service: 'Keratin Treatment', date: 'May 17, 2026', staff: 'Usman',  amount: 800000 },
      { service: 'Keratin Treatment', date: 'Feb 08, 2026', staff: 'Usman',  amount: 800000 },
      { service: 'Hair Spa',          date: 'Jan 11, 2026', staff: 'Hassan', amount: 300000 },
    ],
  },
  {
    id: 'cl4', name: 'Zain Malik', phone: '0301 9876 543', vip: false,
    lastVisit: 'May 17, 2026', visits: 7, whatsappOptIn: false,
    notes: 'Booked via Instagram. Prefers contact via call, not WhatsApp.',
    history: [
      { service: 'Global Color', date: 'May 17, 2026', staff: 'Hassan', amount: 650000 },
      { service: 'Highlights',   date: 'Mar 22, 2026', staff: 'Hassan', amount: 850000 },
    ],
  },
  {
    id: 'cl5', name: 'Talha Ahmed', phone: '0311 5544 332', vip: false,
    lastVisit: 'May 17, 2026', visits: 5, whatsappOptIn: true,
    notes: 'Quick in-and-out. Never wants product. Straight razor shave only.',
    history: [
      { service: 'Clean Shave', date: 'May 17, 2026', staff: 'Bilal', amount:  80000 },
      { service: 'Clean Shave', date: 'Apr 24, 2026', staff: 'Bilal', amount:  80000 },
    ],
  },
  {
    id: 'cl6', name: 'Asad Khan', phone: '0312 3344 556', vip: true,
    lastVisit: 'May 17, 2026', visits: 11, whatsappOptIn: true,
    notes: 'Comes in every two weeks. Head massage + haircut package. Prefers Ahmed.',
    history: [
      { service: 'Head Massage',        date: 'May 17, 2026', staff: 'Ahmed', amount: 120000 },
      { service: 'Head Massage + Cut',  date: 'May 03, 2026', staff: 'Ahmed', amount: 250000 },
      { service: 'Facial for Men',      date: 'Apr 15, 2026', staff: 'Ahmed', amount: 250000 },
    ],
  },
  {
    id: 'cl7', name: 'Omar Farooq', phone: '0345 7788 990', vip: false,
    lastVisit: 'May 17, 2026', visits: 3, whatsappOptIn: true,
    notes: 'Experimenting with hair color. Currently going lighter. Patch test done.',
    history: [
      { service: 'Hair Spa',    date: 'May 17, 2026', staff: 'Hassan', amount: 300000 },
      { service: 'Highlights',  date: 'Apr 30, 2026', staff: 'Hassan', amount: 850000 },
    ],
  },
  {
    id: 'cl8', name: 'Bilal Chaudhry', phone: '0335 9988 776', vip: false,
    lastVisit: 'May 17, 2026', visits: 2, whatsappOptIn: true,
    notes: '',
    history: [
      { service: 'Facial for Men', date: 'May 17, 2026', staff: 'Ahmed', amount: 250000 },
    ],
  },
];

export const SERVICES: ServiceItem[] = [
  { name: 'Haircut',            price:  120000, dur: 0.5 },
  { name: 'Fade Cut',           price:  160000, dur: 0.75 },
  { name: 'Fade + Beard Trim',  price:  180000, dur: 1.0 },
  { name: 'Hair + Beard Combo', price:  150000, dur: 1.0 },
  { name: 'Beard Trim',         price:   80000, dur: 0.5 },
  { name: 'Beard Sculpt',       price:  100000, dur: 0.5 },
  { name: 'Clean Shave',        price:   80000, dur: 0.5 },
  { name: 'Head Massage',       price:  120000, dur: 0.5 },
  { name: 'Facial for Men',     price:  250000, dur: 1.0 },
  { name: 'Hair Spa',           price:  300000, dur: 1.0 },
  { name: 'Global Color',       price:  650000, dur: 2.0 },
  { name: 'Highlights',         price:  850000, dur: 2.0 },
  { name: 'Keratin Treatment',  price:  800000, dur: 2.5 },
];
