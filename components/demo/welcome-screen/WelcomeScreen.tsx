/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import './WelcomeScreen.css';
import { useLogStore } from '../../../lib/state';

const WelcomeScreen: React.FC = () => {
  const turns = useLogStore((state) => state.turns);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const timer = setTimeout(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, [turns]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleResize = () => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        {turns.map((turn, index) => {
          const displayText = turn.text?.trim() || '';
          if (!displayText) return null;

          const speakerTag = turn.role === 'user' ? 'Guest: ' : 'Translation: ';

          return (
            <div key={`turn-${index}`} className={`transcript-display ${turn.role}-transcript`}>
              <p className={`transcript-text ${turn.role}-text`}>
                <span className="speaker-tag">{speakerTag}</span>
                {displayText}
                {turn.role === 'agent' && !turn.isFinal && <span className="cursor" />}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WelcomeScreen;
