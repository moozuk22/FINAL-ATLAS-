-- Migration: Add kids zone timer fields to table_requests
-- Run this SQL in your Supabase SQL Editor

-- Add new columns for kids zone timer tracking
ALTER TABLE table_requests 
ADD COLUMN IF NOT EXISTS child_location TEXT CHECK (child_location IN ('table', 'kids_zone', 'returning_to_table')),
ADD COLUMN IF NOT EXISTS timer_started_at BIGINT,
ADD COLUMN IF NOT EXISTS timer_paused_at BIGINT,
ADD COLUMN IF NOT EXISTS total_time_elapsed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10, 2) DEFAULT 10.00;

-- Update request_type check to include 'kids_zone'
ALTER TABLE table_requests 
DROP CONSTRAINT IF EXISTS table_requests_request_type_check;

ALTER TABLE table_requests 
ADD CONSTRAINT table_requests_request_type_check 
CHECK (request_type IN ('waiter', 'bill', 'animator', 'order', 'kids_zone'));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_table_requests_child_location ON table_requests(child_location);
CREATE INDEX IF NOT EXISTS idx_table_requests_timer_started ON table_requests(timer_started_at) WHERE timer_started_at IS NOT NULL;

-- Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
