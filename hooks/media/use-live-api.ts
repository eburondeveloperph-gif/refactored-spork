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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenAILiveClient } from '../../lib/genai-live-client';
import { LiveConnectConfig, Modality, LiveServerToolCall } from '@google/genai';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';
import { useSettings } from '../../lib/state';

export type UseLiveApiResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;

  connect: () => Promise<void>;
  disconnect: () => void;
  connected: boolean;

  volume: number;
  isTtsMuted: boolean;
  toggleTtsMute: () => void;
  waitForAudioCompletion: () => Promise<void>;
  isUserSpeaking: boolean;
  vadEnergy: number;
  emotionProfile: any;
  prosodyFeatures: any;
  getTTSParameters: () => any;
};

export function useLiveApi({
  apiKey,
}: {
  apiKey: string;
}): UseLiveApiResults {
  const { model } = useSettings();
  const client = useMemo(() => new GenAILiveClient(apiKey, model), [apiKey, model]);

  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  const [volume, setVolume] = useState(0);
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<LiveConnectConfig>({});
  const [isTtsMuted, setIsTtsMuted] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [vadEnergy, setVadEnergy] = useState(0);
  const [emotionProfile, setEmotionProfile] = useState(null);
  const [prosodyFeatures, setProsodyFeatures] = useState(null);
  const audioRecorderRef = useRef<any>(null);

  const toggleTtsMute = useCallback(() => {
    setIsTtsMuted(prev => {
      const newMuted = !prev;
      if (audioStreamerRef.current) {
        audioStreamerRef.current.gainNode.gain.value = newMuted ? 0 : 1;
      }
      return newMuted;
    });
  }, []);

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      console.log('🎵 Initializing AudioStreamer...');
      audioContext({ id: 'audio-out' }).then((audioCtx: AudioContext) => {
        console.log('🔊 AudioContext created:', audioCtx.state);
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        console.log('✅ AudioStreamer initialized successfully');
        
        audioStreamerRef.current
          .addWorklet<any>('vumeter-out', VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            console.log('📊 Volume meter worklet added successfully');
          })
          .catch(err => {
            console.error('❌ Error adding volume meter worklet:', err);
          });
      }).catch((error) => {
        console.error('❌ Failed to initialize AudioContext:', error);
      });
    }
  }, [audioStreamerRef]);

  // VAD event handlers
  useEffect(() => {
    const handleSpeechEnd = (data: any) => {
      setIsUserSpeaking(false);
      // Trigger turn completion when user stops speaking
      // This allows the system to skip waiting for natural turn completion
      console.log('User stopped speaking, triggering turn completion');
    };

    const handleVADEnergy = (data: any) => {
      setVadEnergy(data.value);
      setIsUserSpeaking(data.isSpeech);
    };

    // These would be set up when audio recorder is initialized
    // For now, we'll set up basic VAD state tracking
    return () => {
      // Cleanup VAD listeners
    };
  }, []);

  // Emotion and prosody event handlers
  useEffect(() => {
    const handleProsodyFeatures = (features: any) => {
      setProsodyFeatures(features);
    };

    const handleEmotionProfile = (profile: any) => {
      setEmotionProfile(profile);
    };

    return () => {
      // Cleanup emotion listeners
    };
  }, []);

  const getTTSParameters = useCallback(() => {
    if (audioRecorderRef.current) {
      return audioRecorderRef.current.getTTSParameters();
    }
    return {
      pitch: 1.0,
      rate: 1.0,
      volume: 1.0,
      emphasis: [1.0],
      pauses: [200],
      intonation: 'moderate'
    };
  }, []);

  useEffect(() => {
    const onOpen = () => {
      setConnected(true);
    };

    const onClose = () => {
      setConnected(false);
    };

    const stopAudioStreamer = () => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.stop();
      }
    };

    const onAudio = (data: ArrayBuffer) => {
      console.log('🔊 Audio data received:', { 
        size: data.byteLength, 
        audioStreamerExists: !!audioStreamerRef.current 
      });
      
      if (audioStreamerRef.current) {
        console.log('📢 Adding PCM16 data to audio streamer');
        
        // Ensure audio context is resumed for autoplay policy
        if (audioStreamerRef.current.context.state === 'suspended') {
          console.log('🔄 Resuming suspended AudioContext for autoplay');
          audioStreamerRef.current.context.resume().then(() => {
            console.log('✅ AudioContext resumed successfully');
            audioStreamerRef.current!.addPCM16(new Uint8Array(data));
          }).catch((error) => {
            console.error('❌ Failed to resume AudioContext:', error);
            // Still try to add audio even if resume fails
            audioStreamerRef.current!.addPCM16(new Uint8Array(data));
          });
        } else {
          audioStreamerRef.current.addPCM16(new Uint8Array(data));
        }
      } else {
        console.warn('⚠️ Audio data received but no audio streamer available');
      }
    };

    // Bind event listeners
    client.on('open', onOpen);
    client.on('close', onClose);
    client.on('interrupted', stopAudioStreamer);
    client.on('audio', onAudio);

    return () => {
      // Clean up event listeners
      client.off('open', onOpen);
      client.off('close', onClose);
      client.off('interrupted', stopAudioStreamer);
      client.off('audio', onAudio);
    };
  }, [client]);

  const connect = useCallback(async () => {
    if (!config) {
      throw new Error('config has not been set');
    }
    client.disconnect();
    await client.connect(config);
  }, [client, config]);

  const disconnect = useCallback(async () => {
    client.disconnect();
    setConnected(false);
  }, [setConnected, client]);

  const waitForAudioCompletion = useCallback(async () => {
    if (audioStreamerRef.current) {
      return audioStreamerRef.current.waitForCompletion();
    }
    return Promise.resolve();
  }, []);

  return {
    client,
    config,
    setConfig,
    connect,
    connected,
    disconnect,
    volume,
    isTtsMuted,
    toggleTtsMute,
    waitForAudioCompletion,
    isUserSpeaking,
    vadEnergy,
    emotionProfile,
    prosodyFeatures,
    getTTSParameters,
  };
}