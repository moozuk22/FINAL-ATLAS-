import React, { memo, useState } from 'react';
import { Check, Clock, Loader2, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableRequest } from '@/context/RestaurantContext';
import { cn } from '@/lib/utils';
import { stripAllergenNumbersFromName } from '@/utils/menu';

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

  // Shorten action text (without emoji, as it's already shown from requestType)
  const getShortAction = (action: string) => {
    if (action.includes('АНИМАТОР') || action.includes('Аниматор')) return 'Аниматор';
    if (action.includes('BILL') || action.includes('Сметка')) return 'Сметка';
    if (action.includes('Сервитьор') || action.includes('WAITER')) return 'Сервитьор';
    if (action.includes('Поръчка') || action.includes('ORDER')) return 'Поръчка';
    if (action.includes('Детски')) return 'Детски';
    return action.length > 20 ? action.substring(0, 20) + '...' : action;
  };

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
            <span className="font-bold text-sm sm:text-base truncate">
              {getShortAction(request.action)}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
              <Clock className="h-3 w-3" />
              {time}
            </span>
          </div>
          
          {/* Details - only if exists and not redundant */}
          {request.details && request.details !== request.action && !request.details.includes('Заявка за') && (
            <div className="text-xs sm:text-sm text-foreground/70 mt-1 line-clamp-2">
              {(() => {
                const cleanedDetails = stripAllergenNumbersFromName(request.details);
                return cleanedDetails.length > 40 
                  ? cleanedDetails.substring(0, 40) + '...' 
                  : cleanedDetails;
              })()}
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
