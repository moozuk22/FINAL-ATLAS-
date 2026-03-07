import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { Send, Bell, CreditCard, Lock, ArrowLeft, Loader2, Sparkles, ShoppingBag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRestaurant, MenuItem } from '@/context/RestaurantContext';
import MenuItemCard from '@/components/MenuItemCard';
import CartDrawer from '@/components/CartDrawer';
import PaymentModal from '@/components/PaymentModal';
import RatingModal from '@/components/RatingModal';
import { trackQRScan } from '@/utils/analytics';
import { triggerHapticFeedback, isOnline } from '@/utils/optimization';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

// Simple menu item row without drag and drop functionality
const MenuItemRow: React.FC<{
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  disabled: boolean;
  isLoading: boolean;
}> = ({ item, quantity, onAdd, onRemove, disabled, isLoading }) => {
  return (
    <div className="relative">
      <MenuItemCard
        id={item.id}
        name={item.name}
        price={item.price}
        description={item.desc || item.description}
        quantity={quantity}
        onAdd={onAdd}
        onRemove={onRemove}
        disabled={disabled}
        isLoading={isLoading}
      />
    </div>
  );
};

const CustomerMenu: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { tableNumber } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Support both /menu?table=Table_01 and /t/1 formats
  const getTableId = () => {
    if (tableNumber) {
      // Convert /t/1 to Table_01 format
      const num = parseInt(tableNumber);
      if (!isNaN(num) && num >= 1 && num <= 10) {
        return `Table_${String(num).padStart(2, '0')}`;
      }
    }
    return searchParams.get('table') || 'Table_01';
  };
  
  const tableId = getTableId();
  
  // Determine source (qr, nfc, or direct)
  const source = useMemo(() => {
    if (tableNumber) return 'qr'; // QR scan
    // Could add NFC detection here
    return 'direct';
  }, [tableNumber]);
  
  // Track QR code scan analytics
  useEffect(() => {
    if (tableNumber) {
      trackQRScan(tableId);
    }
  }, [tableNumber, tableId]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const {
    menuItems,
    getDailyMenuItems,
    getCategoryOrder,
    getItemOrder,
    getTableSession,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    submitOrder,
    callWaiter,
    callAnimator,
    requestBill,
    loading,
    tables,
    realtimeUpdateVersion, // Force re-render on real-time updates
    loadTableSessions, // Manual refresh function
  } = useRestaurant();

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false); // Cart drawer closed by default
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [currentTime, setCurrentTime] = useState(Date.now());
  // Pending items - selected but not yet added to cart
  const [pendingItems, setPendingItems] = useState<Array<{ id: string; name: string; price: number; quantity: number }>>([]);
  const [dailyMenuItems, setDailyMenuItems] = useState<MenuItem[]>([]);
  const [dailyMenuLoading, setDailyMenuLoading] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [itemOrders, setItemOrders] = useState<Record<string, string[]>>({});
  
  // Check if menu should be hidden (after 15:00) - DISABLED FOR NOW
  const isMenuHidden = false; // Toggle back: useMemo(() => { const hour = new Date().getHours(); return hour >= 15; }, []);

  // Update current time every second for timer display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load daily menu (today, visible only). Customer menu renders ONLY the daily menu.
  useEffect(() => {
    let mounted = true;
    (async () => {
      setDailyMenuLoading(true);
      const items = await getDailyMenuItems();
      if (!mounted) return;
      setDailyMenuItems(items);
      setDailyMenuLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [getDailyMenuItems]);

  // Load category order on mount
  useEffect(() => {
    const loadCategoryOrder = async () => {
      try {
        const order = await getCategoryOrder();
        if (order.length > 0) {
          setCategoryOrder(order);
        } else {
          // Fallback to localStorage
          const savedOrder = localStorage.getItem('menuCategoryOrder');
          if (savedOrder) {
            try {
              setCategoryOrder(JSON.parse(savedOrder));
            } catch (e) {
              console.error('Error parsing category order:', e);
            }
          }
        }
      } catch (e) {
        console.error('Error loading category order:', e);
        // Fallback to localStorage
        const savedOrder = localStorage.getItem('menuCategoryOrder');
        if (savedOrder) {
          try {
            setCategoryOrder(JSON.parse(savedOrder));
          } catch (e2) {
            console.error('Error parsing category order from localStorage:', e2);
          }
        }
      }
    };
    loadCategoryOrder();
  }, [getCategoryOrder]);

  // Real-time subscription for category order changes
  useEffect(() => {
    const categoryOrderSubscription = supabase
      .channel('customer_menu_category_order_realtime')
      .on('postgres_changes',
        { 
          event: '*',
          schema: 'public', 
          table: 'menu_settings',
          filter: 'key=eq.category_order'
        },
        async (payload) => {
          console.log('📅 CustomerMenu: Real-time category order change:', payload.eventType);
          try {
            if (payload.new && payload.new.value) {
              const order = JSON.parse(payload.new.value);
              setCategoryOrder(order);
              // Also update localStorage as backup
              localStorage.setItem('menuCategoryOrder', JSON.stringify(order));
            } else if (payload.old) {
              // If deleted, fallback to localStorage
              const savedOrder = localStorage.getItem('menuCategoryOrder');
              if (savedOrder) {
                try {
                  setCategoryOrder(JSON.parse(savedOrder));
                } catch (e) {
                  console.error('Error parsing category order from localStorage:', e);
                }
              }
            }
          } catch (error) {
            console.error('Error processing category order update:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 CustomerMenu category order subscription status:', status);
      });

    return () => {
      supabase.removeChannel(categoryOrderSubscription);
    };
  }, []);

  // Real-time subscription for item order changes
  useEffect(() => {
    const itemOrderSubscription = supabase
      .channel('customer_menu_item_order_realtime')
      .on('postgres_changes',
        { 
          event: '*',
          schema: 'public', 
          table: 'menu_settings',
          filter: 'key=like.item_order_%'
        },
        async (payload) => {
          console.log('📅 CustomerMenu: Real-time item order change:', payload.eventType);
          try {
            if (payload.new && payload.new.value && payload.new.key) {
              const category = payload.new.key.replace('item_order_', '');
              const order = JSON.parse(payload.new.value);
              setItemOrders(prev => ({ ...prev, [category]: order }));
              // Also update localStorage as backup
              localStorage.setItem(`menuItemOrder_${category}`, JSON.stringify(order));
            } else if (payload.old && payload.old.key) {
              // If deleted, fallback to localStorage
              const category = payload.old.key.replace('item_order_', '');
              const savedOrder = localStorage.getItem(`menuItemOrder_${category}`);
              if (savedOrder) {
                try {
                  setItemOrders(prev => ({ ...prev, [category]: JSON.parse(savedOrder) }));
                } catch (e) {
                  console.error('Error parsing item order from localStorage:', e);
                }
              }
            }
          } catch (error) {
            console.error('Error processing item order update:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 CustomerMenu item order subscription status:', status);
      });

    return () => {
      supabase.removeChannel(itemOrderSubscription);
    };
  }, []);

  // Real-time subscription for daily_menu_assignments changes
  // Reload daily menu when changes occur (real-time page reload)
  useEffect(() => {
    const reloadDailyMenu = async () => {
      setDailyMenuLoading(true);
      const items = await getDailyMenuItems();
      setDailyMenuItems(items);
      setDailyMenuLoading(false);
    };

    const dailyMenuSubscription = supabase
      .channel('customer_menu_daily_realtime')
      .on('postgres_changes',
        { 
          event: '*',
          schema: 'public', 
          table: 'daily_menu_assignments' 
        },
        (payload) => {
          console.log('📅 CustomerMenu: Real-time daily_menu_assignments change:', payload.eventType);
          reloadDailyMenu();
        }
      )
      .subscribe((status) => {
        console.log('📡 CustomerMenu daily menu subscription status:', status);
      });

    return () => {
      supabase.removeChannel(dailyMenuSubscription);
    };
  }, [getDailyMenuItems]);


  // Use useMemo to ensure session updates when tables change from real-time subscriptions
  // Include realtimeUpdateVersion to force re-render on real-time updates
  const session = useMemo(() => {
    // #region agent log
    const sessionData = getTableSession(tableId);
    fetch('http://127.0.0.1:7245/ingest/d1dcdf1e-0dcf-406d-bcdb-293c197ab831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CustomerMenu.tsx:263',message:'session useMemo recalculated',data:{tableId,realtimeUpdateVersion,hasTables:!!tables,tableKeys:Object.keys(tables||{}),sessionCartCount:sessionData.cart.length,sessionRequestsCount:sessionData.requests.length},timestamp:Date.now(),runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    return sessionData;
  }, [tables, tableId, getTableSession, realtimeUpdateVersion]);

  // Listen for changes in session state from real-time subscriptions
  // Show toast notifications when order status changes
  const prevSessionRef = useRef(session);
  useEffect(() => {
    const prevSession = prevSessionRef.current;
    
    // Check if order was confirmed
    const prevPendingOrders = prevSession.requests.filter(r => r.requestType === 'order' && r.status === 'pending');
    const currentPendingOrders = session.requests.filter(r => r.requestType === 'order' && r.status === 'pending');
    const confirmedOrders = session.requests.filter(r => r.requestType === 'order' && r.status === 'confirmed');
    
    // If order status changed from pending to confirmed
    if (prevPendingOrders.length > 0 && confirmedOrders.length > prevSession.requests.filter(r => r.requestType === 'order' && r.status === 'confirmed').length) {
      toast({
        title: '✅ Поръчката е потвърдена',
        description: 'Вашата поръчка е потвърдена и се приготвя',
        duration: 3000,
      });
    }
    
    // Check if bill was confirmed
    const prevPendingBills = prevSession.requests.filter(r => r.requestType === 'bill' && r.status === 'pending');
    const currentConfirmedBills = session.requests.filter(r => r.requestType === 'bill' && r.status === 'confirmed');
    
    if (prevPendingBills.length > 0 && currentConfirmedBills.length > prevSession.requests.filter(r => r.requestType === 'bill' && r.status === 'confirmed').length) {
      toast({
        title: '✅ Сметката е приета',
        description: 'Вашата заявка за сметка е приета. Сметката ще бъде донесена скоро.',
        duration: 3000,
      });
    }
    
    // Check if table was paid (session unlocked and requests cleared)
    if (prevSession.isLocked && !session.isLocked && prevSession.requests.length > 0 && session.requests.length === 0) {
      toast({
        title: '✅ Сметката е платена',
        description: 'Благодарим ви! Сесията е приключена.',
        duration: 5000,
      });
    }
    
    prevSessionRef.current = session;
  }, [session, toast, realtimeUpdateVersion]); // Include realtimeUpdateVersion to ensure effect runs on updates
  
  // Get animator request status
  // Include realtimeUpdateVersion to force re-render on real-time updates
  const animatorRequest = useMemo(() => {
    return session.requests.find(req => req.requestType === 'animator');
  }, [session.requests, realtimeUpdateVersion]);

  // Calculate timer for animator request
  const childTimer = useMemo(() => {
    if (!animatorRequest || !animatorRequest.timerStartedAt) return null;
    
    let totalSeconds = animatorRequest.totalTimeElapsed || 0;
    
    // If timer is running (not paused), add elapsed time since start
    if (animatorRequest.childLocation === 'kids_zone' && !animatorRequest.timerPausedAt) {
      const elapsedSinceStart = Math.floor((currentTime - animatorRequest.timerStartedAt) / 1000);
      totalSeconds += elapsedSinceStart;
    }
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return {
      hours,
      minutes,
      seconds,
      totalSeconds,
      cost: animatorRequest.hourlyRate ? Math.ceil((totalSeconds / 3600) * animatorRequest.hourlyRate * 100) / 100 : 0
    };
  }, [animatorRequest, currentTime]);
  
  // Calculate total bill from all confirmed orders + pending items + kids zone fee (not cart until order is submitted)
  // Always use latest prices from menuItems for pending items
  const totalBill = useMemo(() => {
    // Calculate pending items total using latest prices from menuItems
    const pendingTotal = pendingItems.reduce((sum, item) => {
      const menuItem = menuItems.find(mi => mi.id === item.id);
      const price = menuItem?.price || item.price; // Use latest price from menuItems
      return sum + (price * item.quantity);
    }, 0);
    
    // Only include confirmed orders, not cart items (cart is only used after order submission)
    const confirmedOrdersTotal = session.requests.reduce((sum, r) => sum + r.total, 0);
    
    // Add kids zone fee if timer is running
    const kidsZoneFee = childTimer?.cost || 0;
    
    return confirmedOrdersTotal + pendingTotal + kidsZoneFee;
  }, [session.requests, pendingItems, menuItems, childTimer, realtimeUpdateVersion]); // Include realtimeUpdateVersion to force re-render
  
  // Calculate pending items total separately for display
  const pendingItemsTotal = useMemo(() => {
    return pendingItems.reduce((sum, item) => {
      const menuItem = menuItems.find(mi => mi.id === item.id);
      const price = menuItem?.price || item.price;
      return sum + (price * item.quantity);
    }, 0);
  }, [pendingItems, menuItems]);

  // Calculate total item count from confirmed orders + pending items (not from cart)
  const totalItemCount = useMemo(() => {
    // Count items from confirmed/pending orders (after order is submitted)
    const orderItemsCount = session.requests
      .filter(r => (r.status === 'confirmed' || r.status === 'pending') && r.requestType === 'order')
      .reduce((count, r) => {
        // Try to extract item count from details (e.g., "2x Пилешко филе, 1x Супа")
        if (r.details) {
          const matches = r.details.match(/(\d+)x/g);
          if (matches) {
            // Sum all quantities (e.g., "2x" + "1x" = 3)
            const total = matches.reduce((sum, match) => {
              const num = parseInt(match.replace('x', ''));
              return sum + (isNaN(num) ? 0 : num);
            }, 0);
            return count + total;
          }
        }
        // If no details or can't parse, count as 1 item per order
        return count + 1;
      }, 0);
    
    // Add pending items count (items selected but not yet submitted)
    const pendingItemsCount = pendingItems.reduce((sum, item) => sum + item.quantity, 0);
    
    return orderItemsCount + pendingItemsCount;
  }, [session.requests, pendingItems]);

  // Combine all ordered items (from confirmed orders + cart)
  // Always use latest prices from menuItems
  // Include realtimeUpdateVersion to force re-render on real-time updates
  const allOrderedItems = useMemo(() => {
    const items: Array<{ id: string; name: string; price: number; quantity: number; fromOrder?: boolean }> = [];
    
    // Add items from confirmed/pending orders
    session.requests
      .filter(r => (r.status === 'confirmed' || r.status === 'pending') && r.requestType === 'order' && r.details)
      .forEach(r => {
        // Parse details like "2x Пилешко филе, 1x Супа"
        const matches = r.details.match(/(\d+)x\s+([^,]+)/g);
        if (matches) {
          // Calculate total quantity and items for price distribution
          let totalQuantity = 0;
          const parsedItems: Array<{ name: string; quantity: number }> = [];
          
          matches.forEach(match => {
            const quantityMatch = match.match(/(\d+)x/);
            const nameMatch = match.match(/\d+x\s+(.+)/);
            if (quantityMatch && nameMatch) {
              const quantity = parseInt(quantityMatch[1]);
              const name = nameMatch[1].trim();
              totalQuantity += quantity;
              parsedItems.push({ name, quantity });
            }
          });
          
          // Calculate price per item from order total
          // If we can't find items by name, distribute total evenly
          const orderTotal = r.total || 0;
          const averagePricePerItem = totalQuantity > 0 ? orderTotal / totalQuantity : 0;
          
          parsedItems.forEach(({ name, quantity }) => {
            // Try to find exact price from menuItems first (case-insensitive, partial match)
            const menuItem = menuItems.find(mi => {
              const miName = mi.name.trim().toLowerCase();
              const searchName = name.trim().toLowerCase();
              // Exact match or contains match
              return miName === searchName || 
                     miName.includes(searchName) || 
                     searchName.includes(miName);
            });
            
            // Use menuItem price if found, otherwise use calculated average
            let itemPrice = menuItem?.price || 0;
            
            // If still 0 and we have order total, use average
            if (itemPrice === 0 && averagePricePerItem > 0) {
              itemPrice = averagePricePerItem;
            }
            
            // Final fallback: if still 0, try to find any menu item with similar name
            if (itemPrice === 0) {
              const similarItem = menuItems.find(mi => 
                mi.name.toLowerCase().includes(name.toLowerCase().substring(0, 5)) ||
                name.toLowerCase().includes(mi.name.toLowerCase().substring(0, 5))
              );
              itemPrice = similarItem?.price || 0;
            }
            
            items.push({
              id: `order_${r.id}_${name.replace(/\s+/g, '_')}`,
              name,
              price: itemPrice, // Use latest price from menuItems or calculated
              quantity,
              fromOrder: true
            });
          });
        }
      });
    
    // Add pending items - use latest prices from menuItems
    // Note: cart items are not included here - items are only added to cart when order is submitted
    pendingItems.forEach(pendingItem => {
      const menuItem = menuItems.find(mi => mi.id === pendingItem.id);
      items.push({
        id: pendingItem.id,
        name: pendingItem.name,
        price: menuItem?.price || pendingItem.price, // Use latest price from menuItems
        quantity: pendingItem.quantity,
        fromOrder: false
      });
    });
    
    return items;
  }, [session.requests, pendingItems, menuItems, realtimeUpdateVersion]); // Include realtimeUpdateVersion to force re-render

  // Load item orders for all categories when dailyMenuItems change
  useEffect(() => {
    const loadItemOrders = async () => {
      const categories = new Set<string>();
      dailyMenuItems.forEach(item => {
        const category = item.cat && item.cat.trim() ? item.cat.trim() : '📦 Други';
        categories.add(category);
      });

      const orders: Record<string, string[]> = {};
      for (const category of categories) {
        try {
          const order = await getItemOrder(category);
          if (order.length > 0) {
            orders[category] = order;
          } else {
            // Fallback to localStorage
            const savedOrder = localStorage.getItem(`menuItemOrder_${category}`);
            if (savedOrder) {
              try {
                orders[category] = JSON.parse(savedOrder);
              } catch (e) {
                // Ignore
              }
            }
          }
        } catch (e) {
          // Fallback to localStorage
          const savedOrder = localStorage.getItem(`menuItemOrder_${category}`);
          if (savedOrder) {
            try {
              orders[category] = JSON.parse(savedOrder);
            } catch (e2) {
              // Ignore
            }
          }
        }
      }
      setItemOrders(orders);
    };
    if (dailyMenuItems.length > 0) {
      loadItemOrders();
    }
  }, [dailyMenuItems, getItemOrder]);

  // Group menu items by category - apply saved order from database
  const groupedItems = useMemo(() => {
    const grouped = dailyMenuItems.reduce((acc, item) => {
      // Handle empty or undefined categories
      const category = item.cat && item.cat.trim() 
        ? item.cat.trim() 
        : '📦 Други';
      
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);

    // Apply saved order for each category
    Object.keys(grouped).forEach(category => {
      const itemIds = itemOrders[category];
      if (itemIds && itemIds.length > 0) {
        try {
          const itemsById = new Map(grouped[category].map(item => [item.id, item]));
          const orderedItems: MenuItem[] = [];
          const unorderedItems: MenuItem[] = [];

          // Add items in saved order
          itemIds.forEach(id => {
            const item = itemsById.get(id);
            if (item) {
              orderedItems.push(item);
              itemsById.delete(id);
            }
          });

          // Add any new items that weren't in the saved order (preserve insertion order)
          itemsById.forEach(item => {
            unorderedItems.push(item);
          });

          grouped[category] = [...orderedItems, ...unorderedItems];
        } catch (e) {
          console.error(`Error applying item order for ${category}:`, e);
        }
      }
    });

    return grouped;
  }, [dailyMenuItems, itemOrders, realtimeUpdateVersion]); // Include itemOrders and realtimeUpdateVersion to force re-render



  // Filter out empty categories and sort them - use same order as MenuEditor
  // Include realtimeUpdateVersion to force re-render on real-time updates
  const sortedCategories = useMemo(() => {
    const categories = Object.keys(groupedItems).filter(cat => groupedItems[cat].length > 0);
    const order = categoryOrder || [];
    
    if (!Array.isArray(order) || order.length === 0) {
      // Default: emoji categories first, then alphabetically
      return categories.sort((a, b) => {
        const aHasEmoji = /^[\p{Emoji}]/u.test(a);
        const bHasEmoji = /^[\p{Emoji}]/u.test(b);
        if (aHasEmoji && !bHasEmoji) return -1;
        if (!aHasEmoji && bHasEmoji) return 1;
        return a.localeCompare(b);
      });
    }
    
    // Sort by saved order, then alphabetically for new categories
    const ordered = order.filter(cat => categories.includes(cat));
    const unordered = categories.filter(cat => !order.includes(cat)).sort((a, b) => {
      const aHasEmoji = /^[\p{Emoji}]/u.test(a);
      const bHasEmoji = /^[\p{Emoji}]/u.test(b);
      if (aHasEmoji && !bHasEmoji) return -1;
      if (!aHasEmoji && bHasEmoji) return 1;
      return a.localeCompare(b);
    });
    return [...ordered, ...unordered];
  }, [groupedItems, categoryOrder, realtimeUpdateVersion]); // Include categoryOrder and realtimeUpdateVersion to force re-render

  // Create a map of item quantities for faster lookup
  // Only use pending items (cart items are only added when order is submitted)
  const itemQuantities = useMemo(() => {
    const quantities: Record<string, number> = {};
    
    // Only add quantities from pending items
    pendingItems.forEach(item => {
      quantities[item.id] = (quantities[item.id] || 0) + item.quantity;
    });
    
    return quantities;
  }, [pendingItems]);

  const getItemQuantity = useCallback((itemId: string) => {
    return itemQuantities[itemId] || 0;
  }, [itemQuantities]);

  // Debounce helper
  const debounce = useCallback(<T extends (...args: unknown[]) => void>(func: T, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }, []);

  const handleAddItem = useCallback((item: MenuItem) => {
    if (session.isLocked) return;
    
    triggerHapticFeedback('light');
    
    // Add to pending items
    setPendingItems(prev => {
      const existing = prev.find(p => p.id === item.id);
      if (existing) {
        return prev.map(p => 
          p.id === item.id ? { ...p, quantity: p.quantity + 1 } : p
        );
      }
      return [
        ...prev,
        { id: item.id, name: item.name, price: item.price, quantity: 1 },
      ];
    });
  }, [session.isLocked]);

  const handleRemoveItem = useCallback((itemId: string) => {
    if (session.isLocked) return;
    
    triggerHapticFeedback('light');
    
    // Remove from pending items
    setPendingItems(prev => {
      const existing = prev.find(p => p.id === itemId);
      if (existing) {
        if (existing.quantity > 1) {
          return prev.map(p => 
            p.id === itemId 
              ? { ...p, quantity: p.quantity - 1 }
              : p
          );
        } else {
          return prev.filter(p => p.id !== itemId);
        }
      }
      return prev;
    });
  }, [session.isLocked]);

  const handleUpdateCartQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (session.isLocked || loadingItems.has(itemId)) return;
    
    triggerHapticFeedback('light');
    setLoadingItems(prev => new Set(prev).add(itemId));
    
    try {
      await updateCartQuantity(tableId, itemId, quantity);
    } catch (error) {
      console.error('Error updating cart quantity:', error);
      triggerHapticFeedback('heavy');
      toast({
        title: 'Грешка',
        description: 'Неуспешно обновяване на количество',
        variant: 'destructive',
      });
    } finally {
      setLoadingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, [session.isLocked, loadingItems, tableId, updateCartQuantity, toast]);

  const handleRemoveFromCart = useCallback(async (itemId: string) => {
    if (session.isLocked || loadingItems.has(itemId)) return;
    
    triggerHapticFeedback('medium');
    setLoadingItems(prev => new Set(prev).add(itemId));
    
    try {
      await removeFromCart(tableId, itemId);
      toast({
        title: '✅ Премахнато',
        description: 'Артикулът е премахнат от кошницата',
        duration: 2000,
      });
    } catch (error) {
      console.error('Error removing from cart:', error);
      triggerHapticFeedback('heavy');
      toast({
        title: 'Грешка',
        description: 'Неуспешно премахване на артикул',
        variant: 'destructive',
      });
    } finally {
      setLoadingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, [session.isLocked, loadingItems, tableId, removeFromCart, toast]);

  const handleClearCart = useCallback(async () => {
    if (session.isLocked || session.cart.length === 0) return;
    
    try {
      await clearCart(tableId);
      toast({
        title: '✅ Кошницата е изчистена',
        description: 'Всички артикули са премахнати',
        duration: 2000,
      });
    } catch (error) {
      console.error('Error clearing cart:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно изчистване на кошницата',
        variant: 'destructive',
      });
    }
  }, [session.isLocked, session.cart.length, tableId, clearCart, toast]);

  const handleSubmitOrder = useCallback(async () => {
    if (session.isLocked || pendingItems.length === 0 || isSubmitting) return;
    
    setIsSubmitting(true);
    
    // INSTANT: Show success toast immediately (0ms) - optimistic feedback
    toast({
      title: '✅ Поръчката е изпратена',
      description: 'Благодарим ви! Ще я приготвим скоро.',
    });
    
    // INSTANT: Clear pending items immediately (0ms) - optimistic update
    const itemsToSubmit = [...pendingItems];
    setPendingItems([]);
    
    try {
      // Background: Add all pending items to cart in parallel (faster than sequential)
      if (itemsToSubmit.length > 0) {
        // Add items in parallel for speed
        await Promise.all(
          itemsToSubmit.flatMap(item =>
            Array(item.quantity).fill(null).map(() =>
              addToCart(tableId, {
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: 1,
              })
            )
          )
        );
      }
      
      // Background: Submit the order (optimistic update already shows it on StaffDashboard)
      // Note: submitOrder() has optimistic updates - UI updates instantly
      await submitOrder(tableId, source);
      
      // Real-time subscription will automatically update all tabs
      // Note: Cart is cleared but order history remains in requests
    } catch (error) {
      console.error('Error submitting order:', error);
      // Restore pending items on error
      setPendingItems(itemsToSubmit);
      toast({
        title: 'Грешка',
        description: 'Неуспешно изпращане на поръчка. Моля опитайте отново.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [session.isLocked, pendingItems, isSubmitting, tableId, source, addToCart, submitOrder, toast]);

  const handleCallWaiter = async () => {
    if (session.isLocked) return;
    
    try {
      // Note: callWaiter() already calls loadTableSessions() internally
      await callWaiter(tableId, source);
      toast({
        title: '🔔 Сервитьорът е повикан',
        description: 'Моля, изчакайте.',
      });
    } catch (error) {
      console.error('Error calling waiter:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно повикване на сервитьор',
        variant: 'destructive',
      });
    }
  };

  const handleCallAnimator = async () => {
    if (session.isLocked) return;
    
    try {
      // Note: callAnimator() already calls loadTableSessions() internally
      await callAnimator(tableId, source);
      toast({
        title: '🎭 Заявка за аниматор',
        description: 'Аниматорът ще дойде скоро',
      });
    } catch (error) {
      console.error('Error calling animator:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешна заявка за аниматор',
        variant: 'destructive',
      });
    }
  };

  const handlePaymentSelect = async (method: 'cash' | 'card') => {
    setPaymentModalOpen(false);
    try {
      // Note: requestBill() already calls loadTableSessions() internally
      await requestBill(tableId, method, source);
      
      // Real-time subscription will automatically update all tabs
      
    toast({
      title: '💳 Заявка за сметка',
      description: `Плащане: ${method === 'cash' ? 'В брой' : 'С карта'}`,
    });
      // Show rating modal after bill request
      setTimeout(() => {
        setRatingModalOpen(true);
      }, 1000);
    } catch (error) {
      console.error('Error requesting bill:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешна заявка за сметка',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Зареждане на менюто...</p>
        </div>
      </div>
    );
  }

  // Show locked message as a banner instead of blocking the entire menu
  // This allows customers to see their orders even when locked

  return (
    <>
      <div className="min-h-screen pb-24 sm:pb-28 md:pb-32" style={{ paddingBottom: 'max(6rem, env(safe-area-inset-bottom))' }}>
        {/* Header - Luxury Design */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/40 shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="max-w-3xl mx-auto px-3 sm:px-5 md:px-6 py-3 sm:py-4 md:py-5">
            {isOffline && (
              <div className="mb-2.5 sm:mb-3 px-3 py-1.5 sm:py-2 bg-yellow-500/15 border border-yellow-500/30 rounded-xl text-[11px] sm:text-xs text-yellow-200/90 animate-fade-in backdrop-blur-sm">
                ⚠️ Няма интернет връзка. Някои функции може да не работят.
              </div>
            )}
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
              <Button
                size="icon"
                variant="ghost"
                  className="h-9 w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 rounded-xl hover:bg-secondary/60 active:scale-95 transition-all touch-manipulation flex-shrink-0 shadow-sm"
                  onClick={() => navigate(-1)}
                  aria-label="Go back"
              >
                  <ArrowLeft className="h-4 w-4 sm:h-4.5 sm:w-4.5 md:h-5 md:w-5" />
              </Button>
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-lg sm:text-xl md:text-2xl font-semibold text-foreground tracking-tight truncate">
                  ATLAS HOUSE
                </h1>
                  <p className="text-[10px] sm:text-xs text-muted-foreground/80 mt-0.5 font-medium tracking-wider uppercase truncate">
                  {tableId.replace('_', ' ')}
                </p>
                </div>
              </div>
              
              {/* Cart Badge - Opens full Cart Drawer */}
              {!session.isLocked && (
                <div>
                <div 
                  className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-2.5 md:p-3 bg-gradient-to-br from-card/80 to-card/60 border border-border/40 rounded-xl transition-all touch-manipulation flex-shrink-0 min-w-[120px] sm:min-w-[140px] md:min-w-[160px] shadow-md cursor-pointer hover:from-card hover:to-primary/5 hover:border-primary/50"
                  onClick={() => setCartDrawerOpen(true)}
                >
                    <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <ShoppingBag className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {totalItemCount > 0 && (
                        <p className="text-[8px] sm:text-[9px] md:text-[10px] text-muted-foreground/80 leading-tight font-medium">
                        {totalItemCount} {totalItemCount === 1 ? 'арт.' : 'арт.'}
                      </p>
                    )}
                      <p className="font-bold text-foreground text-[10px] sm:text-xs md:text-sm truncate">
                      {totalBill.toFixed(2)} EUR
                    </p>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>
      </header>

        {/* Menu - Luxury Design */}
        <main className={cn(
          "max-w-3xl mx-auto px-3 sm:px-5 md:px-6 py-3 sm:py-5 md:py-6 transition-all",
          cartDrawerOpen && "pr-0 sm:pr-[400px] md:pr-[450px]"
        )}>
          {isMenuHidden ? (
            <div className="text-center py-16 sm:py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted/20 mb-4">
                <Lock className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/50" />
              </div>
              <p className="text-lg sm:text-xl font-medium text-foreground mb-2">
                Менюто е недостъпно след 15:00
              </p>
              <p className="text-sm sm:text-base text-muted-foreground">
                Моля, използвайте другите опции
              </p>
            </div>
          ) : dailyMenuLoading ? (
            <div className="text-center py-16 sm:py-20">
              <div className="flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
                <span className="text-sm sm:text-base text-muted-foreground font-medium">Зареждане на меню за деня...</span>
              </div>
            </div>
          ) : dailyMenuItems.length === 0 ? (
            <div className="text-center py-16 sm:py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted/20 mb-4">
                <ShoppingBag className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/50" />
              </div>
              <p className="text-lg sm:text-xl font-medium text-foreground mb-2">
                Няма меню за деня
              </p>
              <p className="text-sm sm:text-base text-muted-foreground">
                Моля, обърнете се към персонала.
              </p>
            </div>
          ) : (
          <div className="space-y-6 sm:space-y-8 md:space-y-10 stagger-children">
            {sortedCategories.map((category) => {
              const items = groupedItems[category] || [];
            // Extract emoji from category name
            const categoryEmoji = category.match(/^[\p{Emoji}]/u)?.[0] || '🍽️';
            const categoryName = category.replace(/^[\p{Emoji}]\s*/, '') || category;
            
            return (
              <section key={category} className="animate-fade-in">
                {/* Luxury Category Header */}
                <div className="mb-3 sm:mb-4 md:mb-5">
                  <div className="flex items-center gap-2.5 sm:gap-3 mb-2.5 sm:mb-3">
                    <span className="text-2xl sm:text-3xl md:text-4xl leading-none">{categoryEmoji}</span>
                    <h2 className="font-display text-lg sm:text-xl md:text-2xl font-semibold text-foreground tracking-tight">
                      {categoryName}
              </h2>
                    <span className="text-xs sm:text-sm text-muted-foreground/70 font-medium px-2 py-0.5 rounded-full bg-muted/30">
                      {items.length}
                    </span>
                  </div>
                  <div className="relative">
                    <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-border/50 to-transparent" />
                    <div className="absolute left-0 top-0 h-[1px] w-16 sm:w-24 bg-gradient-to-r from-primary/80 via-primary/40 to-transparent" />
                  </div>
                </div>
                
                {/* Menu Items - Luxury Style */}
                <div className="space-y-1 sm:space-y-1.5">
                  {items.map((item) => (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      quantity={getItemQuantity(item.id)}
                      onAdd={() => handleAddItem(item)}
                      onRemove={() => handleRemoveItem(item.id)}
                      disabled={false}
                      isLoading={loadingItems.has(item.id)}
                    />
                  ))}
                </div>
            </section>
            );
          })}
        </div>
          )}
      </main>

      {/* Fixed Bottom Actions - Luxury Design */}
      <div 
        className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border/40 p-3 sm:p-4 md:p-5 shadow-2xl"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-3xl mx-auto space-y-2 sm:space-y-2.5">
          {/* Submit Order Button */}
          <Button
            className="w-full btn-gold h-11 sm:h-12 md:h-14 text-xs sm:text-sm font-semibold tracking-wide uppercase shadow-lg hover:shadow-2xl transition-all touch-manipulation rounded-xl"
            onClick={handleSubmitOrder}
            disabled={pendingItems.length === 0 || isSubmitting || isMenuHidden}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2 animate-spin" />
                Изпращане...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
                Изпрати поръчка
              </>
            )}
          </Button>
          
          {/* Secondary Actions - Luxury Design */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-3">
            <Button
              variant="outline"
              className="h-10 sm:h-11 md:h-12 border-border/40 hover:bg-secondary/60 hover:border-primary/40 transition-all text-xs sm:text-sm font-medium touch-manipulation rounded-xl shadow-sm hover:shadow-md active:scale-95"
              onClick={handleCallWaiter}
              disabled={session.isLocked}
            >
              <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
              <span className="hidden xs:inline">Сервитьор</span>
              <span className="xs:hidden">Серв.</span>
            </Button>
            <Button
              variant="outline"
              className="h-10 sm:h-11 md:h-12 border-border/40 hover:bg-secondary/60 hover:border-primary/40 transition-all text-xs sm:text-sm font-medium touch-manipulation rounded-xl shadow-sm hover:shadow-md active:scale-95"
              onClick={handleCallAnimator}
              disabled={session.isLocked}
            >
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
              <span className="hidden xs:inline">Аниматор</span>
              <span className="xs:hidden">Аним.</span>
            </Button>
            <Button
              variant="outline"
              className="h-10 sm:h-11 md:h-12 border-border/40 hover:bg-secondary/60 hover:border-primary/40 transition-all text-xs sm:text-sm font-medium touch-manipulation rounded-xl shadow-sm hover:shadow-md active:scale-95"
              onClick={() => setPaymentModalOpen(true)}
              disabled={session.isLocked}
            >
              <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
              <span className="hidden xs:inline">Сметка</span>
              <span className="xs:hidden">Смет.</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Cart Drawer */}
      {cartDrawerOpen && (
      <CartDrawer
        open={cartDrawerOpen}
        onOpenChange={setCartDrawerOpen}
        cartItems={pendingItems.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        }))}
        orderedItems={allOrderedItems.filter(item => item.fromOrder).map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        }))}
        total={totalBill}
        itemCount={totalItemCount}
        onUpdateQuantity={(itemId, quantity) => {
          setPendingItems(prev => {
            const existing = prev.find(p => p.id === itemId);
            if (existing) {
              if (quantity <= 0) {
                return prev.filter(p => p.id !== itemId);
              }
              return prev.map(p => 
                p.id === itemId ? { ...p, quantity } : p
              );
            }
            return prev;
          });
        }}
        onRemoveItem={(itemId) => {
          setPendingItems(prev => prev.filter(p => p.id !== itemId));
        }}
        onClearCart={() => {
          setPendingItems([]);
        }}
        onReorderItems={(newOrder) => {
          setPendingItems(newOrder);
        }}
        onReorderOrderedItems={(newOrder) => {
          // Note: Ordered items are read-only from confirmed orders
          // This callback is available but ordered items order doesn't affect functionality
        }}
        isLoading={loadingItems.size > 0}
        disabled={session.isLocked}
        kidsZoneFee={childTimer?.cost || 0}
        kidsZoneTime={
          childTimer
            ? `${String(childTimer.hours).padStart(2, '0')}:${String(childTimer.minutes).padStart(2, '0')}:${String(childTimer.seconds).padStart(2, '0')}`
            : undefined
        }
          kidsZoneTimerData={
            animatorRequest
              ? {
                  timerStartedAt: animatorRequest.timerStartedAt,
                  totalTimeElapsed: animatorRequest.totalTimeElapsed,
                  childLocation: animatorRequest.childLocation,
                  timerPausedAt: animatorRequest.timerPausedAt,
                  hourlyRate: animatorRequest.hourlyRate,
                }
              : undefined
          }
      />
      )}

      {/* Payment Modal */}
      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSelectPayment={handlePaymentSelect}
        total={totalBill}
      />

      {/* Rating Modal */}
      <RatingModal
        open={ratingModalOpen}
        onClose={() => setRatingModalOpen(false)}
        tableId={tableId}
        googlePlaceId={import.meta.env.VITE_GOOGLE_PLACE_ID}
      />
    </div>
    </>
  );
};

export default CustomerMenu;
