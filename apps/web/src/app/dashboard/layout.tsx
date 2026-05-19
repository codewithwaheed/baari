import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  if (!jar.get('baari_token')) {
    redirect('/login');
  }
  return <>{children}</>;
}
