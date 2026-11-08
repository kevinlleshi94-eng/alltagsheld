import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './styles/global.css';
import './styles/shop.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installAudioUnlock } from './audio/sfx';
import { ensureInitialized } from './db/repo';

async function boot() {
  const root = createRoot(document.getElementById('root')!);
  try {
    await ensureInitialized();
  } catch (e) {
    console.error(e);
    root.render(
      <div className="fatal">
        <h1>Speicher nicht verfügbar</h1>
        <p>Die App konnte ihre Daten nicht laden. Bitte nicht im privaten Modus öffnen und Safari neu starten.</p>
        <pre>{String(e)}</pre>
      </div>,
    );
    return;
  }
  // ask the browser not to evict our IndexedDB data
  navigator.storage?.persist?.().catch(() => undefined);
  installAudioUnlock();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

boot();
