-- Complete Database Setup for New Supabase Project
-- Run this SQL in your Supabase SQL Editor for the NEW project
-- Go to: Supabase Dashboard → SQL Editor → New Query → Paste this → Run

-- ============================================
-- 1. CORE TABLES
-- ============================================

-- Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  cat TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create restaurant_tables table (for table sessions)
CREATE TABLE IF NOT EXISTS restaurant_tables (
  table_id TEXT PRIMARY KEY,
  is_locked BOOLEAN DEFAULT FALSE,
  is_vip BOOLEAN DEFAULT FALSE,
  session_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create cart_items table
CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES restaurant_tables(table_id) ON DELETE CASCADE,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(table_id, menu_item_id)
);

-- Create table_requests table
CREATE TABLE IF NOT EXISTS table_requests (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES restaurant_tables(table_id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  total NUMERIC(10, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed')),
  payment_method TEXT CHECK (payment_method IN ('cash', 'card')),
  source TEXT CHECK (source IN ('nfc', 'qr', 'direct')) DEFAULT 'direct',
  request_type TEXT CHECK (request_type IN ('waiter', 'bill', 'animator', 'order', 'kids_zone')) DEFAULT 'order',
  assigned_to TEXT,
  timestamp BIGINT NOT NULL,
  child_location TEXT CHECK (child_location IN ('table', 'kids_zone', 'returning_to_table')),
  timer_started_at BIGINT,
  timer_paused_at BIGINT,
  total_time_elapsed INTEGER DEFAULT 0,
  hourly_rate NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. ADDITIONAL TABLES
-- ============================================

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

-- Create completed_orders table (archived orders)
CREATE TABLE IF NOT EXISTS completed_orders (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES restaurant_tables(table_id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  total NUMERIC(10, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  payment_method TEXT CHECK (payment_method IN ('cash', 'card')),
  source TEXT CHECK (source IN ('nfc', 'qr', 'direct')),
  request_type TEXT CHECK (request_type IN ('waiter', 'bill', 'animator', 'order', 'kids_zone')),
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table_history_archive table (archived table sessions)
CREATE TABLE IF NOT EXISTS table_history_archive (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL,
  cart_items JSONB DEFAULT '[]'::jsonb,
  requests JSONB DEFAULT '[]'::jsonb,
  total_revenue NUMERIC(10, 2) DEFAULT 0,
  session_duration_minutes INTEGER DEFAULT 0,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_cart_items_table_id ON cart_items(table_id);
CREATE INDEX IF NOT EXISTS idx_table_requests_table_id ON table_requests(table_id);
CREATE INDEX IF NOT EXISTS idx_table_requests_status ON table_requests(status);
CREATE INDEX IF NOT EXISTS idx_table_requests_source ON table_requests(source);
CREATE INDEX IF NOT EXISTS idx_table_requests_request_type ON table_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_table_requests_assigned_to ON table_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_daily_menu_assignments_date ON daily_menu_assignments(date);
CREATE INDEX IF NOT EXISTS idx_customer_ratings_table_id ON customer_ratings(table_id);
CREATE INDEX IF NOT EXISTS idx_completed_orders_table_id ON completed_orders(table_id);
CREATE INDEX IF NOT EXISTS idx_completed_orders_timestamp ON completed_orders(timestamp);
CREATE INDEX IF NOT EXISTS idx_table_history_archive_table_id ON table_history_archive(table_id);

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_menu_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE completed_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_history_archive ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. POLICIES - Drop existing if any
-- ============================================

-- Menu Items
DROP POLICY IF EXISTS "Allow public read access to menu_items" ON menu_items;
DROP POLICY IF EXISTS "Allow public insert to menu_items" ON menu_items;
DROP POLICY IF EXISTS "Allow public update to menu_items" ON menu_items;
DROP POLICY IF EXISTS "Allow public delete from menu_items" ON menu_items;

-- Restaurant Tables
DROP POLICY IF EXISTS "Allow public read access to restaurant_tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Allow public update to restaurant_tables" ON restaurant_tables;

-- Cart Items
DROP POLICY IF EXISTS "Allow public read access to cart_items" ON cart_items;
DROP POLICY IF EXISTS "Allow public insert to cart_items" ON cart_items;
DROP POLICY IF EXISTS "Allow public update to cart_items" ON cart_items;
DROP POLICY IF EXISTS "Allow public delete from cart_items" ON cart_items;

-- Table Requests
DROP POLICY IF EXISTS "Allow public read access to table_requests" ON table_requests;
DROP POLICY IF EXISTS "Allow public insert to table_requests" ON table_requests;
DROP POLICY IF EXISTS "Allow public update to table_requests" ON table_requests;
DROP POLICY IF EXISTS "Allow public delete from table_requests" ON table_requests;

-- Customer Ratings
DROP POLICY IF EXISTS "Allow public read access to customer_ratings" ON customer_ratings;
DROP POLICY IF EXISTS "Allow public insert to customer_ratings" ON customer_ratings;

-- Daily Menu Assignments
DROP POLICY IF EXISTS "Allow public read access to daily_menu_assignments" ON daily_menu_assignments;
DROP POLICY IF EXISTS "Allow public insert to daily_menu_assignments" ON daily_menu_assignments;
DROP POLICY IF EXISTS "Allow public update to daily_menu_assignments" ON daily_menu_assignments;
DROP POLICY IF EXISTS "Allow public delete from daily_menu_assignments" ON daily_menu_assignments;

-- Completed Orders
DROP POLICY IF EXISTS "Allow public read access to completed_orders" ON completed_orders;
DROP POLICY IF EXISTS "Allow public insert to completed_orders" ON completed_orders;

-- Table History Archive
DROP POLICY IF EXISTS "Allow public read access to table_history_archive" ON table_history_archive;

-- ============================================
-- 6. CREATE POLICIES
-- ============================================

-- Menu Items Policies
CREATE POLICY "Allow public read access to menu_items"
  ON menu_items FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to menu_items"
  ON menu_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to menu_items"
  ON menu_items FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete from menu_items"
  ON menu_items FOR DELETE
  USING (true);

-- Restaurant Tables Policies
CREATE POLICY "Allow public read access to restaurant_tables"
  ON restaurant_tables FOR SELECT
  USING (true);

CREATE POLICY "Allow public update to restaurant_tables"
  ON restaurant_tables FOR UPDATE
  USING (true);

-- Cart Items Policies
CREATE POLICY "Allow public read access to cart_items"
  ON cart_items FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to cart_items"
  ON cart_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to cart_items"
  ON cart_items FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete from cart_items"
  ON cart_items FOR DELETE
  USING (true);

-- Table Requests Policies
CREATE POLICY "Allow public read access to table_requests"
  ON table_requests FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to table_requests"
  ON table_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to table_requests"
  ON table_requests FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete from table_requests"
  ON table_requests FOR DELETE
  USING (true);

-- Customer Ratings Policies
CREATE POLICY "Allow public read access to customer_ratings"
  ON customer_ratings FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to customer_ratings"
  ON customer_ratings FOR INSERT
  WITH CHECK (true);

-- Daily Menu Assignments Policies
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

-- Completed Orders Policies
CREATE POLICY "Allow public read access to completed_orders"
  ON completed_orders FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to completed_orders"
  ON completed_orders FOR INSERT
  WITH CHECK (true);

-- Table History Archive Policies
CREATE POLICY "Allow public read access to table_history_archive"
  ON table_history_archive FOR SELECT
  USING (true);

-- ============================================
-- 7. INITIALIZE DEFAULT DATA
-- ============================================

-- Initialize default tables (1-10)
INSERT INTO restaurant_tables (table_id, is_locked, is_vip)
SELECT 
  'Table_' || LPAD(i::TEXT, 2, '0'),
  FALSE,
  FALSE
FROM generate_series(1, 10) AS i
ON CONFLICT (table_id) DO NOTHING;

-- Insert default menu items (optional - can be removed if you want to migrate from old DB)
-- INSERT INTO menu_items (id, cat, name, price, description)
-- VALUES
--   ('1', '🥣 Супи', 'Пилешка супа', 3.50, NULL),
--   ('2', '🥣 Супи', 'Супа топчета', 3.80, NULL),
--   ('3', '🥗 Салати', 'Шопска салата', 5.50, NULL),
--   ('4', '🥗 Салати', 'Зелена салата', 4.80, NULL),
--   ('5', '🍛 Основни', 'Свинско с ориз', 6.90, NULL),
--   ('6', '🍛 Основни', 'Мусака', 5.50, NULL),
--   ('7', '🍛 Основни', 'Пилешко филе с картофи', 7.50, NULL)
-- ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 8. RELOAD SCHEMA
-- ============================================

-- Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
