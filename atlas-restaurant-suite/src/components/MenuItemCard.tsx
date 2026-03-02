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
    <div className="group relative py-4 sm:py-5 border-b border-border/50 last:border-0 hover:border-primary/20 transition-colors duration-300 animate-fade-in">
      <div className="flex items-start justify-between gap-3 sm:gap-4 md:gap-6">
        {/* Item Name, Description and Price */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 sm:gap-3 mb-1">
            <h3 className="font-display text-base sm:text-lg font-medium text-foreground tracking-tight flex-1">
              {displayName}
            </h3>
            <div className="flex items-baseline gap-1 sm:gap-1.5 flex-shrink-0 ml-auto">
              <span className="text-base sm:text-lg font-semibold text-foreground">
                {price.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground font-light">EUR</span>
            </div>
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">
              {description}
            </p>
          )}
        </div>
        
        {/* Quantity Controls - Touch Optimized */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 pt-1">
          {quantity > 0 && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-11 w-11 sm:h-12 sm:w-12 rounded-full border border-border/30 hover:bg-secondary hover:border-primary/40 active:scale-95 transition-transform touch-manipulation"
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
              <div className="min-w-[36px] sm:min-w-[40px] text-center">
                <span className="inline-flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-primary/10 text-primary font-medium text-sm sm:text-base">
                {quantity}
              </span>
              </div>
            </>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-11 w-11 sm:h-12 sm:w-12 rounded-full border border-primary/30 hover:bg-primary/10 hover:border-primary/50 active:scale-95 transition-transform touch-manipulation"
            onClick={handleAdd}
            disabled={disabled || isLoading}
            aria-label={`Add ${displayName}`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// OPTIMIZATION: Memoize MenuItemCard to prevent unnecessary re-renders
export default memo(MenuItemCard);
