-- Run this SQL in your Supabase SQL Editor for project: zqnyugoudabtqieuqhrp
-- Go to: Supabase Dashboard → SQL Editor → New Query → Paste this → Run

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
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cart_items_table_id ON cart_items(table_id);
CREATE INDEX IF NOT EXISTS idx_table_requests_table_id ON table_requests(table_id);
CREATE INDEX IF NOT EXISTS idx_table_requests_status ON table_requests(status);

-- Enable Row Level Security
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public read access to menu_items" ON menu_items;
DROP POLICY IF EXISTS "Allow public insert to menu_items" ON menu_items;
DROP POLICY IF EXISTS "Allow public update to menu_items" ON menu_items;
DROP POLICY IF EXISTS "Allow public delete from menu_items" ON menu_items;

DROP POLICY IF EXISTS "Allow public read access to restaurant_tables" ON restaurant_tables;

DROP POLICY IF EXISTS "Allow public read access to cart_items" ON cart_items;
DROP POLICY IF EXISTS "Allow public insert to cart_items" ON cart_items;
DROP POLICY IF EXISTS "Allow public update to cart_items" ON cart_items;
DROP POLICY IF EXISTS "Allow public delete from cart_items" ON cart_items;

DROP POLICY IF EXISTS "Allow public read access to table_requests" ON table_requests;
DROP POLICY IF EXISTS "Allow public insert to table_requests" ON table_requests;
DROP POLICY IF EXISTS "Allow public update to table_requests" ON table_requests;

-- Create policies for public read access (for client-facing pages)
CREATE POLICY "Allow public read access to menu_items"
  ON menu_items FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to restaurant_tables"
  ON restaurant_tables FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to cart_items"
  ON cart_items FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to table_requests"
  ON table_requests FOR SELECT
  USING (true);

-- Create policies for public insert/update (for client actions)
CREATE POLICY "Allow public insert to cart_items"
  ON cart_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to cart_items"
  ON cart_items FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete from cart_items"
  ON cart_items FOR DELETE
  USING (true);

CREATE POLICY "Allow public insert to table_requests"
  ON table_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to table_requests"
  ON table_requests FOR UPDATE
  USING (true);

-- Create policies for menu management (admin operations)
CREATE POLICY "Allow public insert to menu_items"
  ON menu_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to menu_items"
  ON menu_items FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete from menu_items"
  ON menu_items FOR DELETE
  USING (true);

-- Initialize default tables (1-10)
INSERT INTO restaurant_tables (table_id, is_locked, is_vip)
SELECT 
  'Table_' || LPAD(i::TEXT, 2, '0'),
  FALSE,
  FALSE
FROM generate_series(1, 10) AS i
ON CONFLICT (table_id) DO NOTHING;

-- Insert default menu items
INSERT INTO menu_items (id, cat, name, price, description)
VALUES
  ('1', '🥣 Супи', 'Пилешка супа', 3.50, NULL),
  ('2', '🥣 Супи', 'Супа топчета', 3.80, NULL),
  ('3', '🥗 Салати', 'Шопска салата', 5.50, NULL),
  ('4', '🥗 Салати', 'Зелена салата', 4.80, NULL),
  ('5', '🍛 Основни', 'Свинско с ориз', 6.90, NULL),
  ('6', '🍛 Основни', 'Мусака', 5.50, NULL),
  ('7', '🍛 Основни', 'Пилешко филе с картофи', 7.50, NULL)
ON CONFLICT (id) DO NOTHING;

-- Force PostgREST to reload schema (this may not work but worth trying)
NOTIFY pgrst, 'reload schema';
