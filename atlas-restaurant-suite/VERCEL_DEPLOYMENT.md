# Vercel Deployment Guide

Complete guide for deploying the ATLAS HOUSE restaurant management system to Vercel.

## Prerequisites

- Vercel account
- Supabase project with database tables set up
- Git repository connected to Vercel

## ⚠️ IMPORTANT: Database Setup Required First

**Before deploying, you must create the database tables in your Supabase project.**

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor** → **New Query**
3. Copy and paste the contents of `scripts/setup-new-supabase.sql`
4. Click **Run** to execute the SQL
5. Wait 2-5 minutes for PostgREST to refresh its schema cache

## Configuration

This is a **Vite + React** application, not Next.js.

### Vercel Settings

1. **Framework Preset**: Select "Other" or "Vite" (if available)
2. **Build Command**: `npm run build`
3. **Output Directory**: `dist`
4. **Install Command**: `npm install`

### Environment Variables Setup

Add these environment variables in your Vercel project settings:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables for **Production**, **Preview**, and **Development**:

#### Required Variables

- **Name:** `VITE_SUPABASE_URL`
- **Value:** `https://zqnyugoudabtqieuqhrp.supabase.co`

- **Name:** `VITE_SUPABASE_ANON_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxbnl1Z291ZGFidHFpZXVxaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTAzMDQsImV4cCI6MjA4ODEyNjMwNH0.ahoHNU_-3y0rVWOuXGOb8fUoOfA5bjuPABHCrDzvgLc`

### After Adding Variables

1. **Redeploy** your application in Vercel
2. The app will automatically use these environment variables
3. Check the browser console for Supabase connection logs

## Deployment Steps

### 1. Connect Repository

1. Import your Git repository to Vercel
2. Vercel will auto-detect the framework (Vite)

### 2. Configure Build Settings

Vercel should auto-detect these settings from `vercel.json`:
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 3. Deploy

1. Push to your main branch
2. Vercel will automatically deploy
3. Check deployment logs for any errors

## Troubleshooting

### Build Failures

1. Check build logs in Vercel dashboard
2. Verify environment variables are set correctly
3. Ensure `package.json` has all dependencies
4. Check for TypeScript errors: `npm run type-check`

### Runtime Errors

#### White Screen / App Not Loading
- Check browser console for errors
- Usually missing environment variables or build errors
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set

#### 404 on Routes
- The `vercel.json` should have the rewrite rule (already configured)
- Verify routing configuration

#### Supabase Connection Errors
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly
- Check that database tables exist in Supabase
- Wait 2-5 minutes after creating tables for schema cache refresh

### 404 Errors / PGRST205 Schema Cache Errors

If you see errors like `"Could not find the table 'public.menu_items' in the schema cache"`:

1. **Wait 2-5 minutes** - PostgREST automatically refreshes its schema cache, but there can be a delay after creating tables
2. **Check Supabase Dashboard** - Go to your Supabase project → Settings → API → verify tables are listed
3. **Verify Environment Variables** - Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly in Vercel
4. **Check Project URL** - Make sure you're using the correct Supabase project URL (should match where tables were created)
5. **Manual Refresh** - In Supabase Dashboard, go to Database → try making a small change to trigger schema reload

### Other Common Issues

- **RLS errors**: Check that Row Level Security policies allow public access
- **Connection errors**: Verify the Supabase project is active and not paused
- **Check browser console** for detailed error messages
- **Clear Cache**: In Vercel Dashboard → Settings → Clear Build Cache → Redeploy

## Manual Deployment Steps

1. Go to Vercel Dashboard
2. Select your project
3. Go to Settings → General
4. Verify:
   - Framework Preset: "Other"
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
5. Go to Settings → Environment Variables
6. Add/verify the two `VITE_*` variables
7. Go to Deployments
8. Click "Redeploy" on the latest deployment
