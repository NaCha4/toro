import { GREETING_DURATION } from "./greeting-motion.js";

const HINT_DELAY = 3;
const TURN_DURATION = 1.2;
const PAUSE_DURATION = 1;
const APPROACH_DURATION = 4.2;
const WAVE_BLEND_DURATION = 0.35;
export const START_TORO_Z = 0.9;
export const CLOSEUP_TORO_Z = 10.7;

const durations = {
  turning: TURN_DURATION,
  greeting: GREETING_DURATION,
  pause: PAUSE_DURATION,
  approaching: APPROACH_DURATION,
};
const nextPhase = {
  turning: "greeting",
  greeting: "pause",
  pause: "approaching",
  approaching: "closeup",
};

function ease(progress) {
  const value = Math.min(1, Math.max(0, progress));
  return value * value * (3 - 2 * value);
}

export function createGreetingSequence(onPhaseChange = () => {}) {
  let phase = "waiting";
  let elapsed = 0;
  function enter(next) {
    phase = next;
    onPhaseChange(phase);
  }
  return {
    get phase() {
      return phase;
    },
    get hintVisible() {
      return phase === "waiting" && elapsed >= HINT_DELAY;
    },
    get heading() {
      if (phase === "waiting") return Math.PI;
      if (phase === "turning")
        return Math.PI * (1 - ease(elapsed / TURN_DURATION));
      return 0;
    },
    get waveBlend() {
      return phase === "greeting" ? ease(elapsed / WAVE_BLEND_DURATION) : 0;
    },
    get approachProgress() {
      if (phase === "closeup") return 1;
      return phase === "approaching" ? ease(elapsed / APPROACH_DURATION) : 0;
    },
    start(reducedMotion = false) {
      if (phase !== "waiting") return false;
      elapsed = 0;
      enter("turning");
      this.update(0, reducedMotion);
      return true;
    },
    update(delta, reducedMotion = false) {
      elapsed += Math.max(0, delta);
      while (nextPhase[phase]) {
        const duration =
          reducedMotion && (phase === "turning" || phase === "approaching")
            ? 0
            : durations[phase];
        if (elapsed < duration) break;
        elapsed -= duration;
        enter(nextPhase[phase]);
      }
    },
  };
}
