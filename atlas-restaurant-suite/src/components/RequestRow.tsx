import React, { memo, useState } from 'react';
import { Check, Clock, Loader2, ChefHat, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableRequest } from '@/context/RestaurantContext';
import { cn } from '@/lib/utils';
import { stripAllergenNumbersFromName } from '@/utils/menu';

interface RequestRowProps {
  request: TableRequest;
  onComplete: () => void;
  isCompleting?: boolean;
}

const RequestRow: React.FC<RequestRowProps> = ({ 
  request, 
  onComplete, 
  isCompleting = false
}) => {
  const isPending = request.status === 'pending';
  const isConfirmed = request.status === 'confirmed';
  const isBillRequest = request.requestType === 'bill' || request.action.includes('BILL') || request.action.includes('Сметка');
  const [localConfirmed, setLocalConfirmed] = useState(false);
  const time = new Date(request.timestamp).toLocaleTimeString('bg-BG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Action text: show full text (no shortening) so it's visible on all devices
  const displayAction = (() => {
    if (request.action.includes('АНИМАТОР') || request.action.includes('Аниматор')) return 'Аниматор';
    if (request.action.includes('BILL') || request.action.includes('Сметка')) return 'Сметка';
    if (request.action.includes('Сервитьор') || request.action.includes('WAITER')) return 'Сервитьор';
    if (request.action.includes('Поръчка') || request.action.includes('ORDER')) return 'Поръчка';
    if (request.action.includes('Детски')) return 'Детски';
    return request.action;
  })();

  const handleConfirm = () => {
    setLocalConfirmed(true);
    // Call onComplete immediately to update database status
    onComplete();
  };

  return (
    <div
      className={cn(
        'p-2 sm:p-2.5 rounded-lg border transition-all',
        isPending
          ? 'border-destructive/50 bg-destructive/5'
          : 'border-border bg-secondary/30'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Header: Icon + Short Action + Time */}
          <div className="flex items-center gap-2 mb-1.5">
            {request.requestType && (
              <span className="text-base flex-shrink-0">
                {request.requestType === 'waiter' && '🔔'}
                {request.requestType === 'bill' && '💳'}
                {request.requestType === 'animator' && '🎭'}
                {request.requestType === 'order' && '🍽️'}
                {request.requestType === 'kids_zone' && '🎭'}
              </span>
            )}
            <span className="font-bold text-sm sm:text-base break-words min-w-0">
              {displayAction}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
              <Clock className="h-3 w-3" />
              {time}
            </span>
          </div>
          
          {/* Details - only if exists and not redundant */}
          {request.details && request.details !== request.action && !request.details.includes('Заявка за') && (
            <div className="text-xs sm:text-sm text-foreground/70 mt-1 break-words">
              {stripAllergenNumbersFromName(request.details)}
            </div>
          )}
          
          {/* Price */}
          {request.total > 0 && (
            <p className="text-sm sm:text-base font-bold text-primary mt-1.5">
              {request.total.toFixed(2)} EUR
            </p>
          )}
        </div>
        
        {/* Button - Minimalist: Round, icon only */}
        {/* For animator requests, admin can only view (not accept) - they're handled in KidsZoneDashboard */}
        {request.requestType === 'animator' && isPending ? (
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-muted/30 flex items-center justify-center flex-shrink-0">
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        ) : (isPending || isConfirmed) ? (
          <Button
            size="sm"
            className={cn(
              "h-8 w-8 sm:h-9 sm:w-9 rounded-full touch-manipulation flex-shrink-0 transition-all p-0",
              (isConfirmed || localConfirmed)
                ? "bg-success text-success-foreground hover:bg-success/90" 
                : "btn-gold"
            )}
            onClick={handleConfirm}
            disabled={isCompleting || isConfirmed || localConfirmed}
            aria-label={(isConfirmed || localConfirmed) ? "Confirmed" : "Confirm"}
          >
            {isCompleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (isConfirmed || localConfirmed) ? (
              <ChefHat className="h-4 w-4" />
            ) : (
              <span className="text-base font-bold">✓</span>
            )}
          </Button>
        ) : (
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
            <Check className="h-4 w-4 text-success" />
          </div>
        )}
      </div>
    </div>
  );
};

// OPTIMIZATION: Memoize RequestRow to prevent unnecessary re-renders
export default memo(RequestRow);
