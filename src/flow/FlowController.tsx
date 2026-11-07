import { useEffect, useRef } from 'react';
import { BALANCE } from '../game/balance';
import { clock } from '../lib/clock';
import { useStore } from '../state/store';
import { flow } from '../state/ui';
import { finishReview, goToTodayPromptOrMain, startFlow } from './flowLogic';
import { ReviewDialog } from './ReviewDialog';
import { SummaryDialog } from './SummaryDialog';
import { TodayPrompt } from './TodayPrompt';

/** Watches app open / resume / midnight / dev clock changes and renders the current flow step */
export function FlowController() {
  const state = useStore(flow);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    startFlow('open');
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        return;
      }
      const away = hiddenAt.current === null ? 0 : Date.now() - hiddenAt.current;
      hiddenAt.current = null;
      startFlow(away >= BALANCE.app.todayPromptMinHiddenMs ? 'resume' : 'tick');
    };
    document.addEventListener('visibilitychange', onVisibility);
    const interval = setInterval(() => startFlow('tick'), BALANCE.app.dayChangeCheckIntervalMs);
    const unsubscribe = clock.subscribe(() => startFlow('tick'));
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  switch (state.phase) {
    case 'review':
      return (
        <ReviewDialog
          key={state.date}
          date={state.date}
          olderDays={state.olderDays}
          onDone={(input) => finishReview(input)}
          onDismiss={() => finishReview(null)}
        />
      );
    case 'summary':
      return <SummaryDialog result={state.result} onClose={() => goToTodayPromptOrMain()} />;
    case 'todayPrompt':
      return <TodayPrompt taskIds={state.taskIds} onClose={() => flow.set({ phase: 'main' })} />;
    default:
      return null;
  }
}
