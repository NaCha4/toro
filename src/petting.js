import * as THREE from "three";

const HINT_DELAY = 3;
const DRAG_THRESHOLD = 5;

function settle(axis, target, delta) {
  const frequency = 14;
  const offset = axis.value - target;
  const step = (axis.velocity + frequency * offset) * delta;
  const decay = Math.exp(-frequency * delta);
  axis.value = target + (offset + step) * decay;
  axis.velocity = (axis.velocity - frequency * step) * decay;
}

export function createPettingMotion() {
  const axes = {
    x: { value: 0, velocity: 0 },
    y: { value: 0, velocity: 0 },
    pressure: { value: 0, velocity: 0 },
  };
  const target = { x: 0, y: 0, pressure: 0 };
  let enabled = false;
  let idleTime = 0;
  let contact = null;
  let rubbing = false;

  function cancel() {
    contact = null;
    rubbing = false;
    idleTime = 0;
    target.x = 0;
    target.y = 0;
    target.pressure = 0;
  }

  return {
    get enabled() {
      return enabled;
    },
    get pointerId() {
      return contact?.id ?? null;
    },
    get rubbing() {
      return rubbing;
    },
    get hintVisible() {
      return enabled && !contact && idleTime >= HINT_DELAY;
    },
    get pose() {
      return {
        x: axes.x.value,
        y: axes.y.value,
        pressure: axes.pressure.value,
      };
    },
    setEnabled(value) {
      enabled = value;
      cancel();
    },
    begin(id, x, y, width, height) {
      if (!enabled || contact) return false;
      idleTime = 0;
      contact = {
        id,
        x,
        y,
        width: Math.max(width, 1),
        height: Math.max(height, 1),
        baseX: axes.x.value,
        baseY: axes.y.value,
      };
      target.x = axes.x.value;
      target.y = axes.y.value;
      return true;
    },
    move(id, x, y) {
      if (!contact || contact.id !== id) return false;
      const dx = x - contact.x;
      const dy = y - contact.y;
      if (!rubbing && Math.hypot(dx, dy) < DRAG_THRESHOLD) return false;
      const started = !rubbing;
      rubbing = true;
      idleTime = 0;
      target.x = THREE.MathUtils.clamp(
        contact.baseX + (dx / contact.width) * 2.4,
        -1,
        1,
      );
      target.y = THREE.MathUtils.clamp(
        contact.baseY + (dy / contact.height) * 2,
        -1,
        1,
      );
      target.pressure = 1;
      return started;
    },
    end(id) {
      if (contact?.id !== id) return;
      cancel();
    },
    cancel,
    update(delta) {
      const elapsed = Math.max(0, delta);
      if (enabled && !contact) idleTime += elapsed;
      for (const name of Object.keys(axes))
        settle(axes[name], target[name], elapsed);
    },
  };
}

export function bindHeadPetting({
  canvas,
  head,
  camera,
  motion,
  canInteract,
  onStroke,
}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const corner = new THREE.Vector3();

  function release() {
    const id = motion.pointerId;
    motion.cancel();
    if (id !== null && canvas.hasPointerCapture?.(id))
      canvas.releasePointerCapture(id);
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (event.isPrimary === false || event.button !== 0 || !canInteract())
      return;
    if (motion.pointerId !== null) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    camera.updateMatrixWorld();
    head.updateWorldMatrix(true, false);
    head.computeBoundingSphere();
    head.computeBoundingBox();
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.intersectObject(head, false).length) return;

    const bounds = head.boundingBox.clone().applyMatrix4(head.matrixWorld);
    let left = Infinity,
      right = -Infinity,
      top = Infinity,
      bottom = -Infinity;
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          corner.set(x, y, z).project(camera);
          left = Math.min(left, corner.x);
          right = Math.max(right, corner.x);
          top = Math.min(top, corner.y);
          bottom = Math.max(bottom, corner.y);
        }
      }
    }
    const width = Math.min(rect.width, ((right - left) * rect.width) / 2);
    const height = Math.min(rect.height, ((bottom - top) * rect.height) / 2);
    if (
      motion.begin(event.pointerId, event.clientX, event.clientY, width, height)
    ) {
      canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    }
  });
  window.addEventListener("pointermove", (event) => {
    if (!canInteract()) {
      release();
      return;
    }
    if (motion.move(event.pointerId, event.clientX, event.clientY)) onStroke();
  });
  window.addEventListener("pointerup", (event) => motion.end(event.pointerId));
  window.addEventListener("pointercancel", (event) =>
    motion.end(event.pointerId),
  );
  canvas.addEventListener("lostpointercapture", (event) =>
    motion.end(event.pointerId),
  );
  window.addEventListener("blur", release);
  window.addEventListener("resize", release);
  document.addEventListener("fullscreenchange", release);
  document.addEventListener("webkitfullscreenchange", release);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) release();
  });
}
