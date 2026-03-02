import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, ShoppingBag, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { CartItem } from '@/context/RestaurantContext';
import { cn } from '@/lib/utils';
import { triggerHapticFeedback } from '@/utils/optimization';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartItems: CartItem[];
  total: number;
  itemCount: number;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  onReorderItems?: (newOrder: CartItem[]) => void; // New prop for reordering cart items
  onReorderOrderedItems?: (newOrder: Array<{ id: string; name: string; price: number; quantity: number }>) => void; // New prop for reordering ordered items
  isLoading?: boolean;
  disabled?: boolean;
  orderedItems?: Array<{ id: string; name: string; price: number; quantity: number }>; // Items from confirmed orders (read-only)
  kidsZoneFee?: number; // Kids Zone fee from animator
}

// Sortable Cart Item Component
const SortableCartItem: React.FC<{
  item: CartItem;
  onIncrement: (itemId: string, currentQty: number) => void;
  onDecrement: (itemId: string, currentQty: number) => void;
  onRemove: (itemId: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
}> = ({ item, onIncrement, onDecrement, onRemove, disabled, isLoading }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-card border border-border rounded-lg p-3 sm:p-4 transition-all',
        'hover:border-primary/30 hover:shadow-md',
        isDragging && 'shadow-lg ring-2 ring-primary/20 z-50'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground pt-1 flex-shrink-0"
        >
          <GripVertical className="h-5 w-5" />
        </div>

        {/* Item Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-base sm:text-lg text-foreground flex-1">
              {item.name}
            </h3>
            <p className="text-sm sm:text-base font-bold text-primary flex-shrink-0">
              {item.price.toFixed(2)} EUR
            </p>
          </div>
        </div>

        {/* Quantity Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border-border hover:border-primary/50 hover:bg-primary/5 touch-manipulation"
            onClick={() => onDecrement(item.id, item.quantity)}
            disabled={disabled || isLoading}
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </Button>

          <div className="min-w-[2.5rem] text-center">
            <span className="text-lg sm:text-xl font-bold text-foreground">
              {item.quantity}
            </span>
          </div>

          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border-border hover:border-primary/50 hover:bg-primary/5 touch-manipulation"
            onClick={() => onIncrement(item.id, item.quantity)}
            disabled={disabled || isLoading}
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 ml-1 touch-manipulation"
            onClick={() => onRemove(item.id)}
            disabled={disabled || isLoading}
            aria-label="Remove item"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Subtotal */}
      <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
        <span className="text-xs sm:text-sm font-semibold text-muted-foreground">
          {item.quantity} x {item.price.toFixed(2)} EUR =
        </span>
        <span className="text-sm sm:text-base font-bold text-primary">
          {(item.price * item.quantity).toFixed(2)} EUR
        </span>
      </div>
    </div>
  );
};

