import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, Save, X, MoreVertical, Merge, CheckSquare, Square, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRestaurant, MenuItem } from '@/context/RestaurantContext';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { stripAllergenNumbersFromName } from '@/utils/menu';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Draggable Available Item Component (for "Всички артикули")
const DraggableAvailableItem: React.FC<{
  item: MenuItem;
  onAdd: () => void;
}> = ({ item, onAdd }) => {
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
      style={{
        ...style,
        touchAction: 'none', // Enable drag on touch devices
        WebkitTouchCallout: 'none', // Disable iOS callout
        WebkitUserSelect: 'none', // Disable text selection
        userSelect: 'none',
      }}
      {...attributes}
      {...listeners}
      className="flex items-center justify-between p-2.5 sm:p-3 border rounded hover:bg-secondary/50 gap-2 cursor-grab active:cursor-grabbing min-h-[60px] [&_button]:pointer-events-auto [&_button]:z-20 [&_button]:touch-action-manipulation"
      onTouchStart={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input')) {
          return;
        }
        // Enable drag for the element itself
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-medium truncate">{stripAllergenNumbersFromName(item.name)}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground">{item.price.toFixed(2)} EUR</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="ml-1 sm:ml-2 text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4 flex-shrink-0 touch-manipulation min-w-[60px]"
      >
        Добави
      </Button>
    </div>
  );
};

// Droppable Zone Component for Daily Menu columns
const DailyDropZone: React.FC<{
  id: string;
  title: string;
  children: React.ReactNode;
}> = ({ id, title, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'border rounded-lg p-2.5 sm:p-3 md:p-4 overflow-y-auto max-h-[65vh] sm:max-h-[70vh] transition-all',
        isOver && 'ring-2 ring-primary/30 border-primary/50 bg-primary/5'
      )}
    >
      <h3 className="font-semibold text-sm sm:text-base mb-2 sm:mb-3">{title}</h3>
      {children}
    </div>
  );
};

// Sortable Daily Item Component (for "Меню за деня")
const SortableDailyItem: React.FC<{
  item: MenuItem;
  onEdit: () => void;
  onRemove: () => void;
  isEditing: boolean;
  editText: string;
  onEditTextChange: (text: string) => void;
  onCancelEdit: () => void;
}> = ({ item, onEdit, onRemove, isEditing, editText, onEditTextChange, onCancelEdit }) => {
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
      style={{
        ...style,
        touchAction: 'none', // Enable drag on touch devices
        WebkitTouchCallout: 'none', // Disable iOS callout
        WebkitUserSelect: 'none', // Disable text selection
        userSelect: 'none',
      }}
      {...attributes}
      {...listeners}
      className="flex items-center justify-between p-2.5 sm:p-3 border rounded hover:bg-secondary/50 gap-2 cursor-grab active:cursor-grabbing min-h-[60px] [&_button]:pointer-events-auto [&_button]:z-20 [&_button]:touch-action-manipulation [&_input]:touch-action-manipulation"
      onTouchStart={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input')) {
          return;
        }
        // Enable drag for the element itself
      }}
    >
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <Input
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            className="h-9 sm:h-10 text-sm sm:text-base"
            autoFocus
            onClick={(e) => e.stopPropagation()}
            style={{ touchAction: 'manipulation' }}
          />
        ) : (
          <>
            <p className="text-xs sm:text-sm font-medium truncate">{stripAllergenNumbersFromName(item.name)}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{item.price.toFixed(2)} EUR</p>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 ml-1 sm:ml-2 flex-shrink-0">
        {isEditing ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onCancelEdit();
            }}
            className="h-9 w-9 sm:h-10 sm:w-10 p-0 touch-manipulation"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="h-9 w-9 sm:h-10 sm:w-10 p-0 touch-manipulation"
              title="Редактирай"
            >
              <Edit2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="h-9 w-9 sm:h-10 sm:w-10 p-0 text-destructive touch-manipulation"
              title="Премахни"
            >
              <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

// Draggable Menu Item Component
const DraggableMenuItem: React.FC<{
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  isBulkMode?: boolean;
}> = ({ item, onEdit, onDelete, isSelected = false, onToggleSelect, isBulkMode = false }) => {
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
    scale: isDragging ? 1.05 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={!isBulkMode ? {
        ...style,
        touchAction: 'none', // Enable drag on touch devices
        WebkitTouchCallout: 'none', // Disable iOS callout
        WebkitUserSelect: 'none', // Disable text selection
        userSelect: 'none',
      } : style}
      {...(!isBulkMode ? attributes : {})}
      {...(!isBulkMode ? listeners : {})}
      className={`bg-card border rounded-lg p-2.5 sm:p-3 md:p-4 flex items-center justify-between transition-all duration-200 ${
        isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/30 hover:shadow-sm'
      } ${isBulkMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing min-h-[60px]'} ${
        isDragging ? 'shadow-lg ring-2 ring-primary/20 opacity-90' : ''
      } ${!isBulkMode ? '[&_button]:pointer-events-auto [&_button]:z-20 [&_button]:touch-action-manipulation' : ''}`}
      onClick={isBulkMode && onToggleSelect ? () => onToggleSelect(item.id) : undefined}
      onTouchStart={!isBulkMode ? (e) => {
        // Allow drag on touch devices - buttons will still work due to pointer-events-auto
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input')) {
          // Don't prevent default for buttons and inputs
          return;
        }
        // Enable drag for the element itself
      } : undefined}
    >
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        {isBulkMode && onToggleSelect && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(item.id);
            }}
            className="text-primary hover:text-primary/80 flex-shrink-0"
          >
            {isSelected ? <CheckSquare className="h-4 w-4 sm:h-5 sm:w-5" /> : <Square className="h-4 w-4 sm:h-5 sm:w-5" />}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm sm:text-base text-foreground truncate">{stripAllergenNumbersFromName(item.name)}</h3>
          {item.desc && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2">{item.desc}</p>
          )}
          <p className="text-xs sm:text-sm md:text-base text-primary font-semibold mt-0.5 sm:mt-1">
            {item.price.toFixed(2)} EUR
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 sm:h-10 sm:w-10 touch-manipulation"
          onClick={() => onEdit(item)}
        >
          <Edit2 className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 sm:h-10 sm:w-10 text-destructive hover:text-destructive touch-manipulation"
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </div>
    </div>
  );
};

