import { useState, useEffect, useRef, MouseEvent, ReactElement, TouchEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  const { initLocalPublisher, publisher, accessStatus, destroyPublisher } =
    usePreviewPublisherContext();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openAudioInput, setOpenAudioInput] = useState<boolean>(false);
  const [openVideoInput, setOpenVideoInput] = useState<boolean>(false);
  const [openAudioOutput, setOpenAudioOutput] = useState<boolean>(false);
  const [username, setUsername] = useState(getStorageItem(STORAGE_KEYS.USERNAME) ?? '');
  const [preappointmentStarted, setPreappointmentStarted] = useState(false);
  const [preappointmentStreamId, setPreappointmentStreamId] = useState<string | null>(null);
  const isSmallViewport = useIsSmallViewport();

  const preappointmentSession = useRef<{
    sessionId?: string;
    token?: string;
    apiKey?: string;
  } | null>(null);

  // Pass publisher's connectionId and sessionId to /vregister

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
    try {
      if (!preappointmentStarted) {
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
          token2: regData.session.token2,
          created: regData.session.created,
          id: regData.session.id,
          lang: regData.session.lang,
          streams: regData.session.streams,
          apiKey: regData.session.apiKey,
        };
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

            // Subscribe to remote streams (not your own)
            if (event.stream.connection.connectionId !== session.connection.connectionId) {
              session.subscribe(
                event.stream,
                undefined,
                {
                  insertMode: 'append',
                  width: '100%',
                  height: '100%',
                },
                (err: any) => {
                  if (err) {
                    console.error('Error subscribing to stream:', err);
                  } else {
                    console.log('Subscribed to remote stream:', sid);
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
                      streamId = publisher.stream?.streamId || publisher.stream?.id;
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
        const sessionId = preappointmentSession.current.sessionId;
        const sid = streamId || preappointmentStreamId;
        const language = 'en-US';
        const promptId = 24; // 24 is Health Intake prompt. 21 is Pizza Ordering
        const filter = false;
        const voice = 'us';
        if (!sid) {
          console.warn('No streamId available. Wait for streamCreated event.');
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
      } else {
        // --- Stop ---
        const sessionId = preappointmentSession.current.sessionId;
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
          } catch (_jsonErr) {
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
      }
    } catch (err) {
      console.error('Preappointment Toggle error:', err);
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
                />
              }
            />
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
