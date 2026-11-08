/**
 * npm run simulate  – balancing report (SPEC 11)
 * Options: --days=240 --seeds=7 --markdown
 */
import { BALANCE } from '../src/game/balance';
import { positionFromIndex } from '../src/game/combat';
import { median, simulateDetailed, type SimConfig, type SimResult } from '../src/game/simulation';
import { areaName } from '../src/game/world';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const days = Number(args.days ?? 240);
const seeds = Number(args.seeds ?? BALANCE.simulation.seeds);
const markdown = args.markdown === 'true';
const checkpoints = [1, 7, 30, 90, 180, 270, 365].filter((d) => d <= days);
if (!checkpoints.includes(days)) checkpoints.push(days);

type Scenario = { label: string } & Pick<SimConfig, 'fulfillment' | 'missedPerDay' | 'habitMinusPerDay' | 'profile'>;
/** the user's volume (15 dailies + 10 habits) at several fulfilment levels + the "5 missed + 2× −" scenario */
const scenarios: Scenario[] = [
  { label: '100 %', fulfillment: 1 },
  { label: '90 %', fulfillment: 0.9 },
  { label: '80 %', fulfillment: 0.8 },
  { label: '50 %', fulfillment: 0.5 },
  { label: '5 verpasst + 2× „−“ (Startaufgaben)', fulfillment: 0.6, missedPerDay: 5, habitMinusPerDay: 2, profile: 'seed' },
];

const fmtStage = (index: number) => {
  const p = positionFromIndex(Math.round(index), BALANCE);
  return `${p.round > 1 ? `R${p.round} ` : ''}${areaName(p.area)} ${p.stage}`;
};

type Row = Record<string, string>;
const rows: Row[] = [];
const milestoneRows: Row[] = [];
const started = Date.now();

for (const sc of scenarios) {
  const { label, ...cfg } = sc;
  const runs: SimResult[] = [];
  for (let s = 0; s < seeds; s++) runs.push(simulateDetailed({ ...cfg, days, seed: 1000 + s, balance: BALANCE, checkpoints }));
  for (let ci = 0; ci < checkpoints.length; ci++) {
    const snaps = runs.map((r) => r.snapshots[ci]);
    const dragonDays = snaps.map((s) => s.dragonDay).filter((d): d is number => d !== null);
    rows.push({
      Erfüllung: label,
      Tag: String(checkpoints[ci]),
      Level: String(median(snaps.map((s) => s.level))),
      'Höchste Stufe': fmtStage(median(snaps.map((s) => s.highestIndex))),
      Tode: String(median(snaps.map((s) => s.deaths))),
      Gold: String(Math.round(median(snaps.map((s) => s.gold)))),
      Truhen: String(median(snaps.map((s) => s.chests))),
      'Attribute S/T/L': (() => {
        const m = (k: 'strength' | 'speed' | 'life') => Math.round(median(snaps.map((s) => s.attributes[k])));
        return `${m('strength')}/${m('speed')}/${m('life')}`;
      })(),
      Ausrüstung: String(Math.round(median(snaps.map((s) => s.itemPower)))),
      'Erschöpft-Tage': String(median(snaps.map((s) => s.exhaustedDays))),
      Drache: dragonDays.length ? `Tag ${median(dragonDays)} (${dragonDays.length}/${seeds})` : '–',
    });
  }
  // milestones: first victory over the bosses of round 1 (only for the user profile)
  if (!cfg.profile) {
    const goals: [number, number, string][] = [
      [1, 10, 'Boss Stufe 10'],
      [1, 20, 'Boss Stufe 20'],
      ...Array.from({ length: BALANCE.combat.areaCount }, (_, i): [number, number, string] => [
        i + 1,
        BALANCE.combat.stagesPerArea,
        i + 1 === BALANCE.combat.areaCount ? 'Drache' : `${areaName(i + 1)} geschafft`,
      ]),
    ];
    for (const [area, stage, name] of goals) {
      const ms = runs.map((r) => r.milestones.find((m) => m.area === area && m.stage === stage)).filter((m) => m !== undefined);
      milestoneRows.push({
        Erfüllung: label,
        Meilenstein: name,
        Tag: ms.length > seeds / 2 ? String(median(ms.map((m) => m.day))) : '–',
        Level: ms.length > seeds / 2 ? String(median(ms.map((m) => m.level))) : '–',
        'Truhen bis dahin': ms.length > seeds / 2 ? String(median(ms.map((m) => m.chests))) : '–',
        Läufe: `${ms.length}/${seeds}`,
      });
    }
  }
}

function print(table: Row[]) {
  const headers = Object.keys(table[0]);
  if (markdown) {
    console.log(`| ${headers.join(' | ')} |`);
    console.log(`|${headers.map(() => '---').join('|')}|`);
    for (const r of table) console.log(`| ${headers.map((h) => r[h]).join(' | ')} |`);
    return;
  }
  const widths = headers.map((h) => Math.max(h.length, ...table.map((r) => r[h].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  console.log(line(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  let last = '';
  for (const r of table) {
    if (last && r['Erfüllung'] !== last) console.log('');
    last = r['Erfüllung'];
    console.log(line(headers.map((h) => r[h])));
  }
}

console.log('Verlauf\n');
print(rows);
console.log('\nMeilensteine (dein Profil: 15 Aufgaben mit 25 Punkten + 10 Gewohnheiten)\n');
print(milestoneRows);
console.log(
  `\n${seeds} Durchläufe je Szenario (Median), App-Zeit ${BALANCE.simulation.appSecondsPerDay} s/Tag · ${((Date.now() - started) / 1000).toFixed(1)} s`,
);
