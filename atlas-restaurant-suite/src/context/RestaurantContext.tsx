import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { retryWithBackoff } from '@/utils/optimization';

// Default menu items data
export const defaultMenuItems = [
  { id: '1', cat: "🥣 Супи", name: "Пилешка супа", price: 3.50 },
  { id: '2', cat: "🥣 Супи", name: "Супа топчета", price: 3.80 },
  { id: '3', cat: "🥗 Салати", name: "Шопска салата", price: 5.50 },
  { id: '4', cat: "🥗 Салати", name: "Зелена салата", price: 4.80 },
  { id: '5', cat: "🍛 Основни", name: "Свинско с ориз", price: 6.90 },
  { id: '6', cat: "🍛 Основни", name: "Мусака", price: 5.50 },
  { id: '7', cat: "🍛 Основни", name: "Пилешко филе с картофи", price: 7.50 },
];

export interface MenuItem {
  id: string;
  cat: string;
  name: string;
  price: number;
  desc?: string;
  description?: string; // Database field name
}

// Premium menu items
export const premiumMenuItems = [
  { id: 'p1', cat: "🥂 Appetizers", name: "Truffle Carpaccio", desc: "Aged beef with black truffle shavings", price: 18.50 },
  { id: 'p2', cat: "🥂 Appetizers", name: "Lobster Bisque", desc: "Creamy soup with cognac finish", price: 14.00 },
  { id: 'p3', cat: "🍷 Mains", name: "Wagyu Ribeye", desc: "A5 Japanese wagyu, 250g", price: 85.00 },
  { id: 'p4', cat: "🍷 Mains", name: "Dover Sole Meunière", desc: "Whole fish, brown butter, capers", price: 45.00 },
  { id: 'p5', cat: "🍷 Mains", name: "Duck à l'Orange", desc: "Classic French preparation", price: 38.00 },
  { id: 'p6', cat: "🍰 Desserts", name: "Crème Brûlée", desc: "Madagascar vanilla, caramelized", price: 12.00 },
  { id: 'p7', cat: "🍰 Desserts", name: "Chocolate Soufflé", desc: "Valrhona dark, 15min preparation", price: 16.00 },
];

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface TableRequest {
  id: string;
  action: string;
  details: string;
  total: number;
  status: 'pending' | 'confirmed' | 'completed';
  timestamp: number;
  paymentMethod?: 'cash' | 'card';
  source?: 'nfc' | 'qr' | 'direct';
  requestType?: 'waiter' | 'bill' | 'animator' | 'order' | 'kids_zone';
  assignedTo?: string;
  // Kids zone timer fields
  childLocation?: 'table' | 'kids_zone' | 'returning_to_table';
  timerStartedAt?: number; // timestamp when child entered kids zone
  timerPausedAt?: number; // timestamp when timer was paused (child returned to table)
  totalTimeElapsed?: number; // total seconds in kids zone
  hourlyRate?: number; // price per hour (default 10.00 EUR)
}

export interface TableSession {
  tableId: string;
  isLocked: boolean;
  cart: CartItem[];
  requests: TableRequest[];
  isVip: boolean;
}

export interface CustomerRating {
  id: string;
  tableId: string;
  rating: number;
  feedback?: string;
  googleReviewSent: boolean;
  createdAt: string;
}

export interface DailyMenuAssignment {
  id: string;
  menuItemId: string;
  date: string;
  isVisible: boolean;
}

export interface RevenueReport {
  total: number;
  orderCount: number;
  date: string;
}