// Sortable Ordered Item Component (read-only, no quantity controls)
const SortableOrderedItem: React.FC<{
  item: { id: string; name: string; price: number; quantity: number };
  onClick?: () => void;
}> = ({ item, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.5 : 0.9,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      {...attributes}
      {...listeners}
      className={cn(
        'w-full text-left bg-card border border-border/50 rounded-lg p-3 sm:p-4 mb-2 transition-all',
        'hover:border-primary/30 hover:shadow-md hover:bg-card/80',
        'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2',
        isDragging && 'shadow-lg ring-2 ring-primary/20 z-50 cursor-grabbing',
        !isDragging && 'cursor-grab active:cursor-grabbing'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-base sm:text-lg text-foreground flex-1">
              {item.name}
            </h3>
            <p className="text-sm sm:text-base font-bold text-primary flex-shrink-0">
              {item.price.toFixed(2)} EUR
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="min-w-[2.5rem] text-center">
            <span className="text-lg sm:text-xl font-bold text-foreground">
              {item.quantity}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
        <span className="text-xs sm:text-sm font-semibold text-muted-foreground">
          Подобщо:
        </span>
        <span className="text-sm sm:text-base font-bold text-primary">
          {(item.price * item.quantity).toFixed(2)} EUR
        </span>
      </div>
    </button>
  );
};

const CartDrawer: React.FC<CartDrawerProps> = ({
  open,
  onOpenChange,
  cartItems,
  total,
  itemCount,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onReorderItems,
  onReorderOrderedItems,
  isLoading = false,
  disabled = false,
  orderedItems = [],
  kidsZoneFee = 0,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'cart' | 'ordered' | null>(null);
  const [items, setItems] = useState<CartItem[]>(cartItems);
  const [ordered, setOrdered] = useState<Array<{ id: string; name: string; price: number; quantity: number }>>(orderedItems);

  // Update local items when props change
  useEffect(() => {
    setItems(cartItems);
  }, [cartItems]);

  useEffect(() => {
    setOrdered(orderedItems);
  }, [orderedItems]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    // Determine if dragging cart item or ordered item
    const isCartItem = items.some(item => item.id === event.active.id);
    const isOrderedItem = ordered.some(item => item.id === event.active.id);
    if (isCartItem) {
      setActiveType('cart');
    } else if (isOrderedItem) {
      setActiveType('ordered');
    }
    triggerHapticFeedback('light');
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);

    if (!over || active.id === over.id) return;

    // Handle cart items reordering
    const cartOldIndex = items.findIndex((item) => item.id === active.id);
    const cartNewIndex = items.findIndex((item) => item.id === over.id);
    
    if (cartOldIndex !== -1 && cartNewIndex !== -1) {
      const newItems = [...items];
      const [movedItem] = newItems.splice(cartOldIndex, 1);
      newItems.splice(cartNewIndex, 0, movedItem);
      setItems(newItems);
      
      if (onReorderItems) {
        onReorderItems(newItems);
      }
      triggerHapticFeedback('medium');
      return;
    }

    // Handle ordered items reordering
    const orderedOldIndex = ordered.findIndex((item) => item.id === active.id);
    const orderedNewIndex = ordered.findIndex((item) => item.id === over.id);
    
    if (orderedOldIndex !== -1 && orderedNewIndex !== -1) {
      const newOrdered = [...ordered];
      const [movedItem] = newOrdered.splice(orderedOldIndex, 1);
      newOrdered.splice(orderedNewIndex, 0, movedItem);
      setOrdered(newOrdered);
      
      if (onReorderOrderedItems) {
        onReorderOrderedItems(newOrdered);
      }
      triggerHapticFeedback('medium');
    }
  };

  // Combine ordered items (read-only) and cart items (editable)
  const allItems = [
    ...ordered.map(item => ({ ...item, isOrdered: true })),
    ...items.map(item => ({ ...item, isOrdered: false }))
  ];

  const activeCartItem = activeId && activeType === 'cart' ? items.find((item) => item.id === activeId) : null;
  const activeOrderedItem = activeId && activeType === 'ordered' ? ordered.find((item) => item.id === activeId) : null;
  const handleIncrement = (itemId: string, currentQty: number) => {
    if (disabled || isLoading) return;
    triggerHapticFeedback('light');
    onUpdateQuantity(itemId, currentQty + 1);
  };

  const handleDecrement = (itemId: string, currentQty: number) => {
    if (disabled || isLoading) return;
    triggerHapticFeedback('light');
    if (currentQty > 1) {
      onUpdateQuantity(itemId, currentQty - 1);
    } else {
      onRemoveItem(itemId);
    }
  };

  const handleRemove = (itemId: string) => {
    if (disabled || isLoading) return;
    triggerHapticFeedback('medium');
    onRemoveItem(itemId);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] sm:h-[80vh] flex flex-col p-0">
        <SheetHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-xl font-display">Кошница</SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  {itemCount} {itemCount === 1 ? 'артикул' : 'артикула'}
                </SheetDescription>
              </div>
            </div>
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearCart}
                disabled={disabled || isLoading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Изчисти</span>
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
          {allItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                <ShoppingBag className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <p className="text-lg font-medium text-muted-foreground mb-2">
                Кошницата е празна
              </p>
              <p className="text-sm text-muted-foreground/70">
                Добавете артикули от менюто
              </p>
            </div>
          ) : (
            <>
              {/* Ordered Items (Read-only with Drag & Drop) */}
              {(ordered.length > 0 || kidsZoneFee > 0) && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Поръчани артикули
                  </h3>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={ordered.map(item => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {ordered.map((item) => (
                          <SortableOrderedItem
                            key={item.id}
                            item={item}
                            onClick={() => {
                              // Handle click on ordered item
                              triggerHapticFeedback('light');
                            }}
                          />
                        ))}
                      </div>
                    </SortableContext>
                    <DragOverlay>
                      {activeOrderedItem ? (
                        <div className="bg-card border border-primary rounded-lg p-3 sm:p-4 shadow-lg opacity-90">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                            <span className="font-semibold">{activeOrderedItem.name}</span>
                          </div>
                        </div>
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                  
                  {/* Kids Zone Fee */}
                  {kidsZoneFee > 0 && (
                    <div className="bg-card border border-border/50 rounded-lg p-3 sm:p-4 mb-2 opacity-90">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="font-semibold text-base sm:text-lg text-foreground flex-1 flex items-center gap-2">
                              <span>🎭</span>
                              <span>Детски кът</span>
                            </h3>
                            <p className="text-sm sm:text-base font-bold text-primary flex-shrink-0">
                              {kidsZoneFee.toFixed(2)} EUR
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-semibold text-muted-foreground">
                          Подобщо:
                        </span>
                        <span className="text-sm sm:text-base font-bold text-primary">
                          {kidsZoneFee.toFixed(2)} EUR
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Cart Items (Editable with Drag & Drop) */}
              {items.length > 0 && (
                <div>
                  {ordered.length > 0 && (
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      В кошницата
                    </h3>
                  )}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={items.map(item => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {items.map((item) => (
                          <SortableCartItem
                            key={item.id}
                            item={item}
                            onIncrement={handleIncrement}
                            onDecrement={handleDecrement}
                            onRemove={handleRemove}
                            disabled={disabled}
                            isLoading={isLoading}
                          />
                        ))}
                      </div>
                    </SortableContext>
                    <DragOverlay>
                      {activeCartItem ? (
                        <div className="bg-card border border-primary rounded-lg p-3 sm:p-4 shadow-lg opacity-90">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                            <span className="font-semibold">{activeCartItem.name}</span>
                          </div>
                        </div>
                      ) : activeOrderedItem ? (
                        <div className="bg-card border border-primary rounded-lg p-3 sm:p-4 shadow-lg opacity-90">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                            <span className="font-semibold">{activeOrderedItem.name}</span>
                          </div>
                        </div>
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with Total */}
        {allItems.length > 0 && (
          <div className="border-t border-border bg-background/95 backdrop-blur-sm px-4 sm:px-6 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-base sm:text-lg font-medium text-foreground">
                Общо:
              </span>
              <span className="font-display text-2xl sm:text-3xl font-bold text-primary">
                {total.toFixed(2)} EUR
              </span>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
