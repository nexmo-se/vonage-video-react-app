import { useState, useEffect, useRef, MouseEvent, ReactElement, TouchEvent } from 'react';
import DialogBox, { Message } from '../../components/DialogBox';
import usePreviewPublisherContext from '../../hooks/usePreviewPublisherContext';
import ControlPanel from '../../components/WaitingRoom/ControlPanel';
import VideoContainer from '../../components/WaitingRoom/VideoContainer';
import UsernameInput from '../../components/WaitingRoom/UserNameInput';
import { DEVICE_ACCESS_STATUS } from '../../utils/constants';
import DeviceAccessAlert from '../../components/DeviceAccessAlert';
import Banner from '../../components/Banner';
import { getStorageItem, STORAGE_KEYS } from '../../utils/storage';
import useIsSmallViewport from '../../hooks/useIsSmallViewport';
import PreappointmentButton from '../../components/PreappointmentButton';

// TypeScript: Add OpenTok types for browser compatibility
declare global {
  interface Window {
    OT?: unknown;
  }
}

/**
 * WaitingRoom Component
 *
 * This component renders the waiting room page of the application, including:
 * - A banner containing a company logo, a date-time widget, and a navigable button to a GitHub repo.
 * - A video element showing the user how they'll appear upon joining a room containing controls to:
 *   - Mute their audio input device.
 *   - Disable their video input device.
 *   - Toggle on/off background blur (if supported).
 * - Audio input, audio output, and video input device selectors.
 * - A username input field.
 * - The meeting room name and a button to join the room.
 * @returns {ReactElement} - The waiting room.
 */
