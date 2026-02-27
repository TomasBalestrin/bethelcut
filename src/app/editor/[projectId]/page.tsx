'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEditorStore } from '@/stores/useEditorStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { EditorLayout } from '@/components/editor/EditorLayout';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { Project, MediaAsset } from '@/types/project';
import type { AspectRatioKey } from '@/lib/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const setProjectIdStore = useEditorStore((s) => s.setProjectId);
  const setAspectRatio = useEditorStore((s) => s.setAspectRatio);
  const setDurationMs = useEditorStore((s) => s.setDurationMs);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setMediaAssets = useProjectStore((s) => s.setMediaAssets);
  const setTracks = useTimelineStore((s) => s.setTracks);

  useEffect(() => {
    const loadProject = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (projectError || !project) {
          setError('Projeto não encontrado');
          return;
        }

        const p = project as any;
        const mappedProject: Project = {
          id: p.id,
          userId: p.user_id,
          name: p.name,
          description: p.description,
          aspectRatio: p.aspect_ratio as AspectRatioKey,
          resolutionWidth: p.resolution_width,
          resolutionHeight: p.resolution_height,
          fps: p.fps,
          durationMs: p.duration_ms,
          thumbnailUrl: p.thumbnail_url,
          status: p.status,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        };

        setCurrentProject(mappedProject);
        setProjectIdStore(p.id);
        setAspectRatio(p.aspect_ratio as AspectRatioKey);
        setDurationMs(p.duration_ms);

        // Load media assets
        const { data: assets } = await supabase
          .from('media_assets')
          .select('*')
          .eq('project_id', projectId);

        if (assets && assets.length > 0) {
          const mapped: MediaAsset[] = (assets as any[]).map((a) => ({
            id: a.id,
            projectId: a.project_id,
            userId: a.user_id,
            type: a.type,
            fileName: a.file_name,
            fileUrl: a.file_url,
            fileSizeBytes: a.file_size_bytes,
            mimeType: a.mime_type,
            durationMs: a.duration_ms,
            width: a.width,
            height: a.height,
            fps: a.fps,
            waveformData: a.waveform_data,
            thumbnailUrl: a.thumbnail_url,
            createdAt: a.created_at,
          }));
          setMediaAssets(mapped);
        }

        // Load timeline tracks
        const { data: tracksData } = await supabase
          .from('timeline_tracks')
          .select('*')
          .eq('project_id', projectId)
          .order('order_index');

        if (tracksData && tracksData.length > 0) {
          const trackIds = (tracksData as any[]).map((t) => t.id);
          const { data: clipsData } = await supabase
            .from('timeline_clips')
            .select('*')
            .in('track_id', trackIds);

          const clips = (clipsData || []) as any[];

          setTracks(
            (tracksData as any[]).map((t) => ({
              id: t.id,
              projectId: t.project_id,
              type: t.type,
              label: t.label || t.type,
              orderIndex: t.order_index,
              isLocked: t.is_locked,
              isMuted: t.is_muted,
              isHidden: t.is_hidden,
              height: t.height,
              clips: clips
                .filter((c) => c.track_id === t.id)
                .map((c) => ({
                  id: c.id,
                  trackId: c.track_id,
                  assetId: c.asset_id,
                  clipType: c.clip_type,
                  startTimeMs: c.start_time_ms,
                  endTimeMs: c.end_time_ms,
                  sourceInMs: c.source_in_ms,
                  sourceOutMs: c.source_out_ms,
                  properties: c.properties || {},
                  orderIndex: c.order_index,
                })),
            }))
          );
        } else {
          // Auto-create default tracks if none exist
          const defaultTracks = [
            { type: 'video', label: 'Video', order_index: 0 },
            { type: 'audio', label: 'Audio', order_index: 1 },
            { type: 'caption', label: 'Legendas', order_index: 2 },
          ];

          const { data: newTracks } = await supabase
            .from('timeline_tracks')
            .insert(
              defaultTracks.map((t) => ({
                project_id: projectId,
                type: t.type,
                label: t.label,
                order_index: t.order_index,
                height: 60,
              }))
            )
            .select();

          if (newTracks && newTracks.length > 0) {
            setTracks(
              (newTracks as any[]).map((t) => ({
                id: t.id,
                projectId: t.project_id,
                type: t.type,
                label: t.label || t.type,
                orderIndex: t.order_index,
                isLocked: t.is_locked,
                isMuted: t.is_muted,
                isHidden: t.is_hidden,
                height: t.height,
                clips: [],
              }))
            );
          }
        }

        setIsLoading(false);
      } catch {
        setError('Erro ao carregar o projeto');
        setIsLoading(false);
      }
    };

    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-text-secondary text-sm">Carregando editor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <p className="text-accent-danger text-lg mb-4">{error}</p>
          <button
            onClick={() => router.push('/projects')}
            className="text-accent-primary hover:underline"
          >
            Voltar aos projetos
          </button>
        </div>
      </div>
    );
  }

  return <EditorLayout />;
}
