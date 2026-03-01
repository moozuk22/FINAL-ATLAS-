import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useRestaurant } from '@/context/RestaurantContext';
import { useToast } from '@/hooks/use-toast';

interface RatingModalProps {
  open: boolean;
  onClose: () => void;
  tableId: string;
  googlePlaceId?: string;
}

const RatingModal: React.FC<RatingModalProps> = ({ open, onClose, tableId, googlePlaceId }) => {
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { submitRating } = useRestaurant();
  const { toast } = useToast();

  const handleRatingClick = async (selectedRating: number) => {
    setRating(selectedRating);
    
    if (selectedRating <= 3) {
      // Show feedback box for ratings 1-3
      setShowFeedback(true);
    } else {
      // For ratings 4-5, show thank you and open Google Reviews
      setSubmitting(true);
      try {
        await submitRating(tableId, selectedRating);
        toast({
          title: 'Благодарим ви от сърце! ❤️',
          description: 'Вашето мнение е много важно за нас',
        });
        
        // Open Google Reviews
        if (googlePlaceId) {
          const googleReviewUrl = `https://search.google.com/local/writereview?placeid=${googlePlaceId}`;
          window.open(googleReviewUrl, '_blank');
        } else {
          // Fallback to general Google search
          const googleReviewUrl = `https://www.google.com/search?q=ATLAS+HOUSE+review`;
          window.open(googleReviewUrl, '_blank');
        }
        
        setTimeout(() => {
          onClose();
          setRating(null);
          setFeedback('');
          setShowFeedback(false);
          setSubmitting(false);
        }, 2000);
      } catch (error) {
        console.error('Error submitting rating:', error);
        toast({
          title: 'Грешка',
          description: 'Неуспешно изпращане на рейтинг',
          variant: 'destructive',
        });
        setSubmitting(false);
      }
    }
  };

  const handleSubmitFeedback = async () => {
    if (!rating) return;
    
    setSubmitting(true);
    try {
      await submitRating(tableId, rating, feedback);
      toast({
        title: 'Благодарим ви за искреността!',
        description: 'Вашето мнение ще ни помогне да се подобрим',
      });
      
      setTimeout(() => {
        onClose();
        setRating(null);
        setFeedback('');
        setShowFeedback(false);
        setSubmitting(false);
      }, 2000);
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно изпращане на рейтинг',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  const emojis = [
    { value: 1, emoji: '😠', label: 'Лошо' },
    { value: 2, emoji: '🙁', label: 'Недостатъчно' },
    { value: 3, emoji: '🙂', label: 'Приемливо' },
    { value: 4, emoji: '😍', label: 'Добро' },
    { value: 5, emoji: '♥', label: 'Уникално' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md mx-auto p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3">
          <DialogTitle className="text-center text-lg sm:text-xl font-bold">
            Оценете ни
          </DialogTitle>
          <DialogDescription className="text-center text-sm sm:text-base mt-2">
            Помогнете ни да се подобрим
          </DialogDescription>
        </DialogHeader>

        {!showFeedback ? (
          <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
            <div className="flex justify-center gap-2 sm:gap-3 flex-wrap">
              {emojis.map(({ value, emoji, label }) => (
                <button
                  key={value}
                  onClick={() => handleRatingClick(value)}
                  disabled={submitting}
                  className={`flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl transition-all touch-manipulation min-w-[60px] sm:min-w-[70px] ${
                    rating === value
                      ? 'bg-primary/20 scale-105 sm:scale-110 ring-2 ring-primary/50'
                      : 'hover:bg-secondary/50 active:scale-95'
                  } ${submitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="text-3xl sm:text-4xl">{emoji}</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold mb-1">Благодарим!</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Как бихте описали престоя си?
              </p>
            </div>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Вашето мнение..."
              className="min-h-[80px] sm:min-h-[100px] text-sm sm:text-base"
              disabled={submitting}
            />
            <div className="flex gap-2 sm:gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowFeedback(false);
                  setRating(null);
                }}
                disabled={submitting}
                className="flex-1 h-10 sm:h-11 text-sm font-semibold touch-manipulation"
              >
                Назад
              </Button>
              <Button
                onClick={handleSubmitFeedback}
                disabled={submitting || !feedback.trim()}
                className="flex-1 h-10 sm:h-11 btn-gold text-sm font-semibold touch-manipulation"
              >
                {submitting ? '...' : 'Изпрати'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RatingModal;
