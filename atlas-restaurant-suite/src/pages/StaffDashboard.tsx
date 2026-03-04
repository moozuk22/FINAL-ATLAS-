import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Utensils, Loader2, TrendingUp, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRestaurant } from '@/context/RestaurantContext';
import TableCard from '@/components/TableCard';
import { useToast } from '@/hooks/use-toast';
import RevenueReport from '@/components/RevenueReport';

// Audio for alert notification
const playAlertSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.log('Audio not supported');
  }
};

const StaffDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tables, completeRequest, markAsPaid, markBillRequestsAsPaid, resetTable, loading, loadTableSessions } = useRestaurant();
  const prevPendingCountRef = useRef<number>(0);
  const [completingRequests, setCompletingRequests] = useState<Set<string>>(new Set());
  const [markingAsPaidTables, setMarkingAsPaidTables] = useState<Set<string>>(new Set());
  const [revenueReportOpen, setRevenueReportOpen] = useState(false);
  
  // Get all table IDs in order - memoized
  const tableIds = useMemo(() => 
    Array.from({ length: 10 }, (_, i) => 
    `Table_${String(i + 1).padStart(2, '0')}`
    ), []
  );

  // Count total pending requests - memoized
  const totalPending = useMemo(() => {
    return Object.values(tables).reduce((count, table) => {
      return count + table.requests.filter(r => r.status === 'pending').length;
    }, 0);
  }, [tables]);

  // Calculate total revenue - memoized
  const totalRevenue = useMemo(() => {
    return Object.values(tables).reduce((sum, table) => {
      return sum + table.requests.reduce((reqSum, r) => reqSum + r.total, 0);
    }, 0);
  }, [tables]);

  // Play sound when new pending requests appear
  useEffect(() => {
    if (totalPending > prevPendingCountRef.current) {
      playAlertSound();
    }
    prevPendingCountRef.current = totalPending;
  }, [totalPending]);

  // Listen for order/bill submissions - real-time subscription handles updates automatically
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    
    try {
      channel = new BroadcastChannel('restaurant-updates');
      channel.onmessage = (event) => {
        if (event.data.type === 'order-submitted' || event.data.type === 'bill-requested') {
          // Real-time subscription will automatically update the data
          // Just trigger a manual refresh after a short delay to ensure sync
          setTimeout(() => {
            loadTableSessions();
          }, 300);
        }
      };
    } catch (e) {
      console.log('BroadcastChannel not supported');
    }

    return () => {
      if (channel) {
        channel.close();
      }
    };
  }, [loadTableSessions]);

  const handleCompleteRequest = useCallback(async (tableId: string, requestId: string) => {
    const requestKey = `${tableId}_${requestId}`;

    // Prevent double-clicks
    if (completingRequests.has(requestKey)) {
      return;
    }
    
    // Check if this is a bill request
    const session = tables[tableId];
    const request = session?.requests.find(r => r.id === requestId);
    const isBillRequest = request && (request.requestType === 'bill' || request.action.includes('BILL') || request.action.includes('Сметка'));
    
    setCompletingRequests(prev => new Set(prev).add(requestKey));
    
    try {
      if (isBillRequest) {
        // За заявка за сметка: само потвърждаваме, че сметката е приета (status: confirmed)
        await completeRequest(tableId, requestId);
        toast({
          title: '✅ Сметката е приета',
          description: 'Заявката за сметка е приета. Занесете сметката на масата.',
        });
        // Send BroadcastChannel message for other tabs
        try {
          const channel = new BroadcastChannel('restaurant-updates');
          channel.postMessage({ type: 'bill-confirmed', tableId });
          channel.close();
        } catch (e) {
          console.log('BroadcastChannel not supported');
        }
      } else {
        // За поръчки: потвърждаваме поръчката (status: confirmed)
        await completeRequest(tableId, requestId);
        toast({
          title: '✅ Поръчката е потвърдена',
          description: 'Поръчката е потвърдена и се приготвя',
        });
        // Send BroadcastChannel message for other tabs
        try {
          const channel = new BroadcastChannel('restaurant-updates');
          channel.postMessage({ type: 'order-confirmed', tableId });
          channel.close();
        } catch (e) {
          console.log('BroadcastChannel not supported');
        }
      }
    } catch (error) {
      console.error('Error completing request:', error);
      toast({
        title: 'Грешка',
        description: isBillRequest ? 'Неуспешно потвърждаване на заявка за сметка' : 'Неуспешно потвърждаване на поръчка',
        variant: 'destructive',
      });
    } finally {
      setCompletingRequests(prev => {
        const next = new Set(prev);
        next.delete(requestKey);
        return next;
      });
    }
  }, [completeRequest, toast, completingRequests, tables]);

  const handleMarkAsPaid = useCallback(async (tableId: string) => {
    const tableName = tableId.replace('_', ' ');
    
    // Prevent double-clicks
    if (markingAsPaidTables.has(tableId)) {
      return;
    }
    
    if (!confirm(`Маркиране на ${tableName} като платена?\n\nТова ще завърши всички чакащи заявки и ще отключи таблицата.`)) {
      return;
    }
    
    setMarkingAsPaidTables(prev => new Set(prev).add(tableId));
    
    try {
      await markAsPaid(tableId);
      toast({
        title: '✅ Платено',
        description: `${tableName} е маркирана като платена и е отключена`,
        duration: 3000,
      });
      // Send BroadcastChannel message for other tabs
      try {
        const channel = new BroadcastChannel('restaurant-updates');
        channel.postMessage({ type: 'table-paid', tableId });
        channel.close();
      } catch (e) {
        console.log('BroadcastChannel not supported');
      }
      // Real-time subscription will automatically update, but trigger manual refresh to ensure sync
      setTimeout(() => {
        loadTableSessions();
      }, 300);
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно маркиране като платена. Моля опитайте отново.',
        variant: 'destructive',
      });
    } finally {
      setMarkingAsPaidTables(prev => {
        const next = new Set(prev);
        next.delete(tableId);
        return next;
      });
    }
  }, [markAsPaid, toast, markingAsPaidTables]);

  const handleFreeTable = useCallback(async (tableId: string) => {
    const tableName = tableId.replace('_', ' ');
    if (!confirm(`Освобождаване на ${tableName}?\n\nТова ще изчисти всички данни и ще направи таблицата свободна.`)) {
      return;
    }
    
    try {
      await resetTable(tableId);
      toast({
        title: '✅ Таблицата е освободена',
        description: `${tableName} е свободна и готова за нова сесия`,
        duration: 3000,
      });
    } catch (error) {
      console.error('Error freeing table:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно освобождаване на таблица. Моля опитайте отново.',
        variant: 'destructive',
      });
    }
  }, [resetTable, toast]);


  return (
    <div className="min-h-screen pb-20 sm:pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <div className="min-w-0 flex-1 sm:flex-none">
                <h1 className="font-display text-xl sm:text-2xl font-bold text-gold tracking-wide truncate">
                  ATLAS HOUSE
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                  Staff Dashboard
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
              {/* Additional Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/admin/menu')}
                  className="gap-1 text-xs h-8 sm:h-9 touch-manipulation"
                  aria-label="Menu"
                >
                  <Utensils className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Меню</span>
                  <span className="sm:hidden">📋</span>
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRevenueReportOpen(true)}
                  className="gap-1 text-xs h-9 sm:h-10 touch-manipulation"
                  aria-label="Revenue Report"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Оборот</span>
                  <span className="sm:hidden">💰</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/admin/kids-zone')}
                  className="gap-1 text-xs h-9 sm:h-10 touch-manipulation"
                  aria-label="Kids Zone Admin"
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">Kids Zone</span>
                  <span className="sm:hidden">🎭</span>
                </Button>
              </div>
              
              {/* Pending Alerts */}
              <div className="text-center min-w-[60px] sm:min-w-[80px]">
                <p className="text-xs font-semibold text-muted-foreground">
                  Чакащи
                </p>
                <p className={`font-display text-xl sm:text-2xl font-bold ${totalPending > 0 ? 'text-destructive animate-pulse' : 'text-success'}`}>
                  {totalPending}
                </p>
              </div>
              
              {/* Total Revenue */}
              <div className="text-center min-w-[80px] sm:min-w-[100px]">
                <p className="text-xs font-semibold text-muted-foreground">
                  Оборот
                </p>
                <p className="font-display text-xl sm:text-2xl font-bold text-primary truncate">
                  {totalRevenue.toFixed(2)} EUR
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Table Grid */}
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Зареждане на таблици...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6 stagger-children">
          {tableIds.map(tableId => {
            const session = tables[tableId] || {
              tableId,
              isLocked: false,
              cart: [],
              requests: [],
              isVip: false,
            };
            
            return (
              <TableCard
                key={tableId}
                session={session}
                onCompleteRequest={(requestId) => handleCompleteRequest(tableId, requestId)}
                onMarkAsPaid={() => handleMarkAsPaid(tableId)}
                onFreeTable={() => handleFreeTable(tableId)}
                completingRequests={completingRequests}
                markingAsPaidTables={markingAsPaidTables}
              />
            );
          })}
        </div>
        )}
      </main>

      {/* Modals */}
      <RevenueReport open={revenueReportOpen} onClose={() => setRevenueReportOpen(false)} />

      {/* Legend */}
      <footer 
        className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border py-2 sm:py-3"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-center gap-4 sm:gap-6 lg:gap-8 text-xs sm:text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-success flex-shrink-0" />
              <span className="text-muted-foreground whitespace-nowrap">Free</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-primary flex-shrink-0" />
              <span className="text-muted-foreground whitespace-nowrap">Occupied</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-destructive animate-pulse flex-shrink-0" />
              <span className="text-muted-foreground whitespace-nowrap">Pending Action</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default StaffDashboard;