const WaitingRoom = (): ReactElement => {
  // Live dialog messages state
  const [messages, setMessages] = useState<Message[]>([]);

  // Store OpenTok session instance
  const [session, setSession] = useState<any>(null);
  const { initLocalPublisher, publisher, accessStatus, destroyPublisher } =
    usePreviewPublisherContext();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openAudioInput, setOpenAudioInput] = useState<boolean>(false);
  const [openVideoInput, setOpenVideoInput] = useState<boolean>(false);
  const [openAudioOutput, setOpenAudioOutput] = useState<boolean>(false);
  const [username, setUsername] = useState(getStorageItem(STORAGE_KEYS.USERNAME) ?? '');
  const [preappointmentStarted, setPreappointmentStarted] = useState(false);
  const [preappointmentLoading, setPreappointmentLoading] = useState(false);
  const [preappointmentStreamId, setPreappointmentStreamId] = useState<string | null>(null);
  const isSmallViewport = useIsSmallViewport();

  const preappointmentSession = useRef<{
    sessionId?: string;
    token?: string;
    apiKey?: string;
  } | null>(null);

  // On mount: if ?name= is present, override username and localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlName = params.get('name');
    if (urlName && urlName.trim() !== '' && urlName !== username) {
      setUsername(urlName);
      try {
        localStorage.setItem(STORAGE_KEYS.USERNAME, urlName);
      } catch (_e) {
        // ignore storage errors
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to get the full Preappointment API URL for a route, using env if set, else local
  const getPreappointmentApiUrl = (route: string) => {
    const base = import.meta.env.VITE_PREAPPOINTMENT_API_URL;
    if (base && base.trim() !== '') {
      return base.replace(/\/$/, '') + route;
    }
    return route;
  };

  // Combined handler: on Start, do /vregister then /vstart; on Stop, do /vstop
  const handlePreappointmentToggle = async () => {
    console.log(
      '[Preappointment] handlePreappointmentToggle called. preappointmentStarted:',
      preappointmentStarted
    );
    setPreappointmentLoading(true);
    if (!preappointmentStarted) {
      console.log('[Preappointment] Starting preappointment flow...');
      try {
        // --- Start: Register, connect, publish, then start ---
        // 1. Register
        const regResponse = await fetch(getPreappointmentApiUrl('/vregister'), { method: 'POST' });
        if (!regResponse.ok) {
          throw new Error('Check-in failed');
        }
        const regData = await regResponse.json();
        if (!regData.session) {
          throw new Error('Invalid response from /vregister');
        }
        preappointmentSession.current = {
          sessionId: regData.session.sessionId,
          token: regData.session.token,
          apiKey: regData.session.apiKey,
        };
        console.log(
          '[Preappointment] preappointmentSession.current set:',
          preappointmentSession.current
        );
        console.log('Preappointment Check-in response:', regData);

        // 2. Connect to OpenTok session and publish local publisher
        let streamId: string | null = null;
        if (window && (window as any).OT && regData.session) {
          const OT = (window as any).OT;
          const session = OT.initSession(regData.session.apiKey, regData.session.sessionId);
          (window as any).OT.sessions = (window as any).OT.sessions || [];
          (window as any).OT.sessions[0] = session;

          // Attach streamCreated handler immediately
          session.on('streamCreated', (event: any) => {
            const sid = event.stream.streamId || event.stream.id;
            console.log('streamCreated: got streamId for vstart:', sid);
            setPreappointmentStreamId(sid);

            // Subscribe to remote streams (not your own) - this is the AI agent's audio
            if (event.stream.connection.connectionId !== session.connection.connectionId) {
              const aiVideoContainer = document.getElementById('ai-video-container');
              const subscriber = session.subscribe(
                event.stream,
                aiVideoContainer,
                {
                  insertMode: 'append',
                  width: '1px',
                  height: '1px',
                  publishAudio: true,
                  publishVideo: false,
                },
                (err: any) => {
                  if (err) {
                    console.error('Error subscribing to AI stream:', err);
                  } else {
                    console.log('Subscribed to AI agent stream (hidden):', sid);
                  }
                }
              );
            }
          });

          // Wait for session.connect and publisher.publish to complete before continuing
          await new Promise<void>((resolve, reject) => {
            session.connect(regData.session.token, (error: any) => {
              if (error) {
                console.error('OpenTok session connect error:', error);
                reject(error);
              } else {
                if (publisher) {
                  session.publish(publisher, (pubErr: any) => {
                    if (pubErr) {
                      console.error('OpenTok publish error:', pubErr);
                      reject(pubErr);
                    } else {
                      console.log('Publisher published to session');
                      // Now that we're published, we can get the streamId from publisher
                      streamId = publisher.stream?.streamId ?? null;
                      setPreappointmentStreamId(streamId);
                      resolve();
                    }
                  });
                } else {
                  console.warn('No publisher available to publish');
                  reject(new Error('No publisher available to publish'));
                }
              }
            });
          });
        }

        // 3. Start
        const sessionId = preappointmentSession.current?.sessionId;
        const sid = streamId || preappointmentStreamId;
        const language = 'en-US';
        const promptId = 24; // 24 is Health Intake prompt. 21 is Pizza Ordering
        const filter = false;
        const voice = 'us';
        if (!sid) {
          console.warn('No streamId available. Wait for streamCreated event.');
          setPreappointmentLoading(false);
          return;
        }
        console.log('Sending vstart payload:', {
          sessionId,
          streamId: sid,
          language,
          promptId,
          filter,
          voice,
        });
        const startResponse = await fetch(getPreappointmentApiUrl('/vstart'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, streamId: sid, language, promptId, filter, voice }),
        });
        const text = await startResponse.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (jsonErr) {
          console.error('vstart: Failed to parse JSON. Raw response:', text);
          data = text;
        }
        if (!startResponse.ok) {
          console.error('vstart: Server returned error', startResponse.status, data);
        } else {
          console.log('Preappointment Start response:', data);
          setPreappointmentStarted(true);
        }
        setPreappointmentLoading(false);
      } catch (err) {
        console.error('Preappointment Toggle error:', err);
        setPreappointmentLoading(false);
      }
    } else {
      // --- Stop ---
      try {
        const sessionId = preappointmentSession.current?.sessionId;
        const response = await fetch(getPreappointmentApiUrl('/vstop'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const text = await response.text();
        let data;
        if (text.trim() === '') {
          data = null;
        } else {
          try {
            data = JSON.parse(text);
          } catch {
            console.error('vstop: Failed to parse JSON. Raw response:', text);
            data = text;
          }
        }
        if (!response.ok) {
          console.error('vstop: Server returned error', response.status, data);
        } else {
          console.log('Preappointment Stop response:', data);
          setPreappointmentStarted(false);
        }
        setPreappointmentLoading(false);
      } catch (err) {
        console.error('Preappointment Toggle error:', err);
        setPreappointmentLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!publisher) {
      initLocalPublisher();
    }
    return () => {
      if (publisher) {
        destroyPublisher();
      }
    };
  }, [initLocalPublisher, publisher, destroyPublisher]);

  // Set up OpenTok session instance after /vregister
  useEffect(() => {
    if (
      window &&
      (window as any).OT &&
      preappointmentSession.current?.sessionId &&
      preappointmentSession.current?.apiKey
    ) {
      const OT = (window as any).OT;
      const s = OT.initSession(
        preappointmentSession.current.apiKey,
        preappointmentSession.current.sessionId
      );
      setSession(s);
      console.log('[Preappointment] setSession called with:', s);
    }
  }, [preappointmentSession.current?.sessionId, preappointmentSession.current?.apiKey]);

  // Signal API: receive AI Health Intake Agent messages
  useEffect(() => {
    if (!session) {
      return;
    }

    // Handler for both USER and ASSISTANT messages via signal:chat
    const chatHandler = (event: { data: unknown }) => {
      console.log('🔔 [Signal API] Raw signal event received:', {
        eventType: event.constructor.name,
        hasData: !!event.data,
        dataType: typeof event.data,
        rawData: event.data,
      });

      try {
        // Parse signal data (should be object from Audio Connector)
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        console.log('🤖 [AI Agent] Parsed signal:chat data:', {
          type: typeof data,
          hasRole: data && typeof data === 'object' && 'role' in data,
          hasContent: data && typeof data === 'object' && 'content' in data,
          fullData: data,
        });

        // Validate signal structure
        if (!data || typeof data !== 'object') {
          console.warn('[AI Agent] Invalid signal format - expected object:', data);
          return;
        }

        const signalData = data as { role?: string; content?: string; [key: string]: unknown };

        // Process both USER and ASSISTANT messages from Signal API
        if (signalData.role === 'ASSISTANT') {
          if (!signalData.content) {
            console.warn('[Signal API] ASSISTANT signal missing content:', signalData);
            return;
          }

          const content = signalData.content.trim();
          if (content.length === 0) {
            console.warn('[Signal API] ASSISTANT signal has empty content');
            return;
          }

          console.log('🤖 [Signal API] Processing ASSISTANT message:', content);

          // Add AI Health Intake Agent message to dialog
          setMessages((prev) => [
            ...prev,
            {
              sender: 'AI Health Agent',
              text: content,
            },
          ]);
        } else if (signalData.role === 'USER') {
          if (!signalData.content) {
            console.warn('[Signal API] USER signal missing content:', signalData);
            return;
          }

          const content = signalData.content.trim();
          if (content.length === 0) {
            console.warn('[Signal API] USER signal has empty content');
            return;
          }

          // Filter out common test/initialization messages that aren't real user speech
          const lowerContent = content.toLowerCase();
          const testPhrases = [
            'hello there',
            'hi there',
            'test',
            'hello',
            'testing',
            'can you hear me',
          ];

          const isTestMessage = testPhrases.some(
            (phrase) => lowerContent === phrase || lowerContent.includes(phrase)
          );

          if (isTestMessage) {
            console.log('🚫 [FILTER] Ignoring test/initialization USER message:', content);
            return;
          }

          console.log('👤 [Signal API] Processing USER message:', content);

          // Add user message to dialog
          const displayName = username || 'You';
          setMessages((prev) => [
            ...prev,
            {
              sender: displayName,
              text: content,
            },
          ]);
        } else {
          console.log('[Signal API] Unknown signal role:', signalData.role, signalData);
        }
      } catch (error) {
        console.error('[AI Agent] Signal processing error:', error, 'Raw data:', event.data);
      }
    };

    // Enhanced debugging: Listen for ALL signal types to see what's being sent
    const debugSignalHandler = (event: any) => {
      console.log('🔍 [DEBUG] Received any signal:', {
        signalType: event.type,
        from: event.from?.connectionId,
        data: event.data,
      });
    };

    // Register handlers for AI Health Intake Agent signals
    session.on('signal', debugSignalHandler); // Catch all signals for debugging
    session.on('signal:chat', chatHandler); // Main chat handler

    console.log('📱 [Dialog Setup] Registered enhanced signal handlers (debug + chat)');

    return () => {
      session.off('signal', debugSignalHandler);
      session.off('signal:chat', chatHandler);
      console.log('📱 [Dialog Cleanup] Removed signal handlers (debug + chat)');
    };
  }, [session, username]);

  // After changing device permissions, reload the page to reflect the device's permission change.
  useEffect(() => {
    if (accessStatus === DEVICE_ACCESS_STATUS.ACCESS_CHANGED) {
      window.location.reload();
    }
  }, [accessStatus]);

  const handleAudioInputOpen = (
    event: MouseEvent<HTMLButtonElement> | TouchEvent<HTMLButtonElement>
  ) => {
    setAnchorEl(event.currentTarget);
    setOpenAudioInput(true);
  };

  const handleVideoInputOpen = (
    event: MouseEvent<HTMLButtonElement> | TouchEvent<HTMLButtonElement>
  ) => {
    setAnchorEl(event.currentTarget);
    setOpenVideoInput(true);
  };

  const handleAudioOutputOpen = (
    event: MouseEvent<HTMLButtonElement> | TouchEvent<HTMLButtonElement>
  ) => {
    setAnchorEl(event.currentTarget);
    setOpenAudioOutput(true);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setOpenAudioInput(false);
    setOpenAudioOutput(false);
    setOpenVideoInput(false);
  };

  return (
    <div className="flex size-full flex-col bg-white" data-testid="waitingRoom">
      {/* Hidden container for AI video to prevent it from overlapping UI elements */}
      <div
        id="ai-video-container"
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          zIndex: -1000,
        }}
      />
      <Banner />
      <div className="flex w-full">
        <div className="flex w-full justify-center">
          <div className="flex w-full flex-col items-center justify-center sm:min-h-[90vh] md:flex-row">
            <div
              className={`max-w-full flex-col ${isSmallViewport ? '' : 'h-[394px]'} sm: inline-flex`}
            >
              <VideoContainer username={username} />
              {accessStatus === DEVICE_ACCESS_STATUS.ACCEPTED && (
                <ControlPanel
                  handleAudioInputOpen={handleAudioInputOpen}
                  handleVideoInputOpen={handleVideoInputOpen}
                  handleAudioOutputOpen={handleAudioOutputOpen}
                  handleClose={handleClose}
                  openAudioInput={openAudioInput}
                  openVideoInput={openVideoInput}
                  openAudioOutput={openAudioOutput}
                  anchorEl={anchorEl}
                />
              )}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: isSmallViewport ? 'column' : 'row',
                alignItems: 'center',
                maxWidth: 700,
                gap: 32,
              }}
            >
              <div style={{ flex: 1, minWidth: 280 }}>
                <UsernameInput
                  username={username}
                  setUsername={setUsername}
                  preappointmentButtons={
                    <PreappointmentButton
                      onClick={handlePreappointmentToggle}
                      label={preappointmentStarted ? 'Preappointment Stop' : 'Preappointment Start'}
                      color={preappointmentStarted ? 'error' : 'success'}
                      // Only disable if publisher is not ready (for Start)
                      disabled={!publisher && !preappointmentStarted}
                      loading={preappointmentLoading}
                    />
                  }
                />
              </div>
              <div style={{ maxWidth: 400, width: '100%' }}>
                <DialogBox messages={[...messages].reverse()} localUser={username || 'You'} />
              </div>
            </div>
          </div>
        </div>
        {accessStatus !== DEVICE_ACCESS_STATUS.ACCEPTED && (
          <DeviceAccessAlert accessStatus={accessStatus} />
        )}
      </div>
    </div>
  );
};

export default WaitingRoom;
