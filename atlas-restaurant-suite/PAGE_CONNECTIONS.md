# 📊 Atlas Restaurant Suite - Page Connections Map

## 🗺️ Route Structure

### **Main Routes** (defined in `src/App.tsx`)

```
/                          → ClientTables (Home/Landing)
/menu                      → CustomerMenu (Customer Ordering)
/t/:tableNumber           → TableOptions (Table Selection)
/table-options/:tableNumber → TableOptions (Alternative route)
/admin                     → StaffDashboard (Staff Management) [Lazy Loaded]
/admin/menu                → MenuEditor (Menu Management) [Lazy Loaded]
/admin/kids-zone           → KidsZoneAdmin (Kids Zone Admin) [Lazy Loaded]
/animator                  → KidsZoneDashboard (Animator Dashboard) [Lazy Loaded]
/index                     → Index (Navigation Hub)
*                          → NotFound (404 Page)
```

---

## 🔗 Navigation Flow

### **1. Entry Points**

#### **`/` (ClientTables) - Home Page**
- **Purpose**: Landing page with table selection
- **Connections**:
  - → `/t/:tableNumber` - Click table card → TableOptions
  - → `/menu?table=Table_XX` - Direct menu access
- **Features**: QR code display for each table

#### **`/index` (Index) - Navigation Hub**
- **Purpose**: Main navigation page
- **Connections**:
  - → `/menu?table=Table_01` - Menu link
  - → `/client-tables` - Client Tables link
  - → `/admin` - Staff Dashboard link
  - → `/menu?table=Table_XX` - Quick access buttons (Tables 1-5)

---

### **2. Customer Pages**

#### **`/menu` (CustomerMenu) - Customer Ordering**
- **Purpose**: Main customer ordering interface
- **Query Params**: `?table=Table_XX`
- **Connections**:
  - → `navigate(-1)` - Back button
- **Actions** (trigger refresh on StaffDashboard):
  - ✅ Submit Order → `submitOrder()` → Auto-refresh all pages
  - 🔔 Call Waiter → `callWaiter()` → Auto-refresh all pages
  - 🎭 Call Animator → `callAnimator()` → Auto-refresh all pages
  - 💳 Request Bill → `requestBill()` → Auto-refresh all pages

#### **`/t/:tableNumber` (TableOptions) - Table Selection**
- **Purpose**: Table-specific options page
- **Connections**:
  - → `/menu?table=Table_XX` - Navigate to menu for selected table
- **Features**: Checks daily menu availability

#### **PremiumMenu** (rendered via Index with `?table` param)
- **Purpose**: VIP/Premium customer menu
- **Connections**:
  - → `/` - Back to home
- **Actions**: Same as CustomerMenu

---

### **3. Staff/Admin Pages**

#### **`/admin` (StaffDashboard) - Main Staff Dashboard**
- **Purpose**: Monitor all tables, orders, and requests
- **Connections**:
  - → `/admin/menu` - Menu Editor button
  - → `/admin/kids-zone` - Kids Zone Admin button
- **Features**:
  - Real-time order monitoring
  - Table status management
  - Order completion
  - Mark tables as paid
  - Manual refresh button
  - Revenue report modal

#### **`/admin/menu` (MenuEditor) - Menu Management**
- **Purpose**: Edit menu items and daily menu assignments
- **Connections**:
  - → `/admin` - Back button
- **Features**:
  - Add/Edit/Delete menu items
  - Daily menu assignment
  - Real-time menu updates

#### **`/admin/kids-zone` (KidsZoneAdmin) - Kids Zone Management**
- **Purpose**: Monitor kids zone requests and timers
- **Connections**:
  - → `/admin` - Back button
- **Features**:
  - View all animator requests
  - Monitor timer status
  - View child locations

#### **`/animator` (KidsZoneDashboard) - Animator Dashboard**
- **Purpose**: Animator interface for managing kids
- **Connections**: None (standalone)
- **Features**:
  - Accept animator requests
  - Manage child sessions
  - Return children to tables
  - Timer management
- **Actions** (trigger refresh):
  - ✅ Return Child → `returnChildToTable()` → Auto-refresh all pages

---

## 🔄 Real-Time Data Flow

### **Central Data Hub: RestaurantContext**

All pages connect through `RestaurantContext` which provides:

```
RestaurantContext (src/context/RestaurantContext.tsx)
├── Real-Time Subscriptions (Supabase)
│   ├── cart_items changes
│   ├── table_requests changes ⚡ (0ms instant feedback)
│   ├── menu_items changes
│   ├── restaurant_tables changes
│   └── daily_menu_assignments changes
│
├── State Management
│   ├── tables: Record<string, TableSession>
│   ├── menuItems: MenuItem[]
│   ├── loading: boolean
│   └── realtimeUpdateVersion: number
│
└── Actions (all trigger auto-refresh)
    ├── submitOrder() → loadTableSessions()
    ├── callWaiter() → loadTableSessions()
    ├── callAnimator() → loadTableSessions()
    ├── requestBill() → loadTableSessions()
    ├── completeRequest() → loadTableSessions()
    ├── markAsPaid() → loadTableSessions()
    ├── returnChildToTable() → loadTableSessions()
    └── loadDailyMenu() → loadTableSessions()
```

---

## 📡 Auto-Refresh Connections

### **When Customer Actions Trigger Refresh:**

1. **CustomerMenu** actions:
   - Submit Order → `submitOrder()` → All pages refresh
   - Call Waiter → `callWaiter()` → All pages refresh
   - Call Animator → `callAnimator()` → All pages refresh
   - Request Bill → `requestBill()` → All pages refresh

