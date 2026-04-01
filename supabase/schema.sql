-- Fishin' Buddy Database Schema
-- Run this in the Supabase SQL Editor

-- Waters: Bodies of water Harry fishes
CREATE TABLE IF NOT EXISTS waters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Spots: Specific bank positions within a Water
CREATE TABLE IF NOT EXISTS spots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  water_id UUID NOT NULL REFERENCES waters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lures: Photo + custom name, built organically from catch logs
CREATE TABLE IF NOT EXISTS lures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  catch_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Catches: The atomic unit of all data
CREATE TABLE IF NOT EXISTS catches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_id UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  water_id UUID NOT NULL REFERENCES waters(id) ON DELETE CASCADE,
  lure_id UUID NOT NULL REFERENCES lures(id) ON DELETE CASCADE,
  species TEXT NOT NULL,
  fish_photo_url TEXT,
  quantity INTEGER DEFAULT 1,
  notes TEXT,
  size_estimate TEXT,
  -- Weather data auto-captured at log time
  temperature_f DOUBLE PRECISION,
  cloud_cover TEXT,
  wind_speed_mph DOUBLE PRECISION,
  wind_direction TEXT,
  barometric_pressure DOUBLE PRECISION,
  precipitation TEXT,
  -- GPS coordinates at catch time
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  caught_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Skunk Logs: Sessions with no catch (failure data for recommendations)
CREATE TABLE IF NOT EXISTS skunk_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_id UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  water_id UUID NOT NULL REFERENCES waters(id) ON DELETE CASCADE,
  notes TEXT,
  lures_tried TEXT,
  -- Weather data auto-captured
  temperature_f DOUBLE PRECISION,
  cloud_cover TEXT,
  wind_speed_mph DOUBLE PRECISION,
  wind_direction TEXT,
  barometric_pressure DOUBLE PRECISION,
  precipitation TEXT,
  logged_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_waters_user ON waters(user_id);
CREATE INDEX IF NOT EXISTS idx_spots_water ON spots(water_id);
CREATE INDEX IF NOT EXISTS idx_spots_user ON spots(user_id);
CREATE INDEX IF NOT EXISTS idx_catches_spot ON catches(spot_id);
CREATE INDEX IF NOT EXISTS idx_catches_user ON catches(user_id);
CREATE INDEX IF NOT EXISTS idx_catches_lure ON catches(lure_id);
CREATE INDEX IF NOT EXISTS idx_catches_caught_at ON catches(caught_at DESC);
CREATE INDEX IF NOT EXISTS idx_lures_user ON lures(user_id);
CREATE INDEX IF NOT EXISTS idx_skunk_logs_spot ON skunk_logs(spot_id);

-- RPC function to increment lure catch count
CREATE OR REPLACE FUNCTION increment_lure_catch_count(lure_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE lures SET catch_count = catch_count + 1 WHERE id = lure_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security
ALTER TABLE waters ENABLE ROW LEVEL SECURITY;
ALTER TABLE spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE lures ENABLE ROW LEVEL SECURITY;
ALTER TABLE catches ENABLE ROW LEVEL SECURITY;
ALTER TABLE skunk_logs ENABLE ROW LEVEL SECURITY;

-- Policies: Drop existing then recreate (safe to re-run)
DO $$ BEGIN
  -- Waters
  DROP POLICY IF EXISTS "Users can view own waters" ON waters;
  DROP POLICY IF EXISTS "Users can insert own waters" ON waters;
  DROP POLICY IF EXISTS "Users can update own waters" ON waters;
  DROP POLICY IF EXISTS "Users can delete own waters" ON waters;
  -- Spots
  DROP POLICY IF EXISTS "Users can view own spots" ON spots;
  DROP POLICY IF EXISTS "Users can insert own spots" ON spots;
  DROP POLICY IF EXISTS "Users can update own spots" ON spots;
  DROP POLICY IF EXISTS "Users can delete own spots" ON spots;
  -- Lures
  DROP POLICY IF EXISTS "Users can view own lures" ON lures;
  DROP POLICY IF EXISTS "Users can insert own lures" ON lures;
  DROP POLICY IF EXISTS "Users can update own lures" ON lures;
  DROP POLICY IF EXISTS "Users can delete own lures" ON lures;
  -- Catches
  DROP POLICY IF EXISTS "Users can view own catches" ON catches;
  DROP POLICY IF EXISTS "Users can insert own catches" ON catches;
  DROP POLICY IF EXISTS "Users can update own catches" ON catches;
  DROP POLICY IF EXISTS "Users can delete own catches" ON catches;
  -- Skunk logs
  DROP POLICY IF EXISTS "Users can view own skunk_logs" ON skunk_logs;
  DROP POLICY IF EXISTS "Users can insert own skunk_logs" ON skunk_logs;
  DROP POLICY IF EXISTS "Users can update own skunk_logs" ON skunk_logs;
  DROP POLICY IF EXISTS "Users can delete own skunk_logs" ON skunk_logs;
END $$;

-- Users can only access their own data
CREATE POLICY "Users can view own waters" ON waters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own waters" ON waters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own waters" ON waters FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own waters" ON waters FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own spots" ON spots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own spots" ON spots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own spots" ON spots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own spots" ON spots FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own lures" ON lures FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lures" ON lures FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lures" ON lures FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lures" ON lures FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own catches" ON catches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own catches" ON catches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own catches" ON catches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own catches" ON catches FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own skunk_logs" ON skunk_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own skunk_logs" ON skunk_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own skunk_logs" ON skunk_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own skunk_logs" ON skunk_logs FOR DELETE USING (auth.uid() = user_id);
