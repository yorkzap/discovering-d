// src/components/atoms.js (or wherever your atoms are)
import { atom } from "jotai";

export const cameraFocusAtom = atom(null);
export const triggerCameraResetAtom = atom(0);
export const audioAnalyserAtom = atom(null);
export const isMusicPlayingAtom = atom(false);
export const isBoostingAtom = atom(false);          // For current boost state
export const boostActivationTimeAtom = atom(0);   // When current boost started
export const showInitialFlightEffectAtom = atom(false);
export const hasInitialFlightOccurredAtom = atom(false);

// New atom for scheduling page turn boost
export const pageTurnBoostScheduledTimeAtom = atom(null); // Stores timestamp or null