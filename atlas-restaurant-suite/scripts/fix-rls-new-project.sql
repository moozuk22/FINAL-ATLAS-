-- Fix RLS policies to allow INSERT operations in NEW project
-- Run this in: https://zqnyugoudabtqieuqhrp.supabase.co → SQL Editor

-- Restaurant Tables - Add INSERT policy
DROP POLICY IF EXISTS "Allow public insert to restaurant_tables" ON restaurant_tables;
CREATE POLICY "Allow public insert to restaurant_tables"
  ON restaurant_tables FOR INSERT
  WITH CHECK (true);

-- Table History Archive - Add INSERT policy  
DROP POLICY IF EXISTS "Allow public insert to table_history_archive" ON table_history_archive;
CREATE POLICY "Allow public insert to table_history_archive"
  ON table_history_archive FOR INSERT
  WITH CHECK (true);
