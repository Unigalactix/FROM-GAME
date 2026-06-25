// Phase 4 UI overlays: survivor dialogue, the journal (day/objectives/lore),
// the crafting bench, and the full-screen lore reader. Rendered above the HUD;
// while any of these is open the first-person sim pauses.

import { useEffect } from 'react';
import { useGameStore, getPhaseInfo } from '../store.js';
import { NPCS, LORE, RECIPES, TASKS, MATERIAL_LABELS } from '../systems/world.js';

const questMeta = (id) => NPCS.map((n) => n.quest).find((q) => q.id === id);

export default function Panels() {
  const activeDialogue = useGameStore((s) => s.activeDialogue);
  const showJournal = useGameStore((s) => s.showJournal);
  const showCraft = useGameStore((s) => s.showCraft);
  const readingLore = useGameStore((s) => s.readingLore);

  return (
    <>
      {activeDialogue && <Dialogue d={activeDialogue} />}
      {showJournal && <Journal />}
      {showCraft && <Crafting />}
      {readingLore && <LoreReader id={readingLore} />}
    </>
  );
}

function Dialogue({ d }) {
  const advance = useGameStore((s) => s.advanceDialogue);
  const close = useGameStore((s) => s.closeDialogue);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        advance();
      } else if (e.code === 'Escape') {
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, close]);

  return (
    <div
      onClick={advance}
      className="absolute inset-0 z-50 flex items-end justify-center pb-24 cursor-pointer bg-black/30"
    >
      <div className="w-[min(680px,90vw)] border border-stone-700/70 bg-black/85 p-6 backdrop-blur-sm">
        <p className="font-mono text-[11px] tracking-[0.4em] text-amber-rust uppercase mb-3">
          {d.name}
        </p>
        <p className="font-type text-lg md:text-xl leading-relaxed text-stone-200 min-h-[3.5rem]">
          {d.lines[d.idx]}
        </p>
        <div className="flex items-center justify-between mt-4">
          <span className="font-mono text-[9px] tracking-widest text-stone-600">
            {d.idx + 1} / {d.lines.length}
          </span>
          <span className="font-mono text-[10px] tracking-[0.3em] text-stone-400">
            CLICK / ENTER ›
          </span>
        </div>
      </div>
    </div>
  );
}

