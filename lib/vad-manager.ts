/**
 * Voice Activity Detection (VAD) Manager
 * Handles VAD integration with audio recording and turn management
 */

import { createWorketFromSrc } from './audioworklet-registry';
import VADWorklet from './worklets/vad-worklet';
import EventEmitter from 'eventemitter3';

export interface VADEvents {
  speechStart: (data: { time: number; energy: number }) => void;
  speechEnd: (data: { 
    time: number; 
    speechDuration: number; 
    silenceDuration: number; 
    energy: number 
  }) => void;
  energy: (data: { value: number; isSpeech: boolean }) => void;
}

export class VADManager {
  private worklet: AudioWorkletNode | null = null;
  private emitter = new EventEmitter<VADEvents>();
  
  public on = this.emitter.on.bind(this.emitter);
  public off = this.emitter.off.bind(this.emitter);
  
  constructor(private audioContext: AudioContext) {}
  
  async initialize(sourceNode: AudioNode): Promise<void> {
    try {
      // Load and register the VAD worklet
      const workletName = 'vad-worklet';
      const workletSrc = createWorketFromSrc(workletName, VADWorklet);
      
      await this.audioContext.audioWorklet.addModule(workletSrc);
      this.worklet = new AudioWorkletNode(this.audioContext, workletName);
      
      // Set up message handling
      this.worklet.port.onmessage = (event: MessageEvent) => {
        const { type, ...data } = event.data;
        
        switch (type) {
          case 'speechStart':
            this.emitter.emit('speechStart', data);
            break;
          case 'speechEnd':
            this.emitter.emit('speechEnd', data);
            break;
          case 'energy':
            this.emitter.emit('energy', data);
            break;
        }
      };
      
      // Connect the audio source to the VAD worklet
      sourceNode.connect(this.worklet);
      this.worklet.connect(this.audioContext.destination);
      
    } catch (error) {
      console.error('Failed to initialize VAD:', error);
      throw error;
    }
  }
  
  updateConfig(config: {
    energyThreshold?: number;
    silenceDuration?: number;
    minSpeechDuration?: number;
  }): void {
    if (this.worklet) {
      this.worklet.port.postMessage({
        type: 'updateConfig',
        config
      });
    }
  }
  
  destroy(): void {
    if (this.worklet) {
      this.worklet.disconnect();
      this.worklet = null;
    }
    this.emitter.removeAllListeners();
  }
}
