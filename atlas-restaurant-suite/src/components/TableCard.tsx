import React, { useMemo, memo } from 'react';
import { CircleCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableSession } from '@/context/RestaurantContext';
import StatusBadge from './StatusBadge';
import RequestRow from './RequestRow';
import { cn } from '@/lib/utils';

interface TableCardProps {
  session: TableSession;
  onCompleteRequest: (requestId: string) => void;
  onMarkAsPaid: () => void;
  onFreeTable?: () => void;
  completingRequests?: Set<string>;
  markingAsPaidTables?: Set<string>;
}

const TableCard: React.FC<TableCardProps> = ({
  session,
  onCompleteRequest,
  onMarkAsPaid,
  onFreeTable,
  completingRequests = new Set(),
  markingAsPaidTables = new Set(),
}) => {
  // Memoize calculations for performance
  // Include session object to ensure re-calculation when any part of session changes
  const { pendingRequests, completedRequests, hasPending, hasActionablePending, hasActivity, billPaid, totalBill, status, hasBillRequest } = useMemo(() => {
    // Show both pending and confirmed requests in the list
    const pending = session.requests.filter(r => r.status === 'pending' || r.status === 'confirmed');
    const completed = session.requests.filter(r => r.status === 'completed');
    const hasPending = pending.length > 0;
    
    // Only count actual "pending" (not "confirmed") non-animator requests as actionable
    // "confirmed" requests don't need action, they're already accepted
    const actionablePending = session.requests.filter(r => 
      r.status === 'pending' && r.requestType !== 'animator'
    );
    const hasActionablePending = actionablePending.length > 0;
    
  const hasActivity = session.requests.length > 0;
  const billPaid = session.requests.some(
    r => r.action === '💳 BILL REQUEST' && r.status === 'completed'
  );
  // Check if there's a payment/bill request (pending or confirmed)
  const hasBillRequest = session.requests.some(
    r => (r.requestType === 'bill' || r.action.includes('BILL') || r.action.includes('Сметка')) && 
         (r.status === 'pending' || r.status === 'confirmed')
  );
  const totalBill = session.requests.reduce((sum, r) => sum + r.total, 0);

    let status: 'free' | 'occupied' | 'alert';
    // Only show "alert" if there are actual pending requests that need action
    // If everything is confirmed/accepted, show "occupied"
    if (hasActionablePending) status = 'alert';
    else if (hasActivity) status = 'occupied';
    else status = 'free';
    
    return { pendingRequests: pending, completedRequests: completed, hasPending, hasActionablePending, hasActivity, billPaid, totalBill, status, hasBillRequest };
  }, [session]); // Use entire session object to ensure updates when any property changes

  return (
    <div
      className={cn(
        'card-premium rounded-xl overflow-hidden transition-all',
        status === 'alert' && 'border-destructive pulse-alert',
        status === 'occupied' && 'border-primary',
        status === 'free' && 'border-success/30'
      )}
    >
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <h3 className="font-display text-base sm:text-lg font-semibold break-words min-w-0">
            {session.tableId.replace('_', ' ')}
          </h3>
          <StatusBadge status={status} className="flex-shrink-0" />
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Show "Платено" button whenever table has any orders/requests */}
          {hasActivity && (
            <Button
              size="sm"
              className={cn(
                "text-xs h-8 sm:h-9 px-2 sm:px-3 touch-manipulation",
                hasBillRequest ? "btn-gold" : "bg-primary hover:bg-primary/90"
              )}
              onClick={onMarkAsPaid}
              disabled={markingAsPaidTables.has(session.tableId)}
              aria-label={`Mark ${session.tableId} as paid`}
            >
              {markingAsPaidTables.has(session.tableId) ? (
                <>
                  <Loader2 className="h-4 w-4 sm:mr-1 animate-spin" />
                  <span className="hidden sm:inline">Обработка...</span>
                </>
              ) : (
                <>
                  <CircleCheck className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Платено</span>
                  <span className="sm:hidden">✓</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4 max-h-72 sm:max-h-80 overflow-y-auto scrollbar-premium">
        {session.requests.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-4 sm:py-6">
            —
          </p>
        ) : (
          <div className="space-y-2 stagger-children">
            {/* Only show pending requests - completed requests should be deleted from table_requests */}
            {pendingRequests
              .sort((a, b) => b.timestamp - a.timestamp)
              .map(request => {
                return (
                <RequestRow
                  key={request.id}
                  request={request}
                  onComplete={() => onCompleteRequest(request.id)}
                  isCompleting={completingRequests.has(`${session.tableId}_${request.id}`)}
                />
                );
              })}
          </div>
        )}
      </div>

      {/* Footer with total */}
      {hasActivity && (
        <div className="p-3 sm:p-4 border-t border-border bg-secondary/20">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Общо</span>
            <span className="font-display text-lg sm:text-xl font-bold text-primary break-words">
              {totalBill.toFixed(2)} EUR
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// OPTIMIZATION: Memoize TableCard with custom comparison to ensure it updates when orders change
// Compare session.requests array length and IDs to detect changes
export default memo(TableCard, (prevProps, nextProps) => {
  // Re-render if session object reference changed
  if (prevProps.session !== nextProps.session) {
    return false; // false means "not equal" - should re-render
  }
  
  // Re-render if requests array changed (length or content)
  const prevRequestIds = prevProps.session.requests.map(r => r.id).join(',');
  const nextRequestIds = nextProps.session.requests.map(r => r.id).join(',');
  if (prevRequestIds !== nextRequestIds) {
    return false; // Should re-render
  }
  
  // Re-render if request statuses changed
  const prevStatuses = prevProps.session.requests.map(r => `${r.id}:${r.status}`).join(',');
  const nextStatuses = nextProps.session.requests.map(r => `${r.id}:${r.status}`).join(',');
  if (prevStatuses !== nextStatuses) {
    return false; // Should re-render
  }
  
  // Re-render if other session properties changed
  if (
    prevProps.session.isLocked !== nextProps.session.isLocked ||
    prevProps.session.isVip !== nextProps.session.isVip ||
    prevProps.session.cart.length !== nextProps.session.cart.length
  ) {
    return false; // Should re-render
  }
  
  // Re-render if callback functions changed (shouldn't happen, but check anyway)
  if (
    prevProps.onCompleteRequest !== nextProps.onCompleteRequest ||
    prevProps.onMarkAsPaid !== nextProps.onMarkAsPaid ||
    prevProps.onFreeTable !== nextProps.onFreeTable
  ) {
    return false; // Should re-render
  }
  
  // Re-render if completing/marking sets changed
  const prevCompleting = Array.from(prevProps.completingRequests || []).sort().join(',');
  const nextCompleting = Array.from(nextProps.completingRequests || []).sort().join(',');
  const prevMarking = Array.from(prevProps.markingAsPaidTables || []).sort().join(',');
  const nextMarking = Array.from(nextProps.markingAsPaidTables || []).sort().join(',');
  
  if (prevCompleting !== nextCompleting || prevMarking !== nextMarking) {
    return false; // Should re-render
  }
  
  // No changes detected - skip re-render
  return true; // true means "equal" - skip re-render
});
