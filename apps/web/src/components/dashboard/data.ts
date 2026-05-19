// apps/web/src/components/dashboard/data.ts
// Seed data + shared types for the dashboard.
// All monetary values are stored in paisa (PKR × 100) per spec.

import type { BookingStatus } from './primitives';

export type NavId =
  | 'calendar' | 'requests' | 'clients' | 'settings'
  | 'waitlist' | 'messages' | 'inventory' | 'marketing' | 'reports' | 'billie';

export interface Staff {
  id: string;
  name: string;
  role: string;
  color: string;
}

export interface Appointment {
  id: string;
  staff: string;
  client: string;
  phone?: string;
  service: string;
  start: number; // decimal hours e.g. 9.5 = 9:30am
  end: number;
  status: BookingStatus;
  price: number; // paisa
}

export interface BookingRequest {
  id: string;
  client: string;
  phone: string;
  service: string;
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
  dur: number; // hours
}

export const STAFF: Staff[] = [
  { id: 'ayesha', name: 'Ayesha', role: 'Senior Stylist',   color: '#322B20' },
  { id: 'sana',   name: 'Sana',   role: 'Color Specialist', color: '#4F6E89' },
  { id: 'hira',   name: 'Hira',   role: 'Esthetician',      color: '#4E7C58' },
  { id: 'zoya',   name: 'Zoya',   role: 'Nail Technician',  color: '#8A6B3A' },
];

export const SEED_APPTS: Appointment[] = [
  { id: 'a1', staff: 'ayesha', client: 'Mehwish Khan',   phone: '0300 1234 567', service: 'Bridal Makeup Trial',  start:  9.0, end: 11.0, status: 'completed',      price: 1800000 },
  { id: 'a2', staff: 'ayesha', client: 'Aiman Saeed',    phone: '0321 4567 890', service: 'Cut + Blow Dry',       start: 12.0, end: 13.5, status: 'checkedIn',      price:  450000 },
  { id: 'a3', staff: 'ayesha', client: 'Rabia Naveed',   phone: '0333 2345 678', service: 'Keratin Treatment',    start: 15.0, end: 17.5, status: 'confirmed',      price: 1500000 },
  { id: 'b1', staff: 'sana',   client: 'Hadia Mahmood',  phone: '0301 9876 543', service: 'Highlights',           start: 10.0, end: 12.5, status: 'pendingPayment', price: 1200000 },
  { id: 'b2', staff: 'sana',   client: 'Maham Rauf',     phone: '0322 1122 334', service: 'Global Color',         start: 13.5, end: 15.5, status: 'confirmed',      price:  850000 },
  { id: 'b3', staff: 'sana',   client: 'Nida Faisal',    phone: '0345 7788 990', service: 'Balayage',             start: 16.0, end: 18.5, status: 'confirmed',      price: 1400000 },
  { id: 'c1', staff: 'hira',   client: 'Komal Akhtar',   phone: '0311 5544 332', service: 'Hydrating Facial',     start:  9.5, end: 10.5, status: 'completed',      price:  550000 },
  { id: 'c2', staff: 'hira',   client: 'Sara Ijaz',      phone: '0334 6677 889', service: 'Threading + Brow Wax', start: 11.0, end: 11.5, status: 'noShow',         price:  200000 },
  { id: 'c3', staff: 'hira',   client: 'Aisha Raza',     phone: '0302 8899 776', service: 'Bridal Makeup',        start: 14.0, end: 18.0, status: 'confirmed',      price: 3500000 },
  { id: 'd1', staff: 'zoya',   client: 'Bushra Mehmood', phone: '0312 3344 556', service: 'Mani + Pedi',          start: 10.0, end: 11.5, status: 'confirmed',      price:  550000 },
  { id: 'd2', staff: 'zoya',   client: 'Faiza Tariq',    phone: '0335 9988 776', service: 'Gel Manicure',         start: 12.5, end: 13.5, status: 'pendingPayment', price:  350000 },
  { id: 'd3', staff: 'zoya',   client: 'Tania Wasim',    phone: '0303 4455 667', service: 'Pedicure Deluxe',      start: 15.0, end: 16.0, status: 'confirmed',      price:  400000 },
];

export const SEED_REQUESTS: BookingRequest[] = [
  { id: 'r1', client: 'Hina Yousaf',    phone: '0300 5566 778', service: 'Haircut + Blow Dry',  staff: 'Ayesha', day: 'Today',    time: 17.0, paid: true,  amount:  450000 },
  { id: 'r2', client: 'Zara Iqbal',     phone: '0321 8899 220', service: 'Hydrating Facial',    staff: 'Hira',   day: 'Tomorrow', time: 11.0, paid: false, amount:  550000 },
  { id: 'r3', client: 'Mariyam Sheikh', phone: '0345 1100 234', service: 'Highlights',          staff: 'Sana',   day: 'Tomorrow', time: 14.5, paid: true,  amount: 1200000 },
  { id: 'r4', client: 'Sumbal Asif',    phone: '0333 6677 010', service: 'Gel Manicure',        staff: 'Zoya',   day: 'May 19',   time: 10.0, paid: false, amount:  350000 },
  { id: 'r5', client: 'Ifrah Bilal',    phone: '0301 2233 445', service: 'Bridal Makeup Trial', staff: 'Ayesha', day: 'May 20',   time: 16.0, paid: true,  amount: 1800000 },
];

