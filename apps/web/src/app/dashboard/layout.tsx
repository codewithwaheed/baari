import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const STEP_ROUTES = ['/onboarding/salon', '/onboarding/services', '/onboarding/hours'] as const;
const API_URL = process.env['API_URL'] ?? 'http://localhost:3001';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const token = jar.get('baari_token');
  if (!token) redirect('/login');

  try {
    const res = await fetch(`${API_URL}/api/v1/me`, {
      headers: { Cookie: `baari_token=${token.value}` },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.tenant && !data.tenant.onboardingComplete) {
        const step: number = data.tenant.onboardingStep ?? 0;
        redirect(STEP_ROUTES[step] ?? '/onboarding/salon');
      }
    }
  } catch {
    // If API unreachable, let the page render — the page itself will show an error state
  }

  return <>{children}</>;
}
