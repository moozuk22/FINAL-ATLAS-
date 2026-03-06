import React from 'react';
import { CreditCard, Banknote, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSelectPayment: (method: 'cash' | 'card') => void;
  total: number;
  variant?: 'standard' | 'premium';
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  open,
  onClose,
  onSelectPayment,
  total,
  variant = 'standard',
}) => {
  const handlePayment = (method: 'cash' | 'card') => {
    // Haptic feedback if supported
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    onSelectPayment(method);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className={`text-center ${variant === 'premium' ? 'font-display text-2xl' : 'text-xl'}`}>
            {variant === 'premium' ? 'Select Payment' : 'Изберете плащане'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {variant === 'premium' ? 'Choose your payment method' : 'Изберете метод на плащане'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="text-center mb-6">
            <p className="text-muted-foreground text-sm">
              {variant === 'premium' ? 'Total Amount' : 'Обща сума'}
            </p>
            <p className={`font-bold text-primary ${variant === 'premium' ? 'font-display text-4xl' : 'text-3xl'}`}>
              {total.toFixed(2)} EUR
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-24 flex-col gap-2 border-2 hover:border-success hover:bg-success/10 transition-all"
              onClick={() => handlePayment('cash')}
            >
              <Banknote className="h-8 w-8 text-success" />
              <span className="font-medium">
                {variant === 'premium' ? 'Cash' : 'В брой'}
              </span>
            </Button>
            
            <Button
              variant="outline"
              className="h-24 flex-col gap-2 border-2 hover:border-primary hover:bg-primary/10 transition-all"
              onClick={() => handlePayment('card')}
            >
              <CreditCard className="h-8 w-8 text-primary" />
              <span className="font-medium">
                {variant === 'premium' ? 'Card' : 'С карта'}
              </span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
