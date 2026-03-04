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

    // Parse FormData (audio WAV blob extracted client-side + metadata)
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const assetId = formData.get('assetId') as string | null;
    const projectId = formData.get('projectId') as string | null;
    const language = (formData.get('language') as string) || 'pt';

    if (!audioFile || !assetId || !projectId) {
      return NextResponse.json(
        { error: 'audio, assetId e projectId são obrigatórios' },
        { status: 400 }
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

    // Call OpenAI Whisper API with the pre-extracted WAV audio
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const startTime = Date.now();

    const whisperResponse = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
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
