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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;

    if (!file || !projectId) {
      return NextResponse.json(
        { error: 'Arquivo e projectId são obrigatórios' },
        { status: 400 }
      );
    }

    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${projectId}/${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(filePath, file);

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);

    let mediaType: 'video' | 'audio' | 'image' = 'video';
    if (file.type.startsWith('audio/')) mediaType = 'audio';
    if (file.type.startsWith('image/')) mediaType = 'image';

    const { data: asset, error: dbError } = await supabase
      .from('media_assets')
      .insert({
        project_id: projectId,
        user_id: user.id,
        type: mediaType,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size_bytes: file.size,
        mime_type: file.type,
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ asset });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
