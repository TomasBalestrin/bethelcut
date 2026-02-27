export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          plan: 'free' | 'pro' | 'enterprise';
          usage_minutes_used: number;
          usage_minutes_limit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          plan?: 'free' | 'pro' | 'enterprise';
          usage_minutes_used?: number;
          usage_minutes_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          plan?: 'free' | 'pro' | 'enterprise';
          usage_minutes_used?: number;
          usage_minutes_limit?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          aspect_ratio: string;
          resolution_width: number;
          resolution_height: number;
          fps: number;
          duration_ms: number;
          thumbnail_url: string | null;
          status: 'draft' | 'processing' | 'ready' | 'exported' | 'archived';
          editor_state: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string;
          description?: string | null;
          aspect_ratio?: string;
          resolution_width?: number;
          resolution_height?: number;
          fps?: number;
          duration_ms?: number;
          thumbnail_url?: string | null;
          status?: 'draft' | 'processing' | 'ready' | 'exported' | 'archived';
          editor_state?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          name?: string;
          description?: string | null;
          aspect_ratio?: string;
          resolution_width?: number;
          resolution_height?: number;
          fps?: number;
          duration_ms?: number;
          thumbnail_url?: string | null;
          status?: 'draft' | 'processing' | 'ready' | 'exported' | 'archived';
          editor_state?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      media_assets: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          type: 'video' | 'audio' | 'image';
          file_name: string;
          file_url: string;
          file_size_bytes: number | null;
          mime_type: string | null;
          duration_ms: number | null;
          width: number | null;
          height: number | null;
          fps: number | null;
          waveform_data: Json | null;
          thumbnail_url: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          type: 'video' | 'audio' | 'image';
          file_name: string;
          file_url: string;
          file_size_bytes?: number | null;
          mime_type?: string | null;
          duration_ms?: number | null;
          width?: number | null;
          height?: number | null;
          fps?: number | null;
          waveform_data?: Json | null;
          thumbnail_url?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          project_id?: string;
          user_id?: string;
          type?: 'video' | 'audio' | 'image';
          file_name?: string;
          file_url?: string;
          file_size_bytes?: number | null;
          mime_type?: string | null;
          duration_ms?: number | null;
          width?: number | null;
          height?: number | null;
          fps?: number | null;
          waveform_data?: Json | null;
          thumbnail_url?: string | null;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'media_assets_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_assets_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      timeline_tracks: {
        Row: {
          id: string;
          project_id: string;
          type: 'video' | 'audio' | 'caption' | 'effect';
          label: string | null;
          order_index: number;
          is_locked: boolean;
          is_muted: boolean;
          is_hidden: boolean;
          height: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          type: 'video' | 'audio' | 'caption' | 'effect';
          label?: string | null;
          order_index?: number;
          is_locked?: boolean;
          is_muted?: boolean;
          is_hidden?: boolean;
          height?: number;
          created_at?: string;
        };
        Update: {
          project_id?: string;
          type?: 'video' | 'audio' | 'caption' | 'effect';
          label?: string | null;
          order_index?: number;
          is_locked?: boolean;
          is_muted?: boolean;
          is_hidden?: boolean;
          height?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'timeline_tracks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      timeline_clips: {
        Row: {
          id: string;
          track_id: string;
          asset_id: string | null;
          clip_type: 'video' | 'audio' | 'caption' | 'effect' | 'silence_marker';
          start_time_ms: number;
          end_time_ms: number;
          source_in_ms: number;
          source_out_ms: number;
          properties: Json;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          track_id: string;
          asset_id?: string | null;
          clip_type: 'video' | 'audio' | 'caption' | 'effect' | 'silence_marker';
          start_time_ms?: number;
          end_time_ms?: number;
          source_in_ms?: number;
          source_out_ms?: number;
          properties?: Json;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          track_id?: string;
          asset_id?: string | null;
          clip_type?: 'video' | 'audio' | 'caption' | 'effect' | 'silence_marker';
          start_time_ms?: number;
          end_time_ms?: number;
          source_in_ms?: number;
          source_out_ms?: number;
          properties?: Json;
          order_index?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'timeline_clips_track_id_fkey';
            columns: ['track_id'];
            isOneToOne: false;
            referencedRelation: 'timeline_tracks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_clips_asset_id_fkey';
            columns: ['asset_id'];
            isOneToOne: false;
            referencedRelation: 'media_assets';
            referencedColumns: ['id'];
          },
        ];
      };
      transcriptions: {
        Row: {
          id: string;
          asset_id: string;
          project_id: string;
          language: string;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          provider: 'whisper' | 'deepgram' | 'assemblyai';
          full_text: string | null;
          segments: Json;
          words: Json;
          error_message: string | null;
          processing_time_ms: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          project_id: string;
          language?: string;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          provider?: 'whisper' | 'deepgram' | 'assemblyai';
          full_text?: string | null;
          segments?: Json;
          words?: Json;
          error_message?: string | null;
          processing_time_ms?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          asset_id?: string;
          project_id?: string;
          language?: string;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          provider?: 'whisper' | 'deepgram' | 'assemblyai';
          full_text?: string | null;
          segments?: Json;
          words?: Json;
          error_message?: string | null;
          processing_time_ms?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'transcriptions_asset_id_fkey';
            columns: ['asset_id'];
            isOneToOne: false;
            referencedRelation: 'media_assets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transcriptions_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      captions: {
        Row: {
          id: string;
          project_id: string;
          transcription_id: string | null;
          clip_id: string | null;
          text: string;
          start_time_ms: number;
          end_time_ms: number;
          position_x_pct: number;
          position_y_pct: number;
          max_width_pct: number;
          style: Json;
          highlighted_words: Json;
          word_timings: Json;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          transcription_id?: string | null;
          clip_id?: string | null;
          text: string;
          start_time_ms: number;
          end_time_ms: number;
          position_x_pct?: number;
          position_y_pct?: number;
          max_width_pct?: number;
          style?: Json;
          highlighted_words?: Json;
          word_timings?: Json;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          project_id?: string;
          transcription_id?: string | null;
          clip_id?: string | null;
          text?: string;
          start_time_ms?: number;
          end_time_ms?: number;
          position_x_pct?: number;
          position_y_pct?: number;
          max_width_pct?: number;
          style?: Json;
          highlighted_words?: Json;
          word_timings?: Json;
          order_index?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'captions_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'captions_transcription_id_fkey';
            columns: ['transcription_id'];
            isOneToOne: false;
            referencedRelation: 'transcriptions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'captions_clip_id_fkey';
            columns: ['clip_id'];
            isOneToOne: false;
            referencedRelation: 'timeline_clips';
            referencedColumns: ['id'];
          },
        ];
      };
      caption_style_presets: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          category: 'system' | 'trending' | 'minimal' | 'bold' | 'custom';
          style: Json;
          thumbnail_url: string | null;
          is_public: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          category?: 'system' | 'trending' | 'minimal' | 'bold' | 'custom';
          style: Json;
          thumbnail_url?: string | null;
          is_public?: boolean;
          created_at?: string;
        };
        Update: {
          user_id?: string | null;
          name?: string;
          category?: 'system' | 'trending' | 'minimal' | 'bold' | 'custom';
          style?: Json;
          thumbnail_url?: string | null;
          is_public?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'caption_style_presets_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      export_jobs: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          status: 'queued' | 'processing' | 'completed' | 'failed';
          settings: Json;
          progress: number;
          output_url: string | null;
          file_size_bytes: number | null;
          error_message: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          status?: 'queued' | 'processing' | 'completed' | 'failed';
          settings?: Json;
          progress?: number;
          output_url?: string | null;
          file_size_bytes?: number | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          project_id?: string;
          user_id?: string;
          status?: 'queued' | 'processing' | 'completed' | 'failed';
          settings?: Json;
          progress?: number;
          output_url?: string | null;
          file_size_bytes?: number | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'export_jobs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'export_jobs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      silence_detections: {
        Row: {
          id: string;
          project_id: string;
          asset_id: string;
          settings: Json;
          silence_regions: Json;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          asset_id: string;
          settings?: Json;
          silence_regions?: Json;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          created_at?: string;
        };
        Update: {
          project_id?: string;
          asset_id?: string;
          settings?: Json;
          silence_regions?: Json;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
        };
        Relationships: [
          {
            foreignKeyName: 'silence_detections_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'silence_detections_asset_id_fkey';
            columns: ['asset_id'];
            isOneToOne: false;
            referencedRelation: 'media_assets';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
