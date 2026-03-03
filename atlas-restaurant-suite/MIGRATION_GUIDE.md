# Supabase Migration Guide

Complete guide for migrating the database schema and data to a new Supabase project.

## Prerequisites

- Access to both old and new Supabase projects
- Node.js and npm installed
- Supabase CLI (optional, for CLI method)

## Step 1: Create Database Schema in New Project

**Important:** You must create all tables in the new Supabase project before migrating data.

### Option A: Via Supabase Dashboard (Recommended)

1. Go to your new Supabase project dashboard
2. Navigate to **SQL Editor** in the left menu
3. Click **New Query**
4. Open `scripts/setup-new-supabase.sql` and copy the entire SQL code
5. Paste it into SQL Editor
6. Click **Run** (or press Ctrl+Enter)

### Option B: Via Supabase CLI

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login
supabase login

# Link to new project
supabase link --project-ref YOUR_PROJECT_REF

# Execute SQL file
supabase db execute -f scripts/setup-new-supabase.sql
```

### Step 1.5: Fix RLS Policies (If Needed)

If you encounter RLS (Row Level Security) errors during migration:

1. Go to SQL Editor in your new Supabase project
2. Open `scripts/fix-rls-new-project.sql`
3. Copy and paste the SQL code
4. Click **Run**

## Step 2: Migrate Data

After the schema is created, start the data migration:

```bash
npm run migrate:complete
```

This will:
- Export all data from the old project
- Import it into the new project
- Show a migration summary
- Handle RLS policy errors gracefully

## Step 3: Verify Migration

After migration, verify the data:

```bash
npm run migrate:verify
```

Or manually check in the new Supabase project:
1. Go to **Table Editor**
2. Verify all tables have data
3. Test the application functionality

## Tables That Will Be Migrated

- ✅ `menu_items` - Menu items
- ✅ `restaurant_tables` - Restaurant tables
- ✅ `cart_items` - Shopping cart items
- ✅ `table_requests` - Table requests/orders
- ✅ `daily_menu_assignments` - Daily menu assignments
- ✅ `customer_ratings` - Customer ratings and feedback
- ✅ `completed_orders` - Completed orders archive
- ✅ `table_history_archive` - Table session history archive

## Schema Changes

### New Columns in Existing Tables:
- `table_requests.source` - Request source (nfc/qr/direct)
- `table_requests.request_type` - Request type (waiter/bill/animator/order/kids_zone)
- `table_requests.assigned_to` - Assigned staff member (for animator)
- `restaurant_tables.session_started_at` - Session start timestamp

### New Tables:
- `customer_ratings` - Customer ratings and feedback
- `daily_menu_assignments` - Daily menu visibility assignments

### Indexes and Policies:
- Performance indexes created
- Row Level Security policies configured

## Troubleshooting

### Error: "Could not find the table"
- Verify you've executed `setup-new-supabase.sql` in the new project
- Check that all tables are created in Table Editor
- Wait 2-5 minutes for PostgREST to refresh schema cache

### Error: "Permission denied" / RLS Policy Violation
- Run `scripts/fix-rls-new-project.sql` in the new project
- Verify RLS policies are created correctly
- Ensure anon key has access to tables

### Error During Import
- Check that foreign keys are properly configured
- Verify references (menu_item_id, table_id) exist
- Check for schema mismatches (e.g., field types, missing columns)

### Migration Incomplete
- Check migration summary for specific table errors
- Re-run migration: `npm run migrate:complete`
- Some tables may need RLS policies fixed first

## Important Notes

- Migration uses `IF NOT EXISTS`, so it's safe to re-run
- Existing data will not be lost
- New columns have default values
- Migration handles data type conversions automatically
- Batch processing (100 rows at a time) prevents API overload
