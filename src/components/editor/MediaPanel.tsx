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
} from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { createClient } from '@/lib/supabase/client';
import { formatFileSize, formatDuration } from '@/lib/utils';

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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

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

      // Upload to Supabase Storage
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

      // Determine media type
      let mediaType: 'video' | 'audio' | 'image' = 'video';
      if (file.type.startsWith('audio/')) mediaType = 'audio';
      if (file.type.startsWith('image/')) mediaType = 'image';

      // Insert media asset record
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
      <div className="flex border-b border-border-default">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs transition-colors ${
              activeTab === tab.id
                ? 'text-accent-primary border-b-2 border-accent-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <tab.icon size={16} />
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
              className="w-full flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-dashed border-border-default hover:border-accent-primary bg-bg-surface/50 hover:bg-bg-surface transition-colors"
            >
              <Upload
                size={24}
                className="text-text-muted"
              />
              <span className="text-sm text-text-secondary">
                {isUploading
                  ? `Enviando... ${uploadProgress}%`
                  : 'Importar mídia'}
              </span>
              <span className="text-xs text-text-muted">
                Vídeo, áudio ou imagem
              </span>
            </button>

            {isUploading && (
              <div className="w-full h-1.5 bg-bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-primary rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {/* Asset List */}
            <div className="space-y-2">
              {mediaAssets.map((asset) => {
                const Icon = getTypeIcon(asset.type);
                return (
                  <div
                    key={asset.id}
                    className="group flex items-center gap-3 p-2.5 rounded-lg bg-bg-surface hover:bg-bg-hover transition-colors cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded bg-bg-tertiary flex items-center justify-center flex-shrink-0">
                      {asset.thumbnailUrl ? (
                        <img
                          src={asset.thumbnailUrl}
                          alt={asset.fileName}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <Icon size={18} className="text-text-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {asset.fileName}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {asset.fileSizeBytes
                          ? formatFileSize(asset.fileSizeBytes)
                          : '--'}
                        {asset.durationMs
                          ? ` • ${formatDuration(asset.durationMs)}`
                          : ''}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAsset(asset.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-accent-danger/20 text-text-muted hover:text-accent-danger transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            {mediaAssets.length === 0 && !isUploading && (
              <p className="text-center text-xs text-text-muted py-8">
                Nenhuma mídia importada ainda.
                <br />
                Arraste um arquivo ou clique para importar.
              </p>
            )}
          </div>
        )}

        {activeTab === 'captions' && (
          <div className="text-center py-8">
            <Subtitles size={32} className="text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-secondary">Legendas</p>
            <p className="text-xs text-text-muted mt-1">
              Importe um vídeo para gerar legendas automáticas
            </p>
          </div>
        )}

        {activeTab === 'silence' && (
          <div className="text-center py-8">
            <Scissors size={32} className="text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-secondary">Corte de Silêncio</p>
            <p className="text-xs text-text-muted mt-1">
              Importe um vídeo para detectar e remover silêncios
            </p>
          </div>
        )}

        {activeTab === 'effects' && (
          <div className="text-center py-8">
            <Sparkles size={32} className="text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-secondary">Efeitos</p>
            <p className="text-xs text-text-muted mt-1">Em breve</p>
          </div>
        )}
      </div>
    </div>
  );
}
