import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parseHTML } from "linkedom";
import { categories, chatWithToro, createWordMemory, likes, teachWord, validWord } from "../src/word-lesson.js";
import { createWordRoom } from "../src/word-room.js";

function drive(script, answers) {
  let step = script.next();
  const pages = [];
  while (!step.done) {
    const page = step.value;
    pages.push(page);
    let reply;
    if (page.kind !== "speech") {
      assert.ok(answers.length, "Missing response to " + page.text);
      reply = answers.shift();
      if (page.kind === "choices") {
        const index = page.labels.indexOf(reply);
        assert.notEqual(index, -1, "Missing menu item " + reply);
        reply = index;
      }
    }
    step = script.next(reply);
  }
  assert.deepEqual(answers, []);
  return pages;
}
function store() {
  const items = new Map();
  return { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) };
}

test("all 18 categories can be taught at each of the five preference levels", () => {
  assert.equal(categories.length, 18);
  for (const c of categories) {
    for (const [like, label] of likes.entries()) {
      const memory = createWordMemory();
      const answers = ["Mint", c.label];
      if (c.types) answers.push(c.types[0]);
      if (["person", "celebrity"].includes(c.id)) answers.push("???");
      const pages = drive(teachWord(memory), [...answers, label, "아니야"]);
      assert.equal(pages[0].kind, "speech");
      assert.equal(pages[1].kind, "input");
      assert.equal(pages.at(-1).gesture, "wave");
      assert.equal(memory.find("MINT").category, c.id);
      assert.equal(memory.find("mint").like, like);
      assert.equal(memory.find("Mint").agrees, false);
    }
  }
});

test("recall, correction, cancellation and forgetting survive another visit", () => {
  const storage = store();
  const memory = createWordMemory(storage);
  drive(teachWord(memory), ["UWF", "단체 이름", "스포츠", "좋아해", "응"]);
  const revisited = createWordMemory(storage);
  const known = drive(teachWord(revisited), ["uwf", "맞아"]);
  assert.deepEqual(known.find(page => page.kind === "choices").labels, ["맞아", "아니야", "잊어버려!"]);
  const edit = teachWord(memory);
  edit.next(); edit.next(); edit.next("UWF"); edit.next(); edit.next(); edit.next(1);
  edit.return();
  assert.equal(revisited.find("UWF").type, "스포츠");
  drive(teachWord(memory), ["UWF", "아니야", "사람 이름", "돌아가기", "인사말", "만났을 때", "좋아해", "멋있어"]);
  assert.equal(revisited.find("UWF").type, "만났을 때");
  assert.equal(drive(teachWord(revisited), ["UWF", "잊어버려!"]).at(-1).face, "sad");
  assert.equal(memory.find("UWF"), undefined);
});

test("Toro can ask about a sweetheart, remember the relationship and be comforted", () => {
  const memory = createWordMemory();
  const history = {};
  const pages = drive(chatWithToro(memory, history),
    ["알려 줄게", "Cake", "다시 입력할래", "Kebaab", "응", "남자", "연인이야"]);
  assert.equal(pages.at(-1).face, "sad");
  assert.equal(history.sad, true);
  assert.equal(memory.find("Cake"), undefined);
  const known = drive(teachWord(memory), ["Kebaab", "맞아"]);
  assert.ok(known.some(page => page.text?.includes("사귀는 사람 이름")));
  drive(chatWithToro(memory, history), ["기운 내"]);
  assert.equal(history.sad, false);
  const recall = drive(chatWithToro(memory, {}), []);
  assert.ok(recall.some(page => page.text.includes("Kebaab")));
  const privateMemory = createWordMemory();
  drive(chatWithToro(privateMemory, {}), ["비밀이야"]);
  drive(chatWithToro(privateMemory, {}), ["알려 줄게", "Rose", "역시 그만둘래"]);
  assert.equal(privateMemory.list().length, 0);
});

test("the desktop controls accept only English and connect the PocketStation to teaching", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const { window, document } = parseHTML(html);
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  globalThis.window = window;
  globalThis.document = document;
  try {
    const room = document.querySelector("#word-room");
    let closed = 0;
    const session = createWordRoom(room, { onReaction() {}, onClose() { closed++; }, reducedMotion: () => true });
    const click = selector => room.querySelector(selector).click();
    const key = text => [...room.querySelectorAll(".lcd-row button")].find(b => b.getAttribute("aria-label") === text).click();
    const word = room.querySelector("#pocket-word");
    assert.ok(session.start("teach"));
    click(".toro-bubble");
    assert.deepEqual([...room.querySelectorAll(".lcd-row:first-child button")].map(b => b.textContent), [..."ABCDE"]);
    key("C"); key("C"); key("A"); key("a");
    assert.equal(word.value, "Ca");
    click(".pocket-edit"); key("한 자 지움");
    assert.equal(word.value, "C");
    word.value = "케이크"; word.dispatchEvent(new window.Event("input"));
    assert.equal(word.value, "C");
    word.value = "C9"; word.dispatchEvent(new window.Event("input"));
    assert.equal(word.value, "C");
    word.value = "Cake"; word.dispatchEvent(new window.Event("input"));
    click(".pocket-edit"); key("입력 결정");
    click(".toro-bubble");
    assert.equal(room.querySelector(".answer-list button").textContent, "유명인");
    click(".answer-down");
    click(".answer-current");
    click(".toro-bubble"); click(".answer-current");
    click(".toro-bubble"); click(".answer-current");
    click(".toro-bubble"); click(".toro-bubble");
    assert.equal(closed, 1);
    assert.ok(room.hidden);
    session.start("teach"); click(".toro-bubble");
    word.value = "cake"; word.dispatchEvent(new window.Event("input"));
    click(".pocket-edit"); key("입력 결정");
    click(".toro-bubble"); click(".toro-bubble");
    assert.deepEqual([...room.querySelectorAll(".answer-list button")].map(b => b.textContent), ["맞아", "아니야", "잊어버려!"]);
    assert.ok(validWord("Kebaab"));
    for (const value of ["", "Cake1", "ㅎ", "Ａ", "a b", "mmmmmmm"]) assert.equal(validWord(value, false), false);
  } finally {
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
  }
});

