# Real-Time Subscriptions & Auto-Refresh Summary

## Overview
This document provides a comprehensive overview of all real-time subscriptions and auto-refresh mechanisms across the entire application.

---

## Central Real-Time Subscriptions (RestaurantContext.tsx)

All subscriptions are managed centrally in `RestaurantContext.tsx` and automatically update the global state.

### 1. 📡 Cart Subscription (`cart_changes`)
- **Table**: `cart_items`
- **Events**: INSERT, UPDATE, DELETE
- **Action**: Calls `reloadData()` → `loadTableSessions()` → Updates `tables` state
- **Triggers**: When cart items are added, updated, or removed
- **Status**: ✅ SUBSCRIBED
- **Auto-refresh**: ✅ Yes - Forces re-render via `realtimeUpdateVersion`

### 2. 📡 Requests Subscription (`requests_changes`)
- **Table**: `table_requests`
- **Events**: INSERT, UPDATE, DELETE
- **Action**: Calls `reloadData()` → `loadTableSessions()` → Updates `tables` state
- **Triggers**: When orders, waiter calls, bill requests, or animator requests change
- **Status**: ✅ SUBSCRIBED
- **Auto-refresh**: ✅ Yes - Forces re-render via `realtimeUpdateVersion`

### 3. 📡 Menu Subscription (`menu_changes`)
- **Table**: `menu_items`
- **Events**: INSERT, UPDATE, DELETE
- **Action**: Selective updates - directly updates `menuItems` state without full reload
- **Triggers**: When menu items are added, updated, or deleted
- **Status**: ✅ SUBSCRIBED
- **Auto-refresh**: ✅ Yes - Updates `menuItems` state + increments `realtimeUpdateVersion`

### 4. 📡 Tables Subscription (`tables_changes`)
- **Table**: `restaurant_tables`
- **Events**: INSERT, UPDATE, DELETE
- **Action**: Calls `reloadData()` → `loadTableSessions()` → Updates `tables` state
- **Triggers**: When table status (locked/unlocked), VIP status, or session changes
- **Status**: ✅ SUBSCRIBED
- **Auto-refresh**: ✅ Yes - Forces re-render via `realtimeUpdateVersion`

### 5. 📡 Daily Menu Subscription (`daily_menu_changes`)
- **Table**: `daily_menu_assignments`
- **Events**: INSERT, UPDATE, DELETE
- **Action**: Calls `reloadData()` → `loadTableSessions()` → Updates `tables` state
- **Triggers**: When daily menu assignments change (items added/removed from daily menu)
- **Status**: ✅ SUBSCRIBED
- **Auto-refresh**: ✅ Yes - Forces re-render via `realtimeUpdateVersion`

---

## Page-by-Page Breakdown

### 1. CustomerMenu.tsx (`/menu`)
**Purpose**: Customer-facing menu page where customers can view menu items, add to cart, and place orders.

**Subscriptions Used**:
- ✅ Central subscriptions from `RestaurantContext`:
  - Cart subscription (via `tables` state)
  - Requests subscription (via `tables` state)
  - Menu subscription (via `menuItems` state)
  - Tables subscription (via `tables` state)
- ✅ Local subscription:
  - `customer_menu_daily_realtime` - Listens to `daily_menu_assignments` changes
  - **Action**: Reloads daily menu items when changes occur

**Auto-Refresh Mechanism**:
- Uses `realtimeUpdateVersion` from context in `useMemo` dependencies
- Session updates via `useMemo(() => getTableSession(tableId), [tables, tableId, getTableSession, realtimeUpdateVersion])`
- Daily menu reloads automatically when `daily_menu_assignments` changes
- Cart drawer updates automatically when cart changes
- Order status updates automatically when requests change

**Real-Time Features**:
- ✅ Cart updates instantly when items are added/removed
- ✅ Order status updates instantly (pending → confirmed)
- ✅ Daily menu updates instantly when admin changes it
- ✅ Table lock status updates instantly