export const SEED_CLIENTS: Client[] = [
  { id: 'cl1', name: 'Mehwish Khan',   phone: '0300 1234 567', vip: true,  lastVisit: 'May 17, 2026', visits: 14, whatsappOptIn: true,
    notes: 'Prefers warm undertones. Allergic to ammonia-based colors. Always offer chai before service.',
    history: [
      { service: 'Bridal Makeup Trial', date: 'May 17, 2026', staff: 'Ayesha', amount: 1800000 },
      { service: 'Hair Spa + Mask',     date: 'May 02, 2026', staff: 'Ayesha', amount:  450000 },
      { service: 'Highlights',          date: 'Apr 18, 2026', staff: 'Sana',   amount: 1200000 },
      { service: 'Threading',           date: 'Apr 04, 2026', staff: 'Hira',   amount:   80000 },
    ],
  },
  { id: 'cl2', name: 'Aiman Saeed',    phone: '0321 4567 890', vip: false, lastVisit: 'May 17, 2026', visits: 3, whatsappOptIn: true,
    notes: 'New client referred by Mehwish. Sensitive scalp — use mild shampoo only.',
    history: [
      { service: 'Cut + Blow Dry', date: 'May 17, 2026', staff: 'Ayesha', amount: 450000 },
      { service: 'Cut + Blow Dry', date: 'Apr 12, 2026', staff: 'Ayesha', amount: 450000 },
      { service: 'Consultation',   date: 'Mar 28, 2026', staff: 'Ayesha', amount: 0 },
    ],
  },
  { id: 'cl3', name: 'Rabia Naveed',   phone: '0333 2345 678', vip: true,  lastVisit: 'May 17, 2026', visits: 22, whatsappOptIn: true,
    notes: 'VIP. Books quarterly. Prefers 4pm slots. Husband pays — invoice to him.',
    history: [
      { service: 'Keratin Treatment', date: 'May 17, 2026', staff: 'Ayesha', amount: 1500000 },
      { service: 'Cut + Color',       date: 'Feb 14, 2026', staff: 'Sana',   amount: 1250000 },
      { service: 'Bridal Touchup',    date: 'Nov 22, 2025', staff: 'Ayesha', amount: 2500000 },
    ],
  },
  { id: 'cl4', name: 'Hadia Mahmood',  phone: '0301 9876 543', vip: false, lastVisit: 'May 17, 2026', visits: 7, whatsappOptIn: false,
    notes: 'Booked via Instagram DM. Prefers communication via call, not WhatsApp.',
    history: [
      { service: 'Highlights', date: 'May 17, 2026', staff: 'Sana', amount: 1200000 },
      { service: 'Toner',      date: 'Apr 03, 2026', staff: 'Sana', amount:  350000 },
    ],
  },
  { id: 'cl5', name: 'Komal Akhtar',   phone: '0311 5544 332', vip: false, lastVisit: 'May 17, 2026', visits: 4, whatsappOptIn: true,
    notes: 'Acne-prone, oily T-zone. Avoid heavy creams.',
    history: [
      { service: 'Hydrating Facial', date: 'May 17, 2026', staff: 'Hira', amount: 550000 },
      { service: 'Hydrating Facial', date: 'Apr 19, 2026', staff: 'Hira', amount: 550000 },
    ],
  },
  { id: 'cl6', name: 'Aisha Raza',     phone: '0302 8899 776', vip: true,  lastVisit: 'May 17, 2026', visits: 11, whatsappOptIn: true,
    notes: 'Bride — wedding May 20. Final trial today. Photos already sent.',
    history: [
      { service: 'Bridal Makeup',       date: 'May 17, 2026', staff: 'Hira', amount: 3500000 },
      { service: 'Bridal Makeup Trial', date: 'May 10, 2026', staff: 'Hira', amount: 1800000 },
      { service: 'Facial — Glow',       date: 'Apr 28, 2026', staff: 'Hira', amount:  750000 },
    ],
  },
  { id: 'cl7', name: 'Bushra Mehmood', phone: '0312 3344 556', vip: false, lastVisit: 'May 17, 2026', visits: 6, whatsappOptIn: true,
    notes: 'Likes nude / OPI pale pink. Filing — almond shape.',
    history: [
      { service: 'Mani + Pedi', date: 'May 17, 2026', staff: 'Zoya', amount: 550000 },
      { service: 'Gel Mani',    date: 'Apr 25, 2026', staff: 'Zoya', amount: 350000 },
    ],
  },
  { id: 'cl8', name: 'Nida Faisal',    phone: '0345 7788 990', vip: false, lastVisit: 'May 17, 2026', visits: 2, whatsappOptIn: true,
    notes: '',
    history: [
      { service: 'Balayage', date: 'May 17, 2026', staff: 'Sana', amount: 1400000 },
    ],
  },
];

export const SERVICES: ServiceItem[] = [
  { name: 'Cut + Blow Dry',      price:  450000, dur: 1.5 },
  { name: 'Haircut',             price:  250000, dur: 1.0 },
  { name: 'Global Color',        price:  850000, dur: 2.0 },
  { name: 'Highlights',          price: 1200000, dur: 2.5 },
  { name: 'Balayage',            price: 1400000, dur: 2.5 },
  { name: 'Keratin Treatment',   price: 1500000, dur: 2.5 },
  { name: 'Hydrating Facial',    price:  550000, dur: 1.0 },
  { name: 'Threading',           price:   80000, dur: 0.25 },
  { name: 'Brow Wax',            price:  120000, dur: 0.5 },
  { name: 'Mani + Pedi',         price:  550000, dur: 1.5 },
  { name: 'Gel Manicure',        price:  350000, dur: 1.0 },
  { name: 'Pedicure Deluxe',     price:  400000, dur: 1.0 },
  { name: 'Bridal Makeup Trial', price: 1800000, dur: 2.0 },
  { name: 'Bridal Makeup',       price: 3500000, dur: 4.0 },
];
