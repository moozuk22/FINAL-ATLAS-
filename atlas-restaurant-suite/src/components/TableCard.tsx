import React, { useMemo, memo } from 'react';
import { CheckCircle2 } from 'lucide-react';
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
}

const TableCard: React.FC<TableCardProps> = ({
  session,
  onCompleteRequest,
  onMarkAsPaid,
  onFreeTable,
  completingRequests = new Set(),
}) => {
  // Memoize calculations for performance
  const { pendingRequests, completedRequests, hasPending, hasActivity, billPaid, totalBill, status } = useMemo(() => {
    const pending = session.requests.filter(r => r.status === 'pending' || r.status === 'confirmed');
    const completed = session.requests.filter(r => r.status === 'completed');
    const hasPending = pending.length > 0;
  const hasActivity = session.requests.length > 0;
  const billPaid = session.requests.some(
    r => r.action === '💳 BILL REQUEST' && r.status === 'completed'
  );
  const totalBill = session.requests.reduce((sum, r) => sum + r.total, 0);

    let status: 'free' | 'occupied' | 'alert';
    if (hasPending) status = 'alert';
    else if (hasActivity) status = 'occupied';
    else status = 'free';
    
    return { pendingRequests: pending, completedRequests: completed, hasPending, hasActivity, billPaid, totalBill, status };
  }, [session.requests]);

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
          <h3 className="font-display text-base sm:text-lg font-semibold truncate">
            {session.tableId.replace('_', ' ')}
          </h3>
          <StatusBadge status={status} className="flex-shrink-0" />
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasPending && !session.isLocked && (
            <Button
              size="sm"
              className="btn-gold text-xs h-8 sm:h-9 px-2 sm:px-3 touch-manipulation"
              onClick={onMarkAsPaid}
              aria-label={`Mark ${session.tableId} as paid`}
            >
              <CheckCircle2 className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Платено</span>
              <span className="sm:hidden">✓</span>
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
              .map(request => (
                <RequestRow
                  key={request.id}
                  request={request}
                  onComplete={() => onCompleteRequest(request.id)}
                  isCompleting={completingRequests.has(`${session.tableId}_${request.id}`)}
                />
              ))}
          </div>
        )}
      </div>

      {/* Footer with total */}
      {hasActivity && (
        <div className="p-3 sm:p-4 border-t border-border bg-secondary/20">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Общо</span>
            <span className="font-display text-lg sm:text-xl font-bold text-primary truncate">
              {totalBill.toFixed(2)} EUR
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// OPTIMIZATION: Memoize TableCard to prevent unnecessary re-renders
export default memo(TableCard);
