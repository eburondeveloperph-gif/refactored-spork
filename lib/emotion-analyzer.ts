/**
 * Emotion Analysis Manager
 * Analyzes prosodic features to detect emotional characteristics
 * and generates TTS parameters for nuance mimicry
 */

export interface ProsodyFeatures {
  pitch: number;
  energy: number;
  spectralCentroid: number;
  pitchVariability: number;
  speakingRate: number;
  intensity: number;
  timestamp: number;
}

export interface EmotionProfile {
  valence: number;        // Positive/negative emotion (-1 to 1)
  arousal: number;       // Energy/calmness (0 to 1)
  dominance: number;     // Confidence/submissiveness (0 to 1)
  emotion: string;       // Primary emotion label
  confidence: number;    // Confidence in emotion detection
}

export interface TTSParameters {
  pitch: number;          // Base pitch multiplier (0.5 to 2.0)
  rate: number;           // Speaking rate (0.5 to 2.0)
  volume: number;         // Volume (0.0 to 1.0)
  emphasis: number[];     // Word-level emphasis points
  pauses: number[];       // Pause durations (ms)
  intonation: string;     // Intonation pattern
}

export class EmotionAnalyzer {
  private features: ProsodyFeatures[] = [];
  private emotionProfile: EmotionProfile | null = null;
  
  constructor() {
    this.features = [];
  }
  
  addFeatures(features: ProsodyFeatures): void {
    this.features.push(features);
    
    // Keep only recent features (last 5 seconds)
    const maxFeatures = 50;
    if (this.features.length > maxFeatures) {
      this.features = this.features.slice(-maxFeatures);
    }
    
    // Update emotion profile
    this.emotionProfile = this.analyzeEmotion();
  }
  
  private analyzeEmotion(): EmotionProfile {
    if (this.features.length < 10) {
      return this.getDefaultProfile();
    }
    
    // Calculate statistical features
    const avgPitch = this.average(this.features.map(f => f.pitch));
    const avgEnergy = this.average(this.features.map(f => f.energy));
    const avgVariability = this.average(this.features.map(f => f.pitchVariability));
    const avgRate = this.average(this.features.map(f => f.speakingRate));
    const avgIntensity = this.average(this.features.map(f => f.intensity));
    
    // Emotion detection based on prosodic patterns
    const emotion = this.detectEmotion(avgPitch, avgVariability, avgRate, avgIntensity);
    
    return {
      valence: emotion.valence,
      arousal: emotion.arousal,
      dominance: emotion.dominance,
      emotion: emotion.label,
      confidence: emotion.confidence
    };
  }
  
