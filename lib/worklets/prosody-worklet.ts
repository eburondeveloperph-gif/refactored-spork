/**
 * Prosody Analysis Worklet
 * Extracts pitch, intonation, and emotional characteristics from audio
 */

const ProsodyWorklet = `
  class ProsodyWorkletProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      
      // Analysis parameters
      this.sampleRate = 16000;
      this.frameSize = 1024;
      this.hopSize = 512;
      
      // Pitch detection parameters
      this.minPitch = 80;   // Hz - typical male voice minimum
      this.maxPitch = 400;  // Hz - typical female voice maximum
      
      // Analysis buffers
      this.audioBuffer = new Float32Array(this.frameSize * 4);
      this.bufferIndex = 0;
      
      // Feature extraction
      this.pitchHistory = [];
      this.energyHistory = [];
      this.spectralCentroidHistory = [];
      
      // Emotion indicators
      this.pitchVariability = 0;
      this.speakingRate = 0;
      this.intensity = 0;
      
      this.port.onmessage = (event) => {
        if (event.data.type === 'reset') {
          this.reset();
        }
      };
    }
    
    reset() {
      this.audioBuffer.fill(0);
      this.bufferIndex = 0;
      this.pitchHistory = [];
      this.energyHistory = [];
      this.spectralCentroidHistory = [];
    }
    
    // Autocorrelation-based pitch detection
    detectPitch(frame) {
      const correlation = new Float32Array(frame.length);
      
      // Calculate autocorrelation
      for (let lag = 0; lag < frame.length; lag++) {
        let sum = 0;
        for (let i = 0; i < frame.length - lag; i++) {
          sum += frame[i] * frame[i + lag];
        }
        correlation[lag] = sum;
      }
      
      // Find peak in autocorrelation
      let maxLag = 0;
      let maxValue = 0;
      
      for (let lag = Math.floor(this.sampleRate / this.maxPitch); 
           lag < Math.floor(this.sampleRate / this.minPitch); lag++) {
        if (correlation[lag] > maxValue) {
          maxValue = correlation[lag];
          maxLag = lag;
        }
      }
      
      if (maxValue < 0.3 * correlation[0]) {
        return 0; // No clear pitch detected
      }
      
      return this.sampleRate / maxLag;
    }
    
    // Calculate spectral centroid for brightness analysis
    calculateSpectralCentroid(frame) {
      // Simple FFT approximation using power spectrum
      const fftSize = 512;
      const magnitude = new Float32Array(fftSize / 2);
      
      for (let k = 0; k < fftSize / 2; k++) {
        let real = 0, imag = 0;
        for (let n = 0; n < Math.min(frame.length, fftSize); n++) {
          const angle = -2 * Math.PI * k * n / fftSize;
          real += frame[n] * Math.cos(angle);
          imag += frame[n] * Math.sin(angle);
        }
        magnitude[k] = Math.sqrt(real * real + imag * imag);
      }
      
      let weightedSum = 0;
      let magnitudeSum = 0;
      
      for (let k = 0; k < fftSize / 2; k++) {
        weightedSum += k * magnitude[k];
        magnitudeSum += magnitude[k];
      }
      
      return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    }
    
    // Calculate RMS energy
    calculateEnergy(frame) {
      let sum = 0;
      for (let i = 0; i < frame.length; i++) {
        sum += frame[i] * frame[i];
      }
      return Math.sqrt(sum / frame.length);
    }
    
    // Extract prosodic features
    extractFeatures(frame) {
      const pitch = this.detectPitch(frame);
      const energy = this.calculateEnergy(frame);
      const spectralCentroid = this.calculateSpectralCentroid(frame);
      
      // Update histories
      this.pitchHistory.push(pitch);
      this.energyHistory.push(energy);
      this.spectralCentroidHistory.push(spectralCentroid);
      
      // Keep only recent history
      const maxHistory = 100;
      if (this.pitchHistory.length > maxHistory) {
        this.pitchHistory.shift();
        this.energyHistory.shift();
        this.spectralCentroidHistory.shift();
      }
      
      // Calculate derived features
      if (this.pitchHistory.length > 10) {
        // Pitch variability (standard deviation)
        const meanPitch = this.pitchHistory.reduce((a, b) => a + b, 0) / this.pitchHistory.length;
        const variance = this.pitchHistory.reduce((sum, p) => sum + Math.pow(p - meanPitch, 2), 0) / this.pitchHistory.length;
        this.pitchVariability = Math.sqrt(variance);
        
        // Speaking rate (pitch changes per second)
        const pitchChanges = this.pitchHistory.filter((p, i) => i > 0 && Math.abs(p - this.pitchHistory[i-1]) > 10).length;
        this.speakingRate = pitchChanges / (this.pitchHistory.length * this.hopSize / this.sampleRate);
        
        // Intensity (average energy)
        this.intensity = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
      }
      
      return {
        pitch,
        energy,
        spectralCentroid,
        pitchVariability: this.pitchVariability,
        speakingRate: this.speakingRate,
        intensity: this.intensity,
        timestamp: currentTime
      };
    }
    
    process(inputs, outputs, parameters) {
      const input = inputs[0];
      
      if (input.length > 0) {
        const inputChannel = input[0];
        
        // Add samples to buffer
        for (let i = 0; i < inputChannel.length; i++) {
          this.audioBuffer[this.bufferIndex] = inputChannel[i];
          this.bufferIndex = (this.bufferIndex + 1) % this.audioBuffer.length;
        }
        
        // Process frame when buffer is full enough
        if (this.bufferIndex >= this.frameSize) {
          const frame = new Float32Array(this.frameSize);
          const startIndex = (this.bufferIndex - this.frameSize + this.audioBuffer.length) % this.audioBuffer.length;
          
          for (let i = 0; i < this.frameSize; i++) {
            frame[i] = this.audioBuffer[(startIndex + i) % this.audioBuffer.length];
          }
          
          const features = this.extractFeatures(frame);
          
          // Send features for emotion analysis
          this.port.postMessage({
            type: 'prosodyFeatures',
            features
          });
        }
      }
      
      return true;
    }
  }

  registerProcessor('prosody-worklet', ProsodyWorkletProcessor);
`;

export default ProsodyWorklet;
