import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const token = jar.get('baari_token');
  if (!token) redirect('/login');
  return <>{children}</>;
}
