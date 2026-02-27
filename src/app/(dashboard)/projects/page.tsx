import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProjectList } from '@/components/shared/ProjectList';

export default async function ProjectsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-medium text-text-primary">Meus Projetos</h1>
          <p className="text-text-muted text-sm mt-1">
            Gerencie seus projetos de edição de vídeo
          </p>
        </div>
      </div>
      <ProjectList initialProjects={projects || []} userId={user.id} />
    </div>
  );
}
