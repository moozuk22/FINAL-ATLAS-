import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRestaurant, TableRequest } from '@/context/RestaurantContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

const KidsZoneDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tables, completeAnimatorRequest, returnChildToTable, takeChildBackToZone, completeChildSession, clearAnimatorRequestAfterReturn, loading, realtimeUpdateVersion } = useRestaurant();
  const [completingRequests, setCompletingRequests] = useState<Set<string>>(new Set());
  const [returningRequests, setReturningRequests] = useState<Set<string>>(new Set());
  const [takingBackRequests, setTakingBackRequests] = useState<Set<string>>(new Set());
  const [clearingRequests, setClearingRequests] = useState<Set<string>>(new Set());
  const [newCallTableIds, setNewCallTableIds] = useState<Set<string>>(new Set());
  const prevPendingAnimatorCountRef = useRef<number>(0);
  const prevAnimatorRequestIdsRef = useRef<Set<string>>(new Set());
  const hasInitialSyncRef = useRef<boolean>(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Get all table IDs
  const tableIds = useMemo(() => 
    Array.from({ length: 10 }, (_, i) => 
      `Table_${String(i + 1).padStart(2, '0')}`
    ), []
  );

  // Get animator requests (pending only)
  // Include realtimeUpdateVersion to force re-render on real-time updates
  const animatorRequests = useMemo(() => {
    const requests: Array<{ tableId: string; request: TableRequest }> = [];
    Object.values(tables).forEach(table => {
      table.requests.forEach(req => {
        if (req.requestType === 'animator' && req.status === 'pending') {
          requests.push({ tableId: table.tableId, request: req });
        }
      });
    });
    return requests;
  }, [tables]); // realtimeUpdateVersion is not needed as dependency

  // Count pending animator requests
  const pendingAnimatorCount = useMemo(() => animatorRequests.length, [animatorRequests]);

  // Play sound and show toast when new animator request appears (animator is called)
  useEffect(() => {
    const currentIds = new Set(animatorRequests.map(({ tableId, request }) => `${tableId}_${request.id}`));
    const prevIds = prevAnimatorRequestIdsRef.current;

    // First run after mount: sync refs and show on-card notification for any already-pending calls (no sound/toast)
    if (!hasInitialSyncRef.current) {
      hasInitialSyncRef.current = true;
      prevAnimatorRequestIdsRef.current = new Set(currentIds);
      prevPendingAnimatorCountRef.current = pendingAnimatorCount;
      if (animatorRequests.length > 0) {
        setNewCallTableIds(new Set(animatorRequests.map(c => c.tableId)));
      }
      return;
    }

    const newCalls = animatorRequests.filter(({ tableId, request }) => !prevIds.has(`${tableId}_${request.id}`));
    if (newCalls.length > 0) {
      playAlertSound();
      setNewCallTableIds(prev => new Set([...prev, ...newCalls.map(c => c.tableId)]));
      newCalls.forEach(({ tableId }) => {
        const tableLabel = tableId.replace('_', ' ');
        toast({
          title: '🎭 Обаждане за аниматор',
          description: `${tableLabel} ви призовава за детския кът.`,
          duration: 5000,
        });
      });
    }

    prevPendingAnimatorCountRef.current = pendingAnimatorCount;
    prevAnimatorRequestIdsRef.current = currentIds;
  }, [pendingAnimatorCount, animatorRequests, toast]);

  // Clear on-card "new call" state when a table's request is no longer pending (e.g. accepted)
  useEffect(() => {
    setNewCallTableIds(prev => {
      const next = new Set(prev);
      let changed = false;
      next.forEach(tableId => {
        const table = tables[tableId];
        const hasPending = table?.requests.some(
          r => r.requestType === 'animator' && r.status === 'pending'
        );
        if (!hasPending) {
          next.delete(tableId);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [tables]);

  // When kid is in kids zone, customer "call animator" = notification only ("called to table"). Register callback so we get sound + toast.
  useEffect(() => {
    interface WindowWithCallback extends Window {
      onNewOrderCallbackRef?: React.MutableRefObject<((requestType: string, tableId: string) => void) | null>;
    }
    const ref = (window as WindowWithCallback).onNewOrderCallbackRef;
    if (!ref) return;
    const handler = (requestType: string, tableId: string) => {
      if (requestType === 'animator_called_to_table') {
        playAlertSound();
        const tableLabel = tableId.replace('_', ' ');
        toast({
          title: 'Ви повикаха към масата',
          description: `${tableLabel} ви чака — детето е в детския кът.`,
          duration: 5000,
        });
      } else if (requestType === 'animator') {
        playAlertSound();
        const tableLabel = tableId.replace('_', ' ');
        toast({
          title: '🎭 Обаждане за аниматор',
          description: `${tableLabel} ви призовава за детския кът.`,
          duration: 5000,
        });
      }
    };
    ref.current = handler;
    return () => { ref.current = null; };
  }, [toast]);

  // Update current time every second for timer display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Real-time subscriptions in RestaurantContext handle all updates automatically
  // No need for BroadcastChannel or manual refresh

  // Calculate timer display for a request
  // Timer only counts when child is in kids_zone (not paused, not on table)
  const calculateTimer = useCallback((request: TableRequest): { minutes: number; seconds: number; totalSeconds: number } | null => {
    // Timer only exists if child has been in kids zone at least once
    if (!request.timerStartedAt && !request.totalTimeElapsed) return null;
    
    let totalSeconds = request.totalTimeElapsed || 0;
    
    // Only add elapsed time if child is currently in kids_zone and timer is not paused
    if (request.childLocation === 'kids_zone' && !request.timerPausedAt && request.timerStartedAt) {
      const elapsedSinceStart = Math.floor((currentTime - request.timerStartedAt) / 1000);
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
      cost: request.hourlyRate ? Math.ceil((totalSeconds / 3600) * request.hourlyRate * 100) / 100 : 0,
      isRunning: request.childLocation === 'kids_zone' && !request.timerPausedAt
    };
  }, [currentTime]);

  // Get tables with animator requests (pending or confirmed)
  const getTableAnimatorStatus = useCallback((tableId: string) => {
    const table = tables[tableId];
    if (!table) return null;
    
    const animatorReq = table.requests.find(
      req => req.requestType === 'animator'
    );
    
    if (!animatorReq) return null;
    
    const timer = calculateTimer(animatorReq);
    
    return {
      request: animatorReq,
      status: animatorReq.status,
      assignedTo: animatorReq.assignedTo,
      childLocation: animatorReq.childLocation,
      timer,
    };
  }, [tables, calculateTimer]);

  const handleCompleteAnimatorRequest = useCallback(async (tableId: string, requestId: string) => {
    const requestKey = `${tableId}_${requestId}`;
    
    if (completingRequests.has(requestKey)) {
      return;
    }
    
    setCompletingRequests(prev => new Set(prev).add(requestKey));
    
    try {
      await completeAnimatorRequest(tableId, requestId, 'Аниматор');
      
      // Real-time subscription will automatically update all tabs
      
      toast({
        title: '✅ Поръчката е приета',
        description: `Детето от ${tableId.replace('_', ' ')} е прието в детския кът. Таймерът започна.`,
      });
      setNewCallTableIds(prev => {
        const next = new Set(prev);
        next.delete(tableId);
        return next;
      });
    } catch (error) {
      console.error('Error completing animator request:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно приемане на поръчка',
        variant: 'destructive',
      });
    } finally {
      setCompletingRequests(prev => {
        const next = new Set(prev);
        next.delete(requestKey);
        return next;
      });
    }
  }, [completeAnimatorRequest, toast, completingRequests]);

  const handleReturnChildToTable = useCallback(async (tableId: string, requestId: string) => {
    const requestKey = `${tableId}_${requestId}`;
    
    if (returningRequests.has(requestKey)) {
      return;
    }
    
    setReturningRequests(prev => new Set(prev).add(requestKey));
    
    try {
      await returnChildToTable(tableId, requestId);
      // Optimistic update + BroadcastChannel handles instant UI updates
      toast({
        title: '✅ Детето е върнато на масата',
        description: `Таймерът е паузиран за ${tableId.replace('_', ' ')}`,
      });
    } catch (error) {
      console.error('Error returning child to table:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно връщане на детето',
        variant: 'destructive',
      });
    } finally {
      setReturningRequests(prev => {
        const next = new Set(prev);
        next.delete(requestKey);
        return next;
      });
    }
  }, [returnChildToTable, toast, returningRequests]);

  const handleTakeChildBackToZone = useCallback(async (tableId: string, requestId: string) => {
    const requestKey = `${tableId}_${requestId}`;
    
    if (takingBackRequests.has(requestKey)) {
      return;
    }
    
    setTakingBackRequests(prev => new Set(prev).add(requestKey));
    
    try {
      await takeChildBackToZone(tableId, requestId);
      toast({
        title: '✅ Детето е взето обратно',
        description: `Таймерът продължава за ${tableId.replace('_', ' ')}`,
      });
      // Real-time subscription will automatically update all tabs
    } catch (error) {
      console.error('Error taking child back to zone:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно вземане на детето',
        variant: 'destructive',
      });
    } finally {
      setTakingBackRequests(prev => {
        const next = new Set(prev);
        next.delete(requestKey);
        return next;
      });
    }
  }, [takeChildBackToZone, toast, takingBackRequests]);

  const handleClearAnimatorRequestAfterReturn = useCallback(async (tableId: string, requestId: string) => {
    const requestKey = `${tableId}_${requestId}`;
    if (clearingRequests.has(requestKey)) return;
    setClearingRequests(prev => new Set(prev).add(requestKey));
    try {
      await clearAnimatorRequestAfterReturn(tableId, requestId);
      toast({
        title: '✅ Заявката е затворена',
        description: `Детето е на масата. Заявката за ${tableId.replace('_', ' ')} е премахната.`,
      });
    } catch (error) {
      console.error('Error clearing animator request:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно затваряне на заявката',
        variant: 'destructive',
      });
    } finally {
      setClearingRequests(prev => {
        const next = new Set(prev);
        next.delete(requestKey);
        return next;
      });
    }
  }, [clearAnimatorRequestAfterReturn, toast, clearingRequests]);

  return (
    <div className="min-h-screen pb-20 sm:pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <div className="min-w-0 flex-1 sm:flex-none">
                <h1 className="font-display text-xl sm:text-2xl font-bold text-gold tracking-wide truncate">
                  🎭 Аниматор Dashboard
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                  Управление на детския кът
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-end">
              {/* Pending Alerts */}
              <div className="text-center min-w-[60px] sm:min-w-[80px]">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Чакащи
                </p>
                <p className={`font-display text-xl sm:text-2xl font-bold ${
                  pendingAnimatorCount > 0 
                    ? 'text-destructive animate-pulse' 
                    : 'text-success'
                }`}>
                  {pendingAnimatorCount}
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
              <p className="text-muted-foreground">Зареждане...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
            {tableIds.map(tableId => {
              const animatorStatus = getTableAnimatorStatus(tableId);
              const hasPendingRequest = animatorStatus?.status === 'pending';
              const hasNewCallNotification = hasPendingRequest && newCallTableIds.has(tableId);
              const hasConfirmedRequest = animatorStatus?.status === 'confirmed';
              const isInKidsZone = animatorStatus?.childLocation === 'kids_zone';
              const isReturningToTable = animatorStatus?.childLocation === 'returning_to_table';
              const isOnTable = !animatorStatus?.childLocation || animatorStatus?.childLocation === 'table';
              // Only when table requested animator after kid was already in zone (call-to-table)
              const wasCalledToTable = isInKidsZone && animatorStatus?.request?.timerStartedAt != null && (animatorStatus.request.timestamp || 0) > (animatorStatus.request.timerStartedAt || 0);
              // Table called again while kid is "returning to table" (timestamp updated after we accepted)
              const wasCalledAgainWhenReturning = isReturningToTable && (animatorStatus?.request?.timestamp || 0) > (animatorStatus?.request?.timerPausedAt || 0);
              
              return (
                <div
                  key={`${tableId}_${realtimeUpdateVersion}`}
                  className={cn(
                    'card-premium rounded-xl overflow-hidden transition-all relative',
                    hasPendingRequest && 'border-destructive pulse-alert',
                    isInKidsZone && 'border-yellow-500',
                    isReturningToTable && 'border-blue-500',
                    !animatorStatus && 'border-border'
                  )}
                >
                  {/* Alert dot for new request */}
                  {hasPendingRequest && (
                    <div className="absolute top-3 right-3 z-10 h-2.5 w-2.5 bg-destructive rounded-full animate-ping" />
                  )}
                  
                  {/* New call banner — only when pending and new */}
                  {hasNewCallNotification && (
                    <div className="bg-destructive text-destructive-foreground px-4 py-2.5 text-center">
                      <p className="text-xs sm:text-sm font-semibold tracking-wide">
                        Получена поръчка — ви призовават за детския кът
                      </p>
                      <p className="text-xs opacity-90 mt-0.5">Приемете от картата по-долу</p>
                    </div>
                  )}
                  
                  {/* Header: table + single status + call time */}
                  <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-lg sm:text-xl font-semibold text-foreground tracking-tight">
                          {tableId.replace('_', ' ')}
                        </h3>
                        {animatorStatus && (
                          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                            Повикани в {new Date(animatorStatus.request.timestamp).toLocaleTimeString('bg-BG', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                            {animatorStatus.assignedTo && (
                              <span className="text-foreground/70"> · Прието от {animatorStatus.assignedTo}</span>
                            )}
                          </p>
                        )}
                      </div>
                      {hasPendingRequest && (
                        <span className="shrink-0 inline-flex items-center rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive">
                          Нова поръчка
                        </span>
                      )}
                      {isInKidsZone && (
                        <span className="shrink-0 inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          В детския кът
                        </span>
                      )}
                      {isReturningToTable && (
                        <span className="shrink-0 inline-flex items-center rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          На масата
                        </span>
                      )}
                      {hasConfirmedRequest && isOnTable && (
                        <span className="shrink-0 inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          Готово
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 sm:p-5">
                    {!animatorStatus ? (
                      <p className="text-center text-muted-foreground text-sm py-8">
                        Няма активна заявка за тази маса
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {/* Call-to-table: only when table requested animator after kid was already in zone */}
                        {wasCalledToTable && (
                          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                            <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-500 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                              </span>
                              Ви повикаха към масата — ви чакат
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-3 w-full border-amber-600/50 text-amber-800 hover:bg-amber-500/10 font-semibold"
                              onClick={() => handleReturnChildToTable(tableId, animatorStatus.request.id)}
                              disabled={returningRequests.has(`${tableId}_${animatorStatus.request.id}`)}
                            >
                              {returningRequests.has(`${tableId}_${animatorStatus.request.id}`) ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Връщане...
                                </>
                              ) : (
                                'Приеми'
                              )}
                            </Button>
                          </div>
                        )}

                        {/* Table called again while kid is returning to table — show same notification as in-zone (text + Приеми) */}
                        {wasCalledAgainWhenReturning && (
                          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                            <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-500 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                              </span>
                              Ви повикаха към масата — ви чакат
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-3 w-full border-amber-600/50 text-amber-800 hover:bg-amber-500/10 font-semibold"
                              onClick={() => handleReturnChildToTable(tableId, animatorStatus.request.id)}
                              disabled={returningRequests.has(`${tableId}_${animatorStatus.request.id}`)}
                            >
                              {returningRequests.has(`${tableId}_${animatorStatus.request.id}`) ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Връщане...
                                </>
                              ) : (
                                'Приеми'
                              )}
                            </Button>
                          </div>
                        )}

                        {/* Animator has accepted the call — child is being returned to table; table can call again → animator gets notification */}
                        {isReturningToTable && (
                          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3">
                            <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-blue-500" />
                              Прието — върнете детето на масата
                            </p>
                            <p className="text-xs text-blue-700/90 mt-1.5">
                              При ново повикване от масата ще получите известие и звук.
                            </p>
                          </div>
                        )}

                        {/* Timer — compact dashboard style */}
                        {animatorStatus.timer && (
                          <div className={cn(
                            'rounded-xl p-4 border',
                            animatorStatus.timer.isRunning
                              ? 'bg-amber-500/5 border-amber-500/20'
                              : 'bg-muted/30 border-border/50'
                          )}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Clock className={cn(
                                  'h-4 w-4',
                                  animatorStatus.timer.isRunning ? 'text-amber-600' : 'text-muted-foreground'
                                )} />
                                <span className="text-xs font-medium text-muted-foreground">
                                  {animatorStatus.timer.isRunning ? 'Активен таймер' : 'Таймер на пауза'}
                                </span>
                              </div>
                              <span className={cn(
                                'font-mono text-lg font-semibold tabular-nums',
                                animatorStatus.timer.isRunning ? 'text-amber-700' : 'text-muted-foreground'
                              )}>
                                {String(animatorStatus.timer.hours).padStart(2, '0')}:
                                {String(animatorStatus.timer.minutes).padStart(2, '0')}:
                                {String(animatorStatus.timer.seconds).padStart(2, '0')}
                              </span>
                            </div>
                            {!animatorStatus.timer.isRunning && animatorStatus.timer.totalSeconds > 0 && (
                              <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                                Детето е на масата. Натиснете „Вземи обратно в къта“, когато да го върнете.
                              </p>
                            )}
                          </div>
                        )}

                        {/* Accept request — primary CTA when pending */}
                        {hasPendingRequest && (
                          <Button
                            size="lg"
                            className="w-full h-12 btn-gold font-semibold text-base"
                            onClick={() => handleCompleteAnimatorRequest(tableId, animatorStatus.request.id)}
                            disabled={completingRequests.has(`${tableId}_${animatorStatus.request.id}`)}
                          >
                            {completingRequests.has(`${tableId}_${animatorStatus.request.id}`) ? (
                              <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Приемане...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-5 w-5 mr-2" />
                                Приеми поръчката
                              </>
                            )}
                          </Button>
                        )}

                        {/* When child is returned to table: clear request or take back to zone */}
                        {isReturningToTable && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-10 font-semibold border-emerald-600/50 text-emerald-800 hover:bg-emerald-500/10"
                              onClick={() => handleClearAnimatorRequestAfterReturn(tableId, animatorStatus.request.id)}
                              disabled={clearingRequests.has(`${tableId}_${animatorStatus.request.id}`)}
                            >
                              {clearingRequests.has(`${tableId}_${animatorStatus.request.id}`) ? (
                                <>
                                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                  Затваряне...
                                </>
                              ) : (
                                'Затвори заявката'
                              )}
                            </Button>
                            <Button
                              size="sm"
                              className="w-full h-10 btn-gold font-semibold"
                              onClick={() => handleTakeChildBackToZone(tableId, animatorStatus.request.id)}
                              disabled={takingBackRequests.has(`${tableId}_${animatorStatus.request.id}`)}
                            >
                              {takingBackRequests.has(`${tableId}_${animatorStatus.request.id}`) ? (
                                <>
                                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                  Вземане...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-5 w-5 mr-2" />
                                  Вземи обратно в къта
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Legend */}
      <footer 
        className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border py-2 sm:py-3"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-center gap-4 sm:gap-6 lg:gap-8 text-xs sm:text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-border flex-shrink-0" />
              <span className="text-muted-foreground whitespace-nowrap">Няма заявка</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-destructive animate-pulse flex-shrink-0" />
              <span className="text-muted-foreground whitespace-nowrap">Нова заявка</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-yellow-500 flex-shrink-0" />
              <span className="text-muted-foreground whitespace-nowrap">Детето е в къта</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-blue-500 flex-shrink-0" />
              <span className="text-muted-foreground whitespace-nowrap">Детето е на масата</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default KidsZoneDashboard;
