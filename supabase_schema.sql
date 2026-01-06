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
CREATE POLICY "Public read access for event photos"
  ON ec_event_photos FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can upload photos"
  ON ec_event_photos FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Users can delete their own photos or admins"
  ON ec_event_photos FOR DELETE
  USING (auth.uid() = uploaded_by OR auth.role() = 'service_role');
