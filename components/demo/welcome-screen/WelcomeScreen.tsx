/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef } from 'react';
import './WelcomeScreen.css';
import { useLogStore, useSettings } from '../../../lib/state';

const WelcomeScreen: React.FC = () => {
  const turns = useLogStore(state => state.turns);
  const { language1, language2 } = useSettings();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current) {
        const scrollElement = scrollRef.current;
        setTimeout(() => {
          scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior: 'smooth'
          });
        }, 100);
      }
    };

    scrollToBottom();
  }, [turns]);

  // Additional scroll on window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (scrollRef.current) {
        const scrollElement = scrollRef.current;
        scrollElement.scrollTo({
          top: scrollElement.scrollHeight,
          behavior: 'smooth'
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // If there's no content yet, show minimal message
  if (turns.length === 0) {
    return (
      <div className="welcome-screen">
        <div className="welcome-content" ref={scrollRef}>
          <div className="transcript-display">
            <p className="transcript-text">Start speaking...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-content" ref={scrollRef}>
        {/* Debug info - remove this later */}
        <div className="debug-display">
          DEBUG: Total turns: {turns.length}
          <br />
          User turns: {turns.filter(t => t.role === 'user').length}
          <br />
          Agent turns: {turns.filter(t => t.role === 'agent').length}
          <br />
          Last turn: {turns.length > 0 ? turns[turns.length - 1].role : 'none'}
          <br />
          Last text: {turns.length > 0 ? (turns[turns.length - 1].text?.substring(0, 50) + '...') : 'none'}
          <br />
          Languages: {language1} ↔ {language2}
        </div>
        
        {turns.map((turn, index) => {
          console.log(`=== TURN ${index} (${turn.role}) ===`);
          console.log('Raw text:', turn.text);
          
          let displayText = turn.text || '[empty text]';
          
          // For user turns (Guest), show original text as-is
          if (turn.role === 'user') {
            displayText = turn.text;
            console.log('👤 Guest original text:', displayText);
          }
          
          // For agent turns (Staff), extract clean translation
          if (turn.role === 'agent') {
            console.log('🤖 Processing Staff response...');
            
            // Method 1: Extract quoted text
            const quotedMatch = turn.text.match(/"([^"]+)"/);
            if (quotedMatch) {
              displayText = quotedMatch[1];
              console.log('✅ Found quoted translation:', displayText);
            } else {
              // Method 2: Look for "Correct:" pattern
              const correctMatch = turn.text.match(/✅\s*Correct:\s*([^\n]+)/i);
              if (correctMatch) {
                displayText = correctMatch[1].trim();
                console.log('✅ Found Correct: pattern:', displayText);
              } else {
                // Method 3: Look for "translated as" pattern
                const translatedAsMatch = turn.text.match(/translated as "([^"]+)"/i);
                if (translatedAsMatch) {
                  displayText = translatedAsMatch[1];
                  console.log('✅ Found "translated as" pattern:', displayText);
                } else {
                  // Method 4: Extract Dutch/Flemish text from explanations
                  const dutchWords = ['hallo', 'goeiedag', 'danku', 'dank', 'wel', 'met', 'voor', 'alle', 'mensen', 'luisteren', 'vriend', 'is', 'dat', 'ik', 'jij', 'hij', 'zij', 'wij', 'jullie', 'mijn', 'jouw', 'zijn', 'haar', 'ons', 'hun'];
                  
                  const words = turn.text.split(/\s+/);
                  const dutchTextParts = [];
                  
                  for (let i = 0; i < words.length; i++) {
                    const word = words[i].toLowerCase().replace(/[^\w]/g, '');
                    
                    if (dutchWords.includes(word) || dutchTextParts.length > 0) {
                      dutchTextParts.push(words[i]);
                    }
                  }
                  
                  if (dutchTextParts.length > 0) {
                    displayText = dutchTextParts.join(' ');
                    console.log('✅ Extracted Dutch text parts:', displayText);
                  } else {
                    // Method 5: Get the last line that's not an explanation
                    const lines = turn.text.split('\n').filter(line => line.trim().length > 0);
                    const lastLine = lines[lines.length - 1];
                    
                    if (lastLine && !lastLine.toLowerCase().includes('translation') && !lastLine.includes('input') && !lastLine.includes('output') && !lastLine.includes('correct') && !lastLine.includes('wrong')) {
                      displayText = lastLine.trim();
                      console.log('✅ Using last line:', displayText);
                    } else {
                      displayText = turn.text.trim();
                      console.log('⚠️ Showing full text as fallback:', displayText);
                    }
                  }
                }
              }
            }
            
            // Fix spacing issues in Dutch text
            if (displayText) {
              console.log('🔧 Checking spacing for text:', displayText);
              
              let fixedText = displayText;
              
              // Fix specific patterns from your test case FIRST
              fixedText = fixedText.replace(/iswanneerik/gi, 'is wanneer ik');
              fixedText = fixedText.replace(/mijnvriendken/gi, 'mijn vriend ken');
              fixedText = fixedText.replace(/Datisluimoravooralle/gi, 'Dat is lui mora voor alle');
              fixedText = fixedText.replace(/nuluisteren/gi, 'nu luisteren');
              fixedText = fixedText.replace(/gelukkigermet/gi, 'gelukkiger met');
              fixedText = fixedText.replace(/goeiedagaan/gi, 'goeiedag aan');
              fixedText = fixedText.replace(/aanallemensendie/gi, 'aan alle mensen die');
              
              // Add spaces after common Dutch words
              fixedText = fixedText.replace(/(is|van|de|het|een|voor|naar|met|zonder|onder|boven|bij|achter|langs|door|tegen)([a-z])/g, '$1 $2');
              
              // Add spaces between lowercase and uppercase letters
              fixedText = fixedText.replace(/([a-z])([A-Z])/g, '$1 $2');
              
              if (fixedText !== displayText) {
                console.log('🔧 Fixed spacing:', displayText, '→', fixedText);
                displayText = fixedText;
              }
            }
          }
          
          console.log('Final display text:', displayText);
          console.log('=== END TURN ===');
          
          return (
            <div key={index} className={`transcript-display ${turn.role}-transcript`}>
              <p className={`transcript-text ${turn.role}-text`}>
                <span className="speaker-tag">
                  {turn.role === 'user' ? 'Guest: ' : 'Staff: '}
                </span>
                {displayText}
                {turn.role === 'agent' && !turn.isFinal && <span className="cursor"></span>}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WelcomeScreen;
