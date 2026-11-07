import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { configureSfx } from './audio/sfx';
import { BattleView } from './battle/BattleView';
import { EventPresenter } from './flow/EventPresenter';
import { FlowController } from './flow/FlowController';
import { MoreScreen } from './screens/MoreScreen';
import { CharacterScreen, ShopScreen, StatsScreen } from './screens/PlaceholderScreens';
import { TodayScreen } from './screens/TodayScreen';
import { useStore } from './state/store';
import { activeTab } from './state/ui';
import { useSettings } from './state/hooks';
import { FloatingLayer, StatusBar, TabBar, Toaster } from './ui/layout';

function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="update-banner">
      <span>Neue Version verfügbar</span>
      <button className="btn btn-small btn-primary" onClick={() => updateServiceWorker(true)}>
        Aktualisieren
      </button>
      <button className="btn btn-small" onClick={() => setNeedRefresh(false)}>
        Später
      </button>
    </div>
  );
}

/** keeps the sound module in sync with the settings */
function useSoundSettings() {
  const settings = useSettings();
  const enabled = settings?.soundEnabled ?? true;
  const volume = settings?.volume ?? 0.7;
  useEffect(() => configureSfx({ enabled, volume }), [enabled, volume]);
}

export function App() {
  const tab = useStore(activeTab);
  useSoundSettings();
  return (
    <div className="app">
      <BattleView />
      <StatusBar />
      <main className="content" key={tab}>
        {tab === 'today' && <TodayScreen />}
        {tab === 'character' && <CharacterScreen />}
        {tab === 'shop' && <ShopScreen />}
        {tab === 'stats' && <StatsScreen />}
        {tab === 'more' && <MoreScreen />}
      </main>
      <TabBar />
      <UpdateBanner />
      <FlowController />
      <EventPresenter />
      <FloatingLayer />
      <Toaster />
    </div>
  );
}
