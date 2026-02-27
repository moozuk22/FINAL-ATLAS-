import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRestaurant } from '@/context/RestaurantContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download } from 'lucide-react';

interface RevenueReportProps {
  open: boolean;
  onClose: () => void;
}

const RevenueReport: React.FC<RevenueReportProps> = ({ open, onClose }) => {
  const { getRevenueReport } = useRestaurant();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<{ total: number; orderCount: number; date: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const revenueReport = await getRevenueReport(selectedDate);
      setReport(revenueReport);
      toast({
        title: '✅ Репортът е генериран',
        description: `Оборот за ${selectedDate}`,
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно генериране на репорт',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!report) return;

    const csvContent = `Дата,Брой поръчки,Общ оборот (EUR)\n${report.date},${report.orderCount},${report.total.toFixed(2)}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `revenue_report_${report.date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: '✅ Изтеглено',
      description: 'Репортът е изтеглен',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Оборот</DialogTitle>
          <DialogDescription>
            Генерирайте репорт за оборот за конкретна дата
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleGenerateReport} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Генериране...
                </>
              ) : (
                'Генерирай'
              )}
            </Button>
          </div>

          {report && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Дата:</span>
                <span className="font-semibold">{report.date}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Брой поръчки:</span>
                <span className="font-semibold">{report.orderCount}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-semibold">Общ оборот:</span>
                <span className="font-display text-xl font-bold text-primary">
                  {report.total.toFixed(2)} EUR
                </span>
              </div>
              <Button
                onClick={handleDownload}
                variant="outline"
                className="w-full mt-4"
              >
                <Download className="h-4 w-4 mr-2" />
                Изтегли като CSV
              </Button>
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

export default RevenueReport;
