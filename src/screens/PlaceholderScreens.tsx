import { Section } from '../ui/controls';

export function StatsScreen() {
  return (
    <div className="screen">
      <Section title="Statistik">
        <p className="muted coming">
          Die Statistik kommt in Phase 5. Das Tageslog wird bereits lückenlos gespeichert – deine Daten gehen also nicht
          verloren.
        </p>
      </Section>
    </div>
  );
}
