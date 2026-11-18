// The order matches the scrolling category menu in the 1999 PlayStation game.
// Unfilmed follow-ups and conversation lines are written for the Korean room.
export const categories = [
  { id: "celebrity", label: "유명인", question: "어떤 일로 유명한 사람이냐?", types: ["가수", "배우", "운동선수", "방송인", "그 밖의 사람"] },
  { id: "person", label: "사람 이름", question: "어떤 사이인지 알려 줄래?", types: ["연인", "친구", "짝사랑 상대", "가족", "캐릭터", "로봇", "그 밖의 사람"] },
  { id: "job", label: "직업" },
  { id: "group", label: "단체 이름", question: "어떤 단체냐?", types: ["스포츠", "회사", "그 밖의 단체"] },
  { id: "action", label: "하는 일" },
  { id: "place", label: "가는 곳", question: "어떤 곳이냐?", types: ["놀러 가는 곳", "가게", "동네 이름", "그 밖의 곳"] },
  { id: "food", label: "먹을 것" },
  { id: "drink", label: "마실 것" },
  { id: "living", label: "생물" },
  { id: "song", label: "곡 제목" },
  { id: "watch", label: "보는 것" },
  { id: "use", label: "사용하는 것" },
  { id: "wear", label: "몸에 착용하는 것" },
  { id: "vehicle", label: "탈것" },
  { id: "greeting", label: "인사말", question: "이건 언제 하는 인사냐?", types: ["만났을 때", "헤어질 때", "그 밖의 인사"] },
  { id: "gag", label: "개그" },
  { id: "body", label: "몸의 일부" },
  { id: "illness", label: "병" },
];

export const likes = ["아주 좋아해", "좋아해", "보통이야", "싫어해", "아주 싫어해"];
const genders = ["남자", "여자", "???"];
const back = "돌아가기";
const prompts = {
  cool: ["멋있어 보이냐?", "멋있어"],
  heart: ["가슴이 두근두근해?", "두근거려"],
  see: ["직접 보고 싶어?", "응"],
  useful: ["세상에 도움이 된다고 생각해?", "도움이 된다고 생각해"],
  energy: ["힘이 불끈 나는 비결이냐?", "힘의 원천이야"],
  pretty: ["예쁘다고 생각해?", "예뻐"],
  exciting: ["생각만 해도 신이 나?", "신이 나"],
  rich: ["부자랑 관계가 있냐?", "관계있어"],
  tricky: ["조금 어렵냐?", "어려워"],
  scary: ["생각하면 무섭냐?", "무서워"],
  gentle: ["살살 다뤄 줘야 해?", "그래야 해"],
  curious: ["토로가 더 알아봐도 될까?", "응"],
};
const impressions = {
  celebrity: "see", person: "heart", job: "cool", group: "see", action: "rich",
  place: "exciting", food: "pretty", drink: "energy", living: "gentle", song: "heart",
  watch: "see", use: "useful", wear: "useful", vehicle: "exciting", greeting: "cool",
  gag: "energy", body: "gentle", illness: "scary",
};

export function cleanWord(value) {
  return value.normalize("NFC").replace(/[\p{C}\p{Zl}\p{Zp}]/gu, "").replace(/\s+/gu, " ").trim();
}

// A line on the PocketStation LCD is 32 dots. Thin letters leave more room.
export function lcdWidth(value) {
  let width = 0;
  for (const ch of value) {
    if (/\p{Script=Hangul}/u.test(ch)) width += 8;
    else if ("ilI".includes(ch)) width += 2;
    else if ("MWmw".includes(ch)) width += 5;
    else width += 4;
  }
  return width;
}

export function validWord(value, allowHangul = true) {
  const letters = allowHangul ? /^[A-Za-z\p{Script=Hangul}]+$/u : /^[A-Za-z]+$/;
  return letters.test(value) && lcdWidth(value) <= 32;
}

