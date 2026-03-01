import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { Send, Bell, CreditCard, Lock, ArrowLeft, Loader2, Sparkles, Clock, Home, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRestaurant } from '@/context/RestaurantContext';
import MenuItemCard from '@/components/MenuItemCard';
import CartSummary from '@/components/CartSummary';
import CartDrawer from '@/components/CartDrawer';
import PaymentModal from '@/components/PaymentModal';
import RatingModal from '@/components/RatingModal';
import { trackQRScan } from '@/utils/analytics';
import { triggerHapticFeedback, isOnline } from '@/utils/optimization';
import { cn } from '@/lib/utils';

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
    getTableSession,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    submitOrder,
    callWaiter,
    callAnimator,
    returnChildToTable,
    takeChildBackToZone,
    completeChildSession,
    requestBill,
    getCartTotal,
    getCartItemCount,
    loading,
  } = useRestaurant();

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [currentTime, setCurrentTime] = useState(Date.now());
  // Pending items - selected but not yet added to cart
  const [pendingItems, setPendingItems] = useState<Array<{ id: string; name: string; price: number; quantity: number }>>([]);
  
  // Check if menu should be hidden (after 15:00) - DISABLED FOR NOW
  const isMenuHidden = false; // Toggle back: useMemo(() => { const hour = new Date().getHours(); return hour >= 15; }, []);

  // Update current time every second for timer display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const session = getTableSession(tableId);
  const cartTotal = getCartTotal(tableId);
  const cartItemCount = getCartItemCount(tableId);
  
  // Get animator request status
  const animatorRequest = useMemo(() => {
    return session.requests.find(req => req.requestType === 'animator');
  }, [session.requests]);

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
  
  // Calculate total bill from all confirmed orders + cart
  // Always use latest prices from menuItems for cart items
  const totalBill = useMemo(() => {
    // Calculate pending items total using latest prices from menuItems
    const pendingTotal = pendingItems.reduce((sum, item) => {
      const menuItem = menuItems.find(mi => mi.id === item.id);
      const price = menuItem?.price || item.price; // Use latest price from menuItems
      return sum + (price * item.quantity);
    }, 0);
    
    // cartTotal already uses latest prices from menuItems (updated in RestaurantContext)
    return session.requests.reduce((sum, r) => sum + r.total, 0) + cartTotal + pendingTotal;
  }, [session.requests, cartTotal, pendingItems, menuItems]);

  // Calculate total item count from confirmed orders only (not from cart)
  const totalItemCount = useMemo(() => {
    // Count items only from confirmed/pending orders (after order is submitted)
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
    
    // Only count items from submitted orders, not from cart
    return orderItemsCount;
  }, [session.requests]);

  // Combine all ordered items (from confirmed orders + cart)
  // Always use latest prices from menuItems
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
    
    // Add items from cart - use latest prices from menuItems
    session.cart.forEach(cartItem => {
      const menuItem = menuItems.find(mi => mi.id === cartItem.id);
      items.push({
        id: cartItem.id,
        name: cartItem.name,
        price: menuItem?.price || cartItem.price, // Use latest price from menuItems
        quantity: cartItem.quantity,
        fromOrder: false
      });
    });
    
    // Add pending items - use latest prices from menuItems
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
  }, [session.requests, session.cart, pendingItems, menuItems]);

  // Group menu items by category - memoized with proper dependency
  const groupedItems = useMemo(() => {
    return menuItems.reduce((acc, item) => {
      // Handle empty or undefined categories
      const category = item.cat && item.cat.trim() 
        ? item.cat.trim() 
        : '📦 Други';
      
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, typeof menuItems>);
  }, [menuItems]);

  // Filter out empty categories and sort them
  const sortedCategories = useMemo(() => {
    return Object.entries(groupedItems)
      .filter(([_, items]) => items.length > 0)
      .sort(([a], [b]) => {
        // Sort categories: emoji categories first, then alphabetically
        const aHasEmoji = /^[\p{Emoji}]/u.test(a);
        const bHasEmoji = /^[\p{Emoji}]/u.test(b);
        if (aHasEmoji && !bHasEmoji) return -1;
        if (!aHasEmoji && bHasEmoji) return 1;
        return a.localeCompare(b);
      });
  }, [groupedItems]);

  // Create a map of item quantities for faster lookup
  const itemQuantities = useMemo(() => {
    const quantities: Record<string, number> = {};
    
    // First, add quantities from pending items
    pendingItems.forEach(item => {
      quantities[item.id] = (quantities[item.id] || 0) + item.quantity;
    });
    
    // Then, add quantities from cart (overwrites pending if exists)
    session.cart.forEach(item => {
      quantities[item.id] = (quantities[item.id] || 0) + item.quantity;
    });
    
    return quantities;
  }, [pendingItems, session.cart]);

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

  const handleAddItem = useCallback((item: typeof menuItems[0]) => {
    if (session.isLocked) return;
    
    triggerHapticFeedback('light');
    
    // Add to pending items instead of cart
    // Price will be fetched from menuItems when needed
    setPendingItems(prev => {
      const existing = prev.find(p => p.id === item.id);
      if (existing) {
        const updated = prev.map(p => 
          p.id === item.id 
            ? { ...p, quantity: p.quantity + 1 }
            : p
        );
        return updated;
      }
      const newItems = [...prev, {
        id: item.id,
        name: item.name,
        price: item.price, // Store current price, but will be refreshed from menuItems
        quantity: 1
      }];
      return newItems;
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
    if (session.isLocked || (pendingItems.length === 0 && cartItemCount === 0) || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      // First, add all pending items to cart
      if (pendingItems.length > 0) {
        for (const item of pendingItems) {
          // Add each item with its quantity
          for (let i = 0; i < item.quantity; i++) {
            await addToCart(tableId, {
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
    });
          }
        }
        // Clear pending items
        setPendingItems([]);
      }
      
      // Then submit the order
      await submitOrder(tableId, source);
    toast({
      title: '✅ Поръчката е изпратена',
      description: 'Благодарим ви! Ще я приготвим скоро.',
    });
      // Note: Cart is cleared but order history remains in requests
    } catch (error) {
      console.error('Error submitting order:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно изпращане на поръчка. Моля опитайте отново.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [session.isLocked, pendingItems, cartItemCount, isSubmitting, tableId, source, addToCart, submitOrder, toast]);

  const handleCallWaiter = async () => {
    if (session.isLocked) return;
    
    try {
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

  const handleReturnChildToTable = async () => {
    if (!animatorRequest) return;
    
    try {
      await returnChildToTable(tableId, animatorRequest.id);
      toast({
        title: '✅ Детето е върнато на масата',
        description: 'Таймерът е паузиран',
      });
    } catch (error) {
      console.error('Error returning child to table:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно връщане на детето',
        variant: 'destructive',
      });
    }
  };

  const handleTakeChildBackToZone = async () => {
    if (!animatorRequest) return;
    
    try {
      await takeChildBackToZone(tableId, animatorRequest.id);
      toast({
        title: '✅ Детето е взето обратно',
        description: 'Таймерът продължава',
      });
    } catch (error) {
      console.error('Error taking child back to zone:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно вземане на детето',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteChildSession = async () => {
    if (!animatorRequest) return;
    
    try {
      await completeChildSession(tableId, animatorRequest.id);
      toast({
        title: '✅ Сесията е завършена',
        description: `Таксата за детския кът е добавена в сметката`,
      });
    } catch (error) {
      console.error('Error completing child session:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно завършване на сесията',
        variant: 'destructive',
      });
    }
  };

  const handlePaymentSelect = async (method: 'cash' | 'card') => {
    setPaymentModalOpen(false);
    try {
      await requestBill(tableId, method, source);
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

  if (session.isLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card-premium rounded-2xl p-8 text-center max-w-sm animate-fade-in">
          <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">
            Сесията е приключена
          </h2>
          <p className="text-muted-foreground">
            Благодарим ви, че посетихте ATLAS HOUSE!
          </p>
          <p className="text-primary font-semibold mt-4 text-lg">
            Обща сметка: {totalBill.toFixed(2)} EUR
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 sm:pb-28 md:pb-32" style={{ paddingBottom: 'max(6rem, env(safe-area-inset-bottom))' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/98 backdrop-blur-md border-b border-border/50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {isOffline && (
            <div className="mb-3 px-3 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-xs text-yellow-200 animate-fade-in">
              ⚠️ Няма интернет връзка. Някои функции може да не работят.
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 sm:h-11 sm:w-11 rounded-full hover:bg-secondary/50 transition-colors touch-manipulation flex-shrink-0"
                onClick={() => navigate('/')}
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-xl sm:text-2xl font-light text-foreground tracking-wider truncate">
                  ATLAS HOUSE
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1 font-light tracking-wider uppercase truncate">
                  {tableId.replace('_', ' ')}
                </p>
              </div>
            </div>
            
            {/* Bill Summary - Small, top right corner */}
            {!session.isLocked && totalBill > 0 && (
              <div 
                className="flex items-center gap-2 p-2 sm:p-2.5 bg-card/50 border border-border/50 rounded-lg cursor-pointer hover:bg-card/80 transition-all touch-manipulation flex-shrink-0 min-w-[140px] sm:min-w-[160px]"
                onClick={() => setCartDrawerOpen(true)}
              >
                <div className="h-6 w-6 sm:h-7 sm:w-7 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  {totalItemCount > 0 && (
                    <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
                      {totalItemCount} {totalItemCount === 1 ? 'арт.' : 'арт.'}
                    </p>
                  )}
                  <p className="font-bold text-foreground text-xs sm:text-sm truncate">
                    {totalBill.toFixed(2)} EUR
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Menu */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8">
        {isMenuHidden ? (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">
              Менюто е недостъпно след 15:00
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Моля, използвайте другите опции
            </p>
          </div>
        ) : (
          <div className="space-y-8 sm:space-y-12 md:space-y-16 stagger-children">
            {sortedCategories.map(([category, items]) => {
            // Extract emoji from category name
            const categoryEmoji = category.match(/^[\p{Emoji}]/u)?.[0] || '🍽️';
            const categoryName = category.replace(/^[\p{Emoji}]\s*/, '') || category;
            
            return (
              <section key={category} className="animate-fade-in">
                {/* Enhanced Category Header */}
                <div className="mb-4 sm:mb-6 md:mb-8">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl sm:text-3xl">{categoryEmoji}</span>
                    <h2 className="font-display text-xl sm:text-2xl font-light text-foreground tracking-wide">
                      {categoryName}
              </h2>
                    <span className="text-sm text-muted-foreground font-light">
                      ({items.length})
                    </span>
                  </div>
                  <div className="h-px w-12 sm:w-16 bg-gradient-to-r from-primary/60 via-primary/40 to-transparent" />
                </div>
                
                {/* Menu Items - Classic Restaurant Style */}
                <div className="bg-card/30 backdrop-blur-sm rounded-lg border border-border/30 p-4 sm:p-6 space-y-0">
                  {items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    price={item.price}
                      description={item.desc || item.description}
                    quantity={getItemQuantity(item.id)}
                    onAdd={() => handleAddItem(item)}
                    onRemove={() => handleRemoveItem(item.id)}
                    disabled={session.isLocked}
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

      {/* Fixed Bottom Actions */}
      <div 
        className="fixed bottom-0 left-0 right-0 bg-background/98 backdrop-blur-md border-t border-border/50 p-4 sm:p-5 shadow-2xl"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-3xl mx-auto space-y-2 sm:space-y-3">
          {/* Submit Order Button */}
          <Button
            className="w-full btn-gold h-12 sm:h-14 text-sm font-light tracking-wider uppercase shadow-lg hover:shadow-xl transition-all touch-manipulation"
            onClick={handleSubmitOrder}
            disabled={(pendingItems.length === 0 && cartItemCount === 0) || isSubmitting || isMenuHidden}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Изпращане...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Изпрати поръчка
              </>
            )}
          </Button>
          
          {/* Secondary Actions */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Button
              variant="outline"
              className="h-11 sm:h-12 border-border/50 hover:bg-secondary/50 hover:border-primary/30 transition-all text-sm font-light touch-manipulation"
              onClick={handleCallWaiter}
              disabled={session.isLocked}
            >
              <Bell className="h-4 w-4 mr-2" />
              <span className="hidden xs:inline">Сервитьор</span>
              <span className="xs:hidden">Серв.</span>
            </Button>
            <Button
              variant="outline"
              className="h-11 sm:h-12 border-border/50 hover:bg-secondary/50 hover:border-primary/30 transition-all text-sm font-light touch-manipulation"
              onClick={handleCallAnimator}
              disabled={session.isLocked}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              <span className="hidden xs:inline">Аниматор</span>
              <span className="xs:hidden">Аним.</span>
            </Button>
            <Button
              variant="outline"
              className="h-11 sm:h-12 border-border/50 hover:bg-secondary/50 hover:border-primary/30 transition-all text-sm font-light touch-manipulation"
              onClick={() => setPaymentModalOpen(true)}
              disabled={session.isLocked}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Сметка
            </Button>
          </div>
        </div>
      </div>

      {/* Cart Drawer */}
      <CartDrawer
        open={cartDrawerOpen}
        onOpenChange={setCartDrawerOpen}
        cartItems={session.cart}
        orderedItems={allOrderedItems.filter(item => item.fromOrder).map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        }))}
        total={totalBill}
        itemCount={totalItemCount + cartItemCount}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
        isLoading={loadingItems.size > 0}
        disabled={session.isLocked}
      />

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
  );
};

export default CustomerMenu;
