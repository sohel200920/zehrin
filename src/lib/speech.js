let voices = [];

function loadVoices() {
  if (!("speechSynthesis" in window)) return;
  const available = speechSynthesis.getVoices();
  if (available.length) voices = available;
}
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

function waitForVoices() {
  return new Promise((resolve) => {
    loadVoices();
    if (voices.length) return resolve();
    let attempts = 0;
    const timer = setInterval(() => {
      loadVoices();
      attempts++;
      if (voices.length || attempts >= 30) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
  });
}

function getHindiFemaleVoice() {
  const hindi = voices.filter((v) => {
    const lang = (v.lang || "").toLowerCase();
    return lang === "hi-in" || lang === "hi" || lang.startsWith("hi-");
  });
  if (!hindi.length) return voices.find((v) => (v.lang || "").toLowerCase().startsWith("en")) || voices[0] || null;
  const hints = ["female", "woman", "girl", "aditi", "priya", "neerja", "kalpana", "raveena", "veena", "swara", "lekha", "heera"];
  return (
    hindi.find((v) => hints.some((h) => (v.name || "").toLowerCase().includes(h))) ||
    hindi.find((v) => (v.lang || "").toLowerCase().includes("in")) ||
    hindi[0]
  );
}

const EMOJI_REGEX =
  /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\uFE0F\u200D]/gu;

function cleanTextForSpeech(text) {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // strip image markdown before speaking
    .replace(EMOJI_REGEX, "")
    .replace(/[*_~#>`]/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\S+@\S+\.\S+/g, "")
    .replace(/\s+/g, " ")
    .replace(/([!?।])\1+/g, "$1")
    .trim();
}

function pronunciationText(text) {
  return text
    .replace(/\bZEHRIN\b/gi, "ज़ेहरिन")
    .replace(/\bSohel\b/gi, "सोहेल")
    .replace(/\bBoss\b/gi, "बॉस")
    .replace(/\bAI\b/gi, "एआई")
    .replace(/\bAPI\b/gi, "एपीआई")
    .replace(/\bURL\b/gi, "यूआरएल")
    .replace(/\bHTML\b/gi, "एचटीएमएल")
    .replace(/\bCSS\b/gi, "सीएसएस")
    .replace(/\bJS\b/gi, "जेएस")
    .replace(/\bJavaScript\b/gi, "जावास्क्रिप्ट")
    .replace(/\bPython\b/gi, "पाइथन")
    .replace(/\bReact\b/gi, "रिएक्ट")
    .replace(/\bFirebase\b/gi, "फायरबेस")
    .replace(/\bSupabase\b/gi, "सुपाबेस")
    .replace(/\bGitHub\b/gi, "गिटहब")
    .replace(/\bVercel\b/gi, "वर्सेल")
    .replace(/\b(\d+)\s*%\b/g, "$1 प्रतिशत");
}

// Groups words into speakable chunks (<=180 chars), tracking each chunk's
// starting index in the shared word list so highlighting stays in sync.
function buildSpeechPlan(text) {
  const clean = cleanTextForSpeech(text);
  const words = clean.split(/\s+/).filter(Boolean);
  const chunks = [];
  let current = [];
  let currentLen = 0;
  let startIndex = 0;

  words.forEach((word, i) => {
    if (currentLen + word.length + 1 > 180 && current.length) {
      chunks.push({ words: current, startIndex });
      current = [];
      currentLen = 0;
      startIndex = i;
    }
    current.push(word);
    currentLen += word.length + 1;
  });
  if (current.length) chunks.push({ words: current, startIndex });

  return { words, chunks };
}

let activeQueue = [];
let activeCallbacks = null;

// Speak text in short chunks so long assistant replies remain reliable.
export function speak(text, speakingLevelRef, options = {}) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();

  const { chunks } = buildSpeechPlan(text);
  activeQueue = chunks;
  activeCallbacks = { ...options, speakingLevelRef };

  speakChunk(0);
}

async function speakChunk(chunkIndex) {
  const { onDone, speakingLevelRef } = activeCallbacks || {};

  if (chunkIndex >= activeQueue.length) {
    if (speakingLevelRef) speakingLevelRef.current = 0;
    onDone?.();
    return;
  }

  await waitForVoices();
  const voice = getHindiFemaleVoice();
  if (!voice) {
    if (speakingLevelRef) speakingLevelRef.current = 0;
    onDone?.();
    return;
  }

  const chunk = activeQueue[chunkIndex];
  const spokenText = pronunciationText(chunk.words.join(" "));
  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = "hi-IN";
  utterance.voice = voice;
  utterance.rate = 1;
  utterance.pitch = 1.06;
  utterance.volume = 1;

  utterance.onstart = () => {
    if (speakingLevelRef) speakingLevelRef.current = 1;
  };
  utterance.onend = () => {
    setTimeout(() => speakChunk(chunkIndex + 1), 40);
  };
  utterance.onerror = () => {
    setTimeout(() => speakChunk(chunkIndex + 1), 60);
  };

  speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  activeQueue = [];
  if (activeCallbacks) {
    if (activeCallbacks.speakingLevelRef) activeCallbacks.speakingLevelRef.current = 0;
  }
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}
