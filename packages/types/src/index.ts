// packages/types/src/index.ts
// Shared TypeScript types — no runtime deps, safe to import anywhere.

// ─── JWT payload ──────────────────────────────────────────────────────────────
export interface JWTPayload {
  sub: string;         // user_id
  tid: string;         // tenant_id — THE only authoritative tenant identifier
  role: 'owner' | 'manager' | 'staff';
  loc: string[];       // location_ids this user can access
  iat: number;
  exp: number;
}

// ─── API response shapes ──────────────────────────────────────────────────────
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Booking ──────────────────────────────────────────────────────────────────
export type BookingState =
  | 'INITIATED' | 'PAYMENT_PENDING' | 'CONFIRMED'
  | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'EXPIRED';

export type BookingSource = 'manual' | 'whatsapp' | 'web';

// Dashboard appointment shape (UI-friendly, not raw DB row)
export interface AppointmentView {
  id: string;
  staffId: string;
  staffName: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  startHour: number;   // decimal hour, e.g. 10.5 = 10:30am
  endHour: number;
  status: 'confirmed' | 'checkedIn' | 'pendingPayment' | 'completed' | 'noShow';
  pricePkr: number;    // PKR (not paisa) for display
  source: BookingSource;
  notes: string;
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────
export interface WAInboundMessage {
  tenantId: string;
  phoneNumberId: string;
  from: string;        // customer phone E.164
  messageId: string;
  type: 'text' | 'interactive' | 'button' | 'flow_reply';
  text?: string;
  flowPayload?: Record<string, unknown>;
  timestamp: number;
}

// WhatsApp Flow booking data (collected by the multi-screen flow)
export interface FlowBookingPayload {
  serviceId: string;
  staffId: string;
  date: string;        // YYYY-MM-DD
  timeSlot: string;    // HH:MM (24-hr)
  customerName: string;
  customerPhone: string;
}

// ─── Payments ─────────────────────────────────────────────────────────────────
export type PaymentGateway = 'jazzcash' | 'easypaisa' | 'raast' | 'card' | 'cash' | 'safepay';

export interface PaymentResult {
  success: boolean;
  txnRef: string;
  gateway: PaymentGateway;
  amountPaisa: number;
  rawResponse: unknown;
}

// JazzCash IPN payload (subset of fields)
export interface JazzCashIPN {
  pp_TxnRefNo: string;
  pp_ResponseCode: string;   // '000' = success
  pp_Amount: string;
  pp_MerchantID: string;
  pp_SecureHash: string;
  [key: string]: string;
}

// ─── Tenant ───────────────────────────────────────────────────────────────────
export type TenantPlan = 'free' | 'pro' | 'business' | 'enterprise';

export interface TenantPublic {
  id: string;
  slug: string;
  name: string;
  plan: TenantPlan;
}
