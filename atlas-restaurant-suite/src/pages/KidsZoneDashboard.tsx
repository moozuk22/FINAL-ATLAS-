import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
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
  const { tables, completeAnimatorRequest, loading } = useRestaurant();
  const [completingRequests, setCompletingRequests] = useState<Set<string>>(new Set());
  const [animatorName, setAnimatorName] = useState<string>('');
  const prevPendingAnimatorCountRef = useRef<number>(0);

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

  // Get tables with animator requests (pending or confirmed)
  const getTableAnimatorStatus = useCallback((tableId: string) => {
    const table = tables[tableId];
    if (!table) return null;
    
    const animatorReq = table.requests.find(
      req => req.requestType === 'animator'
    );
    
    if (!animatorReq) return null;
    
    return {
      request: animatorReq,
      status: animatorReq.status,
      assignedTo: animatorReq.assignedTo,
    };
  }, [tables]);

  const handleCompleteAnimatorRequest = useCallback(async (tableId: string, requestId: string) => {
    if (!animatorName.trim()) {
      toast({
        title: 'Грешка',
        description: 'Моля, въведете вашето име',
        variant: 'destructive',
      });
      return;
    }

    const requestKey = `${tableId}_${requestId}`;
    
    if (completingRequests.has(requestKey)) {
      return;
    }
    
    setCompletingRequests(prev => new Set(prev).add(requestKey));
    
    try {
      await completeAnimatorRequest(tableId, requestId, animatorName.trim());
      toast({
        title: '✅ Заявката е приета',
        description: `Детето от ${tableId.replace('_', ' ')} е прието в детския кът`,
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
  }, [animatorName, completeAnimatorRequest, toast, completingRequests]);

  return (
    <div className="min-h-screen pb-20 sm:pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 sm:h-11 sm:w-11 rounded-full hover:bg-secondary touch-manipulation flex-shrink-0"
                onClick={() => navigate('/admin')}
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div className="min-w-0 flex-1 sm:flex-none">
                <h1 className="font-display text-xl sm:text-2xl font-bold text-gold tracking-wide truncate">
                  🎭 Детски Кът
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                  Аниматор Панел
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
              {/* Animator Name Input */}
              <div className="flex items-center gap-2 flex-1 sm:flex-none">
                <input
                  type="text"
                  value={animatorName}
                  onChange={(e) => setAnimatorName(e.target.value)}
                  placeholder="Вашето име"
                  className="px-3 py-2 border border-border rounded-lg bg-background text-sm flex-1 sm:flex-none sm:w-40"
                />
              </div>
              
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
              
              return (
                <div
                  key={tableId}
                  className={cn(
                    'card-premium rounded-xl overflow-hidden transition-all relative',
                    hasPendingRequest && 'border-destructive pulse-alert',
                    hasConfirmedRequest && 'border-yellow-500',
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
                      {hasConfirmedRequest && (
                        <span className="text-xs font-semibold text-yellow-600">
                          ✓ Прието
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-3 sm:p-4">
                    {!animatorStatus ? (
                      <p className="text-center text-muted-foreground text-xs sm:text-sm py-4">
                        Няма заявка
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
                        
                        {hasPendingRequest && (
                          <Button
                            size="sm"
                            className="w-full btn-gold"
                            onClick={() => handleCompleteAnimatorRequest(tableId, animatorStatus.request.id)}
                            disabled={completingRequests.has(`${tableId}_${animatorStatus.request.id}`) || !animatorName.trim()}
                          >
                            {completingRequests.has(`${tableId}_${animatorStatus.request.id}`) ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Приемане...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Приеми детето
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
          </div>
        </div>
      </footer>
    </div>
  );
};

export default KidsZoneDashboard;
