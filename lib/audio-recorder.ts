/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { audioContext } from './utils';
import AudioRecordingWorklet from './worklets/audio-processing';
import VolMeterWorket from './worklets/vol-meter';
import VADWorklet from './worklets/vad-worklet';
import ProsodyWorklet from './worklets/prosody-worklet';

import { createWorketFromSrc } from './audioworklet-registry';
import EventEmitter from 'eventemitter3';
import { VADManager } from './vad-manager';
import { EmotionAnalyzer, ProsodyFeatures } from './emotion-analyzer';

function arrayBufferToBase64(buffer: ArrayBuffer) {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// FIX: Refactored to use composition over inheritance for EventEmitter
export class AudioRecorder {
  // FIX: Use an internal EventEmitter instance
  private emitter = new EventEmitter();

  // FIX: Expose on/off methods
  public on = this.emitter.on.bind(this.emitter);
  public off = this.emitter.off.bind(this.emitter);

  stream: MediaStream | undefined;
  audioContext: AudioContext | undefined;
  source: MediaStreamAudioSourceNode | undefined;
  recording: boolean = false;
  recordingWorklet: AudioWorkletNode | undefined;
  vuWorklet: AudioWorkletNode | undefined;
  vadManager: VADManager | undefined;
  prosodyWorklet: AudioWorkletNode | undefined;
  emotionAnalyzer: EmotionAnalyzer;
  compressor: DynamicsCompressorNode | undefined;

  private starting: Promise<void> | null = null;

  constructor(public sampleRate = 16000) {
    this.emotionAnalyzer = new EmotionAnalyzer();
  }

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Could not request user media');
    }

    this.starting = new Promise(async (resolve, reject) => {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
      });
      this.audioContext = await audioContext({ sampleRate: this.sampleRate });
      this.source = this.audioContext.createMediaStreamSource(this.stream);

      // Create filters for noise reduction
      const highpassFilter = this.audioContext.createBiquadFilter();
      highpassFilter.type = 'highpass';
      highpassFilter.frequency.setValueAtTime(120, this.audioContext.currentTime); // Cut rumble below 120Hz

      const lowpassFilter = this.audioContext.createBiquadFilter();
      lowpassFilter.type = 'lowpass';
      lowpassFilter.frequency.setValueAtTime(8000, this.audioContext.currentTime); // Cut noise above 8kHz

      // Create a compressor to normalize volume
      this.compressor = this.audioContext.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-50, this.audioContext.currentTime);
      this.compressor.knee.setValueAtTime(40, this.audioContext.currentTime);
      this.compressor.ratio.setValueAtTime(12, this.audioContext.currentTime);
      this.compressor.attack.setValueAtTime(0, this.audioContext.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.audioContext.currentTime);

      // Chain the nodes: source -> highpass -> lowpass -> compressor -> worklets
      this.source.connect(highpassFilter);
      highpassFilter.connect(lowpassFilter);
      lowpassFilter.connect(this.compressor);

      // Initialize VAD Manager
      this.vadManager = new VADManager(this.audioContext);
      
      // Set up VAD event handlers
      this.vadManager.on('speechEnd', (data: any) => {
        // Emit speech end event for turn management
        this.emitter.emit('speechEnd', data);
      });

      this.vadManager.on('energy', (data: any) => {
        // Emit energy updates for visualization
        this.emitter.emit('vadEnergy', data);
      });

      const workletName = 'audio-recorder-worklet';
      const src = createWorketFromSrc(workletName, AudioRecordingWorklet);

      await this.audioContext.audioWorklet.addModule(src);
      this.recordingWorklet = new AudioWorkletNode(
        this.audioContext,
        workletName
      );

      this.recordingWorklet.port.onmessage = async (ev: MessageEvent) => {
        // Worklet processes recording floats and messages converted buffer
        const arrayBuffer = ev.data.data.int16arrayBuffer;

        if (arrayBuffer) {
          const arrayBufferString = arrayBufferToBase64(arrayBuffer);
          // FIX: Changed this.emit to this.emitter.emit
          this.emitter.emit('data', arrayBufferString);
        }
      };
      this.compressor.connect(this.recordingWorklet);

      // vu meter worklet
      const vuWorkletName = 'vu-meter';
      await this.audioContext.audioWorklet.addModule(
        createWorketFromSrc(vuWorkletName, VolMeterWorket)
      );
      this.vuWorklet = new AudioWorkletNode(this.audioContext, vuWorkletName);
      this.vuWorklet.port.onmessage = (ev: MessageEvent) => {
        // FIX: Changed this.emit to this.emitter.emit
        this.emitter.emit('volume', ev.data.volume);
      };

      this.compressor.connect(this.vuWorklet);

      // Initialize VAD after all audio nodes are set up
      await this.vadManager.initialize(this.compressor);

      // Initialize Prosody Worklet
      const prosodyWorkletName = 'prosody-worklet';
      await this.audioContext.audioWorklet.addModule(
        createWorketFromSrc(prosodyWorkletName, ProsodyWorklet)
      );
      this.prosodyWorklet = new AudioWorkletNode(this.audioContext, prosodyWorkletName);
      
      this.prosodyWorklet.port.onmessage = (ev: MessageEvent) => {
        if (ev.data.type === 'prosodyFeatures') {
          const features: ProsodyFeatures = ev.data.features;
          this.emotionAnalyzer.addFeatures(features);
          
          // Emit prosody features for real-time analysis
          this.emitter.emit('prosodyFeatures', features);
          
          // Emit emotion profile updates
          const emotionProfile = this.emotionAnalyzer.getEmotionProfile();
          if (emotionProfile) {
            this.emitter.emit('emotionProfile', emotionProfile);
          }
        }
      };
      
      this.compressor.connect(this.prosodyWorklet);
      this.recording = true;
      resolve();
      this.starting = null;
    });
  }

  stop() {
    // It is plausible that stop would be called before start completes,
    // such as if the Websocket immediately hangs up
    const handleStop = () => {
      this.source?.disconnect();
      this.stream?.getTracks().forEach(track => track.stop());
      this.stream = undefined;
      this.recordingWorklet = undefined;
      this.vuWorklet = undefined;
      this.vadManager?.destroy();
      this.vadManager = undefined;
      this.prosodyWorklet?.disconnect();
      this.prosodyWorklet = undefined;
      this.emotionAnalyzer.reset();
      this.compressor = undefined;
    };
    if (this.starting) {
      this.starting.then(handleStop);
      return;
    }
    handleStop();
  }

  // Method to get current emotion profile for TTS
  getEmotionProfile() {
    return this.emotionAnalyzer.getEmotionProfile();
  }

  // Method to get TTS parameters for nuance mimicry
  getTTSParameters() {
    return this.emotionAnalyzer.generateTTSParameters();
  }
}