test("mobile conversation accepts a Korean IME word, pages through all choices and reacts while waiting", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const { window, document } = parseHTML(html);
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  const oldMedia = window.matchMedia;
  const compact = { matches: true, addEventListener(event, handler) { this.resize = handler; } };
  globalThis.window = window;
  globalThis.document = document;
  window.matchMedia = () => compact;
  try {
    document.documentElement.dataset.device = "mobile";
    const room = document.querySelector("#word-room");
    const field = room.querySelector("#pocket-word");
    const done = room.querySelector(".pocket-done");
    const reactions = [];
    const session = createWordRoom(room, {
      onReaction: (...reaction) => reactions.push(reaction), onClose() {}, reducedMotion: () => false,
    });
    session.start("teach");
    room.click();
    assert.equal(room.dataset.page, "speech");
    room.click();
    assert.equal(room.dataset.page, "input");
    room.querySelector(".pocket-keyboard").click();
    assert.ok(room.querySelector(".pocket").classList.contains("typing"));
    assert.ok(done.disabled);
    const send = (event, value) => {
      if (value !== undefined) field.value = value;
      field.dispatchEvent(new window.Event(event));
    };
    send("compositionstart");
    send("input", "ㄸ");
    assert.equal(field.value, "ㄸ");
    send("compositionend", "딸기".normalize("NFD"));
    assert.equal(field.value, "딸기");
    send("input", "딸기Cake");
    send("input", "딸기Cake!");
    assert.equal(field.value, "딸기Cake");
    room.querySelector(".pocket-keyboard").click();
    assert.equal(room.querySelector(".pocket").classList.contains("typing"), false);
    room.querySelector(".pocket-keyboard").click();
    send("compositionstart");
    send("input", "딸기Cake");
    done.click();
    room.click(); room.click();
    assert.ok(room.querySelector(".answer-question").textContent.includes("딸기Cake"));
    assert.deepEqual(reactions.at(-1), ["surprised", "curious"]);
    session.update(2.1);
    assert.deepEqual(reactions.at(-1), ["cheerful", "listen"]);
    const labels = () => [...room.querySelectorAll(".answer-list button")].map(b => b.textContent);
    const all = [...labels()];
    while (!room.querySelector(".answer-down").disabled) {
      room.querySelector(".answer-down").click();
      all.push(...labels());
    }
    assert.deepEqual(all, categories.map(c => c.label));
    assert.equal(room.querySelector(".answer-page").textContent, "5 / 5");
    compact.matches = false;
    compact.resize();
    assert.equal(room.querySelector(".answer-page").textContent, "3 / 3");
    room.querySelector(".answer-list button:last-child").click();
    room.click(); room.click();
    assert.deepEqual(reactions.at(-1), ["excited", "paws"]);
    room.querySelector(".answer-list button:last-child").click();
    assert.equal(reactions.at(-1)[0], "surprised");
    room.click(); room.click();
    assert.deepEqual(reactions.at(-1), ["worried", "paws"]);
    room.querySelector(".answer-list button").click();
    const afterAnswer = reactions.length;
    session.update(3);
    assert.equal(reactions.length, afterAnswer);
  } finally {
    if (oldMedia) window.matchMedia = oldMedia;
    else delete window.matchMedia;
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
  }
});

test("mobile words fit the LCD and share a vocabulary with words learned on the English keypad", () => {
  assert.equal(validWord("딸기Cake"), true);
  assert.equal(validWord("딸기Cakes"), false);
  const storage = store();
  const memory = createWordMemory(storage);
  drive(teachWord(memory), ["Cake", "먹을 것", "좋아해", "아니야"]);
  drive(teachWord(memory), ["딸기Cake", "먹을 것", "아주 좋아해", "아니야"]);
  const revisited = createWordMemory(storage);
  assert.equal(revisited.find("딸기cake".normalize("NFD")).word, "딸기Cake");
  assert.equal(revisited.find("CAKE").category, "food");
  drive(teachWord(revisited), ["딸기Cake", "맞아"]);
});
