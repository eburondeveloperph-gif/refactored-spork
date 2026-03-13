/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useCallback } from 'react';
import { LiveServerContent, Modality } from '@google/genai';
import WelcomeScreen from '../welcome-screen/WelcomeScreen';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { useSettings, useLogStore } from '../../../lib/state';
import { useHistoryStore } from '../../../lib/history';
import { useAuth, updateUserConversations } from '../../../lib/auth';
import { PURE_TRANSLATION_PROMPT } from '../../../lib/prompts';
import { getTrainingExamples, TRAINING_DATA } from '../../../lib/training';

export default function StreamingConsole() {
  const { client, setConfig, waitForAudioCompletion, getTTSParameters } = useLiveAPIContext();
  const { voice, language1, language2, topic } = useSettings();
  const { addHistoryItem } = useHistoryStore();
  const { user } = useAuth();

  const createSystemPrompt = useCallback(() => {
    const langPair = `## LANGUAGE PAIR\nGuest language: ${language1}. Staff language: ${language2}.\n- Input in ${language1} → output in ${language2}\n- Input in ${language2} → output in ${language1}\n- Input in ANY other language → output in ${language2}\n\n## SPECIFIC LANGUAGE RULES\n- English → Dutch Flemish\n- Dutch Flemish → English\n- Thai → Dutch Flemish\n- Arabic → Dutch Flemish\n- NEVER output in the same language as input\n\n`;
    const topicContext = topic?.trim()
      ? `Topic: "${topic}". Use appropriate terminology.\n\n`
      : '';
    const translationPrompt = PURE_TRANSLATION_PROMPT;
    const trainingExamples = getTrainingExamples(language1, language2, TRAINING_DATA);

    return langPair + translationPrompt + topicContext + trainingExamples;
  }, [language1, language2, topic]);

  useEffect(() => {
    const config = {
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      generationConfig: {
        temperature: 0.35,
        topP: 0.95,
        topK: 40,
      },
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
      // Strip thinking/reasoning
      s = s.replace(/^(?:Thought|Thinking|Let me think|Hmm,?|First I need to|I need to)[^.]*\.?\s*/gim, '');
      s = s.replace(/^\[?(?:thought|reasoning|internal)[\s\S]*?\]\s*/gim, '');
      // Strip SSML tags
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
      // Strip metadata (never spoken or displayed)
      s = s.replace(/^Translating[^:]*:\s*/gi, '');
      s = s.replace(/^Translation in [^:]+:\s*/gi, '');
      s = s.replace(/\s*\(TTS audio\)\s*$/gi, '');
      s = s.replace(/^\[.*?\]\s*/g, '');
      s = s.replace(/\s+debug\s*$/gi, '');
      // Fix missing space after sentence punctuation
      s = s.replace(/([.!?,])([A-Za-zÀ-ÿ])/g, '$1 $2');
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