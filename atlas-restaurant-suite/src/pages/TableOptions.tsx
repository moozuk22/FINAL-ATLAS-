import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Utensils, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRestaurant } from '@/context/RestaurantContext';
import { supabase } from '@/lib/supabase';

const TableOptions: React.FC = () => {
  const { tableNumber } = useParams();
  const navigate = useNavigate();
  const { getDailyMenuItems } = useRestaurant();
  const [checkingDailyMenu, setCheckingDailyMenu] = useState(true);
  const [hasDailyMenu, setHasDailyMenu] = useState(false);
  
  // Ref to store the latest checkDailyMenu function for subscription
  const checkDailyMenuRef = useRef<() => Promise<void>>();

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

  // Update ref whenever checkDailyMenu changes
  useEffect(() => {
    checkDailyMenuRef.current = checkDailyMenu;
  }, [checkDailyMenu]);

  // Initial load on mount
  useEffect(() => {
    checkDailyMenu();
  }, [checkDailyMenu]);

  // Real-time subscription for daily_menu_assignments changes
  // This ensures TableOptions reacts instantly to daily menu changes without intervals
  useEffect(() => {
    // Helper function to call the latest checkDailyMenu
    const recheckDailyMenu = () => {
      if (checkDailyMenuRef.current) {
        checkDailyMenuRef.current();
      }
    };

    const dailyMenuSubscription = supabase
      .channel('table_options_daily_menu')
      .on('postgres_changes',
        { 
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public', 
          table: 'daily_menu_assignments' 
        },
        (payload) => {
          console.log('Real-time daily_menu_assignments change in TableOptions:', payload.eventType);
          // Re-check daily menu when changes occur
          recheckDailyMenu();
        }
      )
      .subscribe((status) => {
        console.log('📡 TableOptions daily menu subscription status:', status);
      });

    return () => {
      supabase.removeChannel(dailyMenuSubscription);
    };
  }, []); // Empty dependency array - subscription should only be created once

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
