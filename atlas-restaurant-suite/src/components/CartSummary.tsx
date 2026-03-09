import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CartSummaryProps {
  itemCount: number;
  total: number;
  variant?: 'standard' | 'premium';
  onClick?: () => void;
}

const CartSummary: React.FC<CartSummaryProps> = ({ 
  itemCount, 
  total, 
  variant = 'standard',
  onClick
}) => {
  if (itemCount === 0) return null;

  if (variant === 'premium') {
    return (
      <div 
        className={cn(
          'glass-card rounded-xl p-4 flex items-center justify-between',
          onClick && 'cursor-pointer hover:bg-primary/5 transition-all active:scale-95'
        )}
        onClick={onClick}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <ShoppingBag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </p>
            <p className="font-display text-lg font-semibold text-foreground">
              {total.toFixed(2)} EUR
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        'bg-card border border-border rounded-lg px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 animate-fade-in',
        'transition-all hover:border-primary/50 hover:shadow-md',
        onClick && 'cursor-pointer active:scale-95 touch-manipulation'
      )}
      onClick={onClick}
    >
      <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
        </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground break-words">
          {itemCount} {itemCount === 1 ? 'артикул' : 'артикула'}
          </p>
        <p className="font-semibold text-foreground text-sm sm:text-base break-words">
            {total.toFixed(2)} EUR
          </p>
        </div>
      {/* Badge indicator */}
      {itemCount > 0 && (
        <div className="ml-auto h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-primary text-white text-[10px] sm:text-xs font-bold flex items-center justify-center flex-shrink-0 animate-pulse-quantity">
          {itemCount > 99 ? '99+' : itemCount}
      </div>
      )}
    </div>
  );
};

export default CartSummary;
