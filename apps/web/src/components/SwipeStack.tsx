"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type ReactNode } from "react";
import { Card } from "@mui/material";
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
} from "motion/react";
import type { DailyEntry } from "@/lib/api/types";

type Direction = "next" | "previous";
export type SwipeStackHandle = {
  dismiss: (side: number) => Promise<void>;
  reset: () => void;
};
type Props = {
  current: DailyEntry | null;
  underneath: DailyEntry | null | undefined;
  canGoBack: boolean;
  busy: boolean;
  onDirection: (direction: Direction) => void;
  onAdvance: (direction: Direction, restart?: boolean, side?: number) => Promise<void>;
  renderCard: (entry: DailyEntry | null, preview: boolean) => ReactNode;
};
const spring = { type: "spring", stiffness: 360, damping: 38, mass: 1 } as const;

// Both layers keep the same keyed DOM and the same frame as one becomes active.
// Motion owns every transform: no competing CSS transition or opacity fade.
const SwipeStack = forwardRef<SwipeStackHandle, Props>(function SwipeStack(
  { current, underneath, canGoBack, busy, onDirection, onAdvance, renderCard },
  ref,
) {
  const frame = useRef<HTMLDivElement>(null);
  const controls = useDragControls();
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const width = useMotionValue(360);
  const height = useMotionValue(260);
  const rotate = useTransform(x, (value) =>
    reduced ? 0 : Math.max(-12, Math.min(12, value / 35)),
  );
  const reveal = useTransform(() => Math.min(1, Math.abs(x.get()) / Math.max(1, width.get())));
  const backScale = useTransform(reveal, [0, 1], [0.97, 1]);
  const backY = useTransform(reveal, [0, 1], [10, 0]);
  const moving = useRef(false);
  const committed = useRef(false);
  const alive = useRef(true);
  const measured = useRef(false);
  const targetHeight = useRef(0);
  const measure = useRef<() => void>(() => {});
  const flight = useRef<AnimationPlaybackControls | null>(null);
  const sizing = useRef<AnimationPlaybackControls | null>(null);
  const currentKey = current?.publication_date ?? "empty";
  const underKey = underneath?.publication_date;

  function reset() {
    if (committed.current) return;
    controls.cancel();
    flight.current?.stop();
    flight.current = animate(x, 0, reduced ? { duration: 0 } : spring);
    moving.current = false;
    measure.current();
  }
  useImperativeHandle(ref, () => ({
    async dismiss(side) {
      committed.current = true;
      moving.current = true;
      controls.cancel();
      sizing.current?.stop();
      targetHeight.current = 0;
      const bounds = frame.current?.getBoundingClientRect();
      // Keep the departing card opaque until even its rotated corners are outside.
      const margin = (bounds?.height ?? 400) * 0.25 + 40;
      const travel =
        side < 0
          ? (bounds?.right ?? window.innerWidth) + margin
          : window.innerWidth - (bounds?.left ?? 0) + margin;
      if (!reduced) {
        flight.current = animate(x, side * travel, {
          type: "spring",
          stiffness: 280,
          damping: 32,
          velocity: x.getVelocity(),
          restDelta: 0.5,
          restSpeed: 10,
        });
        await flight.current;
      }
    },
    reset() {
      committed.current = false;
      reset();
    },
  }));

  useLayoutEffect(() => {
    // Reset only after React has promoted the existing underneath node. The old
    // front stays outside the viewport until that commit, so it cannot flash back.
    flight.current?.stop();
    x.jump(0);
    committed.current = false;
    moving.current = false;
  }, [currentKey, x]);

  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      flight.current?.stop();
      sizing.current?.stop();
    };
  }, []);

  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const update = () => {
      if (moving.current || !alive.current) return;
      width.set(node.clientWidth || 360);
      const contents = [...node.querySelectorAll<HTMLElement>(".deck-measure")];
      const target = Math.max(260, ...contents.map((content) => content.scrollHeight));
      if (Math.abs(target - targetHeight.current) < 0.5) return;
      targetHeight.current = target;
      sizing.current?.stop();
      if (!measured.current || reduced) height.jump(target);
      else sizing.current = animate(height, target, spring);
      measured.current = true;
    };
    measure.current = update;
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    node.querySelectorAll(".deck-measure").forEach((content) => observer.observe(content));
    return () => observer.disconnect();
  }, [currentKey, underKey, reduced, height, width]);

  function direction(offset: number): Direction {
    return offset > 0 && canGoBack ? "previous" : "next";
  }
  function commit(offset: number) {
    if (committed.current) return;
    committed.current = true;
    controls.cancel();
    void onAdvance(direction(offset), false, Math.sign(offset));
  }

  const layers = [underneath ?? null, current].filter(
    (entry, index) => index === 1 || entry !== null,
  );
  return (
    <motion.div ref={frame} className="deck-stack" style={{ height }}>
      {layers.map((entry, index) => {
        const isActive = index === layers.length - 1;
        return (
          <motion.div
            key={entry?.publication_date ?? "empty"}
            className={`deck-layer ${isActive ? "deck-foreground" : "deck-underneath"}`}
            data-date={entry?.publication_date}
            aria-hidden={isActive ? undefined : true}
            inert={isActive ? undefined : true}
            role={isActive ? "group" : undefined}
            tabIndex={isActive ? 0 : undefined}
            aria-label={
              isActive
                ? "Carte découverte. Flèche droite : autre découverte. Flèche gauche : précédente."
                : undefined
            }
            style={{
              x: isActive ? x : 0,
              rotate: isActive ? rotate : 0,
              scale: isActive ? 1 : backScale,
              y: isActive ? 0 : backY,
              zIndex: isActive ? 2 : 1,
            }}
            drag={isActive ? "x" : false}
            dragControls={isActive ? controls : undefined}
            dragListener={false}
            dragMomentum={false}
            onPointerDown={(event) => {
              if (
                !isActive ||
                busy ||
                committed.current ||
                !event.isPrimary ||
                (event.pointerType === "mouse" && event.button !== 0) ||
                (event.target as HTMLElement).closest("button, a, input, textarea, select")
              )
                return;
              flight.current?.stop();
              controls.start(event);
            }}
            onDragStart={() => {
              moving.current = true;
              sizing.current?.stop();
              targetHeight.current = 0;
            }}
            onDrag={(_, info) => {
              if (committed.current) return;
              onDirection(direction(info.offset.x));
              const threshold = Math.max(56, Math.min(96, width.get() * 0.24));
              if (Math.abs(info.offset.x) >= threshold) commit(info.offset.x);
            }}
            onDragEnd={(_, info) => {
              if (committed.current) return;
              if (Math.abs(info.offset.x) >= 30 && Math.abs(info.velocity.x) > 500)
                commit(info.offset.x);
              else reset();
            }}
            onPointerCancel={() => {
              if (!committed.current) reset();
            }}
            onKeyDown={(event) => {
              if (!isActive || event.target !== event.currentTarget) return;
              if (event.key === "ArrowRight") {
                event.preventDefault();
                void onAdvance("next");
              }
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                void onAdvance("previous");
              }
            }}
          >
            <Card className="deck-card">
              <div className="deck-measure">{renderCard(entry, !isActive)}</div>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
});
export default SwipeStack;
