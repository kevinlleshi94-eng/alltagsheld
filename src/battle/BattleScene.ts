/**
 * The auto-battler scene (SPEC 6). Uses the pure combat engine from
 * src/game/combat.ts and only adds presentation: walking, parallax, hits,
 * damage numbers, particles, retreat, area transitions.
 *
 * Coordinates are in "game pixels" (= art pixels). The browser scales the canvas
 * up by the device pixel ratio with nearest-neighbour, so the art stays crisp (game.ts).
 *
 * Sprites (Phase 3): hero and enemies are composed at runtime from LPC layers and
 * monster sheets (assets/compose.ts). Until a sprite is ready – or if it cannot be
 * loaded – the old pixel placeholders from sprites.ts stand in.
 *
 * Phase 4: epic / legendary equipment gives the hero rising sparkles in the rarity colour.
 */
import * as Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { BALANCE } from '../game/balance';
import {
  enemyForStage,
  nextStage,
  startFight,
  stepFight,
  type EnemyStats,
  type FightEvent,
  type FightResult,
  type FightState,
} from '../game/combat';
import type { VictoryOutcome } from '../game/bossRewards';
import { bestRarity } from '../game/shop';
import type { Rarity, StagePosition } from '../game/types';
import { areaDef, type AreaDef, type EnemyDef } from '../game/world';
import { ENEMY_SPRITES, heroLook, lookKey } from './assets/catalog';
import { composeCharacter, composeMonster, type AnimName, type ComposedSprite } from './assets/compose';
import * as bg from './backgrounds';
import { battleHud, battleInput, battleTimer, samePosition, type BattleCallbacks, type BattleInput } from './bridge';
import * as art from './sprites';
import { CHEST_NAMES, RARITY_COLORS } from '../ui/labels';

type Phase = 'waiting' | 'walkIn' | 'intro' | 'fight' | 'victory' | 'retreat' | 'transition' | 'exit' | 'areaHold';
type Who = 'hero' | 'foe';

const WALK_SPEED = 52; // game px per second (ground layer)
const INTRO_SEC = 1.3;
const FADE_MS = 380;
// area change: hero walks off → slow fade to black → new area's name → fade in
const AREA_EXIT_SEC = 1.8;
const AREA_FADE_MS = 900;
const AREA_HOLD_SEC = 1.5;
/** CSS px at the top of the scene used by stage chip and timer; bosses stay below */
const HUD_CLEAR_PX = 88;
const BOSS_SCALE = 2;
const BOSS_SCALE_MIN = 1.2;
/** bosses never get taller than this share of the scene */
const BOSS_MAX_HEIGHT = 0.46;
/** old 16 px placeholder bitmaps next to ~50 px LPC figures */
const PLACEHOLDER_SCALE = 3;
/** hits land at the impact frame of the swing, not when it starts */
const MAX_HIT_LEAD = 0.24;
const PLACEHOLDER_HIT_LEAD = 0.06;
const HERO_TINT_EXHAUSTED = 0x9aa0b8;

interface Impulse {
  who: Who;
  start: number;
  dur: number;
  amp: number;
}

interface Fighter {
  img: Phaser.GameObjects.Sprite;
  /** composed sprite, null while the placeholder is shown */
  sprite: ComposedSprite | null;
  /** texture key of the composed sprite or placeholder */
  key: string;
  /** boss factor etc. on top of the sprite's own scale */
  extraScale: number;
  anim: AnimName | null;
  attackUntil: number;
}

let bannerId = 0;

export class BattleScene extends Phaser.Scene {
  private readonly cb: BattleCallbacks;
  /** HTML layer above the canvas (damage numbers) */
  private readonly fx: HTMLElement;
  private latest: BattleInput | null = null;
  private unsubscribe: (() => void) | null = null;
  private destroyed = false;

  private phase: Phase = 'waiting';
  private phaseT = 0;
  /** scene clock in seconds (only runs while not paused) */
  private clockT = 0;
  private pos: StagePosition | null = null;
  private area: AreaDef | null = null;
  private enemy: EnemyStats | null = null;
  private fight: FightState | null = null;
  /** fight events wait for the impact frame of the attack animation */
  private pending: { at: number; ev: FightEvent }[] = [];
  /** HP shown in the bars (updated when a hit lands) */
  private shownHp: Record<Who, number> = { hero: 1, foe: 1 };
  private attempts = 0;
  private victory: { done: boolean; result: VictoryOutcome | null } | null = null;
  /** where the DB has (or will have) the hero */
  private expected: StagePosition | null = null;
  private prevInputPos: StagePosition | null = null;
  /** an outside position change arrived during an animation */
  private externalPending = false;
  /** area cleared: where the hero goes after the area transition */
  private pendingArea: { next: StagePosition; roundCleared: boolean } | null = null;
  private lastTimerPush = 0;
  private paused = false;

