/**
 * Voice Activity Detection (VAD) Worklet
 * Detects when user stops speaking by analyzing audio energy levels
 */

const VADWorklet = `
  class VADWorkletProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      
      // VAD configuration
      this.energyThreshold = 0.01;
      this.silenceDuration = 1.5;
      this.minSpeechDuration = 0.3;
      
      // State tracking
      this.isSpeaking = false;
      this.speechStartTime = 0;
      this.lastSpeechTime = 0;
      this.silenceStartTime = 0;
      
      // Energy calculation
      this.windowSize = 1024;
      this.energyBuffer = new Float32Array(this.windowSize);
      this.bufferIndex = 0;
      
      this.port.onmessage = (event) => {
        if (event.data.type === 'updateConfig') {
          const { energyThreshold, silenceDuration, minSpeechDuration } = event.data.config;
          if (energyThreshold !== undefined) this.energyThreshold = energyThreshold;
          if (silenceDuration !== undefined) this.silenceDuration = silenceDuration;
          if (minSpeechDuration !== undefined) this.minSpeechDuration = minSpeechDuration;
        }
      };
    }

    process(inputs, outputs, parameters) {
      const input = inputs[0];
      
      if (input.length > 0) {
        const inputChannel = input[0];
        const currentTime = currentTime;
        
        // Calculate energy for this frame
        let frameEnergy = 0;
        for (let i = 0; i < inputChannel.length; i++) {
          const sample = inputChannel[i];
          frameEnergy += sample * sample;
          
          // Add to energy buffer for smoothing
          this.energyBuffer[this.bufferIndex] = sample * sample;
          this.bufferIndex = (this.bufferIndex + 1) % this.windowSize;
        }
        
        // Calculate RMS energy
        const rmsEnergy = Math.sqrt(frameEnergy / inputChannel.length);
        
        // Smooth energy using buffer
        let bufferedEnergy = 0;
        for (let i = 0; i < this.windowSize; i++) {
          bufferedEnergy += this.energyBuffer[i];
        }
        const smoothedEnergy = Math.sqrt(bufferedEnergy / this.windowSize);
        
        // VAD logic
        const isSpeechDetected = smoothedEnergy > this.energyThreshold;
        
        if (isSpeechDetected) {
          if (!this.isSpeaking) {
            // Speech started
            this.isSpeaking = true;
            this.speechStartTime = currentTime;
            this.port.postMessage({
              type: 'speechStart',
              time: currentTime,
              energy: smoothedEnergy
            });
          }
          this.lastSpeechTime = currentTime;
        } else {
          if (this.isSpeaking) {
            // Potential silence
            if (this.silenceStartTime === 0) {
              this.silenceStartTime = currentTime;
            }
            
            const silenceDuration = currentTime - this.silenceStartTime;
            
            if (silenceDuration >= this.silenceDuration) {
              // User has stopped speaking
              const totalSpeechDuration = this.lastSpeechTime - this.speechStartTime;
              
              // Only trigger if there was sufficient speech duration
              if (totalSpeechDuration >= this.minSpeechDuration) {
                this.port.postMessage({
                  type: 'speechEnd',
                  time: currentTime,
                  speechDuration: totalSpeechDuration,
                  silenceDuration: silenceDuration,
                  energy: smoothedEnergy
                });
              }
              
              // Reset state
              this.isSpeaking = false;
              this.speechStartTime = 0;
              this.lastSpeechTime = 0;
              this.silenceStartTime = 0;
            }
          }
        }
        
        // Send continuous energy updates for visualization
        this.port.postMessage({
          type: 'energy',
          value: smoothedEnergy,
          isSpeech: this.isSpeaking
        });
      }
      
      return true; // Keep processing
    }
  }

  registerProcessor('vad-worklet', VADWorkletProcessor);
`;

export default VADWorklet;
