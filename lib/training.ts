/**
 * Training data loader for AI translation examples
 * Uses training_conversations.json as few-shot examples
 */

// @ts-ignore - JSON import
import trainingConversationsData from '../training_conversations.json';

export interface TrainingConversation {
  conversation_number: number;
  language: string;
  conversation: string;
}

export interface TrainingData {
  conversations: TrainingConversation[];
}

/** Language name mapping for matching settings to training data */
const LANGUAGE_MAP: Record<string, string[]> = {
  'Spanish': ['Spanish', 'Spanish (Spain)', 'Spanish (Mexico)'],
  'French': ['French', 'French (France)'],
  'German': ['German'],
  'Italian': ['Italian'],
  'Japanese': ['Japanese'],
  'Portuguese': ['Portuguese (Brazil)', 'Portuguese (Portugal)', 'Portuguese'],
  'Russian': ['Russian'],
  'Korean': ['Korean'],
  'Arabic': ['Arabic'],
  'Mandarin Chinese': ['Chinese (Simplified)', 'Mandarin Chinese', 'Chinese'],
  'English (US)': ['English', 'English (US)'],
  'Dutch (Flemish)': ['Dutch', 'Dutch (Flemish)'],
};

function matchesLanguage(settingLang: string, trainingLang: string): boolean {
  const setting = settingLang.toLowerCase();
  const training = trainingLang.toLowerCase();
  if (setting.includes(training) || training.includes(setting)) return true;
  const aliases = LANGUAGE_MAP[trainingLang] || [trainingLang];
  return aliases.some(a => a.toLowerCase().includes(setting) || setting.includes(a.toLowerCase()));
}

/**
 * Get training examples for the current language pair.
 * Returns up to 2 conversation excerpts (first 3 exchanges each) to keep prompt size manageable.
 */
export function getTrainingExamples(
  language1: string,
  language2: string,
  trainingData: TrainingData | null
): string {
  if (!trainingData?.conversations?.length) return '';

  const examples: string[] = [];
  const targetLangs = [language1, language2];

  for (const conv of trainingData.conversations) {
    const convLang = conv.language;
    if (!targetLangs.some(l => matchesLanguage(l, convLang))) continue;

    // Extract first 3 Guest/Translation pairs as a compact example
    const lines = conv.conversation.split('\n\n').slice(0, 6);
    const excerpt = lines.join('\n\n');
    if (excerpt.length > 800) {
      examples.push(`[${convLang} example - first exchanges]\n${excerpt.substring(0, 800)}...`);
    } else {
      examples.push(`[${convLang} example]\n${excerpt}`);
    }
    if (examples.length >= 2) break;
  }

  if (examples.length === 0) return '';
  return `\n\n## TRAINING EXAMPLES (learn from these patterns)\n\n${examples.join('\n\n---\n\n')}`;
}

/** Pre-loaded training data from training_conversations.json */
export const TRAINING_DATA: TrainingData = trainingConversationsData as TrainingData;
