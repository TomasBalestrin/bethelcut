import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, settings } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId é obrigatório' },
        { status: 400 }
      );
    }

    // Create export job
    const { data: job, error: dbError } = await supabase
      .from('export_jobs')
      .insert({
        project_id: projectId,
        user_id: user.id,
        settings: settings || {},
        status: 'queued',
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // TODO: Trigger actual export processing

    return NextResponse.json({ job });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