---

### 2. PremiumMenu.tsx (`/premium`)
**Purpose**: Premium/VIP menu page with premium menu items.

**Subscriptions Used**:
- ✅ Central subscriptions from `RestaurantContext`:
  - Cart subscription (via `tables` state)
  - Requests subscription (via `tables` state)
  - Tables subscription (via `tables` state)

**Auto-Refresh Mechanism**:
- Uses `realtimeUpdateVersion` from context in `useMemo` dependencies
- Session updates via `useMemo(() => getTableSession(tableId, isVip), [tables, tableId, isVip, getTableSession, realtimeUpdateVersion])`
- Toast notifications when order status changes (via `useEffect` watching session changes)

**Real-Time Features**:
- ✅ Cart updates instantly
- ✅ Order status updates instantly
- ✅ Bill status updates instantly

---

### 3. StaffDashboard.tsx (`/staff`)
**Purpose**: Staff dashboard for managing orders, requests, and tables.

**Subscriptions Used**:
- ✅ Central subscriptions from `RestaurantContext`:
  - Cart subscription (via `tables` state)
  - Requests subscription (via `tables` state)
  - Tables subscription (via `tables` state)

**Auto-Refresh Mechanism**:
- Uses `realtimeUpdateVersion` from context
- `totalPending` calculated via `useMemo` with `[tables, realtimeUpdateVersion]` dependencies
- `totalRevenue` calculated via `useMemo` with `[tables, realtimeUpdateVersion]` dependencies
- Table cards use `key={`${tableId}_${realtimeUpdateVersion}`}` to force re-render
- Sound alert plays when new pending requests appear

**Real-Time Features**:
- ✅ New orders appear instantly
- ✅ Order status changes instantly (pending → confirmed)
- ✅ Table status updates instantly (locked/unlocked)
- ✅ Revenue calculations update instantly
- ✅ Pending request count updates instantly

---

### 4. KidsZoneDashboard.tsx (`/kids-zone`)
**Purpose**: Animator dashboard for managing kids zone requests and timers.

**Subscriptions Used**:
- ✅ Central subscriptions from `RestaurantContext`:
  - Requests subscription (via `tables` state) - Specifically animator requests
  - Tables subscription (via `tables` state)

**Auto-Refresh Mechanism**:
- Uses `realtimeUpdateVersion` from context
- `animatorRequests` calculated via `useMemo` with `[tables, realtimeUpdateVersion]` dependencies
- Table cards use `key={`${tableId}_${realtimeUpdateVersion}`}` to force re-render
- Timer updates every second via `setInterval` (local state)
- Sound alert plays when new animator requests appear

**Real-Time Features**:
- ✅ New animator requests appear instantly
- ✅ Timer updates in real-time (elapsed time calculation)
- ✅ Child location updates instantly (table ↔ kids_zone)
- ✅ Timer status updates instantly (running/paused)
- ✅ Cost calculations update instantly

---

### 5. KidsZoneAdmin.tsx (`/kids-zone-admin`)
**Purpose**: Admin view for kids zone management.

**Subscriptions Used**:
- ✅ Central subscriptions from `RestaurantContext`:
  - Requests subscription (via `tables` state)
  - Tables subscription (via `tables` state)

**Auto-Refresh Mechanism**:
- Uses `tables` directly from context
- Reacts to `tables` state changes automatically

**Real-Time Features**:
- ✅ Table status updates instantly
- ✅ Animator request status updates instantly

---

### 6. MenuEditor.tsx (`/admin/menu`)
**Purpose**: Admin page for editing menu items and daily menu assignments.

**Subscriptions Used**:
- ✅ Central subscriptions from `RestaurantContext`:
  - Menu subscription (via `menuItems` state) - Direct updates
  - Daily menu subscription (via `tables` state)

