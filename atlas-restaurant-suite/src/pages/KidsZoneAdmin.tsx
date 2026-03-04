import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Clock, Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRestaurant } from '@/context/RestaurantContext';
import { cn } from '@/lib/utils';

const KidsZoneAdmin: React.FC = () => {
  const navigate = useNavigate();
  const { tables, loading } = useRestaurant();
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Get all table IDs
  const tableIds = useMemo(() => 
    Array.from({ length: 10 }, (_, i) => 
      `Table_${String(i + 1).padStart(2, '0')}`
    ), []
  );

  // Update current time every second for timer display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Real-time subscriptions in RestaurantContext handle all updates automatically
  // No need for BroadcastChannel or manual refresh

  // Get all animator requests (all statuses for admin view)
  const allAnimatorRequests = useMemo(() => {
    const requests: Array<{ tableId: string; request: any }> = [];
    Object.values(tables).forEach(table => {
      table.requests.forEach(req => {
        if (req.requestType === 'animator' || req.requestType === 'kids_zone') {
          requests.push({ tableId: table.tableId, request: req });
        }
      });
    });
    return requests;
  }, [tables]);

  // Calculate timer display for a request
  // Timer only counts when child is in kids_zone (not paused, not on table)
  const calculateTimer = useCallback((request: any): any => {
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

  // Get animator status for a table
  const getTableAnimatorStatus = useCallback((tableId: string) => {
    const table = tables[tableId];
    if (!table) return null;

    const animatorRequest = table.requests.find(
      req => req.requestType === 'animator' || req.requestType === 'kids_zone'
    );
    
    if (!animatorRequest) return null;
    
    return {
      request: animatorRequest,
      timer: calculateTimer(animatorRequest),
      childLocation: animatorRequest.childLocation,
      status: animatorRequest.status,
      isInKidsZone: animatorRequest.childLocation === 'kids_zone',
      isReturningToTable: animatorRequest.childLocation === 'returning_to_table',
      isOnTable: !animatorRequest.childLocation || animatorRequest.childLocation === 'table',
    };
  }, [tables, calculateTimer]);

  return (
    <div className="min-h-screen pb-20 sm:pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <Button
              variant="ghost"
                size="sm"
                onClick={() => navigate('/admin')}
                className="h-9 w-9 p-0 flex-shrink-0"
                aria-label="Назад"
            >
                <ArrowLeft className="h-5 w-5" />
            </Button>
              <div className="min-w-0 flex-1 sm:flex-none">
                <h1 className="font-display text-xl sm:text-2xl font-bold text-gold tracking-wide truncate">
                  🎭 Kids Zone
              </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                  Admin View
              </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Активни сесии</div>
                <div className="text-2xl font-bold text-foreground">
                  {allAnimatorRequests.filter(r => r.request.status === 'confirmed').length}
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Чакащи заявки</div>
                <div className="text-2xl font-bold text-foreground">
                  {allAnimatorRequests.filter(r => r.request.status === 'pending').length}
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-sm text-sm text-muted-foreground mb-1">Общо заявки</div>
                <div className="text-2xl font-bold text-foreground">
                  {allAnimatorRequests.length}
                </div>
              </div>
            </div>

            {/* Tables Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
              {tableIds.map((tableId) => {
                const animatorStatus = getTableAnimatorStatus(tableId);
                const table = tables[tableId];
                const isInKidsZone = animatorStatus?.isInKidsZone || false;
                const isReturningToTable = animatorStatus?.isReturningToTable || false;
                const isOnTable = animatorStatus?.isOnTable || false;
                const isPending = animatorStatus?.status === 'pending';
                const isConfirmed = animatorStatus?.status === 'confirmed';

                return (
                  <div
                    key={tableId}
                    className={cn(
                      "card-premium rounded-xl overflow-hidden transition-all",
                      isPending && "border-destructive pulse-alert",
                      isInKidsZone && "border-yellow-500",
                      isReturningToTable && "border-blue-500"
                    )}
                  >
                    {/* Table Header */}
                    <div className="p-3 sm:p-4 border-b border-border">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display text-base sm:text-lg font-semibold truncate">
                          {tableId.replace('_', ' ')}
                        </h3>
                      </div>
                    </div>

                    {/* Table Content */}
                    <div className="p-3 sm:p-4 space-y-3">
                      {animatorStatus ? (
                        <>
                          {/* Status */}
                          <div className="text-sm">
                            <div className="font-semibold text-foreground mb-1">
                              {isPending && '⏳ Чака аниматор'}
                              {isConfirmed && isInKidsZone && '🎭 В детския кът • Таймер активен'}
                              {isConfirmed && isReturningToTable && '🏠 На масата • Таймер паузиран'}
                              {isConfirmed && isOnTable && '✅ Готово'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {animatorStatus.request.source && `От: ${animatorStatus.request.source}`}
                            </div>
                          </div>

                          {/* Timer - Only shows when child is in kids zone */}
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
                                    "h-3 w-3",
                                    animatorStatus.timer.isRunning ? "text-yellow-600" : "text-muted-foreground"
                                  )} />
                                  <span className="text-xs text-muted-foreground">
                                    {animatorStatus.timer.isRunning ? 'Активен' : 'Паузиран'}
                    </span>
                  </div>
                                <span className={cn(
                                  "font-mono text-sm font-bold",
                                  animatorStatus.timer.isRunning ? "text-yellow-600" : "text-muted-foreground"
                                )}>
                                  {String(animatorStatus.timer.hours).padStart(2, '0')}:
                                  {String(animatorStatus.timer.minutes).padStart(2, '0')}:
                                  {String(animatorStatus.timer.seconds).padStart(2, '0')}
                    </span>
                  </div>
                </div>
              )}
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground text-center py-2">
                          Няма активна сесия
            </div>
                      )}
                    </div>
            </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default KidsZoneAdmin;
