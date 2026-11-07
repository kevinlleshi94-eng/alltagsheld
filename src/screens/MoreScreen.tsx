import { useState } from 'react';
import { Section } from '../ui/controls';
import { ManageTasksScreen } from './ManageTasksScreen';
import { SettingsScreen } from './SettingsScreen';

type Page = 'menu' | 'tasks' | 'settings' | 'achievements';

const TITLES: Record<Exclude<Page, 'menu'>, string> = {
  tasks: 'Aufgaben verwalten',
  settings: 'Einstellungen',
  achievements: 'Erfolge',
};

export function MoreScreen() {
  const [page, setPage] = useState<Page>('menu');

  if (page !== 'menu') {
    return (
      <div className="subpage">
        <div className="subpage-head">
          <button className="btn btn-small" onClick={() => setPage('menu')}>
            ‹ Zurück
          </button>
          <h2 className="display">{TITLES[page]}</h2>
        </div>
        {page === 'tasks' && <ManageTasksScreen />}
        {page === 'settings' && <SettingsScreen />}
        {page === 'achievements' && (
          <div className="screen">
            <p className="muted coming">Erfolge kommen in Phase 5.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <Section title="Mehr">
        <ul className="list menu-list">
          <li>
            <button className="menu-item" onClick={() => setPage('achievements')}>
              Erfolge <span className="muted">›</span>
            </button>
          </li>
          <li>
            <button className="menu-item" onClick={() => setPage('tasks')}>
              Aufgaben verwalten <span className="muted">›</span>
            </button>
          </li>
          <li>
            <button className="menu-item" onClick={() => setPage('settings')}>
              Einstellungen <span className="muted">›</span>
            </button>
          </li>
        </ul>
      </Section>
    </div>
  );
}
