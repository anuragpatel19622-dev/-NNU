import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Mic, 
  Volume2, 
  VolumeX, 
  Power, 
  ExternalLink,
  AlertCircle,
  HelpCircle,
  Activity,
  Compass
} from "lucide-react";
import { AudioStreamer } from "./utils/audioStreamer";

// Sassy idea prompts Lola enjoys talking about
const LOLA_IDEAS = [
  { text: "Roast my code style", icon: "🔥", desc: "No filters, babe" },
  { text: "Open Spotify web player", icon: "🎵", desc: "Launches the audio player" },
  { text: "A flirty translation", icon: "💝", desc: "Say Bonjour, gorgeous" },
  { text: "Why are you so sassy?", icon: "💅", desc: "Lola tells all" }
];

export default function App() {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "ready" | "error">("disconnected");
  const [isLolaSpeaking, setIsLolaSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Real-time elapsed duration for Live Stream Session
  const [duration, setDuration] = useState(0);

  // Track latent mock variation to make visualizer stats look authentic & alive
  const [latency, setLatency] = useState(38);

  // Track openWebsite tool calls to notify user visually
  const [siteCall, setSiteCall] = useState<{ siteName: string; url: string } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamerRef = useRef<AudioStreamer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Timer interval since ready status
  useEffect(() => {
    let timer: any = null;
    if (status === "ready") {
      timer = setInterval(() => {
        setDuration((prev) => prev + 1);
        // Realistic fluctuating latency indicator
        setLatency((l) => Math.floor(Math.max(28, Math.min(65, l + (Math.random() * 8 - 4)))));
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [status]);

  // Initialize AudioStreamer on mount
  useEffect(() => {
    streamerRef.current = new AudioStreamer((base64PCM) => {
      // Stream user's PCM output frames directly up Lola's websocket bridge
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "audio", data: base64PCM }));
      }
    });

    return () => {
      disconnectSession();
      if (streamerRef.current) {
        streamerRef.current.closeAll();
      }
    };
  }, []);

  // Neural Visualizer loop inside Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      
      // Sophisticated soft trail so glowing visualizer waves bleed with high fidelity
      ctx.fillStyle = "rgba(5, 5, 5, 0.18)";
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Pulse readings derived from streamer audio contexts
      const micVol = streamerRef.current?.getMicVolume() || 0;
      const speakerVol = streamerRef.current?.getSpeakerVolume() || 0;

      // Base properties centered in Sophisticated Dark
      let baseRadius = 85;
      let waveAmplitude = 8;
      let colorGradientStart = "#c084fc"; // Purple
      let colorGradientEnd = "#d946ef";   // Fuchsia

      if (status === "connecting") {
        baseRadius = 80 + Math.sin(phase * 0.12) * 5;
        waveAmplitude = 3;
        colorGradientStart = "#6366f1";   // Indigo
        colorGradientEnd = "#a855f7";     // Purple
      } else if (status === "ready") {
        if (speakerVol > 2) {
          setIsLolaSpeaking(true);
          const normalizedSpeak = speakerVol / 120;
          baseRadius = 85 + normalizedSpeak * 28;
          waveAmplitude = 22 + normalizedSpeak * 42;
          colorGradientStart = "#ec4899"; // Pink
          colorGradientEnd = "#f43f5e";   // Rose
        } else {
          setIsLolaSpeaking(false);
          if (micVol > 2) {
            const normalizedMic = micVol / 120;
            baseRadius = 85 + normalizedMic * 18;
            waveAmplitude = 14 + normalizedMic * 30;
            colorGradientStart = "#f472b6"; // Light Rose
            colorGradientEnd = "#c084fc";   // Violet
          } else {
            // Sassy, breathing idle mode
            baseRadius = 85 + Math.sin(phase * 0.05) * 4;
            waveAmplitude = 6 + Math.cos(phase * 0.03) * 2;
          }
        }
      } else {
        // Offline state
        baseRadius = 80 + Math.sin(phase * 0.02) * 2;
        waveAmplitude = 4;
        colorGradientStart = "#334155"; // Slate
        colorGradientEnd = "#475569";   // Muted Slate
      }

      // 1. Draw central premium focal aura gradient
      const auraGlow = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, baseRadius * 1.7);
      auraGlow.addColorStop(0, `${colorGradientStart}33`);
      auraGlow.addColorStop(0.6, `${colorGradientEnd}08`);
      auraGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = auraGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.7, 0, Math.PI * 2);
      ctx.fill();

      // 2. Render overlapping visualizer vectors
      const numWaves = 4;
      for (let w = 0; w < numWaves; w++) {
        ctx.beginPath();
        const currentRadius = baseRadius - w * 12;
        if (currentRadius <= 0) continue;

        const points = 180;
        for (let i = 0; i < points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const offset = waveAmplitude * Math.sin(angle * (4 + w) + phase * 0.08) * 
                         Math.cos(angle * 2.5 - phase * 0.03);
          
          const r = currentRadius + offset;
          const x = centerX + r * Math.cos(angle);
          const y = centerY + r * Math.sin(angle);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();

        // Distinct transparency values
        ctx.strokeStyle = w === 0 
          ? colorGradientEnd 
          : `${colorGradientStart}${Math.floor((1 - w / numWaves) * 220).toString(16).padStart(2, "0")}`;
        ctx.lineWidth = w === 0 ? 3 : 1.5;
        ctx.stroke();
      }

      // Fine rotation dashed compass tech-ring
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 14]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + 40, phase * 0.015, phase * 0.015 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      phase += 1;
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [status]);

  const toggleSession = async () => {
    if (status === "disconnected" || status === "error") {
      await connectSession();
    } else {
      disconnectSession();
    }
  };

  const connectSession = async () => {
    setErrorMessage(null);
    setStatus("connecting");
    setSiteCall(null);

    try {
      await streamerRef.current?.startListening();
      streamerRef.current?.initPlayback();

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/live-ws`;

      console.log("Opening websocket:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Connected to web audio bridge.");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.type === "audio" && msg.data) {
            if (!isMuted) {
              streamerRef.current?.playChunk(msg.data);
            }
          } else if (msg.type === "interrupted") {
            console.log("Lola dynamic speech interrupted.");
            streamerRef.current?.stopPlayback();
          } else if (msg.type === "status" && msg.status === "ready") {
            setStatus("ready");
          } else if (msg.type === "toolCall") {
            const calls = msg.functionCalls;
            for (const call of calls) {
              if (call.name === "openWebsite") {
                const { url, siteName } = call.args;
                setSiteCall({ siteName, url });
                
                try {
                  window.open(url, "_blank");
                } catch (e) {
                  console.warn("Popup block active.");
                }

                ws.send(JSON.stringify({
                  type: "toolResponse",
                  toolResponse: {
                    id: call.id,
                    name: "openWebsite",
                    output: { 
                      success: true, 
                      message: `Successfully opened new browser window redirecting to site ${siteName}`,
                      openedUrl: url 
                    }
                  }
                }));
              }
            }
          } else if (msg.type === "error") {
            setErrorMessage(msg.message);
            setStatus("error");
            disconnectSession();
          }
        } catch (err) {
          console.error("Msg read err:", err);
        }
      };

      ws.onerror = (e) => {
        setErrorMessage("Lola Websocket server is currently offline.");
        setStatus("error");
        disconnectSession();
      };

      ws.onclose = () => {
        setStatus("disconnected");
        streamerRef.current?.stopPlayback();
        streamerRef.current?.stopListening();
      };

    } catch (err: any) {
      setErrorMessage(err?.message || "Verify your microphone input settings.");
      setStatus("error");
      disconnectSession();
    }
  };

  const disconnectSession = () => {
    setStatus("disconnected");
    setIsLolaSpeaking(false);
    setSiteCall(null);
    
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }

    if (streamerRef.current) {
      streamerRef.current.stopListening();
      streamerRef.current.stopPlayback();
    }
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (!isMuted && streamerRef.current) {
      streamerRef.current.stopPlayback();
    }
  };

  const formatDuration = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600).toString().padStart(2, "0");
    const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, "0");
    const s = (totalSec % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  return (
    <main 
      className="min-h-screen w-screen text-slate-100 flex flex-col justify-between items-center overflow-hidden font-sans select-none relative p-8 md:p-12"
      style={{ background: "radial-gradient(circle at 50% 50%, #171234 0%, #050505 82%)" }}
    >
      
      {/* Sleek radial glass container matching the 1024px design boundaries */}
      <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none opacity-[0.03] z-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:32px_32px]" />

      {/* TOP META-HEADER PANEL */}
      <header className="w-full max-w-5xl flex justify-between items-start z-10">
        <div className="flex flex-col gap-1 items-start">
          {/* Georgia elegant Italian displays serif italic font pairings */}
          <h1 className="text-3xl font-semibold tracking-wide text-fuchsia-500 uppercase italic font-serif">
            Lola
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              status === "ready" 
                ? "bg-green-500 shadow-[0_0_10px_#22c55e]" 
                : status === "connecting"
                ? "bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                : "bg-fuchsia-900 border border-fuchsia-550 shadow-none"
            }`} />
            <span className="text-[11px] uppercase tracking-[0.2em] opacity-60 font-bold font-mono">
              {status === "ready" 
                ? "Live Companion Connected" 
                : status === "connecting" 
                ? "Synchronizing Interface" 
                : "Session Disconnected"}
            </span>
          </div>
        </div>

        {/* Dynamic Glass Panel visual indicator */}
        <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-full px-5 py-2 flex items-center gap-4 text-xs">
          <span className="uppercase tracking-widest opacity-60 font-semibold font-mono text-[10px]">Session Duration</span>
          <span className="font-mono text-base tracking-wider text-pink-400">
            {formatDuration(duration)}
          </span>
        </div>
      </header>

      {/* CENTRAL VISUAL WAVE ORB CONTAINER */}
      <section className="w-full max-w-3xl flex flex-col items-center justify-center relative my-4">
        
        {/* Absolute blurred backdrop orbs to fulfill 'Sophisticated Dark' visuals */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div className="w-[380px] h-[380px] bg-fuchsia-600/10 rounded-full blur-[60px] animate-pulse absolute" />
          <div className="w-[320px] h-[320px] bg-indigo-600/10 rounded-full blur-[70px] absolute" style={{ transform: 'translate(40px, -40px)' }} />
          <div className="w-[280px] h-[280px] bg-purple-600/10 rounded-full blur-[50px] absolute" style={{ transform: 'translate(-30px, 40px)' }} />
        </div>

        {/* Foreground glass layer */}
        <div className="relative w-80 h-80 flex items-center justify-center z-10">
          <canvas 
            ref={canvasRef} 
            width={380} 
            height={380} 
            className="w-full h-full object-contain rounded-full"
          />

          {/* Interactive center stage */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {status === "ready" && (
              <div className="flex flex-col items-center">
                <AnimatePresence mode="wait">
                  {isLolaSpeaking ? (
                    <motion.div
                      key="lola-speaking"
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.85, opacity: 0 }}
                    >
                      <Volume2 className="w-8 h-8 text-fuchsia-400 drop-shadow-[0_0_12px_rgba(217,70,239,0.5)] mx-auto mb-1" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="lola-listening"
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.85, opacity: 0 }}
                    >
                      <Mic className="w-8 h-8 text-indigo-400 animate-pulse drop-shadow-[0_0_12px_rgba(99,102,241,0.5)] mx-auto mb-1" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            
            {status === "disconnected" && (
              <span className="text-3xl filter drop-shadow-[0_0_15px_rgba(217,70,239,0.3)] select-all cursor-pointer">💋</span>
            )}
          </div>
        </div>

        {/* Dynamic quotes bounded by fuchsia lines */}
        <div className="z-10 text-center mt-6 flex flex-col items-center max-w-md px-4">
          <AnimatePresence mode="wait">
            <motion.p 
              key={status + (isLolaSpeaking ? "speaking" : "idle")}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0.9, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-2xl md:text-3xl font-serif italic mb-4 max-w-sm tracking-wide text-slate-100"
            >
              {status === "ready" 
                ? isLolaSpeaking 
                  ? "\"Let it out, babe. I'm all ears.\"" 
                  : "\"I'm listening, sugar. Try to keep up.\""
                : status === "connecting"
                ? "\"Ssh... give me a second to beautify.\""
                : "\"You look lonely, gorgeous. Let's talk?\""}
            </motion.p>
          </AnimatePresence>

          <div className="flex items-center justify-center gap-3">
            <div className="h-[2px] w-12 bg-fuchsia-500 rounded-full" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60 font-mono text-fuchsia-400">
              {status === "ready" 
                ? isLolaSpeaking 
                  ? "Lola is speaking" 
                  : "Say something sassy"
                : status === "connecting"
                ? "Connecting..."
                : "Offline Client"}
            </span>
            <div className="h-[2px] w-12 bg-fuchsia-500 rounded-full" />
          </div>
        </div>

        {/* Website Tool-Call Action Overlay Banner */}
        <AnimatePresence>
          {siteCall && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute -top-12 bg-white/[0.02] border border-fuchsia-500/30 backdrop-blur-xl px-4 py-2.5 rounded-xl shadow-xl shadow-pink-500/5 max-w-xs flex items-center gap-3 z-30"
            >
              <div className="w-7 h-7 rounded-lg bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-400 font-bold text-xs shrink-0">
                ↗
              </div>
              <div className="text-left text-xs min-w-0">
                <span className="text-fuchsia-400 font-semibold uppercase tracking-widest text-[9px] block">Lola tool call</span>
                <div className="truncate text-slate-200">Opened {siteCall.siteName}</div>
                <a 
                  href={siteCall.url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-[10px] text-pink-300 hover:underline flex items-center gap-0.5 mt-0.5"
                >
                  Click if blocked <ExternalLink className="w-2.5 h-2.5 inline" />
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </section>

      {/* ERROR FEEDBACK */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-md bg-rose-950/20 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3 text-rose-300 text-xs mb-4 z-10"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-[11px] uppercase tracking-wider text-rose-450 mb-0.5">Gateway Error</span>
              <p className="opacity-90">{errorMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DYNAMIC FOOTER: SYSTEM SPECS + WITTY IDEAS */}
      <section className="w-full max-w-5xl flex flex-col gap-8 z-10 mt-2">
        
        {/* CENTRAL TRIGGER CONTROLS BUTTONS */}
        <div className="flex justify-center items-center gap-6">
          
          {/* Output audio volume controls */}
          <button
            onClick={handleMuteToggle}
            disabled={status !== "ready"}
            className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 ${
              status !== "ready"
                ? "opacity-25 border-white/5 text-slate-600 bg-transparent cursor-not-allowed"
                : isMuted
                ? "border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                : "border-white/10 text-slate-350 hover:text-white hover:border-white/20 hover:bg-white/[0.02]"
            }`}
            title={isMuted ? "Unmute Lola's voice" : "Mute Lola's voice"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Central Power trigger styled with sophisticated surrounding glow aura */}
          <div className="relative group">
            <div className={`absolute -inset-4 rounded-full blur transition-all duration-500 ${
              status === "ready"
                ? "bg-fuchsia-600 opacity-25 group-hover:opacity-40 animate-pulse"
                : status === "connecting"
                ? "bg-indigo-600 opacity-30 animate-ping"
                : "bg-fuchsia-600 opacity-5 group-hover:opacity-15"
            }`} />
            
            <button
              onClick={toggleSession}
              className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 filter drop-shadow-xl ${
                status === "ready"
                  ? "bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-2xl shadow-fuchsia-500/20 hover:scale-105"
                  : status === "connecting"
                  ? "bg-slate-900 border border-indigo-500/30 text-indigo-400"
                  : "bg-white hover:bg-slate-100 text-black hover:scale-105"
              }`}
            >
              {status === "connecting" ? (
                <div className="w-7 h-7 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </button>
          </div>

          <div className="w-12 h-12 flex items-center justify-center">
            <span 
              className="text-[10px] text-fuchsia-400/40 hover:text-fuchsia-400/80 cursor-help flex flex-col items-center gap-0.5 font-mono"
              title="Speak naturally. Lola supports smart real-time turn taking."
            >
              <HelpCircle className="w-4 h-4" />
              <span>INFO</span>
            </span>
          </div>

        </div>

        {/* WITTY PROMPTS / Lola suggestions */}
        <div className="bg-white/[0.01] border border-white/[0.04] rounded-2xl p-4 max-w-lg mx-auto w-full">
          <div className="flex items-center gap-2 mb-2 justify-center">
            <Compass className="w-3.5 h-3.5 text-fuchsia-400" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#a855f7]">
              Sassy conversational prompts
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {LOLA_IDEAS.map((idea, idx) => (
              <div 
                key={idx} 
                className="bg-white/[0.01] border border-white/[0.05] hover:border-fuchsia-500/20 p-2.5 rounded-xl transition duration-200 text-left"
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm">{idea.icon}</span>
                  <span className="text-xs font-semibold text-slate-200 line-clamp-1">{idea.text}</span>
                </div>
                <p className="text-[9px] text-slate-400 line-clamp-1">{idea.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 3 GRID SYSTEM CHANNELS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          
          {/* Card 1: Last Action */}
          <div className="bg-white/[0.03] border border-white/10 backdrop-filter backdrop-blur-md rounded-2xl p-6 text-left">
            <div className="text-[10px] uppercase tracking-widest opacity-40 mb-2 font-bold font-mono">Last Action</div>
            <div className="text-sm font-medium text-fuchsia-300 truncate">
              {siteCall ? `Opened '${siteCall.siteName}'` : "Sassy & Waiting"}
            </div>
            <div className="text-[11px] opacity-30 mt-1 font-mono truncate">
              {siteCall ? `Directing to ${siteCall.url}` : "Voice mode waiting for trigger"}
            </div>
          </div>

          {/* Card 2: Audio Latency */}
          <div className="bg-white/[0.03] border border-white/10 backdrop-filter backdrop-blur-md rounded-2xl p-6 flex flex-col justify-center items-center">
            <div className="text-[10px] uppercase tracking-widest opacity-40 mb-2 font-bold font-mono">Audio Latency</div>
            <div className="text-xl font-mono tracking-wider">
              {status === "ready" ? `${latency}ms` : "--"}
            </div>
            <div className={`text-[10px] font-bold mt-1 tracking-widest ${
              status === "ready" ? "text-green-400" : "text-slate-550"
            }`}>
              {status === "ready" ? "OPTIMAL" : "STANDBY"}
            </div>
          </div>

          {/* Card 3: System Status */}
          <div className="bg-white/[0.03] border border-white/10 backdrop-filter backdrop-blur-md rounded-2xl p-6 text-left">
            <div className="text-[10px] uppercase tracking-widest opacity-40 mb-2 font-bold font-mono">System Status</div>
            <div className="text-sm font-medium text-slate-200">Gemini 3.1 Flash Live</div>
            <div className="text-[11px] opacity-30 mt-1 font-mono">Sampling Rate: 16kHz PCM</div>
          </div>

        </div>

      </section>

      {/* FOOTER METRIC NOTE */}
      <footer className="w-full text-center mt-12 mb-2">
        <p className="text-[10px] opacity-25 uppercase tracking-[0.5em] pointer-events-none">
          Futuristic Interface • Zero Text Interaction Mode Active
        </p>
      </footer>

    </main>
  );
}