function Frame({ title, onClose, children }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[min(720px,92vw)] max-h-[82vh] overflow-y-auto border border-stone-700/70 bg-[#0b0a0d]/95 p-7">
        <div className="flex items-center justify-between mb-5 border-b border-stone-800 pb-3">
          <h2 className="font-type text-2xl tracking-[0.25em] text-stone-200">{title}</h2>
          <button
            onClick={onClose}
            className="glitch-target font-mono text-[10px] tracking-[0.3em] text-stone-500 border border-stone-800 px-3 py-1 hover:border-blood"
          >
            CLOSE
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Journal() {
  const day = useGameStore((s) => s.day);
  const time = useGameStore((s) => s.time);
  const quests = useGameStore((s) => s.quests);
  const loreFound = useGameStore((s) => s.loreFound);
  const materials = useGameStore((s) => s.materials);
  const talismans = useGameStore((s) => s.talismans);
  const bandages = useGameStore((s) => s.bandages);
  const food = useGameStore((s) => s.food);
  const tasksDone = useGameStore((s) => s.tasksDone);
  const toggle = useGameStore((s) => s.toggleJournal);
  const read = (id) => useGameStore.setState({ readingLore: id, showJournal: false });
  const isNight = getPhaseInfo(time).phase === 'NIGHT';

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape') toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <Frame title={`JOURNAL \u2014 DAY ${day}`} onClose={toggle}>
      {/* Objectives */}
      <section className="mb-6">
        <h3 className="font-mono text-[10px] tracking-[0.4em] text-amber-rust uppercase mb-3">
          Objectives
        </h3>
        <ul className="space-y-2">
          <li className="font-mono text-xs text-stone-400">
            <span className="text-stone-600">\u25a1</span> Survive until dawn.
          </li>
          {quests.length === 0 && (
            <li className="font-mono text-[11px] text-stone-600 italic">
              Speak with the survivors to learn what the town wants.
            </li>
          )}
          {quests.map((q) => {
            const m = questMeta(q.id);
            const done = q.status === 'done';
            return (
              <li key={q.id} className="font-mono text-xs">
                <span className={done ? 'text-amber-rust' : 'text-stone-600'}>
                  {done ? '\u25a0' : '\u25a1'}
                </span>{' '}
                <span className={done ? 'text-stone-500 line-through' : 'text-stone-300'}>
                  {m?.title}
                </span>
                {!done && m?.desc && (
                  <span className="block ml-4 text-[10px] text-stone-500">{m.desc}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Supplies */}
      <section className="mb-6">
        <h3 className="font-mono text-[10px] tracking-[0.4em] text-amber-rust uppercase mb-3">
          Supplies
        </h3>
        <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-stone-400">
          <Supply label="Talismans" value={talismans} />
          <Supply label="Bandages" value={bandages} />
          <Supply label="Food" value={food} />
          {Object.keys(MATERIAL_LABELS).map((k) => (
            <Supply key={k} label={MATERIAL_LABELS[k]} value={materials[k] || 0} />
          ))}
        </div>
      </section>

      {/* Daytime chores */}
      <section className="mb-6">
        <h3 className="font-mono text-[10px] tracking-[0.4em] text-amber-rust uppercase mb-3">
          Day Tasks {isNight && <span className="text-stone-600">— closed for the night</span>}
        </h3>
        <ul className="space-y-1">
          {TASKS.map((t) => {
            const done = tasksDone.includes(t.id);
            return (
              <li key={t.id} className="font-mono text-xs">
                <span className={done ? 'text-amber-rust' : 'text-stone-600'}>
                  {done ? '\u25a0' : '\u25a1'}
                </span>{' '}
                <span className={done ? 'text-stone-500 line-through' : 'text-stone-300'}>
                  {t.verb}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Lore */}
      <section>
        <h3 className="font-mono text-[10px] tracking-[0.4em] text-amber-rust uppercase mb-3">
          Recovered Lore — {loreFound.length} / {LORE.length}
        </h3>
        {loreFound.length === 0 ? (
          <p className="font-mono text-[11px] text-stone-600 italic">
            Nothing yet. The town keeps its secrets in the buildings and the trees.
          </p>
        ) : (
          <ul className="space-y-1">
            {LORE.filter((l) => loreFound.includes(l.id)).map((l) => (
              <li key={l.id}>
                <button
                  onClick={() => read(l.id)}
                  className="glitch-target font-mono text-xs text-stone-300 hover:text-amber-rust text-left"
                >
                  • {l.title}{' '}
                  <span className="text-[9px] text-stone-600 uppercase">[{l.type}]</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Frame>
  );
}

function Supply({ label, value }) {
  return (
    <span>
      <span className="text-stone-600">{label}:</span> <span className="text-stone-200">{value}</span>
    </span>
  );
}

function Crafting() {
  const materials = useGameStore((s) => s.materials);
  const craft = useGameStore((s) => s.craft);
  const toggle = useGameStore((s) => s.toggleCraft);
  const battery = useGameStore((s) => s.battery);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape') toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  const affordable = (cost) => Object.keys(cost).every((k) => (materials[k] || 0) >= cost[k]);

  return (
    <Frame title="CRAFTING" onClose={toggle}>
      <div className="mb-5 grid grid-cols-4 gap-2 font-mono text-[11px] text-stone-400">
        {Object.keys(MATERIAL_LABELS).map((k) => (
          <Supply key={k} label={MATERIAL_LABELS[k]} value={materials[k] || 0} />
        ))}
      </div>
      <ul className="space-y-3">
        {RECIPES.map((r) => {
          const ok = affordable(r.cost) && !(r.yields === 'battery' && battery >= 100);
          const costStr = Object.keys(r.cost)
            .map((k) => `${r.cost[k]} ${MATERIAL_LABELS[k]}`)
            .join(' + ');
          return (
            <li
              key={r.id}
              className="flex items-center justify-between border border-stone-800 p-3"
            >
              <div>
                <p className="font-mono text-sm tracking-widest text-stone-200">{r.label}</p>
                <p className="font-mono text-[10px] text-stone-500">{r.desc}</p>
                <p className="font-mono text-[10px] text-amber-rust/70 mt-1">{costStr}</p>
              </div>
              <button
                onClick={() => craft(r.id)}
                disabled={!ok}
                className={`glitch-target font-mono text-[11px] tracking-[0.3em] border px-4 py-2 ${
                  ok
                    ? 'text-stone-200 border-amber-rust/60 hover:border-amber-rust'
                    : 'text-stone-700 border-stone-800 cursor-not-allowed'
                }`}
              >
                CRAFT
              </button>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}

function LoreReader({ id }) {
  const close = useGameStore((s) => s.closeLore);
  const lore = LORE.find((l) => l.id === id);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape' || e.code === 'KeyG' || e.code === 'Enter') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  if (!lore) return null;
  return (
    <div
      onClick={close}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm cursor-pointer"
    >
      <div className="w-[min(620px,90vw)] border border-stone-700/70 bg-[#0c0b0e] p-8">
        <p className="font-mono text-[10px] tracking-[0.4em] text-stone-600 uppercase mb-1">
          {lore.type}
        </p>
        <h2 className="font-type text-2xl tracking-[0.2em] text-amber-rust mb-5">{lore.title}</h2>
        <p className="font-type text-base md:text-lg leading-relaxed text-stone-300">{lore.text}</p>
        <p className="font-mono text-[10px] tracking-[0.3em] text-stone-600 mt-6 text-center">
          CLICK TO CLOSE
        </p>
      </div>
    </div>
  );
}
