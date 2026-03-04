import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Utensils, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRestaurant } from '@/context/RestaurantContext';

const TableOptions: React.FC = () => {
  const { tableNumber } = useParams();
  const navigate = useNavigate();
  const { getDailyMenuItems } = useRestaurant();
  const [checkingDailyMenu, setCheckingDailyMenu] = useState(true);
  const [hasDailyMenu, setHasDailyMenu] = useState(false);

  // Convert /t/1 to Table_01 format
  const getTableId = () => {
    if (tableNumber) {
      const num = parseInt(tableNumber);
      if (!isNaN(num) && num >= 1 && num <= 10) {
        return `Table_${String(num).padStart(2, '0')}`;
      }
    }
    return 'Table_01';
  };

  const tableId = getTableId();

  const checkDailyMenu = useCallback(async () => {
    setCheckingDailyMenu(true);
    const items = await getDailyMenuItems(); // today + is_visible=true
    setHasDailyMenu(items.length > 0);
    setCheckingDailyMenu(false);
  }, [getDailyMenuItems]);

  // Initial load and re-check when getDailyMenuItems changes
  // Real-time subscription for daily_menu_assignments in RestaurantContext triggers loadTableSessions()
  // which updates the context, but getDailyMenuItems is a function that queries the database
  // So we need to re-check periodically or when component mounts
  useEffect(() => {
    checkDailyMenu();
    
    // Also set up a periodic check every 5 seconds to catch real-time changes
    // This ensures TableOptions reacts to daily menu changes even if getDailyMenuItems doesn't change
    const interval = setInterval(() => {
      checkDailyMenu();
    }, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, [checkDailyMenu]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold text-gold tracking-wide mb-2">
            ATLAS HOUSE
          </h1>
          <p className="text-muted-foreground text-lg">
            {tableId.replace('_', ' ')}
          </p>
        </div>

        {/* Options Cards */}
        <div className="space-y-4">
          {/* Menu Option (only if Daily Menu exists) */}
          {checkingDailyMenu ? (
            <div className="w-full card-premium rounded-xl p-6 border border-border/50 opacity-80">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Проверка на меню за деня...</span>
              </div>
            </div>
          ) : hasDailyMenu ? (
            <Button
              onClick={() => navigate(`/menu?table=${tableId}`)}
              className="w-full card-premium rounded-xl p-6 hover:border-primary transition-all group h-auto"
              variant="ghost"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Utensils className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-display text-lg font-semibold">🍽️ Меню</h3>
                    <p className="text-sm text-muted-foreground">Виж менюто</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Button>
          ) : (
            <div className="w-full card-premium rounded-xl p-6 border border-border/50 opacity-60">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center">
                  <Utensils className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <h3 className="font-display text-lg font-semibold">🍽️ Меню</h3>
                  <p className="text-sm text-muted-foreground">Няма меню за деня</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default TableOptions;
