import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRestaurant } from '@/context/RestaurantContext';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Edit2, Check, X } from 'lucide-react';
import { MenuItem } from '@/context/RestaurantContext';

interface DailyMenuEditorProps {
  open: boolean;
  onClose: () => void;
}

const DailyMenuEditor: React.FC<DailyMenuEditorProps> = ({ open, onClose }) => {
  const { menuItems, getDailyMenuItems, setDailyMenuItems } = useRestaurant();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyItems, setDailyItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Load daily menu items for selected date
  const loadDailyMenu = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getDailyMenuItems(selectedDate);
      setDailyItems(items);
    } catch (error) {
      console.error('Error loading daily menu:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно зареждане на меню за деня',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedDate, getDailyMenuItems, toast]);

  useEffect(() => {
    if (open) {
      loadDailyMenu();
    }
  }, [open, loadDailyMenu]);

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

  const handleRemove = async (itemId: string) => {
    try {
      const currentItemIds = dailyItems.map(i => i.id);
      const newItemIds = currentItemIds.filter(id => id !== itemId);
      await setDailyMenuItems(selectedDate, newItemIds);
      await loadDailyMenu();
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

  const handleStartEdit = (item: MenuItem) => {
    setEditingItem(item.id);
    setEditText(item.name);
  };

  const handleSaveEdit = async (itemId: string) => {
    // This would require updating the menu item name in the database
    // For now, we'll just show a message
    toast({
      title: 'Информация',
      description: 'Редактирането на името изисква обновяване в меню редактора',
    });
    setEditingItem(null);
    setEditText('');
  };

  const availableItems = useMemo(() => {
    const dailyItemIds = dailyItems.map(i => i.id);
    return menuItems.filter(item => !dailyItemIds.includes(item.id));
  }, [menuItems, dailyItems]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Меню за деня</DialogTitle>
          <DialogDescription>
            Изберете дата и управлявайте менюто за конкретния ден
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 mb-4">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          <Button onClick={loadDailyMenu} disabled={loading} variant="outline">
            Зареди
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
          {/* All Items Column */}
          <div className="border rounded-lg p-4 overflow-y-auto">
            <h3 className="font-semibold mb-3">Всички артикули</h3>
            {loading ? (
              <p className="text-muted-foreground text-sm">Зареждане...</p>
            ) : (
              <div className="space-y-2">
                {availableItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 border rounded hover:bg-secondary/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.price.toFixed(2)} EUR</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddToDaily(item)}
                      className="ml-2"
                    >
                      Добави
                    </Button>
                  </div>
                ))}
                {availableItems.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    Всички артикули са в менюто за деня
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Daily Menu Items Column */}
          <div className="border rounded-lg p-4 overflow-y-auto">
            <h3 className="font-semibold mb-3">Меню за деня</h3>
            {loading ? (
              <p className="text-muted-foreground text-sm">Зареждане...</p>
            ) : (
              <div className="space-y-2">
                {dailyItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 border rounded hover:bg-secondary/50"
                  >
                    <div className="flex-1 min-w-0">
                      {editingItem === item.id ? (
                        <Input
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                      ) : (
                        <>
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.price.toFixed(2)} EUR</p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {editingItem === item.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSaveEdit(item.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingItem(null);
                              setEditText('');
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEdit(item)}
                            className="h-8 w-8 p-0"
                            title="Редактирай"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemove(item.id)}
                            className="h-8 w-8 p-0 text-destructive"
                            title="Премахни"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {dailyItems.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    Няма артикули в менюто за деня
                  </p>
                )}
              </div>
            )}
          </div>
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

export default DailyMenuEditor;