const storageKey = "toro.room.words.v1";
const keyOf = (word) => cleanWord(word).toLowerCase();
export function createWordMemory(storage) {
  const words = new Map();
  function read() {
    if (!storage) return;
    try {
      const records = JSON.parse(storage.getItem(storageKey) || "[]");
      if (!Array.isArray(records)) return;
      words.clear();
      for (const entry of records) {
        if (typeof entry?.word === "string" && validWord(entry.word) && categories.some(c => c.id === entry.category))
          words.set(keyOf(entry.word), entry);
      }
    } catch { storage = null; }
  }
  function write(change) {
    read();
    change();
    try { storage?.setItem(storageKey, JSON.stringify([...words.values()])); }
    catch { storage = null; }
  }
  return {
    find(word) { read(); return words.get(keyOf(word)); },
    list() { read(); return [...words.values()]; },
    remember(entry) { write(() => words.set(keyOf(entry.word), { ...entry })); },
    forget(word) { write(() => words.delete(keyOf(word))); },
  };
}

const say = (text, face = "normal", gesture = "listen") => ({ kind: "speech", text, face, gesture });
// First catch the player's eye, then settle into a pose that suits the question.
const waitingReactions = {
  curious: [["surprised", "curious"], ["cheerful", "listen"]],
  recall: [["delighted", "proud"], ["smile", "curious"]],
  hopeful: [["excited", "paws"], ["smile", "listen"]],
  shy: [["content", "shy"], ["cheerful", "paws"]],
  worried: [["worried", "paws"], ["calm", "curious"]],
  sad: [["pleading", "droop"], ["sad", "listen"]],
};
function* ask(text, labels, face = "normal", gesture = "curious", mood = "curious") {
  yield say(text, face, gesture);
  const [[waitingFace, waitingGesture], settled] = waitingReactions[mood];
  return yield { kind: "choices", text, labels, face: waitingFace, gesture: waitingGesture, settled };
}
function* inputWord(initial = "") {
  return yield { kind: "input", initial, face: "laugh", gesture: "paws" };
}

function rememberedMeaning(entry) {
  const category = categories.find(item => item.id === entry.category);
  if (entry.category === "person") {
    if (entry.type === "연인") return "네가 사귀는 사람 이름이잖아, 냐!";
    if (entry.type === "짝사랑 상대") return "네가 남몰래 좋아하는 사람 이름이지, 냐!";
    if (entry.type === "친구" || entry.type === "가족") return "네 " + entry.type + " 이름이잖아, 냐!";
    if (entry.type && entry.type !== "그 밖의 사람") return entry.type + " 이름이라고 했지, 냐!";
  }
  if (entry.category === "greeting" && entry.type && entry.type !== "그 밖의 인사")
    return entry.type + " 하는 인사지, 냐!";
  if (entry.category === "group" && entry.type === "스포츠") return "스포츠 단체 이름이잖아, 냐!";
  if (entry.category === "group" && entry.type === "회사") return "회사 이름이라고 했지, 냐!";
  return "‘" + category.label + "’이라고 가르쳐 줬지, 냐!";
}

