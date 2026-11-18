export function setupDisplayMode() {
  const viewer = document.querySelector("#viewer");
  const button = document.querySelector("#fullscreen-button");
  const help = document.querySelector("#display-help");
  const message = document.querySelector("#display-help-message");
  const steps = document.querySelector("#display-help-steps");
  const gate = document.querySelector("#display-gate");
  const viewport = document.querySelector("#viewport");
  const controls = document.querySelector(".controls");
  const landscape = matchMedia("(orientation: landscape)");
  const fullscreenDisplay = matchMedia("(display-mode: fullscreen)");
  const standaloneDisplay = matchMedia("(display-mode: standalone)");
  const touchMobile = matchMedia("(hover: none) and (pointer: coarse)");
  const appleMobile =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let pending = false;

  function isFullscreen() {
    return Boolean(
      document.fullscreenElement ||
        document.webkitFullscreenElement ||
        fullscreenDisplay.matches ||
        standaloneDisplay.matches ||
        navigator.standalone,
    );
  }

  function update() {
    const fullscreen = isFullscreen();
    const landscapeFullscreen = fullscreen && landscape.matches;
    const mobile =
      appleMobile ||
      navigator.userAgentData?.mobile ||
      /Android|Mobile/i.test(navigator.userAgent) ||
      touchMobile.matches;
    const blocked = Boolean(mobile && !landscapeFullscreen);
    button.hidden = landscapeFullscreen;
    button.disabled = pending;
    document.documentElement.dataset.viewerState = blocked
      ? "blocked"
      : "ready";
    gate.hidden = !blocked;
    gate.textContent = fullscreen
      ? "기기를 가로로 돌려 주세요."
      : "가로 전체화면으로 열어 주세요.";
    for (const element of [viewport, controls]) {
      element.inert = blocked;
      element.setAttribute("aria-hidden", String(blocked));
    }
    if (
      blocked &&
      (viewport.contains(document.activeElement) ||
        controls.contains(document.activeElement))
    ) {
      button.focus({ preventScroll: true });
    }
    document.documentElement.dataset.displayMode = fullscreen
      ? "fullscreen"
      : "browser";
    document.documentElement.dataset.orientation = landscape.matches
      ? "landscape"
      : "portrait";
    if (button.hidden && help.open) help.close();
  }

  function showHelp(reason) {
    steps.hidden = !appleMobile || isFullscreen();
    if (isFullscreen()) {
      message.textContent = "기기의 회전 잠금을 해제하고 가로로 돌려 주세요.";
    } else if (appleMobile) {
      message.textContent =
        "iPhone Safari에서 주소창 없이 보려면 홈 화면에서 웹 앱으로 실행해야 합니다.";
      steps.textContent =
        "Safari 공유 → 홈 화면에 추가 → 추가한 아이콘으로 실행 → 기기를 가로로 돌리기. “웹 앱으로 열기”가 표시되면 켜 주세요.";
    } else {
      message.textContent =
        reason === "orientation"
          ? "전체화면으로 전환했습니다. 기기를 가로로 돌려 주세요."
          : "브라우저에서 전체화면 전환을 허용하지 않았습니다. 브라우저의 전체화면 메뉴를 이용해 주세요.";
    }
    if (!help.open) help.showModal();
  }

  button.addEventListener("click", async () => {
    if (pending) return;
    pending = true;
    update();
    const request = viewer.requestFullscreen || viewer.webkitRequestFullscreen;
    try {
      if (!isFullscreen()) {
        if (!request) {
          showHelp("fullscreen");
          return;
        }
        await request.call(viewer);
      }
      if (screen.orientation?.lock) {
        try {
          await screen.orientation.lock("landscape");
        } catch {
          // Desktop browsers and some mobile browsers cannot lock orientation.
        }
      }
      if (!landscape.matches) showHelp("orientation");
    } catch {
      showHelp("fullscreen");
    } finally {
      pending = false;
      update();
    }
  });

  document
    .querySelector("#display-help-close")
    .addEventListener("click", () => help.close());
  document.addEventListener("fullscreenchange", update);
  document.addEventListener("webkitfullscreenchange", update);
  window.addEventListener("resize", update);
  landscape.addEventListener("change", update);
  fullscreenDisplay.addEventListener("change", update);
  standaloneDisplay.addEventListener("change", update);
  touchMobile.addEventListener("change", update);
  update();
}