2. **KidsZoneDashboard** actions:
   - Return Child → `returnChildToTable()` → All pages refresh

3. **MenuEditor** actions:
   - Load Daily Menu → `loadDailyMenu()` → All pages refresh

### **Real-Time Subscription Triggers:**

```
Database Change → Supabase Realtime → RestaurantContext
                                      ↓
                              loadTableSessions(true) [Silent]
                                      ↓
                              Update tables state
                                      ↓
                              Increment realtimeUpdateVersion
                                      ↓
                              All Pages Re-render
```

### **Instant (0ms) Feedback System:**

```
New Order INSERT → Subscription Callback (0ms)
                        ↓
              onNewOrderCallbackRef.current() (0ms)
                        ↓
              StaffDashboard: setIsRefreshing(true) (0ms)
                        ↓
              playAlertSound() (0ms)
                        ↓
              Visual + Audio Feedback (0ms)
```

---

## 🎯 Page Dependencies

### **Pages Using RestaurantContext:**

1. ✅ **ClientTables** - `getTableSession()`
2. ✅ **CustomerMenu** - Full context (tables, menuItems, actions)
3. ✅ **PremiumMenu** - Full context
4. ✅ **TableOptions** - `getDailyMenuItems()`
5. ✅ **StaffDashboard** - Full context + instant callback
6. ✅ **MenuEditor** - Full context
7. ✅ **KidsZoneAdmin** - `tables`
8. ✅ **KidsZoneDashboard** - Full context

### **Pages with Real-Time Subscriptions:**

- **RestaurantContext** (Global):
  - All 5 subscriptions active for all pages
  
- **CustomerMenu** (Local):
  - `daily_menu_assignments` subscription

---

## 🔐 Route Protection & Access

### **Public Routes** (No Auth Required):
- `/` - ClientTables
- `/menu` - CustomerMenu
- `/t/:tableNumber` - TableOptions
- `/index` - Index
- `*` - NotFound

### **Staff Routes** (Lazy Loaded):
- `/admin` - StaffDashboard
- `/admin/menu` - MenuEditor
- `/admin/kids-zone` - KidsZoneAdmin
- `/animator` - KidsZoneDashboard

---

## 📊 Data Refresh Matrix

| Action | Source Page | Target Pages | Method | Timing |
|--------|------------|--------------|--------|--------|
| Submit Order | CustomerMenu | All | `submitOrder()` → `loadTableSessions()` | Immediate |
| Call Waiter | CustomerMenu | All | `callWaiter()` → `loadTableSessions()` | Immediate |
| Call Animator | CustomerMenu | All | `callAnimator()` → `loadTableSessions()` | Immediate |
| Request Bill | CustomerMenu | All | `requestBill()` → `loadTableSessions()` | Immediate |
| Complete Request | StaffDashboard | All | `completeRequest()` → Real-time | Real-time |
| Mark as Paid | StaffDashboard | All | `markAsPaid()` → `loadTableSessions()` | Immediate |
| Return Child | KidsZoneDashboard | All | `returnChildToTable()` → `loadTableSessions()` | Immediate |
| Load Daily Menu | MenuEditor | All | `loadDailyMenu()` → `loadTableSessions()` | Immediate |
| Manual Refresh | StaffDashboard | All | `loadTableSessions()` | On Click |
| Database Change | Any | All | Real-time Subscription → `loadTableSessions(true)` | 0ms (instant) |

---

## 🎨 Visual Connection Map

```
                    ┌─────────────┐
                    │   Index     │
                    │  (Hub)      │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ ClientTables │   │ CustomerMenu │   │ StaffDashboard│
│   (Home)     │   │  (Ordering)  │   │  (Admin)     │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │
       │                  │                  ├───► MenuEditor
       │                  │                  ├───► KidsZoneAdmin
       │                  │                  │
       ▼                  │                  │
┌──────────────┐          │                  │
│TableOptions  │          │                  │
└──────┬───────┘          │                  │
       │                  │                  │
       └──────────────────┘                  │
              │                               │
              ▼                               ▼
    ┌─────────────────┐            ┌─────────────────┐
    │ RestaurantContext│◄──────────┤  Supabase DB    │
    │  (Data Hub)      │            │  (Real-time)    │
    └─────────────────┘            └─────────────────┘
              │
              ├──► All Pages Auto-Refresh
              ├──► 0ms Instant Feedback
              └──► Real-time Subscriptions
```

---

## 🚀 Key Features

### **1. Real-Time Synchronization**
- All pages stay in sync via Supabase real-time subscriptions
- Changes propagate instantly across all open tabs/devices

### **2. Instant Feedback (0ms)**
- New orders trigger instant visual + audio feedback
- No React render delay - callback fires immediately

### **3. Auto-Refresh on Actions**
- Every customer action triggers automatic refresh
- Seamless updates without loading spinners (silent mode)

### **4. Centralized State**
- Single source of truth: `RestaurantContext`
- All pages consume the same data
- Consistent state across the application

---

## 📝 Notes

- **Lazy Loading**: Admin pages (`StaffDashboard`, `MenuEditor`) are lazy-loaded for performance
- **Silent Refresh**: Background refreshes use `loadTableSessions(true)` to avoid loading spinners
- **Optimistic Updates**: UI updates immediately, then syncs with database
- **Error Handling**: All actions have proper error handling and rollback mechanisms