  // layout
  private W = 0;
  private H = 0;
  private groundY = 0;
  private heroX = 0;
  private enemyX = 0;
  private foeStartX = 0;
  private foeBaseX = 0;
  private heroShift = 0;
  /** hero walks in from the left after an area change */
  private heroStartShift = 0;
  private scroll = 0;
  private impulses: Impulse[] = [];
  private flashUntil: Record<Who, number> = { hero: 0, foe: 0 };

  // display objects
  private layers: bg.Layers | null = null;
  private fighters!: Record<Who, Fighter>;
  private overlay!: Phaser.GameObjects.Graphics;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  /** sparkles around the hero (epic / legendary equipment) */
  private aura!: Phaser.GameObjects.Particles.ParticleEmitter;
  private auraRarity: Rarity | null = null;
  private auraZone = '';
  private webgl = false;

  // sprites
  private readonly sprites = new Map<string, Promise<ComposedSprite | null>>();
  /** look the hero should have (texture key) */
  private heroWanted = '';

  constructor(cb: BattleCallbacks, fx: HTMLElement) {
    super('battle');
    this.cb = cb;
    this.fx = fx;
  }

  // -------------------------------------------------------------------------
  // lifecycle
  // -------------------------------------------------------------------------

  create() {
    this.webgl = this.game.renderer.type === Phaser.WEBGL;
    this.makeCanvas('px', 2, 2, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 2, 2);
    });
    this.makeBitmapTextures('ph-hero', art.HERO, art.HERO_PALETTE);

    const fighter = (): Fighter => ({
      img: this.add.sprite(0, 0, 'ph-hero').setOrigin(0.5, 1).setDepth(5),
      sprite: null,
      key: 'ph-hero',
      extraScale: 1,
      anim: null,
      attackUntil: 0,
    });
    this.fighters = { hero: fighter(), foe: fighter() };
    this.fighters.foe.img.setVisible(false);
    this.overlay = this.add.graphics().setDepth(4);
    this.sparks = this.add
      .particles(0, 0, 'px', {
        speed: { min: 40, max: 120 },
        angle: { min: 200, max: 340 },
        lifespan: { min: 240, max: 520 },
        gravityY: 300,
        scale: { start: 1.5, end: 0.5 },
        emitting: false,
      })
      .setDepth(7);
    this.aura = this.add
      .particles(0, 0, 'px', {
        lifespan: { min: 700, max: 1200 },
        speedY: { min: -26, max: -10 },
        speedX: { min: -5, max: 5 },
        scale: { start: 1.5, end: 0.5 },
        alpha: { start: 1, end: 0.1 },
        frequency: 120,
        emitting: false,
      })
      .setDepth(6);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.unsubscribe = battleInput.subscribe(() => this.onInput());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
    this.onInput();
  }

  private cleanup() {
    this.destroyed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    battleTimer.set({ active: false, left: 0, total: 0 });
    this.fx.replaceChildren();
  }

  update(_time: number, deltaMs: number) {
    if (this.paused) return;
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.clockT += dt;
    this.phaseT += dt;
    const c = BALANCE.combat;

    switch (this.phase) {
      case 'walkIn': {
        const p = Math.min(1, this.phaseT / c.walkInSec);
        this.foeBaseX = Phaser.Math.Linear(this.foeStartX, this.enemyX, 1 - (1 - p) * (1 - p));
        this.heroShift = this.heroStartShift * (1 - p) * (1 - p);
        this.scrollBy(dt * (1 - p * 0.6));
        if (p >= 1) this.arrive();
        break;
      }
      case 'intro':
        if (this.phaseT >= INTRO_SEC) this.beginFight();
        break;
      case 'fight': {
        if (this.fight && !this.fight.result) {
          const { state, events } = stepFight(this.fight, dt, Math.random, BALANCE);
          this.fight = state;
          for (const ev of events) this.queueFightEvent(ev);
          if (this.clockT - this.lastTimerPush > 0.1) {
            this.lastTimerPush = this.clockT;
            battleTimer.set({ active: true, left: Math.max(0, state.timeLimit - state.elapsed), total: state.timeLimit });
          }
        }
        while (this.phase === 'fight' && this.pending.length && this.pending[0].at <= this.clockT) {
          this.onFightEvent(this.pending.shift()!.ev);
        }
        break;
      }
      case 'victory':
        if (this.phaseT > 0.35) this.scrollBy(dt);
        if (this.phaseT >= c.victorySec && this.victory?.done) this.afterVictory(this.victory.result);
        break;
      case 'retreat':
        this.heroShift = -Math.min(1, this.phaseT / c.retreatSec) * this.W * 0.35;
        if (this.phaseT >= c.retreatSec) this.restartAfterDefeat();
        break;
      case 'exit': {
        const p = Math.min(1, this.phaseT / AREA_EXIT_SEC);
        this.heroShift = p * p * (this.W - this.heroX + this.fighterWidth('hero'));
        this.scrollBy(dt * 0.6);
        if (p >= 1) this.areaFadeOut();
        break;
      }
      case 'areaHold':
        if (this.phaseT >= AREA_HOLD_SEC) this.areaFadeIn();
        break;
      default:
        break;
    }
    this.render();
  }

  // -------------------------------------------------------------------------
  // React → scene
  // -------------------------------------------------------------------------

  private onInput() {
    const input = battleInput.get();
    if (!input) return;
    this.latest = input;

    // own pause gate (Phaser's scene.pause() during create() leaves the scene stuck)
    this.paused = input.paused;
    this.tweens.timeScale = input.paused ? 0 : 1;
    if (this.sparks) this.sparks.timeScale = input.paused ? 0 : 1;
    if (this.aura) this.aura.timeScale = input.paused ? 0 : 1;
    for (const f of Object.values(this.fighters)) f.img.anims.timeScale = input.paused ? 0 : 1;
    this.fx.classList.toggle('paused', input.paused);

    this.applyHeroLook();
    this.applyAura();

    const changed = !this.prevInputPos || !samePosition(this.prevInputPos, input.position);
    this.prevInputPos = { ...input.position };

    if (this.phase === 'waiting') {
      this.expected = { ...input.position };
      this.applyArea(areaDef(input.position.area));
      this.startEncounter(input.position);
      return;
    }
    // our own victory arriving from the DB → nothing to do
    if (!changed || (this.expected && samePosition(input.position, this.expected))) return;
    // hero moved without us (death, dev menu) → restart there
    this.expected = { ...input.position };
    this.attempts = 0;
    if (this.phase === 'victory' || this.phase === 'transition' || this.phase === 'exit' || this.phase === 'areaHold')
      this.externalPending = true;
    else this.fadeTo(input.position);
  }

  /** epic / legendary equipment: sparkles in the rarity colour */
  private applyAura() {
    if (!this.latest || !this.aura) return;
    const best = bestRarity(Object.values(this.latest.gear).map((rarity) => (rarity ? { rarity } : null)));
    const rarity = best === 'epic' || best === 'legendary' ? best : null;
    if (rarity === this.auraRarity) return;
    this.auraRarity = rarity;
    if (!rarity) {
      this.aura.stop();
      return;
    }
    this.aura.setParticleTint(Phaser.Display.Color.HexStringToColor(RARITY_COLORS[rarity]).color);
    this.aura.frequency = rarity === 'legendary' ? 80 : 120;
    this.aura.start();
  }

  /** equipment is visible on the hero (new look as soon as it is composed) */
  private applyHeroLook() {
    if (!this.latest) return;
    const look = heroLook(this.latest.gear);
    const key = `hero:${lookKey(look)}`;
    if (key === this.heroWanted) return;
    this.heroWanted = key;
    void this.loadSprite(key, () => composeCharacter(look, 'right')).then((s) => {
      if (this.destroyed || this.heroWanted !== key || !s) return;
      this.setFighterSprite('hero', key, s);
    });
  }

  // -------------------------------------------------------------------------
  // encounter flow
  // -------------------------------------------------------------------------

  private startEncounter(pos: StagePosition, heroEnters = false) {
    this.pos = { ...pos };
    if (this.area?.id !== areaDef(pos.area).id) this.applyArea(areaDef(pos.area));
    const enemy = enemyForStage(pos, BALANCE);
    this.enemy = enemy;
    this.showEnemy(enemy);
    this.preloadEnemy(enemyForStage(nextStage(pos, BALANCE), BALANCE).def);

    const foe = this.fighters.foe;
    this.tweens.killTweensOf(foe.img);
    foe.img.setAlpha(1).setAngle(0).setVisible(true);
    foe.attackUntil = 0;
    this.foeStartX = this.W + this.fighterWidth('foe');
    this.foeBaseX = this.foeStartX;
    const hero = this.fighters.hero;
    hero.img.setAlpha(1).setFlipX(false);
    hero.attackUntil = 0;
    this.heroStartShift = heroEnters ? -(this.heroX + this.fighterWidth('hero')) : 0;
    this.heroShift = this.heroStartShift;
    this.impulses = [];
    this.pending = [];
    this.shownHp = { hero: 1, foe: 1 };
    this.fight = null;
    this.victory = null;
    this.setPhase('walkIn');
    battleHud.set((h) => ({ ...h, enemyName: enemy.def.name, kind: enemy.kind, attempts: this.attempts }));
    battleTimer.set({ active: false, left: enemy.timerSec, total: enemy.timerSec });
    this.render(); // place everything even if the scene starts paused
  }

  private arrive() {
    const enemy = this.enemy!;
    if (enemy.kind === 'normal') {
      this.beginFight();
      return;
    }
    this.setPhase('intro');
    playSfx('bossAppear');
    this.cameras.main.shake(260, 0.006);
    battleHud.set((h) => ({
      ...h,
      banner: {
        id: ++bannerId,
        kind: enemy.kind === 'areaBoss' ? 'areaBoss' : 'boss',
        title: enemy.kind === 'areaBoss' ? 'Gebietsboss' : 'Boss',
        subtitle: enemy.def.name,
      },
    }));
  }

  private beginFight() {
    const enemy = this.enemy!;
    // stat changes (level-up, items, exhaustion) apply from the next fight on
    this.fight = startFight(this.latest!.hero, enemy, enemy.timerSec, BALANCE);
    this.lastTimerPush = -1;
    this.setPhase('fight');
  }

  /** attacks start their animation now; damage shows up at the impact frame */
  private queueFightEvent(ev: FightEvent) {
    if (ev.type === 'attack') {
      const who: Who = ev.by === 'hero' ? 'hero' : 'foe';
      const lead = this.startAttack(who);
      this.pending.push({ at: this.clockT + lead, ev });
    } else {
      const last = this.pending.length ? this.pending[this.pending.length - 1].at : this.clockT;
      this.pending.push({ at: Math.max(this.clockT, last) + 0.05, ev });
    }
    this.pending.sort((a, b) => a.at - b.at || (a.ev.type === 'end' ? 1 : 0) - (b.ev.type === 'end' ? 1 : 0));
  }

  private onFightEvent(ev: FightEvent) {
    if (ev.type === 'end') {
      this.endFight(ev.result);
      return;
    }
    const heroHits = ev.by === 'hero';
    const attacker: Who = heroHits ? 'hero' : 'foe';
    const target: Who = heroHits ? 'foe' : 'hero';
    const dir = heroHits ? 1 : -1;
    const fullHp = target === 'hero' ? this.fight!.hero.stats.maxHp : this.fight!.enemy.stats.maxHp;
    this.shownHp[target] = ev.targetHp / fullHp;
    this.impulses.push({ who: attacker, start: this.clockT, dur: 0.16, amp: (this.fighters[attacker].sprite ? 6 : 12) * dir });
    this.impulses.push({ who: target, start: this.clockT + 0.03, dur: ev.crit ? 0.26 : 0.18, amp: (ev.crit ? 10 : 5) * dir });
    this.flashUntil[target] = this.clockT + 0.09;

    const x = this.fighterX(target);
    const top = this.feetY() - this.fighterLift(target) - this.fighterHeight(target);
    this.sparks.setParticleTint(heroHits ? (ev.crit ? 0xffd84a : 0xffffff) : 0xff6a50);
    this.sparks.explode(ev.crit ? 16 : 7, x, top + this.fighterHeight(target) * 0.45);
    this.damageNumber(ev.damage, ev.crit, x, top - 2, heroHits);
    if (ev.crit) this.cameras.main.shake(110, 0.006);
    playSfx(heroHits ? (ev.crit ? 'crit' : 'hit') : 'hurt');
  }

  private endFight(result: FightResult) {
    battleTimer.set((t) => ({ ...t, active: false }));
    this.pending = [];
    const pos = this.pos!;
    const foe = this.fighters.foe;
    if (result === 'won') {
      this.setPhase('victory');
      this.attempts = 0;
      this.expected = nextStage(pos, BALANCE);
      playSfx('enemyDefeated');
      const enemy = this.enemy!;
      this.sparks.setParticleTint(Phaser.Display.Color.HexStringToColor(enemy.def.colors[0]).color);
      this.sparks.explode(22, foe.img.x, this.feetY() - this.fighterHeight('foe') * 0.5);
      this.tweens.add({
        targets: foe.img,
        alpha: 0,
        angle: 12,
        duration: BALANCE.combat.victorySec * 700,
        ease: 'Quad.easeIn',
      });
      // persist right away; the next encounter waits for it
      const v: { done: boolean; result: VictoryOutcome | null } = { done: false, result: null };
      this.victory = v;
      this.cb
        .onVictory(pos)
        .then((r) => {
          v.result = r;
        })
        .catch(() => undefined)
        .finally(() => {
          v.done = true;
        });
    } else {
      this.setPhase('retreat');
      this.attempts += 1;
      playSfx('fightLost');
      // composed hero has its own walking-left animation, the placeholder is mirrored
      if (!this.fighters.hero.sprite) this.fighters.hero.img.setFlipX(true);
      this.cameras.main.fadeOut(BALANCE.combat.retreatSec * 1000, 0, 0, 0);
      battleHud.set((h) => ({ ...h, attempts: this.attempts }));
    }
  }

  private afterVictory(result: VictoryOutcome | null) {
    if (this.externalPending || !result) {
      // moved by something else meanwhile (or not saved) → follow the DB state
      if (!this.externalPending) this.expected = { ...(this.latest?.position ?? this.pos!) };
      this.externalPending = false;
      this.fadeTo(this.expected!);
      return;
    }
    const next = { round: result.player.round, area: result.player.area, stage: result.player.stage };
    this.expected = next;
    // boss beaten for the first time: gold + a chest (slot choice as popup by React) – feedback v0.5
    const reward = result.reward;
    const loot = reward?.hoard.length ? ' · Drachenschatz!' : reward?.chest ? ` · ${CHEST_NAMES[reward.chest.chest]}!` : '';
    const rewardText = reward ? `+${reward.gold} Gold${loot}` : undefined;
    if (reward) playSfx('bossReward');
    if (result.areaCleared) {
      // hero walks off to the right, then the area transition starts
      playSfx('areaCleared');
      this.cameras.main.flash(300, 255, 226, 150);
      this.pendingArea = { next, roundCleared: result.roundCleared };
      this.setPhase('exit');
      battleHud.set((h) => ({
        ...h,
        enemyName: '',
        banner: {
          id: ++bannerId,
          kind: 'cleared',
          title: result.roundCleared ? 'Der Drache ist besiegt!' : 'Gebiet geschafft!',
          subtitle: rewardText ? `${areaDef(this.pos!.area).name} · ${rewardText}` : areaDef(this.pos!.area).name,
        },
      }));
      return;
    }
    if (rewardText) {
      battleHud.set((h) => ({
        ...h,
        banner: { id: ++bannerId, kind: 'reward', overline: 'Boss besiegt!', title: rewardText },
      }));
    }
    this.startEncounter(next);
  }

  /** slow fade to black, then show the new area's name */
  private areaFadeOut() {
    this.setPhase('transition');
    const cam = this.cameras.main;
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.setPhase('areaHold');
      const pa = this.pendingArea;
      if (this.externalPending || !pa) return;
      const { next, roundCleared } = pa;
      const area = areaDef(next.area);
      const total = BALANCE.combat.areaCount;
      // first enemy of the new area: compose it while the name is shown
      this.preloadEnemy(enemyForStage(next, BALANCE).def);
      battleHud.set((h) => ({
        ...h,
        banner: roundCleared
          ? {
              id: ++bannerId,
              kind: 'round',
              overline: `Runde ${next.round} ★`,
              title: area.name,
              subtitle: 'Alles beginnt von vorn – nur härter',
            }
          : {
              id: ++bannerId,
              kind: 'area',
              overline: `Gebiet ${next.area} von ${total}`,
              title: area.name,
              subtitle: next.round > 1 ? `Runde ${next.round} ★` : undefined,
            },
      }));
    });
    cam.fadeOut(AREA_FADE_MS, 0, 0, 0);
  }

  /** new area: hero walks in from the left while the picture fades in */
  private areaFadeIn() {
    const external = this.externalPending;
    this.externalPending = false;
    const target = external || !this.pendingArea ? this.expected! : this.pendingArea.next;
    this.pendingArea = null;
    this.startEncounter(target, !external);
    this.cameras.main.fadeIn(AREA_FADE_MS, 0, 0, 0);
  }

  private restartAfterDefeat() {
    this.startEncounter(this.pos!);
    this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
  }

  /** fade out → new position (and area) → fade in */
  private fadeTo(pos: StagePosition, onSwitched?: () => void) {
    this.setPhase('transition');
    battleTimer.set((t) => ({ ...t, active: false }));
    const cam = this.cameras.main;
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const external = this.externalPending && this.expected;
      this.externalPending = false;
      this.startEncounter(external ? this.expected! : pos);
      if (!external) onSwitched?.();
      cam.fadeIn(FADE_MS, 0, 0, 0);
    });
    cam.fadeOut(FADE_MS, 0, 0, 0);
  }

  private setPhase(phase: Phase) {
    this.phase = phase;
    this.phaseT = 0;
  }

  // -------------------------------------------------------------------------
  // sprites
  // -------------------------------------------------------------------------

  /** composes a sprite once and registers texture + animations (null = use the placeholder) */
  private loadSprite(key: string, make: () => Promise<ComposedSprite>): Promise<ComposedSprite | null> {
    let p = this.sprites.get(key);
    if (!p) {
      p = make()
        .then((s) => {
          if (this.destroyed) return null;
          this.registerSprite(key, s);
          return s;
        })
        .catch((err: unknown) => {
          console.warn(`Grafik ${key} nicht verfügbar – Platzhalter`, err);
          this.sprites.delete(key); // try again at the next encounter
          return null;
        });
      this.sprites.set(key, p);
    }
    return p;
  }

  private registerSprite(key: string, s: ComposedSprite) {
    if (this.textures.exists(key)) return;
    const tex = this.textures.addCanvas(key, s.canvas);
    if (!tex) return;
    for (let i = 0; i < s.count; i++) {
      tex.add(i, 0, (i % s.cols) * s.frameW, Math.floor(i / s.cols) * s.frameH, s.frameW, s.frameH);
    }
    for (const [name, r] of Object.entries(s.anims)) {
      this.anims.create({
        key: `${key}:${name}`,
        frames: Array.from({ length: r.count }, (_, k) => ({ key, frame: r.start + k })),
        frameRate: r.fps,
        repeat: name === 'attack' ? 0 : -1,
      });
    }
  }

  private enemySprite(def: EnemyDef): { key: string; make: () => Promise<ComposedSprite> } | null {
    const entry = ENEMY_SPRITES[def.id];
    if (!entry) return null;
    const key = `foe:${def.id}`;
    if (entry.kind === 'lpc') return { key, make: () => composeCharacter(entry.look, 'left') };
    return {
      key,
      make: () =>
        composeMonster(entry.id, entry.recolor ? def.colors : undefined).then((s) => ({ ...s, scale: s.scale * (entry.scale ?? 1) })),
    };
  }

  private preloadEnemy(def: EnemyDef) {
    const s = this.enemySprite(def);
    if (s) void this.loadSprite(s.key, s.make);
  }

  /** placeholder right away, the composed sprite as soon as it is ready */
  private showEnemy(enemy: EnemyStats) {
    const def = enemy.def;
    const boss = enemy.kind !== 'normal';
    const phKey = `ph-${def.id}`;
    if (!this.textures.exists(phKey)) this.makeBitmapTextures(phKey, art.enemyBitmap(def.shape), art.enemyPalette(def.colors));
    this.setFighterPlaceholder('foe', phKey, boss);
    const s = this.enemySprite(def);
    if (!s) return;
    void this.loadSprite(s.key, s.make).then((sprite) => {
      if (this.destroyed || !sprite || this.enemy?.def.id !== def.id) return;
      this.setFighterSprite('foe', s.key, sprite, boss);
      if (this.phase === 'walkIn') this.foeStartX = Math.max(this.foeStartX, this.W + this.fighterWidth('foe'));
    });
  }

  private setFighterPlaceholder(who: Who, key: string, boss = false) {
    const f = this.fighters[who];
    f.sprite = null;
    f.key = key;
    f.anim = null;
    f.img.anims.stop();
    f.img.setTexture(key).setOrigin(0.5, 1);
    f.extraScale = boss ? this.bossScale(f.img.height * PLACEHOLDER_SCALE) : 1;
    f.img.setScale(PLACEHOLDER_SCALE * f.extraScale);
  }

  private setFighterSprite(who: Who, key: string, s: ComposedSprite, boss = false) {
    const f = this.fighters[who];
    f.sprite = s;
    f.key = key;
    f.anim = null;
    f.img.setFlipX(false);
    f.img.setTexture(key, 0).setOrigin(s.originX / s.frameW, s.originY / s.frameH);
    f.extraScale = boss ? this.bossScale(s.height * s.scale) : 1;
    f.img.setScale(s.scale * f.extraScale);
    if (who === 'hero') this.applyHeroTint();
  }

  /** plays an animation of the composed sprite (no-op for placeholders) */
  private animate(who: Who, name: AnimName, restart = false) {
    const f = this.fighters[who];
    if (!f.sprite) return;
    if (!restart && f.anim === name) return;
    f.anim = name;
    f.img.play(`${f.key}:${name}`);
  }

  /** starts the attack animation, returns seconds until the hit lands */
  private startAttack(who: Who): number {
    const f = this.fighters[who];
    if (!f.sprite) return PLACEHOLDER_HIT_LEAD;
    const a = f.sprite.anims.attack;
    f.attackUntil = this.clockT + a.count / a.fps;
    this.animate(who, 'attack', true);
    return Math.min(MAX_HIT_LEAD, Math.floor(a.count / 2) / a.fps);
  }

  /** ×2, but never covering the HUD at the top or most of the scene */
  private bossScale(height: number) {
    const h = Math.max(8, height);
    const room = Math.min(this.feetY() - HUD_CLEAR_PX / (this.scale.zoom || 1), this.H * BOSS_MAX_HEIGHT);
    return Math.max(BOSS_SCALE_MIN, Math.min(BOSS_SCALE, room / h));
  }

  private totalScale(who: Who) {
    const f = this.fighters[who];
    return (f.sprite ? f.sprite.scale : PLACEHOLDER_SCALE) * f.extraScale;
  }

  /** visible height above the feet (game px) */
  private fighterHeight(who: Who) {
    const f = this.fighters[who];
    return f.sprite ? f.sprite.height * this.totalScale(who) : f.img.displayHeight;
  }

  private fighterWidth(who: Who) {
    const f = this.fighters[who];
    return f.sprite ? f.sprite.width * this.totalScale(who) : f.img.displayWidth;
  }

  private fighterLift(who: Who) {
    const f = this.fighters[who];
    return f.sprite ? Math.round(f.sprite.lift * this.totalScale(who)) : 0;
  }

  private applyHeroTint() {
    const f = this.fighters.hero;
    if (this.latest?.hero.exhausted) f.img.setTint(HERO_TINT_EXHAUSTED);
    else f.img.clearTint();
  }

  // -------------------------------------------------------------------------
  // drawing
  // -------------------------------------------------------------------------

  private feetY() {
    return this.groundY + bg.feetInset(this.H);
  }

  private offset(who: Who) {
    let x = 0;
    this.impulses = this.impulses.filter((i) => this.clockT - i.start < i.dur);
    for (const i of this.impulses) {
      if (i.who !== who) continue;
      const p = (this.clockT - i.start) / i.dur;
      if (p >= 0) x += i.amp * (p < 0.4 ? p / 0.4 : (1 - p) / 0.6);
    }
    return Math.round(x);
  }

  private fighterX(who: Who) {
    return who === 'hero' ? this.heroX + Math.round(this.heroShift) : Math.round(this.foeBaseX);
  }

  /** frame offset of an attack animation (e.g. the boar lunges forward) */
  private nudge(who: Who) {
    const f = this.fighters[who];
    const n = f.sprite?.anims.attack.nudge;
    if (!n || f.anim !== 'attack' || !f.img.anims.currentFrame) return 0;
    return Math.round((n[f.img.anims.currentFrame.index - 1] ?? 0) * this.totalScale(who));
  }

  private render() {
    const walking =
      this.phase === 'walkIn' || (this.phase === 'victory' && this.phaseT > 0.35) || this.phase === 'retreat' || this.phase === 'exit';
    const exhausted = !!this.latest?.hero.exhausted;
    const feet = this.feetY();
    const hero = this.fighters.hero;
    const foe = this.fighters.foe;

    // hero
    let heroAnim: AnimName = walking ? (this.phase === 'retreat' ? 'retreat' : 'walk') : 'idle';
    if (this.clockT < hero.attackUntil && this.phase === 'fight') heroAnim = 'attack';
    this.animate('hero', heroAnim);
    const heroBob = this.bob('hero', walking, exhausted);
    hero.img.setPosition(this.fighterX('hero') + this.offset('hero') + this.nudge('hero'), feet - heroBob);
    this.flash('hero');
    if (this.phase === 'retreat') hero.img.setAlpha(1 - Math.min(1, this.phaseT / BALANCE.combat.retreatSec) * 0.6);
    if (this.auraRarity) {
      // sparkles start anywhere on the hero's body
      const w = Math.max(8, Math.round(this.fighterWidth('hero') * 0.6));
      const h = Math.max(12, Math.round(this.fighterHeight('hero') * 0.85));
      const zone = `${w}x${h}`;
      if (zone !== this.auraZone) {
        this.auraZone = zone;
        this.aura.clearEmitZones();
        this.aura.addEmitZone({ type: 'random', source: new Phaser.Geom.Rectangle(-w / 2, -h, w, h) } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig);
      }
      this.aura.setPosition(hero.img.x, feet - heroBob);
      this.aura.setVisible(hero.img.visible && hero.img.alpha > 0.5);
    }

    // enemy
    if (foe.img.visible) {
      let foeAnim: AnimName = this.phase === 'walkIn' ? 'walk' : 'idle';
      if (this.clockT < foe.attackUntil && this.phase === 'fight') foeAnim = 'attack';
      if (this.phase !== 'victory') this.animate('foe', foeAnim);
      else foe.img.anims.pause();
      const foeBob = this.bob('foe', this.phase === 'walkIn', false);
      foe.img.setPosition(this.fighterX('foe') + this.offset('foe') - this.nudge('foe'), feet - this.fighterLift('foe') - foeBob);
      this.flash('foe');
    }

    // shadows + HP bars (below the fighters)
    const g = this.overlay;
    g.clear();
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(hero.img.x, feet, Math.max(18, this.fighterWidth('hero') * 0.7), 5);
    if (foe.img.visible && foe.img.alpha > 0.2 && !foe.sprite?.ownShadow) {
      const lifted = this.fighterLift('foe') > 0;
      g.fillStyle(0x000000, lifted ? 0.18 : 0.3);
      g.fillEllipse(foe.img.x, feet, Math.max(18, this.fighterWidth('foe') * (lifted ? 0.5 : 0.75)), lifted ? 4 : 5);
    }

    const fighting = this.phase === 'walkIn' || this.phase === 'intro' || this.phase === 'fight';
    const heroFrac = this.fight ? this.shownHp.hero : 1;
    const foeFrac = this.phase === 'victory' ? 0 : this.fight ? this.shownHp.foe : 1;
    const barY = feet + 6;
    if (fighting || this.phase === 'victory') this.bar(hero.img.x, barY, 36, heroFrac, 0x6abf4b);
    if (foe.img.visible && fighting) {
      const boss = this.enemy && this.enemy.kind !== 'normal';
      this.bar(this.fighterX('foe'), barY, boss ? 54 : 36, foeFrac, boss ? 0xe8b33a : 0xe0554a);
    }
  }

  /** 1 px breathing while standing; walking animations bring their own movement */
  private bob(who: Who, walking: boolean, exhausted: boolean) {
    const f = this.fighters[who];
    if (f.sprite) {
      if (walking || f.anim !== 'idle' || f.sprite.anims.idle.count > 1) return 0;
      return Math.floor(this.clockT * (exhausted ? 0.9 : 1.6) + (who === 'foe' ? 0.5 : 0)) % 2;
    }
    const rate = walking ? (exhausted ? 5 : 8) : exhausted ? 1.2 : 2;
    return (Math.floor(this.clockT * rate) % 2) * 2;
  }

  /** white hit flash: tint (WebGL) / white placeholder texture / alpha (canvas renderer) */
  private flash(who: Who) {
    const f = this.fighters[who];
    const on = this.clockT < this.flashUntil[who];
    if (!f.sprite) {
      const key = on ? `${f.key}-w` : f.key;
      if (f.img.texture.key !== key) f.img.setTexture(key);
      return;
    }
    if (this.webgl) {
      if (on) f.img.setTintFill(0xffffff);
      else if (f.img.isTinted && f.img.tintFill) {
        if (who === 'hero') this.applyHeroTint();
        else f.img.clearTint();
      }
    } else if (this.phase === 'fight') {
      f.img.setAlpha(on ? 0.55 : 1);
    }
  }

  private bar(cx: number, y: number, w: number, frac: number, color: number) {
    const g = this.overlay;
    const x = Math.round(cx - w / 2);
    g.fillStyle(0x1a100a, 1);
    g.fillRect(x - 1, y - 1, w + 2, 6);
    g.fillStyle(0x3a2819, 1);
    g.fillRect(x, y, w, 4);
    const fill = Math.round(w * Phaser.Math.Clamp(frac, 0, 1));
    if (fill > 0) {
      g.fillStyle(frac < 0.3 && color === 0x6abf4b ? 0xe0554a : color, 1);
      g.fillRect(x, y, fill, 4);
      g.fillStyle(0xffffff, 0.25);
      g.fillRect(x, y, fill, 1);
    }
  }

  /** damage numbers are HTML (sharp at any zoom); the canvas itself is low-res */
  private damageNumber(dmg: number, crit: boolean, x: number, y: number, byHero: boolean) {
    const zoom = this.scale.zoom || 1;
    const el = document.createElement('div');
    el.className = `dmg ${byHero ? 'by-hero' : 'by-foe'}${crit ? ' crit' : ''}`;
    el.textContent = crit ? `${dmg}!` : String(dmg);
    el.style.left = `${Math.round((x + Phaser.Math.Between(-4, 4)) * zoom)}px`;
    el.style.top = `${Math.round(Math.max(12, y) * zoom)}px`;
    const remove = () => el.remove();
    el.addEventListener('animationend', remove, { once: true });
    window.setTimeout(remove, 3000); // in case animations are off
    this.fx.appendChild(el);
  }

  private scrollBy(dt: number) {
    this.scroll += WALK_SPEED * dt;
    if (this.layers) bg.scrollLayers(this.layers, this.scroll);
  }

  // -------------------------------------------------------------------------
  // layout & background
  // -------------------------------------------------------------------------

  private onResize() {
    this.layout();
  }

  private layout() {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this.groundY = this.H - bg.groundHeight(this.H);
    this.heroX = Math.round(this.W * 0.32);
    const oldEnemyX = this.enemyX;
    this.enemyX = Math.round(this.W * 0.7);
    if (this.phase !== 'walkIn' && this.foeBaseX === oldEnemyX) this.foeBaseX = this.enemyX;
    if (this.area) this.buildBackground(this.area);
  }

  private applyArea(area: AreaDef) {
    this.area = area;
    this.buildBackground(area);
  }

  private buildBackground(area: AreaDef) {
    if (this.layers) bg.destroyLayers(this.layers);
    this.layers = bg.buildLayers(this, area, this.W, this.H, this.groundY);
    this.scrollBy(0);
  }

  // -------------------------------------------------------------------------
  // texture helpers
  // -------------------------------------------------------------------------

  private makeCanvas(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    const tex = this.textures.createCanvas(key, Math.max(1, w), Math.max(1, h));
    if (!tex) return;
    draw(tex.getContext());
    tex.refresh();
  }

  /** normal texture + white silhouette ("-w") for the hit flash */
  private makeBitmapTextures(key: string, rows: art.Bitmap, palette: art.Palette) {
    const { w, h } = art.bitmapSize(rows);
    this.makeCanvas(key, w, h, (ctx) => art.drawBitmap(ctx, rows, palette));
    this.makeCanvas(`${key}-w`, w, h, (ctx) => art.drawBitmap(ctx, rows, palette, '#ffffff'));
  }
}
