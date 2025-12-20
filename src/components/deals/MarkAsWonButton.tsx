'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface MarkAsWonButtonProps {
  dealId: string;
  dealName: string;
  dealValue?: number;
  currentStage: string;
  className?: string;
  variant?: 'button' | 'icon';
  onSuccess?: () => void;
}

export function MarkAsWonButton({
  dealId,
  dealName,
  dealValue,
  currentStage,
  className,
  variant = 'button',
  onSuccess,
}: MarkAsWonButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const triggerCelebration = useCallback(() => {
    // Fire confetti from the left
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.1, y: 0.6 },
      colors: ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#FFD700', '#FFA500'],
    });

    // Fire confetti from the right
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.9, y: 0.6 },
      colors: ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#FFD700', '#FFA500'],
    });

    // Center burst after a small delay
    setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { x: 0.5, y: 0.5 },
        colors: ['#10B981', '#34D399', '#6EE7B7', '#FFD700', '#FFA500', '#FF6B6B'],
      });
    }, 200);

    // Trophy rain
    setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 120,
        origin: { x: 0.5, y: 0.2 },
        gravity: 0.8,
        colors: ['#FFD700', '#FFC107', '#FF9800'],
      });
    }, 400);
  }, []);

  const handleMarkAsWon = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (currentStage === 'closed_won') {
      return; // Already won
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('deals')
        .update({
          stage: 'closed_won',
          stage_entered_at: new Date().toISOString(),
          closed_at: new Date().toISOString(),
        })
        .eq('id', dealId);

      if (error) {
        console.error('Failed to mark deal as won:', error);
        return;
      }

      // Show celebration
      setShowCelebration(true);
      triggerCelebration();

      // Call success callback
      onSuccess?.();

      // Refresh the page after celebration
      setTimeout(() => {
        router.refresh();
      }, 2000);

    } catch (err) {
      console.error('Error marking deal as won:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show if already won
  if (currentStage === 'closed_won') {
    return null;
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={handleMarkAsWon}
        disabled={isLoading}
        className={cn(
          'inline-flex items-center justify-center h-8 w-8 rounded-lg',
          'bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700',
          'transition-colors duration-200',
          isLoading && 'opacity-50 cursor-not-allowed',
          className
        )}
        title="Mark as Won"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trophy className="h-4 w-4" />
        )}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={handleMarkAsWon}
        disabled={isLoading}
        className={cn(
          'inline-flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-xl',
          'bg-green-600 text-white hover:bg-green-700',
          'transition-all duration-200',
          'hover:shadow-lg hover:shadow-green-200',
          isLoading && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trophy className="h-4 w-4" />
        )}
        Mark as Won
      </button>

      {/* Celebration Overlay */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 text-center animate-bounce-in pointer-events-auto">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Deal Won!
            </h2>
            <p className="text-gray-600 mb-1">{dealName}</p>
            {dealValue && (
              <p className="text-2xl font-bold text-green-600">
                ${dealValue.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes bounce-in {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
          }
        }
        .animate-bounce-in {
          animation: bounce-in 0.6s ease-out;
        }
      `}</style>
    </>
  );
}
