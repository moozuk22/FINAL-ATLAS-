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
  const { tables, completeRequest, markAsPaid, markBillRequestsAsPaid, resetTable, loading, realtimeUpdateVersion, loadTableSessions } = useRestaurant();
  const prevPendingCountRef = useRef<number>(0);
  const prevTotalRequestsRef = useRef<number>(0);
  const prevRequestIdsRef = useRef<Set<string>>(new Set());
  const [completingRequests, setCompletingRequests] = useState<Set<string>>(new Set());
  const [markingAsPaidTables, setMarkingAsPaidTables] = useState<Set<string>>(new Set());
  const [revenueReportOpen, setRevenueReportOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Register instant (0ms) new order detection callback
  useEffect(() => {
    // Access the callback ref through window (exposed by RestaurantContext)
    const onNewOrderCallbackRef = (window as any).onNewOrderCallbackRef;
    if (onNewOrderCallbackRef) {
      // Register our callback for instant feedback
      const instantFeedbackCallback = (requestType: string, tableId: string) => {
        const callbackStart = performance.now();
        console.log(`⚡ INSTANT (0ms) new order detected! Type: ${requestType}, Table: ${tableId}`);
        
        // Immediately show visual feedback (0ms delay)
        setIsRefreshing(true);
        
        // Immediately play sound (0ms delay)
        try {
          playAlertSound();
          console.log(`🔊 Alert sound played instantly`);
        } catch (error) {
          console.error('Failed to play alert sound:', error);
        }
        
        // Reset visual feedback after 2 seconds
        setTimeout(() => {
          setIsRefreshing(false);
        }, 2000);
        
        const callbackDuration = performance.now() - callbackStart;
        console.log(`✅ Instant feedback completed in ${callbackDuration.toFixed(3)}ms`);
      };
      
      onNewOrderCallbackRef.current = instantFeedbackCallback;
      console.log('✅ Instant (0ms) new order callback registered');
      
      return () => {
        // Cleanup
        if (onNewOrderCallbackRef) {
          onNewOrderCallbackRef.current = null;
        }
      };
    }
  }, []);
  
  // Get all table IDs in order - memoized
  const tableIds = useMemo(() => 
    Array.from({ length: 10 }, (_, i) => 
    `Table_${String(i + 1).padStart(2, '0')}`
    ), []
  );

  // Count total pending requests - memoized
  // Include realtimeUpdateVersion to force re-render on real-time updates
  const totalPending = useMemo(() => {
    return Object.values(tables).reduce((count, table) => {
      return count + table.requests.filter(r => r.status === 'pending').length;
    }, 0);
  }, [tables, realtimeUpdateVersion]);

  // Calculate total revenue - memoized
  // Include realtimeUpdateVersion to force re-render on real-time updates
  const totalRevenue = useMemo(() => {
    return Object.values(tables).reduce((sum, table) => {
      return sum + table.requests.reduce((reqSum, r) => reqSum + r.total, 0);
    }, 0);
  }, [tables, realtimeUpdateVersion]);

  // Get all request IDs for change detection
  const allRequestIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(tables).forEach(table => {
      table.requests.forEach(req => ids.add(req.id));
    });
    return ids;
  }, [tables, realtimeUpdateVersion]);

  // Count total requests (all types) for change detection
  const totalRequests = useMemo(() => {
    return Object.values(tables).reduce((count, table) => {
      return count + table.requests.length;
    }, 0);
  }, [tables, realtimeUpdateVersion]);

  // Track previous realtimeUpdateVersion to detect changes
  const prevRealtimeVersionRef = useRef<number>(0);
  
  // Auto-refresh when new orders arrive (detect by request IDs or count change)
  useEffect(() => {
    const currentRequestIds = allRequestIds;
    const prevRequestIds = prevRequestIdsRef.current;
    
    // Skip initial render (when refs are empty) to avoid false positives
    if (prevRequestIds.size === 0 && currentRequestIds.size > 0) {
      // Initial load - just update refs, don't trigger refresh
      prevRequestIdsRef.current = new Set(currentRequestIds);
      prevPendingCountRef.current = totalPending;
      prevTotalRequestsRef.current = totalRequests;
      prevRealtimeVersionRef.current = realtimeUpdateVersion;
      return;
    }
    
    // Check if new requests arrived (new IDs that weren't there before)
    const hasNewRequests = Array.from(currentRequestIds).some(id => !prevRequestIds.has(id));
    const requestCountChanged = totalRequests !== prevTotalRequestsRef.current;
    const pendingIncreased = totalPending > prevPendingCountRef.current;
    
    if (hasNewRequests || requestCountChanged) {
      // New orders detected - show visual feedback
      // Real-time subscriptions already handle the refresh automatically
      const newRequestIds = Array.from(currentRequestIds).filter(id => !prevRequestIds.has(id));
      console.log(`🔄 New orders detected - showing visual feedback...`, {
        newRequestIds,
        totalPending,
        prevPending: prevPendingCountRef.current,
        pendingIncreased,
      });
      
      // Always show visual feedback for new requests
      setIsRefreshing(true);
      
      // Play sound if pending count increased (new pending requests)
      if (pendingIncreased) {
        console.log('🔊 Playing alert sound - pending requests increased');
        try {
          playAlertSound();
        } catch (error) {
          console.error('Failed to play alert sound:', error);
        }
      }
      
      // Don't call loadTableSessions() here - real-time subscriptions already handle refresh
      // Just show visual feedback
      
      // Reset visual feedback after 2 seconds
      const timeoutId = setTimeout(() => {
        setIsRefreshing(false);
        console.log('✅ Visual feedback reset');
      }, 2000);
      
      // Update refs
      prevRequestIdsRef.current = new Set(currentRequestIds);
      prevPendingCountRef.current = totalPending;
      prevTotalRequestsRef.current = totalRequests;
      
      return () => clearTimeout(timeoutId);
    } else {
      // Just update refs if no new requests
      prevRequestIdsRef.current = new Set(currentRequestIds);
      prevPendingCountRef.current = totalPending;
      prevTotalRequestsRef.current = totalRequests;
    }
  }, [allRequestIds, totalRequests, totalPending, realtimeUpdateVersion]);
  
  // Also refresh when realtimeUpdateVersion changes (indicates data was updated)
  useEffect(() => {
    // Show visual feedback when data updates (but only if version actually changed)
    if (realtimeUpdateVersion > prevRealtimeVersionRef.current && prevRealtimeVersionRef.current > 0) {
      console.log(`🔄 Real-time update detected (version ${prevRealtimeVersionRef.current} → ${realtimeUpdateVersion}) - showing visual feedback`);
      setIsRefreshing(true);
      const timeoutId = setTimeout(() => {
        setIsRefreshing(false);
      }, 1500);
      prevRealtimeVersionRef.current = realtimeUpdateVersion;
      return () => clearTimeout(timeoutId);
    } else if (realtimeUpdateVersion > prevRealtimeVersionRef.current) {
      // First update - just track it
      prevRealtimeVersionRef.current = realtimeUpdateVersion;
    }
  }, [realtimeUpdateVersion]);

  // Real-time subscriptions in RestaurantContext handle all updates automatically
  // They only refresh when database changes occur, ensuring seamless updates

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
        // Real-time subscription will automatically update all tabs
      } else {
        // За поръчки: потвърждаваме поръчката (status: confirmed)
      await completeRequest(tableId, requestId);
      toast({
        title: '✅ Поръчката е потвърдена',
        description: 'Поръчката е потвърдена и се приготвя',
      });
        // Real-time subscription will automatically update all tabs
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
    
    const markStart = performance.now();
    setMarkingAsPaidTables(prev => new Set(prev).add(tableId));
    
    try {
      console.log(`💰 Marking ${tableId} as paid...`);
      await markAsPaid(tableId);
      const markDuration = performance.now() - markStart;
      console.log(`✅ Table ${tableId} marked as paid in ${markDuration.toFixed(2)}ms`);
      
      // Show visual feedback
      setIsRefreshing(true);
      setTimeout(() => setIsRefreshing(false), 1000);
      
      toast({
        title: '✅ Платено',
        description: `${tableName} е маркирана като платена и е отключена`,
        duration: 3000,
      });
      // markAsPaid() already calls loadTableSessions() internally for instant refresh
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
                key={`${tableId}_${realtimeUpdateVersion}`}
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
