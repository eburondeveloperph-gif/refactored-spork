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

import { useEffect } from 'react';
import ControlTray from './components/console/control-tray/ControlTray';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorScreen from './components/demo/ErrorScreen';
import StreamingConsole from './components/demo/streaming-console/StreamingConsole';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { LiveAPIProvider } from './contexts/LiveAPIContext';
import { useAuth, updateUserSettings } from './lib/auth';
import { useSettings } from './lib/state';

const API_KEY = process.env.API_KEY ?? process.env.GEMINI_API_KEY ?? '';

function SetupScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#0a0a0a',
        color: '#e1e2e3',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔑</div>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>API key required</h1>
      <p style={{ opacity: 0.7, marginBottom: 16, maxWidth: 400 }}>
        Add <code style={{ background: '#2a2f31', padding: '2px 6px', borderRadius: 4 }}>GEMINI_API_KEY</code> to your <code style={{ background: '#2a2f31', padding: '2px 6px', borderRadius: 4 }}>.env.local</code> file.
      </p>
      <p style={{ opacity: 0.7, fontSize: 14, maxWidth: 400 }}>
        Get your key at{' '}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#1f94ff' }}>
          Google AI Studio
        </a>
      </p>
    </div>
  );
}

/**
 * Main application component that provides a streaming interface for Live API.
 * Manages video streaming state and provides controls for webcam/screen capture.
 */
function App() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const unsub = useSettings.subscribe((state, prevState) => {
      const changes: Partial<{ systemPrompt: string; voice: string }> = {};
      if (state.systemPrompt !== prevState.systemPrompt) {
        changes.systemPrompt = state.systemPrompt;
      }
      if (state.voice !== prevState.voice) {
        changes.voice = state.voice;
      }
      if (Object.keys(changes).length > 0) {
        updateUserSettings(user.id, changes);
      }
    });

    return () => unsub();
  }, [user]);

  if (!API_KEY || typeof API_KEY !== 'string') {
    return <SetupScreen />;
  }

  return (
    <div className="App">
      <LiveAPIProvider apiKey={API_KEY}>
        <ErrorScreen />
        <Header />
        <Sidebar />
        <div className="streaming-console">
          <main>
            <div className="main-app-area">
              <StreamingConsole />
            </div>
            <ControlTray></ControlTray>
          </main>
        </div>
      </LiveAPIProvider>
    </div>
  );
}

export default App;