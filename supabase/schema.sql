-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('SAFE', 'HELP', 'RESOLVED')),
  priority VARCHAR(50) DEFAULT 'MODERATE' CHECK (priority IN ('CRITICAL', 'URGENT', 'MODERATE')),
  message TEXT,
  category VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  user_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON reports(priority);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);

-- Enable Row Level Security (RLS)
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (for non-resolved reports)
CREATE POLICY "Public read access for non-resolved reports" ON reports
  FOR SELECT TO anon, authenticated
  USING (status != 'RESOLVED');

-- Create policy for public insert access
CREATE POLICY "Public insert access" ON reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Create policy for public update access (only status updates)
CREATE POLICY "Public update access for status" ON reports
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (status = 'RESOLVED' OR status = 'HELP' OR status = 'SAFE');

-- Create policy for public delete access
CREATE POLICY "Public delete access" ON reports
  FOR DELETE TO anon, authenticated
  USING (true);
