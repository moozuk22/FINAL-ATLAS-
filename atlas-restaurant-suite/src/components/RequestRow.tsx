import React, { memo, useState } from 'react';
import { Check, Clock, Loader2, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableRequest } from '@/context/RestaurantContext';
import { cn } from '@/lib/utils';

interface RequestRowProps {
  request: TableRequest;
  onComplete: () => void;
  isCompleting?: boolean;
}

const RequestRow: React.FC<RequestRowProps> = ({ request, onComplete, isCompleting = false }) => {
  const isPending = request.status === 'pending';
  const isConfirmed = request.status === 'confirmed';
  const [localConfirmed, setLocalConfirmed] = useState(false);
  const time = new Date(request.timestamp).toLocaleTimeString('bg-BG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleConfirm = () => {
    setLocalConfirmed(true);
    // Call onComplete immediately to update database status
    onComplete();
  };

  return (
    <div
      className={cn(
        'p-2.5 sm:p-3 rounded-lg border transition-all',
        isPending
          ? 'border-destructive/50 bg-destructive/5'
          : 'border-border bg-secondary/30'
      )}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
            <span className="font-semibold text-sm sm:text-base">{request.action}</span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 flex-shrink-0">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {time}
            </span>
              {request.source && (
                <span className="text-xs px-2 py-0.5 bg-secondary rounded flex-shrink-0">
                  {request.source.toUpperCase()}
                </span>
              )}
              {request.requestType && (
                <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded flex-shrink-0">
                  {request.requestType === 'waiter' && '🔔 Сервитьор'}
                  {request.requestType === 'bill' && '💳 Сметка'}
                  {request.requestType === 'animator' && '🎭 Аниматор'}
                  {request.requestType === 'order' && '🍽️ Поръчка'}
                </span>
              )}
            </div>
          </div>
          {/* Order details - fully visible, no truncation, larger text */}
          <div className="text-sm sm:text-base text-foreground/90 mt-2 space-y-1 font-medium">
            {request.details ? (
              request.details.includes(',') ? (
                // If details contain commas, split and show each item on new line
                request.details.split(', ').map((item, index) => (
                  <div key={index} className="leading-relaxed">
                    {item.trim()}
                  </div>
                ))
              ) : (
                // Single line or no commas - show as is
                <div className="leading-relaxed whitespace-normal break-words">
            {request.details}
                </div>
              )
            ) : (
              <div className="text-muted-foreground/60 italic">No details</div>
            )}
          </div>
          {request.total > 0 && (
            <p className="text-base sm:text-lg font-bold text-primary mt-2.5">
              {request.total.toFixed(2)} EUR
            </p>
          )}
        </div>
        
        {(isPending || isConfirmed) ? (
          <Button
            size="sm"
            className={cn(
              "h-9 w-9 sm:h-10 sm:w-auto sm:px-4 text-xs font-semibold touch-manipulation flex-shrink-0 transition-all",
              (isConfirmed || localConfirmed)
                ? "bg-success text-success-foreground hover:bg-success/90" 
                : "btn-gold"
            )}
            onClick={handleConfirm}
            disabled={isCompleting || isConfirmed || localConfirmed}
            aria-label={(isConfirmed || localConfirmed) ? "Order confirmed" : "Confirm order"}
          >
            {isCompleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (isConfirmed || localConfirmed) ? (
              <>
                <ChefHat className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Preparing</span>
                <span className="sm:hidden">✓</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Confirm</span>
                <span className="sm:hidden">✓</span>
              </>
            )}
          </Button>
        ) : (
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
            <Check className="h-4 w-4 text-success" />
          </div>
        )}
      </div>
    </div>
  );
};

// OPTIMIZATION: Memoize RequestRow to prevent unnecessary re-renders
export default memo(RequestRow);