**Auto-Refresh Mechanism**:
- Uses `menuItems` directly from context (updates instantly via selective updates)
- Uses `realtimeUpdateVersion` from context
- Menu items update instantly when changed (no reload needed)

**Real-Time Features**:
- ✅ Menu items update instantly when added/edited/deleted
- ✅ Daily menu assignments update instantly
- ✅ No page reload needed for menu changes

---

### 7. TableOptions.tsx (`/t/:tableNumber`)
**Purpose**: Landing page for table selection, shows daily menu availability.

**Subscriptions Used**:
- ✅ Local subscription:
  - `table_options_daily_menu` - Listens to `daily_menu_assignments` changes
  - **Action**: Calls `checkDailyMenu()` when changes occur

**Auto-Refresh Mechanism**:
- Checks daily menu on mount
- Real-time subscription reloads daily menu when `daily_menu_assignments` changes
- Uses ref pattern to avoid subscription recreation

**Real-Time Features**:
- ✅ Daily menu availability updates instantly
- ✅ Menu button appears/disappears instantly when daily menu changes

---

### 8. ClientTables.tsx (`/client-tables`)
**Purpose**: Client-facing table selection page.

**Subscriptions Used**:
- ✅ Central subscriptions from `RestaurantContext`:
  - Tables subscription (via `tables` state)

**Auto-Refresh Mechanism**:
- Uses `loading` state from context
- Reacts to `tables` state changes automatically

**Real-Time Features**:
- ✅ Table availability updates instantly

---

### 9. Index.tsx (`/`)
**Purpose**: Landing/navigation page. Renders PremiumMenu if table parameter exists.

**Subscriptions Used**:
- ✅ Inherits from PremiumMenu when table parameter exists
- ❌ No subscriptions when showing landing page (static content)

**Auto-Refresh Mechanism**:
- If rendering PremiumMenu: Same as PremiumMenu.tsx
- If showing landing page: No auto-refresh needed (static)

**Real-Time Features**:
- ✅ Same as PremiumMenu when table parameter exists

---

### 10. NotFound.tsx (`/*`)
**Purpose**: 404 error page.

**Subscriptions Used**:
- ❌ None (static error page)

**Auto-Refresh Mechanism**:
- ❌ None (static page)

**Real-Time Features**:
- ❌ None

---

## Component-Level Subscriptions

### DailyMenuEditor.tsx (Dialog Component)
**Purpose**: Dialog for editing daily menu assignments.

**Subscriptions Used**:
- ✅ Local subscription:
  - `daily_menu_editor_realtime` - Listens to `daily_menu_assignments` changes
  - **Action**: Calls `loadDailyMenu()` when changes occur
  - **Scope**: Only active when dialog is open

**Auto-Refresh Mechanism**:
- Reloads daily menu items when subscription fires
- Uses ref pattern to avoid subscription recreation

**Real-Time Features**:
- ✅ Daily menu updates instantly when changed from another tab/window

---

### PendingOrders.tsx (Dialog Component)
**Purpose**: Dialog showing all pending orders (not confirmed).

**Subscriptions Used**:
- ✅ Central subscriptions from `RestaurantContext`:
  - Requests subscription (via `tables` state)

**Auto-Refresh Mechanism**:
- Uses `useMemo` with `[getPendingOrders, tables]` dependencies
- Automatically updates when `tables` state changes
- No manual refresh needed

**Real-Time Features**:
- ✅ New pending orders appear instantly
- ✅ Orders disappear instantly when confirmed
- ✅ Order details update instantly

---

### RevenueReport.tsx (Dialog Component)
**Purpose**: Dialog for generating revenue reports.

**Subscriptions Used**:
- ❌ None (manual report generation on demand)

**Auto-Refresh Mechanism**:
- ❌ None (user-initiated report generation)

**Real-Time Features**:
- ❌ None (reports are generated on-demand, not real-time)

---

## Auto-Refresh Mechanism Details

### How It Works

