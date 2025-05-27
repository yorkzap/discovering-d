// src/components/BackgroundMusic.jsx
import { useAtom, useSetAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import { isMusicPlayingAtom, audioAnalyserAtom } from './atoms';

export const BackgroundMusic = () => {
  const [isPlaying, setIsPlaying] = useAtom(isMusicPlayingAtom);
  const setAnalyserNode = useSetAtom(audioAnalyserAtom);

  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const isAudioSetupDone = useRef(false); // Flag to ensure setup runs once

  // Create the HTMLAudioElement once on mount
  useEffect(() => {
    if (!audioRef.current) {
      const audioEl = new Audio('/audio/background-music.mp3'); // Ensure this path is correct
      audioEl.crossOrigin = "anonymous";
      audioEl.loop = true;
      audioEl.volume = 0.3; // Adjust default volume
      audioRef.current = audioEl;
      console.log("BackgroundMusic: HTMLAudioElement created.");
    }
  }, []);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) {
      // console.log("BackgroundMusic: Audio element not ready for play/pause logic.");
      return;
    }

    if (isPlaying) {
      console.log("BackgroundMusic: isPlaying is true. Attempting to setup/play.");

      if (!isAudioSetupDone.current) {
        console.log("BackgroundMusic: Performing first-time Web Audio setup.");
        try {
          const context = new (window.AudioContext || window.webkitAudioContext)();
          audioContextRef.current = context;

          const analyser = context.createAnalyser();
          analyser.fftSize = 256; // Standard FFT size
          analyserRef.current = analyser;
          setAnalyserNode(analyser);

          sourceRef.current = context.createMediaElementSource(audioEl);
          sourceRef.current.connect(analyser);
          analyser.connect(context.destination);
          isAudioSetupDone.current = true;
          console.log("BackgroundMusic: Web Audio setup successful.");
        } catch (e) {
          console.error("BackgroundMusic: Error setting up Web Audio API:", e);
          setIsPlaying(false);
          return;
        }
      }

      if (audioContextRef.current) {
        audioContextRef.current.resume().then(() => {
          console.log("BackgroundMusic: AudioContext resumed.");
          if (audioEl.paused) {
            const playPromise = audioEl.play();
            if (playPromise !== undefined) {
              playPromise.then(() => {
                console.log("BackgroundMusic: Playback started.");
              }).catch(error => {
                console.error("BackgroundMusic: Error during audioEl.play():", error);
                if (error.name === 'NotAllowedError') {
                    console.warn("BackgroundMusic: Playback NotAllowedError. User gesture might not have been registered or AudioContext is still restricted.");
                }
                setIsPlaying(false);
              });
            }
          } else {
            // console.log("BackgroundMusic: Audio already playing or play has been initiated.");
          }
        }).catch(e => {
          console.error("BackgroundMusic: AudioContext.resume() failed:", e);
          setIsPlaying(false);
        });
      } else {
        console.warn("BackgroundMusic: AudioContext not available for resume/play.");
        setIsPlaying(false);
      }

    } else { // When isPlaying is false
      // console.log("BackgroundMusic: isPlaying is false. Pausing audio if playing.");
      if (!audioEl.paused) {
        audioEl.pause();
        console.log("BackgroundMusic: Playback paused.");
      }
    }

  }, [isPlaying, setIsPlaying, setAnalyserNode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("BackgroundMusic: Unmounting. Cleaning up.");
      audioRef.current?.pause();
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      // if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      //   audioContextRef.current.close().catch(e => console.warn("Error closing audio context on unmount", e));
      // }
      console.log("BackgroundMusic: Cleanup finished.");
    };
  }, []);

  return null;
};