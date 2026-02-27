'use client';

import { useState, useRef } from 'react';
import {
  Upload,
  Video,
  Music,
  Image,
  Subtitles,
  Scissors,
  Sparkles,
  FileVideo,
  Trash2,
  Plus,
} from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { createClient } from '@/lib/supabase/client';
import { formatFileSize, formatDuration } from '@/lib/utils';
import type { MediaAsset } from '@/types/project';

function getMediaDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement(
      file.type.startsWith('audio/') ? 'audio' : 'video'
    );
    el.preload = 'metadata';
    const url = URL.createObjectURL(file);
    el.onloadedmetadata = () => {
      const ms = Math.round(el.duration * 1000);
      URL.revokeObjectURL(url);
      resolve(ms > 0 && Number.isFinite(ms) ? ms : 30000);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(30000);
    };
    el.src = url;
  });
}

type TabId = 'media' | 'captions' | 'silence' | 'effects';

const tabs: { id: TabId; label: string; icon: typeof Video }[] = [
  { id: 'media', label: 'Mídia', icon: Video },
  { id: 'captions', label: 'Legendas', icon: Subtitles },
  { id: 'silence', label: 'Silêncio', icon: Scissors },
  { id: 'effects', label: 'Efeitos', icon: Sparkles },
];