// Droppable Category Section Component
const CategorySection: React.FC<{
  category: string;
  items: MenuItem[];
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
  onDeleteCategory: (categoryName: string) => void;
  onMergeCategory: (sourceCategory: string) => void;
  isUnassigned?: boolean;
  selectedItems?: Set<string>;
  onToggleSelect?: (id: string) => void;
  isBulkMode?: boolean;
}> = ({ category, items, onEdit, onDelete, onRenameCategory, onDeleteCategory, onMergeCategory, isUnassigned = false, selectedItems, onToggleSelect, isBulkMode = false }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: category,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(category);

  const handleSaveRename = () => {
    if (editValue.trim() && editValue.trim() !== category) {
      onRenameCategory(category, editValue.trim());
    }
    setIsEditing(false);
    setEditValue(category);
  };

  const handleCancelRename = () => {
    setIsEditing(false);
    setEditValue(category);
  };

  // Extract emoji from category name
  const categoryEmoji = category.match(/^[\p{Emoji}]/u)?.[0] || '📦';
  const categoryName = category.replace(/^[\p{Emoji}]\s*/, '') || category;

  return (
    <section
      ref={setNodeRef}
      className={`rounded-xl p-2.5 sm:p-3 md:p-4 transition-all duration-200 ${
        isOver 
          ? 'bg-primary/10 border-2 border-primary border-dashed shadow-md' 
          : 'bg-gradient-to-br from-background to-muted/20 border border-border/50'
      }`}
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename();
                if (e.key === 'Escape') handleCancelRename();
              }}
              className="text-base sm:text-lg md:text-xl font-semibold h-10 sm:h-11 touch-manipulation"
              autoFocus
            />
            <Button size="sm" onClick={handleSaveRename} className="h-10 w-10 sm:h-11 sm:w-11 p-0 touch-manipulation flex-shrink-0">
              <Save className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancelRename} className="h-10 w-10 sm:h-11 sm:w-11 p-0 touch-manipulation flex-shrink-0">
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        ) : (
          <>
            <h2 
              className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold text-foreground flex items-center gap-1.5 sm:gap-2 md:gap-3 bg-primary/5 px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 rounded-lg border border-primary/10 cursor-pointer hover:bg-primary/10 transition-colors group touch-manipulation min-h-[44px] flex-1 min-w-0"
              onClick={() => !isUnassigned && setIsEditing(true)}
              title={!isUnassigned ? "Click to rename category" : undefined}
            >
              <span className="text-base sm:text-lg md:text-xl lg:text-2xl flex-shrink-0">{categoryEmoji}</span>
              <span className="flex-1 min-w-0 truncate">{categoryName}</span>
              <span className="text-[10px] sm:text-xs md:text-sm font-normal text-muted-foreground flex-shrink-0 hidden sm:inline">
                ({items.length} {items.length === 1 ? 'item' : 'items'})
              </span>
              {isOver && <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs md:text-sm text-primary font-medium animate-pulse flex-shrink-0">(Drop here)</span>}
              {!isUnassigned && (
                <Edit2 className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hidden sm:block" />
              )}
            </h2>
            {!isUnassigned && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-11 sm:w-11 touch-manipulation flex-shrink-0">
                    <MoreVertical className="h-5 w-5 sm:h-6 sm:w-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Rename Category
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMergeCategory(category)}>
                    <Merge className="h-4 w-4 mr-2" />
                    Merge Category
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteCategory(category)}
                    disabled={items.length > 0}
                    className={items.length > 0 ? 'text-muted-foreground' : 'text-destructive'}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {items.length > 0 ? `Delete Category (${items.length} items)` : 'Delete Category'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
      </div>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        {items.length === 0 ? (
          <div className="text-center py-8 sm:py-12 text-muted-foreground border-2 border-dashed rounded-lg border-border/50 bg-muted/5">
            <p className="text-xs sm:text-sm font-medium mb-1">No items in this category</p>
            <p className="text-[10px] sm:text-xs">Drag items here to add them</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-2.5 animate-in fade-in duration-300">
            {items.map(item => (
              <DraggableMenuItem
                key={item.id}
                item={item}
                onEdit={onEdit}
                onDelete={onDelete}
                isSelected={selectedItems?.has(item.id) || false}
                onToggleSelect={onToggleSelect}
                isBulkMode={isBulkMode}
              />
            ))}
          </div>
        )}
      </SortableContext>
    </section>
  );
};

