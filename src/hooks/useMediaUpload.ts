'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore } from '@/stores/useProjectStore';
import type { UploadProgress } from '@/types/editor';

export function useMediaUpload() {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const currentProject = useProjectStore((s) => s.currentProject);
  const addMediaAsset = useProjectStore((s) => s.addMediaAsset);
  const supabase = createClient();

  const uploadFile = useCallback(
    async (file: File) => {
      if (!currentProject) return;

      const uploadId = file.name;
      setUploads((prev) => [
        ...prev,
        { fileName: file.name, progress: 0, status: 'uploading' },
      ]);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) throw new Error('Not authenticated');

        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/${currentProject.id}/${crypto.randomUUID()}.${fileExt}`;

        setUploads((prev) =>
          prev.map((u) =>
            u.fileName === uploadId ? { ...u, progress: 30 } : u
          )
        );

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        setUploads((prev) =>
          prev.map((u) =>
            u.fileName === uploadId
              ? { ...u, progress: 70, status: 'processing' }
              : u
          )
        );

        const { data: urlData } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        let mediaType: 'video' | 'audio' | 'image' = 'video';
        if (file.type.startsWith('audio/')) mediaType = 'audio';
        if (file.type.startsWith('image/')) mediaType = 'image';

        const { data: asset, error: insertError } = await supabase
          .from('media_assets')
          .insert({
            project_id: currentProject.id,
            user_id: user.id,
            type: mediaType,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_size_bytes: file.size,
            mime_type: file.type,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        if (asset) {
          addMediaAsset({
            id: asset.id,
            projectId: asset.project_id,
            userId: asset.user_id,
            type: asset.type as 'video' | 'audio' | 'image',
            fileName: asset.file_name,
            fileUrl: asset.file_url,
            fileSizeBytes: asset.file_size_bytes,
            mimeType: asset.mime_type,
            durationMs: asset.duration_ms,
            width: asset.width,
            height: asset.height,
            fps: asset.fps,
            waveformData: null,
            thumbnailUrl: asset.thumbnail_url,
            createdAt: asset.created_at,
          });
        }

        setUploads((prev) =>
          prev.map((u) =>
            u.fileName === uploadId
              ? { ...u, progress: 100, status: 'complete' }
              : u
          )
        );
      } catch (err) {
        setUploads((prev) =>
          prev.map((u) =>
            u.fileName === uploadId
              ? {
                  ...u,
                  status: 'error',
                  error:
                    err instanceof Error ? err.message : 'Upload failed',
                }
              : u
          )
        );
      }
    },
    [currentProject, supabase, addMediaAsset]
  );

  return { uploads, uploadFile };
}
