import { validWord, lcdWidth } from "./word-lesson.js";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const letterRows = alphabet.match(/.{1,5}/g).map(row => [...row]);
const commands = ["한 자 지움", "입력 결정", "입력 그만"];
const allRows = [...letterRows, ...commands.map(label => [label])];
const directions = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
const inputHint = "방향키로 글자 선택 · ··· 편집";

export function createPocketInput(shell, submit) {
  const field = shell.querySelector("input");
  const grid = shell.querySelector(".pocket-grid");
  const hint = shell.querySelector(".pocket-hint");
  const confirm = shell.querySelector(".pad-ok");
  const keyboard = shell.querySelector(".pocket-keyboard");
  const done = shell.querySelector(".pocket-done");
  let rows, row, col, top, variant, previous, accepted = "", composing = false;
  let mobile = false;

  function showKeyboard(open) {
    shell.classList.toggle("typing", open);
    keyboard.textContent = open ? "자판으로" : "키보드 입력";
  }
  function defaultHint() {
    if (!mobile) return inputHint;
    return shell.classList.contains("typing") ? "한글 · 영문 입력" : "글자를 누르거나 키보드로 입력";
  }

  function render() {
    top = Math.max(0, Math.min(top, row));
    if (row >= top + 3) top = row - 2;
    grid.replaceChildren();
    for (let y = top; y < Math.min(rows.length, top + 3); y++) {
      const line = document.createElement("div");
      line.className = "lcd-row";
      for (const [x, text] of rows[y].entries()) {
        const key = document.createElement("button");
        key.type = "button";
        key.tabIndex = -1;
        key.textContent = text.length > 1 ? "[" + text + "]" : text;
        key.setAttribute("aria-label", text);
        key.className = row === y && col === x ? "lcd-cursor" : "";
        key.addEventListener("click", () => { row = y; col = x; activate(); });
        line.append(key);
      }
      grid.append(line);
    }
    confirm.setAttribute("aria-label", "선택 · " + rows[row][col]);
  }
  function changeRows(next, at = 0, column = 0, first = 0) {
    rows = next; row = at; col = column; top = first;
    render();
  }
  function restore() {
    variant = false;
    const [y, x, first] = previous;
    changeRows(allRows, y, x, first);
  }
  function edit() {
    if (rows === allRows && row < letterRows.length) previous = [row, col, top];
    variant = false;
    changeRows(allRows, letterRows.length + 1, 0, letterRows.length);
    confirm.focus({ preventScroll: true });
  }
  function setValue(value) {
    value = value.normalize("NFC");
    if (value && !validWord(value, mobile)) {
      hint.textContent = lcdWidth(value) > 32 ? "한 줄이 꽉 찼다냐!" :
        mobile ? "한글이나 영문으로 써 줘, 냐!" : "영문 A~Z만 들어간다냐!";
      field.value = accepted;
      return false;
    }
    accepted = value;
    if (field.value !== value) field.value = value;
    done.disabled = !value;
    hint.textContent = defaultHint();
    return true;
  }
  function finish() {
    if (composing) return;
    if (!validWord(accepted, mobile)) {
      hint.textContent = "가르쳐 줄 단어를 먼저 골라 줘!";
      if (!shell.classList.contains("typing")) restore();
      return;
    }
    submit(accepted);
  }
  function activate() {
    const key = rows[row][col];
    if (variant) {
      if (key !== "돌아가기") setValue(accepted + key);
      restore();
    } else if (key === commands[0]) {
      setValue(accepted.slice(0, -1));
      restore();
    } else if (key === commands[1]) {
      finish();
    } else if (key === commands[2]) {
      submit(null);
    } else {
      previous = [row, col, top];
      variant = true;
      changeRows([[key], [key.toLowerCase()], ["돌아가기"]]);
    }
    if (!shell.hidden) confirm.focus({ preventScroll: true });
  }
  function move(dir) {
    if (dir === "ok") { activate(); return; }
    if (dir === "up" || dir === "down") {
      row = (row + (dir === "up" ? -1 : 1) + rows.length) % rows.length;
      col = Math.min(col, rows[row].length - 1);
    } else {
      const offset = dir === "left" ? -1 : 1;
      col += offset;
      if (col < 0 || col >= rows[row].length) {
        row = (row + offset + rows.length) % rows.length;
        col = offset < 0 ? rows[row].length - 1 : 0;
      }
    }
    render();
  }
  for (const pad of shell.querySelectorAll("[data-pad]")) {
    pad.addEventListener("click", () => { move(pad.dataset.pad); });
  }
  shell.querySelector(".pocket-edit").addEventListener("click", edit);
  keyboard.addEventListener("click", () => {
    if (shell.classList.contains("typing")) {
      showKeyboard(false);
      restore();
      hint.textContent = defaultHint();
      confirm.focus({ preventScroll: true });
    } else field.focus({ preventScroll: true });
  });
  done.addEventListener("click", () => {
    if (composing) {
      composing = false;
      if (!setValue(field.value)) return;
    }
    finish();
  });
  field.addEventListener("focus", () => {
    variant = false;
    changeRows(allRows, letterRows.length + 1, 0, letterRows.length);
    if (mobile) showKeyboard(true);
    hint.textContent = mobile ? defaultHint() : "영문 입력 · Enter로 결정";
  });
  field.addEventListener("compositionstart", () => { composing = true; });
  field.addEventListener("compositionend", () => { composing = false; setValue(field.value); });
  field.addEventListener("input", () => {
    if (composing) done.disabled = !validWord(field.value.normalize("NFC"), mobile);
    else setValue(field.value);
  });
  shell.addEventListener("keydown", event => {
    if (event.isComposing || composing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Tab") return;
    if (event.target === field) {
      if (event.key === "Enter") { event.preventDefault(); finish(); }
      if (event.key === "Escape") {
        event.preventDefault();
        if (mobile) keyboard.click();
        else edit();
      }
      return;
    }
    if (directions[event.key]) {
      event.preventDefault();
      move(directions[event.key]);
      confirm.focus({ preventScroll: true });
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (variant || row >= letterRows.length) restore();
      else edit();
    } else if (event.key === "Backspace") {
      event.preventDefault(); setValue(accepted.slice(0, -1));
    } else if (/^[A-Za-z]$/.test(event.key)) {
      event.preventDefault(); field.focus(); setValue(accepted + event.key);
    }
  });
  return {
    open(initial) {
      mobile = document.documentElement.dataset.device === "mobile";
      shell.setAttribute("aria-label", mobile ? "포켓스테이션 단어 입력기" : "포켓스테이션 영문 입력기");
      field.setAttribute("aria-label", mobile ? "가르칠 단어, 한글 또는 영문" : "가르칠 영단어");
      field.lang = mobile ? "ko" : "en";
      if (mobile) field.removeAttribute("pattern");
      else field.setAttribute("pattern", "[A-Za-z]*");
      showKeyboard(false);
      composing = false; variant = false; previous = [0, 0, 0];
      setValue(initial || "");
      changeRows(allRows);
      confirm.focus({ preventScroll: true });
    },
  };
}
