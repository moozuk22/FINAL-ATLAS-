#!/bin/bash

echo "🚀 Supabase Migration Script"
echo "=============================="
echo ""
echo "This script will:"
echo "1. Create database schema in the new Supabase project"
echo "2. Migrate all data from old to new Supabase project"
echo ""
echo "⚠️  IMPORTANT:"
echo "   - Make sure you've run the SQL setup in the NEW Supabase project first!"
echo "   - Go to: https://zqnyugoudabtqieuqhrp.supabase.co"
echo "   - SQL Editor → New Query → Paste scripts/setup-new-supabase.sql → Run"
echo ""
read -p "Have you run the SQL setup? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please run the SQL setup first!"
    echo "   File: scripts/setup-new-supabase.sql"
    exit 1
fi

echo ""
echo "📦 Starting data migration..."
npm run migrate