const goodbyes = [
  ["우먀~ 새 말을 하나 외웠다냐!", "히히, 바이바~이!"],
  ["가르쳐 줘서 고맙다냐~", "토로랑 또 놀아 줘, 냐!"],
  ["후냐… 잊어버리면 안 되니까…", "토로, 꼭꼭 기억해 둘 거다냐. 또 놀자!"],
  ["가르쳐 줘서 고맙다냐!", "바이바~이! 또 보자, 냐!"],
];
export function* teachWord(memory, random = Math.random) {
  yield say("너무 길면 토로가 못 외운다냐~\n한 줄에 쏙 들어가는 말로 부탁해!", "cheerful", "curious");
  const word = yield* inputWord();
  if (!word) { yield say("다음에 생각나면 들려줘, 냐~", "content"); return; }
  const known = memory.find(word);
  if (known) {
    yield say("‘" + word + "’! 토로, 그 말 안다냐!", "laugh", "happy");
    const answer = yield* ask(rememberedMeaning(known), ["맞아", "아니야", "잊어버려!"], "content", "proud", "recall");
    if (answer === 0) {
      yield say("에헤헤. 토로가 제대로 기억했다냐!", "delighted", "happy");
      yield say("다음에 얘기할 때 또 써 봐야지, 냐~", "cheerful", "wave");
      return;
    }
    if (answer === 2) {
      memory.forget(word);
      yield say("우냐… 모처럼 열심히 외웠는데, 냐…", "pleading", "droop");
      yield say("후냐… 그럼… 이야기는 여기까지 할래, 냐…", "sad", "droop");
      return;
    }
    yield say("어라… 토로가 잘못 기억했냐? 다시 가르쳐 줘!", "worried", "shy");
  }
  let category, type;
  do {
    const index = yield* ask("‘" + word + "’… 그게 뭐냐?", categories.map(c => c.label));
    category = categories[index];
    if (!category.types) break;
    const detail = yield* ask("‘" + word + "’ 말이야.\n" + category.question, [...category.types, back]);
    type = category.types[detail];
  } while (type === undefined);
  const entry = { word, category: category.id, type: type ?? null };
  if (category.id === "person" || category.id === "celebrity") {
    entry.gender = genders[yield* ask("‘" + word + "’ 말이야. 남자야? 여자야?", genders, "normal", "curious")];
  }
  entry.like = yield* ask("있지, 너는 ‘" + word + "’ 좋아해?", likes, "smile", "curious", "hopeful");
  // Some impressions recur across categories. The attitude changes the next question.
  let impression = impressions[category.id];
  if (entry.like >= 3) impression = ["illness", "living", "vehicle"].includes(category.id) ? "scary" : "tricky";
  else if (entry.like === 2 && random() < 0.5) impression = "curious";
  else if (category.id === "food" && random() < 0.5) impression = "exciting";
  const [question, yes] = prompts[impression];
  entry.impression = impression;
  const mood = entry.like >= 3 || impression === "scary" ? "worried" :
    impression === "heart" ? "shy" : entry.like === 2 ? "curious" : "hopeful";
  const preferenceFaces = ["delighted", "cheerful", "calm", "worried", "surprised"];
  entry.agrees = (yield* ask("‘" + word + "’ 말이야.\n" + question, [yes, "아니야"],
    preferenceFaces[entry.like], "curious", mood)) === 0;
  memory.remember(entry);
  const ending = goodbyes[Math.floor(random() * goodbyes.length)];
  yield say(ending[0], entry.agrees ? "content" : "cheerful", entry.agrees ? "happy" : "shy");
  yield say(ending[1], "laugh", "wave");
}

function* relationship(memory) {
  const tell = yield* ask("있지, 네가 사랑하는 사람은 누구냐?\n토로한테도 살짝 알려 줘~", ["알려 줄게", "비밀이야"], "smile", "shy", "shy");
  if (tell === 1) { yield say("쉿… 비밀이구나. 토로도 입 꾹 다물 거다냐!", "content", "shy"); return; }
  let word = "";
  while (true) {
    word = yield* inputWord(word);
    if (!word) { yield say("다음에 둘이서 얘기하자, 냐~", "content"); return; }
    const confirm = yield* ask("‘" + word + "’이라고 부르면 되냐?", ["응", "다시 입력할래", "역시 그만둘래"], "smile", "curious", "recall");
    if (confirm === 0) break;
    if (confirm === 2) { yield say("응, 네가 말하고 싶을 때 들려줘, 냐.", "calm"); return; }
  }
  const gender = genders[yield* ask("‘" + word + "’ 말이야. 남자야? 여자야?", genders)];
  const dating = (yield* ask("너… ‘" + word + "’하고 사귀고 있는 거냐?", ["연인이야", "짝사랑이야"], "normal", "shy", "worried")) === 0;
  memory.remember({ word, category: "person", type: dating ? "연인" : "짝사랑 상대", gender });
  if (dating) {
    yield say("그렇구나… 너한테는 연인이 있구나, 냐…", "worried", "shy");
    yield say("어째서지… 토로, 조금 슬퍼졌어. 왜 그런 걸까냐…", "pleading", "droop");
    yield say("후냐… 지금은 이야기를 그만하고 싶다냐…", "sad", "droop");
    return "sad";
  }
  yield say("아직 마음속으로만 좋아하는 거구나, 냐.", "content", "shy");
  yield say("언젠가 그 마음이 닿으면 좋겠다냐. 토로가 응원할게!", "smile", "happy");
}