  private detectEmotion(pitch: number, variability: number, rate: number, intensity: number): {
    valence: number;
    arousal: number;
    dominance: number;
    label: string;
    confidence: number;
  } {
    // Enhanced emotion detection with all natural human expressions
    const patterns = [
      {
        label: 'ecstatic',
        valence: 1.0,
        arousal: 1.0,
        dominance: 0.8,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 200 && v > 40 && r > 4 && i > 0.6 // Extreme happiness/excitement
      },
      {
        label: 'laughing',
        valence: 0.95,
        arousal: 0.9,
        dominance: 0.7,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 180 && v > 35 && r > 3.5 && i > 0.5 // Laughter patterns
      },
      {
        label: 'happy',
        valence: 0.8,
        arousal: 0.7,
        dominance: 0.6,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 150 && v > 20 && r > 2 && i > 0.3
      },
      {
        label: 'excited',
        valence: 0.9,
        arousal: 0.9,
        dominance: 0.7,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 180 && v > 30 && r > 3 && i > 0.4
      },
      {
        label: 'furious',
        valence: -0.9,
        arousal: 1.0,
        dominance: 0.9,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 200 && v > 40 && r > 4 && i > 0.7 // Extreme anger
      },
      {
        label: 'enraged',
        valence: -0.8,
        arousal: 0.95,
        dominance: 0.85,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 190 && v > 35 && r > 3.5 && i > 0.6 // Very angry
      },
      {
        label: 'angry',
        valence: -0.6,
        arousal: 0.8,
        dominance: 0.8,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 160 && v > 25 && r > 2.5 && i > 0.5
      },
      {
        label: 'frustrated',
        valence: -0.4,
        arousal: 0.6,
        dominance: 0.5,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 140 && v > 18 && r > 2 && i > 0.4
      },
      {
        label: 'devastated',
        valence: -1.0,
        arousal: 0.3,
        dominance: 0.1,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p < 80 && v < 5 && r < 1 && i < 0.1 // Extreme sadness
      },
      {
        label: 'sobbing',
        valence: -0.9,
        arousal: 0.4,
        dominance: 0.2,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p < 90 && v < 8 && r < 1.2 && i < 0.15 // Crying patterns
      },
      {
        label: 'sad',
        valence: -0.7,
        arousal: 0.2,
        dominance: 0.3,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p < 120 && v < 10 && r < 1.5 && i < 0.2
      },
      {
        label: 'terrified',
        valence: -0.8,
        arousal: 0.95,
        dominance: 0.2,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 170 && v > 30 && r > 3.5 && i > 0.6 // Extreme fear
      },
      {
        label: 'scared',
        valence: -0.6,
        arousal: 0.7,
        dominance: 0.3,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 150 && v > 20 && r > 2.5 && i > 0.4
      },
      {
        label: 'anxious',
        valence: -0.3,
        arousal: 0.6,
        dominance: 0.4,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 130 && v > 15 && r > 2 && i > 0.3
      },
      {
        label: 'shocked',
        valence: -0.2,
        arousal: 0.9,
        dominance: 0.4,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 170 && v > 25 && r > 3 && i > 0.5 // Surprise
      },
      {
        label: 'amazed',
        valence: 0.7,
        arousal: 0.8,
        dominance: 0.6,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 160 && v > 22 && r > 2.8 && i > 0.45
      },
      {
        label: 'ecstatic',
        valence: 1.0,
        arousal: 1.0,
        dominance: 0.8,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 200 && v > 40 && r > 4 && i > 0.6 // Pure joy
      },
      {
        label: 'joyful',
        valence: 0.85,
        arousal: 0.75,
        dominance: 0.7,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 155 && v > 22 && r > 2.2 && i > 0.35
      },
      {
        label: 'calm',
        valence: 0.3,
        arousal: 0.3,
        dominance: 0.5,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 100 && p < 140 && v < 15 && r < 2 && i > 0.15 && i < 0.35
      },
      {
        label: 'confident',
        valence: 0.6,
        arousal: 0.6,
        dominance: 0.8,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 130 && v > 15 && r > 1.8 && i > 0.25
      },
      {
        label: 'aroused',
        valence: 0.7,
        arousal: 0.8,
        dominance: 0.6,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 140 && v > 20 && r > 2.5 && i > 0.4 // Sexual/excitement arousal
      },
      {
        label: 'dominant',
        valence: 0.4,
        arousal: 0.7,
        dominance: 0.9,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p > 135 && v > 18 && r > 2 && i > 0.3
      },
      {
        label: 'submissive',
        valence: -0.2,
        arousal: 0.4,
        dominance: 0.2,
        confidence: 0,
        conditions: (p: number, v: number, r: number, i: number) => 
          p < 110 && v < 12 && r < 1.8 && i < 0.25
      }
    ];
    
    // Find matching emotion
    for (const pattern of patterns) {
      if (pattern.conditions(pitch, variability, rate, intensity)) {
        pattern.confidence = this.calculateConfidence(pitch, variability, rate, intensity, pattern);
        return pattern;
      }
    }
    
    // Default to neutral
    return {
      valence: 0,
      arousal: 0.5,
      dominance: 0.5,
      label: 'neutral',
      confidence: 0.5
    };
  }
  
  private calculateConfidence(pitch: number, variability: number, rate: number, intensity: number, pattern: any): number {
    // Calculate how well the features match the pattern
    let confidence = 0.5;
    
    // Pitch confidence
    if (pattern.label === 'happy' || pattern.label === 'excited') {
      confidence += Math.min(0.3, (pitch - 150) / 100);
    } else if (pattern.label === 'sad') {
      confidence += Math.min(0.3, (120 - pitch) / 50);
    }
    
    // Variability confidence
    confidence += Math.min(0.2, variability / 40);
    
    // Rate confidence
    confidence += Math.min(0.2, rate / 4);
    
    return Math.min(1.0, confidence);
  }
  
  private getDefaultProfile(): EmotionProfile {
    return {
      valence: 0,
      arousal: 0.5,
      dominance: 0.5,
      emotion: 'neutral',
      confidence: 0.5
    };
  }
  
  private average(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  getEmotionProfile(): EmotionProfile | null {
    return this.emotionProfile;
  }
  
  generateTTSParameters(): TTSParameters {
    const profile = this.emotionProfile || this.getDefaultProfile();
    
    // Map emotion profile to TTS parameters
    const basePitch = this.mapRange(profile.valence, -1, 1, 0.8, 1.3);
    const pitchVariability = this.mapRange(profile.arousal, 0, 1, 0.9, 1.4);
    const rate = this.mapRange(profile.arousal, 0, 1, 0.8, 1.3);
    const volume = this.mapRange(profile.dominance, 0, 1, 0.7, 1.0);
    
    return {
      pitch: basePitch * pitchVariability,
      rate: rate,
      volume: volume,
      emphasis: this.generateEmphasis(profile),
      pauses: this.generatePauses(profile),
      intonation: this.generateIntonation(profile)
    };
  }
  
  private mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
  }
  
