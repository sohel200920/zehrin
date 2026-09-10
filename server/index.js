import "dotenv/config";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import {
  getInformation,
  updateInformationField,
  deleteInformationField,
  getShortMemory,
  addShortMemoryNote,
  deleteShortMemoryNote,
  createSession,
  getSessions,
  renameSession,
  touchSession,
  autoTitleSessionIfNeeded,
  deleteSession,
  deleteChatMessage,
  saveChatMessage,
  replaceChatMessage,
  getRecentChats,
  getAllChats
} from "./memory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const generatedDir = path.join(projectRoot, "public", "generated");
fs.mkdirSync(generatedDir, { recursive: true });

const app = express();
const PORT = Number(process.env.PORT || 3000);
const apiKey = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

if (!apiKey || apiKey.includes("PASTE_YOUR")) {
  console.error("❌ GEMINI_API_KEY missing (.env check karo).");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/generated", express.static(generatedDir));


// ---------- Heuristics: only pay extra latency when actually needed ----------

const MEMORY_TRIGGER_WORDS = [
  "yaad rakh", "yaad rakho", "yaad rkho", "remember",
  "nickname", "nick name", "naam rakh", "naam de diya", "naam de do",
  "bhool ja", "bhula do", "forget",
  "update kar", "badal do", "change kar do", "note kar lo", "note karo"
];
function looksLikeMemoryIntent(text) {
  const t = text.toLowerCase();
  return MEMORY_TRIGGER_WORDS.some((w) => t.includes(w));
}

const IMAGE_TRIGGER_WORDS = [
  "image banao", "image bana do", "image bana de", "photo banao", "photo bana do",
  "picture banao", "picture bana do", "draw ", "sketch banao", "generate image",
  "image generate", "ek image", "make an image", "make a picture", "generate a picture",
  "create an image", "create a picture", "draw me",
  "wallpaper banao", "art banao", "painting banao"
];
const IMAGE_SUBJECT_WORDS = ["image", "images", "photo", "picture", "pic", "drawing", "sketch", "wallpaper", "art", "painting"];
const IMAGE_ACTION_WORDS = [
  "bana", "banao", "banado", "generate", "generated", "create", "make", "draw", "design", "paint"
];
function looksLikeImageIntent(text) {
  const t = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
  if (IMAGE_TRIGGER_WORDS.some((w) => t.includes(w))) return true;
  const hasSubject = IMAGE_SUBJECT_WORDS.some((word) => t.includes(word));
  const hasAction = IMAGE_ACTION_WORDS.some((word) => t.includes(word));
  return hasSubject && hasAction;
}

// ---------- Prompt builder ----------

function buildSystemPrompt(information, shortMemory, recentChats) {
  const infoLines =
    Object.entries(information || {}).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "(none yet)";
  const shortLines =
    Object.entries(shortMemory || {}).map(([id, m]) => `- [${id}] ${m.note}`).join("\n") || "(none)";
  const historyLines =
    (recentChats || [])
      .map((c) => {
        return `${c.role === "user" ? "Boss" : "ZEHRIN"}: ${c.text}`;
      })
      .join("\n") ||
    "(no earlier messages)";

  return `You are ZEHRIN, a warm and helpful personal AI assistant. Reply naturally in Hinglish. Be concise by default; give detail only when asked. Never say you are an AI language model. Use **bold** only when useful.

PERMANENT INFORMATION:
${infoLines}

SHORT-TERM NOTES:
${shortLines}

RECENT CONVERSATION:
${historyLines}`;
}

// ---------- Memory intent detection (plain JSON output, NOT native
// function-calling — this sidesteps the SDK/model-version bugs entirely) ----------

async function detectMemoryActions(message, information, shortMemory) {
  const prompt = `User's latest message: "${message}"

Known permanent fields: ${Object.keys(information || {}).join(", ") || "(none)"}
Known short-memory ids: ${Object.keys(shortMemory || {}).join(", ") || "(none)"}

Does this message ask to remember, correct, or forget a permanent fact (like a nickname), or note a small temporary detail? Respond with ONLY compact JSON, no prose, no markdown fences, in this exact shape:
{"actions":[{"type":"update_information","field":"...","value":"..."}]}
or {"actions":[{"type":"delete_information","field":"..."}]}
or {"actions":[{"type":"add_short_memory","note":"..."}]}
or {"actions":[{"type":"delete_short_memory","id":"..."}]}
or, if nothing to remember/forget: {"actions":[]}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const text = (response.text || "").trim();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed.actions) ? parsed.actions : [];
  } catch (err) {
    console.error("Memory-detect parse failed (ignored, chat continues):", err?.message || err);
    return [];
  }
}

async function executeMemoryAction(action) {
  switch (action.type) {
    case "update_information":
      await updateInformationField(action.field, action.value);
      return true;
    case "delete_information":
      await deleteInformationField(action.field);
      return true;
    case "add_short_memory":
      await addShortMemoryNote(action.note);
      return true;
    case "delete_short_memory":
      await deleteShortMemoryNote(action.id);
      return true;
    default:
      return false;
  }
}

// ---------- Image generation (best-effort, never crashes the chat) ----------

async function generateImage(prompt) {
  const response = await ai.interactions.create({
    model: IMAGE_MODEL,
    input: `Create the image requested by the user. Return the generated image directly.\n\nUser request: ${prompt}`
  });
  if (!response.output_image?.data) return null;
  const buffer = Buffer.from(response.output_image.data, "base64");
  const filename = `img_${Date.now()}.png`;
  fs.writeFileSync(path.join(generatedDir, filename), buffer);
  return `/generated/${filename}`;
}

// ---------- Session endpoints ----------

app.get("/api/sessions", async (_req, res) => {
  try {
    res.json({ sessions: await getSessions() });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Failed to load sessions." });
  }
});

app.post("/api/sessions", async (_req, res) => {
  try {
    res.json({ session: await createSession(Boolean(_req.body?.temporary)) });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Failed to create session." });
  }
});

app.post("/api/sessions/:id/cleanup", async (req, res) => {
  try {
    await deleteSession(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Failed to clean up temporary session." });
  }
});

app.get("/api/sessions/:id/messages", async (req, res) => {
  try {
    res.json({ messages: await getAllChats(req.params.id) });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Failed to load messages." });
  }
});

app.delete("/api/sessions/:sessionId/messages/:messageId", async (req, res) => {
  try {
    await deleteChatMessage(req.params.sessionId, req.params.messageId);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Failed to delete message." });
  }
});

app.patch("/api/sessions/:id", async (req, res) => {
  try {
    const { title } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: "Title is required." });
    await renameSession(req.params.id, title);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Failed to rename session." });
  }
});

app.delete("/api/sessions/:id", async (req, res) => {
  try {
    await deleteSession(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Failed to delete session." });
  }
});

// ---------- Chat (streaming) ----------

app.post("/api/chat", async (req, res) => {
  const { message, sessionId, clientMessageId, replaceMessageId } = req.body || {};
  const trimmed = (message || "").trim();
  if (!trimmed) return res.status(400).json({ error: "Message is required." });
  if (!sessionId) return res.status(400).json({ error: "sessionId is required." });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    if (replaceMessageId) {
      await replaceChatMessage(sessionId, replaceMessageId, trimmed);
    }

    let [information, shortMemory, recentChats] = await Promise.all([
      getInformation(),
      getShortMemory(),
      getRecentChats(sessionId, 8)
    ]);

    // Persist the user turn in parallel with generation so Firebase writes do
    // not add a full round-trip before the first streamed token.
    const persistence = Promise.all([
      replaceMessageId
        ? Promise.resolve()
        : saveChatMessage(sessionId, "user", trimmed, clientMessageId),
      autoTitleSessionIfNeeded(sessionId, trimmed),
      touchSession(sessionId)
    ]);

    const imageRequest = looksLikeImageIntent(trimmed);
    let fullText = "";

    // Image requests bypass the text model completely. This prevents the chat
    // model from replying that it cannot create images.
    if (imageRequest) {
      try {
        const url = await generateImage(trimmed);
        if (url) {
          fullText = "Ye lo Boss, aapki image:";
          send({ type: "chunk", text: fullText });
          send({ type: "image", url });
          fullText += `\n\n![generated image](${url})`;
        } else {
          fullText = "Image generate nahi ho payi Boss.";
          send({ type: "chunk", text: fullText });
        }
      } catch (imgErr) {
        console.error("Image generation failed:", imgErr?.message || imgErr);
        fullText =
          imgErr?.status === 429 || /quota|billing|rate limit/i.test(imgErr?.message || "")
            ? "Image generation ke liye Gemini API quota/billing enable karni hogi Boss."
            : "Abhi image generate nahi ho payi Boss.";
        send({ type: "chunk", text: fullText });
      }

      await Promise.all([persistence, saveChatMessage(sessionId, "model", fullText), touchSession(sessionId)]);
      send({ type: "done" });
      return res.end();
    }

    // Only run the extra memory-check when the message plausibly needs it.
    if (looksLikeMemoryIntent(trimmed)) {
      const actions = await detectMemoryActions(trimmed, information, shortMemory);
      for (const action of actions) {
        const ok = await executeMemoryAction(action);
        if (ok) send({ type: "memory", action: action.type, args: action });
      }
      if (actions.length) {
        [information, shortMemory] = await Promise.all([getInformation(), getShortMemory()]);
      }
    }

    const systemInstruction = buildSystemPrompt(information, shortMemory, recentChats);

    const stream = await ai.models.generateContentStream({
      model: MODEL,
      contents: trimmed,
      config: {
        systemInstruction,
        maxOutputTokens: 512
      }
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        fullText += chunk.text;
        send({ type: "chunk", text: chunk.text });
      }
    }

    if (!fullText.trim()) {
      fullText = "Boss, is baar mujhe response nahi mila. Dobara try karo.";
      send({ type: "chunk", text: fullText });
    }

    await Promise.all([persistence, saveChatMessage(sessionId, "model", fullText), touchSession(sessionId)]);
    send({ type: "done" });
    res.end();
  } catch (error) {
    console.error("Gemini/Firebase Error:", error);
    let message = error?.message || "Kuch gadbad ho gayi.";
    if (error?.status === 429 || /rate limit|quota/i.test(message)) {
      message = "Aapki ZEHRIN abhi thodi der ke liye so rahi hai, thodi der mein utth jayegi. Thoda ruk ke phir try karo Boss.";
    }
    send({ type: "error", message });
    res.end();
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "online", service: "ZEHRIN Gemini Server", model: MODEL });
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`🤖 ZEHRIN server: http://localhost:${PORT}`);
  console.log(`   Using model: ${MODEL}`);
});