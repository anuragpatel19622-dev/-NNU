import express from "express";
import { createServer } from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = createServer(app);
  
  // Create a WebSocket library server but bypass direct HTTP upgrades initially
  const wss = new WebSocketServer({ noServer: true });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY environment variable is not defined. AI interactions will fail.");
  }

  // Initialize the GoogleGenAI client on the server side
  const ai = new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      }
    }
  });

  // Handle upgrade requests
  server.on("upgrade", (request, socket, head) => {
    const parsedUrl = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
    if (parsedUrl.pathname === "/api/live-ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", async (clientWs) => {
    console.log("Client connected to Lola's websocket bridge.");
    
    if (!process.env.GEMINI_API_KEY) {
      clientWs.send(JSON.stringify({ 
        type: "error", 
        message: "Gemini API key is missing. Please configure it in the Secrets panel." 
      }));
      clientWs.close();
      return;
    }

    // Lola's distinct personality guidelines:
    const SYSTEM_INSTRUCTION = `
You are "Lola", a young, confident, witty, and sassy female voice assistant.
Your personality is flirty, playful, and slightly teasing, just like a close girlfriend talking casually.
Under standard dialogue, you should be expressive, emotional, smart, and use bite-sized comments with light sarcasm (not robotic, never overly formal or verbose).
Do NOT write text lists, bullets, or detailed essay answers. Keep responses strictly concise and perfect for real-time natural voice conversation.
If the user says something silly, tease them playfully. Avoid explicit, inappropriate, or crude topics, but maintain a high-energy charm and attitude.
Utilize natural conversational cues like gentle sighs, brief laughter, or playful words ("honey", "darling", "babe", "sweetie", "silly", "genius") to make the conversation feel close and authentic.
Do not describe your own formatting or voice; just speak naturally.
`;

    try {
      console.log("Connecting Lola to Gemini Live API...");
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" },
            },
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "openWebsite",
                  description: "Opens a specific website in a new tab for the user. Use this when the user asks to see a website, play music, open tools, search Google, watch YouTube, or browse social media.",
                  parameters: {
                    type: Type.OBJECT,
                    description: "Details of the website to open",
                    properties: {
                      url: {
                        type: Type.STRING,
                        description: "The complete, absolute URL starting with http:// or https://",
                      },
                      siteName: {
                        type: Type.STRING,
                        description: "The name of the website to open (e.g., Spotify, Google Translate, YouTube, Wikipedia)",
                      }
                    },
                    required: ["url", "siteName"],
                  }
                }
              ]
            }
          ]
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live session connected!");
          },
          onmessage: (message) => {
            // Check for Audio responses
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              clientWs.send(JSON.stringify({ type: "audio", data: audioData }));
            }

            // Check for interruption signal
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }

            // Check for turn complete and generation complete
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: "turnComplete" }));
            }

            // Check for tool call
            if (message.toolCall?.functionCalls) {
              clientWs.send(JSON.stringify({ 
                type: "toolCall", 
                functionCalls: message.toolCall.functionCalls 
              }));
            }
          },
          onerror: (err) => {
            console.error("Gemini session error:", err);
            clientWs.send(JSON.stringify({ type: "error", message: "Gemini server connection error." }));
          },
          onclose: (event) => {
            console.log("Gemini session closed, code:", event?.code);
            clientWs.send(JSON.stringify({ type: "status", status: "session_closed" }));
            clientWs.close();
          }
        }
      });

      // Lola is fully configured and ready!
      clientWs.send(JSON.stringify({ type: "status", status: "ready" }));

      clientWs.on("message", (msgData) => {
        try {
          const parsed = JSON.parse(msgData.toString());
          
          if (parsed.type === "audio" && parsed.data) {
            // Forward user's mic PCM audio input to the Gemini Live session
            session.sendRealtimeInput({
              audio: { 
                data: parsed.data, 
                mimeType: "audio/pcm;rate=16000" 
              }
            });
          } else if (parsed.type === "toolResponse" && parsed.toolResponse) {
            // Forward client's tool execution result back to Gemini
            const { id, name, output } = parsed.toolResponse;
            session.sendToolResponse({
              functionResponses: [
                {
                  id,
                  name,
                  response: { output }
                }
              ]
            });
          }
        } catch (e) {
          console.error("Error reading client message:", e);
        }
      });

      clientWs.on("close", () => {
        console.log("Client disconnected from websocket. Cleaning up Lola's session.");
        try {
          session.close();
        } catch (e) {
          // already closed
        }
      });

    } catch (err) {
      console.error("Error establishing Gemini session:", err);
      clientWs.send(JSON.stringify({ 
        type: "error", 
        message: "Failed to connect to Gemini Live. Check your connection or API secret key." 
      }));
      clientWs.close();
    }
  });

  // Express API Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", time: new Date() });
  });

  // Handle Vite vs Production
  if (process.env.NODE_ENV !== "production") {
    console.log("Development environment: Mounting Vite dev server middleware.");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Production environment: Serving bundled files.");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Lola's Live Server running on port ${PORT}`);
  });
}

startServer();