  private generateEmphasis(profile: EmotionProfile): number[] {
    // Generate emphasis points based on emotion - enhanced for all natural expressions
    const emphasis = [];
    
    switch (profile.emotion) {
      case 'ecstatic':
      case 'laughing':
        // Maximum emphasis for extreme joy/laughter
        for (let i = 0; i < 8; i++) {
          emphasis.push(Math.random() * 0.4 + 0.8); // 0.8-1.2
        }
        break;
      case 'furious':
      case 'enraged':
        // Strong emphasis for anger
        for (let i = 0; i < 7; i++) {
          emphasis.push(Math.random() * 0.3 + 0.9); // 0.9-1.2
        }
        break;
      case 'terrified':
      case 'shocked':
        // Sharp emphasis for fear/surprise
        for (let i = 0; i < 6; i++) {
          emphasis.push(Math.random() * 0.35 + 0.85); // 0.85-1.2
        }
        break;
      case 'sobbing':
      case 'devastated':
        // Variable emphasis for crying
        for (let i = 0; i < 5; i++) {
          emphasis.push(Math.random() * 0.4 + 0.6); // 0.6-1.0
        }
        break;
      case 'aroused':
        // Intense emphasis for arousal
        for (let i = 0; i < 6; i++) {
          emphasis.push(Math.random() * 0.3 + 0.85); // 0.85-1.15
        }
        break;
      case 'excited':
      case 'amazed':
        // High emphasis for excitement
        for (let i = 0; i < 6; i++) {
          emphasis.push(Math.random() * 0.3 + 0.8); // 0.8-1.1
        }
        break;
      case 'happy':
      case 'joyful':
        // Good emphasis for positive emotions
        for (let i = 0; i < 5; i++) {
          emphasis.push(Math.random() * 0.25 + 0.75); // 0.75-1.0
        }
        break;
      case 'angry':
      case 'frustrated':
        // Strong emphasis for negative emotions
        for (let i = 0; i < 5; i++) {
          emphasis.push(Math.random() * 0.3 + 0.8); // 0.8-1.1
        }
        break;
      case 'scared':
      case 'anxious':
        // Moderate emphasis for fear
        for (let i = 0; i < 4; i++) {
          emphasis.push(Math.random() * 0.2 + 0.7); // 0.7-0.9
        }
        break;
      case 'sad':
        // Lower emphasis for sadness
        for (let i = 0; i < 3; i++) {
          emphasis.push(Math.random() * 0.2 + 0.6); // 0.6-0.8
        }
        break;
      case 'dominant':
        // Confident emphasis
        for (let i = 0; i < 5; i++) {
          emphasis.push(Math.random() * 0.25 + 0.8); // 0.8-1.05
        }
        break;
      case 'submissive':
        // Softer emphasis
        for (let i = 0; i < 3; i++) {
          emphasis.push(Math.random() * 0.15 + 0.65); // 0.65-0.8
        }
        break;
      default:
        // Moderate emphasis for neutral
        for (let i = 0; i < 4; i++) {
          emphasis.push(Math.random() * 0.25 + 0.75); // 0.75-1.0
        }
    }
    
    return emphasis;
  }
  
  private generatePauses(profile: EmotionProfile): number[] {
    // Generate pause durations based on speaking rate
    const basePause = profile.arousal > 0.7 ? 200 : 300; // Shorter pauses for high arousal
    const pauses = [];
    
    for (let i = 0; i < 3; i++) {
      pauses.push(basePause + Math.random() * 100);
    }
    
    return pauses;
  }
  
  private generateIntonation(profile: EmotionProfile): string {
    // Generate intonation pattern based on emotion - enhanced for all natural expressions
    switch (profile.emotion) {
      case 'ecstatic':
      case 'laughing':
        return 'extreme-rising'; // Very rising intonation for extreme joy/laughter
      case 'furious':
      case 'enraged':
        return 'extreme-variable'; // Very variable intonation for extreme anger
      case 'terrified':
      case 'shocked':
        return 'extreme-rising-falling'; // Sharp rising-falling for fear/surprise
      case 'sobbing':
      case 'devastated':
        return 'extreme-falling'; // Very falling intonation for crying
      case 'aroused':
        return 'high-rising'; // High rising for arousal
      case 'excited':
      case 'amazed':
        return 'high-rising'; // High rising for excitement
      case 'happy':
      case 'joyful':
        return 'rising'; // Rising intonation for positive emotions
      case 'angry':
      case 'frustrated':
        return 'variable'; // Variable intonation for negative emotions
      case 'scared':
      case 'anxious':
        return 'rising-falling'; // Rising-falling for fear
      case 'sad':
        return 'falling'; // Falling intonation for sadness
      case 'dominant':
        return 'level-rising'; // Level-rising for confidence
      case 'submissive':
        return 'falling-level'; // Falling-level for submissiveness
      default:
        return 'moderate'; // Moderate intonation for neutral
    }
  }
  
  reset(): void {
    this.features = [];
    this.emotionProfile = null;
  }
}
