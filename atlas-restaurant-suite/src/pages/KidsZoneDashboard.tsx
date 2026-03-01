import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Clock, Home, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRestaurant } from '@/context/RestaurantContext';
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
  const { tables, completeAnimatorRequest, returnChildToTable, takeChildBackToZone, completeChildSession, loading } = useRestaurant();
  const [completingRequests, setCompletingRequests] = useState<Set<string>>(new Set());
  const [returningRequests, setReturningRequests] = useState<Set<string>>(new Set());
  const [takingBackRequests, setTakingBackRequests] = useState<Set<string>>(new Set());
  const prevPendingAnimatorCountRef = useRef<number>(0);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Get all table IDs
  const tableIds = useMemo(() => 
    Array.from({ length: 10 }, (_, i) => 
      `Table_${String(i + 1).padStart(2, '0')}`
    ), []
  );

  // Get animator requests (pending only)
  const animatorRequests = useMemo(() => {
    const requests: Array<{ tableId: string; request: any }> = [];
    Object.values(tables).forEach(table => {
      table.requests.forEach(req => {
        if (req.requestType === 'animator' && req.status === 'pending') {
          requests.push({ tableId: table.tableId, request: req });
        }
      });
    });
    return requests;
  }, [tables]);

  // Count pending animator requests
  const pendingAnimatorCount = useMemo(() => animatorRequests.length, [animatorRequests]);

  // Play sound when new animator request appears
  useEffect(() => {
    if (pendingAnimatorCount > prevPendingAnimatorCountRef.current) {
      playAlertSound();
    }
    prevPendingAnimatorCountRef.current = pendingAnimatorCount;
  }, [pendingAnimatorCount]);

  // Update current time every second for timer display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate timer display for a request
  // Timer only counts when child is in kids_zone (not paused, not on table)
  const calculateTimer = useCallback((request: any) => {
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
      toast({
        title: '✅ Заявката е приета',
        description: `Детето от ${tableId.replace('_', ' ')} е прието в детския кът. Таймерът започна.`,
      });
    } catch (error) {
      console.error('Error completing animator request:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно приемане на заявка',
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
              const hasConfirmedRequest = animatorStatus?.status === 'confirmed';
              const isInKidsZone = animatorStatus?.childLocation === 'kids_zone';
              const isReturningToTable = animatorStatus?.childLocation === 'returning_to_table';
              const isOnTable = !animatorStatus?.childLocation || animatorStatus?.childLocation === 'table';
              
              return (
                <div
                  key={tableId}
                  className={cn(
                    'card-premium rounded-xl overflow-hidden transition-all relative',
                    hasPendingRequest && 'border-destructive pulse-alert',
                    isInKidsZone && 'border-yellow-500',
                    isReturningToTable && 'border-blue-500',
                    !animatorStatus && 'border-border'
                  )}
                >
                  {/* Alert Circle for Pending */}
                  {hasPendingRequest && (
                    <div className="absolute top-2 right-2 h-4 w-4 bg-destructive rounded-full animate-ping" />
                  )}
                  
                  {/* Header */}
                  <div className="p-3 sm:p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-base sm:text-lg font-semibold">
                        {tableId.replace('_', ' ')}
                      </h3>
                      {hasPendingRequest && (
                        <span className="text-xs font-semibold text-destructive animate-pulse">
                          ⚠️ НОВА ЗАЯВКА
                        </span>
                      )}
                      {isInKidsZone && (
                        <span className="text-xs font-semibold text-yellow-600 animate-pulse">
                          🎭 В къта • Таймер активен
                        </span>
                      )}
                      {isReturningToTable && (
                        <span className="text-xs font-semibold text-blue-600">
                          🏠 На масата • Таймер паузиран
                        </span>
                      )}
                      {hasConfirmedRequest && isOnTable && (
                        <span className="text-xs font-semibold text-muted-foreground">
                          ✅ Готово
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-3 sm:p-4">
                    {!animatorStatus ? (
                      <p className="text-center text-muted-foreground text-sm py-4">
                        —
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-semibold mb-1">
                            {animatorStatus.request.action}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(animatorStatus.request.timestamp).toLocaleTimeString('bg-BG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          {animatorStatus.assignedTo && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Прието от: {animatorStatus.assignedTo}
                            </p>
                          )}
                        </div>

                        {/* Timer Display - Only shows when child is in kids zone */}
                        {animatorStatus.timer && (
                          <div className={cn(
                            "rounded-lg p-3 border",
                            animatorStatus.timer.isRunning 
                              ? "bg-yellow-500/10 border-yellow-500/30" 
                              : "bg-muted/50 border-border/50"
                          )}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Clock className={cn(
                                  "h-4 w-4",
                                  animatorStatus.timer.isRunning ? "text-yellow-600" : "text-muted-foreground"
                                )} />
                                <span className="text-xs font-semibold text-muted-foreground">
                                  {animatorStatus.timer.isRunning ? 'Активен таймер' : 'Паузиран'}
                                </span>
                              </div>
                              <span className={cn(
                                "font-mono text-xl font-bold",
                                animatorStatus.timer.isRunning ? "text-yellow-600" : "text-muted-foreground"
                              )}>
                                {String(animatorStatus.timer.hours).padStart(2, '0')}:
                                {String(animatorStatus.timer.minutes).padStart(2, '0')}:
                                {String(animatorStatus.timer.seconds).padStart(2, '0')}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-muted-foreground">Текуща такса:</span>
                              <span className={cn(
                                "font-semibold",
                                animatorStatus.timer.isRunning ? "text-yellow-600" : "text-muted-foreground"
                              )}>
                                {animatorStatus.timer.cost.toFixed(2)} EUR
                              </span>
                            </div>
                            {!animatorStatus.timer.isRunning && animatorStatus.timer.totalSeconds > 0 && (
                              <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                                Таймерът е на пауза. Детето е на масата.
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Status Flow Indicator */}
                        {hasConfirmedRequest && (
                          <div className="bg-muted/30 rounded-lg p-3 border border-border/50 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-muted-foreground">Статус:</span>
                              <div className="flex items-center gap-2">
                                {isInKidsZone && (
                                  <span className="text-xs font-semibold text-yellow-600 flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full bg-yellow-600 animate-pulse" />
                                    В детския кът
                                  </span>
                                )}
                                {isReturningToTable && (
                                  <span className="text-xs font-semibold text-blue-600 flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full bg-blue-600" />
                                    На масата
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Action Buttons */}
                        {hasPendingRequest && (
                          <Button
                            size="lg"
                            className="w-full h-12 btn-gold font-bold text-base shadow-lg hover:shadow-xl transition-all"
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
                                <CheckCircle2 className="h-6 w-6 mr-2" />
                                Приеми детето
                              </>
                            )}
                          </Button>
                        )}

                        {isInKidsZone && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-10 border-blue-500 text-blue-600 hover:bg-blue-50 font-semibold"
                            onClick={() => handleReturnChildToTable(tableId, animatorStatus.request.id)}
                            disabled={returningRequests.has(`${tableId}_${animatorStatus.request.id}`)}
                          >
                            {returningRequests.has(`${tableId}_${animatorStatus.request.id}`) ? (
                              <>
                                <Loader2 className="h-5 w-5 mr-1.5 animate-spin" />
                                Връщане...
                              </>
                            ) : (
                              <>
                                <Home className="h-5 w-5 mr-1.5" />
                                Върни на масата
                              </>
                            )}
                          </Button>
                        )}

                        {isReturningToTable && (
                          <Button
                            size="sm"
                            className="w-full h-10 btn-gold font-semibold"
                            onClick={() => handleTakeChildBackToZone(tableId, animatorStatus.request.id)}
                            disabled={takingBackRequests.has(`${tableId}_${animatorStatus.request.id}`)}
                          >
                            {takingBackRequests.has(`${tableId}_${animatorStatus.request.id}`) ? (
                              <>
                                <Loader2 className="h-5 w-5 mr-1.5 animate-spin" />
                                Вземане...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-5 w-5 mr-1.5" />
                                Вземи обратно в къта
                              </>
                            )}
                          </Button>
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
