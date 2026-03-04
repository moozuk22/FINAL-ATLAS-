import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Send, Bell, CreditCard, Lock, Crown, ShoppingBag, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRestaurant, premiumMenuItems } from '@/context/RestaurantContext';
import MenuItemCard from '@/components/MenuItemCard';
import PaymentModal from '@/components/PaymentModal';

const PremiumMenu: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get('table') || 'Table_01';
  const isVip = searchParams.get('vip') === 'true';
  const { toast } = useToast();
  
  const {
    getTableSession,
    addToCart,
    updateCartQuantity,
    submitOrder,
    callWaiter,
    requestBill,
    getCartTotal,
    getCartItemCount,
    loading,
    tables,
  } = useRestaurant();

  const navigate = useNavigate();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  
  // Use useMemo to ensure session updates when tables change from real-time subscriptions
  const session = useMemo(() => getTableSession(tableId, isVip), [tables, tableId, isVip, getTableSession]);
  const cartTotal = getCartTotal(tableId);
  const cartItemCount = getCartItemCount(tableId);

  // Listen for changes in session state from real-time subscriptions
  // Show toast notifications when order status changes
  const prevSessionRef = React.useRef(session);
  useEffect(() => {
    const prevSession = prevSessionRef.current;
    
    // Check if order was confirmed
    const prevPendingOrders = prevSession.requests.filter(r => r.requestType === 'order' && r.status === 'pending');
    const confirmedOrders = session.requests.filter(r => r.requestType === 'order' && r.status === 'confirmed');
    
    if (prevPendingOrders.length > 0 && confirmedOrders.length > prevSession.requests.filter(r => r.requestType === 'order' && r.status === 'confirmed').length) {
      toast({
        title: '✅ Order Confirmed',
        description: 'Your order has been confirmed and is being prepared.',
        duration: 3000,
      });
    }
    
    // Check if bill was confirmed
    const prevPendingBills = prevSession.requests.filter(r => r.requestType === 'bill' && r.status === 'pending');
    const currentConfirmedBills = session.requests.filter(r => r.requestType === 'bill' && r.status === 'confirmed');
    
    if (prevPendingBills.length > 0 && currentConfirmedBills.length > prevSession.requests.filter(r => r.requestType === 'bill' && r.status === 'confirmed').length) {
      toast({
        title: '✅ Bill Accepted',
        description: 'Your bill request has been accepted. The bill will be brought shortly.',
        duration: 3000,
      });
    }
    
    // Check if table was paid
    if (prevSession.isLocked && !session.isLocked && prevSession.requests.length > 0 && session.requests.length === 0) {
      toast({
        title: '✅ Bill Paid',
        description: 'Thank you! Your session has ended.',
        duration: 5000,
      });
    }
    
    prevSessionRef.current = session;
  }, [session, toast]);
  
  const totalBill = useMemo(() => {
    return session.requests.reduce((sum, r) => sum + r.total, 0) + cartTotal;
  }, [session.requests, cartTotal]);

  // Group premium menu items by category
  const groupedItems = useMemo(() => {
    return premiumMenuItems.reduce((acc, item) => {
      if (!acc[item.cat]) {
        acc[item.cat] = [];
      }
      acc[item.cat].push(item);
      return acc;
    }, {} as Record<string, typeof premiumMenuItems>);
  }, []);

  const getItemQuantity = (itemId: string) => {
    const cartItem = session.cart.find(i => i.id === itemId);
    return cartItem?.quantity || 0;
  };

  const handleAddItem = async (item: typeof premiumMenuItems[0]) => {
    if (session.isLocked) return;
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
    try {
      await addToCart(tableId, {
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
    });
    } catch (error) {
      console.error('Error adding item to cart:', error);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (session.isLocked) return;
    try {
    const currentQty = getItemQuantity(itemId);
      await updateCartQuantity(tableId, itemId, currentQty - 1);
    } catch (error) {
      console.error('Error removing item from cart:', error);
    }
  };

  const handleSubmitOrder = async () => {
    if (session.isLocked || cartItemCount === 0) return;
    
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    
    try {
      await submitOrder(tableId);
      
      // Real-time subscription will automatically update all tabs
      
    toast({
      title: '✅ Order Submitted',
      description: 'Your order is being prepared with care.',
    });
    } catch (error) {
      console.error('Error submitting order:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit order',
        variant: 'destructive',
      });
    }
  };

  const handleCallWaiter = async () => {
    if (session.isLocked) return;
    
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    
    try {
      await callWaiter(tableId);
    toast({
      title: '🔔 Staff Notified',
      description: 'Someone will be with you shortly.',
    });
    } catch (error) {
      console.error('Error calling waiter:', error);
      toast({
        title: 'Error',
        description: 'Failed to notify staff',
        variant: 'destructive',
      });
    }
  };

  const handlePaymentSelect = async (method: 'cash' | 'card') => {
    setPaymentModalOpen(false);
    try {
      await requestBill(tableId, method);
      
      // Real-time subscription will automatically update all tabs
      
    toast({
      title: '💳 Bill Requested',
      description: `Payment method: ${method === 'cash' ? 'Cash' : 'Card'}`,
    });
    } catch (error) {
      console.error('Error requesting bill:', error);
      toast({
        title: 'Error',
        description: 'Failed to request bill',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (session.isLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-10 text-center max-w-md animate-fade-in">
          <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
            <Lock className="h-10 w-10 text-primary" />
          </div>
          <h2 className="font-display text-3xl font-bold mb-3">
            Thank You
          </h2>
          <p className="text-muted-foreground text-lg">
            We hope you enjoyed your experience at ATLAS HOUSE
          </p>
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="font-display text-4xl font-bold text-gold mt-1">
              {totalBill.toFixed(2)} EUR
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 scrollbar-hide">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-2xl border-b border-border/50">
        <div className="max-w-lg mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full hover:bg-primary/10"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="font-display text-2xl font-bold text-gold">
                  ATLAS HOUSE
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-muted-foreground">
                    {tableId.replace('_', ' ')}
                  </p>
                  {isVip && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/20 text-primary text-xs font-semibold rounded-full">
                      <Crown className="h-3 w-3" />
                      VIP
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full hover:bg-primary/10"
                onClick={handleCallWaiter}
              >
                <Bell className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full hover:bg-primary/10"
                onClick={() => setPaymentModalOpen(true)}
              >
                <CreditCard className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Menu */}
      <main className="max-w-lg mx-auto px-6 py-8">
        <div className="space-y-10 stagger-children">
          {Object.entries(groupedItems).map(([category, items]) => (
            <section key={category}>
              <h2 className="font-display text-xl font-semibold mb-5 text-foreground tracking-wide">
                {category}
              </h2>
              <div className="space-y-4">
                {items.map(item => (
                  <MenuItemCard
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    price={item.price}
                    description={item.desc}
                    quantity={getItemQuantity(item.id)}
                    onAdd={() => handleAddItem(item)}
                    onRemove={() => handleRemoveItem(item.id)}
                    variant="premium"
                    disabled={session.isLocked}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* Fixed Bottom Checkout Bar */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-2xl border-t border-border/50 p-4 animate-fade-in">
          <div className="max-w-lg mx-auto">
            <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <ShoppingBag className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
                  </p>
                  <p className="font-display text-xl font-bold text-foreground">
                    {cartTotal.toFixed(2)} EUR
                  </p>
                </div>
              </div>
              
              <Button
                className="btn-gold h-12 px-6 text-base font-semibold"
                onClick={handleSubmitOrder}
              >
                <Send className="h-5 w-5 mr-2" />
                Submit Order
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSelectPayment={handlePaymentSelect}
        total={totalBill}
        variant="premium"
      />
    </div>
  );
};

export default PremiumMenu;
