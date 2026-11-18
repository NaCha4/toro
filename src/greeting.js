const HINT_DELAY = 3;
const TURN_DURATION = 1.2;
const WAVE_BLEND_DURATION = 0.35;

function ease(progress) {
  const value = Math.min(1, Math.max(0, progress));
  return value * value * (3 - 2 * value);
}

export function createGreetingSequence(onTurned) {
  let phase = "waiting";
  let waitingTime = 0;
  let turningTime = 0;
  let wavingTime = 0;

  function finishTurn(reducedMotion) {
    phase = "greeting";
    wavingTime = reducedMotion ? WAVE_BLEND_DURATION : 0;
    onTurned();
  }

  return {
    get phase() {
      return phase;
    },
    get hintVisible() {
      return phase === "waiting" && waitingTime >= HINT_DELAY;
    },
    get heading() {
      if (phase === "waiting") return Math.PI;
      if (phase === "turning")
        return Math.PI * (1 - ease(turningTime / TURN_DURATION));
      return 0;
    },
    get waveBlend() {
      return phase === "greeting" ? ease(wavingTime / WAVE_BLEND_DURATION) : 0;
    },
    start(reducedMotion = false) {
      if (phase !== "waiting") return false;
      phase = "turning";
      if (reducedMotion) finishTurn(true);
      return true;
    },
    update(delta, reducedMotion = false) {
      const elapsed = Math.max(0, delta);
      if (phase === "waiting") waitingTime += elapsed;
      if (phase === "turning") {
        turningTime += elapsed;
        if (turningTime >= TURN_DURATION || reducedMotion)
          finishTurn(reducedMotion);
      }
      if (phase === "greeting") wavingTime += elapsed;
    },
  };
}
