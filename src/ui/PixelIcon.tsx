import type { ReactElement } from 'react';

/**
 * Pixel-art icons drawn from tiny bitmaps.
 * '#' = main colour (currentColor unless overridden), 'o' = dark, 'w' = light, '.' = transparent
 */
const ICONS = {
  today: [
    '............',
    '.##########.',
    '.#........#.',
    '.#.##.###.#.',
    '.#.##.....#.',
    '.#........#.',
    '.#.##.###.#.',
    '.#.##.....#.',
    '.#........#.',
    '.#.##.###.#.',
    '.##########.',
    '............',
  ],
  hero: [
    '....####....',
    '...######...',
    '..########..',
    '..#......#..',
    '..#.##.#.#..',
    '..########..',
    '...######...',
    '....####....',
    '..########..',
    '.##########.',
    '.##########.',
    '.##########.',
  ],
  shop: [
    '............',
    '............',
    '..########..',
    '.#........#.',
    '.#........#.',
    '.##########.',
    '.#...##...#.',
    '.#...##...#.',
    '.#........#.',
    '.##########.',
    '............',
    '............',
  ],
  stats: [
    '............',
    '.........##.',
    '.........##.',
    '......##.##.',
    '......##.##.',
    '...##.##.##.',
    '...##.##.##.',
    '##.##.##.##.',
    '##.##.##.##.',
    '##.##.##.##.',
    '############',
    '............',
  ],
  more: [
    '............',
    '............',
    '............',
    '............',
    '............',
    '.##..##..##.',
    '.##..##..##.',
    '............',
    '............',
    '............',
    '............',
    '............',
  ],
  moon: [
    '...####..',
    '..####...',
    '.####....',
    '.###.....',
    '.###.....',
    '.###.....',
    '.####....',
    '..####...',
    '...####..',
  ],
  coin: [
    '..oooo..',
    '.o####o.',
    'o#ww###o',
    'o#w####o',
    'o######o',
    'o######o',
    '.o####o.',
    '..oooo..',
  ],
  heart: [
    '.oo...oo.',
    'o##o.o##o',
    'o#w#o###o',
    'o#######o',
    '.o#####o.',
    '..o###o..',
    '...o#o...',
    '....o....',
  ],
  undo: [
    '...#......',
    '..##......',
    '.#######..',
    '..##....#.',
    '...#.....#',
    '.........#',
    '.........#',
    '........#.',
    '...#####..',
    '..........',
  ],
  close: [
    '##....##',
    '###..###',
    '.######.',
    '..####..',
    '..####..',
    '.######.',
    '###..###',
    '##....##',
  ],
  grip: ['##.##', '##.##', '.....', '##.##', '##.##', '.....', '##.##', '##.##'],
  check: [
    '.........##',
    '........###',
    '.......###.',
    '##....###..',
    '###..###...',
    '.#####.....',
    '..###......',
  ],
  skull: [
    '..######..',
    '.########.',
    '##########',
    '#..####..#',
    '#..####..#',
    '####..####',
    '.########.',
    '..#.##.#..',
    '..######..',
  ],
  sword: [
    '.......ww.',
    '......w#w.',
    '.....w#w..',
    '....w#w...',
    '.o.w#w....',
    '..o#w.....',
    '..oo......',
    '.o..o.....',
    'o.........',
  ],
  bolt: [
    '....####',
    '...####.',
    '..####..',
    '.#######',
    '....###.',
    '...###..',
    '..###...',
    '.##.....',
    '#.......',
  ],
  star: [
    '....#....',
    '....#....',
    '...###...',
    '#########',
    '.#######.',
    '..#####..',
    '..##.##..',
    '.##...##.',
    '.#.....#.',
  ],
  speaker: [
    '....#...#..',
    '...##....#.',
    '#####.#...#',
    '#####..#..#',
    '#####..#..#',
    '#####.#...#',
    '...##....#.',
    '....#...#..',
  ],
  speakerOff: [
    '....#......',
    '...##......',
    '#####.#...#',
    '#####..#.#.',
    '#####...#..',
    '#####..#.#.',
    '...##.#...#',
    '....#......',
  ],
} as const;

export type IconName = keyof typeof ICONS;

const DEFAULT_COLORS: Partial<Record<IconName, { main: string; dark: string; light: string }>> = {
  coin: { main: '#e8b33a', dark: '#8a5a12', light: '#fff1b8' },
  moon: { main: '#f4e9b0', dark: '#8a8460', light: '#ffffff' },
  heart: { main: '#d6453d', dark: '#5e1410', light: '#ffb3a8' },
  sword: { main: '#c9d1d9', dark: '#c08a2a', light: '#ffffff' },
  bolt: { main: '#8fd0ff', dark: '#2a5a8a', light: '#ffffff' },
  star: { main: '#ffd84a', dark: '#8a5a12', light: '#fff1b8' },
};

/** Multi-colour bitmap sprite (placeholder art until the real sprites arrive in Phase 3) */
export function PixelSprite({
  rows,
  palette,
  scale = 4,
  className,
}: {
  rows: readonly string[];
  palette: Record<string, string>;
  scale?: number;
  className?: string;
}) {
  const w = rows[0].length;
  const h = rows.length;
  const rects: ReactElement[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const fill = palette[row[x]];
      if (fill) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} />);
    }
  });
  return (
    <svg className={className} width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden>
      {rects}
    </svg>
  );
}

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
}

export function PixelIcon({ name, size = 20, className, title }: Props) {
  const rows = ICONS[name];
  const w = rows[0].length;
  const h = rows.length;
  const colors = DEFAULT_COLORS[name];
  const rects: ReactElement[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === '.') continue;
      const fill =
        c === '#' ? colors?.main ?? 'currentColor' : c === 'o' ? colors?.dark ?? 'rgba(0,0,0,.55)' : colors?.light ?? '#fff';
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} />);
    }
  });
  return (
    <svg
      className={className}
      width={(size * w) / Math.max(w, h)}
      height={(size * h) / Math.max(w, h)}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {rects}
    </svg>
  );
}