// New Category Section Component (for creating categories)
const NewCategorySection: React.FC<{
  categoryName: string;
}> = ({ categoryName }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: categoryName,
  });

  return (
    <section
      ref={setNodeRef}
      className={`rounded-lg p-4 border-2 border-dashed transition-colors ${
        isOver 
          ? 'border-primary bg-primary/10' 
          : 'border-primary/30 bg-primary/5'
      }`}
    >
      <h2 className="text-xl font-semibold mb-4 text-foreground">
        {categoryName}
        <span className="ml-2 text-sm text-muted-foreground">(New category)</span>
        {isOver && <span className="ml-2 text-sm text-primary">(Drop here)</span>}
      </h2>
      <div className="space-y-2 min-h-[60px] flex items-center justify-center text-muted-foreground">
        <p className="text-sm">Drop items here to assign them to this category</p>
      </div>
    </section>
  );
};

const MenuEditor: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { menuItems, addMenuItem, updateMenuItem, deleteMenuItem, getDailyMenuItems, setDailyMenuItems, loading, realtimeUpdateVersion } = useRestaurant();
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    cat: '',
    price: '',
    desc: '',
  });
  const [draggedItem, setDraggedItem] = useState<MenuItem | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  // Optimistic updates for immediate UI feedback
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, Partial<MenuItem>>>(new Map());
  // Category management state
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [sourceCategoryForMerge, setSourceCategoryForMerge] = useState<string | null>(null);
  // Bulk selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false);
  // Category order state
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [itemOrderUpdate, setItemOrderUpdate] = useState(0); // Force re-render when item order changes
  // Statistics
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  // Daily Menu state
  const [activeTab, setActiveTab] = useState('edit');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyItems, setDailyItems] = useState<MenuItem[]>([]);
  const [dailyMenuLoading, setDailyMenuLoading] = useState(false);
  const [editingDailyItem, setEditingDailyItem] = useState<string | null>(null);
  const [editDailyText, setEditDailyText] = useState('');
  const [activeDailyDragId, setActiveDailyDragId] = useState<string | null>(null);

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Prevent accidental drags when tapping buttons or scrolling
      activationConstraint: {
        distance: 8,
      },
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

  // Apply optimistic updates to menuItems for immediate UI feedback
  const displayItems = menuItems.map(item => {
    const optimistic = optimisticUpdates.get(item.id);
    if (optimistic) {
      return { ...item, ...optimistic };
    }
    return item;
  });

  // Group items by category, handling unassigned items
  const groupedItems = useMemo(() => {
    const grouped = displayItems.reduce((acc, item) => {
      // Treat empty, null, or undefined categories as "Unassigned"
      const category = item.cat && item.cat.trim() ? item.cat.trim() : '📦 Unassigned';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);

    // Apply saved order for each category
    Object.keys(grouped).forEach(category => {
      const orderKey = `menuItemOrder_${category}`;
      const savedOrder = localStorage.getItem(orderKey);
      if (savedOrder) {
        try {
          const itemIds = JSON.parse(savedOrder) as string[];
          const itemsById = new Map(grouped[category].map(item => [item.id, item]));
          const orderedItems: MenuItem[] = [];
          const unorderedItems: MenuItem[] = [];

          // Add items in saved order
          itemIds.forEach(id => {
            const item = itemsById.get(id);
            if (item) {
              orderedItems.push(item);
              itemsById.delete(id);
            }
          });

          // Add any new items that weren't in the saved order
          itemsById.forEach(item => {
            unorderedItems.push(item);
          });

          grouped[category] = [...orderedItems, ...unorderedItems];
        } catch (e) {
          console.error(`Error loading item order for ${category}:`, e);
        }
      }
    });

    return grouped;
  }, [displayItems, itemOrderUpdate]);

  // Get all unique categories for creating new ones
  const allCategories = useMemo(() => 
    Object.keys(groupedItems).filter(cat => cat !== '📦 Unassigned'),
    [groupedItems]
  );

  // Load category order from localStorage on mount
  useEffect(() => {
    const savedOrder = localStorage.getItem('menuCategoryOrder');
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed)) {
          setCategoryOrder(parsed);
        }
      } catch (e) {
        console.error('Error loading category order:', e);
      }
    }
  }, []);

  // Save category order to localStorage when it changes
  useEffect(() => {
    if (categoryOrder.length > 0) {
      localStorage.setItem('menuCategoryOrder', JSON.stringify(categoryOrder));
    }
  }, [categoryOrder]);

  // Sort categories by saved order, then alphabetically
  const sortedCategories = useMemo(() => {
    const categories = Object.keys(groupedItems).filter(cat => cat !== '📦 Unassigned');
    if (categoryOrder.length === 0) {
      return categories.sort((a, b) => a.localeCompare(b));
    }
    
    // Sort by saved order, then alphabetically for new categories
    const ordered = categoryOrder.filter(cat => categories.includes(cat));
    const unordered = categories.filter(cat => !categoryOrder.includes(cat)).sort((a, b) => a.localeCompare(b));
    return [...ordered, ...unordered];
  }, [groupedItems, categoryOrder]);

  // Clear optimistic updates when menuItems change from real-time subscription
  // This ensures the UI stays in sync with the database
  useEffect(() => {
    // Update last update time when menuItems change
    if (menuItems.length > 0) {
      setLastUpdateTime(new Date());
    }
    
    // Clear any optimistic updates that match the current database state
    setOptimisticUpdates(prev => {
      const next = new Map(prev);
      let hasChanges = false;
      
      // Remove optimistic updates for items that are now in sync with database
      for (const [itemId, optimistic] of next.entries()) {
        const dbItem = menuItems.find(m => m.id === itemId);
        if (dbItem) {
          // Check if the optimistic update matches the database state
          const isInSync = Object.keys(optimistic).every(key => {
            const dbValue = dbItem[key as keyof MenuItem];
            const optValue = optimistic[key as keyof MenuItem];
            return dbValue === optValue;
          });
          
          if (isInSync) {
            next.delete(itemId);
            hasChanges = true;
          }
        }
      }
      
      return hasChanges ? next : prev;
    });
  }, [menuItems]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      // Escape to exit bulk mode
      if (e.key === 'Escape' && isBulkMode && !isInputFocused) {
        setIsBulkMode(false);
        setSelectedItems(new Set());
        e.preventDefault();
      }
      
      // Delete key to delete selected items in bulk mode
      if ((e.key === 'Delete' || e.key === 'Backspace') && isBulkMode && selectedItems.size > 0 && !isInputFocused) {
        if (confirm(`Delete ${selectedItems.size} selected item(s)?`)) {
          const itemsToDelete = Array.from(selectedItems);
          itemsToDelete.forEach(id => {
            handleDelete(id);
          });
          setSelectedItems(new Set());
          setIsBulkMode(false);
        }
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBulkMode, selectedItems]);

  const handleAddNew = () => {
    setEditingItem(null);
    setFormData({ name: '', cat: '', price: '', desc: '' });
    setIsDialogOpen(true);
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      cat: item.cat,
      price: item.price.toString(),
      desc: item.desc || '',
    });
    setIsDialogOpen(true);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const item = displayItems.find(i => i.id === active.id);
    setDraggedItem(item || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);

    if (!over || active.id === over.id) return;

    const item = displayItems.find(i => i.id === active.id);
    const targetId = over.id as string;

    if (!item || !targetId) return;

    // Check if dropping on another item (for reordering within same category)
    const targetItem = displayItems.find(i => i.id === targetId);
    if (targetItem) {
      const currentCategory = item.cat && item.cat.trim() ? item.cat.trim() : '📦 Unassigned';
      const targetItemCategory = targetItem.cat && targetItem.cat.trim() ? targetItem.cat.trim() : '📦 Unassigned';
      
      // If same category, reorder items
      if (currentCategory === targetItemCategory) {
        const categoryItems = groupedItems[currentCategory] || [];
        const oldIndex = categoryItems.findIndex(i => i.id === active.id);
        const newIndex = categoryItems.findIndex(i => i.id === targetId);
        
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          // Save new order to localStorage
          const orderKey = `menuItemOrder_${currentCategory}`;
          const newOrder = [...categoryItems];
          const [movedItem] = newOrder.splice(oldIndex, 1);
          newOrder.splice(newIndex, 0, movedItem);
          const itemIds = newOrder.map(i => i.id);
          localStorage.setItem(orderKey, JSON.stringify(itemIds));
          
          // Trigger re-render by updating state
          setItemOrderUpdate(prev => prev + 1);
          
          toast({
            title: 'Success',
            description: `Reordered items in ${currentCategory}`,
          });
        }
        return;
      }
    }

    // Otherwise, treat as category drop (moving to different category)
    const targetCategory = targetId;
    
    // Normalize category - if dragging to "Unassigned", use empty string
    const normalizedCategory = targetCategory === '📦 Unassigned' ? '' : targetCategory;
    
    // Check if category already exists or if it's the same
    const currentCategory = item.cat && item.cat.trim() ? item.cat.trim() : '📦 Unassigned';
    if (currentCategory === targetCategory) return;

    // Optimistic update: immediately update UI
    setOptimisticUpdates(prev => {
      const next = new Map(prev);
      next.set(item.id, { cat: normalizedCategory });
      return next;
    });

    try {
      await updateMenuItem(item.id, {
        cat: normalizedCategory,
      });
      
      // If dropping on a new category, hide the input after first item is added
      if (showNewCategoryInput && newCategoryName.trim() === targetCategory) {
        setShowNewCategoryInput(false);
        setNewCategoryName('');
      }
      
      // Don't clear optimistic update immediately - let real-time subscription handle it
      // The useEffect that clears optimistic updates will handle this when menuItems changes
      // This ensures smooth auto-refresh when the real-time update arrives
      
      toast({
        title: 'Success',
        description: `Moved "${item.name}" to ${targetCategory}`,
      });
    } catch (error) {
      console.error('Error moving item:', error);
      // Rollback optimistic update on error
      setOptimisticUpdates(prev => {
        const next = new Map(prev);
        next.delete(item.id);
        return next;
      });
      toast({
        title: 'Error',
        description: 'Failed to move item',
        variant: 'destructive',
      });
    }
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a category name',
        variant: 'destructive',
      });
      return;
    }

    // Check if category already exists
    if (allCategories.includes(newCategoryName.trim())) {
      toast({
        title: 'Error',
        description: 'Category already exists',
        variant: 'destructive',
      });
      return;
    }

    setShowNewCategoryInput(false);
    setNewCategoryName('');
    toast({
      title: 'Category Created',
      description: `Category "${newCategoryName.trim()}" is ready. Drag items to it to assign them.`,
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      toast({
        title: 'Error',
        description: 'Please fill in name and price',
        variant: 'destructive',
      });
      return;
    }

    // If no category provided, leave empty (will show in Unassigned)
    const category = formData.cat.trim() || '';

    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid price',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingItem) {
        await updateMenuItem(editingItem.id, {
          name: formData.name,
          cat: category,
          price: price,
          desc: formData.desc || undefined,
        });
        toast({
          title: 'Success',
          description: 'Menu item updated',
        });
      } else {
        await addMenuItem({
          name: formData.name,
          cat: category,
          price: price,
          desc: formData.desc || undefined,
        });
        toast({
          title: 'Success',
          description: 'Menu item added',
        });
      }

      setIsDialogOpen(false);
      setEditingItem(null);
      setFormData({ name: '', cat: '', price: '', desc: '' });
    } catch (error) {
      console.error('Error saving menu item:', error);
      toast({
        title: 'Error',
        description: 'Failed to save menu item',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this menu item?')) {
      try {
        await deleteMenuItem(id);
        toast({
          title: 'Success',
          description: 'Menu item deleted',
        });
      } catch (error) {
        console.error('Error deleting menu item:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete menu item',
          variant: 'destructive',
        });
      }
    }
  };

  // Rename category - update all items in that category
  const handleRenameCategory = async (oldName: string, newName: string) => {
    if (!newName.trim() || newName.trim() === oldName) return;

    // Check if new category name already exists
    if (allCategories.includes(newName.trim()) && newName.trim() !== oldName) {
      toast({
        title: 'Error',
        description: 'Category name already exists',
        variant: 'destructive',
      });
      return;
    }

    // Normalize old name (handle empty string for unassigned)
    const normalizedOldName = oldName === '📦 Unassigned' ? '' : oldName;
    const normalizedNewName = newName.trim();

    // Find all items in the old category
    const itemsToUpdate = displayItems.filter(item => {
      const itemCategory = item.cat && item.cat.trim() ? item.cat.trim() : '📦 Unassigned';
      return itemCategory === oldName;
    });

    if (itemsToUpdate.length === 0) {
      toast({
        title: 'Error',
        description: 'No items found in this category',
        variant: 'destructive',
      });
      return;
    }

    // Optimistic update
    setOptimisticUpdates(prev => {
      const next = new Map(prev);
      itemsToUpdate.forEach(item => {
        next.set(item.id, { cat: normalizedNewName });
      });
      return next;
    });

    try {
      // Update all items in parallel
      await Promise.all(
        itemsToUpdate.map(item =>
          updateMenuItem(item.id, { cat: normalizedNewName })
        )
      );

      toast({
        title: 'Success',
        description: `Renamed category "${oldName}" to "${newName}" (${itemsToUpdate.length} items updated)`,
      });
    } catch (error) {
      console.error('Error renaming category:', error);
      // Rollback optimistic update
      setOptimisticUpdates(prev => {
        const next = new Map(prev);
        itemsToUpdate.forEach(item => {
          next.delete(item.id);
        });
        return next;
      });
      toast({
        title: 'Error',
        description: 'Failed to rename category',
        variant: 'destructive',
      });
    }
  };

  // Delete empty category
  const handleDeleteCategory = async (categoryName: string) => {
    if (categoryName === '📦 Unassigned') {
      toast({
        title: 'Error',
        description: 'Cannot delete Unassigned category',
        variant: 'destructive',
      });
      return;
    }

    const itemsInCategory = groupedItems[categoryName] || [];
    
    if (itemsInCategory.length > 0) {
      toast({
        title: 'Error',
        description: `Cannot delete category with ${itemsInCategory.length} items. Move items first or merge with another category.`,
        variant: 'destructive',
      });
      return;
    }

    // Category is already empty, just show success message
    toast({
      title: 'Success',
      description: `Category "${categoryName}" is already empty and will be removed automatically.`,
    });
  };

  // Merge categories - move all items from source to target
  const handleMergeCategory = (sourceCategory: string) => {
    if (sourceCategory === '📦 Unassigned') {
      toast({
        title: 'Error',
        description: 'Cannot merge Unassigned category',
        variant: 'destructive',
      });
      return;
    }

    const sourceItems = groupedItems[sourceCategory] || [];
    if (sourceItems.length === 0) {
      toast({
        title: 'Error',
        description: 'Source category is empty',
        variant: 'destructive',
      });
      return;
    }

    setSourceCategoryForMerge(sourceCategory);
    setMergeDialogOpen(true);
  };

  const handleConfirmMerge = async (targetCategory: string) => {
    if (!sourceCategoryForMerge) return;

    const sourceItems = groupedItems[sourceCategoryForMerge] || [];
    if (sourceItems.length === 0) return;

    // Normalize target category (handle empty string for unassigned)
    const normalizedTarget = targetCategory === '📦 Unassigned' ? '' : targetCategory;

    // Optimistic update
    setOptimisticUpdates(prev => {
      const next = new Map(prev);
      sourceItems.forEach(item => {
        next.set(item.id, { cat: normalizedTarget });
      });
      return next;
    });

    try {
      // Update all items in parallel
      await Promise.all(
        sourceItems.map(item =>
          updateMenuItem(item.id, { cat: normalizedTarget })
        )
      );

      toast({
        title: 'Success',
        description: `Merged "${sourceCategoryForMerge}" into "${targetCategory}" (${sourceItems.length} items moved)`,
      });

      setMergeDialogOpen(false);
      setSourceCategoryForMerge(null);
    } catch (error) {
      console.error('Error merging categories:', error);
      // Rollback optimistic update
      setOptimisticUpdates(prev => {
        const next = new Map(prev);
        sourceItems.forEach(item => {
          next.delete(item.id);
        });
        return next;
      });
      toast({
        title: 'Error',
        description: 'Failed to merge categories',
        variant: 'destructive',
      });
    }
  };

  // Toggle item selection in bulk mode
  const handleToggleSelect = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Move selected items to a target category
  const handleBulkMove = async (targetCategory: string) => {
    if (selectedItems.size === 0) return;

    // Normalize target category (handle empty string for unassigned)
    const normalizedTarget = targetCategory === '📦 Unassigned' ? '' : targetCategory;

    // Get selected items
    const itemsToMove = displayItems.filter(item => selectedItems.has(item.id));
    if (itemsToMove.length === 0) return;

    // Optimistic update
    setOptimisticUpdates(prev => {
      const next = new Map(prev);
      itemsToMove.forEach(item => {
        next.set(item.id, { cat: normalizedTarget });
      });
      return next;
    });

    try {
      // Update all items in parallel
      await Promise.all(
        itemsToMove.map(item =>
          updateMenuItem(item.id, { cat: normalizedTarget })
        )
      );

      toast({
        title: 'Success',
        description: `Moved ${itemsToMove.length} item(s) to "${targetCategory}"`,
      });

      // Clear selection and exit bulk mode
      setSelectedItems(new Set());
      setIsBulkMode(false);
      setBulkMoveDialogOpen(false);
    } catch (error) {
      console.error('Error moving items:', error);
      // Rollback optimistic update
      setOptimisticUpdates(prev => {
        const next = new Map(prev);
        itemsToMove.forEach(item => {
          next.delete(item.id);
        });
        return next;
      });
      toast({
        title: 'Error',
        description: 'Failed to move items',
        variant: 'destructive',
      });
    }
  };

  // Daily Menu functions
  const loadDailyMenu = useCallback(async () => {
    setDailyMenuLoading(true);
    try {
      const items = await getDailyMenuItems(selectedDate);
      setDailyItems(items);
      // BroadcastChannel handles instant updates to all tabs
    } catch (error) {
      console.error('Error loading daily menu:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно зареждане на меню за деня',
        variant: 'destructive',
      });
    } finally {
      setDailyMenuLoading(false);
    }
  }, [selectedDate, getDailyMenuItems, toast]);

  useEffect(() => {
    if (activeTab === 'daily') {
      loadDailyMenu();
    }
  }, [activeTab, loadDailyMenu]);

  const handleAddToDaily = async (item: MenuItem) => {
    try {
      const currentItemIds = dailyItems.map(i => i.id);
      if (currentItemIds.includes(item.id)) {
        toast({
          title: 'Информация',
          description: 'Артикулът вече е в менюто за деня',
        });
        return;
      }

      const newItemIds = [...currentItemIds, item.id];
      await setDailyMenuItems(selectedDate, newItemIds);
      await loadDailyMenu();
      
      // Real-time subscription will automatically update all tabs
      
      toast({
        title: '✅ Добавено',
        description: `${item.name} е добавено в менюто за деня`,
      });
    } catch (error) {
      console.error('Error adding to daily menu:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно добавяне на артикул',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveFromDaily = async (itemId: string) => {
    try {
      const currentItemIds = dailyItems.map(i => i.id);
      const newItemIds = currentItemIds.filter(id => id !== itemId);
      await setDailyMenuItems(selectedDate, newItemIds);
      await loadDailyMenu();
      
      // Real-time subscription will automatically update all tabs
      
      toast({
        title: '✅ Премахнато',
        description: 'Артикулът е премахнат от менюто за деня',
      });
    } catch (error) {
      console.error('Error removing from daily menu:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно премахване',
        variant: 'destructive',
      });
    }
  };

  const availableItems = useMemo(() => {
    const dailyItemIds = dailyItems.map(i => i.id);
    return menuItems.filter(item => !dailyItemIds.includes(item.id));
  }, [menuItems, dailyItems]);

  // Daily Menu Drag and Drop handlers
  const handleDailyDragStart = (event: DragStartEvent) => {
    setActiveDailyDragId(event.active.id as string);
  };

  const handleDailyDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDailyDragId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const isFromAvailable = availableItems.some(item => item.id === activeId);
    const isFromDaily = dailyItems.some(item => item.id === activeId);
    const isOverDailyItem = dailyItems.some(item => item.id === overId);
    const isOverAvailableItem = availableItems.some(item => item.id === overId);

    // Check if dragging from "Всички артикули" to "Меню за деня" (drop zone or daily item)
    if (isFromAvailable && (overId === 'daily-menu-drop' || isOverDailyItem)) {
      const item = availableItems.find(i => i.id === activeId);
      if (item) {
        await handleAddToDaily(item);
        return;
      }
    }

    // Check if dragging from "Меню за деня" to "Всички артикули" (drop zone or available item)
    if (isFromDaily && (overId === 'available-items-drop' || isOverAvailableItem)) {
      await handleRemoveFromDaily(activeId);
      return;
    }

    // Reorder within "Меню за деня"
    if (isFromDaily && isOverDailyItem && activeId !== overId) {
      const oldIndex = dailyItems.findIndex(item => item.id === activeId);
      const newIndex = dailyItems.findIndex(item => item.id === overId);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newItems = [...dailyItems];
        const [movedItem] = newItems.splice(oldIndex, 1);
        newItems.splice(newIndex, 0, movedItem);

        // Update order in database
        const newItemIds = newItems.map(i => i.id);
        try {
          await setDailyMenuItems(selectedDate, newItemIds);
          setDailyItems(newItems);
          
          // Real-time subscription will automatically update all tabs
        } catch (error) {
          console.error('Error reordering daily menu:', error);
          toast({
            title: 'Грешка',
            description: 'Неуспешно пренареждане',
            variant: 'destructive',
          });
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Mobile Optimized */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg hover:bg-secondary flex-shrink-0 touch-manipulation"
                onClick={() => navigate('/admin')}
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-foreground truncate">
                  Menu Editor
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
                  Drag items to move between categories
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {isBulkMode ? (
                <>
                  <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
                    {selectedItems.size} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedItems.size > 0) {
                        setBulkMoveDialogOpen(true);
                      }
                    }}
                    disabled={selectedItems.size === 0}
                    className="text-xs sm:text-sm h-10 sm:h-11 px-3 sm:px-4 touch-manipulation"
                  >
                    <span className="hidden sm:inline">Move Selected </span>
                    <span className="sm:hidden">Move</span>
                    {selectedItems.size > 0 && <span className="ml-1">({selectedItems.size})</span>}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsBulkMode(false);
                      setSelectedItems(new Set());
                    }}
                    className="text-xs sm:text-sm h-10 sm:h-11 px-3 sm:px-4 touch-manipulation"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setIsBulkMode(true)}
                  className="gap-1 sm:gap-2 text-xs sm:text-sm h-10 sm:h-11 px-3 sm:px-4 touch-manipulation"
                >
                  <CheckSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">Bulk Select</span>
                  <span className="sm:hidden">Select</span>
                </Button>
              )}
              {showNewCategoryInput ? (
                <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                  <Input
                    placeholder="New category..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateCategory();
                      } else if (e.key === 'Escape') {
                        setShowNewCategoryInput(false);
                        setNewCategoryName('');
                      }
                    }}
                    className="w-full sm:w-40 md:w-48 h-10 sm:h-11 text-sm sm:text-base touch-manipulation"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleCreateCategory} className="h-10 sm:h-11 px-3 sm:px-4 text-sm sm:text-base touch-manipulation">
                    Create
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowNewCategoryInput(false);
                      setNewCategoryName('');
                    }}
                    className="h-10 sm:h-11 px-3 sm:px-4 text-sm sm:text-base touch-manipulation"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowNewCategoryInput(true)}
                  className="gap-1 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                >
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">New Category</span>
                  <span className="sm:hidden">Category</span>
                </Button>
              )}
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleAddNew} className="gap-1 sm:gap-2 text-xs sm:text-sm h-10 sm:h-11 px-3 sm:px-4 touch-manipulation">
                    <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="hidden sm:inline">Add Item</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingItem ? 'Update the menu item details below' : 'Fill in the details to add a new menu item'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Item name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cat">Category (optional - drag to move)</Label>
                      <Input
                        id="cat"
                        value={formData.cat}
                        onChange={(e) => setFormData({ ...formData, cat: e.target.value })}
                        placeholder="e.g., 🥣 Супи (or drag item to category)"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        You can drag items to categories after adding them
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="price">Price (EUR)</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="desc">Description (optional)</Label>
                      <Input
                        id="desc"
                        value={formData.desc}
                        onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                        placeholder="Item description"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSave}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* Menu Items - Mobile Optimized */}
      <main className="max-w-6xl mx-auto px-2.5 sm:px-4 md:px-6 py-3 sm:py-5 md:py-7">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-4 sm:mb-6 h-11 sm:h-12 touch-manipulation">
            <TabsTrigger value="edit" className="text-sm sm:text-base touch-manipulation">Редактирай меню</TabsTrigger>
            <TabsTrigger value="daily" className="text-sm sm:text-base touch-manipulation">Меню за деня</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="mt-0">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading menu items...</p>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-4 sm:space-y-6 md:space-y-8 animate-in fade-in duration-300">
              {/* Show Unassigned first if it exists */}
              {groupedItems['📦 Unassigned'] && (
                <CategorySection
                  key="📦 Unassigned"
                  category="📦 Unassigned"
                  items={groupedItems['📦 Unassigned']}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onRenameCategory={handleRenameCategory}
                  onDeleteCategory={handleDeleteCategory}
                  onMergeCategory={handleMergeCategory}
                  isUnassigned={true}
                  selectedItems={selectedItems}
                  onToggleSelect={handleToggleSelect}
                  isBulkMode={isBulkMode}
                />
              )}
              {/* Show all other categories in sorted order */}
              {sortedCategories.map(category => (
                <CategorySection
                  key={category}
                  category={category}
                  items={groupedItems[category] || []}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onRenameCategory={handleRenameCategory}
                  onDeleteCategory={handleDeleteCategory}
                  onMergeCategory={handleMergeCategory}
                  selectedItems={selectedItems}
                  onToggleSelect={handleToggleSelect}
                  isBulkMode={isBulkMode}
                />
              ))}
              {/* Show empty category placeholder if creating new category - make it droppable */}
              {showNewCategoryInput && newCategoryName.trim() && !allCategories.includes(newCategoryName.trim()) && (
                <NewCategorySection
                  categoryName={newCategoryName.trim()}
                />
              )}
            </div>
            <DragOverlay>
              {draggedItem ? (
                <div className="bg-card border-2 border-primary rounded-lg p-3 sm:p-4 shadow-lg opacity-90 min-w-[250px] sm:min-w-[300px]">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm sm:text-base text-foreground">{stripAllergenNumbersFromName(draggedItem.name)}</h3>
                    {draggedItem.desc && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{draggedItem.desc}</p>
                    )}
                    <p className="text-primary font-semibold text-sm sm:text-base mt-1">
                      {draggedItem.price.toFixed(2)} EUR
                    </p>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
          </TabsContent>

          <TabsContent value="daily" className="mt-0">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDailyDragStart}
              onDragEnd={handleDailyDragEnd}
            >
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-4 mb-4">
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11 touch-manipulation"
                  />
                  <Button 
                    onClick={loadDailyMenu} 
                    disabled={dailyMenuLoading} 
                    variant="outline" 
                    className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11 px-4 sm:px-6 touch-manipulation"
                  >
                    Зареди
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  {/* All Items Column */}
                  <DailyDropZone id="available-items-drop" title="Всички артикули">
                    {dailyMenuLoading ? (
                      <p className="text-muted-foreground text-sm">Зареждане...</p>
                    ) : (
                      <SortableContext
                        items={availableItems.map(item => item.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2 sm:space-y-2.5">
                          {availableItems.map(item => (
                            <DraggableAvailableItem
                              key={item.id}
                              item={item}
                              onAdd={() => handleAddToDaily(item)}
                            />
                          ))}
                          {availableItems.length === 0 && (
                            <p className="text-muted-foreground text-sm text-center py-4">
                              Всички артикули са в менюто за деня
                            </p>
                          )}
                        </div>
                      </SortableContext>
                    )}
                  </DailyDropZone>

                  {/* Daily Menu Items Column */}
                  <DailyDropZone id="daily-menu-drop" title="Меню за деня">
                    {dailyMenuLoading ? (
                      <p className="text-muted-foreground text-sm">Зареждане...</p>
                    ) : (
                      <SortableContext
                        items={dailyItems.map(item => item.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2 sm:space-y-2.5">
                          {dailyItems.map(item => (
                            <SortableDailyItem
                              key={item.id}
                              item={item}
                              onEdit={() => {
                                setEditingDailyItem(item.id);
                                setEditDailyText(item.name);
                              }}
                              onRemove={() => handleRemoveFromDaily(item.id)}
                              isEditing={editingDailyItem === item.id}
                              editText={editDailyText}
                              onEditTextChange={setEditDailyText}
                              onCancelEdit={() => {
                                setEditingDailyItem(null);
                                setEditDailyText('');
                              }}
                            />
                          ))}
                          {dailyItems.length === 0 && (
                            <p className="text-muted-foreground text-sm text-center py-4">
                              Няма артикули в менюто за деня
                            </p>
                          )}
                        </div>
                      </SortableContext>
                    )}
                  </DailyDropZone>
                </div>
              </div>
              <DragOverlay>
                {activeDailyDragId ? (
                  <div className="bg-card border-2 border-primary rounded-lg p-3 sm:p-4 shadow-lg opacity-90 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-semibold">
                        {availableItems.find(i => i.id === activeDailyDragId)?.name || 
                         dailyItems.find(i => i.id === activeDailyDragId)?.name || 
                         'Артикул'}
                      </span>
                    </div>
                    {(availableItems.find(i => i.id === activeDailyDragId) || dailyItems.find(i => i.id === activeDailyDragId)) && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        {(availableItems.find(i => i.id === activeDailyDragId) || dailyItems.find(i => i.id === activeDailyDragId))?.price.toFixed(2)} EUR
                      </p>
                    )}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </TabsContent>
        </Tabs>
      </main>

      {/* Merge Category Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Category</DialogTitle>
            <DialogDescription>
              Select the target category to merge "{sourceCategoryForMerge}" into. All items from the source category will be moved to the target category.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Source Category</Label>
              <div className="mt-1 p-3 bg-secondary rounded-lg">
                <span className="font-semibold">{sourceCategoryForMerge}</span>
                <span className="text-sm text-muted-foreground ml-2">
                  ({groupedItems[sourceCategoryForMerge || '']?.length || 0} items)
                </span>
              </div>
            </div>
            <div>
              <Label>Target Category</Label>
              <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                {Object.keys(groupedItems)
                  .filter(cat => cat !== sourceCategoryForMerge && cat !== '📦 Unassigned')
                  .sort()
                  .map(category => (
                    <Button
                      key={category}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleConfirmMerge(category)}
                    >
                      <span className="font-semibold">{category}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({groupedItems[category]?.length || 0} items)
                      </span>
                    </Button>
                  ))}
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleConfirmMerge('📦 Unassigned')}
                >
                  <span className="font-semibold">📦 Unassigned</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    ({groupedItems['📦 Unassigned']?.length || 0} items)
                  </span>
                </Button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setMergeDialogOpen(false);
              setSourceCategoryForMerge(null);
            }}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Move Dialog */}
      <Dialog open={bulkMoveDialogOpen} onOpenChange={setBulkMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Selected Items</DialogTitle>
            <DialogDescription>
              Select the target category to move {selectedItems.size} selected item(s) to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="max-h-60 overflow-y-auto space-y-2">
              {sortedCategories.map(category => (
                <Button
                  key={category}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleBulkMove(category)}
                >
                  <span className="font-semibold">{category}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    ({groupedItems[category]?.length || 0} items)
                  </span>
                </Button>
              ))}
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleBulkMove('📦 Unassigned')}
              >
                <span className="font-semibold">📦 Unassigned</span>
                <span className="text-sm text-muted-foreground ml-2">
                  ({groupedItems['📦 Unassigned']?.length || 0} items)
                </span>
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBulkMoveDialogOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MenuEditor;
