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
    <div className="group relative bg-gradient-to-br from-card to-card/95 border border-border/40 rounded-xl p-3.5 sm:p-4 shadow-sm hover:shadow-md hover:border-primary/40 hover:bg-gradient-to-br hover:from-card hover:to-primary/5 transition-all duration-300 animate-fade-in backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        {/* Item Name, Description and Price */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 sm:gap-3 mb-0.5">
            <h3 className="font-display text-base sm:text-lg font-semibold text-foreground tracking-tight flex-1 leading-tight">
              {displayName}
            </h3>
            <div className="flex items-baseline gap-0.5 flex-shrink-0 ml-2">
              <span className="text-base sm:text-lg font-bold text-primary">
                {price.toFixed(2)}
              </span>
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wide">EUR</span>
            </div>
          </div>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">
              {description}
            </p>
          )}
        </div>
        
        {/* Quantity Controls - Touch Optimized */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {quantity > 0 && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg border border-border/40 hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive active:scale-95 transition-all touch-manipulation shadow-sm"
                onClick={handleRemove}
                disabled={disabled || isLoading}
                aria-label={`Remove ${displayName}`}
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                )}
              </Button>
              <div className="min-w-[32px] sm:min-w-[36px] text-center">
                <span className="inline-flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-primary/15 text-primary font-bold text-sm sm:text-base shadow-sm border border-primary/20">
                {quantity}
              </span>
              </div>
            </>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg border border-primary/40 bg-primary/5 hover:bg-primary/15 hover:border-primary/60 hover:text-primary active:scale-95 transition-all touch-manipulation shadow-sm"
            onClick={handleAdd}
            disabled={disabled || isLoading}
            aria-label={`Add ${displayName}`}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// OPTIMIZATION: Memoize MenuItemCard to prevent unnecessary re-renders
export default memo(MenuItemCard);
