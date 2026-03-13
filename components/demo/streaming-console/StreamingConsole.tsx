/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef } from 'react';
import WelcomeScreen from '../welcome-screen/WelcomeScreen';
// FIX: Import LiveServerContent to correctly type the content handler.
import { Modality, LiveServerContent } from '@google/genai';

import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import {
  useSettings,
  useLogStore,
  ConversationTurn,
} from '../../../lib/state';
import { useHistoryStore } from '../../../lib/history';
import { useAuth, updateUserConversations } from '../../../lib/auth';
import { GENIUS_MODE_PROMPT, PURE_TRANSLATION_PROMPT, NATURAL_EXPRESSION_PROMPT } from '../../../lib/prompts';
import { getTrainingExamples, TRAINING_DATA } from '../../../lib/training';

export default function StreamingConsole() {
  const { client, setConfig, waitForAudioCompletion, getTTSParameters } = useLiveAPIContext();
  const { systemPrompt, voice, language1, language2, topic } = useSettings();
  const { addHistoryItem } = useHistoryStore();
  const { user } = useAuth();

  const turns = useLogStore(state => state.turns);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Create dynamic system prompt with language mapping, genius mode, and training examples
  const createSystemPrompt = () => {
    const topicContext = topic?.trim()
      ? `The conversation is about: "${topic}". Use this context from the first word—apply appropriate terminology, register, and domain knowledge immediately.`
      : 'No specific topic provided. Infer domain from context from the first utterance.';
    const geniusPrompt = GENIUS_MODE_PROMPT.replace('{topic_context}', topicContext);
    const translationPrompt = PURE_TRANSLATION_PROMPT;
    const trainingExamples = getTrainingExamples(language1, language2, TRAINING_DATA);

    const finalPrompt =
      geniusPrompt +
      '\n\n---\n\n' +
      translationPrompt +
      '\n\n' +
      NATURAL_EXPRESSION_PROMPT +
      trainingExamples;

    return finalPrompt;
  };

  // Set the configuration for the Live API
  useEffect(() => {
    const config: any = {
      responseModalities: 'AUDIO',
      // Enable transcription so we receive inputTranscription (user speech) and outputTranscription (model translation)
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      // Genius mode: focused, high-intelligence generation
      generationConfig: {
        temperature: 0.35,
        topP: 0.95,
        topK: 40,
      },
      // Disable thinking output - only show final translation
      thinkingConfig: { includeThoughts: false },
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice,
          },
        },
      },
      systemInstruction: {
        parts: [{ text: createSystemPrompt() }],
      },
    };

    // Add TTS parameters for nuance mimicry
    const ttsParams = getTTSParameters();
    if (ttsParams) {
      config.speechConfig.nuanceParams = {
        pitch: ttsParams.pitch,
        rate: ttsParams.rate,
        volume: ttsParams.volume,
        emphasis: ttsParams.emphasis,
        pauses: ttsParams.pauses,
        intonation: ttsParams.intonation,
      };
    }

    setConfig(config);
  }, [setConfig, systemPrompt, voice, getTTSParameters, language1, language2, topic]);

  useEffect(() => {
    const { addTurn, updateLastTurn } = useLogStore.getState();

    const handleInputTranscription = (text: string, isFinal: boolean) => {
      console.log('🎤 Input transcription received:', { text, isFinal, length: text.length });
      
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];
      
      console.log('📝 Current turns:', turns.length);
      console.log('👤 Last turn:', last ? { role: last.role, text: last.text, isFinal: last.isFinal } : 'none');
      
      if (last && last.role === 'user' && !last.isFinal) {
        const newText = last.text + text;
        console.log('➕ Accumulating text:', { oldText: last.text, addText: text, newText });
        updateLastTurn({
          text: newText,
          isFinal,
        });
      } else {
        console.log('🆕 Creating new user turn:', { text, isFinal });
        addTurn({ role: 'user', text, isFinal });
      }
    };

    const cleanDisplayText = (raw: string): string => {
      if (!raw?.trim()) return '';
      let s = raw;
      s = s.replace(/^(?:Thought|Thinking|Let me think|Hmm,?|First I need to|I need to)[^.]*\.?\s*/gim, '');
      s = s.replace(/^\[?(?:thought|reasoning|internal)[\s\S]*?\]\s*/gim, '');
      s = s.replace(/<speak[^>]*>|<\/speak>/gi, '');
      s = s.replace(/<prosody[^>]*>|<\/prosody>/gi, '');
      s = s.replace(/<break[^>]*\/?>/gi, ' ');
      s = s.replace(/<phoneme[^>]*>|<\/phoneme>/gi, '');
      s = s.replace(/<say-as[^>]*>|<\/say-as>/gi, '');
      s = s.replace(/<emphasis[^>]*>|<\/emphasis>/gi, '');
      s = s.replace(/<sub[^>]*>|<\/sub>/gi, '');
      s = s.replace(/<voice[^>]*>|<\/voice>/gi, '');
      s = s.replace(/<audio[^>]*>|<\/audio>/gi, '');
      s = s.replace(/<[^>]+>/g, '');
      s = s.replace(/\*\*[^*]+\*\*/g, '');
      s = s.replace(/^Translating[^:]*:\s*/gi, '');
      s = s.replace(/^\[.*?\]\s*/g, '');
      return s.trim();
    };

    const handleOutputTranscription = (text: string, isFinal: boolean) => {
      console.log('🤖 Output transcription received:', { text, isFinal, length: text.length });
      
      const cleaned = cleanDisplayText(text);
      console.log('🧹 Cleaned text:', cleaned);
      if (!cleaned) return;
      
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];
      
      console.log('📝 Agent turns:', turns.length);
      console.log('🤖 Last agent turn:', last ? { role: last.role, text: last.text, isFinal: last.isFinal } : 'none');
      
      if (last && last.role === 'agent' && !last.isFinal) {
        const newText = last.text + cleaned;
        console.log('➕ Accumulating agent text:', { oldText: last.text, addText: cleaned, newText });
        updateLastTurn({
          text: newText,
          isFinal,
        });
      } else {
        console.log('🆕 Creating new agent turn:', { text: cleaned, isFinal });
        addTurn({ role: 'agent', text: cleaned, isFinal });
      }
    };

    const handleContent = (serverContent: LiveServerContent) => {
      const parts = serverContent.modelTurn?.parts ?? [];
      const textParts: string[] = [];
      for (const p of parts) {
        if ((p as any).thought) continue;
        const t = (p as any).text;
        if (typeof t === 'string' && t.trim()) {
          const cleaned = cleanDisplayText(t);
          if (cleaned) textParts.push(cleaned);
        }
      }
      const text = textParts.join(' ');
      if (!text) return;

      const turns = useLogStore.getState().turns;
      const last = turns.at(-1);

      if (last?.role === 'agent' && !last.isFinal) {
        updateLastTurn({ text: last.text + text });
      } else {
        addTurn({ role: 'agent', text, isFinal: false });
      }
    };

    const handleTurnComplete = async () => {
      const { turns, updateLastTurn } = useLogStore.getState();
      const last = turns.at(-1);

      if (last && !last.isFinal) {
        updateLastTurn({ isFinal: true });
        const updatedTurns = useLogStore.getState().turns;

        // Wait for audio to complete before processing next turn
        await waitForAudioCompletion();

        if (user) {
          updateUserConversations(user.id, updatedTurns);
        }

        const finalAgentTurn = updatedTurns.at(-1);

        if (finalAgentTurn?.role === 'agent' && finalAgentTurn?.text) {
          const agentTurnIndex = updatedTurns.length - 1;
          let correspondingUserTurn = null;
          for (let i = agentTurnIndex - 1; i >= 0; i--) {
            if (updatedTurns[i].role === 'user') {
              correspondingUserTurn = updatedTurns[i];
              break;
            }
          }

          if (correspondingUserTurn?.text) {
            const translatedText = finalAgentTurn.text.trim();
            addHistoryItem({
              sourceText: correspondingUserTurn.text.trim(),
              translatedText: translatedText,
              lang1: language1,
              lang2: language2
            });
          }
        }
      }
    };

    client.on('inputTranscription', handleInputTranscription);
    client.on('outputTranscription', handleOutputTranscription);
    client.on('content', handleContent);
    client.on('turncomplete', handleTurnComplete);

    return () => {
      client.off('inputTranscription', handleInputTranscription);
      client.off('outputTranscription', handleOutputTranscription);
      client.off('content', handleContent);
      client.off('turncomplete', handleTurnComplete);
    };
  }, [client, addHistoryItem, user, language1, language2]);

  return (
    <div className="transcription-container">
      <WelcomeScreen />
    </div>
  );
}