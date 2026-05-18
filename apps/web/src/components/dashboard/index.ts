// apps/web/src/components/dashboard/index.ts
// Dashboard components — build these in order.
// All implementations should import from ./primitives for shared UI.
// Reference: design system prototype at packages/db/../../../design_extracted/salon-design-system/project/salon_mvp/
//
// BUILD ORDER:
//   1. Sidebar.tsx
//   2. Topbar.tsx
//   3. AppointmentCard.tsx
//   4. Calendar.tsx
//   5. AppointmentPanel.tsx
//   6. POSPanel.tsx
//   7. RequestsView.tsx
//   8. ClientsView.tsx
//   9. NewBookingModal.tsx
//  10. ComingSoon.tsx

export { Icon, DButton, StatusBadge, Avatar, IconButton, Eyebrow, Pill, fmtPKR, fmtPKRRaw, fmtTime, fmtTimeRange, STATUS_STYLES } from './primitives';

// TODO: export from each component as they are built:
// export { Sidebar } from './Sidebar';
// export { Topbar } from './Topbar';
// export { Calendar } from './Calendar';
// export { AppointmentCard } from './AppointmentCard';
// export { AppointmentPanel, AppointmentPanelEmpty } from './AppointmentPanel';
// export { POSPanel } from './POSPanel';
// export { RequestsView } from './RequestsView';
// export { ClientsView } from './ClientsView';
// export { NewBookingModal } from './NewBookingModal';
// export { ComingSoon, SettingsStub } from './ComingSoon';
