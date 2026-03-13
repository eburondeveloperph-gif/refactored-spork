/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useCallback } from 'react';
import { LiveServerContent } from '@google/genai';
import WelcomeScreen from '../welcome-screen/WelcomeScreen';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { useSettings, useLogStore } from '../../../lib/state';
import { useHistoryStore } from '../../../lib/history';
import { useAuth, updateUserConversations } from '../../../lib/auth';
import { PURE_TRANSLATION_PROMPT } from '../../../lib/prompts';
import { getTrainingExamples, TRAINING_DATA } from '../../../lib/training';

export default function StreamingConsole() {
  const { client, setConfig, waitForAudioCompletion, getTTSParameters } = useLiveAPIContext();
  const { systemPrompt, voice, language1, language2, topic } = useSettings();
  const { addHistoryItem } = useHistoryStore();
  const { user } = useAuth();

  const createSystemPrompt = useCallback(() => {
    const topicContext = topic?.trim()
      ? `The conversation is about: "${topic}". Use this context to apply appropriate terminology and domain knowledge.`
      : '';
    const translationPrompt = PURE_TRANSLATION_PROMPT;
    const trainingExamples = getTrainingExamples(language1, language2, TRAINING_DATA);

    const finalPrompt = translationPrompt + (topicContext ? '\n\n' + topicContext : '') + trainingExamples;

    return finalPrompt;
  }, [language1, language2, topic]);

  useEffect(() => {
    const config = {
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
      (config.speechConfig as Record<string, unknown>).nuanceParams = {
        pitch: ttsParams.pitch,
        rate: ttsParams.rate,
        volume: ttsParams.volume,
        emphasis: ttsParams.emphasis,
        pauses: ttsParams.pauses,
        intonation: ttsParams.intonation,
      };
    }

    setConfig(config as unknown as Parameters<typeof setConfig>[0]);
  }, [setConfig, createSystemPrompt, voice, getTTSParameters, language1, language2, topic]);

  useEffect(() => {
    const { addTurn, updateLastTurn } = useLogStore.getState();

    const handleInputTranscription = (text: string, isFinal: boolean) => {
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];
      if (last && last.role === 'user' && !last.isFinal) {
        updateLastTurn({ text: last.text + text, isFinal });
      } else {
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
      const cleaned = cleanDisplayText(text);
      if (!cleaned) return;
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];
      if (last && last.role === 'agent' && !last.isFinal) {
        updateLastTurn({ text: last.text + cleaned, isFinal });
      } else {
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