/**
 * AudioStreamer handles PCM 16-bit 16kHz microphone recording
 * and sequential 24kHz PCM browser playback for gapless sound rendering on the client side.
 */
export class AudioStreamer {
  private inputCtx: AudioContext | null = null;
  private outputCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private analyserInput: AnalyserNode | null = null;
  private analyserOutput: AnalyserNode | null = null;
  
  private activeSources: AudioBufferSourceNode[] = [];
  private nextStartTime = 0;
  private onAudioChunk: (base64PCM: string) => void;

  constructor(onAudioChunk: (base64PCM: string) => void) {
    this.onAudioChunk = onAudioChunk;
  }

  async startListening() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.inputCtx = new AudioCtx({ sampleRate: 16000 });
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micSource = this.inputCtx.createMediaStreamSource(this.micStream);
      
      this.analyserInput = this.inputCtx.createAnalyser();
      this.analyserInput.fftSize = 256;
      
      // Standard ScriptProcessor works seamlessly out-of-the-box and bundles natively
      this.scriptProcessor = this.inputCtx.createScriptProcessor(4096, 1, 1);
      
      this.scriptProcessor.onaudioprocess = (e) => {
        const floatData = e.inputBuffer.getChannelData(0);
        const pcmBuffer = this.floatTo16BitPCM(floatData);
        const base64 = this.arrayBufferToBase64(pcmBuffer);
        this.onAudioChunk(base64);
      };
      
      this.micSource.connect(this.analyserInput);
      this.analyserInput.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputCtx.destination);
    } catch (e) {
      console.error("Failed to start mic capture:", e);
      throw e;
    }
  }

  stopListening() {
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch (e) {}
      this.scriptProcessor = null;
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch (e) {}
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.inputCtx) {
      try {
        this.inputCtx.close();
      } catch (e) {}
      this.inputCtx = null;
    }
    this.analyserInput = null;
  }

  initPlayback() {
    if (!this.outputCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.outputCtx = new AudioCtx({ sampleRate: 24000 });
      this.analyserOutput = this.outputCtx.createAnalyser();
      this.analyserOutput.fftSize = 256;
      this.analyserOutput.connect(this.outputCtx.destination);
    }
    if (this.outputCtx.state === "suspended") {
      this.outputCtx.resume();
    }
  }

  playChunk(base64PCM: string) {
    this.initPlayback();
    if (!this.outputCtx || !this.analyserOutput) return;

    try {
      const binary = window.atob(base64PCM);
      const len = binary.length;
      const buffer = new ArrayBuffer(len);
      const view = new DataView(buffer);
      const uint8 = new Uint8Array(buffer);
      for (let i = 0; i < len; i++) {
        uint8[i] = binary.charCodeAt(i);
      }
      
      const samples = len / 2;
      const float32Data = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        const int16sample = view.getInt16(i * 2, true);
        float32Data[i] = int16sample / 32768.0;
      }

      const audioBuffer = this.outputCtx.createBuffer(1, samples, 24000);
      audioBuffer.copyToChannel(float32Data, 0);

      const sourceNode = this.outputCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.analyserOutput);

      const currentTime = this.outputCtx.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.05; // soft buffering margin
      }

      sourceNode.start(this.nextStartTime);
      this.activeSources.push(sourceNode);
      
      sourceNode.onended = () => {
        this.activeSources = this.activeSources.filter((s) => s !== sourceNode);
      };

      this.nextStartTime += audioBuffer.duration;
    } catch (e) {
      console.error("Error scheduling audio response chunk:", e);
    }
  }

  stopPlayback() {
    this.activeSources.forEach((src) => {
      try {
        src.stop();
      } catch (e) {}
    });
    this.activeSources = [];
    this.nextStartTime = 0;
  }

  getMicVolume(): number {
    if (!this.analyserInput) return 0;
    const dataArray = new Uint8Array(this.analyserInput.frequencyBinCount);
    this.analyserInput.getByteFrequencyData(dataArray);
    let total = 0;
    for (let i = 0; i < dataArray.length; i++) {
      total += dataArray[i];
    }
    return total / dataArray.length;
  }

  getSpeakerVolume(): number {
    if (!this.analyserOutput) return 0;
    const dataArray = new Uint8Array(this.analyserOutput.frequencyBinCount);
    this.analyserOutput.getByteFrequencyData(dataArray);
    let total = 0;
    for (let i = 0; i < dataArray.length; i++) {
      total += dataArray[i];
    }
    return total / dataArray.length;
  }

  private floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  closeAll() {
    this.stopListening();
    this.stopPlayback();
    if (this.outputCtx) {
      try {
        this.outputCtx.close();
      } catch (e) {}
      this.outputCtx = null;
    }
  }
}