1. **Real-Time Event Flow**:
   ```
   Database Change → Supabase Real-Time → Subscription Callback → reloadData() 
   → loadTableSessions() → setTables(newData) → setRealtimeUpdateVersion(prev + 1) 
   → Context Value Updates → All Components Re-render
   ```

2. **Force Re-render Strategy**:
   - `realtimeUpdateVersion` counter increments on every real-time update
   - Included in `useMemo` dependencies to force recalculation
   - Included in React `key` props to force component remount
   - Ensures all components see the latest data

3. **Selective Updates**:
   - Menu items use selective updates (no full reload)
   - Cart/Requests/Tables use full reload for consistency
   - Daily menu uses full reload for simplicity

---

## Subscription Status Summary

| Subscription | Channel Name | Table | Status | Auto-Refresh |
|-------------|-------------|-------|--------|--------------|
| Cart | `cart_changes` | `cart_items` | ✅ SUBSCRIBED | ✅ Yes |
| Requests | `requests_changes` | `table_requests` | ✅ SUBSCRIBED | ✅ Yes |
| Menu | `menu_changes` | `menu_items` | ✅ SUBSCRIBED | ✅ Yes |
| Tables | `tables_changes` | `restaurant_tables` | ✅ SUBSCRIBED | ✅ Yes |
| Daily Menu (Central) | `daily_menu_changes` | `daily_menu_assignments` | ✅ SUBSCRIBED | ✅ Yes |
| Daily Menu (TableOptions) | `table_options_daily_menu` | `daily_menu_assignments` | ✅ SUBSCRIBED | ✅ Yes |
| Daily Menu (CustomerMenu) | `customer_menu_daily_realtime` | `daily_menu_assignments` | ✅ SUBSCRIBED | ✅ Yes |
| Daily Menu (DailyMenuEditor) | `daily_menu_editor_realtime` | `daily_menu_assignments` | ✅ SUBSCRIBED | ✅ Yes |
| PendingOrders | Central (`requests_changes`) | `table_requests` | ✅ SUBSCRIBED | ✅ Yes |
| RevenueReport | ❌ None | N/A | N/A | ❌ No (manual) |

---

## Key Features

### ✅ Instant Updates
- All data changes reflect immediately across all open tabs/windows
- No manual refresh needed
- No polling intervals

### ✅ Optimized Performance
- Selective updates for menu items (no full reload)
- Memoized calculations to prevent unnecessary re-renders
- Ref pattern prevents subscription recreation

### ✅ Reliable
- Subscriptions stay active (no CLOSED status)
- Error handling with fallbacks
- Connection recovery handled by Supabase

### ✅ User Experience
- Instant feedback on all actions
- Sound alerts for new requests
- Toast notifications for status changes
- Smooth UI updates without flickering

---

## Testing Checklist

To verify real-time updates are working:

1. **Cart Updates**: Add item to cart in one tab → Should appear instantly in all tabs
2. **Order Status**: Complete order in StaffDashboard → Should update instantly in CustomerMenu
3. **Menu Changes**: Add/edit menu item in MenuEditor → Should appear instantly in CustomerMenu
4. **Daily Menu**: Change daily menu in MenuEditor → Should update instantly in TableOptions and CustomerMenu
5. **Table Status**: Lock/unlock table → Should update instantly in StaffDashboard
6. **Animator Requests**: Call animator → Should appear instantly in KidsZoneDashboard
7. **Timer Updates**: Timer should update every second in KidsZoneDashboard

---

## Notes

- All subscriptions use empty dependency arrays `[]` to prevent recreation
- Ref pattern (`loadTableSessionsRef`) ensures subscriptions always call latest function
- `realtimeUpdateVersion` forces re-renders when subscriptions might not trigger React updates
- Console logs show subscription status and real-time events for debugging

---

**Last Updated**: $(date)
**Status**: ✅ All subscriptions active and working
**Auto-Refresh**: ✅ Enabled on all pages
