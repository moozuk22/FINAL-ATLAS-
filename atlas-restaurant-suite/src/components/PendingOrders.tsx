import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useRestaurant } from '@/context/RestaurantContext';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PendingOrdersProps {
  open: boolean;
  onClose: () => void;
}

const PendingOrders: React.FC<PendingOrdersProps> = ({ open, onClose }) => {
  const { getPendingOrders, tables } = useRestaurant();
  // Memoize pending orders to react to real-time table updates
  const pendingOrders = useMemo(() => getPendingOrders(), [getPendingOrders]); // tables is not needed as dependency

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Чакащи поръчки</DialogTitle>
          <DialogDescription>
            Поръчки, които не са потвърдени (не е натиснат ОК)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {pendingOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Няма чакащи поръчки</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="border rounded-lg p-4 bg-destructive/5 border-destructive/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">{order.action}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(order.timestamp).toLocaleTimeString('bg-BG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {order.source && (
                          <span className="text-xs px-2 py-0.5 bg-secondary rounded">
                            {order.source.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-foreground/90 mb-2">
                        {order.details ? (
                          order.details.includes(',') ? (
                            order.details.split(', ').map((item, index) => (
                              <div key={index} className="leading-relaxed">
                                {item.trim()}
                              </div>
                            ))
                          ) : (
                            <div className="leading-relaxed whitespace-normal break-words">
                              {order.details}
                            </div>
                          )
                        ) : (
                          <div className="text-muted-foreground/60 italic">No details</div>
                        )}
                      </div>
                      {order.total > 0 && (
                        <p className="text-base font-bold text-primary">
                          {order.total.toFixed(2)} EUR
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Затвори
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PendingOrders;
