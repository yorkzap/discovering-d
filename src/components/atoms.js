// src/components/atoms.js (or wherever your atoms are)
import { atom } from "jotai";

export const pageAtom = atom(0);
export const bookFloatingAtom = atom(true);
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
export const currentTextLineIndexAtom = atom(0);
export const cameraTargetXOffsetAtom = atom(0);

// Text proximity and passing phase atoms for enhanced book reactions
export const textProximityFactorAtom = atom(0); // 0-1 how close text is to book
export const textPassingPhaseAtom = atom('none'); // 'none', 'approaching', 'passing', 'exiting', 'passed'
export const bookWingFlapIntensityAtom = atom(0); // 0-1 wing flap intensity for text dodging
export const activeTextWorldPositionAtom = atom(null); // THREE.Vector3 or null
export const isPageTurningAtom = atom(false);
export const allowPageTurnAtom = atom(true); // Default to true