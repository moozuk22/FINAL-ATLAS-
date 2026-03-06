import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Minus, ShoppingBag, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CartItem } from '@/context/RestaurantContext';
import { cn } from '@/lib/utils';
import { triggerHapticFeedback } from '@/utils/optimization';
import { stripAllergenNumbersFromName } from '@/utils/menu';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
  kidsZoneFee?: number; // Kids Zone fee from animator (used for totals, display may differ)
  kidsZoneTime?: string; // Kids Zone elapsed time display (HH:MM:SS)
  kidsZoneTimerData?: { timerStartedAt?: number; totalTimeElapsed?: number; childLocation?: string; timerPausedAt?: number; hourlyRate?: number }; // Kids Zone timer data for real-time updates
  menuDropRef?: (node: HTMLElement | null) => void; // external drop zone for menu -> drawer
  menuDropIsOver?: boolean;
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
      {...attributes}
      {...listeners}
      className={cn(
        'bg-card border border-border rounded-lg p-3 sm:p-4 transition-all',
        'hover:border-primary/30 hover:shadow-md',
        isDragging && 'shadow-lg ring-2 ring-primary/20 z-50 opacity-90',
        'cursor-grab active:cursor-grabbing min-h-[60px]',
        // Prevent drag when interacting with buttons
        '[&_button]:pointer-events-auto [&_button]:z-20 [&_button]:touch-action-manipulation'
      )}
      style={{
        touchAction: 'none', // Enable drag on touch devices
        WebkitTouchCallout: 'none', // Disable iOS callout
        WebkitUserSelect: 'none', // Disable text selection
        userSelect: 'none',
      }}
      onTouchStart={(e) => {
        // Allow drag on touch devices - buttons will still work due to pointer-events-auto
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input')) {
          // Don't prevent default for buttons and inputs
          return;
        }
        // Enable drag for the element itself
      }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Drag Handle - Hidden on mobile, visible on desktop */}
        <div className="hidden sm:block cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground pt-1 flex-shrink-0 pointer-events-none">
          <GripVertical className="h-5 w-5" />
        </div>

        {/* Item Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-base sm:text-lg text-foreground flex-1">
              {stripAllergenNumbersFromName(item.name)}
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
    touchAction: 'none' as const, // Enable drag on touch devices
    WebkitTouchCallout: 'none' as const, // Disable iOS callout
    WebkitUserSelect: 'none' as const, // Disable text selection
    userSelect: 'none' as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      {...attributes}
      {...listeners}
      className={cn(
        'w-full text-left bg-card border border-border/50 rounded-lg p-3 sm:p-4 mb-2 transition-all',
        'hover:border-primary/30 hover:shadow-md hover:bg-card/80',
        'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2',
        isDragging && 'shadow-lg ring-2 ring-primary/20 z-50 cursor-grabbing opacity-90',
        !isDragging && 'cursor-grab active:cursor-grabbing min-h-[60px]',
        onClick && 'cursor-pointer'
      )}
      onTouchStart={(e) => {
        // Ensure touch events work properly for drag
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input')) {
          return;
        }
        // Enable drag for the element itself
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-base sm:text-lg text-foreground flex-1">
              {stripAllergenNumbersFromName(item.name)}
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
      <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-end">
        <span className="text-sm sm:text-base font-bold text-primary">
          {(item.price * item.quantity).toFixed(2)} EUR
        </span>
      </div>
    </div>
  );
};

const KIDS_ZONE_SORTABLE_ID = 'kids_zone';

const SortableKidsZoneRow: React.FC<{ time?: string }> = ({ time }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: KIDS_ZONE_SORTABLE_ID });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.6 : 0.95,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'bg-card border border-border/50 rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 transition-all',
        'hover:border-primary/30 hover:shadow-sm hover:bg-card/80',
        isDragging && 'shadow-lg ring-2 ring-primary/20 z-50 cursor-grabbing opacity-90',
        !isDragging && 'cursor-grab active:cursor-grabbing min-h-[44px]'
      )}
      style={{
        touchAction: 'none', // Enable drag on touch devices
        WebkitTouchCallout: 'none', // Disable iOS callout
        WebkitUserSelect: 'none', // Disable text selection
        userSelect: 'none',
      }}
      onTouchStart={(e) => {
        // Ensure touch events work properly for drag
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input')) {
          return;
        }
        // Enable drag for the element itself
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🎭</span>
          <span className="font-semibold text-sm sm:text-base text-foreground truncate">
            Детски кът
          </span>
        </div>
        {time && (
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-muted-foreground">Време:</span>
              <span className="font-mono text-xs sm:text-sm font-semibold text-primary">
            {time}
          </span>
            </div>
          )}
        </div>
      </div>
    </div>
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
  kidsZoneTime,
  kidsZoneTimerData,
  menuDropRef,
  menuDropIsOver = false,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'cart' | 'ordered' | null>(null);
  const [items, setItems] = useState<CartItem[]>(cartItems);
  const [ordered, setOrdered] = useState<Array<{ id: string; name: string; price: number; quantity: number }>>(orderedItems);
  const [orderedDisplayIds, setOrderedDisplayIds] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every second for real-time timer display
  useEffect(() => {
    if (!kidsZoneTimerData) return;
    
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [kidsZoneTimerData]);

  // Calculate real-time timer display if timer data is provided
  const realTimeKidsZoneTime = useMemo(() => {
    if (!kidsZoneTimerData || !kidsZoneTimerData.timerStartedAt) {
      return kidsZoneTime; // Fallback to provided time string
    }
    
    let totalSeconds = kidsZoneTimerData.totalTimeElapsed || 0;
    
    // If timer is running (not paused), add elapsed time since start
    if (kidsZoneTimerData.childLocation === 'kids_zone' && !kidsZoneTimerData.timerPausedAt) {
      const elapsedSinceStart = Math.floor((currentTime - kidsZoneTimerData.timerStartedAt) / 1000);
      totalSeconds += elapsedSinceStart;
    }
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [kidsZoneTimerData, currentTime, kidsZoneTime]);

  // Update local items when props change
  useEffect(() => {
    setItems(cartItems);
  }, [cartItems]);

  useEffect(() => {
    setOrdered(orderedItems);
  }, [orderedItems]);

  useEffect(() => {
    const ids = orderedItems.map(i => i.id);
    // Show kids zone row if there's a fee OR if there's time (active timer) OR if there's timer data
    if (kidsZoneFee > 0 || kidsZoneTime || realTimeKidsZoneTime || kidsZoneTimerData) {
      ids.push(KIDS_ZONE_SORTABLE_ID);
    }
    setOrderedDisplayIds(ids);
  }, [orderedItems, kidsZoneFee, kidsZoneTime, realTimeKidsZoneTime, kidsZoneTimerData]);

  // Use the droppable ref passed from CustomerMenu's DndContext
  // This ensures the drop zone is registered in the parent DndContext

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Prevent accidental drags when tapping buttons or scrolling
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      // Optimized for mobile: very low activation distance for immediate drag
      activationConstraint: { 
        distance: 0.1, // Almost immediate drag activation on touch devices
        delay: 0, // No delay for immediate response
        tolerance: 0 // No tolerance - immediate activation
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    // Determine if dragging cart item or ordered item
    const isCartItem = items.some(item => item.id === event.active.id);
    const isOrderedItem = orderedDisplayIds.includes(String(event.active.id));
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

    // Handle ordered section reordering (includes kids zone row)
    const orderedOldIndex = orderedDisplayIds.findIndex((id) => id === active.id);
    const orderedNewIndex = orderedDisplayIds.findIndex((id) => id === over.id);

    if (orderedOldIndex !== -1 && orderedNewIndex !== -1) {
      const newIds = [...orderedDisplayIds];
      const [movedId] = newIds.splice(orderedOldIndex, 1);
      newIds.splice(orderedNewIndex, 0, movedId);
      setOrderedDisplayIds(newIds);

      if (onReorderOrderedItems) {
        const orderedOnlyIds = newIds.filter(id => id !== KIDS_ZONE_SORTABLE_ID);
        const byId = new Map(ordered.map(i => [i.id, i]));
        onReorderOrderedItems(orderedOnlyIds.map(id => byId.get(id)!).filter(Boolean));
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
  const activeOrderedItem = activeId && activeType === 'ordered'
    ? (activeId === KIDS_ZONE_SORTABLE_ID ? { id: KIDS_ZONE_SORTABLE_ID, name: 'Детски кът', price: 0, quantity: 1 } : ordered.find((item) => item.id === activeId) || null)
    : null;
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

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50 transition-opacity duration-300 opacity-0"
        style={{ animation: 'fadeIn 0.3s ease-out forwards' }}
        onClick={() => onOpenChange(false)}
      />
      
      {/* Bottom Sheet */}
      <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
        <div 
          className="w-full max-w-3xl bg-background border-t border-border rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] pointer-events-auto transform transition-transform duration-300 ease-out"
          style={{ animation: 'slideUp 0.3s ease-out forwards' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 sm:px-6 pt-5 pb-4 border-b border-border/50">
            <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-primary" />
              </div>
              <div>
                  <h2 className="text-xl font-display font-bold">Кошница</h2>
                  <p className="text-sm text-muted-foreground">
                  {itemCount} {itemCount === 1 ? 'артикул' : 'артикула'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearCart}
                disabled={disabled || isLoading}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9"
              >
                    <Trash2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Изчисти</span>
              </Button>
            )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  className="h-9 w-9 rounded-xl hover:bg-muted"
                  aria-label="Close cart"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            {/* Drag handle indicator */}
            <div className="flex justify-center">
              <div className="h-1 w-12 rounded-full bg-muted-foreground/30" />
            </div>
          </div>

        <div
          ref={menuDropRef as React.Ref<HTMLDivElement>}
          className={cn(
            "flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3",
            menuDropIsOver && "ring-2 ring-primary/20 border-t border-primary/30 bg-primary/5"
          )}
        >
          {allItems.length === 0 ? (
            <div className={cn(
              "flex flex-col items-center justify-center h-full text-center py-12 min-h-[200px]",
              menuDropIsOver && "bg-primary/5 border-2 border-dashed border-primary/40 rounded-lg"
            )}>
              <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                <ShoppingBag className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <p className="text-lg font-medium text-muted-foreground mb-2">
                Кошницата е празна
              </p>
              <p className="text-sm text-muted-foreground/70">
                {menuDropIsOver ? (
                  <span className="text-primary font-semibold">Отпуснете артикула тук</span>
                ) : (
                  "Добавете артикули от менюто"
                )}
              </p>
            </div>
          ) : (
            <>
              {/* Ordered Items (Read-only with Drag & Drop) */}
              {(ordered.length > 0 || kidsZoneFee > 0 || kidsZoneTime || realTimeKidsZoneTime || kidsZoneTimerData) && (
                <div className="mb-4">
                  <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">
                    Поръчани артикули
                  </h3>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={orderedDisplayIds}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 sm:space-y-2.5">
                        {orderedDisplayIds.map((id) => {
                          if (id === KIDS_ZONE_SORTABLE_ID) {
                            return <SortableKidsZoneRow key={id} time={realTimeKidsZoneTime || kidsZoneTime} />;
                          }
                          const item = ordered.find(i => i.id === id);
                          if (!item) return null;
                          return (
                            <SortableOrderedItem
                              key={item.id}
                              item={item}
                              onClick={() => {
                                triggerHapticFeedback('light');
                              }}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                    <DragOverlay>
                      {activeOrderedItem ? (
                        <div className="bg-card border border-primary rounded-lg p-3 sm:p-4 shadow-lg opacity-90">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                            <span className="font-semibold">{stripAllergenNumbersFromName(activeOrderedItem.name)}</span>
                          </div>
                        </div>
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                </div>
              )}
              
              {/* Cart Items (Editable with Drag & Drop) */}
              {items.length > 0 && (
                <div>
                  {ordered.length > 0 && (
                    <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">
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
                      <div className="space-y-2.5 sm:space-y-3">
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
                            <span className="font-semibold">{stripAllergenNumbersFromName(activeCartItem.name)}</span>
                          </div>
                        </div>
                      ) : activeOrderedItem ? (
                        <div className="bg-card border border-primary rounded-lg p-3 sm:p-4 shadow-lg opacity-90">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                            <span className="font-semibold">{stripAllergenNumbersFromName(activeOrderedItem.name)}</span>
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
            <div className="border-t border-border/50 bg-background/95 backdrop-blur-sm px-4 sm:px-6 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-base sm:text-lg font-medium text-foreground">
                Общо:
              </span>
              <span className="font-display text-2xl sm:text-3xl font-bold text-primary">
                {total.toFixed(2)} EUR
              </span>
            </div>

              {/* Kids Zone Summary */}
              {(kidsZoneFee > 0 || realTimeKidsZoneTime || kidsZoneTime) && (
                <div className="flex items-center justify-between mb-2 text-xs sm:text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🎭</span>
                    <span>Детски кът{(realTimeKidsZoneTime || kidsZoneTime) ? ` • ${realTimeKidsZoneTime || kidsZoneTime}` : ''}</span>
                  </div>
                  {kidsZoneFee > 0 && (
                    <span className="font-semibold text-foreground">
                      + {kidsZoneFee.toFixed(2)} EUR
                    </span>
                  )}
                </div>
              )}

              <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                Потвърдете поръчката отдолу, когато сте готови.
              </p>
          </div>
        )}
        </div>
      </div>
    </>
  );
};

export default CartDrawer;
