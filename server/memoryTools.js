// Function-calling tools given to Gemini so it can decide, on its own,
// when to add/edit/delete something in ZEHRIN's memory — instead of just
// claiming in text that it "remembered" something.
export const memoryTools = [
  {
    functionDeclarations: [
      {
        name: "update_information",
        description:
          "Add or update ONE permanent fact about ZEHRIN or the user in the Information store " +
          "(e.g. a nickname, name, birthday, personality trait, speaking style, favorite thing). " +
          "Use this whenever the user teaches, corrects, or explicitly asks you to remember/change " +
          "something permanent — like giving you a new nickname.",
        parameters: {
          type: "OBJECT",
          properties: {
            field: {
              type: "STRING",
              description: "Short camelCase key, e.g. 'userNickname', 'zehrinNickname', 'favoriteColor'."
            },
            value: { type: "STRING", description: "The new value for that field." }
          },
          required: ["field", "value"]
        }
      },
      {
        name: "delete_information",
        description: "Remove a permanent fact from the Information store when the user asks you to forget it.",
        parameters: {
          type: "OBJECT",
          properties: { field: { type: "STRING" } },
          required: ["field"]
        }
      },
      {
        name: "add_short_memory",
        description:
          "Save a small, casual, possibly temporary note about the conversation (ShortMemory store) " +
          "that isn't a core identity fact but is worth remembering for a while.",
        parameters: {
          type: "OBJECT",
          properties: { note: { type: "STRING" } },
          required: ["note"]
        }
      },
      {
        name: "delete_short_memory",
        description:
          "Forget a specific short-term note by its id (ids are listed next to each note in your " +
          "SHORT-TERM NOTES context).",
        parameters: {
          type: "OBJECT",
          properties: { id: { type: "STRING" } },
          required: ["id"]
        }
      }
    ]
  }
];
