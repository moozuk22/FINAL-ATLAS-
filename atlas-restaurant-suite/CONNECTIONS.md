# Application Connections & Dependencies

## 1. Database Connection (Supabase)

### Connection Details
- **URL**: `https://wicufyfrkaigjhirdgeu.supabase.co`
- **Client**: `@supabase/supabase-js`
- **Configuration**: `src/lib/supabase.ts`
- **Environment Variables**:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

### Database Tables

#### Core Tables
1. **`restaurant_tables`** - Table management
   - Operations: SELECT, UPDATE
   - Fields: `id`, `table_id`, `is_locked`, `session_started_at`, `is_vip`

2. **`cart_items`** - Shopping cart items
   - Operations: SELECT, INSERT, UPDATE, DELETE
   - Relations: `menu_items(id, name, price)`
   - Real-time: ✅ Subscribed

3. **`table_requests`** - All table requests (orders, waiter calls, bills, animator)
   - Operations: SELECT, INSERT, UPDATE, DELETE
   - Fields: `id`, `table_id`, `action`, `details`, `total`, `status`, `timestamp`, `source`, `request_type`, `assigned_to`, `child_location`, `timer_started_at`, `timer_paused_at`, `total_time_elapsed`, `hourly_rate`
   - Real-time: ✅ Subscribed

4. **`menu_items`** - Menu items
   - Operations: SELECT, INSERT, UPDATE, DELETE
   - Fields: `id`, `name`, `desc`, `price`, `cat`, `is_daily_menu`, `daily_menu_date`
   - Real-time: ✅ Subscribed (optimized - selective updates)

5. **`completed_orders`** - Archived completed orders
   - Operations: SELECT, INSERT
   - Used for: Revenue reports, order history

6. **`table_history_archive`** - Archived table sessions
   - Operations: SELECT, INSERT
   - Used for: Historical data

#### Feature-Specific Tables
7. **`customer_ratings`** - Customer feedback and ratings
   - Operations: SELECT, INSERT
   - Fields: `id`, `table_id`, `rating`, `feedback`, `google_review_sent`, `created_at`

8. **`daily_menu_assignments`** - Daily menu configuration
   - Operations: SELECT, INSERT, UPDATE, DELETE
   - Fields: `id`, `menu_item_id`, `date`, `is_visible`

---

## 2. Real-Time Subscriptions

### Active Channels
1. **`cart_changes`**
   - Table: `cart_items`
   - Events: INSERT, UPDATE, DELETE
   - Debounce: 300ms

2. **`requests_changes`**
   - Table: `table_requests`
   - Events: INSERT, UPDATE, DELETE
   - Debounce: 300ms

3. **`menu_changes`**
   - Table: `menu_items`
   - Events: INSERT, UPDATE, DELETE
   - Optimized: Selective updates (no full reload)

---

## 3. External Services

### Google Services
1. **Google Reviews**
   - URL Pattern: `https://search.google.com/local/writereview?placeid={PLACE_ID}`
   - Fallback: `https://www.google.com/search?q=ATLAS+HOUSE+review`
   - Environment Variable: `VITE_GOOGLE_PLACE_ID`
   - Used in: `RatingModal.tsx`
   - Trigger: Customer rating 4-5 stars

2. **Google Fonts**
   - URL: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap`
   - Fonts: Inter, Playfair Display
   - Used in: `src/index.css`

---

## 4. API Operations Summary

### Read Operations (SELECT)
- `restaurant_tables` - Load table status
- `cart_items` - Load cart items with menu item details
- `table_requests` - Load all requests (pending, confirmed, completed)
- `menu_items` - Load menu items
- `daily_menu_assignments` - Load daily menu configuration
- `customer_ratings` - Load customer ratings
- `completed_orders` - Load revenue reports
- `table_history_archive` - Load historical data

### Write Operations (INSERT)
- `cart_items` - Add items to cart
- `table_requests` - Create orders, waiter calls, bill requests, animator requests
- `menu_items` - Add new menu items
- `daily_menu_assignments` - Assign items to daily menu
- `customer_ratings` - Submit customer ratings
- `completed_orders` - Archive completed orders
- `table_history_archive` - Archive table sessions

### Update Operations (UPDATE)
- `cart_items` - Update quantities
- `table_requests` - Update request status, timer info
- `menu_items` - Update menu item details
- `restaurant_tables` - Update table status, lock state
- `daily_menu_assignments` - Toggle visibility

### Delete Operations (DELETE)
- `cart_items` - Remove items from cart
- `table_requests` - Remove completed requests (cleanup)
- `menu_items` - Delete menu items
- `daily_menu_assignments` - Remove from daily menu

---

## 5. Network Requests by Component

### RestaurantContext.tsx
- **Primary database operations hub**
- All CRUD operations for tables, cart, requests, menu
- Real-time subscriptions management
- ~50+ database operations

### CustomerMenu.tsx
- Loads table session data
- Submits orders, ratings
- Opens Google Reviews (external)

### StaffDashboard.tsx
- Loads all table sessions
- Completes requests
- Marks tables as paid
- Revenue reports

### MenuEditor.tsx
- Full CRUD for menu items
- Category management
- Daily menu management

### KidsZoneDashboard.tsx
- Loads animator requests
- Updates child location
- Timer management

### RatingModal.tsx
- Submits ratings to database
- Opens Google Reviews (external)

---

## 6. Environment Variables Required

```env
VITE_SUPABASE_URL=https://wicufyfrkaigjhirdgeu.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GOOGLE_PLACE_ID=your_google_place_id
```

---

## 7. Security & Access

### Row Level Security (RLS)
- All tables have RLS policies
- Anonymous access for read operations
- Authenticated access for write operations (if needed)

### API Keys
- Supabase Anon Key: Public (safe for client-side)
- No service role key exposed (server-side only)

---

## 8. Performance Optimizations

1. **Real-time Subscriptions**: Debounced (300ms) to prevent spam
2. **Selective Updates**: Menu items updated individually, not full reload
3. **Parallel Loading**: Multiple queries executed in parallel using `Promise.all`
4. **Cleanup**: Completed requests cleaned up periodically (every 5 minutes)

---

## 9. Connection Status Monitoring

- Real-time subscriptions automatically reconnect
- Error handling for offline scenarios
- Fallback to polling if real-time fails

---

## Summary

- **Total Database Tables**: 8
- **Real-time Subscriptions**: 3
- **External Services**: 2 (Google Reviews, Google Fonts)
- **Total Database Operations**: ~50+ across all components
- **Primary Connection**: Supabase PostgreSQL database