const recollections = {
  celebrity: "토로도 유명해지면 같이 사진 찍을 수 있을까냐?",
  person: "문득 이름이 떠올랐다냐. 오늘은 뭘 하고 있을까?",
  job: "토로도 사람이 되면 그 일을 할 수 있을까냐?",
  group: "거기에 토로가 놀러 가도 반겨 줄까냐?",
  action: "토로 혼자서도 해낼 수 있을까? 곁에서 봐 줄래, 냐?",
  place: "언젠가 너랑 거기 같이 가 보고 싶다냐~",
  food: "오늘 저녁에 나오면 어떤 냄새가 날까냐?",
  drink: "한 모금 마시면 수염에도 묻을까냐?",
  living: "토로처럼 낮잠 자는 걸 좋아할까냐?",
  song: "그 노래는 어떻게 부르냐? 첫 소절만 들려줘~",
  watch: "옆자리는 비워 둘게. 토로랑 같이 보자, 냐!",
  use: "토로 앞발로도 잘 쓸 수 있을까냐?",
  wear: "토로한테도 어울릴까? 거울을 보고 싶다냐.",
  vehicle: "창가 자리에 앉으면 저 멀리까지 보일까냐?",
  greeting: "토로, 인사를 연습했어. 들어 봐 줄래, 냐?",
  gag: "다음에 네가 풀이 죽으면 토로가 그 말 해 줄게, 냐!",
  body: "토로한테도 있는지 거울을 들여다봤다냐.",
  illness: "네가 아프면 토로가 옆에 꼭 붙어 있을게, 냐.",
};

export function* chatWithToro(memory, history) {
  if (history.sad) {
    const choice = yield* ask("후냐… 지금은 별로 이야기하고 싶지 않다냐…", ["기운 내", "가만히 둘게"], "sad", "droop", "sad");
    history.sad = false;
    yield choice === 0 ? say("…토로 걱정해 준 거냐? 고마워. 조금 따뜻해졌어.", "content", "shy")
      : say("응… 조금만 이러고 있을게, 냐.", "calm", "droop");
    return;
  }
  const words = memory.list();
  const knowsSweetheart = words.some(entry => entry.category === "person" && ["연인", "짝사랑 상대"].includes(entry.type));
  if ((!history.asked && !knowsSweetheart) || !words.length) {
    history.asked = true;
    history.sad = (yield* relationship(memory)) === "sad";
    return;
  }
  const entry = words[(history.recalled ?? 0) % words.length];
  history.recalled = (history.recalled ?? 0) + 1;
  yield say("‘" + entry.word + "’… " + rememberedMeaning(entry), "content", "proud");
  if (entry.agrees && entry.impression === "heart")
    yield say("그 이름만 들어도 가슴이 두근거린댔지? 토로 귀에도 쿵쿵 소리가 들리는 것 같다냐.", "cheerful", "shy");
  else if (entry.agrees && entry.impression === "energy")
    yield say("네가 기운 나는 비결이라고 했잖아. 오늘 힘들면 토로가 살짝 귀띔해 줄게, 냐!", "smile", "happy");
  else if (entry.agrees && entry.impression === "scary")
    yield say("무섭다고 했지? 토로 앞발, 꼭 잡아도 된다냐.", "worried", "paws");
  else if (entry.like >= 3) yield say("넌 별로 안 좋아한다고 했지… 토로가 그것도 기억한다냐.", "calm", "shy");
  else yield say(recollections[entry.category], "cheerful", "curious");
}
