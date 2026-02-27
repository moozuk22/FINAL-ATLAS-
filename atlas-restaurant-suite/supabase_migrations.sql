-- Migration: Add new fields for enhanced functionality
-- Run this SQL in your Supabase SQL Editor

-- Add new columns to table_requests
ALTER TABLE table_requests 
ADD COLUMN IF NOT EXISTS source TEXT CHECK (source IN ('nfc', 'qr', 'direct')) DEFAULT 'direct',
ADD COLUMN IF NOT EXISTS request_type TEXT CHECK (request_type IN ('waiter', 'bill', 'animator', 'order')) DEFAULT 'order',
ADD COLUMN IF NOT EXISTS assigned_to TEXT;

-- Add new columns to menu_items for daily menu
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS is_daily_menu BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS daily_menu_date DATE;

-- Add session_started_at to restaurant_tables for order history tracking
ALTER TABLE restaurant_tables 
ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ;

-- Create table for customer ratings and feedback
CREATE TABLE IF NOT EXISTS customer_ratings (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES restaurant_tables(table_id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  google_review_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for daily menu assignments
CREATE TABLE IF NOT EXISTS daily_menu_assignments (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(menu_item_id, date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_table_requests_source ON table_requests(source);
CREATE INDEX IF NOT EXISTS idx_table_requests_request_type ON table_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_table_requests_assigned_to ON table_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_menu_items_daily_menu ON menu_items(is_daily_menu, daily_menu_date);
CREATE INDEX IF NOT EXISTS idx_daily_menu_assignments_date ON daily_menu_assignments(date);
CREATE INDEX IF NOT EXISTS idx_customer_ratings_table_id ON customer_ratings(table_id);

-- Enable Row Level Security for new tables
ALTER TABLE customer_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_menu_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for customer_ratings
DROP POLICY IF EXISTS "Allow public read access to customer_ratings" ON customer_ratings;
DROP POLICY IF EXISTS "Allow public insert to customer_ratings" ON customer_ratings;

CREATE POLICY "Allow public read access to customer_ratings"
  ON customer_ratings FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to customer_ratings"
  ON customer_ratings FOR INSERT
  WITH CHECK (true);

-- Create policies for daily_menu_assignments
DROP POLICY IF EXISTS "Allow public read access to daily_menu_assignments" ON daily_menu_assignments;
DROP POLICY IF EXISTS "Allow public insert to daily_menu_assignments" ON daily_menu_assignments;
DROP POLICY IF EXISTS "Allow public update to daily_menu_assignments" ON daily_menu_assignments;
DROP POLICY IF EXISTS "Allow public delete from daily_menu_assignments" ON daily_menu_assignments;

CREATE POLICY "Allow public read access to daily_menu_assignments"
  ON daily_menu_assignments FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to daily_menu_assignments"
  ON daily_menu_assignments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to daily_menu_assignments"
  ON daily_menu_assignments FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete from daily_menu_assignments"
  ON daily_menu_assignments FOR DELETE
  USING (true);

-- Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
