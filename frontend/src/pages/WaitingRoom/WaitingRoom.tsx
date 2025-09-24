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
  const [preapptStarted, setPreapptStarted] = useState(false);
  const [preapptCheckedIn, setPreapptCheckedIn] = useState(false);
  const isSmallViewport = useIsSmallViewport();

  const preapptSession = useRef<{ sessionId?: string; jwt?: string; apiKey?: string } | null>(null);

  // Pass publisher's connectionId and sessionId to /vregister

  // Helper to get the full Preappointment API URL for a route, using env if set, else local
  const getPreapptApiUrl = (route: string) => {
    const base = import.meta.env.VITE_PREAPPOINTMENT_API_URL;
    if (base && base.trim() !== '') {
      return base.replace(/\/$/, '') + route;
    }
    return route;
  };

  const handlePreappointmentCheckin = async () => {
    try {
      const response = await fetch(getPreapptApiUrl('/vregister'), { method: 'POST' });
      if (!response.ok) throw new Error('Check-in failed');
      const data = await response.json();
      preapptSession.current = data;
      setPreapptCheckedIn(true);
      console.log('Preappointment Check-in response:', data);
    } catch (err) {
      setPreapptCheckedIn(false);
      console.error('Preappointment Check-in error:', err);
    }
  };

  const handlePreappointmentToggle = async () => {
    try {
      if (!preapptStarted) {
        // Start
        if (!preapptSession.current?.jwt) {
          console.warn('No preappointment JWT/session. Run check-in first.');
          return;
        }
        const publisherId = 'pub-' + preapptSession.current.jwt;
        const response = await fetch(getPreapptApiUrl('/vstart'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publisherId }),
        });
        const data = await response.json();
        console.log('Preappointment Start response:', data);
        setPreapptStarted(true);
      } else {
        // Stop
        const response = await fetch(getPreapptApiUrl('/vstop'), { method: 'POST' });
        const data = await response.json();
        console.log('Preappointment Stop response:', data);
        setPreapptStarted(false);
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
      // Ensure we destroy the publisher and release any media devices.
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
                <>
                  {!preapptCheckedIn && (
                    <PreappointmentButton
                      onClick={handlePreappointmentCheckin}
                      label="Preappointment Check-in"
                      color="primary"
                    />
                  )}
                  {preapptCheckedIn && (
                    <PreappointmentButton
                      onClick={handlePreappointmentToggle}
                      label={preapptStarted ? 'Preappointment Stop' : 'Preappointment Start'}
                      color={preapptStarted ? 'error' : 'success'}
                    />
                  )}
                </>
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
