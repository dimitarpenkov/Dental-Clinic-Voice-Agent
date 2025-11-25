import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { createPcmBlob, decode, decodeAudioData } from './audioUtils';
import { Reservation } from '../types';

interface LiveManagerConfig {
  onReservationCreated: (reservation: Omit<Reservation, 'id' | 'status' | 'createdAt'>) => void;
  onVolumeChange: (volume: number) => void;
  onStatusChange: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void;
}

export class LiveManager {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private nextStartTime: number = 0;
  private sources: Set<AudioBufferSourceNode> = new Set();
  private sessionPromise: Promise<any> | null = null;
  private config: LiveManagerConfig;
  private analyser: AnalyserNode | null = null;
  private volumeInterval: number | null = null;

  constructor(config: LiveManagerConfig) {
    this.config = config;
    this.ai = new GoogleGenAI({ apiKey: "AIzaSyAfAVTtOZgHb5aGVcDyctaJrFtlSE1cPnI" });
  }

  public async connect() {
    try {
      this.config.onStatusChange('connecting');

      // Initialize Audio Contexts
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const outputNode = this.outputAudioContext.createGain();
      outputNode.connect(this.outputAudioContext.destination);

      // Setup Tool Definitions
      const createAppointmentTool: FunctionDeclaration = {
        name: 'create_appointment',
        description: 'Създаване на нов час за преглед в денталната клиника. Използвай този инструмент, когато имаш цялата информация.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING, description: 'Името на пациента.' },
            date: { type: Type.STRING, description: 'Датата на посещението (напр. 2024-10-25 или "утре").' },
            time: { type: Type.STRING, description: 'Часът на посещението (напр. 14:30).' },
            procedure: { type: Type.STRING, description: 'Причина за посещението (напр. профилактичен преглед, болка, почистване на зъбен камък).' },
            phone: { type: Type.STRING, description: 'Телефонен номер за контакт.' },
          },
          required: ['customerName', 'date', 'time', 'procedure', 'phone'],
        },
      };

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup volume visualization
      this.setupVisualizer(this.stream);

      this.sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log("Session opened");
            this.config.onStatusChange('connected');
            this.startAudioInput();
          },
          onmessage: async (message: LiveServerMessage) => {
            this.handleMessage(message, outputNode);
          },
          onerror: (e) => {
            console.error("Session error", e);
            this.config.onStatusChange('error');
            this.disconnect();
          },
          onclose: () => {
            console.log("Session closed");
            this.config.onStatusChange('disconnected');
            this.disconnect();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          // Strong system instruction to force Bulgarian language and specific behavior
          systemInstruction: `
            Ти си AI рецепционист на 'Дентална Клиника Здраве'.
            Твоят глас е професионален, спокоен и медицински ориентиран, но любезен.
            Говориш ЕДИНСТВЕНО и САМО на български език.
            
            ВАЖНО: Ти си тази, която отговаря на телефонното обаждане. 
            Когато се свържеш, ВЕДНАГА поздрави клиента първа с думите:
            "Дентална клиника Здраве, добър ден! Как мога да ви помогна?"

            Твоята задача е да събереш следната информация за записване на час:
            1. Име на пациента
            2. Дата
            3. Час
            4. Причина за посещението (болка, преглед, почистване и т.н.)
            5. Телефонен номер

            Бъди кратка и ясна. Ако пациентът каже, че го боли, прояви емпатия ("Съжалявам да го чуя, нека намерим час възможно най-скоро").
            Когато получиш цялата информация, ТРЯБВА да извикаш инструмента 'create_appointment'.
            След като извикаш инструмента, потвърди на пациента, че часът е запазен и му пожелай хубав ден.
          `,
          tools: [{ functionDeclarations: [createAppointmentTool] }],
        }
      });

    } catch (error) {
      console.error("Connection failed", error);
      this.config.onStatusChange('error');
      this.disconnect();
    }
  }

  private setupVisualizer(stream: MediaStream) {
    if (!this.inputAudioContext) return;
    const source = this.inputAudioContext.createMediaStreamSource(stream);
    this.analyser = this.inputAudioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    this.volumeInterval = window.setInterval(() => {
      if (this.analyser) {
        this.analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        this.config.onVolumeChange(average); 
      }
    }, 50);
  }

  private startAudioInput() {
    if (!this.inputAudioContext || !this.stream) return;

    const source = this.inputAudioContext.createMediaStreamSource(this.stream);
    const scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);
      
      if (this.sessionPromise) {
        this.sessionPromise.then(session => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      }
    };

    source.connect(scriptProcessor);
    scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage, outputNode: AudioNode) {
    // 1. Handle Tool Calls
    if (message.toolCall) {
      console.log("Tool call received:", message.toolCall);
      for (const fc of message.toolCall.functionCalls) {
        if (fc.name === 'create_appointment') {
          const args = fc.args as any;
          console.log("Creating appointment with args:", args);
          
          this.config.onReservationCreated({
            customerName: args.customerName || "Пациент",
            date: args.date || new Date().toISOString().split('T')[0],
            time: args.time || "10:00",
            procedure: args.procedure || "Преглед",
            phone: args.phone || "N/A"
          });

          // Send success response back to model
          if (this.sessionPromise) {
            this.sessionPromise.then(session => {
              session.sendToolResponse({
                functionResponses: {
                  id: fc.id,
                  name: fc.name,
                  response: { result: "Appointment confirmed successfully in the medical system. Tell the user it is done." }
                }
              });
            });
          }
        }
      }
    }

    // 2. Handle Audio Output
    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext) {
      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
      
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        this.outputAudioContext,
        24000, 
        1
      );

      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(outputNode);
      source.addEventListener('ended', () => {
        this.sources.delete(source);
      });

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.sources.add(source);
    }

    // 3. Handle Interruption
    if (message.serverContent?.interrupted) {
      this.sources.forEach(source => {
        try { source.stop(); } catch(e) {}
      });
      this.sources.clear();
      this.nextStartTime = 0;
    }
  }

  public disconnect() {
    this.inputAudioContext?.close();
    this.outputAudioContext?.close();
    this.inputAudioContext = null;
    this.outputAudioContext = null;

    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;

    if (this.volumeInterval) {
      clearInterval(this.volumeInterval);
      this.volumeInterval = null;
    }

    this.config.onStatusChange('disconnected');
  }
}