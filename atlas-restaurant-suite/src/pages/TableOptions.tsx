import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Utensils, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TableOptions: React.FC = () => {
  const { tableNumber } = useParams();
  const navigate = useNavigate();

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
          {/* Menu Option */}
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

        </div>
      </div>
    </div>
  );
};

export default TableOptions;
