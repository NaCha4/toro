import { chatWithToro, createWordMemory, teachWord } from "./word-lesson.js";
import { createPocketInput } from "./pocket-input.js";

export function createWordRoom(element, { onReaction, onClose, reducedMotion }) {
  const bubble = element.querySelector(".toro-bubble");
  const line = element.querySelector(".bubble-line");
  const answers = element.querySelector(".answer-box");
  const list = element.querySelector(".answer-list");
  const up = element.querySelector(".answer-up");
  const down = element.querySelector(".answer-down");
  const question = element.querySelector(".answer-question");
  const pageCount = element.querySelector(".answer-page");
  const shortScreen = window.matchMedia?.("(max-height: 490px)");
  const isMobile = () => document.documentElement.dataset.device === "mobile";
  const shell = element.querySelector(".pocket");
  const announcement = element.querySelector(".word-announcement");
  let storage;
  try { storage = window.localStorage; } catch { /* This visit can still learn words. */ }
  const memory = createWordMemory(storage);
  const history = {};
  const pocket = createPocketInput(shell, advance);
  let dialogue, page, selected = 0, letters = 0, waiting = 0;

  function pageSize() { return isMobile() && shortScreen?.matches ? 4 : 6; }
  function paintChoices() {
    const labels = page.labels;
    const size = pageSize();
    const number = Math.floor(selected / size);
    const first = number * size;
    list.replaceChildren();
    up.disabled = first === 0;
    down.disabled = first + size >= labels.length;
    up.textContent = isMobile() ? "◀ 이전" : "▲";
    down.textContent = isMobile() ? "다음 ▶" : "▼";
    answers.dataset.paged = String(labels.length > size);
    pageCount.textContent = (number + 1) + " / " + Math.ceil(labels.length / size);
    for (let i = first; i < Math.min(first + size, labels.length); i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = labels[i];
      button.tabIndex = i === selected ? 0 : -1;
      button.classList.toggle("answer-current", i === selected);
      button.addEventListener("click", () => advance(i));
      list.append(button);
    }
    list.querySelector(".answer-current")?.focus({ preventScroll: true });
  }
  function moveChoice(amount) {
    selected = (selected + amount + page.labels.length) % page.labels.length;
    paintChoices();
  }
  function turnPage(direction) {
    const size = pageSize();
    selected = Math.max(0, Math.min(page.labels.length - 1, (Math.floor(selected / size) + direction) * size));
    paintChoices();
  }
  function close() {
    dialogue?.return();
    dialogue = page = null;
    element.hidden = true;
    bubble.hidden = answers.hidden = shell.hidden = true;
    announcement.textContent = "";
    onClose(history.sad ? "sad" : "normal");
  }
  function advance(answer) {
    if (!dialogue) return;
    const step = dialogue.next(answer);
    if (step.done) { close(); return; }
    page = step.value;
    waiting = 0;
    bubble.hidden = page.kind !== "speech";
    answers.hidden = page.kind !== "choices";
    shell.hidden = page.kind !== "input";
    element.dataset.page = page.kind;
    onReaction(page.face, page.gesture);
    if (!bubble.hidden) {
      letters = reducedMotion() ? page.text.length : 1;
      line.textContent = page.text.slice(0, letters);
      bubble.classList.toggle("complete", letters >= page.text.length);
      announcement.textContent = page.text;
      bubble.focus({ preventScroll: true });
    } else if (!answers.hidden) {
      selected = 0;
      answers.setAttribute("aria-label", page.text);
      question.textContent = page.text;
      paintChoices();
    } else {
      announcement.textContent = isMobile() ? "가르칠 단어를 한글이나 영문으로 입력해 주세요." : "가르칠 영단어를 입력해 주세요.";
      pocket.open(page.initial);
    }
  }
  function continueSpeech() {
    if (letters < page.text.length) {
      letters = page.text.length;
      line.textContent = page.text;
      bubble.classList.add("complete");
    } else advance();
  }
  bubble.addEventListener("click", continueSpeech);
  element.addEventListener("click", event => {
    if (event.target === element && isMobile() && page?.kind === "speech") continueSpeech();
  });
  shortScreen?.addEventListener("change", () => {
    if (page?.kind === "choices") paintChoices();
  });
  up.addEventListener("click", () => turnPage(-1));
  down.addEventListener("click", () => turnPage(1));
  answers.addEventListener("wheel", event => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    moveChoice(Math.sign(event.deltaY));
  }, { passive: false });
  element.addEventListener("keydown", event => {
    if (!page || event.isComposing || event.keyCode === 229) return;
    if (page.kind === "input") return;
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (page.kind === "choices" && ["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Home") { selected = 0; paintChoices(); }
      else if (event.key === "End") { selected = page.labels.length - 1; paintChoices(); }
      else moveChoice(event.key === "ArrowUp" ? -1 : 1);
    }
  });
  return {
    get active() { return Boolean(dialogue); },
    start(mode) {
      if (dialogue) return false;
      dialogue = mode === "chat" ? chatWithToro(memory, history) : teachWord(memory);
      element.hidden = false;
      advance();
      return true;
    },
    update(delta) {
      if (page?.kind === "choices" && !reducedMotion() && waiting < 2) {
        waiting += delta;
        if (waiting >= 2) onReaction(...page.settled);
      }
      if (page?.kind !== "speech" || letters >= page.text.length) return;
      const previous = Math.floor(letters);
      letters = Math.min(page.text.length, letters + delta * 23);
      if (previous !== Math.floor(letters)) line.textContent = page.text.slice(0, Math.floor(letters));
      if (letters === page.text.length) bubble.classList.add("complete");
    },
  };
}
