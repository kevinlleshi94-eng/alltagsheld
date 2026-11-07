/**
 * npm run simulate  – balancing report (SPEC 11)
 * Options: --days=180 --seeds=7 --markdown
 */
import { BALANCE } from '../src/game/balance';
import { positionFromIndex } from '../src/game/combat';
import { median, simulate, type SimSnapshot } from '../src/game/simulation';
import { areaName } from '../src/game/world';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const days = Number(args.days ?? 180);
const seeds = Number(args.seeds ?? BALANCE.simulation.seeds);
const markdown = args.markdown === 'true';
const checkpoints = [1, 7, 30, 90, 180, 270, 365].filter((d) => d <= days);
if (!checkpoints.includes(days)) checkpoints.push(days);
/** fulfilment levels + the "5 missed dailies and 2 '−' habit taps per day" scenario */
const scenarios: { label: string; fulfillment: number; missedPerDay?: number; habitMinusPerDay?: number }[] = [
  { label: '50 %', fulfillment: 0.5 },
  { label: '75 %', fulfillment: 0.75 },
  { label: '90 %', fulfillment: 0.9 },
  { label: '100 %', fulfillment: 1 },
  { label: '5 verpasst + 2× „−“', fulfillment: 0.6, missedPerDay: 5, habitMinusPerDay: 2 },
];

const fmtStage = (index: number) => {
  const p = positionFromIndex(Math.round(index), BALANCE);
  return `${p.round > 1 ? `R${p.round} ` : ''}${areaName(p.area)} ${p.stage}`;
};

type Row = Record<string, string>;
const rows: Row[] = [];
const started = Date.now();

for (const sc of scenarios) {
  const runs: SimSnapshot[][] = [];
  for (let s = 0; s < seeds; s++) runs.push(simulate({ ...sc, days, seed: 1000 + s, balance: BALANCE, checkpoints }));
  for (let ci = 0; ci < checkpoints.length; ci++) {
    const snaps = runs.map((r) => r[ci]);
    const dragonDays = snaps.map((s) => s.dragonDay).filter((d): d is number => d !== null);
    rows.push({
      Erfüllung: sc.label,
      Tag: String(checkpoints[ci]),
      Level: String(median(snaps.map((s) => s.level))),
      'Höchste Stufe': fmtStage(median(snaps.map((s) => s.highestIndex))),
      'Aktuell': fmtStage(median(snaps.map((s) => (s.round - 1) * 200 + (s.area - 1) * 25 + (s.stage - 1)))),
      Tode: String(median(snaps.map((s) => s.deaths))),
      Gold: String(Math.round(median(snaps.map((s) => s.gold)))),
      'Attribute S/G/L': (() => {
        const m = (k: 'strength' | 'speed' | 'life') => Math.round(median(snaps.map((s) => s.attributes[k])));
        return `${m('strength')}/${m('speed')}/${m('life')}`;
      })(),
      Ausrüstung: String(Math.round(median(snaps.map((s) => s.itemPower)))),
      'Erschöpft-Tage': String(median(snaps.map((s) => s.exhaustedDays))),
      Drache: dragonDays.length ? `Tag ${median(dragonDays)} (${dragonDays.length}/${seeds})` : '–',
    });
  }
}

const headers = Object.keys(rows[0]);
if (markdown) {
  console.log(`| ${headers.join(' | ')} |`);
  console.log(`|${headers.map(() => '---').join('|')}|`);
  for (const r of rows) console.log(`| ${headers.map((h) => r[h]).join(' | ')} |`);
} else {
  const widths = headers.map((h) => Math.max(h.length, ...rows.map((r) => r[h].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  console.log(line(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  let last = '';
  for (const r of rows) {
    if (last && r['Erfüllung'] !== last) console.log('');
    last = r['Erfüllung'];
    console.log(line(headers.map((h) => r[h])));
  }
}
console.log(`\n${seeds} Durchläufe je Erfüllungsgrad (Median), App-Zeit ${BALANCE.simulation.appSecondsPerDay} s/Tag · ${((Date.now() - started) / 1000).toFixed(1)} s`);
