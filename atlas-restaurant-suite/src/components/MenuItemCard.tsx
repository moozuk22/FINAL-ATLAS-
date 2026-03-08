import React, { memo } from 'react';
import { Minus, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { stripAllergenNumbersFromName } from '@/utils/menu';

interface MenuItemCardProps {
  id: string;
  name: string;
  price: number;
  description?: string;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  variant?: 'standard' | 'premium';
  disabled?: boolean;
  isLoading?: boolean;
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({
  name,
  price,
  description,
  quantity,
  onAdd,
  onRemove,
  variant = 'standard',
  disabled = false,
  isLoading = false,
}) => {
  const displayName = stripAllergenNumbersFromName(name);
  // Haptic feedback for mobile
  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  };

  const handleAdd = () => {
    triggerHaptic();
    onAdd();
  };

  const handleRemove = () => {
    triggerHaptic();
    onRemove();
  };

  if (variant === 'premium') {
    return (
      <div className="glass-card rounded-xl p-5 animate-fade-in">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <h3 className="font-display text-lg font-semibold text-foreground">
              {displayName}
            </h3>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
            <p className="text-primary font-semibold mt-2">
              {price.toFixed(2)} EUR
            </p>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {quantity > 0 && (
              <>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-11 w-11 sm:h-12 sm:w-12 rounded-full border-primary/30 hover:bg-primary/10 active:scale-95 transition-transform touch-manipulation"
                  onClick={handleRemove}
                  disabled={disabled || isLoading}
                  aria-label={`Remove ${displayName}`}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Minus className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </Button>
                <span className="w-10 sm:w-12 text-center font-semibold text-foreground text-base sm:text-lg">
                  {quantity}
                </span>
              </>
            )}
            <Button
              size="icon"
              className="h-11 w-11 sm:h-12 sm:w-12 rounded-full btn-gold active:scale-95 transition-transform touch-manipulation"
              onClick={handleAdd}
              disabled={disabled || isLoading}
              aria-label={`Add ${displayName}`}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative bg-gradient-to-br from-card via-card/98 to-card/95 border border-border/30 rounded-2xl p-3.5 sm:p-4 md:p-5 shadow-sm hover:shadow-xl hover:border-primary/50 hover:bg-gradient-to-br hover:from-card hover:via-card/95 hover:to-primary/5 transition-all duration-300 animate-fade-in backdrop-blur-sm overflow-hidden">
      {/* Luxury accent line */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/0 via-primary/40 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="flex items-start justify-between gap-2.5 sm:gap-3 md:gap-4">
        {/* Item Name, Description and Price */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2 sm:gap-3 mb-1">
            <h3 className="font-display text-sm sm:text-base md:text-lg font-semibold text-foreground tracking-tight leading-snug sm:leading-tight break-words hyphens-auto">
              {displayName}
            </h3>
            <div className="flex items-baseline gap-0.5 flex-shrink-0 sm:ml-1.5">
              <span className="text-sm sm:text-base md:text-lg font-bold text-primary whitespace-nowrap">
                {price.toFixed(2)}
              </span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider whitespace-nowrap">EUR</span>
            </div>
          </div>
          {description && (
            <p className="text-[11px] sm:text-xs md:text-sm text-muted-foreground/80 mt-0.5 sm:mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        
        {/* Quantity Controls - Luxury Touch Optimized */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          {quantity > 0 && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-xl border border-border/30 hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive active:scale-90 transition-all touch-manipulation shadow-sm hover:shadow-md"
                onClick={handleRemove}
                disabled={disabled || isLoading}
                aria-label={`Remove ${displayName}`}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />
                ) : (
                  <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                )}
              </Button>
              <div className="min-w-[28px] sm:min-w-[32px] md:min-w-[36px] text-center">
                <span className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold text-xs sm:text-sm md:text-base shadow-md border border-primary/30">
                {quantity}
              </span>
              </div>
            </>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-xl border border-primary/50 bg-gradient-to-br from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 hover:border-primary/70 hover:text-primary active:scale-90 transition-all touch-manipulation shadow-md hover:shadow-lg"
            onClick={handleAdd}
            disabled={disabled || isLoading}
            aria-label={`Add ${displayName}`}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin text-primary" />
            ) : (
              <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-primary" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// OPTIMIZATION: Memoize MenuItemCard to prevent unnecessary re-renders
export default memo(MenuItemCard);
