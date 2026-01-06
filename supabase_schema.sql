-- Create a table for event photos
CREATE TABLE IF NOT EXISTS ec_event_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES ec_events(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES ec_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE ec_event_photos ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ec_event_photos'
      AND policyname = 'Public read access for event photos'
  ) THEN
    CREATE POLICY "Public read access for event photos"
      ON ec_event_photos FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ec_event_photos'
      AND policyname = 'Authenticated users can upload photos'
  ) THEN
    CREATE POLICY "Authenticated users can upload photos"
      ON ec_event_photos FOR INSERT
      WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ec_event_photos'
      AND policyname = 'Users can delete their own photos or admins'
  ) THEN
    CREATE POLICY "Users can delete their own photos or admins"
      ON ec_event_photos FOR DELETE
      USING (auth.uid() = uploaded_by OR auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'ec_rsvps'
      AND constraint_name = 'fk_ec_rsvps_event'
  ) THEN
    ALTER TABLE public.ec_rsvps
    ADD CONSTRAINT fk_ec_rsvps_event
    FOREIGN KEY (event_id) REFERENCES public.ec_events(id) ON DELETE CASCADE;
  END IF;
END $$;
