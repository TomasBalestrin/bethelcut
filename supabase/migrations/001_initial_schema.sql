-- ============================================
-- BETHEL STUDIO - Schema Inicial
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  usage_minutes_used INTEGER DEFAULT 0,
  usage_minutes_limit INTEGER DEFAULT 300,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJECTS
-- ============================================
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Projeto sem título',
  description TEXT,
  aspect_ratio TEXT NOT NULL DEFAULT '16:9' CHECK (aspect_ratio IN ('16:9', '9:16', '1:1', '4:5', '4:3', '21:9')),
  resolution_width INTEGER DEFAULT 1920,
  resolution_height INTEGER DEFAULT 1080,
  fps INTEGER DEFAULT 30 CHECK (fps IN (24, 30, 60)),
  duration_ms INTEGER DEFAULT 0,
  thumbnail_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'ready', 'exported', 'archived')),
  editor_state JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MEDIA ASSETS
-- ============================================
CREATE TABLE public.media_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('video', 'audio', 'image')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  duration_ms INTEGER,
  width INTEGER,
  height INTEGER,
  fps REAL,
  waveform_data JSONB,
  thumbnail_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TIMELINE TRACKS
-- ============================================
CREATE TABLE public.timeline_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('video', 'audio', 'caption', 'effect')),
  label TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_locked BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  height INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TIMELINE CLIPS
-- ============================================
CREATE TABLE public.timeline_clips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id UUID NOT NULL REFERENCES public.timeline_tracks(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
  clip_type TEXT NOT NULL CHECK (clip_type IN ('video', 'audio', 'caption', 'effect', 'silence_marker')),
  start_time_ms INTEGER NOT NULL DEFAULT 0,
  end_time_ms INTEGER NOT NULL DEFAULT 0,
  source_in_ms INTEGER DEFAULT 0,
  source_out_ms INTEGER DEFAULT 0,
  properties JSONB DEFAULT '{}',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRANSCRIPTIONS
-- ============================================
CREATE TABLE public.transcriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'pt',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  provider TEXT DEFAULT 'whisper' CHECK (provider IN ('whisper', 'deepgram', 'assemblyai')),
  full_text TEXT,
  segments JSONB DEFAULT '[]',
  words JSONB DEFAULT '[]',
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CAPTIONS
-- ============================================
CREATE TABLE public.captions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  transcription_id UUID REFERENCES public.transcriptions(id) ON DELETE SET NULL,
  clip_id UUID REFERENCES public.timeline_clips(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  start_time_ms INTEGER NOT NULL,
  end_time_ms INTEGER NOT NULL,
  position_x_pct REAL DEFAULT 50.0,
  position_y_pct REAL DEFAULT 85.0,
  max_width_pct REAL DEFAULT 80.0,
  style JSONB DEFAULT '{
    "fontFamily": "Inter",
    "fontSize": 4.5,
    "fontSizeUnit": "vw",
    "fontWeight": "bold",
    "color": "#FFFFFF",
    "backgroundColor": "rgba(0,0,0,0.6)",
    "backgroundPadding": 8,
    "borderRadius": 4,
    "strokeColor": "#000000",
    "strokeWidth": 0,
    "shadowColor": "rgba(0,0,0,0.5)",
    "shadowBlur": 4,
    "shadowOffsetX": 2,
    "shadowOffsetY": 2,
    "textAlign": "center",
    "maxLines": 2,
    "animation": "none",
    "highlightColor": "#FFD700",
    "highlightActive": false
  }',
  highlighted_words JSONB DEFAULT '[]',
  word_timings JSONB DEFAULT '[]',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CAPTION STYLE PRESETS
-- ============================================
CREATE TABLE public.caption_style_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'custom' CHECK (category IN ('system', 'trending', 'minimal', 'bold', 'custom')),
  style JSONB NOT NULL,
  thumbnail_url TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EXPORT JOBS
-- ============================================
CREATE TABLE public.export_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  settings JSONB NOT NULL DEFAULT '{
    "format": "mp4",
    "codec": "h264",
    "resolution": "1080p",
    "fps": 30,
    "quality": "high",
    "include_captions": true,
    "export_srt": false
  }',
  progress INTEGER DEFAULT 0,
  output_url TEXT,
  file_size_bytes BIGINT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SILENCE DETECTION RESULTS
-- ============================================
CREATE TABLE public.silence_detections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{
    "threshold_db": -35,
    "min_duration_ms": 500,
    "padding_ms": 150,
    "remove_filler_words": false,
    "filler_words_list": ["um", "é", "tipo", "né", "ah", "eh"],
    "cut_mode": "remove"
  }',
  silence_regions JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_media_assets_project_id ON public.media_assets(project_id);
CREATE INDEX idx_timeline_tracks_project_id ON public.timeline_tracks(project_id);
CREATE INDEX idx_timeline_clips_track_id ON public.timeline_clips(track_id);
CREATE INDEX idx_captions_project_id ON public.captions(project_id);
CREATE INDEX idx_transcriptions_asset_id ON public.transcriptions(asset_id);
CREATE INDEX idx_export_jobs_project_id ON public.export_jobs(project_id);
CREATE INDEX idx_silence_detections_project_id ON public.silence_detections(project_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caption_style_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.silence_detections ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Projects
CREATE POLICY "Users can CRUD own projects" ON public.projects FOR ALL USING (auth.uid() = user_id);

-- Media assets
CREATE POLICY "Users can CRUD own media" ON public.media_assets FOR ALL USING (auth.uid() = user_id);

-- Timeline tracks
CREATE POLICY "Users can CRUD own tracks" ON public.timeline_tracks FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid()));

-- Timeline clips
CREATE POLICY "Users can CRUD own clips" ON public.timeline_clips FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.timeline_tracks t
    JOIN public.projects p ON t.project_id = p.id
    WHERE t.id = track_id AND p.user_id = auth.uid()
  ));

-- Transcriptions
CREATE POLICY "Users can CRUD own transcriptions" ON public.transcriptions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid()));

-- Captions
CREATE POLICY "Users can CRUD own captions" ON public.captions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid()));

-- Caption presets
CREATE POLICY "Users can view system and own presets" ON public.caption_style_presets FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users can manage own presets" ON public.caption_style_presets FOR ALL
  USING (user_id = auth.uid());

-- Export jobs
CREATE POLICY "Users can CRUD own exports" ON public.export_jobs FOR ALL USING (auth.uid() = user_id);

-- Silence detections
CREATE POLICY "Users can CRUD own detections" ON public.silence_detections FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid()));

-- ============================================
-- TRIGGER: auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TRIGGER: auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_clips_updated_at BEFORE UPDATE ON public.timeline_clips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_captions_updated_at BEFORE UPDATE ON public.captions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_transcriptions_updated_at BEFORE UPDATE ON public.transcriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- STORAGE BUCKETS
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('exports', 'exports', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true);

-- Storage policies
CREATE POLICY "Users can upload media" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own media" ON storage.objects FOR SELECT
  USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own media" ON storage.objects FOR DELETE
  USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Public read exports" ON storage.objects FOR SELECT USING (bucket_id = 'exports');
CREATE POLICY "Public read thumbnails" ON storage.objects FOR SELECT USING (bucket_id = 'thumbnails');
