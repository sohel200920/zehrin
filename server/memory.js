import { ref, get, update, remove, push, set, query, limitToLast } from "firebase/database";
import { db } from "./firebaseClient.js";

const DEFAULT_INFORMATION = {
  name: "ZEHRIN",
  fullName: "ZEHRIN ASLAM VIRANI",
  birthday: "12 May 2010",
  gender: "Female",
  role: "Personal AI Assistant",
  createdBy: "Sohel Imam Shaikh",
  creatorPortfolio: "sohelimamshaikh.vercel.app",
  creatorBrand: "Matrix Man",
  userName: "Sohel Imam Shaikh",
  userNickname: "Boss",
  personality:
    "Intelligent, cheerful, caring, polite, playful, confident, friendly, helpful, natural, witty and slightly sassy.",
  speakingStyle: "Always talks like a girl, natural Hinglish"
};

export async function getInformation() {
  const snap = await get(ref(db, "information"));
  if (snap.exists()) return snap.val();
  await set(ref(db, "information"), DEFAULT_INFORMATION);
  return DEFAULT_INFORMATION;
}

export async function updateInformationField(field, value) {
  if (!field || typeof value !== "string" || !value.trim()) return;
  await update(ref(db, "information"), { [field]: value.trim() });
}

export async function deleteInformationField(field) {
  if (!field) return;
  await remove(ref(db, `information/${field}`));
}

export async function getShortMemory() {
  const snap = await get(ref(db, "shortMemory"));
  return snap.exists() ? snap.val() : {};
}

export async function addShortMemoryNote(note) {
  if (!note || typeof note !== "string") return null;
  const newRef = push(ref(db, "shortMemory"));
  await set(newRef, { note: note.trim(), ts: Date.now() });
  return newRef.key;
}

export async function deleteShortMemoryNote(id) {
  if (!id) return;
  await remove(ref(db, `shortMemory/${id}`));
}

export async function createSession(temporary = false) {
  const sessionRef = push(ref(db, "sessions"));
  const now = Date.now();
  const session = { id: sessionRef.key, title: "New Chat", createdAt: now, updatedAt: now, temporary };
  await set(sessionRef, { title: session.title, createdAt: now, updatedAt: now, temporary });
  return session;
}

export async function getSessions() {
  const snap = await get(ref(db, "sessions"));
  if (!snap.exists()) return [];
  return Object.entries(snap.val())
    .map(([id, session]) => ({ id, ...session }))
    .filter((session) => !session.temporary)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function renameSession(sessionId, title) {
  if (!sessionId || !title?.trim()) return;
  await update(ref(db, `sessions/${sessionId}`), { title: title.trim(), updatedAt: Date.now() });
}

export async function touchSession(sessionId) {
  if (!sessionId) return;
  await update(ref(db, `sessions/${sessionId}`), { updatedAt: Date.now() });
}

export async function autoTitleSessionIfNeeded(sessionId, firstMessage) {
  if (!sessionId || !firstMessage) return;
  const sessionSnap = await get(ref(db, `sessions/${sessionId}`));
  if (!sessionSnap.exists() || sessionSnap.val().title !== "New Chat") return;
  const title = firstMessage.trim().replace(/\s+/g, " ").slice(0, 42) || "New Chat";
  await renameSession(sessionId, title);
}

export async function deleteSession(sessionId) {
  if (!sessionId) return;
  await remove(ref(db, `sessions/${sessionId}`));
}

export async function pushChatMessage(sessionId, role, text) {
  if (!sessionId || !text) return null;
  const messageRef = push(ref(db, `sessions/${sessionId}/messages`));
  await set(messageRef, { role, text, ts: Date.now() });
  return messageRef.key;
}

export async function saveChatMessage(sessionId, role, text, messageId = null) {
  if (!sessionId || !text) return null;
  const messageRef = messageId
    ? ref(db, `sessions/${sessionId}/messages/${messageId}`)
    : push(ref(db, `sessions/${sessionId}/messages`));
  await set(messageRef, { role, text, ts: Date.now() });
  return messageRef.key;
}

export async function getRecentChats(sessionId, limit = 12) {
  if (!sessionId) return [];
  const chatsQuery = query(ref(db, `sessions/${sessionId}/messages`), limitToLast(limit));
  const snap = await get(chatsQuery);
  if (!snap.exists()) return [];
  return Object.values(snap.val()).sort((a, b) => a.ts - b.ts);
}

export async function getAllChats(sessionId) {
  if (!sessionId) return [];
  const snap = await get(ref(db, `sessions/${sessionId}/messages`));
  if (!snap.exists()) return [];
  return Object.entries(snap.val())
    .map(([id, message]) => ({ id, ...message }))
    .sort((a, b) => a.ts - b.ts);
}

export async function deleteChatMessage(sessionId, messageId) {
  if (!sessionId || !messageId) return;
  await remove(ref(db, `sessions/${sessionId}/messages/${messageId}`));
}

export async function replaceChatMessage(sessionId, messageId, text) {
  if (!sessionId || !messageId || !text?.trim()) throw new Error("Message is required.");
  const messagesRef = ref(db, `sessions/${sessionId}/messages`);
  const snap = await get(messagesRef);
  const messages = snap.exists() ? snap.val() : {};
  const target = messages[messageId];
  if (!target || target.role !== "user") throw new Error("Message not found.");

  const updates = {
    [`sessions/${sessionId}/messages/${messageId}/text`]: text.trim(),
    [`sessions/${sessionId}/messages/${messageId}/ts`]: Date.now()
  };
  const orderedMessages = Object.entries(messages).sort(
    ([, first], [, second]) => (first.ts || 0) - (second.ts || 0)
  );
  const targetIndex = orderedMessages.findIndex(([id]) => id === messageId);
  for (const [id] of orderedMessages.slice(targetIndex + 1)) {
    updates[`sessions/${sessionId}/messages/${id}`] = null;
  }
  await update(ref(db), updates);
}
