import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

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

    // Get the media asset URL
    const { data: asset, error: assetError } = await supabase
      .from('media_assets')
      .select('file_url, file_name')
      .eq('id', assetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json(
        { error: 'Asset não encontrado' },
        { status: 404 }
      );
    }

    // Create transcription record as processing
    const { data: transcription, error: dbError } = await supabase
      .from('transcriptions')
      .insert({
        asset_id: assetId,
        project_id: projectId,
        language,
        status: 'processing',
        provider: 'whisper',
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // Download the video/audio file
    const fileResponse = await fetch(asset.file_url);
    if (!fileResponse.ok) {
      await supabase
        .from('transcriptions')
        .update({ status: 'failed', error_message: 'Falha ao baixar o arquivo' })
        .eq('id', transcription.id);
      return NextResponse.json(
        { error: 'Falha ao baixar o arquivo de mídia' },
        { status: 500 }
      );
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    const fileName = asset.file_name || 'audio.mp4';

    // Call OpenAI Whisper API
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const startTime = Date.now();

    const file = new File([fileBuffer], fileName, {
      type: 'audio/mp4',
    });

    const whisperResponse = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language,
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
    });

    const processingTimeMs = Date.now() - startTime;

    // Extract words with timestamps
    const words = (whisperResponse.words || []).map((w) => ({
      word: w.word,
      startMs: Math.round(w.start * 1000),
      endMs: Math.round(w.end * 1000),
      confidence: 1.0,
    }));

    // Extract segments
    const segments = (whisperResponse.segments || []).map((s) => ({
      startMs: Math.round(s.start * 1000),
      endMs: Math.round(s.end * 1000),
      text: s.text.trim(),
      confidence: s.avg_logprob ? Math.exp(s.avg_logprob) : 0.9,
    }));

    // Update transcription record with results
    const { error: updateError } = await supabase
      .from('transcriptions')
      .update({
        status: 'completed',
        full_text: whisperResponse.text,
        words,
        segments,
        processing_time_ms: processingTimeMs,
      })
      .eq('id', transcription.id);

    if (updateError) {
      console.error('Failed to update transcription:', updateError);
    }

    return NextResponse.json({
      transcription: {
        id: transcription.id,
        status: 'completed',
        fullText: whisperResponse.text,
        words,
        segments,
        processingTimeMs,
      },
    });
  } catch (err) {
    console.error('Transcription error:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}