interface RestaurantContextType {
  tables: Record<string, TableSession>;
  menuItems: MenuItem[];
  loading: boolean;
  realtimeUpdateVersion: number; // Version counter that increments on real-time updates to force re-renders
  getTableSession: (tableId: string, isVip?: boolean) => TableSession;
  addToCart: (tableId: string, item: CartItem) => Promise<void>;
  removeFromCart: (tableId: string, itemId: string) => Promise<void>;
  updateCartQuantity: (tableId: string, itemId: string, quantity: number) => Promise<void>;
  clearCart: (tableId: string) => Promise<void>;
  submitOrder: (tableId: string, source?: 'nfc' | 'qr' | 'direct') => Promise<void>;
  callWaiter: (tableId: string, source?: 'nfc' | 'qr' | 'direct') => Promise<void>;
  callAnimator: (tableId: string, source?: 'nfc' | 'qr' | 'direct') => Promise<void>;
  requestBill: (tableId: string, paymentMethod: 'cash' | 'card', source?: 'nfc' | 'qr' | 'direct') => Promise<void>;
  completeRequest: (tableId: string, requestId: string) => Promise<void>;
  completeAnimatorRequest: (tableId: string, requestId: string, animatorName: string) => Promise<void>;
  returnChildToTable: (tableId: string, requestId: string) => Promise<void>;
  takeChildBackToZone: (tableId: string, requestId: string) => Promise<void>;
  completeChildSession: (tableId: string, requestId: string) => Promise<void>;
  /** Complete session (timer + charge) and remove animator request from table when kid is back at table */
  clearAnimatorRequestAfterReturn: (tableId: string, requestId: string) => Promise<void>;
  markAsPaid: (tableId: string) => Promise<void>;
  markBillRequestsAsPaid: (tableId: string) => Promise<void>;
  resetTable: (tableId: string) => Promise<void>;
  getCartTotal: (tableId: string) => number;
  getCartItemCount: (tableId: string) => number;
  // Menu management
  addMenuItem: (item: Omit<MenuItem, 'id'>) => Promise<void>;
  updateMenuItem: (id: string, item: Partial<MenuItem>) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
  // Daily menu
  getDailyMenuItems: (date?: string) => Promise<MenuItem[]>;
  setDailyMenuItems: (date: string, itemIds: string[]) => Promise<void>;
  toggleDailyMenuItemVisibility: (itemId: string, date: string, isVisible: boolean) => Promise<void>;
  // Category order
  getCategoryOrder: () => Promise<string[]>;
  setCategoryOrder: (order: string[]) => Promise<void>;
  // Item order per category
  getItemOrder: (category: string) => Promise<string[]>;
  setItemOrder: (category: string, itemIds: string[]) => Promise<void>;
  // Ratings
  submitRating: (tableId: string, rating: number, feedback?: string) => Promise<void>;
  // Reports
  getRevenueReport: (date: string) => Promise<RevenueReport>;
  getPendingOrders: () => TableRequest[];
  // Manual refresh
  loadTableSessions: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

const defaultTables: Record<string, TableSession> = {};
for (let i = 1; i <= 10; i++) {
  const tableId = `Table_${String(i).padStart(2, '0')}`;
  defaultTables[tableId] = {
    tableId,
    isLocked: false,
    cart: [],
    requests: [],
    isVip: false,
  };
}

// Database types
interface DatabaseMenuItem {
  id: string;
  cat: string;
  name: string;
  price: number | string;
  description?: string | null;
}

interface DatabaseCartItem {
  menu_item_id: string;
  quantity: number;
  menu_items: DatabaseMenuItem | null;
}

interface DatabaseError {
  code?: string;
  message?: string;
}

// Helper function to map database item to MenuItem
const mapMenuItem = (item: DatabaseMenuItem): MenuItem => ({
  id: item.id,
  cat: item.cat,
  name: item.name,
  price: parseFloat(String(item.price)),
  desc: item.description || undefined,
  description: item.description || undefined,
});

export const RestaurantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tables, setTables] = useState<Record<string, TableSession>>(defaultTables);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(defaultMenuItems);
  const [loading, setLoading] = useState(true);
  const [paidTables, setPaidTables] = useState<Set<string>>(new Set()); // Track tables that were just marked as paid
  const [lastCleanup, setLastCleanup] = useState<number>(0); // Track last cleanup time
  const [realtimeUpdateVersion, setRealtimeUpdateVersion] = useState<number>(0); // Force re-render on real-time updates
  
  // Ref to store the latest loadTableSessions function for subscriptions
  const loadTableSessionsRef = useRef<() => Promise<void>>();
  // Ref to store current tables for change detection (avoids dependency issues)
  const tablesRef = useRef<Record<string, TableSession>>(tables);
  // Ref to store instant new order callback (0ms detection)
  const onNewOrderCallbackRef = useRef<((requestType: string, tableId: string) => void) | null>(null);
  
  // Cross-tab broadcast for instant cross-tab/cross-window communication (0ms, no database)
  // Compatible with all devices (uses BroadcastChannel when available, localStorage fallback otherwise)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const broadcastRef = useRef<any>(null); // CrossTabBroadcast instance
  
  // Initialize cross-tab broadcast for instant frontend-to-frontend updates
  useEffect(() => {
    // Import and initialize cross-tab broadcast (works on all devices)
    import('../utils/crossTabBroadcast').then(({ getCrossTabBroadcast }) => {
      const broadcast = getCrossTabBroadcast();
      broadcastRef.current = broadcast;
      
      // Subscribe to messages from other tabs/windows
      const unsubscribe = broadcast.onMessage((message) => {
        const { type, payload, timestamp } = message;
        console.log(`📡 Cross-tab broadcast received: ${type} (latency: ${Date.now() - timestamp}ms)`);
      
      if (type === 'NEW_REQUEST') {
        // Instantly update local state with the new request (0ms, no database)
        const { tableId, request } = payload;
        
        setTables(prev => {
          const updated = { ...prev };
          if (!updated[tableId]) {
            updated[tableId] = {
              tableId,
              isLocked: false,
              cart: [],
              requests: [],
              isVip: false,
            };
          }
          
          // Check if request already exists (avoid duplicates)
          const exists = updated[tableId].requests.some(r => 
            r.id === request.id || 
            (r.timestamp === request.timestamp && r.requestType === request.requestType)
          );
          
          if (!exists) {
            updated[tableId] = {
              ...updated[tableId],
              requests: [...updated[tableId].requests, request],
            };
            console.log(`⚡ INSTANT UPDATE (0ms): Added ${request.requestType} to ${tableId} via cross-tab broadcast`);
          }
          
          return updated;
        });
        
        // Update refs
        tablesRef.current = {
          ...tablesRef.current,
          [tableId]: {
            ...tablesRef.current[tableId] || {
              tableId,
              isLocked: false,
              cart: [],
              requests: [],
              isVip: false,
            },
            requests: [...(tablesRef.current[tableId]?.requests || []), request],
          },
        };
        
        // Force re-render
        setRealtimeUpdateVersion(prev => prev + 1);
        
        // Trigger instant feedback (sound, visual)
        if (onNewOrderCallbackRef.current && request.status === 'pending') {
          try {
            onNewOrderCallbackRef.current(request.requestType || 'unknown', tableId);
            console.log(`🔊 Instant feedback triggered via cross-tab broadcast`);
          } catch (error) {
            console.error('Error in instant feedback callback:', error);
          }
        }
      } else if (type === 'REQUEST_UPDATED') {
        // Instantly update request status (0ms, no database)
        const { tableId, requestId, updates } = payload;
        const prevReq = tablesRef.current[tableId]?.requests.find((r: { id: string }) => r.id === requestId);
        const isAnimatorCalledToTable = prevReq?.requestType === 'animator' && prevReq?.childLocation === 'kids_zone' && updates?.timestamp;
        
        setTables(prev => {
          const updated = { ...prev };
          if (updated[tableId]) {
            updated[tableId] = {
              ...updated[tableId],
              requests: updated[tableId].requests.map(req =>
                req.id === requestId ? { ...req, ...updates } : req
              ),
            };
          }
          return updated;
        });
        
        setRealtimeUpdateVersion(prev => prev + 1);
        if (isAnimatorCalledToTable && onNewOrderCallbackRef.current) {
          try {
            onNewOrderCallbackRef.current('animator_called_to_table', tableId);
          } catch (e) { /* ignore */ }
        }
        console.log(`⚡ INSTANT UPDATE (0ms): Updated ${requestId} in ${tableId} via cross-tab broadcast`);
      } else if (type === 'REQUEST_REMOVED') {
        const { tableId, requestId } = payload;
        setTables(prev => {
          const updated = { ...prev };
          if (updated[tableId]) {
            updated[tableId] = {
              ...updated[tableId],
              requests: updated[tableId].requests.filter(req => req.id !== requestId),
            };
          }
          return updated;
        });
        tablesRef.current = tablesRef.current[tableId]
          ? {
              ...tablesRef.current,
              [tableId]: {
                ...tablesRef.current[tableId],
                requests: tablesRef.current[tableId].requests.filter((r: { id: string }) => r.id !== requestId),
              },
            }
          : tablesRef.current;
        setRealtimeUpdateVersion(prev => prev + 1);
      } else if (type === 'TABLE_CLEARED') {
        // Instantly clear table (0ms, no database)
        const { tableId } = payload;
        
        setTables(prev => {
          const updated = { ...prev };
          if (updated[tableId]) {
            updated[tableId] = {
              ...updated[tableId],
              isLocked: false,
              requests: [],
              cart: [],
            };
          }
          return updated;
        });
        
        setRealtimeUpdateVersion(prev => prev + 1);
        console.log(`⚡ INSTANT UPDATE (0ms): Cleared ${tableId} via cross-tab broadcast`);
      } else if (type === 'CART_UPDATED') {
        // Instantly update cart (0ms, no database)
        const { tableId, cart } = payload;
        
        setTables(prev => {
          const updated = { ...prev };
          if (updated[tableId]) {
            updated[tableId] = {
              ...updated[tableId],
              cart: cart,
            };
          }
          return updated;
        });
        
        setRealtimeUpdateVersion(prev => prev + 1);
      } else if (type === 'MENU_ITEM_ADDED') {
        // Instantly add menu item (0ms, no database)
        const { item } = payload;
        
        setMenuItems(prev => {
          // Check if item already exists
          if (prev.some(i => i.id === item.id)) return prev;
          return [...prev, item];
        });
        
        console.log(`⚡ INSTANT UPDATE (0ms): Menu item added via cross-tab broadcast - ${item.name}`);
      } else if (type === 'MENU_ITEM_UPDATED') {
        // Instantly update menu item (0ms, no database)
        const { id, updates } = payload;
        
        setMenuItems(prev => prev.map(item =>
          item.id === id ? { ...item, ...updates } : item
        ));
        
        console.log(`⚡ INSTANT UPDATE (0ms): Menu item updated via cross-tab broadcast - ID: ${id}`);
      } else if (type === 'MENU_ITEM_DELETED') {
        // Instantly delete menu item (0ms, no database)
        const { id } = payload;
        
        setMenuItems(prev => prev.filter(item => item.id !== id));
        
        console.log(`⚡ INSTANT UPDATE (0ms): Menu item deleted via cross-tab broadcast - ID: ${id}`);
      } else if (type === 'DAILY_MENU_UPDATED') {
        // Instantly update daily menu (0ms, no database)
        // This triggers a re-render for components watching menuItems
        setRealtimeUpdateVersion(prev => prev + 1);
        
        console.log(`⚡ INSTANT UPDATE (0ms): Daily menu updated via cross-tab broadcast`);
      }
      });
      
      console.log('📡 Cross-tab broadcast initialized for instant frontend-to-frontend updates (compatible with all devices)');
      
      // Cleanup function
      return () => {
        unsubscribe();
        // Note: We don't close the singleton instance here as other components might be using it
        broadcastRef.current = null;
        console.log('📡 Cross-tab broadcast unsubscribed');
      };
    });
  }, []);
  
  // Helper function to broadcast updates to all tabs/windows (0ms)
  const broadcastUpdate = useCallback((type: string, payload: unknown) => {
    if (broadcastRef.current) {
      broadcastRef.current.postMessage(type, payload);
    } else {
      // Fallback: try to get the broadcast instance
      import('../utils/crossTabBroadcast').then(({ getCrossTabBroadcast }) => {
        const broadcast = getCrossTabBroadcast();
        broadcastRef.current = broadcast;
        broadcast.postMessage(type, payload);
      }).catch(error => {
        console.error('Error initializing cross-tab broadcast:', error);
      });
    }
  }, []);
  
  // Extend Window interface for debugging
  interface WindowWithDebug extends Window {
    onNewOrderCallbackRef?: React.MutableRefObject<((requestType: string, tableId: string) => void) | null>;
    subscriptionLogs?: Array<{ name: string; event: string; timestamp: number; details?: string }>;
    getSubscriptionLogs?: () => Array<{ name: string; event: string; timestamp: number; details?: string }>;
  }

  // Expose callback ref to window for StaffDashboard to register
  useEffect(() => {
    (window as WindowWithDebug).onNewOrderCallbackRef = onNewOrderCallbackRef;
    return () => {
      delete (window as WindowWithDebug).onNewOrderCallbackRef;
    };
  }, [onNewOrderCallbackRef]);

  // Load menu items from Supabase
  useEffect(() => {
    const loadMenuItems = async () => {
      try {
        const { data, error } = await supabase
          .from('menu_items')
          .select('*')
          .order('cat', { ascending: true });

        if (error) {
          console.error('Supabase error loading menu items:', error);
          console.error('Error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
          // Fallback to default menu items if Supabase fails
          setMenuItems(defaultMenuItems);
          return;
        }

        if (data && data.length > 0) {
          // Map database fields to interface
          const mappedItems: MenuItem[] = data.map(mapMenuItem);
          setMenuItems(mappedItems);
        } else {
          // If no data, use defaults
          setMenuItems(defaultMenuItems);
        }
      } catch (error) {
        console.error('Error loading menu items:', error);
        // Fallback to default menu items
        setMenuItems(defaultMenuItems);
      }
    };

    loadMenuItems();
  }, []);

  // Load table sessions from Supabase
  // silent: if true, don't show loading spinner (for seamless real-time updates)
  const loadTableSessions = useCallback(async (silent: boolean = false) => {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/d1dcdf1e-0dcf-406d-bcdb-293c197ab831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RestaurantContext.tsx:229',message:'loadTableSessions called',data:{timestamp:Date.now(),callStack:new Error().stack?.split('\n').slice(0,5).join('|')},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    try {
      // Only show loading spinner if not silent (for initial load or manual refresh)
      if (!silent) {
      setLoading(true);
      }
      
      // OPTIMIZATION: Only cleanup completed requests periodically (every 5 minutes)
      // This reduces unnecessary database operations
      const now = Date.now();
      const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
      const shouldCleanup = now - lastCleanup > CLEANUP_INTERVAL;
      
      if (shouldCleanup) {
        // Cleanup: Delete ALL completed requests from table_requests
        const { data: deletedCompleted, error: cleanupError } = await supabase
          .from('table_requests')
          .delete()
          .eq('status', 'completed')
          .select('id');
        
        if (cleanupError) {
          console.warn('Error cleaning up completed requests:', cleanupError);
        } else if (deletedCompleted && deletedCompleted.length > 0) {
          console.log(`🧹 Cleaned up ${deletedCompleted.length} completed request(s) from table_requests`);
        }
        setLastCleanup(now);
      }
      
      // OPTIMIZATION: Load all data in parallel using Promise.all
      // This reduces total loading time significantly
      const [tablesResult, cartResult, requestsResult] = await Promise.all([
        supabase.from('restaurant_tables').select('*'),
        supabase.from('cart_items').select('*, menu_items(id, name, price)'),
        supabase.from('table_requests')
          .select('*')
          .neq('status', 'completed') // Exclude completed requests at database level
          .order('timestamp', { ascending: false })
      ]);

      const { data: tablesData, error: tablesError } = tablesResult;
      const { data: cartData, error: cartError } = cartResult;
      const { data: requestsData, error: requestsError } = requestsResult;

      if (tablesError) {
        console.error('Supabase error loading tables:', tablesError);
        console.error('Error details:', {
          message: tablesError.message,
          details: tablesError.details,
          hint: tablesError.hint,
          code: tablesError.code,
        });
        // Fallback to default tables
        setTables(defaultTables);
        if (!silent) {
        setLoading(false);
        }
        return;
      }

      if (cartError) {
        console.error('Supabase error loading cart items:', cartError);
        // Continue with empty cart if cart fails
      }

      if (requestsError) {
        console.error('Supabase error loading requests:', requestsError);
        // Continue with empty requests if requests fail
      }

      // Build table sessions
      const sessions: Record<string, TableSession> = {};
      
      (tablesData || []).forEach(table => {
        const tableId = table.table_id;
        
        // Get cart items for this table
        const cartItems: CartItem[] = (cartData || [])
          .filter(ci => ci.table_id === tableId)
          .map(ci => {
            const menuItem = ci.menu_items as DatabaseMenuItem | null;
            return {
              id: ci.menu_item_id,
              name: menuItem?.name || '',
              price: parseFloat(String(menuItem?.price || '0')),
              quantity: ci.quantity,
            };
          });

        // Get requests for this table - only show current session requests
        // Filter by session_started_at to hide previous session orders
        // Also hide requests for tables that were just marked as paid
        // IMPORTANT: Never show requests from completed_orders or table_history_archive
        // Only fetch from table_requests and filter by session
        const sessionStartedAt = table.session_started_at 
          ? new Date(table.session_started_at).getTime() 
          : 0;
        
        const requests: TableRequest[] = (requestsData || [])
          .filter(r => {
            // Don't show requests for tables that were just marked as paid
            if (paidTables.has(tableId)) {
              return false;
      }
            
            // Show pending and confirmed requests (confirmed = being prepared)
            // Only hide completed requests (these should be in completed_orders)
            if (r.status === 'completed') {
              console.warn(`⚠️ Found completed request ${r.id} still in table_requests - should be in completed_orders`);
              return false;
            }
            
            // Show both 'pending' and 'confirmed' status requests
            // 'confirmed' means the order is being prepared
            if (r.status !== 'pending' && r.status !== 'confirmed') {
              return false;
            }
            
            // Only show requests from current session (created after session_started_at)
            if (r.table_id === tableId) {
              // If session_started_at exists, only show requests after that time
              // This ensures archived/completed orders stay hidden
              if (sessionStartedAt > 0) {
                const requestTime = typeof r.timestamp === 'string' 
                  ? new Date(r.timestamp).getTime() 
                  : r.timestamp;
                return requestTime >= sessionStartedAt;
              }
              // If no session_started_at, show all (backward compatibility)
              return true;
      }
            return false;
          })
          .map(r => ({
            id: r.id,
            action: r.action,
            details: r.details || '',
            total: parseFloat(r.total || '0'),
            status: r.status as 'pending' | 'confirmed' | 'completed',
            timestamp: r.timestamp,
            paymentMethod: r.payment_method as 'cash' | 'card' | undefined,
            source: r.source as 'nfc' | 'qr' | 'direct' | undefined,
            requestType: r.request_type as 'waiter' | 'bill' | 'animator' | 'order' | 'kids_zone' | undefined,
            assignedTo: r.assigned_to || undefined,
            childLocation: r.child_location as 'table' | 'kids_zone' | 'returning_to_table' | undefined,
            timerStartedAt: r.timer_started_at ? (typeof r.timer_started_at === 'string' ? new Date(r.timer_started_at).getTime() : r.timer_started_at) : undefined,
            timerPausedAt: r.timer_paused_at ? (typeof r.timer_paused_at === 'string' ? new Date(r.timer_paused_at).getTime() : r.timer_paused_at) : undefined,
            totalTimeElapsed: r.total_time_elapsed || undefined,
            hourlyRate: r.hourly_rate ? parseFloat(String(r.hourly_rate)) : undefined,
          }));

        sessions[tableId] = {
          tableId,
          isLocked: table.is_locked,
          cart: cartItems,
          requests,
          isVip: table.is_vip,
        };
  });

      // Create a completely new object to ensure React detects the change
      const newTables = { ...sessions };
      
      // OPTIMIZATION: Only update state if data actually changed
      // This prevents unnecessary re-renders and ensures seamless updates
      const currentTablesJson = JSON.stringify(tablesRef.current);
      const newTablesJson = JSON.stringify(newTables);
      const hasChanges = currentTablesJson !== newTablesJson;
      
      if (hasChanges) {
      // #region agent log
      const tableKeys = Object.keys(newTables);
      const tableCounts = tableKeys.map(k => ({tableId:k,requests:newTables[k].requests.length,cart:newTables[k].cart.length}));
      fetch('http://127.0.0.1:7245/ingest/d1dcdf1e-0dcf-406d-bcdb-293c197ab831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RestaurantContext.tsx:386',message:'setTables called with new data',data:{tableCount:tableKeys.length,tableCounts,newTablesRef:Object.keys(newTables).join(','),sessionsRef:Object.keys(sessions).join(',')},timestamp:Date.now(),runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      setTables(newTables);
        // Update ref with new tables
        tablesRef.current = newTables;
      // Increment version AFTER setTables to force re-render of all components
      setRealtimeUpdateVersion(prev => {
        const newVersion = prev + 1;
        console.log(`🔄 Real-time update version incremented: ${prev} → ${newVersion} (tables updated)`);
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/d1dcdf1e-0dcf-406d-bcdb-293c197ab831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RestaurantContext.tsx:392',message:'realtimeUpdateVersion incremented',data:{prev,newVersion},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        return newVersion;
      });
      } else if (!silent) {
        // Only log if not silent and no changes (for debugging)
        console.log('ℹ️ No changes detected, skipping state update');
      }
      
      if (!silent) {
      setLoading(false);
      }
    } catch (error) {
      console.error('Error loading table sessions:', error);
      // Fallback to default tables on error
      const fallbackTables = { ...defaultTables };
      setTables(fallbackTables);
      // Increment version even on error to trigger re-render
      setRealtimeUpdateVersion(prev => prev + 1);
      if (!silent) {
      setLoading(false);
      }
    }
  }, [lastCleanup, paidTables]); // paidTables is used in filter

  // Update refs whenever they change
  useEffect(() => {
    loadTableSessionsRef.current = loadTableSessions;
    tablesRef.current = tables;
  }, [loadTableSessions, tables]);

  useEffect(() => {
    loadTableSessions();

    // Helper function to call the latest loadTableSessions
    // Uses silent mode for seamless real-time updates (no loading spinner)
    const reloadData = (source?: string) => {
      const startTime = performance.now();
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/d1dcdf1e-0dcf-406d-bcdb-293c197ab831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RestaurantContext.tsx:414',message:'reloadData called',data:{hasRef:!!loadTableSessionsRef.current,source},timestamp:Date.now(),runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      if (loadTableSessionsRef.current) {
        console.log(`🔄 Reloading table sessions from real-time update (silent)${source ? ` - triggered by: ${source}` : ''}...`);
        // Use silent mode for seamless updates - no loading spinner, only updates if data changed
        loadTableSessionsRef.current(true).then(() => {
          const duration = performance.now() - startTime;
          console.log(`✅ Reload completed in ${duration.toFixed(2)}ms${source ? ` (triggered by: ${source})` : ''}`);
        }).catch((error) => {
          console.error(`❌ Reload failed${source ? ` (triggered by: ${source})` : ''}:`, error);
        });
      } else {
        console.warn('⚠️ loadTableSessionsRef.current is not available');
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/d1dcdf1e-0dcf-406d-bcdb-293c197ab831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RestaurantContext.tsx:420',message:'ERROR: loadTableSessionsRef.current is null',data:{},timestamp:Date.now(),runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
      }
    };

    // Track subscription statuses for monitoring and reconnection
    type SubscriptionStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';
    type SubscriptionName = 'cart' | 'requests' | 'menu' | 'tables' | 'dailyMenu';
    
    const subscriptionStatuses: Record<SubscriptionName, SubscriptionStatus> = {
      cart: 'SUBSCRIBED',
      requests: 'SUBSCRIBED',
      menu: 'SUBSCRIBED',
      tables: 'SUBSCRIBED',
      dailyMenu: 'SUBSCRIBED',
    };

    // Track subscription timing logs
    interface SubscriptionLog {
      name: SubscriptionName;
      event: 'SUBSCRIBED' | 'EVENT' | 'ERROR' | 'RECONNECT';
      timestamp: number;
      details?: string;
    }
    
    const subscriptionLogs: SubscriptionLog[] = [];
    const MAX_LOGS = 100; // Keep last 100 logs
    
    const addSubscriptionLog = (name: SubscriptionName, event: SubscriptionLog['event'], details?: string) => {
      const log: SubscriptionLog = {
        name,
        event,
        timestamp: Date.now(),
        details,
      };
      subscriptionLogs.push(log);
      if (subscriptionLogs.length > MAX_LOGS) {
        subscriptionLogs.shift();
      }
      
      const timeStr = new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
      console.log(`[${timeStr}] 📊 Subscription Log: ${name} - ${event}${details ? ` - ${details}` : ''}`);
      
      // Store in window for debugging
      (window as WindowWithDebug).subscriptionLogs = subscriptionLogs;
      (window as WindowWithDebug).getSubscriptionLogs = () => {
        console.table(subscriptionLogs.map(log => ({
          Time: new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }),
          Subscription: log.name,
          Event: log.event,
          Details: log.details || '-',
        })));
        return subscriptionLogs;
      };
    };

    // Function to handle subscription errors and reconnect
    const handleSubscriptionError = (subscriptionName: SubscriptionName, channel: { unsubscribe: () => void }, setupFn: () => void) => {
      const errorTime = performance.now();
      console.error(`❌ ${subscriptionName} subscription error - attempting reconnection...`);
      subscriptionStatuses[subscriptionName] = 'CHANNEL_ERROR';
      addSubscriptionLog(subscriptionName, 'ERROR', 'Connection error - attempting reconnection');
      
      // Remove old channel
      supabase.removeChannel(channel);
      
      // Reconnect after a short delay
      setTimeout(() => {
        const reconnectTime = performance.now();
        const timeSinceError = (reconnectTime - errorTime).toFixed(2);
        console.log(`🔄 Reconnecting ${subscriptionName} subscription (${timeSinceError}ms after error)...`);
        addSubscriptionLog(subscriptionName, 'RECONNECT', `Reconnecting after ${timeSinceError}ms`);
        const reconnectStart = performance.now();
        const newChannel = setupFn();
        newChannel.subscribe((status: string) => {
          const reconnectDuration = performance.now() - reconnectStart;
          subscriptionStatuses[subscriptionName] = status as SubscriptionStatus;
          if (status === 'SUBSCRIBED') {
            console.log(`✅ ${subscriptionName} subscription reconnected successfully (took ${reconnectDuration.toFixed(2)}ms)`);
            addSubscriptionLog(subscriptionName, 'SUBSCRIBED', `Reconnected successfully (${reconnectDuration.toFixed(2)}ms)`);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            addSubscriptionLog(subscriptionName, 'ERROR', `Reconnection failed: ${status}`);
            handleSubscriptionError(subscriptionName, newChannel, setupFn);
          }
        });
      }, 2000);
    };

    // Set up real-time subscriptions with enhanced error handling and reconnection
    const setupCartSubscription = () => {
      const setupTime = performance.now();
      addSubscriptionLog('cart', 'SUBSCRIBED', 'Setting up cart subscription');
      return supabase
      .channel('cart_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'cart_items' },
        (payload) => {
            const eventTime = performance.now();
            const timeSinceSetup = (eventTime - setupTime).toFixed(2);
            console.log(`🛒 Real-time cart_items change (${timeSinceSetup}ms after setup):`, payload.eventType, payload);
            addSubscriptionLog('cart', 'EVENT', `${payload.eventType} - table_id: ${payload.new?.table_id || payload.old?.table_id || 'unknown'}`);
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/d1dcdf1e-0dcf-406d-bcdb-293c197ab831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RestaurantContext.tsx:430',message:'Cart subscription callback fired',data:{eventType:payload.eventType,hasNew:!!payload.new,hasOld:!!payload.old},timestamp:Date.now(),runId:'run1',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          // Immediate reload for instant cart updates
            reloadData('cart subscription');
          }
        );
    };

    const cartSubscription = setupCartSubscription();
    const cartSubscribeStart = performance.now();
    cartSubscription.subscribe((status) => {
      const subscribeTime = performance.now() - cartSubscribeStart;
      console.log(`📡 Cart subscription status: ${status} (took ${subscribeTime.toFixed(2)}ms to subscribe)`);
      subscriptionStatuses.cart = status as SubscriptionStatus;
      addSubscriptionLog('cart', status === 'SUBSCRIBED' ? 'SUBSCRIBED' : 'ERROR', `Status: ${status} (${subscribeTime.toFixed(2)}ms)`);
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/d1dcdf1e-0dcf-406d-bcdb-293c197ab831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RestaurantContext.tsx:436',message:'Cart subscription status changed',data:{status},timestamp:Date.now(),runId:'run1',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
      
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        addSubscriptionLog('cart', 'ERROR', `Connection failed: ${status}`);
        handleSubscriptionError('cart', cartSubscription, setupCartSubscription);
      }
    });

    // Most critical subscription - handles all order/request updates
    const setupRequestsSubscription = () => {
      const setupTime = performance.now();
      addSubscriptionLog('requests', 'SUBSCRIBED', 'Setting up requests subscription');
      return supabase
      .channel('requests_changes')
      .on('postgres_changes',
        { 
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public', 
          table: 'table_requests' 
        },
        (payload) => {
            const eventTime = performance.now();
            const timeSinceSetup = (eventTime - setupTime).toFixed(2);
            const requestType = payload.new?.request_type || payload.old?.request_type;
            const tableId = payload.new?.table_id || payload.old?.table_id || 'unknown';
            console.log(`🔔 Real-time table_requests change (${timeSinceSetup}ms after setup):`, payload.eventType, `type: ${requestType}, table: ${tableId}`);
            addSubscriptionLog('requests', 'EVENT', `${payload.eventType} - type: ${requestType}, table: ${tableId}`);
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/d1dcdf1e-0dcf-406d-bcdb-293c197ab831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RestaurantContext.tsx:448',message:'Requests subscription callback fired',data:{eventType:payload.eventType,hasNew:!!payload.new,hasOld:!!payload.old,requestType:payload.new?.request_type||payload.old?.request_type},timestamp:Date.now(),runId:'run1',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          
          // Check if this is an animator request
          const isAnimatorRequest = requestType === 'animator';
          
          if (payload.eventType === 'INSERT') {
              const eventStartTime = performance.now();
              const realRequestId = payload.new?.id;
              const insertTableId = payload.new?.table_id || 'unknown';
              const status = payload.new?.status || 'unknown';
              const insertTimestamp = payload.new?.timestamp;
              
              // Check if we already have this order (from optimistic update)
              const existingTable = tablesRef.current[insertTableId];
              const hasOptimisticOrder = existingTable?.requests.some(
                req => req.id.startsWith('temp_') && 
                       req.timestamp === insertTimestamp &&
                       req.requestType === requestType
              );
              
              if (hasOptimisticOrder) {
                // Replace optimistic order with real one from database
                console.log(`🔄 Replacing optimistic order with real database order - Temp → Real ID: ${realRequestId}`);
                setTables(prev => {
                  const updated = { ...prev };
                  if (updated[insertTableId]) {
                    updated[insertTableId] = {
                      ...updated[insertTableId],
                      requests: updated[insertTableId].requests.map(req => {
                        if (req.id.startsWith('temp_') && req.timestamp === insertTimestamp && req.requestType === requestType) {
                          return {
                            ...req,
                            id: realRequestId,
                            details: payload.new?.details || req.details,
                            total: parseFloat(payload.new?.total || String(req.total)),
                          };
                        }
                        return req;
                      }),
                    };
                  }
                  return updated;
                });
                
                // Update refs
                tablesRef.current = {
                  ...tablesRef.current,
                  [insertTableId]: {
                    ...tablesRef.current[insertTableId],
                    requests: tablesRef.current[insertTableId].requests.map(req => {
                      if (req.id.startsWith('temp_') && req.timestamp === insertTimestamp && req.requestType === requestType) {
                        return {
                          ...req,
                          id: realRequestId,
                          details: payload.new?.details || req.details,
                          total: parseFloat(payload.new?.total || String(req.total)),
                        };
                      }
                      return req;
                    }),
                  },
                };
                
                console.log(`✅ Optimistic order replaced with real database order`);
                // Don't trigger feedback again - already triggered by optimistic update
              } else {
                // New order from another client/device - add it and trigger feedback
                console.log(`✅ New request received from another source (${requestType}) - reloading data...`);
                
                // INSTANT (0ms) feedback - trigger callback immediately for new pending orders
                // Only trigger for pending orders (not confirmed/completed)
                if (onNewOrderCallbackRef.current && status === 'pending') {
                  const callbackStart = performance.now();
                  try {
                    onNewOrderCallbackRef.current(requestType || 'unknown', insertTableId);
                    const callbackDuration = performance.now() - callbackStart;
                    console.log(`⚡ INSTANT (${callbackDuration.toFixed(3)}ms) feedback triggered! requestType: ${requestType}, table: ${insertTableId}, status: ${status}`);
                    addSubscriptionLog('requests', 'EVENT', `INSTANT FEEDBACK - ${requestType} (${callbackDuration.toFixed(3)}ms)`);
                  } catch (error) {
                    console.error('Error in instant feedback callback:', error);
                  }
                } else if (status !== 'pending') {
                  console.log(`⏭️ Skipping instant feedback - status is ${status} (not pending)`);
                }
                
                // Immediate reload for new requests from other sources
                reloadData(`requests subscription - INSERT ${requestType}`);
              }
              
              const totalTime = performance.now() - eventStartTime;
              console.log(`⏱️ Total INSERT handling time: ${totalTime.toFixed(2)}ms`);
          } else if (payload.eventType === 'UPDATE') {
              console.log(`✅ Request updated (${requestType}) - reloading data...`);
            // Immediate reload for all request updates (orders, bills, animator, etc.)
              reloadData(`requests subscription - UPDATE ${requestType}`);
          } else if (payload.eventType === 'DELETE') {
              console.log(`✅ Request deleted (${requestType}) - reloading data...`);
            // Immediate reload when requests are deleted (table paid/reset, etc.)
              reloadData(`requests subscription - DELETE ${requestType}`);
            }
          }
        );
    };

    const requestsSubscription = setupRequestsSubscription();
    const requestsSubscribeStart = performance.now();
    requestsSubscription.subscribe((status) => {
      const subscribeTime = performance.now() - requestsSubscribeStart;
      console.log(`📡 Requests subscription status: ${status} (took ${subscribeTime.toFixed(2)}ms to subscribe)`);
      subscriptionStatuses.requests = status as SubscriptionStatus;
      addSubscriptionLog('requests', status === 'SUBSCRIBED' ? 'SUBSCRIBED' : 'ERROR', `Status: ${status} (${subscribeTime.toFixed(2)}ms)`);
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/d1dcdf1e-0dcf-406d-bcdb-293c197ab831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RestaurantContext.tsx:495',message:'Requests subscription status changed',data:{status},timestamp:Date.now(),runId:'run1',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
      
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        addSubscriptionLog('requests', 'ERROR', `Connection failed: ${status}`);
        handleSubscriptionError('requests', requestsSubscription, setupRequestsSubscription);
      }
      });

    // OPTIMIZATION: Selective real-time updates - only update changed items
    // This avoids full reloads and improves performance significantly
    const setupMenuSubscription = () => {
      const setupTime = performance.now();
      addSubscriptionLog('menu', 'SUBSCRIBED', 'Setting up menu subscription');
      return supabase
      .channel('menu_changes')
      .on('postgres_changes',
        { 
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public', 
          table: 'menu_items' 
        },
        (payload) => {
            const eventTime = performance.now();
            const timeSinceSetup = (eventTime - setupTime).toFixed(2);
            console.log(`🍽️ Real-time menu_items change (${timeSinceSetup}ms after setup):`, payload.eventType, payload);
            addSubscriptionLog('menu', 'EVENT', `${payload.eventType} - item_id: ${payload.new?.id || payload.old?.id || 'unknown'}`);
          
          // Force re-render on menu changes
          setRealtimeUpdateVersion(prev => prev + 1);
          
          if (payload.eventType === 'INSERT' && payload.new) {
            // Add new item without reloading all items
            const newItem = mapMenuItem(payload.new);
            setMenuItems(prev => {
              // Check if item already exists (avoid duplicates)
              if (prev.find(item => item.id === newItem.id)) {
                return prev;
              }
              return [...prev, newItem].sort((a, b) => {
                const catA = a.cat || '';
                const catB = b.cat || '';
                return catA.localeCompare(catB);
              });
            });
            console.log(`✅ Added menu item in real-time: ${newItem.name}`);
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            // Update existing item without reloading all items
            const updatedItem = mapMenuItem(payload.new);
            setMenuItems(prev => prev.map(item => 
              item.id === updatedItem.id ? updatedItem : item
            ));
            console.log(`✅ Updated menu item in real-time: ${updatedItem.name}`);
          } else if (payload.eventType === 'DELETE' && payload.old) {
            // Remove deleted item without reloading all items
            const deletedId = payload.old.id;
            setMenuItems(prev => prev.filter(item => item.id !== deletedId));
            console.log(`✅ Deleted menu item in real-time: ${deletedId}`);
          }
        }
        );
    };

    const menuSubscription = setupMenuSubscription();
    const menuSubscribeStart = performance.now();
    menuSubscription.subscribe((status) => {
      const subscribeTime = performance.now() - menuSubscribeStart;
      console.log(`📡 Menu subscription status: ${status} (took ${subscribeTime.toFixed(2)}ms to subscribe)`);
      subscriptionStatuses.menu = status as SubscriptionStatus;
      addSubscriptionLog('menu', status === 'SUBSCRIBED' ? 'SUBSCRIBED' : 'ERROR', `Status: ${status} (${subscribeTime.toFixed(2)}ms)`);
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/d1dcdf1e-0dcf-406d-bcdb-293c197ab831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RestaurantContext.tsx:548',message:'Menu subscription status changed',data:{status},timestamp:Date.now(),runId:'run1',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
      
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        addSubscriptionLog('menu', 'ERROR', `Connection failed: ${status}`);
        handleSubscriptionError('menu', menuSubscription, setupMenuSubscription);
      }
      });

    // Real-time subscription for restaurant_tables changes
    const setupTablesSubscription = () => {
      return supabase
      .channel('tables_changes')
      .on('postgres_changes',
        { 
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public', 
          table: 'restaurant_tables' 
        },
        (payload) => {
          console.log('🪑 Real-time restaurant_tables change:', payload.eventType, payload);
          // Immediate reload for instant table status updates
          reloadData();
        }
        );
    };

    const tablesSubscription = setupTablesSubscription();
    tablesSubscription.subscribe((status) => {
        console.log('📡 Tables subscription status:', status);
      subscriptionStatuses.tables = status as SubscriptionStatus;
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/d1dcdf1e-0dcf-406d-bcdb-293c197ab831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RestaurantContext.tsx:567',message:'Tables subscription status changed',data:{status},timestamp:Date.now(),runId:'run1',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
      
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        handleSubscriptionError('tables', tablesSubscription, setupTablesSubscription);
      }
      });

    // Real-time subscription for daily_menu_assignments changes
    // Immediate reload for MenuEditor to see changes instantly
    const setupDailyMenuSubscription = () => {
      return supabase
      .channel('daily_menu_changes')
      .on('postgres_changes',
        { 
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public', 
          table: 'daily_menu_assignments' 
        },
        (payload) => {
          console.log('📅 Real-time daily_menu_assignments change:', payload.eventType, payload);
          // Immediate reload for MenuEditor to see daily menu changes instantly
          reloadData();
        }
        );
    };

    const dailyMenuSubscription = setupDailyMenuSubscription();
    dailyMenuSubscription.subscribe((status) => {
        console.log('📡 Daily menu subscription status:', status);
      subscriptionStatuses.dailyMenu = status as SubscriptionStatus;
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/d1dcdf1e-0dcf-406d-bcdb-293c197ab831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RestaurantContext.tsx:587',message:'Daily menu subscription status changed',data:{status},timestamp:Date.now(),runId:'run1',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
      
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        handleSubscriptionError('dailyMenu', dailyMenuSubscription, setupDailyMenuSubscription);
      }
      });

    return () => {
      console.log('🧹 Cleaning up real-time subscriptions');
      supabase.removeChannel(cartSubscription);
      supabase.removeChannel(requestsSubscription);
      supabase.removeChannel(menuSubscription);
      supabase.removeChannel(tablesSubscription);
      supabase.removeChannel(dailyMenuSubscription);
    };
  }, [loadTableSessions]); // Include loadTableSessions for consistency

  const getTableSession = useCallback((tableId: string, isVip = false): TableSession => {
    if (tables[tableId]) {
      return { ...tables[tableId], isVip };
    }
    return {
      tableId,
      isLocked: false,
      cart: [],
      requests: [],
      isVip,
    };
  }, [tables]);

  const addToCart = useCallback(async (tableId: string, item: CartItem) => {
    // Optimistic update: update local state immediately
    setTables(prev => {
      const updated = { ...prev };
      if (!updated[tableId]) {
        updated[tableId] = {
          tableId,
          isLocked: false,
          cart: [],
          requests: [],
          isVip: false,
        };
      }
      
      const existingCartItem = updated[tableId].cart.find(ci => ci.id === item.id);
      if (existingCartItem) {
        updated[tableId] = {
          ...updated[tableId],
          cart: updated[tableId].cart.map(ci =>
            ci.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
          ),
        };
      } else {
        updated[tableId] = {
          ...updated[tableId],
          cart: [...updated[tableId].cart, { ...item, quantity: 1 }],
        };
      }
      return updated;
    });

    try {
      // Check if item already exists in cart (use maybeSingle to avoid error when not found)
      const { data: existingCartItem, error: selectError } = await supabase
        .from('cart_items')
        .select('*')
        .eq('table_id', tableId)
        .eq('menu_item_id', item.id)
        .maybeSingle();

      if (selectError && selectError.code !== 'PGRST116') {
        // PGRST116 is "not found" which is expected, ignore it
        throw selectError;
      }

      if (existingCartItem) {
        // Update quantity
        const { error: updateError } = await supabase
          .from('cart_items')
          .update({ quantity: existingCartItem.quantity + 1 })
          .eq('id', existingCartItem.id);
        
        if (updateError) {
          console.error('Error updating cart item:', updateError);
          // Rollback optimistic update on error
          loadTableSessions();
          throw updateError;
        }
      } else {
        // Insert new cart item
        const { error: insertError } = await supabase
          .from('cart_items')
          .insert({
            id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            table_id: tableId,
            menu_item_id: item.id,
            quantity: 1,
          });
        
        if (insertError) {
          console.error('Error inserting cart item:', insertError);
          // Rollback optimistic update on error
          loadTableSessions();
          throw insertError;
        }
      }
      // Real-time subscription will sync the state, but optimistic update makes UI feel instant
    } catch (error) {
      console.error('Error adding to cart:', error);
      // Rollback on error - reload from server
      loadTableSessions();
      // Retry with exponential backoff for network errors
      const dbError = error as DatabaseError;
      if (dbError?.code === 'PGRST301' || dbError?.message?.includes('fetch')) {
        try {
          await retryWithBackoff(async () => {
            const { data: existingCartItem } = await supabase
              .from('cart_items')
              .select('*')
              .eq('table_id', tableId)
              .eq('menu_item_id', item.id)
              .maybeSingle();
            
            if (existingCartItem) {
              await supabase
                .from('cart_items')
                .update({ quantity: existingCartItem.quantity + 1 })
                .eq('id', existingCartItem.id);
            } else {
              await supabase
                .from('cart_items')
                .insert({
                  id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  table_id: tableId,
                  menu_item_id: item.id,
                  quantity: 1,
                });
            }
          }, 3, 1000);
          loadTableSessions(); // Reload after successful retry
        } catch (retryError) {
          throw error; // Throw original error if retry fails
        }
      } else {
        throw error; // Re-throw so UI can handle it
          }
    }
  }, [loadTableSessions]);

  const removeFromCart = useCallback(async (tableId: string, itemId: string) => {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('table_id', tableId)
        .eq('menu_item_id', itemId);
      
      if (error) {
        console.error('Error removing from cart:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw error;
    }
  }, []);

  const updateCartQuantity = useCallback(async (tableId: string, itemId: string, quantity: number) => {
    // Optimistic update
    setTables(prev => {
      const updated = { ...prev };
      if (!updated[tableId]) return updated;
      
      if (quantity <= 0) {
        updated[tableId] = {
          ...updated[tableId],
          cart: updated[tableId].cart.filter(ci => ci.id !== itemId),
        };
      } else {
        updated[tableId] = {
          ...updated[tableId],
          cart: updated[tableId].cart.map(ci =>
            ci.id === itemId ? { ...ci, quantity } : ci
          ),
        };
      }
      return updated;
    });

    try {
      if (quantity <= 0) {
        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('table_id', tableId)
          .eq('menu_item_id', itemId);
        
        if (error) {
          loadTableSessions(); // Rollback
          throw error;
        }
      } else {
        const { data: cartItem, error: selectError } = await supabase
          .from('cart_items')
          .select('id')
          .eq('table_id', tableId)
          .eq('menu_item_id', itemId)
          .maybeSingle();

        if (selectError && selectError.code !== 'PGRST116') {
          loadTableSessions(); // Rollback
          throw selectError;
        }

        if (cartItem) {
          const { error: updateError } = await supabase
            .from('cart_items')
            .update({ quantity })
            .eq('id', cartItem.id);
          
          if (updateError) {
            loadTableSessions(); // Rollback
            throw updateError;
          }
        }
      }
      // Real-time subscription will sync
    } catch (error) {
      console.error('Error updating cart quantity:', error);
      throw error;
    }
  }, [loadTableSessions]);

  const clearCart = useCallback(async (tableId: string) => {
    // Optimistic update
    setTables(prev => {
      const updated = { ...prev };
      if (updated[tableId]) {
        updated[tableId] = {
          ...updated[tableId],
          cart: [],
        };
      }
      return updated;
    });

    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('table_id', tableId);

      if (error) throw error;
    } catch (error) {
      console.error('Error clearing cart:', error);
      // Reload on error
      loadTableSessions();
      throw error;
    }
  }, [loadTableSessions]); // tables not needed - we use setTables which is stable

  const submitOrder = useCallback(async (tableId: string, source: 'nfc' | 'qr' | 'direct' = 'direct') => {
    // Get current cart from state (not database) for instant access
    const currentTable = tablesRef.current[tableId];
    if (!currentTable || currentTable.cart.length === 0) {
      console.log('⚠️ No items in cart to submit');
      return;
    }
    
    // Calculate order details from current cart state (INSTANT)
    const orderDetails = currentTable.cart
      .map(ci => `${ci.quantity}x ${ci.name}`)
      .join(', ');
    const orderTotal = currentTable.cart.reduce(
      (sum, ci) => sum + (ci.price * ci.quantity),
      0
    );

    // Generate temporary ID for optimistic update
    const tempRequestId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    // Create optimistic order request (INSTANT - 0ms)
    const optimisticRequest: TableRequest = {
      id: tempRequestId,
      action: '🍽️ NEW ORDER',
      details: orderDetails,
      total: orderTotal,
      status: 'pending',
      timestamp: timestamp,
      source: source,
      requestType: 'order',
    };

    // OPTIMISTIC UPDATE: Add order to local state immediately (0ms)
    setTables(prev => {
      const updated = { ...prev };
      if (updated[tableId]) {
        updated[tableId] = {
          ...updated[tableId],
          cart: [], // Clear cart immediately
          requests: [...updated[tableId].requests, optimisticRequest], // Add order instantly
        };
      }
      return updated;
    });

    // Update refs immediately
    tablesRef.current = {
      ...tablesRef.current,
      [tableId]: {
        ...tablesRef.current[tableId],
        cart: [],
        requests: [...tablesRef.current[tableId].requests, optimisticRequest],
      },
    };

    // Force re-render to show optimistic update
    setRealtimeUpdateVersion(prev => prev + 1);

    // Trigger instant feedback (0ms) for StaffDashboard (same tab)
    if (onNewOrderCallbackRef.current) {
      try {
        onNewOrderCallbackRef.current('order', tableId);
        console.log(`⚡ Instant feedback triggered for optimistic order`);
      } catch (error) {
        console.error('Error in instant feedback callback:', error);
      }
    }

    // BROADCAST to all other tabs/windows (0ms, no database)
    // This instantly updates StaffDashboard in other browser windows
    broadcastUpdate('NEW_REQUEST', {
      tableId,
      request: optimisticRequest,
    });

    console.log(`⚡ Optimistic order added instantly (0ms) - Temp ID: ${tempRequestId}, Table: ${tableId}`);

    // Now sync with database in background (async, non-blocking)
    try {
      // Get cart items from database for accurate sync
      const { data: cartItems, error: cartError } = await supabase
        .from('cart_items')
        .select(`
          *,
          menu_items (id, name, price)
        `)
        .eq('table_id', tableId);

      if (cartError) throw cartError;
      
      // If cart is empty, it might have been cleared already
      if (!cartItems || cartItems.length === 0) {
        // Cart already cleared - just create the request
        const realRequestId = `req_${Date.now()}`;
        const { error: insertError } = await supabase
          .from('table_requests')
          .insert({
            id: realRequestId,
            table_id: tableId,
            action: '🍽️ NEW ORDER',
            details: orderDetails,
            total: orderTotal,
            status: 'pending',
            timestamp: timestamp,
            source: source,
            request_type: 'order',
          });

        if (insertError) {
          // ROLLBACK: Remove optimistic update on error
          console.error('❌ Database insert failed - rolling back optimistic update');
          setTables(prev => {
            const updated = { ...prev };
            if (updated[tableId]) {
              updated[tableId] = {
                ...updated[tableId],
                requests: updated[tableId].requests.filter(req => req.id !== tempRequestId),
                cart: currentTable.cart, // Restore cart
              };
            }
            return updated;
          });
          tablesRef.current = {
            ...tablesRef.current,
            [tableId]: currentTable, // Restore ref
          };
          throw insertError;
        }

        // Replace temp ID with real ID
        setTables(prev => {
          const updated = { ...prev };
          if (updated[tableId]) {
            updated[tableId] = {
              ...updated[tableId],
              requests: updated[tableId].requests.map(req =>
                req.id === tempRequestId
                  ? { ...req, id: realRequestId }
                  : req
              ),
            };
          }
          return updated;
        });
        
        // Update refs
        tablesRef.current = {
          ...tablesRef.current,
          [tableId]: {
            ...tablesRef.current[tableId],
            requests: tablesRef.current[tableId].requests.map(req =>
              req.id === tempRequestId ? { ...req, id: realRequestId } : req
            ),
          },
        };
        
        console.log(`✅ Order synced with database - Real ID: ${realRequestId}`);
        return;
      }
      
      // Recalculate from database (more accurate)
      const dbOrderDetails = cartItems
        .map(ci => {
          const menuItem = ci.menu_items as DatabaseMenuItem | null;
          return `${ci.quantity}x ${menuItem?.name || 'Unknown'}`;
        })
        .join(', ');
      const dbOrderTotal = cartItems.reduce(
        (sum, ci) => {
          const menuItem = ci.menu_items as DatabaseMenuItem | null;
          return sum + (parseFloat(String(menuItem?.price || '0')) * ci.quantity);
        },
        0
      );

      // Create real order request in database
      const realRequestId = `req_${Date.now()}`;
      const { error: insertError } = await supabase
        .from('table_requests')
        .insert({
          id: realRequestId,
          table_id: tableId,
        action: '🍽️ NEW ORDER',
          details: dbOrderDetails,
          total: dbOrderTotal,
        status: 'pending',
          timestamp: timestamp,
          source: source,
          request_type: 'order',
        });
      
      if (insertError) {
        // ROLLBACK: Remove optimistic update on error
        console.error('❌ Database insert failed - rolling back optimistic update');
        setTables(prev => {
          const updated = { ...prev };
          if (updated[tableId]) {
            updated[tableId] = {
              ...updated[tableId],
              requests: updated[tableId].requests.filter(req => req.id !== tempRequestId),
              cart: currentTable.cart, // Restore cart
            };
          }
          return updated;
        });
        tablesRef.current = {
          ...tablesRef.current,
          [tableId]: currentTable, // Restore ref
        };
        throw insertError;
      }

      // Replace temp ID with real ID from database
      setTables(prev => {
        const updated = { ...prev };
        if (updated[tableId]) {
          updated[tableId] = {
            ...updated[tableId],
            requests: updated[tableId].requests.map(req =>
              req.id === tempRequestId
                ? { ...req, id: realRequestId, details: dbOrderDetails, total: dbOrderTotal }
                : req
            ),
          };
        }
        return updated;
      });
      
      // Update refs
      tablesRef.current = {
        ...tablesRef.current,
        [tableId]: {
          ...tablesRef.current[tableId],
          requests: tablesRef.current[tableId].requests.map(req =>
            req.id === tempRequestId
              ? { ...req, id: realRequestId, details: dbOrderDetails, total: dbOrderTotal }
              : req
          ),
        },
      };
      
      // Clear cart in database
      await supabase
        .from('cart_items')
        .delete()
        .eq('table_id', tableId);

      console.log(`✅ Order synced with database - Real ID: ${realRequestId}`);
      
      // Real-time subscription will handle final sync, but we already have it locally
      // No need to call loadTableSessions() - optimistic update already shown it
      
    } catch (error) {
      console.error('Error syncing order with database:', error);
      
      // ROLLBACK: Remove optimistic update on error
      setTables(prev => {
        const updated = { ...prev };
        if (updated[tableId]) {
          updated[tableId] = {
            ...updated[tableId],
            requests: updated[tableId].requests.filter(req => req.id !== tempRequestId),
            cart: currentTable.cart, // Restore cart
          };
        }
        return updated;
      });
      
      // Restore refs
      tablesRef.current = {
        ...tablesRef.current,
        [tableId]: currentTable,
      };
      
      // Re-throw error so UI can show error message
      throw error;
    }
  }, [loadTableSessions]);

  const callWaiter = useCallback(async (tableId: string, source: 'nfc' | 'qr' | 'direct' = 'direct') => {
    // Generate temporary ID for optimistic update
    const tempRequestId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    // Create optimistic waiter request (INSTANT - 0ms)
    const optimisticRequest: TableRequest = {
      id: tempRequestId,
      action: '🔔 WAITER CALL',
      details: 'Customer requested assistance',
      total: 0,
      status: 'pending',
      timestamp: timestamp,
      source: source,
      requestType: 'waiter',
    };

    // OPTIMISTIC UPDATE: Add waiter request to local state immediately (0ms)
    setTables(prev => {
      const updated = { ...prev };
      if (!updated[tableId]) {
        updated[tableId] = {
          tableId,
          isLocked: false,
          cart: [],
          requests: [],
          isVip: false,
        };
      }
      updated[tableId] = {
        ...updated[tableId],
        requests: [...updated[tableId].requests, optimisticRequest],
      };
      return updated;
    });

    // Update refs immediately
    tablesRef.current = {
      ...tablesRef.current,
      [tableId]: {
        ...tablesRef.current[tableId] || {
          tableId,
          isLocked: false,
          cart: [],
          requests: [],
          isVip: false,
        },
        requests: [...(tablesRef.current[tableId]?.requests || []), optimisticRequest],
      },
    };

    // Force re-render to show optimistic update instantly
    setRealtimeUpdateVersion(prev => prev + 1);

    // Trigger instant feedback (0ms) for StaffDashboard (same tab)
    if (onNewOrderCallbackRef.current) {
      try {
        onNewOrderCallbackRef.current('waiter', tableId);
        console.log(`⚡ Instant feedback triggered for optimistic waiter call`);
      } catch (error) {
        console.error('Error in instant feedback callback:', error);
      }
    }

    // BROADCAST to all other tabs/windows (0ms, no database)
    broadcastUpdate('NEW_REQUEST', {
      tableId,
      request: optimisticRequest,
    });

    console.log(`⚡ Optimistic waiter call added instantly (0ms) - Temp ID: ${tempRequestId}, Table: ${tableId}`);

    try {
      // Create real waiter request in database
      const realRequestId = `req_${Date.now()}`;
      const { error: insertError } = await supabase
        .from('table_requests')
        .insert({
          id: realRequestId,
          table_id: tableId,
        action: '🔔 WAITER CALL',
        details: 'Customer requested assistance',
        total: 0,
        status: 'pending',
          timestamp: timestamp,
          source: source,
          request_type: 'waiter',
        });

      if (insertError) {
        // ROLLBACK: Remove optimistic update on error
        console.error('❌ Database insert failed - rolling back optimistic update');
        setTables(prev => {
          const updated = { ...prev };
          if (updated[tableId]) {
            updated[tableId] = {
              ...updated[tableId],
              requests: updated[tableId].requests.filter(req => req.id !== tempRequestId),
            };
          }
          return updated;
        });
        
        // Restore refs
        tablesRef.current = {
          ...tablesRef.current,
          [tableId]: {
            ...tablesRef.current[tableId],
            requests: tablesRef.current[tableId].requests.filter(req => req.id !== tempRequestId),
          },
        };
        
        throw insertError;
      }

      // Replace temp ID with real ID from database
      setTables(prev => {
        const updated = { ...prev };
        if (updated[tableId]) {
          updated[tableId] = {
            ...updated[tableId],
            requests: updated[tableId].requests.map(req =>
              req.id === tempRequestId ? { ...req, id: realRequestId } : req
            ),
          };
        }
        return updated;
      });
      
      // Update refs
      tablesRef.current = {
        ...tablesRef.current,
        [tableId]: {
          ...tablesRef.current[tableId],
          requests: tablesRef.current[tableId].requests.map(req =>
            req.id === tempRequestId ? { ...req, id: realRequestId } : req
          ),
        },
      };

      console.log(`✅ Waiter call synced with database - Real ID: ${realRequestId}`);
    } catch (error) {
      console.error('Error syncing waiter call with database:', error);
      throw error;
    }
  }, [loadTableSessions, broadcastUpdate]);

  const requestBill = useCallback(async (tableId: string, paymentMethod: 'cash' | 'card', source: 'nfc' | 'qr' | 'direct' = 'direct') => {
    // Get current table state for calculating total
    const currentTable = tablesRef.current[tableId];
    if (!currentTable) return;
    
    // Calculate total from current state (INSTANT)
    const totalBill = currentTable.requests
      .filter(r => r.status === 'confirmed' || r.status === 'completed')
      .reduce((sum, r) => sum + r.total, 0);

    // Generate temporary ID for optimistic update
    const tempRequestId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    // Create optimistic bill request (INSTANT - 0ms)
    const optimisticRequest: TableRequest = {
      id: tempRequestId,
      action: '💳 BILL REQUEST',
      details: `Payment: ${paymentMethod === 'cash' ? 'Cash' : 'Card'}`,
      total: totalBill,
      status: 'pending',
      timestamp: timestamp,
      paymentMethod: paymentMethod,
      source: source,
      requestType: 'bill',
    };

    // OPTIMISTIC UPDATE: Add bill request to local state immediately (0ms)
    setTables(prev => {
      const updated = { ...prev };
      if (!updated[tableId]) {
        updated[tableId] = {
          tableId,
          isLocked: false,
          cart: [],
          requests: [],
          isVip: false,
        };
      }
      updated[tableId] = {
        ...updated[tableId],
        requests: [...updated[tableId].requests, optimisticRequest],
      };
      return updated;
    });

    // Update refs immediately
    tablesRef.current = {
      ...tablesRef.current,
      [tableId]: {
        ...tablesRef.current[tableId] || {
          tableId,
          isLocked: false,
          cart: [],
          requests: [],
          isVip: false,
        },
        requests: [...(tablesRef.current[tableId]?.requests || []), optimisticRequest],
      },
    };

    // Force re-render to show optimistic update instantly
    setRealtimeUpdateVersion(prev => prev + 1);

    // Trigger instant feedback (0ms) for StaffDashboard (same tab)
    if (onNewOrderCallbackRef.current) {
      try {
        onNewOrderCallbackRef.current('bill', tableId);
        console.log(`⚡ Instant feedback triggered for optimistic bill request`);
      } catch (error) {
        console.error('Error in instant feedback callback:', error);
      }
    }

    // BROADCAST to all other tabs/windows (0ms, no database)
    broadcastUpdate('NEW_REQUEST', {
      tableId,
      request: optimisticRequest,
    });

    console.log(`⚡ Optimistic bill request added instantly (0ms) - Temp ID: ${tempRequestId}, Table: ${tableId}, Total: ${totalBill}`);

    try {
      // Get total from database for accurate sync
      const { data: requests, error: fetchError } = await supabase
        .from('table_requests')
        .select('total')
        .eq('table_id', tableId)
        .eq('status', 'completed');
      
      if (fetchError) {
        // ROLLBACK: Remove optimistic update on error
        console.error('❌ Error fetching requests - rolling back optimistic update');
        setTables(prev => {
          const updated = { ...prev };
          if (updated[tableId]) {
            updated[tableId] = {
              ...updated[tableId],
              requests: updated[tableId].requests.filter(req => req.id !== tempRequestId),
            };
          }
          return updated;
        });
        
        // Restore refs
        tablesRef.current = {
          ...tablesRef.current,
          [tableId]: {
            ...tablesRef.current[tableId],
            requests: tablesRef.current[tableId].requests.filter(req => req.id !== tempRequestId),
          },
        };
        
        throw fetchError;
      }
      
      const dbTotalBill = (requests || []).reduce((sum, r) => sum + parseFloat(r.total || '0'), 0);
      
      // Create real bill request in database
      const realRequestId = `req_${Date.now()}`;
      const { error: insertError } = await supabase
        .from('table_requests')
        .insert({
          id: realRequestId,
          table_id: tableId,
        action: '💳 BILL REQUEST',
        details: `Payment: ${paymentMethod === 'cash' ? 'Cash' : 'Card'}`,
          total: dbTotalBill,
        status: 'pending',
          timestamp: timestamp,
          payment_method: paymentMethod,
          source: source,
          request_type: 'bill',
        });

      if (insertError) {
        // ROLLBACK: Remove optimistic update on error
        console.error('❌ Database insert failed - rolling back optimistic update');
        setTables(prev => {
          const updated = { ...prev };
          if (updated[tableId]) {
            updated[tableId] = {
              ...updated[tableId],
              requests: updated[tableId].requests.filter(req => req.id !== tempRequestId),
            };
          }
          return updated;
        });
        
        // Restore refs
        tablesRef.current = {
          ...tablesRef.current,
          [tableId]: {
            ...tablesRef.current[tableId],
            requests: tablesRef.current[tableId].requests.filter(req => req.id !== tempRequestId),
          },
        };
        
        throw insertError;
      }

      // Replace temp ID with real ID from database
      setTables(prev => {
        const updated = { ...prev };
        if (updated[tableId]) {
          updated[tableId] = {
            ...updated[tableId],
            requests: updated[tableId].requests.map(req =>
              req.id === tempRequestId
                ? { ...req, id: realRequestId, total: dbTotalBill }
                : req
            ),
          };
        }
        return updated;
      });
      
      // Update refs
      tablesRef.current = {
        ...tablesRef.current,
        [tableId]: {
          ...tablesRef.current[tableId],
          requests: tablesRef.current[tableId].requests.map(req =>
            req.id === tempRequestId
              ? { ...req, id: realRequestId, total: dbTotalBill }
              : req
          ),
        },
      };

      console.log(`✅ Bill request synced with database - Real ID: ${realRequestId}, Total: ${dbTotalBill}`);
    } catch (error) {
      console.error('Error syncing bill request with database:', error);
      throw error;
    }
  }, [loadTableSessions, broadcastUpdate]);

  const completeRequest = useCallback(async (tableId: string, requestId: string) => {
    // Get current state for rollback
    const currentTable = tablesRef.current[tableId];
    if (!currentTable) return;
    
    const currentRequest = currentTable.requests.find(r => r.id === requestId);
    if (!currentRequest) return;
    
    // OPTIMISTIC UPDATE: Update request status to 'confirmed' instantly (0ms)
    setTables(prev => {
      const updated = { ...prev };
      if (!updated[tableId]) return updated;
      
      updated[tableId] = {
        ...updated[tableId],
        requests: updated[tableId].requests.map(req =>
          req.id === requestId ? { ...req, status: 'confirmed' as const } : req
        ),
      };
      
      return updated;
    });

    // Update refs immediately
    tablesRef.current = {
      ...tablesRef.current,
      [tableId]: {
        ...tablesRef.current[tableId],
        requests: tablesRef.current[tableId].requests.map(req =>
          req.id === requestId ? { ...req, status: 'confirmed' as const } : req
        ),
      },
    };

    // Force re-render to show optimistic update instantly
    setRealtimeUpdateVersion(prev => prev + 1);

    // BROADCAST to all other tabs/windows (0ms, no database)
    broadcastUpdate('REQUEST_UPDATED', {
      tableId,
      requestId,
      updates: { status: 'confirmed' },
    });

    console.log(`⚡ Optimistic update: Request ${requestId} marked as confirmed instantly (0ms)`);

    try {
      // Update request status to 'confirmed' in database (DO NOT DELETE)
      // The request stays in table_requests until the table is marked as paid
      const { error: updateError } = await supabase
        .from('table_requests')
        .update({ status: 'confirmed' })
        .eq('id', requestId)
        .eq('table_id', tableId);
      
      if (updateError) {
        console.error('❌ Database update failed - rolling back optimistic update');
        // ROLLBACK: Restore original status
        setTables(prev => {
          const updated = { ...prev };
          if (updated[tableId]) {
            updated[tableId] = {
              ...updated[tableId],
              requests: updated[tableId].requests.map(req =>
                req.id === requestId ? currentRequest : req
              ),
            };
          }
          return updated;
        });
        
        // Restore refs
        tablesRef.current = {
          ...tablesRef.current,
          [tableId]: currentTable,
        };
        
        throw updateError;
      }

      console.log(`✅ Request ${requestId} confirmed in database - sync complete`);
    } catch (error) {
      console.error('Error confirming request:', error);
      // Error already handled in try block
      throw error;
    }
  }, [loadTableSessions, broadcastUpdate]);

  // Complete child session - calculate final charge and add to bill
  // MUST be defined before markAsPaid since markAsPaid uses it
  const completeChildSession = useCallback(async (tableId: string, requestId: string, skipReload?: boolean) => {
    try {
      // Get current request with all timer data
      const { data: currentRequest, error: fetchError } = await supabase
        .from('table_requests')
        .select('timer_started_at, timer_paused_at, total_time_elapsed, hourly_rate')
        .eq('id', requestId)
        .eq('table_id', tableId)
        .single();

      if (fetchError || !currentRequest) {
        throw fetchError || new Error('Request not found');
      }

      const nowTimestamp = Date.now(); // Use timestamp (milliseconds) for BIGINT field
      let finalElapsed = currentRequest.total_time_elapsed || 0;

      // If timer was running, add the elapsed time since it started
      if (currentRequest.timer_started_at && !currentRequest.timer_paused_at) {
        // timer_started_at is stored as BIGINT (timestamp in milliseconds)
        const timerStartedAt = typeof currentRequest.timer_started_at === 'string' 
          ? parseInt(currentRequest.timer_started_at, 10)
          : currentRequest.timer_started_at;
        const elapsedSinceStart = Math.floor((nowTimestamp - timerStartedAt) / 1000);
        finalElapsed += elapsedSinceStart;
      }

      // Calculate cost: hours × hourly rate
      const hours = finalElapsed / 3600; // Convert seconds to hours
      const hourlyRate = currentRequest.hourly_rate || 10.00;
      const cost = Math.ceil(hours * hourlyRate * 100) / 100; // Round to 2 decimals

      // Update the request with final values
      await supabase
        .from('table_requests')
        .update({ 
          child_location: 'table',
          total_time_elapsed: finalElapsed,
          timer_paused_at: nowTimestamp // Use timestamp instead of ISO string
        })
        .eq('id', requestId)
        .eq('table_id', tableId);

      // Create a new request for the kids zone charge
      if (cost > 0) {
        await supabase
          .from('table_requests')
          .insert({
            id: `kids_zone_${tableId}_${Date.now()}`,
            table_id: tableId,
            action: 'Детски кът',
            details: `${Math.floor(finalElapsed / 60)} минути в детския кът`,
            total: cost,
            status: 'confirmed',
            timestamp: nowTimestamp, // Use timestamp (BIGINT) instead of ISO string
            request_type: 'kids_zone',
            source: 'direct'
          });
      }

      if (skipReload !== true) {
        loadTableSessions();
      }
    } catch (error) {
      console.error('Error completing child session:', error);
      loadTableSessions();
      throw error;
    }
  }, [loadTableSessions]);

  /** When kid has been returned to table: complete session (timer + charge) and remove animator request so the card clears */
  const clearAnimatorRequestAfterReturn = useCallback(async (tableId: string, requestId: string) => {
    const currentTable = tablesRef.current[tableId];
    try {
      await completeChildSession(tableId, requestId, true);
      const { error } = await supabase
        .from('table_requests')
        .delete()
        .eq('id', requestId)
        .eq('table_id', tableId)
        .eq('request_type', 'animator');
      if (error) {
        console.error('Error deleting animator request:', error);
        await loadTableSessions();
        throw error;
      }
      if (currentTable) {
        setTables(prev => {
          const updated = { ...prev };
          if (!updated[tableId]) return updated;
          updated[tableId] = {
            ...updated[tableId],
            requests: updated[tableId].requests.filter(req => req.id !== requestId),
          };
          return updated;
        });
        tablesRef.current = {
          ...tablesRef.current,
          [tableId]: {
            ...tablesRef.current[tableId],
            requests: tablesRef.current[tableId].requests.filter(r => r.id !== requestId),
          },
        };
        setRealtimeUpdateVersion(prev => prev + 1);
        broadcastUpdate('REQUEST_REMOVED', { tableId, requestId });
      }
      await loadTableSessions();
    } catch (error) {
      console.error('Error clearing animator request after return:', error);
      loadTableSessions();
      throw error;
    }
  }, [completeChildSession, loadTableSessions, broadcastUpdate]);

  const markAsPaid = useCallback(async (tableId: string) => {
    // Get current table data before clearing for archive
    const currentTable = tables[tableId];
    if (!currentTable) return;
    
    // Store original state for potential rollback
    const originalRequests = [...currentTable.requests];
    const originalIsLocked = currentTable.isLocked;
    const originalCart = [...currentTable.cart];

    // INSTANT (0ms): Complete child session calculation locally if needed
    const animatorRequest = currentTable.requests.find(req => req.requestType === 'animator' && req.status === 'confirmed');
    let kidsZoneCharge = 0;
    if (animatorRequest && (animatorRequest.childLocation === 'kids_zone' || animatorRequest.childLocation === 'returning_to_table')) {
      // Calculate kids zone charge locally (0ms)
      const totalElapsed = animatorRequest.totalTimeElapsed || 0;
      const hourlyRate = animatorRequest.hourlyRate || 10;
      kidsZoneCharge = (totalElapsed / 3600) * hourlyRate;
      console.log(`⚡ Kids zone charge calculated instantly: ${kidsZoneCharge.toFixed(2)} EUR`);
    }
    
    // INSTANT (0ms): OPTIMISTIC UPDATE - Clear table immediately
    setTables(prev => {
      const updated = { ...prev };
      if (!updated[tableId]) return updated;
      
      updated[tableId] = {
        ...updated[tableId],
        isLocked: false,
        requests: [],
        cart: [],
      };
      
      return updated;
    });

    // Update refs immediately (0ms)
    tablesRef.current = {
      ...tablesRef.current,
      [tableId]: {
        ...tablesRef.current[tableId],
        isLocked: false,
        requests: [],
        cart: [],
      },
    };

    // Force re-render (0ms)
    setRealtimeUpdateVersion(prev => prev + 1);

    // INSTANT (0ms): BROADCAST to all other tabs/windows
    broadcastUpdate('TABLE_CLEARED', { tableId });

    // Mark as paid to prevent real-time from showing old data
    setPaidTables(prev => new Set(prev).add(tableId));

    console.log(`⚡ INSTANT (0ms): Table ${tableId} marked as paid - ${originalRequests.length} requests cleared`);

    // BACKGROUND: Database sync (non-blocking, fire-and-forget)
    // UI is already updated, database operations happen in background
    (async () => {
      try {
        // Complete child session in database if needed
        if (animatorRequest && (animatorRequest.childLocation === 'kids_zone' || animatorRequest.childLocation === 'returning_to_table')) {
          try {
            await completeChildSession(tableId, animatorRequest.id);
            console.log(`✅ [Background] Child session completed for ${tableId}`);
          } catch (error) {
            console.error('[Background] Error completing child session:', error);
          }
        }

        // Fetch requests from database
        const { data: requestsData } = await supabase
        .from('table_requests')
        .select('*')
        .eq('table_id', tableId);

        // Move to completed_orders (parallel operations)
        const dbOperations = [];

      if (requestsData && requestsData.length > 0) {
        const completedOrders = requestsData.map(req => ({
          id: req.id,
          table_id: req.table_id,
          action: req.action,
          details: req.details || '',
          total: parseFloat(req.total || '0'),
          status: 'completed',
          timestamp: req.timestamp,
          payment_method: req.payment_method || null,
        }));

          dbOperations.push(
            supabase.from('completed_orders').insert(completedOrders)
              .then(() => console.log(`✅ [Background] Moved ${completedOrders.length} orders to completed_orders`))
              .catch(e => console.error('[Background] Error moving to completed_orders:', e))
          );
        }

        // Archive session
        if (originalRequests.length > 0) {
          const totalRevenue = originalRequests.reduce((sum, r) => sum + r.total, 0);
          const sessionStartTime = Math.min(...originalRequests.map(r => r.timestamp));
        const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 60000);

          dbOperations.push(
            supabase.from('table_history_archive').insert({
            id: `archive_${tableId}_${Date.now()}`,
            table_id: tableId,
              cart_items: originalCart,
              requests: requestsData || originalRequests,
            total_revenue: totalRevenue,
            session_duration_minutes: sessionDuration,
            })
              .then(() => console.log(`✅ [Background] Session archived for ${tableId}`))
              .catch(e => console.error('[Background] Error archiving session:', e))
          );
        }

        // Delete requests
        dbOperations.push(
          supabase.from('table_requests').delete().eq('table_id', tableId)
            .then(() => console.log(`✅ [Background] Requests deleted for ${tableId}`))
            .catch(e => console.error('[Background] Error deleting requests:', e))
        );

        // Clear cart
        dbOperations.push(
          supabase.from('cart_items').delete().eq('table_id', tableId)
            .then(() => console.log(`✅ [Background] Cart cleared for ${tableId}`))
            .catch(e => console.error('[Background] Error clearing cart:', e))
        );

        // Unlock table
        dbOperations.push(
          supabase.from('restaurant_tables').update({ 
          is_locked: false,
            session_started_at: new Date().toISOString()
          }).eq('table_id', tableId)
            .then(() => console.log(`✅ [Background] Table ${tableId} unlocked`))
            .catch(e => console.error('[Background] Error unlocking table:', e))
        );

        // Run all database operations in parallel
        await Promise.allSettled(dbOperations);

        // Clear paid flag after delay
      setTimeout(() => {
        setPaidTables(prev => {
          const next = new Set(prev);
          next.delete(tableId);
          return next;
        });
        }, 2000);

        console.log(`✅ [Background] All database operations completed for ${tableId}`);
    } catch (error) {
        console.error(`[Background] Error in database sync for ${tableId}:`, error);
        // Note: We don't rollback here because the UI should stay cleared
        // The database will eventually sync on next page load
    }
    })();

    // Function returns immediately (0ms) - database sync happens in background
  }, [tables, completeChildSession, broadcastUpdate]);

  const resetTable = useCallback(async (tableId: string) => {
    // Get current state for rollback
    const currentTable = tablesRef.current[tableId];
    if (!currentTable) return;
    
    // Store original state for rollback
    const originalState = {
      isLocked: currentTable.isLocked,
      isVip: currentTable.isVip,
      cart: [...currentTable.cart],
      requests: [...currentTable.requests],
    };
    
    // OPTIMISTIC UPDATE: Clear everything immediately (0ms)
    // This ensures UI updates instantly before database operations complete
    setTables(prev => {
      const updated = { ...prev };
      if (!updated[tableId]) return updated;
      
      updated[tableId] = {
        ...updated[tableId],
        isLocked: false,
        isVip: false,
        cart: [],
        requests: [], // Clear all requests immediately - they will be deleted from DB
      };
      
      return updated;
    });

    // Update refs immediately
    tablesRef.current = {
      ...tablesRef.current,
      [tableId]: {
        ...tablesRef.current[tableId],
        isLocked: false,
        isVip: false,
        cart: [],
        requests: [],
      },
    };

    // Force re-render to show optimistic update instantly
    setRealtimeUpdateVersion(prev => prev + 1);

    // BROADCAST to all other tabs/windows (0ms, no database)
    broadcastUpdate('TABLE_CLEARED', { tableId });

    console.log(`⚡ Optimistic update: Table ${tableId} reset instantly (0ms) - ${originalState.requests.length} requests cleared`);
    
    // Mark this table as being reset to prevent real-time from showing old requests
    setPaidTables(prev => new Set(prev).add(tableId));

    try {
      console.log(`Starting reset for ${tableId} - fetching data directly from database...`);

      // Step 1: Get all data directly from database (direct database connection)
      const [cartResult, requestsResult] = await Promise.all([
        supabase
          .from('cart_items')
          .select('*')
          .eq('table_id', tableId),
        supabase
          .from('table_requests')
          .select('*')
          .eq('table_id', tableId)
      ]);

      if (cartResult.error) {
        console.error('❌ Error fetching cart - rolling back optimistic update');
        // ROLLBACK: Restore original state
        setTables(prev => {
          const updated = { ...prev };
          if (updated[tableId]) {
            updated[tableId] = {
              ...updated[tableId],
              isLocked: originalState.isLocked,
              isVip: originalState.isVip,
              cart: originalState.cart,
              requests: originalState.requests,
            };
          }
          return updated;
        });
        
        // Restore refs
        tablesRef.current = {
          ...tablesRef.current,
          [tableId]: currentTable,
        };
        
        throw cartResult.error;
      }
      if (requestsResult.error) {
        console.error('❌ Error fetching requests - rolling back optimistic update');
        // ROLLBACK: Restore original state
        setTables(prev => {
          const updated = { ...prev };
          if (updated[tableId]) {
            updated[tableId] = {
              ...updated[tableId],
              isLocked: originalState.isLocked,
              isVip: originalState.isVip,
              cart: originalState.cart,
              requests: originalState.requests,
            };
          }
          return updated;
        });
        
        // Restore refs
        tablesRef.current = {
          ...tablesRef.current,
          [tableId]: currentTable,
        };
        
        throw requestsResult.error;
      }

      const cartData = cartResult.data || [];
      const requestsData = requestsResult.data || [];

      console.log(`Found ${cartData.length} cart items and ${requestsData.length} requests for ${tableId}`);

      // Step 2: Move ALL requests to completed_orders (direct database operation)
      // This includes: orders, waiter calls, bill requests - everything
      if (requestsData.length > 0) {
        // Generate unique IDs to avoid conflicts (use timestamp + random)
        const completedOrders = requestsData.map(req => ({
          id: `completed_${req.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          table_id: req.table_id,
          action: req.action,
          details: req.details || '',
          total: parseFloat(req.total || '0'),
          status: 'completed',
          timestamp: req.timestamp,
          payment_method: req.payment_method || null,
        }));

        // Use upsert to handle potential conflicts gracefully
        const { data: insertedOrders, error: moveError } = await supabase
          .from('completed_orders')
          .upsert(completedOrders, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          })
          .select();

        if (moveError) {
          console.error('Error moving to completed_orders:', moveError);
          // If upsert fails, try insert with conflict handling
          const { error: insertError } = await supabase
            .from('completed_orders')
            .insert(completedOrders)
            .select();
          
          if (insertError) {
            console.error('Error inserting to completed_orders (fallback):', insertError);
            // Continue even if insert fails - we'll still delete from table_requests
            console.warn('Continuing reset despite completed_orders error...');
          } else {
            console.log(`✅ Moved ${completedOrders.length} requests to completed_orders for ${tableId} (fallback)`);
          }
        } else {
          console.log(`✅ Moved ${insertedOrders?.length || completedOrders.length} requests to completed_orders for ${tableId}`);
        }
      }

      // Step 3: Archive the session (direct database operation)
      if (cartData.length > 0 || requestsData.length > 0) {
        const sessionStartTime = requestsData.length > 0 
          ? Math.min(...requestsData.map(r => r.timestamp))
          : Date.now();
        const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 60000);
        const totalRevenue = requestsData.reduce((sum, r) => sum + parseFloat(r.total || '0'), 0);

        const { error: archiveError } = await supabase
          .from('table_history_archive')
          .insert({
            id: `archive_${tableId}_${Date.now()}`,
            table_id: tableId,
            cart_items: cartData,
            requests: requestsData,
            total_revenue: totalRevenue,
            session_duration_minutes: sessionDuration,
          });

        if (archiveError) {
          console.error('Error archiving (non-critical):', archiveError);
          // Continue even if archive fails
        } else {
          console.log(`✅ Archived session for ${tableId}`);
        }
      }

      // Step 4: Delete ALL requests from table_requests directly in database
      // This triggers real-time deletion events that will update all connected clients
      // Delete ALL requests for this specific table (including completed, pending, everything)
      // CRITICAL: Delete ALL requests regardless of status - this is a complete reset
      const { data: deletedRequests, error: requestsError } = await supabase
        .from('table_requests')
        .delete()
        .eq('table_id', tableId) // Delete ALL requests for this specific table, no status filter
        .select();

      if (requestsError) {
        console.error('❌ Error deleting requests - rolling back optimistic update');
        // ROLLBACK: Restore original state
        setTables(prev => {
          const updated = { ...prev };
          if (updated[tableId]) {
            updated[tableId] = {
              ...updated[tableId],
              isLocked: originalState.isLocked,
              isVip: originalState.isVip,
              cart: originalState.cart,
              requests: originalState.requests,
            };
          }
          return updated;
        });
        
        // Restore refs
        tablesRef.current = {
          ...tablesRef.current,
          [tableId]: currentTable,
        };
        
        throw requestsError;
      }
      console.log(`✅ Deleted ${deletedRequests?.length || 0} requests from table_requests for ${tableId} (real-time deletion)`);
      
      // Real-time subscription will automatically sync the deletion to all clients
      // No need to manually reload - Supabase real-time will handle it
      
      // Double-check: Verify deletion was successful and force delete any remaining
      const { data: remainingRequests } = await supabase
        .from('table_requests')
        .select('id')
        .eq('table_id', tableId);
      
      if (remainingRequests && remainingRequests.length > 0) {
        console.warn(`⚠️ Warning: ${remainingRequests.length} requests still exist for ${tableId} after deletion. Force deleting...`);
        // Force delete any remaining requests (this will also trigger real-time)
        const { error: forceDeleteError } = await supabase
          .from('table_requests')
          .delete()
          .eq('table_id', tableId);
        
        if (forceDeleteError) {
          console.error('Error force deleting remaining requests:', forceDeleteError);
        } else {
          console.log(`✅ Force deleted ${remainingRequests.length} remaining requests for ${tableId}`);
        }
        
        // Final verification - if still remaining, log error
        const { data: finalCheck } = await supabase
          .from('table_requests')
          .select('id')
          .eq('table_id', tableId);
        
        if (finalCheck && finalCheck.length > 0) {
          console.error(`❌ CRITICAL: ${finalCheck.length} requests STILL exist for ${tableId} after force delete!`);
        }
      }

      // Step 5: Delete ALL cart items (direct database operation)
      const { data: deletedCart, error: cartError } = await supabase
        .from('cart_items')
        .delete()
        .eq('table_id', tableId)
        .select();

      if (cartError) {
        console.error('Error deleting cart:', cartError);
        loadTableSessions();
        throw cartError;
      }
      console.log(`✅ Deleted ${deletedCart?.length || 0} cart items for ${tableId}`);

      // Step 6: Reset table status and start new session (direct database operation)
      const { error: tableError } = await supabase
        .from('restaurant_tables')
        .update({ 
          is_locked: false, 
          is_vip: false,
          session_started_at: new Date().toISOString() // Start new session
        })
        .eq('table_id', tableId);

      if (tableError) {
        console.error('Error resetting table status:', tableError);
        loadTableSessions();
        throw tableError;
      }
      console.log(`✅ Reset table status for ${tableId}`);

      console.log(`🎉 Successfully reset ${tableId}: All data moved to completed_orders and cleared from active tables`);

      // Clear the reset flag after a delay to allow real-time deletion to complete
      setTimeout(() => {
        setPaidTables(prev => {
          const next = new Set(prev);
          next.delete(tableId);
          return next;
        });
      }, 2000); // 2 second delay to ensure deletion completes

      // Step 7: Force reload to ensure UI is in sync with database
      // Real-time subscription will also update, but this ensures consistency
      await loadTableSessions();

    } catch (error) {
      console.error('❌ Error resetting table - rolling back optimistic update');
      // ROLLBACK: Restore original state
      setTables(prev => {
        const updated = { ...prev };
        if (updated[tableId]) {
          updated[tableId] = {
            ...updated[tableId],
            isLocked: originalState.isLocked,
            isVip: originalState.isVip,
            cart: originalState.cart,
            requests: originalState.requests,
          };
        }
        return updated;
      });
      
      // Restore refs
      tablesRef.current = {
        ...tablesRef.current,
        [tableId]: currentTable,
      };
      
      throw error;
    }
  }, [loadTableSessions, broadcastUpdate]);

  const getCartTotal = useCallback((tableId: string): number => {
    const table = tables[tableId];
    if (!table) return 0;
    // Always fetch prices from menuItems to ensure we have the latest prices
    return table.cart.reduce((sum, cartItem) => {
      const menuItem = menuItems.find(mi => mi.id === cartItem.id);
      const price = menuItem?.price || cartItem.price; // Fallback to cart price if menu item not found
      return sum + (price * cartItem.quantity);
    }, 0);
  }, [tables, menuItems]); // Use menuItems to get latest prices

  const getCartItemCount = useCallback((tableId: string): number => {
    const table = tables[tableId];
    if (!table) return 0;
    return table.cart.reduce((sum, i) => sum + i.quantity, 0);
  }, [tables]); // tables is needed to access cart data

  // OPTIMIZATION: Memoize grouped menu items to avoid recalculating on every render
  const groupedMenuItems = useMemo(() => {
    return menuItems.reduce((acc, item) => {
      const category = item.cat && item.cat.trim() ? item.cat.trim() : '📦 Unassigned';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  }, [menuItems]);

  // Menu management functions
  const addMenuItem = useCallback(async (item: Omit<MenuItem, 'id'>) => {
      const newId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create new menu item object
    const newMenuItem: MenuItem = {
      id: newId,
      cat: item.cat,
      name: item.name,
      price: item.price,
      desc: item.desc || item.description || '',
      description: item.desc || item.description || '',
    };

    // OPTIMISTIC UPDATE: Add menu item instantly (0ms)
    setMenuItems(prev => [...prev, newMenuItem]);

    // BROADCAST to all other tabs/windows (0ms, no database)
    broadcastUpdate('MENU_ITEM_ADDED', { item: newMenuItem });

    console.log(`⚡ Optimistic update: Menu item added instantly (0ms) - ID: ${newId}`);

    try {
      const { error } = await supabase
        .from('menu_items')
        .insert({
          id: newId,
          cat: item.cat,
          name: item.name,
          price: item.price,
          description: item.desc || item.description || null,
        });

      if (error) {
        console.error('❌ Database insert failed - rolling back optimistic update');
        // ROLLBACK
        setMenuItems(prev => prev.filter(i => i.id !== newId));
        throw error;
      }

      console.log(`✅ Menu item added to database - ID: ${newId}`);
    } catch (error) {
      console.error('Error adding menu item:', error);
    }
  }, [broadcastUpdate]);

  const updateMenuItem = useCallback(async (id: string, updates: Partial<MenuItem>) => {
    // Get current item for rollback
    const currentItem = menuItems.find(i => i.id === id);
    if (!currentItem) return;

    // OPTIMISTIC UPDATE: Update menu item instantly (0ms)
    setMenuItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ));

    // BROADCAST to all other tabs/windows (0ms, no database)
    broadcastUpdate('MENU_ITEM_UPDATED', { id, updates });

    console.log(`⚡ Optimistic update: Menu item updated instantly (0ms) - ID: ${id}`);

    try {
      const updateData: Partial<DatabaseMenuItem> = {};
      if (updates.cat !== undefined) updateData.cat = updates.cat;
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.price !== undefined) updateData.price = updates.price;
      if (updates.desc !== undefined || updates.description !== undefined) {
        updateData.description = updates.desc || updates.description || null;
      }

      const { error } = await supabase
        .from('menu_items')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('❌ Database update failed - rolling back optimistic update');
        // ROLLBACK
        setMenuItems(prev => prev.map(item =>
          item.id === id ? currentItem : item
        ));
        throw error;
      }

      console.log(`✅ Menu item updated in database - ID: ${id}`);
    } catch (error) {
      console.error('Error updating menu item:', error);
    }
  }, [menuItems, broadcastUpdate]);

  const deleteMenuItem = useCallback(async (id: string) => {
    // Get current item for rollback
    const currentItem = menuItems.find(i => i.id === id);
    if (!currentItem) return;

    // OPTIMISTIC UPDATE: Remove menu item instantly (0ms)
    setMenuItems(prev => prev.filter(item => item.id !== id));

    // BROADCAST to all other tabs/windows (0ms, no database)
    broadcastUpdate('MENU_ITEM_DELETED', { id });

    console.log(`⚡ Optimistic update: Menu item deleted instantly (0ms) - ID: ${id}`);

    try {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Database delete failed - rolling back optimistic update');
        // ROLLBACK
        setMenuItems(prev => [...prev, currentItem]);
        throw error;
      }

      console.log(`✅ Menu item deleted from database - ID: ${id}`);
    } catch (error) {
      console.error('Error deleting menu item:', error);
    }
  }, [menuItems, broadcastUpdate]);

  // Call animator function
  const callAnimator = useCallback(async (tableId: string, source: 'nfc' | 'qr' | 'direct' = 'direct') => {
    // Check if there's already an active animator request in local state
    const currentTable = tables[tableId];
    const existingRequest = currentTable?.requests.find(
      req => req.requestType === 'animator' && (req.status === 'pending' || req.status === 'confirmed')
    );

    if (existingRequest) {
      // Kid already in kids zone (or pending): table is calling animator again — update timestamp and notify
      const newTimestamp = Date.now();
      setTables(prev => {
        const updated = { ...prev };
        if (!updated[tableId]) return updated;
        
        updated[tableId] = {
          ...updated[tableId],
          requests: updated[tableId].requests.map(req =>
            req.id === existingRequest.id ? {
              ...req,
              timestamp: newTimestamp,
              source: source
            } : req
          ),
        };
        
        return updated;
      });

      tablesRef.current = {
        ...tablesRef.current,
        [tableId]: {
          ...tablesRef.current[tableId],
          requests: tablesRef.current[tableId].requests.map(req =>
            req.id === existingRequest.id ? {
              ...req,
              timestamp: newTimestamp,
              source: source
            } : req
          ),
        },
      };

      setRealtimeUpdateVersion(prev => prev + 1);

      // Notify animator (sound + toast) when table calls again — notification only: "called to table"
      if (onNewOrderCallbackRef.current) {
        try {
          onNewOrderCallbackRef.current('animator_called_to_table', tableId);
        } catch (e) { /* ignore */ }
      }
      broadcastUpdate('REQUEST_UPDATED', {
        tableId,
        requestId: existingRequest.id,
        updates: { timestamp: newTimestamp, source: source },
      });

      // Persist to DB so animator dashboard and other tabs see the call
      try {
        const { error: updateError } = await supabase
          .from('table_requests')
          .update({ timestamp: newTimestamp, source: source })
          .eq('id', existingRequest.id);
        if (updateError) throw updateError;
      } catch (e) {
        console.error('Error updating animator request timestamp:', e);
      }
      console.log(`⚡ Animator called again (kid in zone) - table ${tableId}, timestamp updated`);
      return;
    } else {
      // OPTIMISTIC UPDATE: Add new request immediately (0ms)
      const tempRequestId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = Date.now();
      const newRequest: TableRequest = {
        id: tempRequestId,
        action: '🎭 АНИМАТОР ЗА ДЕТСКИ КЪТ',
        details: 'Заявка за аниматор',
        total: 0,
        status: 'pending',
        timestamp: timestamp,
        source: source,
        requestType: 'animator',
      };

      setTables(prev => {
        const updated = { ...prev };
        if (!updated[tableId]) {
          updated[tableId] = {
            tableId,
            isLocked: false,
            cart: [],
            requests: [],
            isVip: false,
          };
        }
        
        updated[tableId] = {
          ...updated[tableId],
          requests: [...updated[tableId].requests, newRequest],
        };
        
        return updated;
      });

      // Update refs immediately
      tablesRef.current = {
        ...tablesRef.current,
        [tableId]: {
          ...tablesRef.current[tableId] || {
            tableId,
            isLocked: false,
            cart: [],
            requests: [],
            isVip: false,
          },
          requests: [...(tablesRef.current[tableId]?.requests || []), newRequest],
        },
      };

      // Force re-render to show optimistic update instantly
      setRealtimeUpdateVersion(prev => prev + 1);

      // Trigger instant feedback (0ms) for StaffDashboard (same tab)
      if (onNewOrderCallbackRef.current) {
        try {
          onNewOrderCallbackRef.current('animator', tableId);
          console.log(`⚡ Instant feedback triggered for optimistic animator call`);
        } catch (error) {
          console.error('Error in instant feedback callback:', error);
        }
      }

      // BROADCAST to all other tabs/windows (0ms, no database)
      broadcastUpdate('NEW_REQUEST', {
        tableId,
        request: newRequest,
      });

      console.log(`⚡ Optimistic animator request added instantly (0ms) - Temp ID: ${tempRequestId}, Table: ${tableId}`);

    try {
      // Check if there's already an active animator request for this table
      const { data: existingRequest } = await supabase
        .from('table_requests')
        .select('id, status, child_location')
        .eq('table_id', tableId)
        .eq('request_type', 'animator')
        .in('status', ['pending', 'confirmed'])
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingRequest) {
        // If there's an active request, just update the timestamp (client is calling again)
        const { error: updateError } = await supabase
          .from('table_requests')
          .update({
              timestamp: timestamp,
            source: source,
          })
          .eq('id', existingRequest.id);

        if (updateError) {
            // ROLLBACK: Remove optimistic update on error
            console.error('❌ Database update failed - rolling back optimistic update');
            setTables(prev => {
              const updated = { ...prev };
              if (updated[tableId]) {
                updated[tableId] = {
                  ...updated[tableId],
                  requests: updated[tableId].requests.filter(req => req.id !== tempRequestId),
                };
              }
              return updated;
            });
            
            // Restore refs
            tablesRef.current = {
              ...tablesRef.current,
              [tableId]: {
                ...tablesRef.current[tableId],
                requests: tablesRef.current[tableId].requests.filter(req => req.id !== tempRequestId),
              },
            };
            
          throw updateError;
        }
          
          // Replace temp ID with existing request ID
          setTables(prev => {
            const updated = { ...prev };
            if (updated[tableId]) {
              updated[tableId] = {
                ...updated[tableId],
                requests: updated[tableId].requests.map(req =>
                  req.id === tempRequestId ? { ...req, id: existingRequest.id } : req
                ),
              };
            }
            return updated;
          });
          
          // Update refs
          tablesRef.current = {
            ...tablesRef.current,
            [tableId]: {
              ...tablesRef.current[tableId],
              requests: tablesRef.current[tableId].requests.map(req =>
                req.id === tempRequestId ? { ...req, id: existingRequest.id } : req
              ),
            },
          };
          
          console.log(`✅ Animator request synced with database - Real ID: ${existingRequest.id}`);
      } else {
        // Create new request only if there's no active one
          const realRequestId = `req_${Date.now()}`;
        const { error: insertError } = await supabase
          .from('table_requests')
          .insert({
              id: realRequestId,
            table_id: tableId,
            action: '🎭 АНИМАТОР ЗА ДЕТСКИ КЪТ',
            details: 'Заявка за аниматор',
            total: 0,
            status: 'pending',
              timestamp: timestamp,
            source: source,
            request_type: 'animator',
          });

        if (insertError) {
            // ROLLBACK: Remove optimistic update on error
            console.error('❌ Database insert failed - rolling back optimistic update');
            setTables(prev => {
              const updated = { ...prev };
              if (updated[tableId]) {
                updated[tableId] = {
                  ...updated[tableId],
                  requests: updated[tableId].requests.filter(req => req.id !== tempRequestId),
                };
              }
              return updated;
            });
            
            // Restore refs
            tablesRef.current = {
              ...tablesRef.current,
              [tableId]: {
                ...tablesRef.current[tableId],
                requests: tablesRef.current[tableId].requests.filter(req => req.id !== tempRequestId),
              },
            };
            
          throw insertError;
      }

          // Replace temp ID with real ID from database
          setTables(prev => {
            const updated = { ...prev };
            if (updated[tableId]) {
              updated[tableId] = {
                ...updated[tableId],
                requests: updated[tableId].requests.map(req =>
                  req.id === tempRequestId ? { ...req, id: realRequestId } : req
                ),
              };
            }
            return updated;
          });
          
          // Update refs
          tablesRef.current = {
            ...tablesRef.current,
            [tableId]: {
              ...tablesRef.current[tableId],
              requests: tablesRef.current[tableId].requests.map(req =>
                req.id === tempRequestId ? { ...req, id: realRequestId } : req
              ),
            },
          };
          
          console.log(`✅ Animator request synced with database - Real ID: ${realRequestId}`);
        }
    } catch (error) {
        console.error('Error syncing animator request with database:', error);
      throw error;
      }
    }
  }, [tables, loadTableSessions]);

  // Complete animator request (only animator can do this) - starts timer
  const completeAnimatorRequest = useCallback(async (tableId: string, requestId: string, animatorName: string) => {
    // Get current state for rollback
    const currentTable = tablesRef.current[tableId];
    const currentRequest = currentTable?.requests.find(r => r.id === requestId);
    
    if (!currentRequest) {
      console.error('Request not found for optimistic update');
      return;
    }

    const nowTimestamp = Date.now();

    // OPTIMISTIC UPDATE: Update request status instantly (0ms)
    setTables(prev => {
      const updated = { ...prev };
      if (!updated[tableId]) return updated;
      
      updated[tableId] = {
        ...updated[tableId],
        requests: updated[tableId].requests.map(req =>
          req.id === requestId ? {
            ...req,
            status: 'confirmed' as const,
            assignedTo: animatorName,
            childLocation: 'kids_zone' as const,
            timerStartedAt: nowTimestamp,
            timerPausedAt: undefined,
            totalTimeElapsed: 0,
            hourlyRate: 10.00
          } : req
        ),
      };
      
      return updated;
    });

    // Update refs immediately
    tablesRef.current = {
      ...tablesRef.current,
      [tableId]: {
        ...tablesRef.current[tableId],
        requests: tablesRef.current[tableId].requests.map(req =>
          req.id === requestId ? {
            ...req,
            status: 'confirmed' as const,
            assignedTo: animatorName,
            childLocation: 'kids_zone' as const,
            timerStartedAt: nowTimestamp,
            timerPausedAt: undefined,
            totalTimeElapsed: 0,
            hourlyRate: 10.00
          } : req
        ),
      },
    };

    // Force re-render
    setRealtimeUpdateVersion(prev => prev + 1);

    // BROADCAST to all other tabs/windows (0ms, no database)
    broadcastUpdate('REQUEST_UPDATED', {
      tableId,
      requestId,
      updates: { 
        status: 'confirmed',
        assignedTo: animatorName,
        childLocation: 'kids_zone',
        timerStartedAt: nowTimestamp,
        timerPausedAt: undefined,
        totalTimeElapsed: 0,
        hourlyRate: 10.00
      },
    });

    console.log(`⚡ Optimistic update: Animator request confirmed instantly (0ms) - Request: ${requestId}`);

    // If this is a temporary ID, skip database operations
    if (requestId.startsWith('temp_')) {
      console.log(`⏳ Request ${requestId} is temporary - skipping database sync, will sync when real ID is assigned`);
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('table_requests')
        .update({ 
          status: 'confirmed',
          assigned_to: animatorName,
          child_location: 'kids_zone',
          timer_started_at: nowTimestamp,
          timer_paused_at: null,
          total_time_elapsed: 0,
          hourly_rate: 10.00
        })
        .eq('id', requestId)
        .eq('table_id', tableId)
        .eq('request_type', 'animator');
      
      if (updateError) {
        console.error('❌ Database update failed - rolling back optimistic update');
        // ROLLBACK
        setTables(prev => {
          const updated = { ...prev };
          if (updated[tableId]) {
            updated[tableId] = {
              ...updated[tableId],
              requests: updated[tableId].requests.map(req =>
                req.id === requestId ? currentRequest : req
              ),
            };
          }
          return updated;
        });
        tablesRef.current = {
          ...tablesRef.current,
          [tableId]: currentTable,
        };
        throw updateError;
      }
      
      console.log(`✅ Animator request confirmed in database - Request: ${requestId}`);
    } catch (error) {
      console.error('Error completing animator request:', error);
      // Don't throw - optimistic update is already applied
    }
  }, [broadcastUpdate]);

  // Return child to table - pauses timer
  const returnChildToTable = useCallback(async (tableId: string, requestId: string) => {
    // Get current state for optimistic update
    const currentTable = tablesRef.current[tableId];
    const currentRequest = currentTable?.requests.find(r => r.id === requestId);
    
    if (!currentRequest) {
      console.error('Request not found for optimistic update');
      return;
    }

    const nowTimestamp = Date.now();
    let newElapsed = currentRequest.totalTimeElapsed || 0;

    // If timer was running, add the elapsed time since it started
    if (currentRequest.timerStartedAt && !currentRequest.timerPausedAt) {
      const elapsedSinceStart = Math.floor((nowTimestamp - currentRequest.timerStartedAt) / 1000);
      newElapsed += elapsedSinceStart;
    }

    // OPTIMISTIC UPDATE: Update child location instantly (0ms)
    setTables(prev => {
      const updated = { ...prev };
      if (!updated[tableId]) return updated;
      
      updated[tableId] = {
        ...updated[tableId],
        requests: updated[tableId].requests.map(req =>
          req.id === requestId ? {
            ...req,
            childLocation: 'returning_to_table' as const,
            timerPausedAt: nowTimestamp,
            totalTimeElapsed: newElapsed
          } : req
        ),
      };
      
      return updated;
    });

    // Update refs immediately
    tablesRef.current = {
      ...tablesRef.current,
      [tableId]: {
        ...tablesRef.current[tableId],
        requests: tablesRef.current[tableId].requests.map(req =>
          req.id === requestId ? {
            ...req,
            childLocation: 'returning_to_table' as const,
            timerPausedAt: nowTimestamp,
            totalTimeElapsed: newElapsed
          } : req
        ),
      },
    };

    // Force re-render
    setRealtimeUpdateVersion(prev => prev + 1);

    // BROADCAST to all other tabs/windows (0ms, no database)
    broadcastUpdate('REQUEST_UPDATED', {
      tableId,
      requestId,
      updates: { 
        childLocation: 'returning_to_table',
        timerPausedAt: nowTimestamp,
        totalTimeElapsed: newElapsed
      },
    });

    console.log(`⚡ Optimistic update: Child returning to table instantly (0ms) - Request: ${requestId}`);

    // If this is a temporary ID, skip database operations
    // The real ID will be assigned when the real-time subscription receives the INSERT event
    if (requestId.startsWith('temp_')) {
      console.log(`⏳ Request ${requestId} is temporary - skipping database sync, will sync when real ID is assigned`);
      return;
    }

    try {
      // Get current request from database to calculate elapsed time accurately
      const { data: dbRequest, error: fetchError } = await supabase
        .from('table_requests')
        .select('timer_started_at, timer_paused_at, total_time_elapsed')
        .eq('id', requestId)
        .eq('table_id', tableId)
        .single();

      if (fetchError || !dbRequest) {
        // If request not found, it might still be syncing - don't throw, just log
        console.warn(`⚠️ Request ${requestId} not found in database yet - local state updated, will sync later`);
        return;
      }

      let dbNewElapsed = dbRequest.total_time_elapsed || 0;

      // If timer was running, add the elapsed time since it started
      if (dbRequest.timer_started_at && !dbRequest.timer_paused_at) {
        const timerStartedAt = typeof dbRequest.timer_started_at === 'string' 
          ? parseInt(dbRequest.timer_started_at, 10)
          : dbRequest.timer_started_at;
        const elapsedSinceStart = Math.floor((nowTimestamp - timerStartedAt) / 1000);
        dbNewElapsed += elapsedSinceStart;
      }

      const { error: updateError } = await supabase
        .from('table_requests')
        .update({ 
          child_location: 'returning_to_table',
          timer_paused_at: nowTimestamp,
          total_time_elapsed: dbNewElapsed
        })
        .eq('id', requestId)
        .eq('table_id', tableId);

      if (updateError) {
        console.error('❌ Database update failed - rolling back optimistic update');
        // ROLLBACK
        setTables(prev => {
          const updated = { ...prev };
          if (updated[tableId]) {
            updated[tableId] = {
              ...updated[tableId],
              requests: updated[tableId].requests.map(req =>
                req.id === requestId ? currentRequest : req
              ),
            };
          }
          return updated;
        });
        tablesRef.current = {
          ...tablesRef.current,
          [tableId]: currentTable,
        };
        throw updateError;
      }
      
      console.log(`✅ Child returning to table synced with database - Request: ${requestId}`);
    } catch (error) {
      console.error('Error returning child to table:', error);
      // Don't throw - optimistic update is already applied
    }
  }, [broadcastUpdate]);

  // Take child back to zone - resumes timer
  const takeChildBackToZone = useCallback(async (tableId: string, requestId: string) => {
    // Get current state for optimistic update and rollback
    const currentTable = tablesRef.current[tableId];
    const currentRequest = currentTable?.requests.find(r => r.id === requestId);
    
    if (!currentRequest) {
      console.error('Request not found for optimistic update');
      return;
    }

      const nowTimestamp = Date.now();
      const currentElapsed = currentRequest.totalTimeElapsed || 0;

    // OPTIMISTIC UPDATE: Update child location instantly (0ms)
      setTables(prev => {
        const updated = { ...prev };
        if (!updated[tableId]) return updated;
        
        updated[tableId] = {
          ...updated[tableId],
          requests: updated[tableId].requests.map(req =>
            req.id === requestId ? {
              ...req,
              childLocation: 'kids_zone' as const,
              timerStartedAt: nowTimestamp,
              timerPausedAt: undefined,
            totalTimeElapsed: currentElapsed
            } : req
          ),
        };
        
        return updated;
      });

    // Update refs immediately
    tablesRef.current = {
      ...tablesRef.current,
      [tableId]: {
        ...tablesRef.current[tableId],
        requests: tablesRef.current[tableId].requests.map(req =>
          req.id === requestId ? {
            ...req,
            childLocation: 'kids_zone' as const,
            timerStartedAt: nowTimestamp,
            timerPausedAt: undefined,
            totalTimeElapsed: currentElapsed
          } : req
        ),
      },
    };

    // Force re-render
    setRealtimeUpdateVersion(prev => prev + 1);

    // BROADCAST to all other tabs/windows (0ms, no database)
    broadcastUpdate('REQUEST_UPDATED', {
      tableId,
      requestId,
      updates: { 
        childLocation: 'kids_zone',
        timerStartedAt: nowTimestamp,
        timerPausedAt: undefined,
        totalTimeElapsed: currentElapsed
      },
    });

    console.log(`⚡ Optimistic update: Child back to zone instantly (0ms) - Request: ${requestId}`);

    // If this is a temporary ID, skip database operations
    if (requestId.startsWith('temp_')) {
      console.log(`⏳ Request ${requestId} is temporary - skipping database sync, will sync when real ID is assigned`);
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('table_requests')
        .update({ 
          child_location: 'kids_zone',
          timer_started_at: nowTimestamp,
          timer_paused_at: null
        })
        .eq('id', requestId)
        .eq('table_id', tableId);

      if (updateError) {
        console.error('❌ Database update failed - rolling back optimistic update');
        // ROLLBACK
        setTables(prev => {
          const updated = { ...prev };
          if (updated[tableId]) {
            updated[tableId] = {
              ...updated[tableId],
              requests: updated[tableId].requests.map(req =>
                req.id === requestId ? currentRequest : req
              ),
            };
          }
          return updated;
        });
        tablesRef.current = {
          ...tablesRef.current,
          [tableId]: currentTable,
        };
        throw updateError;
      }
      
      console.log(`✅ Child back to zone synced with database - Request: ${requestId}`);
    } catch (error) {
      console.error('Error taking child back to zone:', error);
      // Don't throw - optimistic update is already applied
    }
  }, [broadcastUpdate]);

  // Mark only bill requests as paid (leave orders untouched)
  const markBillRequestsAsPaid = useCallback(async (tableId: string) => {
    const currentTable = tables[tableId];
    if (!currentTable) return;

    // Get all bill requests for this table
    const billRequests = currentTable.requests.filter(
      r => (r.requestType === 'bill' || r.action.includes('BILL') || r.action.includes('Сметка')) &&
           (r.status === 'pending' || r.status === 'confirmed')
    );

    if (billRequests.length === 0) {
      console.log(`No bill requests to mark as paid for ${tableId}`);
      return;
    }

    // Optimistic update: remove only bill requests from local state
    setTables(prev => {
      const updated = { ...prev };
      if (!updated[tableId]) return updated;
      
      updated[tableId] = {
        ...updated[tableId],
        requests: updated[tableId].requests.filter(
          r => !(r.requestType === 'bill' || r.action.includes('BILL') || r.action.includes('Сметка')) ||
                (r.status !== 'pending' && r.status !== 'confirmed')
        ),
      };
      
      return updated;
    });

    try {
      // Mark all bill requests as completed in database
      const billRequestIds = billRequests.map(r => r.id);
      
      const { error: updateError } = await supabase
        .from('table_requests')
        .update({ status: 'completed' })
        .eq('table_id', tableId)
        .in('id', billRequestIds);

      if (updateError) {
        console.error('Error marking bill requests as paid:', updateError);
        loadTableSessions();
        throw updateError;
      }

      // Move bill requests to completed_orders
      const completedBills = billRequests.map(req => ({
        id: req.id,
        table_id: req.table_id,
        action: req.action,
        details: req.details || '',
        total: req.total,
        status: 'completed' as const,
        timestamp: req.timestamp,
        payment_method: req.paymentMethod || null,
      }));

      if (completedBills.length > 0) {
        const { error: insertError } = await supabase
          .from('completed_orders')
          .insert(completedBills);

        if (insertError) {
          console.error('Error moving bills to completed_orders:', insertError);
          // Continue even if insert fails
        }
      }

      // Delete bill requests from table_requests (they're now in completed_orders)
      const { error: deleteError } = await supabase
        .from('table_requests')
        .delete()
        .eq('table_id', tableId)
        .in('id', billRequestIds);

      if (deleteError) {
        console.error('Error deleting bill requests:', deleteError);
        // Reload to sync state
        loadTableSessions();
      } else {
        // Reload to ensure UI is in sync
        loadTableSessions();
      }
    } catch (error) {
      console.error('Error marking bill requests as paid:', error);
      loadTableSessions();
      throw error;
    }
  }, [tables, loadTableSessions]);

  // Daily menu functions
  const getDailyMenuItems = useCallback(async (date?: string): Promise<MenuItem[]> => {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_menu_assignments')
        .select(`
          *,
          menu_items (*)
        `)
        .eq('date', targetDate)
        .eq('is_visible', true)
        .order('created_at', { ascending: true }); // Preserve insertion order

      if (error) throw error;
      
      if (!data) return [];
      
      return data
        .filter(dma => dma.menu_items)
        .map(dma => mapMenuItem(dma.menu_items as DatabaseMenuItem));
    } catch (error) {
      console.error('Error getting daily menu items:', error);
      return [];
    }
  }, []);

  const setDailyMenuItems = useCallback(async (date: string, itemIds: string[]) => {
    try {
      // Delete existing assignments for this date
      await supabase
        .from('daily_menu_assignments')
        .delete()
        .eq('date', date);

      // Insert new assignments
      const assignments = itemIds.map(itemId => ({
        id: `dma_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        menu_item_id: itemId,
        date: date,
        is_visible: true,
      }));

      if (assignments.length > 0) {
        const { error } = await supabase
          .from('daily_menu_assignments')
          .insert(assignments);

        if (error) throw error;
      }

      // BROADCAST to all other tabs/windows (0ms)
      broadcastUpdate('DAILY_MENU_UPDATED', { date, itemIds });
      console.log(`⚡ Daily menu updated and broadcast - Date: ${date}`);
    } catch (error) {
      console.error('Error setting daily menu items:', error);
      throw error;
    }
  }, [broadcastUpdate]);

  // Category order functions
  const getCategoryOrder = useCallback(async (): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('menu_settings')
        .select('value')
        .eq('key', 'category_order')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data?.value) {
        return JSON.parse(data.value);
      }

      // Fallback to localStorage if no database entry
      const savedOrder = localStorage.getItem('menuCategoryOrder');
      if (savedOrder) {
        try {
          return JSON.parse(savedOrder);
        } catch (e) {
          return [];
        }
      }

      return [];
    } catch (error) {
      console.error('Error getting category order:', error);
      // Fallback to localStorage
      const savedOrder = localStorage.getItem('menuCategoryOrder');
      if (savedOrder) {
        try {
          return JSON.parse(savedOrder);
        } catch (e) {
          return [];
        }
      }
      return [];
    }
  }, []);

  const setCategoryOrder = useCallback(async (order: string[]): Promise<void> => {
    try {
      // Save to database - real-time subscription will handle updates
      const { error } = await supabase
        .from('menu_settings')
        .upsert({
          key: 'category_order',
          value: JSON.stringify(order),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key'
        });

      if (error) throw error;

      // Also save to localStorage as backup
      localStorage.setItem('menuCategoryOrder', JSON.stringify(order));

      console.log(`⚡ Category order updated in database`);
    } catch (error) {
      console.error('Error setting category order:', error);
      // Fallback to localStorage only
      localStorage.setItem('menuCategoryOrder', JSON.stringify(order));
      throw error;
    }
  }, []);

  // Item order functions per category
  const getItemOrder = useCallback(async (category: string): Promise<string[]> => {
    try {
      const key = `item_order_${category}`;
      const { data, error } = await supabase
        .from('menu_settings')
        .select('value')
        .eq('key', key)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.value) {
        return JSON.parse(data.value);
      }

      // Fallback to localStorage
      const savedOrder = localStorage.getItem(`menuItemOrder_${category}`);
      if (savedOrder) {
        try {
          return JSON.parse(savedOrder);
        } catch (e) {
          return [];
        }
      }

      return [];
    } catch (error) {
      console.error('Error getting item order:', error);
      // Fallback to localStorage
      const savedOrder = localStorage.getItem(`menuItemOrder_${category}`);
      if (savedOrder) {
        try {
          return JSON.parse(savedOrder);
        } catch (e) {
          return [];
        }
      }
      return [];
    }
  }, []);

  const setItemOrder = useCallback(async (category: string, itemIds: string[]): Promise<void> => {
    try {
      const key = `item_order_${category}`;
      // Save to database - real-time subscription will handle updates
      const { error } = await supabase
        .from('menu_settings')
        .upsert({
          key: key,
          value: JSON.stringify(itemIds),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key'
        });

      if (error) throw error;

      // Also save to localStorage as backup
      localStorage.setItem(`menuItemOrder_${category}`, JSON.stringify(itemIds));

      console.log(`⚡ Item order updated in database for category: ${category}`);
    } catch (error) {
      console.error('Error setting item order:', error);
      // Fallback to localStorage only
      localStorage.setItem(`menuItemOrder_${category}`, JSON.stringify(itemIds));
      throw error;
    }
  }, []);

  const toggleDailyMenuItemVisibility = useCallback(async (itemId: string, date: string, isVisible: boolean) => {
    try {
      const { error } = await supabase
        .from('daily_menu_assignments')
        .update({ is_visible: isVisible })
        .eq('menu_item_id', itemId)
        .eq('date', date);

      if (error) throw error;
    } catch (error) {
      console.error('Error toggling daily menu item visibility:', error);
      throw error;
    }
  }, []);

  // Rating function
  const submitRating = useCallback(async (tableId: string, rating: number, feedback?: string) => {
    try {
      const { error } = await supabase
        .from('customer_ratings')
        .insert({
          id: `rating_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          table_id: tableId,
          rating: rating,
          feedback: feedback || null,
          google_review_sent: false,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error submitting rating:', error);
      throw error;
    }
  }, []);

  // Revenue report function
  const getRevenueReport = useCallback(async (date: string): Promise<RevenueReport> => {
    try {
      const { data, error } = await supabase
        .from('completed_orders')
        .select('total, action')
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`)
        .eq('action', '🍽️ NEW ORDER');

      if (error) throw error;

      const total = (data || []).reduce((sum, order) => sum + parseFloat(String(order.total || '0')), 0);
      const orderCount = (data || []).length;

      return {
        total,
        orderCount,
        date,
      };
    } catch (error) {
      console.error('Error getting revenue report:', error);
      return { total: 0, orderCount: 0, date };
    }
  }, []);

  // Get pending orders (orders not confirmed)
  const getPendingOrders = useCallback((): TableRequest[] => {
    const allRequests: TableRequest[] = [];
    Object.values(tables).forEach(table => {
      table.requests.forEach(req => {
        if (req.requestType === 'order' && req.status === 'pending') {
          allRequests.push(req);
        }
      });
    });
    return allRequests;
  }, [tables]);

  // Memoize context value to prevent unnecessary re-renders
  // Include realtimeUpdateVersion to force re-render on real-time updates
  const contextValue = useMemo(() => {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/d1dcdf1e-0dcf-406d-bcdb-293c197ab831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RestaurantContext.tsx:2062',message:'contextValue useMemo recalculated',data:{realtimeUpdateVersion,tablesCount:Object.keys(tables).length,menuItemsCount:menuItems.length,loading},timestamp:Date.now(),runId:'run1',hypothesisId:'H'})}).catch(()=>{});
    // #endregion
    return {
      tables,
    menuItems,
    loading,
    realtimeUpdateVersion, // Include version to trigger re-renders
      getTableSession,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      clearCart,
      submitOrder,
      callWaiter,
      callAnimator,
      requestBill,
      completeRequest,
      completeAnimatorRequest,
      returnChildToTable,
      takeChildBackToZone,
      completeChildSession,
      clearAnimatorRequestAfterReturn,
    markAsPaid,
    markBillRequestsAsPaid,
      resetTable,
      getCartTotal,
      getCartItemCount,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    getDailyMenuItems,
    setDailyMenuItems,
    toggleDailyMenuItemVisibility,
    getCategoryOrder,
    setCategoryOrder,
    getItemOrder,
    setItemOrder,
    submitRating,
    getRevenueReport,
    getPendingOrders,
    loadTableSessions,
  };
  }, [
      tables,
    menuItems,
    loading,
    realtimeUpdateVersion, // Include in dependencies
      getTableSession,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      clearCart,
      submitOrder,
      callWaiter,
      callAnimator,
      requestBill,
      completeRequest,
      completeAnimatorRequest,
      returnChildToTable,
      takeChildBackToZone,
      completeChildSession,
      clearAnimatorRequestAfterReturn,
    markAsPaid,
    markBillRequestsAsPaid,
      resetTable,
      getCartTotal,
      getCartItemCount,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    getDailyMenuItems,
    setDailyMenuItems,
    toggleDailyMenuItemVisibility,
    submitRating,
    getRevenueReport,
    getPendingOrders,
    loadTableSessions,
  ]);

  return (
    <RestaurantContext.Provider value={contextValue}>
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurant = () => {
  const context = useContext(RestaurantContext);
  if (context === undefined) {
    throw new Error('useRestaurant must be used within a RestaurantProvider');
  }
  return context;
};
