// apps/web/src/components/dashboard/index.ts

export { Icon, DButton, StatusBadge, Avatar, IconButton, Eyebrow, Pill, fmtPKR, fmtPKRRaw, fmtTime, fmtTimeRange, STATUS_STYLES } from './primitives';
export type { BookingStatus } from './primitives';

export { Sidebar } from './Sidebar';
export { BottomNav } from './BottomNav';
export { Topbar } from './Topbar';
export { BottomSheet } from './BottomSheet';
export { StaffPillRow } from './StaffPillRow';
export { AppointmentCard } from './AppointmentCard';
export { Calendar } from './Calendar';
export { AppointmentPanel, AppointmentPanelEmpty } from './AppointmentPanel';
export { POSPanel } from './POSPanel';
export { RequestsView } from './RequestsView';
export { ClientsView } from './ClientsView';
export { NewBookingModal } from './NewBookingModal';
export { ComingSoon, SettingsStub } from './ComingSoon';

export type { NavId, Staff, Appointment, BookingRequest, Client, ServiceItem } from './data';
export { STAFF, SERVICES, SEED_APPTS, SEED_REQUESTS, SEED_CLIENTS } from './data';