export function MediaPanel() {
  const activeTab = useEditorStore((s) => s.activeTab);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const mediaAssets = useProjectStore((s) => s.mediaAssets);
  const addMediaAsset = useProjectStore((s) => s.addMediaAsset);
  const removeMediaAsset = useProjectStore((s) => s.removeMediaAsset);
  const currentProject = useProjectStore((s) => s.currentProject);
  const tracks = useTimelineStore((s) => s.tracks);
  const addClip = useTimelineStore((s) => s.addClip);
  const setDurationMs = useEditorStore((s) => s.setDurationMs);
  const durationMs = useEditorStore((s) => s.durationMs);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const addAssetToTimeline = async (asset: MediaAsset) => {
    // Find the right track based on asset type
    const trackType = asset.type === 'audio' ? 'audio' : 'video';
    const track = tracks.find((t) => t.type === trackType);
    if (!track) return;

    // Calculate start position (end of last clip on track, or 0)
    const lastClip = track.clips.length > 0
      ? track.clips.reduce((max, c) => c.endTimeMs > max.endTimeMs ? c : max, track.clips[0])
      : null;
    const startTimeMs = lastClip ? lastClip.endTimeMs : 0;

    // Use asset duration or default to 30s
    const clipDuration = asset.durationMs || 30000;
    const endTimeMs = startTimeMs + clipDuration;

    // Persist clip to database
    const { data: clipData, error } = await supabase
      .from('timeline_clips')
      .insert({
        track_id: track.id,
        asset_id: asset.id,
        clip_type: trackType,
        start_time_ms: startTimeMs,
        end_time_ms: endTimeMs,
        source_in_ms: 0,
        source_out_ms: clipDuration,
        properties: {},
        order_index: track.clips.length,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding clip to timeline:', error);
      return;
    }

    if (clipData) {
      // Add clip to timeline store
      addClip(track.id, {
        id: clipData.id,
        trackId: track.id,
        assetId: asset.id,
        clipType: trackType,
        startTimeMs,
        endTimeMs,
        sourceInMs: 0,
        sourceOutMs: clipDuration,
        properties: {},
        orderIndex: track.clips.length,
      });

      // Update project duration if needed
      if (endTimeMs > durationMs) {
        setDurationMs(endTimeMs);
        await supabase
          .from('projects')
          .update({ duration_ms: endTimeMs })
          .eq('id', asset.projectId);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files[0] || !currentProject) return;

    const file = files[0];
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${currentProject.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setUploadProgress(70);

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

      setUploadProgress(100);

      // Extract real duration from local file
      let fileDurationMs: number | null = null;
      if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
        fileDurationMs = await getMediaDuration(file);
        // Update the media_asset record with real duration
        if (fileDurationMs && asset) {
          await supabase
            .from('media_assets')
            .update({ duration_ms: fileDurationMs })
            .eq('id', asset.id);
        }
      }

      if (asset) {
        const newAsset: MediaAsset = {
          id: asset.id,
          projectId: asset.project_id,
          userId: asset.user_id,
          type: asset.type as 'video' | 'audio' | 'image',
          fileName: asset.file_name,
          fileUrl: asset.file_url,
          fileSizeBytes: asset.file_size_bytes,
          mimeType: asset.mime_type,
          durationMs: fileDurationMs || asset.duration_ms,
          width: asset.width,
          height: asset.height,
          fps: asset.fps,
          waveformData: null,
          thumbnailUrl: asset.thumbnail_url,
          createdAt: asset.created_at,
        };
        addMediaAsset(newAsset);

        // Auto-add to timeline after upload
        await addAssetToTimeline(newAsset);
      }
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    try {
      await supabase.from('media_assets').delete().eq('id', assetId);
      removeMediaAsset(assetId);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return FileVideo;
      case 'audio':
        return Music;
      case 'image':
        return Image;
      default:
        return FileVideo;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-border-default/60">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors ${
              activeTab === tab.id
                ? 'text-accent-primary border-b border-accent-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'media' && (
          <div className="space-y-3">
            {/* Upload Area */}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*,image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full flex flex-col items-center gap-2 p-5 rounded-md border border-dashed border-border-default/60 hover:border-accent-primary/30 bg-bg-surface/30 hover:bg-bg-surface/50 transition-colors"
            >
              <Upload
                size={20}
                className="text-text-muted"
              />
              <span className="text-xs text-text-secondary">
                {isUploading
                  ? `Enviando... ${uploadProgress}%`
                  : 'Importar mídia'}
              </span>
              <span className="text-[10px] text-text-muted">
                Vídeo, áudio ou imagem
              </span>
            </button>

            {isUploading && (
              <div className="w-full h-1 bg-bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-primary rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {/* Asset List */}
            <div className="space-y-1">
              {mediaAssets.map((asset) => {
                const Icon = getTypeIcon(asset.type);
                return (
                  <div
                    key={asset.id}
                    onClick={() => addAssetToTimeline(asset)}
                    className="group flex items-center gap-2.5 p-2 rounded-md hover:bg-bg-hover transition-colors cursor-pointer"
                    title="Clique para adicionar à timeline"
                  >
                    <div className="w-9 h-9 rounded-md bg-bg-surface flex items-center justify-center flex-shrink-0 border border-border-default/40">
                      {asset.thumbnailUrl ? (
                        <img
                          src={asset.thumbnailUrl}
                          alt={asset.fileName}
                          className="w-full h-full object-cover rounded-md"
                        />
                      ) : (
                        <Icon size={16} className="text-text-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate text-text-primary">
                        {asset.fileName}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {asset.fileSizeBytes
                          ? formatFileSize(asset.fileSizeBytes)
                          : '--'}
                        {asset.durationMs
                          ? ` · ${formatDuration(asset.durationMs)}`
                          : ''}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addAssetToTimeline(asset);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-accent-primary/10 text-text-muted hover:text-accent-primary transition-all"
                      title="Adicionar à timeline"
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAsset(asset.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-accent-danger/10 text-text-muted hover:text-accent-danger transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>

            {mediaAssets.length === 0 && !isUploading && (
              <p className="text-center text-[11px] text-text-muted py-8 leading-relaxed">
                Nenhuma mídia importada ainda.
                <br />
                Arraste um arquivo ou clique para importar.
              </p>
            )}
          </div>
        )}

        {activeTab === 'captions' && (
          <div className="text-center py-8">
            <Subtitles size={28} className="text-text-muted/40 mx-auto mb-3" />
            <p className="text-xs text-text-secondary">Legendas</p>
            <p className="text-[10px] text-text-muted mt-1">
              Importe um vídeo para gerar legendas automáticas
            </p>
          </div>
        )}

        {activeTab === 'silence' && (
          <div className="text-center py-8">
            <Scissors size={28} className="text-text-muted/40 mx-auto mb-3" />
            <p className="text-xs text-text-secondary">Corte de Silêncio</p>
            <p className="text-[10px] text-text-muted mt-1">
              Importe um vídeo para detectar e remover silêncios
            </p>
          </div>
        )}

        {activeTab === 'effects' && (
          <div className="text-center py-8">
            <Sparkles size={28} className="text-text-muted/40 mx-auto mb-3" />
            <p className="text-xs text-text-secondary">Efeitos</p>
            <p className="text-[10px] text-text-muted mt-1">Em breve</p>
          </div>
        )}
      </div>
    </div>
  );
}
