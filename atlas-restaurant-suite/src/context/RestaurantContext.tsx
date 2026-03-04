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
  const loadTableSessions = useCallback(async () => {
    try {
      setLoading(true);
      
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
        setLoading(false);
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

      setTables(sessions);
      setLoading(false);
    } catch (error) {
      console.error('Error loading table sessions:', error);
      // Fallback to default tables on error
      setTables(defaultTables);
      setLoading(false);
    }
  }, [lastCleanup, paidTables]); // paidTables is used in filter

  useEffect(() => {
    loadTableSessions();

    // Set up real-time subscriptions
    const cartSubscription = supabase
      .channel('cart_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'cart_items' },
        () => {
          // Immediate reload for instant cart updates
          loadTableSessions();
        }
      )
      .subscribe();

    const requestsSubscription = supabase
      .channel('requests_changes')
      .on('postgres_changes',
        { 
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public', 
          table: 'table_requests' 
        },
        (payload) => {
          console.log('Real-time table_requests change:', payload.eventType, payload);
          
          // Check if this is an animator request
          const requestType = payload.new?.request_type || payload.old?.request_type;
          const isAnimatorRequest = requestType === 'animator';
          
          if (payload.eventType === 'INSERT') {
            // Immediate reload for new requests (animator calls, orders, etc.)
            loadTableSessions();
          } else if (payload.eventType === 'UPDATE') {
            // Immediate reload for all request updates (orders, bills, animator, etc.)
            loadTableSessions();
          } else if (payload.eventType === 'DELETE') {
            // Immediate reload when requests are deleted (table paid/reset, etc.)
            loadTableSessions();
          }
        }
      )
      .subscribe();

    // OPTIMIZATION: Selective real-time updates - only update changed items
    // This avoids full reloads and improves performance significantly
    const menuSubscription = supabase
      .channel('menu_changes')
      .on('postgres_changes',
        { 
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public', 
          table: 'menu_items' 
        },
        (payload) => {
          console.log('Real-time menu_items change:', payload.eventType, payload);
          
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
      )
      .subscribe();

    // Real-time subscription for restaurant_tables changes
    const tablesSubscription = supabase
      .channel('tables_changes')
      .on('postgres_changes',
        { 
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public', 
          table: 'restaurant_tables' 
        },
        () => {
          // Immediate reload for instant table status updates
          loadTableSessions();
        }
      )
      .subscribe();

    // Real-time subscription for daily_menu_assignments changes
    // Immediate reload for MenuEditor to see changes instantly
    const dailyMenuSubscription = supabase
      .channel('daily_menu_changes')
      .on('postgres_changes',
        { 
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public', 
          table: 'daily_menu_assignments' 
        },
        () => {
          // Immediate reload for MenuEditor to see daily menu changes instantly
          loadTableSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(cartSubscription);
      supabase.removeChannel(requestsSubscription);
      supabase.removeChannel(menuSubscription);
      supabase.removeChannel(tablesSubscription);
      supabase.removeChannel(dailyMenuSubscription);
    };
  }, [loadTableSessions]);

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
    try {
      // Get current cart
      const { data: cartItems, error: cartError } = await supabase
        .from('cart_items')
        .select(`
          *,
          menu_items (id, name, price)
        `)
        .eq('table_id', tableId);

      if (cartError) throw cartError;
      if (!cartItems || cartItems.length === 0) return;
      
      const orderDetails = cartItems
        .map(ci => {
          const menuItem = ci.menu_items as DatabaseMenuItem | null;
          return `${ci.quantity}x ${menuItem?.name || 'Unknown'}`;
        })
        .join(', ');
      const orderTotal = cartItems.reduce(
        (sum, ci) => {
          const menuItem = ci.menu_items as DatabaseMenuItem | null;
          return sum + (parseFloat(String(menuItem?.price || '0')) * ci.quantity);
        },
        0
      );

      // Create order request
      const requestId = `req_${Date.now()}`;
      await supabase
        .from('table_requests')
        .insert({
          id: requestId,
          table_id: tableId,
        action: '🍽️ NEW ORDER',
        details: orderDetails,
        total: orderTotal,
        status: 'pending',
        timestamp: Date.now(),
          source: source,
          request_type: 'order',
        });
      
      // Clear cart immediately after order submission
      // This resets the menu to clean state, but bill requests remain visible
      await supabase
        .from('cart_items')
        .delete()
        .eq('table_id', tableId);

      // Optimistic update: clear cart in UI immediately
      setTables(prev => {
        const updated = { ...prev };
        if (updated[tableId]) {
          updated[tableId] = {
            ...updated[tableId],
            cart: [], // Clear cart immediately
          };
        }
        return updated;
      });
    } catch (error) {
      console.error('Error submitting order:', error);
      throw error;
    }
  }, []); // No dependencies - we fetch from database and use setTables (stable)

  const callWaiter = useCallback(async (tableId: string, source: 'nfc' | 'qr' | 'direct' = 'direct') => {
    try {
      await supabase
        .from('table_requests')
        .insert({
        id: `req_${Date.now()}`,
          table_id: tableId,
        action: '🔔 WAITER CALL',
        details: 'Customer requested assistance',
        total: 0,
        status: 'pending',
        timestamp: Date.now(),
          source: source,
          request_type: 'waiter',
        });
    } catch (error) {
      console.error('Error calling waiter:', error);
    }
  }, []);

  const requestBill = useCallback(async (tableId: string, paymentMethod: 'cash' | 'card', source: 'nfc' | 'qr' | 'direct' = 'direct') => {
    try {
      // Get total from all completed orders
      const { data: requests } = await supabase
        .from('table_requests')
        .select('total')
        .eq('table_id', tableId)
        .eq('status', 'completed');
      
      const totalBill = (requests || []).reduce((sum, r) => sum + parseFloat(r.total || '0'), 0);
      
      // Create bill request
      await supabase
        .from('table_requests')
        .insert({
        id: `req_${Date.now()}`,
          table_id: tableId,
        action: '💳 BILL REQUEST',
        details: `Payment: ${paymentMethod === 'cash' ? 'Cash' : 'Card'}`,
        total: totalBill,
        status: 'pending',
        timestamp: Date.now(),
          payment_method: paymentMethod,
          source: source,
          request_type: 'bill',
        });

      // Don't lock table when requesting bill - allow customer to see menu
      // Table will be locked/reset when bill is marked as paid by staff
    } catch (error) {
      console.error('Error requesting bill:', error);
    }
  }, []);

  const completeRequest = useCallback(async (tableId: string, requestId: string) => {
    // Optimistic update: update request status to 'confirmed' in local state
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

    try {
      // Update request status to 'confirmed' in database (DO NOT DELETE)
      // The request stays in table_requests until the table is marked as paid
      const { error: updateError } = await supabase
        .from('table_requests')
        .update({ status: 'confirmed' })
        .eq('id', requestId)
        .eq('table_id', tableId);
      
      if (updateError) {
        console.error('Error confirming request:', updateError);
        // Rollback optimistic update on error
        loadTableSessions();
        throw updateError;
      }

      console.log(`✅ Confirmed request ${requestId} - status updated to 'confirmed' (stays in table_requests until paid)`);
    } catch (error) {
      console.error('Error confirming request:', error);
      // Rollback optimistic update on error
      loadTableSessions();
      throw error;
    }
  }, [loadTableSessions]);

  // Complete child session - calculate final charge and add to bill
  // MUST be defined before markAsPaid since markAsPaid uses it
  const completeChildSession = useCallback(async (tableId: string, requestId: string) => {
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

      loadTableSessions();
    } catch (error) {
      console.error('Error completing child session:', error);
      loadTableSessions();
      throw error;
    }
  }, [loadTableSessions]);

  const markAsPaid = useCallback(async (tableId: string) => {
    // Get current table data before clearing for archive
    const currentTable = tables[tableId];
    
    // Complete child session if there's an active animator request
    const animatorRequest = currentTable?.requests.find(req => req.requestType === 'animator' && req.status === 'confirmed');
    if (animatorRequest && (animatorRequest.childLocation === 'kids_zone' || animatorRequest.childLocation === 'returning_to_table')) {
      try {
        await completeChildSession(tableId, animatorRequest.id);
        console.log(`✅ Completed child session for ${tableId} before payment`);
      } catch (error) {
        console.error('Error completing child session before payment:', error);
        // Continue with payment even if child session completion fails
      }
    }
    
    // Optimistic update: clear paid orders immediately
    setTables(prev => {
      const updated = { ...prev };
      if (!updated[tableId]) return updated;
      
      // Remove all requests (they're being paid, so remove from view)
      updated[tableId] = {
        ...updated[tableId],
        isLocked: false,
        requests: [], // Clear all orders when paid
      };
      
      return updated;
    });

    try {
      // Get all requests from database to move to completed_orders
      const { data: requestsData, error: fetchError } = await supabase
        .from('table_requests')
        .select('*')
        .eq('table_id', tableId);

      if (fetchError) {
        console.error('Error fetching requests:', fetchError);
        loadTableSessions();
        throw fetchError;
      }

      // Move all requests to completed_orders table immediately
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

        const { error: insertError } = await supabase
          .from('completed_orders')
          .insert(completedOrders);

        if (insertError) {
          console.error('Error moving to completed_orders:', insertError);
          // Continue even if insert fails, but log it
        } else {
          console.log(`Moved ${completedOrders.length} orders to completed_orders for ${tableId}`);
        }
      }

      // Archive the paid session for historical records
      if (currentTable && currentTable.requests.length > 0) {
        const totalRevenue = currentTable.requests.reduce((sum, r) => sum + r.total, 0);
        const sessionStartTime = currentTable.requests.length > 0 
          ? Math.min(...currentTable.requests.map(r => r.timestamp))
          : Date.now();
        const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 60000);

        // Archive the paid session
        const { error: archiveError } = await supabase
          .from('table_history_archive')
          .insert({
            id: `archive_${tableId}_${Date.now()}`,
            table_id: tableId,
            cart_items: [],
            requests: requestsData || [],
            total_revenue: totalRevenue,
            session_duration_minutes: sessionDuration,
          });

        if (archiveError) {
          console.error('Error archiving paid session:', archiveError);
          // Continue even if archive fails
        }
      }

      // Delete ALL requests from table_requests immediately (remove from active view)
      const { data: deletedRequests, error: deleteError } = await supabase
        .from('table_requests')
        .delete()
        .eq('table_id', tableId)
        .select();
      
      if (deleteError) {
        console.error('Error deleting requests:', deleteError);
        // Rollback on error
        loadTableSessions();
        throw deleteError;
      }
      
      console.log(`Deleted ${deletedRequests?.length || 0} requests from table_requests for ${tableId}`);

      // Clear cart as well (paid orders shouldn't have active cart)
      const { error: cartError } = await supabase
        .from('cart_items')
        .delete()
        .eq('table_id', tableId);

      if (cartError) {
        console.error('Error clearing cart after payment:', cartError);
        // Continue even if cart clear fails
      }

      // Unlock the table and start new session (do this BEFORE real-time reload)
      // This ensures the next data load filters out old orders
      const newSessionStart = new Date().toISOString();
      const { error: unlockError } = await supabase
        .from('restaurant_tables')
        .update({ 
          is_locked: false,
          session_started_at: newSessionStart // Start new session when marking as paid
        })
        .eq('table_id', tableId);
      
      if (unlockError) {
        console.error('Error unlocking table:', unlockError);
        // Rollback on error
        loadTableSessions();
        throw unlockError;
      }

      // Mark this table as paid to prevent showing old orders
      setPaidTables(prev => new Set(prev).add(tableId));
      
      // Double-check optimistic update to ensure requests stay cleared
      // This prevents real-time subscription from showing old orders
      setTables(prev => {
        const updated = { ...prev };
        if (updated[tableId]) {
          updated[tableId] = {
            ...updated[tableId],
            isLocked: false,
            requests: [], // Ensure requests stay empty
          };
        }
        return updated;
      });

      // Clear the paid flag after a short delay to allow deletion to complete
      // This gives time for the database deletion to finish
      setTimeout(() => {
        setPaidTables(prev => {
          const next = new Set(prev);
          next.delete(tableId);
          return next;
        });
      }, 2000); // 2 second delay to ensure deletion completes

      // Real-time subscription will sync, but optimistic update makes UI feel instant
    } catch (error) {
      console.error('Error marking as paid:', error);
      throw error;
    }
  }, [loadTableSessions, tables, completeChildSession]);

  const resetTable = useCallback(async (tableId: string) => {
    // Optimistic update: clear everything immediately
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
        console.error('Error fetching cart:', cartResult.error);
        throw cartResult.error;
      }
      if (requestsResult.error) {
        console.error('Error fetching requests:', requestsResult.error);
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
        console.error('Error deleting requests:', requestsError);
        loadTableSessions();
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
      console.error('❌ Error resetting table:', error);
      // Reload on error to show actual database state
      loadTableSessions();
      throw error;
    }
  }, [loadTableSessions]);

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
    try {
      const newId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await supabase
        .from('menu_items')
        .insert({
          id: newId,
          cat: item.cat,
          name: item.name,
          price: item.price,
          description: item.desc || item.description || null,
        });
    } catch (error) {
      console.error('Error adding menu item:', error);
    }
  }, []);

  const updateMenuItem = useCallback(async (id: string, updates: Partial<MenuItem>) => {
    try {
      const updateData: Partial<DatabaseMenuItem> = {};
      if (updates.cat !== undefined) updateData.cat = updates.cat;
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.price !== undefined) updateData.price = updates.price;
      if (updates.desc !== undefined || updates.description !== undefined) {
        updateData.description = updates.desc || updates.description || null;
      }

      await supabase
        .from('menu_items')
        .update(updateData)
        .eq('id', id);
    } catch (error) {
      console.error('Error updating menu item:', error);
    }
  }, []);

  const deleteMenuItem = useCallback(async (id: string) => {
    try {
      await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);
    } catch (error) {
      console.error('Error deleting menu item:', error);
    }
  }, []);

  // Call animator function
  const callAnimator = useCallback(async (tableId: string, source: 'nfc' | 'qr' | 'direct' = 'direct') => {
    // Check if there's already an active animator request in local state
    const currentTable = tables[tableId];
    const existingRequest = currentTable?.requests.find(
      req => req.requestType === 'animator' && (req.status === 'pending' || req.status === 'confirmed')
    );

    if (existingRequest) {
      // Optimistic update: update timestamp immediately in local state
      setTables(prev => {
        const updated = { ...prev };
        if (!updated[tableId]) return updated;
        
        updated[tableId] = {
          ...updated[tableId],
          requests: updated[tableId].requests.map(req =>
            req.id === existingRequest.id ? {
              ...req,
              timestamp: Date.now(),
              source: source
            } : req
          ),
        };
        
        return updated;
      });
    } else {
      // Optimistic update: add new request immediately in local state
      const newRequestId = `req_${Date.now()}`;
      const newRequest: TableRequest = {
        id: newRequestId,
        action: '🎭 АНИМАТОР ЗА ДЕТСКИ КЪТ',
        details: 'Заявка за аниматор',
        total: 0,
        status: 'pending',
        timestamp: Date.now(),
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
    }

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
            timestamp: Date.now(),
            source: source,
          })
          .eq('id', existingRequest.id);

        if (updateError) {
          // Rollback optimistic update on error
          loadTableSessions();
          throw updateError;
        }
      } else {
        // Create new request only if there's no active one
        const requestId = `req_${Date.now()}`;
        const { error: insertError } = await supabase
          .from('table_requests')
          .insert({
            id: requestId,
            table_id: tableId,
            action: '🎭 АНИМАТОР ЗА ДЕТСКИ КЪТ',
            details: 'Заявка за аниматор',
            total: 0,
            status: 'pending',
            timestamp: Date.now(),
            source: source,
            request_type: 'animator',
          });

        if (insertError) {
          // Rollback optimistic update on error
          loadTableSessions();
          throw insertError;
        }
      }
      // Real-time subscription will sync the update, but optimistic update makes UI feel instant
    } catch (error) {
      console.error('Error calling animator:', error);
      // Rollback optimistic update on error
      loadTableSessions();
      throw error;
    }
  }, [tables, loadTableSessions]);

  // Complete animator request (only animator can do this) - starts timer
  const completeAnimatorRequest = useCallback(async (tableId: string, requestId: string, animatorName: string) => {
    // Optimistic update: update request status immediately in local state
    setTables(prev => {
      const updated = { ...prev };
      if (!updated[tableId]) return updated;
      
      const nowTimestamp = Date.now();
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

    try {
      const nowTimestamp = Date.now(); // Use timestamp (milliseconds) for BIGINT field
      const { error: updateError } = await supabase
        .from('table_requests')
        .update({ 
          status: 'confirmed',
          assigned_to: animatorName,
          child_location: 'kids_zone',
          timer_started_at: nowTimestamp,
          timer_paused_at: null,
          total_time_elapsed: 0,
          hourly_rate: 10.00 // Default 10 EUR per hour
        })
        .eq('id', requestId)
        .eq('table_id', tableId)
        .eq('request_type', 'animator');
      
      if (updateError) {
        console.error('Error completing animator request:', updateError);
        // Rollback optimistic update on error
        loadTableSessions();
        throw updateError;
      }
      // Real-time subscription will sync the update, but optimistic update makes UI feel instant
    } catch (error) {
      console.error('Error completing animator request:', error);
      // Rollback optimistic update on error
      loadTableSessions();
      throw error;
    }
  }, [loadTableSessions]);

  // Return child to table - pauses timer
  const returnChildToTable = useCallback(async (tableId: string, requestId: string) => {
    try {
      // Get current request to calculate elapsed time
      const { data: currentRequest, error: fetchError } = await supabase
        .from('table_requests')
        .select('timer_started_at, timer_paused_at, total_time_elapsed')
        .eq('id', requestId)
        .eq('table_id', tableId)
        .single();

      if (fetchError || !currentRequest) {
        throw fetchError || new Error('Request not found');
      }

      const nowTimestamp = Date.now(); // Use timestamp (milliseconds) for BIGINT field
      let newElapsed = currentRequest.total_time_elapsed || 0;

      // If timer was running, add the elapsed time since it started
      if (currentRequest.timer_started_at && !currentRequest.timer_paused_at) {
        // timer_started_at is stored as BIGINT (timestamp in milliseconds)
        const timerStartedAt = typeof currentRequest.timer_started_at === 'string' 
          ? parseInt(currentRequest.timer_started_at, 10)
          : currentRequest.timer_started_at;
        const elapsedSinceStart = Math.floor((nowTimestamp - timerStartedAt) / 1000);
        newElapsed += elapsedSinceStart;
      }

      const { error: updateError } = await supabase
        .from('table_requests')
        .update({ 
          child_location: 'returning_to_table',
          timer_paused_at: nowTimestamp, // Use timestamp instead of ISO string
          total_time_elapsed: newElapsed
        })
        .eq('id', requestId)
        .eq('table_id', tableId);

      if (updateError) {
        console.error('Error returning child to table:', updateError);
        loadTableSessions();
        throw updateError;
      }
    } catch (error) {
      console.error('Error returning child to table:', error);
      loadTableSessions();
      throw error;
    }
  }, [loadTableSessions]);

  // Take child back to zone - resumes timer
  const takeChildBackToZone = useCallback(async (tableId: string, requestId: string) => {
    // Optimistic update: update request immediately in local state
    const currentTable = tables[tableId];
    const currentRequest = currentTable?.requests.find(r => r.id === requestId);
    
    if (currentRequest) {
      const nowTimestamp = Date.now();
      const currentElapsed = currentRequest.totalTimeElapsed || 0;

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
              totalTimeElapsed: currentElapsed // Keep existing elapsed time
            } : req
          ),
        };
        
        return updated;
      });
    }

    try {
      const nowTimestamp = Date.now(); // Use timestamp (milliseconds) for BIGINT field
      const { error: updateError } = await supabase
        .from('table_requests')
        .update({ 
          child_location: 'kids_zone',
          timer_started_at: nowTimestamp, // Restart timer from now (timestamp)
          timer_paused_at: null
        })
        .eq('id', requestId)
        .eq('table_id', tableId);

      if (updateError) {
        console.error('Error taking child back to zone:', updateError);
        console.error('Update details:', { tableId, requestId, nowTimestamp });
        // Rollback optimistic update on error
        loadTableSessions();
        throw updateError;
      }
      // Real-time subscription will sync the update, but optimistic update makes UI feel instant
    } catch (error) {
      console.error('Error taking child back to zone:', error);
      // Rollback optimistic update on error
      loadTableSessions();
      throw error;
    }
  }, [loadTableSessions, tables]);

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
        .eq('is_visible', true);

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
    } catch (error) {
      console.error('Error setting daily menu items:', error);
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
  const contextValue = useMemo(() => ({
      tables,
    menuItems,
    loading,
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
  }), [
      tables,
    menuItems,
    loading,
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
