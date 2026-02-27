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
    const { assetId, projectId, language = 'pt' } = body;

    if (!assetId || !projectId) {
      return NextResponse.json(
        { error: 'assetId e projectId são obrigatórios' },
        { status: 400 }
      );
    }

    // Create transcription record
    const { data: transcription, error: dbError } = await supabase
      .from('transcriptions')
      .insert({
        asset_id: assetId,
        project_id: projectId,
        language,
        status: 'pending',
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // TODO: Integrate with Whisper API for actual transcription
    // For now, return the pending transcription

    return NextResponse.json({ transcription });
  } catch (err) {
    console.error('Transcription error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
