import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Logo } from '@/components/shared/Logo';
import { DashboardNav } from '@/components/shared/DashboardNav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-bg-primary overflow-y-auto">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border-default bg-bg-primary/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="md" />
          <DashboardNav
            fullName={profile?.full_name ?? null}
            email={user.email || ''}
            avatarUrl={profile?.avatar_url ?? null}
          />
        </div>
      </nav>
      <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
