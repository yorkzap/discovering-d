// src/components/Experience.jsx
import { Environment, Float, OrbitControls } from "@react-three/drei";
import { useAtom, useSetAtom } from "jotai";
import { Book } from "./Book";
import { FloatingSpaceText } from "./FloatingSpaceText";
import { bookFloatingAtom, pageAtom, pages as appPages } from "./UI";
import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import {
  cameraFocusAtom,
  triggerCameraResetAtom,
  audioAnalyserAtom,
  isMusicPlayingAtom,
  isBoostingAtom,
  boostActivationTimeAtom,
  currentTextLineIndexAtom,
  textProximityFactorAtom,
  textPassingPhaseAtom,
  bookWingFlapIntensityAtom,
  activeTextWorldPositionAtom, // Make sure this is imported from your atoms file
} from "./atoms";
import { gsap } from "gsap";
import * as THREE from "three";
import { AudioVisualizer } from "./AudioVisualizer";
import { AnimatedBackground } from "./AnimatedBackground";
import { DistantNebula } from "./DistantNebula";

// --- Constants from YOUR ORIGINAL FILE ---
const INITIAL_CAMERA_POSITION = new THREE.Vector3(0, 0.8, 3.2);
const INITIAL_TARGET_POSITION = new THREE.Vector3(0, 0.1, 0);
const BOOST_DURATION = 2500;
const BOOST_Z_DISPLACEMENT_AWAY = -0.75;
const BASE_FLOAT_SPEED = 0.45;
const BASE_FLOAT_INTENSITY = 0.06;
const TURB_POS_BASE_AMP_X = 0.008;
const TURB_POS_BASE_AMP_Y = 0.012;
const TURB_POS_BASE_AMP_Z = 0.006;
const TURB_ROT_BASE_AMP_X = 0.008;
const TURB_ROT_BASE_AMP_Y = 0.015;
const TURB_ROT_BASE_AMP_Z = 0.006;
const TURB_POS_FREQ_X = 0.8;
const TURB_POS_FREQ_Y = 1.1;
const TURB_POS_FREQ_Z = 0.6;
const TURB_ROT_FREQ_X = 0.7;
const TURB_ROT_FREQ_Y = 0.9;
const TURB_ROT_FREQ_Z = 0.5;
const TURBULENCE_LERP_FACTOR = 0.08;
const BOOK_BOOST_FLOAT_SPEED_MULT = 4.2;
const BOOK_BOOST_FLOAT_INTENSITY_MULT = 3.5;
const BOOK_YAW_AMOUNT = Math.PI / 20;
const BOOK_POS_X_SHIFT_AMOUNT = 1.5;
const BOOK_POS_Z_SHIFT_AMOUNT = 1.2;
const BOOK_AILERON_ROLL_AMOUNT = Math.PI / 14;
const BOOK_PITCH_UP_AMOUNT = -Math.PI / 10; // Negative for pitch up
const BOOK_REACTION_LERP_SPEED = 0.08;
const AILERON_ROLL_INITIAL_LERP_SPEED = 0.015;
const AILERON_ROLL_PEAK_SLO_MO_LERP_SPEED = 0.004;
const AILERON_ROLL_RECOVERY_SPEED = 0.025;
const WING_FLAP_LERP_SPEED = 0.12;
const BOOK_LATERAL_SHIFT_Y = 0.8;
const BOOK_LATERAL_SHIFT_X = 1.4; // Used in 'passing' phase in original
const BOOK_DRAMATIC_PITCH_AMOUNT = -Math.PI / 8; // Negative for pitch up
const BOOK_ENHANCED_AILERON_ROLL = Math.PI / 15; // Used for right text roll
const ULTRA_EARLY_SENSE_THRESHOLD = 0.08;
const EARLY_ANTICIPATION_THRESHOLD = 0.18;
const BANKING_START_THRESHOLD = 0.28;
const PEAK_BANKING_THRESHOLD = 0.65;
const SUSTAINED_PEAK_END = 0.82;
const RECOVERY_START_THRESHOLD = 0.88;
const FINAL_GLIDE_THRESHOLD = 0.95;
// const MOVEMENT_EASE_FACTOR = 1.2; // Not directly used in target calculation, more for lerp interpretation
const LEFT_TEXT_EXTRA_HEIGHT = 0.4;
const INITIAL_OPEN_DAMPING = 0.25;
const CAMERA_SHAKE_INTENSITY = 0.015; // Base multiplier for shake
// const CAMERA_SHAKE_FREQUENCY = 12; // Not used directly in this structure
const CAMERA_SHAKE_DECAY = 0.92;

// --- "Curious Reader" Base Behavior Constants ---
const CURIOUS_YAW_FACTOR = 0.6; // How much of BOOK_YAW_AMOUNT to use for curious lean
const CURIOUS_PITCH_FORWARD_AMOUNT = Math.PI / 45; // Gentle pitch forward
const CURIOUS_LIFT_AMOUNT = 0.05;                 // Slight lift
const CURIOUS_SLIGHT_SHIFT_Z_BACKWARDS = 0.1;   // Tiny move back

// --- Breathing Life ---
const BREATH_FREQUENCY = 0.35;
const BREATH_AMPLITUDE_BASE = 0.0025;
const BREATH_AMPLITUDE_TEXT_PROXIMITY_MULTIPLIER = 1.8;

// --- Blend Factors for Original Animations ---
// These control how much of your original dramatic motion is added.
// 0.0 = only curious lean, 1.0 = curious lean + full original drama.
// Start with smaller values (e.g., 0.3 - 0.7) and tune.
const BLEND_ORIGINAL_YAW = 0.4;
const BLEND_ORIGINAL_SHIFT_X = 0.5;
const BLEND_ORIGINAL_SHIFT_Y = 0.6;
const BLEND_ORIGINAL_SHIFT_Z = 0.6;
const BLEND_ORIGINAL_ROLL = 0.7;
const BLEND_ORIGINAL_PITCH = 0.5;
const BLEND_ORIGINAL_DRAMATIC_PITCH = 0.8;
const BLEND_ORIGINAL_WING_FLAP = 0.9;


export const Experience = () => {
  const [isFloatingActiveOriginal] = useAtom(bookFloatingAtom);
  const [focus, setFocusAtom] = useAtom(cameraFocusAtom);
  const [triggerReset, setTriggerResetAtom] = useAtom(triggerCameraResetAtom);
  const [currentPage] = useAtom(pageAtom);
  const [currentLineIdx] = useAtom(currentTextLineIndexAtom);
  const [textProximity] = useAtom(textProximityFactorAtom);
  const [textPassingPhase] = useAtom(textPassingPhaseAtom);
  const setBookWingFlapIntensity = useSetAtom(bookWingFlapIntensityAtom);
  const [analyser] = useAtom(audioAnalyserAtom);
  const [isMusicPlayingValue] = useAtom(isMusicPlayingAtom);
  const [isBoosting, setIsBoosting] = useAtom(isBoostingAtom);
  const [boostActivationTime] = useAtom(boostActivationTimeAtom);
  const [activeTextPosition] = useAtom(activeTextWorldPositionAtom); // From "Curious Reader"

  const { camera, controls: initialControlsInstance } = useThree();
  const controlsRef = useRef();
  const [isUserOrbiting, setIsUserOrbiting] = useState(false);
  const previousCameraState = useRef(null);
  const bookGroupRef = useRef();
  const dataArray = useRef(null);

  const bookMusicPosition = useRef(new THREE.Vector3(0, 0, 0));
  const bookMusicRotationY = useRef(0);
  const bookBoostZOffset = useRef(0);
  const bookTurbulencePosition = useRef(new THREE.Vector3(0, 0, 0));
  const bookTurbulenceRotation = useRef(new THREE.Euler(0, 0, 0));
  const bookFloatSpeedMultiplier = useRef(1);
  const bookFloatIntensityMultiplier = useRef(1);
  const smoothedBass = useRef(0);

  const currentCameraShakeIntensity = useRef(0); // Renamed from cameraShakeIntensity to avoid conflict with constant
  const cameraShakeOffset = useRef(new THREE.Vector3(0, 0, 0));
  // const originalCameraPosition = useRef(new THREE.Vector3()); // Not used in this structure

  const targetBookYaw = useRef(0);
  const targetBookShiftX = useRef(0);
  const targetBookShiftY = useRef(0);
  const targetBookShiftZ = useRef(0);
  const targetBookAileronRoll = useRef(0);
  const targetBookPitch = useRef(0);
  const targetBookDramaticPitch = useRef(0);
  const targetBookWingFlap = useRef(0);

  const currentBookYaw = useRef(0);
  const currentBookShiftX = useRef(0);
  const currentBookShiftY = useRef(0);
  const currentBookShiftZ = useRef(0);
  const currentBookAileronRoll = useRef(0);
  const currentBookPitch = useRef(0);
  const currentBookDramaticPitch = useRef(0);
  const currentBookWingFlap = useRef(0);
  const prevTextProximityRef = useRef(0);

  // --- Main Text Reaction Logic ---
  useEffect(() => {
    const pageData = appPages[currentPage];
    let textIsActive = false;
    let textIsFromLeft = true;

    if (pageData && pageData.floatingTexts && currentLineIdx >= 0 && currentLineIdx < pageData.floatingTexts.length) {
      textIsActive = true;
      textIsFromLeft = currentLineIdx % 2 === 0;
    }

    // Reset additive components & camera shake for this frame
    let additiveYaw = 0, additiveShiftX = 0, additiveShiftY = 0, additiveShiftZ = 0;
    let additiveRoll = 0, additivePitch = 0, additiveDramaticPitch = 0, additiveWingFlap = 0;
    currentCameraShakeIntensity.current = 0; // Reset before calculating for current text

    if (textIsActive) {
      const effectStrength = textProximity; // For curious lean (0 to 1 sine curve)
      const sideSign = textIsFromLeft ? 1 : -1; // +1 for left text (book yaws left), -1 for right

      // 1. Base "Curious Reader" Targets (lean TOWARDS text)
      const curiousYaw = sideSign * BOOK_YAW_AMOUNT * CURIOUS_YAW_FACTOR * effectStrength;
      const curiousPitch = CURIOUS_PITCH_FORWARD_AMOUNT * effectStrength;
      const curiousShiftY = CURIOUS_LIFT_AMOUNT * effectStrength;
      const curiousShiftZ = CURIOUS_SLIGHT_SHIFT_Z_BACKWARDS * effectStrength;
      // Base curious roll is minimal, main roll comes from additive.
      const curiousBaseRoll = sideSign * (Math.PI / 90) * effectStrength; // Tiny roll with lean
      // Base curious wing flap (gentle)
      const curiousWingFlap = (0.05 + 0.15 * Math.sin(effectStrength * Math.PI)) * effectStrength;


      // 2. Additive components from YOUR ORIGINAL logic, scaled by BLEND_FACTORS
      const anticipationCurve = (t) => Math.pow(t, 0.6);
      const dramaticCurve = (t) => 1 - Math.pow(1 - t, 2.5);
      const recoveryCurve = (t) => Math.pow(t, 1.8);

      if (textIsFromLeft) {
        if (textPassingPhase === 'approaching') {
          const curve = anticipationCurve(textProximity);
          additiveYaw = (BOOK_YAW_AMOUNT * 0.3 * curve) * BLEND_ORIGINAL_YAW;
          additiveShiftX = (BOOK_POS_X_SHIFT_AMOUNT * 0.2 * curve) * BLEND_ORIGINAL_SHIFT_X;
          additiveShiftY = (BOOK_LATERAL_SHIFT_Y * 0.15 * curve) * BLEND_ORIGINAL_SHIFT_Y;
          additiveShiftZ = (BOOK_POS_Z_SHIFT_AMOUNT * 0.1 * curve) * BLEND_ORIGINAL_SHIFT_Z;
          additiveRoll = (-BOOK_AILERON_ROLL_AMOUNT * 0.1 * curve) * BLEND_ORIGINAL_ROLL;
          additivePitch = (BOOK_PITCH_UP_AMOUNT * 0.4 * curve) * BLEND_ORIGINAL_PITCH;
          additiveWingFlap = (0.2 * curve) * BLEND_ORIGINAL_WING_FLAP;
        } else if (textPassingPhase === 'passing') {
          const curve = dramaticCurve(textProximity);
          additiveYaw = (BOOK_YAW_AMOUNT * 0.85 * curve) * BLEND_ORIGINAL_YAW;
          additiveShiftX = (BOOK_LATERAL_SHIFT_X * 0.8 * curve) * BLEND_ORIGINAL_SHIFT_X;
          additiveShiftY = ((BOOK_LATERAL_SHIFT_Y * 1.1 + LEFT_TEXT_EXTRA_HEIGHT) * curve) * BLEND_ORIGINAL_SHIFT_Y;
          additiveShiftZ = (-BOOK_POS_Z_SHIFT_AMOUNT * 0.7 * curve) * BLEND_ORIGINAL_SHIFT_Z;
          additiveRoll = (-BOOK_AILERON_ROLL_AMOUNT * 0.7 * curve) * BLEND_ORIGINAL_ROLL;
          additivePitch = (BOOK_PITCH_UP_AMOUNT * 1.2) * BLEND_ORIGINAL_PITCH; // Original was not curve based
          additiveDramaticPitch = (BOOK_DRAMATIC_PITCH_AMOUNT * 1.1 * curve) * BLEND_ORIGINAL_DRAMATIC_PITCH;
          additiveWingFlap = (0.85) * BLEND_ORIGINAL_WING_FLAP; // Original was not curve based
          currentCameraShakeIntensity.current = Math.max(currentCameraShakeIntensity.current, 0.3 * curve);
        } else if (textPassingPhase === 'exiting') {
          const curve = recoveryCurve(1 - textProximity);
          additiveYaw = (BOOK_YAW_AMOUNT * 0.15 * curve) * BLEND_ORIGINAL_YAW;
          additiveShiftX = (BOOK_LATERAL_SHIFT_X * 0.3 * curve) * BLEND_ORIGINAL_SHIFT_X;
          additiveShiftY = ((BOOK_LATERAL_SHIFT_Y * 0.2 + LEFT_TEXT_EXTRA_HEIGHT * 0.3) * curve) * BLEND_ORIGINAL_SHIFT_Y;
          additiveShiftZ = (-BOOK_POS_Z_SHIFT_AMOUNT * 0.2 * curve) * BLEND_ORIGINAL_SHIFT_Z;
          additiveRoll = (-BOOK_AILERON_ROLL_AMOUNT * 0.05 * curve) * BLEND_ORIGINAL_ROLL;
          additivePitch = (BOOK_PITCH_UP_AMOUNT * 0.2) * BLEND_ORIGINAL_PITCH; // Original was not curve based
          additiveDramaticPitch = (BOOK_DRAMATIC_PITCH_AMOUNT * 0.1 * curve) * BLEND_ORIGINAL_DRAMATIC_PITCH;
          additiveWingFlap = (0.25 * curve) * BLEND_ORIGINAL_WING_FLAP;
        } else { // Default/Other phase
          const curve = anticipationCurve(textProximity);
          additiveYaw = (BOOK_YAW_AMOUNT * 0.5 * curve) * BLEND_ORIGINAL_YAW;
          additiveShiftX = (BOOK_POS_X_SHIFT_AMOUNT * 0.6 * curve) * BLEND_ORIGINAL_SHIFT_X;
          additiveShiftY = (BOOK_LATERAL_SHIFT_Y * 0.1 * curve) * BLEND_ORIGINAL_SHIFT_Y;
          // additiveShiftZ = 0; // Original
          additivePitch = (BOOK_PITCH_UP_AMOUNT * textProximity) * BLEND_ORIGINAL_PITCH; // Original direct proximity
          // additiveRoll = 0; // Original
          additiveWingFlap = (0.1 * curve) * BLEND_ORIGINAL_WING_FLAP;
        }
      } else { // Right Text
        if (textPassingPhase === 'approaching') {
          const curve = anticipationCurve(textProximity);
          additiveYaw = (-BOOK_YAW_AMOUNT * 0.6 * curve) * BLEND_ORIGINAL_YAW;
          additiveShiftX = (-BOOK_POS_X_SHIFT_AMOUNT * 0.3 * curve) * BLEND_ORIGINAL_SHIFT_X;
          additiveShiftY = (BOOK_LATERAL_SHIFT_Y * 0.25 * curve) * BLEND_ORIGINAL_SHIFT_Y;
          additiveShiftZ = (-BOOK_POS_Z_SHIFT_AMOUNT * 0.2 * curve) * BLEND_ORIGINAL_SHIFT_Z;
          additiveRoll = (BOOK_ENHANCED_AILERON_ROLL * 0.3 * curve) * BLEND_ORIGINAL_ROLL;
          additivePitch = (BOOK_PITCH_UP_AMOUNT * textProximity) * BLEND_ORIGINAL_PITCH;
          additiveWingFlap = (0.3 * curve) * BLEND_ORIGINAL_WING_FLAP;
        } else if (textPassingPhase === 'passing') {
          const curve = dramaticCurve(textProximity);
          additiveYaw = (-BOOK_YAW_AMOUNT * 0.9 * curve) * BLEND_ORIGINAL_YAW;
          additiveShiftX = (-BOOK_LATERAL_SHIFT_X * 0.8 * curve) * BLEND_ORIGINAL_SHIFT_X;
          additiveShiftY = (BOOK_LATERAL_SHIFT_Y * 0.9 * curve) * BLEND_ORIGINAL_SHIFT_Y;
          additiveShiftZ = (-BOOK_POS_Z_SHIFT_AMOUNT * 0.7 * curve) * BLEND_ORIGINAL_SHIFT_Z;
          additiveRoll = (BOOK_ENHANCED_AILERON_ROLL * 0.8 * curve) * BLEND_ORIGINAL_ROLL;
          additivePitch = (BOOK_PITCH_UP_AMOUNT * 1.1) * BLEND_ORIGINAL_PITCH;
          additiveDramaticPitch = (BOOK_DRAMATIC_PITCH_AMOUNT * 1.2 * curve) * BLEND_ORIGINAL_DRAMATIC_PITCH;
          additiveWingFlap = (0.95) * BLEND_ORIGINAL_WING_FLAP;
          currentCameraShakeIntensity.current = Math.max(currentCameraShakeIntensity.current, 0.35 * curve);
        } else if (textPassingPhase === 'exiting') {
          const curve = recoveryCurve(1 - textProximity);
          additiveYaw = (-BOOK_YAW_AMOUNT * 0.2 * curve) * BLEND_ORIGINAL_YAW;
          additiveShiftX = (-BOOK_LATERAL_SHIFT_X * 0.25 * curve) * BLEND_ORIGINAL_SHIFT_X;
          additiveShiftY = (BOOK_LATERAL_SHIFT_Y * 0.15 * curve) * BLEND_ORIGINAL_SHIFT_Y;
          additiveShiftZ = (-BOOK_POS_Z_SHIFT_AMOUNT * 0.1 * curve) * BLEND_ORIGINAL_SHIFT_Z;
          additiveRoll = (BOOK_ENHANCED_AILERON_ROLL * 0.05 * curve) * BLEND_ORIGINAL_ROLL;
          additivePitch = (BOOK_PITCH_UP_AMOUNT * 0.15) * BLEND_ORIGINAL_PITCH;
          additiveWingFlap = (0.4 * curve) * BLEND_ORIGINAL_WING_FLAP;
        } else { // Default/Other phase
          const curve = anticipationCurve(textProximity);
          additiveYaw = (-BOOK_YAW_AMOUNT * 0.5 * curve) * BLEND_ORIGINAL_YAW;
          additiveShiftX = (-BOOK_POS_X_SHIFT_AMOUNT * 0.6 * curve) * BLEND_ORIGINAL_SHIFT_X;
          additiveShiftY = (BOOK_LATERAL_SHIFT_Y * 0.1 * curve) * BLEND_ORIGINAL_SHIFT_Y;
          // additiveShiftZ = 0;
          additivePitch = (BOOK_PITCH_UP_AMOUNT * textProximity) * BLEND_ORIGINAL_PITCH;
          // additiveRoll = 0;
          additiveWingFlap = (0.2 * curve) * BLEND_ORIGINAL_WING_FLAP;
        }
      }

      // 3. Combine Curious + Additive Components
      targetBookYaw.current = curiousYaw + additiveYaw;
      targetBookShiftX.current = additiveShiftX; // Let original logic primarily drive X shift for now, curious X is small.
                                                 // Or: targetBookShiftX.current = (-sideSign * CURIOUS_SLIGHT_SHIFT_X_TOWARDS_TEXT * effectStrength * (1-BLEND_ORIGINAL_SHIFT_X)) + additiveShiftX;
      targetBookShiftY.current = curiousShiftY + additiveShiftY;
      targetBookShiftZ.current = curiousShiftZ + additiveShiftZ;
      targetBookAileronRoll.current = curiousBaseRoll + additiveRoll;
      targetBookPitch.current = curiousPitch + additivePitch;
      targetBookDramaticPitch.current = additiveDramaticPitch;
      targetBookWingFlap.current = curiousWingFlap + additiveWingFlap;


    } else {
      // Smooth return to neutral for ALL target refs
      targetBookYaw.current = 0;
      targetBookShiftX.current = 0;
      targetBookShiftY.current = 0;
      targetBookShiftZ.current = 0;
      targetBookAileronRoll.current = 0;
      targetBookPitch.current = 0;
      targetBookDramaticPitch.current = 0;
      targetBookWingFlap.current = 0;
      currentCameraShakeIntensity.current = 0;
    }
  }, [currentPage, currentLineIdx, textProximity, textPassingPhase]);

  // ... (useEffect for controls setup - NO CHANGES from your original file) ...
  useEffect(() => {
    if (initialControlsInstance) {
      controlsRef.current = initialControlsInstance;
      controlsRef.current.enableDamping = true;
      controlsRef.current.dampingFactor = 0.08;
      controlsRef.current.screenSpacePanning = false;
      controlsRef.current.minDistance = 0.8;
      controlsRef.current.maxDistance = 12;
      controlsRef.current.maxPolarAngle = Math.PI / 1.6;
      controlsRef.current.minPolarAngle = Math.PI / 12;
      controlsRef.current.zoomSpeed = 0.6;
      controlsRef.current.rotateSpeed = 0.4;
      controlsRef.current.panSpeed = 0.6;

      const handleStart = () => setIsUserOrbiting(true);
      const handleEnd = () => setIsUserOrbiting(false);
      
      controlsRef.current.addEventListener('start', handleStart);
      controlsRef.current.addEventListener('end', handleEnd);

      if (!focus && !previousCameraState.current) {
        if (camera.position.equals(new THREE.Vector3(0, 0, 0))) {
          camera.position.copy(INITIAL_CAMERA_POSITION);
        }
        if (controlsRef.current.target.equals(new THREE.Vector3(0, 0, 0))) {
          controlsRef.current.target.copy(INITIAL_TARGET_POSITION);
        }
      }
      controlsRef.current.update();
      return () => {
        if (controlsRef.current) {
          controlsRef.current.removeEventListener('start', handleStart);
          controlsRef.current.removeEventListener('end', handleEnd);
        }
      };
    }
  }, [initialControlsInstance, camera, focus]);

  const actualFloating = isFloatingActiveOriginal && !focus && !isUserOrbiting;

  // --- useFrame ---
  // Includes: Smart Camera, Audio, Boost, Turbulence, LERPing, Final Book Transform, Breathing
  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    // Smart Camera Work (incorporating activeTextPosition)
    if (controlsRef.current && !focus && !isUserOrbiting) {
      let desiredTarget = INITIAL_TARGET_POSITION.clone();
      let targetLerpSpeed = 0.08;

      if (activeTextPosition && textProximity > 0.05) {
        const bookWorldPos = new THREE.Vector3();
        bookGroupRef.current?.getWorldPosition(bookWorldPos);

        const midPointInfluence = 0.35;
        const textPullStrength = textProximity * textProximity;
        const targetX = bookWorldPos.x + (activeTextPosition.x - bookWorldPos.x) * midPointInfluence * textPullStrength;
        const targetY = bookWorldPos.y + (activeTextPosition.y - bookWorldPos.y) * midPointInfluence * textPullStrength * 0.5;
        const targetZ = INITIAL_TARGET_POSITION.z; // Keep Z stable or related to bookWorldPos.z
        
        desiredTarget.set(targetX, targetY, targetZ);
        targetLerpSpeed = 0.04;
      }
      
      if (!controlsRef.current.target.equals(desiredTarget)) {
        controlsRef.current.target.lerp(desiredTarget, targetLerpSpeed);
      } else if (!activeTextPosition && !controlsRef.current.target.equals(INITIAL_TARGET_POSITION)) {
        // If no active text, smoothly return camera target to default
        controlsRef.current.target.lerp(INITIAL_TARGET_POSITION, 0.08);
      }
    }

    if (controlsRef.current && controlsRef.current.enableDamping) {
      controlsRef.current.update();
    }

    // Audio analysis (from your original)
    if (isMusicPlayingValue && analyser) {
      if (!dataArray.current) dataArray.current = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray.current);
      const freqs = dataArray.current;
      const bassRange = Math.floor(freqs.length * 0.18);
      let currentBassSum = 0;
      for (let i = 0; i < bassRange; i++) currentBassSum += freqs[i];
      smoothedBass.current = THREE.MathUtils.lerp(smoothedBass.current, (currentBassSum / bassRange / 255), 0.15);
    } else {
      smoothedBass.current = THREE.MathUtils.lerp(smoothedBass.current, 0, 0.12);
    }
    let targetMusicPosY = 0, targetMusicPosZ = 0, targetMusicRotY = 0;
    if (isMusicPlayingValue) {
      targetMusicPosZ = smoothedBass.current * 0.25;
      targetMusicRotY = Math.sin(time * 1.2) * smoothedBass.current * 0.08;
      targetMusicPosY = Math.cos(time * 1.4 + 0.8) * smoothedBass.current * 0.06;
    }
    bookMusicPosition.current.y = THREE.MathUtils.lerp(bookMusicPosition.current.y, targetMusicPosY, 0.12);
    bookMusicPosition.current.z = THREE.MathUtils.lerp(bookMusicPosition.current.z, targetMusicPosZ, 0.12);
    bookMusicRotationY.current = THREE.MathUtils.lerp(bookMusicRotationY.current, targetMusicRotY, 0.12);

    // Boost system (from your original)
    let currentBoostFactor = 0, targetBookBoostZOffset = 0, targetBookFloatSpeedMult = 1, targetBookFloatIntensityMult = 1;
    if (isBoosting) {
      const timeSinceBoost = Date.now() - boostActivationTime;
      if (timeSinceBoost < BOOST_DURATION) {
        const progress = timeSinceBoost / BOOST_DURATION;
        const fastStart = Math.exp(-progress * 4);
        const slowDecay = Math.pow(1 - progress, 2);
        currentBoostFactor = (fastStart * 0.7 + slowDecay * 0.3);
        targetBookBoostZOffset = BOOST_Z_DISPLACEMENT_AWAY * currentBoostFactor;
        targetBookFloatSpeedMult = 1 + (BOOK_BOOST_FLOAT_SPEED_MULT - 1) * currentBoostFactor;
        targetBookFloatIntensityMult = 1 + (BOOK_BOOST_FLOAT_INTENSITY_MULT - 1) * currentBoostFactor;
        currentCameraShakeIntensity.current = Math.max(currentCameraShakeIntensity.current, 0.5 * currentBoostFactor);
      } else {
        setIsBoosting(false);
      }
    }
    bookBoostZOffset.current = THREE.MathUtils.lerp(bookBoostZOffset.current, targetBookBoostZOffset, 0.22);
    bookFloatSpeedMultiplier.current = THREE.MathUtils.lerp(bookFloatSpeedMultiplier.current, targetBookFloatSpeedMult, 0.25);
    bookFloatIntensityMultiplier.current = THREE.MathUtils.lerp(bookFloatIntensityMultiplier.current, targetBookFloatIntensityMult, 0.25);
    
    // Camera shake system (using currentCameraShakeIntensity.current)
    if (currentCameraShakeIntensity.current > 0.001) {
      const shakeMagnitude = CAMERA_SHAKE_INTENSITY * currentCameraShakeIntensity.current; // Use constant as multiplier
      const shakeX = (Math.random() - 0.5) * shakeMagnitude;
      const shakeY = (Math.random() - 0.5) * shakeMagnitude;
      const shakeZ = (Math.random() - 0.5) * shakeMagnitude * 0.5;
      cameraShakeOffset.current.set(shakeX, shakeY, shakeZ);
      camera.position.add(cameraShakeOffset.current);
      currentCameraShakeIntensity.current *= CAMERA_SHAKE_DECAY; // Decay the trigger value
      setTimeout(() => { camera.position.sub(cameraShakeOffset.current); }, 0);
    }

    // Turbulence (from your original)
    const timeX = time * Math.PI * 2;
    const posXAmp = TURB_POS_BASE_AMP_X * (1 + currentBoostFactor * 8);
    const posYAmp = TURB_POS_BASE_AMP_Y * (1 + currentBoostFactor * 8);
    const posZAmp = TURB_POS_BASE_AMP_Z * (1 + currentBoostFactor * 8);
    const rotXAmp = TURB_ROT_BASE_AMP_X * (1 + currentBoostFactor * 7);
    const rotYAmp = TURB_ROT_BASE_AMP_Y * (1 + currentBoostFactor * 7);
    const rotZAmp = TURB_ROT_BASE_AMP_Z * (1 + currentBoostFactor * 7);
    const targetTurbulencePos = new THREE.Vector3( /* ... turbulence math ... */ ); // Ellipsized for brevity
    targetTurbulencePos.set(
        Math.sin(timeX * TURB_POS_FREQ_X + Math.cos(timeX * 0.3)) * posXAmp,
        Math.cos(timeX * TURB_POS_FREQ_Y + 1.5 + Math.sin(timeX * 0.4)) * posYAmp,
        Math.sin(timeX * TURB_POS_FREQ_Z + 2.5 + Math.cos(timeX * 0.2)) * posZAmp
    );
    const targetTurbulenceRot = new THREE.Euler( /* ... turbulence math ... */ 'YXZ' ); // Ellipsized
     targetTurbulenceRot.set(
        Math.cos(timeX * TURB_ROT_FREQ_X + 3.5 + Math.sin(timeX * 0.15)) * rotXAmp,
        Math.sin(timeX * TURB_ROT_FREQ_Y + 4.5 + Math.cos(timeX * 0.25)) * rotYAmp,
        Math.cos(timeX * TURB_ROT_FREQ_Z + 5.5 + Math.sin(timeX * 0.35)) * rotZAmp, 
        'YXZ'
    );
    bookTurbulencePosition.current.lerp(targetTurbulencePos, TURBULENCE_LERP_FACTOR);
    bookTurbulenceRotation.current.x = THREE.MathUtils.lerp(bookTurbulenceRotation.current.x, targetTurbulenceRot.x, TURBULENCE_LERP_FACTOR);
    bookTurbulenceRotation.current.y = THREE.MathUtils.lerp(bookTurbulenceRotation.current.y, targetTurbulenceRot.y, TURBULENCE_LERP_FACTOR);
    bookTurbulenceRotation.current.z = THREE.MathUtils.lerp(bookTurbulenceRotation.current.z, targetTurbulenceRot.z, TURBULENCE_LERP_FACTOR);

    // LERPing currentBook values towards targetBook values (using your original advanced lerp logic for roll)
    const generalReactionLerp = BOOK_REACTION_LERP_SPEED;
    const shiftLerpConfig = { approaching: generalReactionLerp * 1.2, passing: generalReactionLerp * 1.4, exiting: generalReactionLerp * 0.8, default: generalReactionLerp };
    const currentShiftLerp = shiftLerpConfig[textPassingPhase] || shiftLerpConfig.default;
    let currentRollPitchLerp; // This is your original complex roll lerp speed calculation
    if (textPassingPhase === 'passing') { /* ... your original roll lerp logic ... */ 
        const isApproachingPeak = textProximity > prevTextProximityRef.current && textProximity < 0.98;
        const isInSustainedPeak = textProximity >= PEAK_BANKING_THRESHOLD && textProximity <= SUSTAINED_PEAK_END;
        const isAtOrPastPeak = textProximity >= PEAK_BANKING_THRESHOLD || (textProximity < prevTextProximityRef.current && textProximity > 0.2);
        if (isInSustainedPeak) currentRollPitchLerp = AILERON_ROLL_PEAK_SLO_MO_LERP_SPEED * 0.5;
        else if (isAtOrPastPeak) currentRollPitchLerp = AILERON_ROLL_PEAK_SLO_MO_LERP_SPEED;
        else if (isApproachingPeak) currentRollPitchLerp = AILERON_ROLL_INITIAL_LERP_SPEED;
        else currentRollPitchLerp = AILERON_ROLL_INITIAL_LERP_SPEED * 0.5;
    } else if (textPassingPhase === 'approaching' && textProximity > BANKING_START_THRESHOLD) { /* ... */ 
        const bankingProgress = (textProximity - BANKING_START_THRESHOLD) / (PEAK_BANKING_THRESHOLD - BANKING_START_THRESHOLD);
        currentRollPitchLerp = AILERON_ROLL_INITIAL_LERP_SPEED * (0.6 + 0.4 * Math.pow(bankingProgress, 0.3));
    } else if (textPassingPhase === 'exiting' && textProximity > RECOVERY_START_THRESHOLD) { /* ... */ 
        const holdIntensity = textProximity > FINAL_GLIDE_THRESHOLD ? 0.3 : 1.0;
        currentRollPitchLerp = AILERON_ROLL_PEAK_SLO_MO_LERP_SPEED * 2 * holdIntensity;
    } else if (textPassingPhase === 'exiting') { /* ... */ 
        currentRollPitchLerp = AILERON_ROLL_RECOVERY_SPEED * 0.8;
    } else { currentRollPitchLerp = AILERON_ROLL_RECOVERY_SPEED; }
    prevTextProximityRef.current = textProximity;

    const currentWingFlapLerp = WING_FLAP_LERP_SPEED;
    const dampingFactor = currentPage <= 2 ? INITIAL_OPEN_DAMPING : 1.0;

    currentBookShiftX.current = THREE.MathUtils.lerp(currentBookShiftX.current, targetBookShiftX.current, currentShiftLerp * dampingFactor);
    currentBookShiftY.current = THREE.MathUtils.lerp(currentBookShiftY.current, targetBookShiftY.current, currentShiftLerp * dampingFactor);
    currentBookShiftZ.current = THREE.MathUtils.lerp(currentBookShiftZ.current, targetBookShiftZ.current, currentShiftLerp * dampingFactor);
    currentBookYaw.current = THREE.MathUtils.lerp(currentBookYaw.current, targetBookYaw.current, generalReactionLerp * dampingFactor);
    currentBookPitch.current = THREE.MathUtils.lerp(currentBookPitch.current, targetBookPitch.current, generalReactionLerp * dampingFactor);
    currentBookAileronRoll.current = THREE.MathUtils.lerp(currentBookAileronRoll.current, targetBookAileronRoll.current, currentRollPitchLerp * dampingFactor);
    currentBookDramaticPitch.current = THREE.MathUtils.lerp(currentBookDramaticPitch.current, targetBookDramaticPitch.current, currentRollPitchLerp * dampingFactor); // Lerp dramatic pitch as well
    currentBookWingFlap.current = THREE.MathUtils.lerp(currentBookWingFlap.current, targetBookWingFlap.current, currentWingFlapLerp * dampingFactor);
    setBookWingFlapIntensity(currentBookWingFlap.current);

    // Apply final transformation to book (including dramatic pitch)
    if (bookGroupRef.current) {
      bookGroupRef.current.position.set(
        bookTurbulencePosition.current.x + currentBookShiftX.current,
        bookMusicPosition.current.y + bookTurbulencePosition.current.y + currentBookShiftY.current,
        bookMusicPosition.current.z + bookBoostZOffset.current + bookTurbulencePosition.current.z + currentBookShiftZ.current
      );
      bookGroupRef.current.rotation.set(
        bookTurbulenceRotation.current.x + currentBookPitch.current + currentBookDramaticPitch.current, // Added dramatic pitch
        bookMusicRotationY.current + bookTurbulenceRotation.current.y + currentBookYaw.current,
        bookTurbulenceRotation.current.z + currentBookAileronRoll.current
      );
      // Breathing Effect
      const breathEffectStrength = textProximity > 0.05 ? (1 + textProximity * BREATH_AMPLITUDE_TEXT_PROXIMITY_MULTIPLIER) : 1;
      const scaleBreath = 1 + Math.sin(time * Math.PI * 2 * BREATH_FREQUENCY) * BREATH_AMPLITUDE_BASE * breathEffectStrength;
      bookGroupRef.current.scale.set(scaleBreath, scaleBreath, scaleBreath);
    }
  });

  // ... (useEffect for camera focus - NO CHANGES from your original file) ...
   useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !camera) return;
    if (focus) {
      if (!previousCameraState.current) { previousCameraState.current = { position: camera.position.clone(), target: controls.target.clone() }; }
      controls.enabled = false;
      gsap.to(controls.target, { ...focus.target, duration: 1.2, ease: "power2.inOut", onUpdate: () => controls.update() });
      gsap.to(camera.position, { ...focus.position, duration: 1.2, ease: "power2.inOut", onUpdate: () => camera.lookAt(controls.target), onComplete: () => { controls.enabled = true; controls.update(); } });
    } else if (previousCameraState.current) {
      controls.enabled = false;
      gsap.to(controls.target, { ...previousCameraState.current.target, duration: 1.2, ease: "power2.inOut", onUpdate: () => controls.update() });
      gsap.to(camera.position, { ...previousCameraState.current.position, duration: 1.2, ease: "power2.inOut", onUpdate: () => camera.lookAt(controls.target), onComplete: () => { previousCameraState.current = null; controls.enabled = true; controls.update(); } });
    }
  }, [focus, camera]);

  // ... (useEffect for camera reset - NO CHANGES from your original file) ...
  useEffect(() => {
    if (triggerReset > 0) {
      const controls = controlsRef.current;
      if (!controls || !camera) return;
      setFocusAtom(null);
      if (previousCameraState.current) previousCameraState.current = null;
      controls.enabled = false;
      const fromTarget = controls.target.clone(); // Clone before starting tween
      gsap.to(fromTarget, { // Tween the clone
        ...INITIAL_TARGET_POSITION, duration: 1.8, ease: "power3.inOut", 
        onUpdate: () => { controls.target.copy(fromTarget); controls.update(); }
      });
      const fromPosition = camera.position.clone(); // Clone before starting tween
      gsap.to(fromPosition, { // Tween the clone
        ...INITIAL_CAMERA_POSITION, duration: 1.8, ease: "power3.inOut", 
        onUpdate: () => { camera.position.copy(fromPosition); camera.lookAt(controls.target); }, 
        onComplete: () => { 
          controls.target.copy(INITIAL_TARGET_POSITION); // Final snap
          camera.position.copy(INITIAL_CAMERA_POSITION); // Final snap
          camera.lookAt(controls.target);
          controls.enabled = true; controls.update(); setTriggerResetAtom(0); 
        } 
      });
    }
  }, [triggerReset, camera, setFocusAtom, setTriggerResetAtom]);


  const isBookOpenForLines = currentPage > 0 && currentPage < appPages.length - 1;
  let finalSpeed = (actualFloating ? BASE_FLOAT_SPEED : 0.002) * bookFloatSpeedMultiplier.current;
  let finalFloatIntensity = (actualFloating ? BASE_FLOAT_INTENSITY : 0.002) * bookFloatIntensityMultiplier.current;
  let finalRotationIntensity = (actualFloating ? BASE_FLOAT_INTENSITY * 0.6 : 0.002) * bookFloatIntensityMultiplier.current;

  return (
    <>
      <AnimatedBackground />
      <DistantNebula />
      <AudioVisualizer />

      <group ref={bookGroupRef}>
        <Float
          rotation-x={-Math.PI / 4.8}
          floatIntensity={finalFloatIntensity}
          speed={finalSpeed}
          rotationIntensity={finalRotationIntensity}
        >
          <Book isBookOpen={isBookOpenForLines} isBookFocused={!!focus} />
        </Float>
      </group>

      <FloatingSpaceText bookRef={bookGroupRef} /> {/* Needs activeTextWorldPositionAtom */}

      <OrbitControls
        ref={controls => { if (controls) controlsRef.current = controls; }}
        target={INITIAL_TARGET_POSITION} /* ... other props ... */
        enablePan={true} minDistance={0.8} maxDistance={12}
        maxPolarAngle={Math.PI / 1.6} minPolarAngle={Math.PI / 12}
        enableDamping={true} dampingFactor={0.08}
        zoomSpeed={0.6} rotateSpeed={0.4} panSpeed={0.6}
        screenSpacePanning={false}
      />
      <Environment preset="sunset" />
        {/* ... lights ... */}
      <directionalLight position={[3, 6, 4]} intensity={1.8} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0001} color="#ffeaa0"/>
      <ambientLight intensity={0.6} color="#4a5568" />
      <directionalLight position={[-3, 4, 3]} intensity={0.9} color="#a0c4ff"/>
      <pointLight position={[0, 3, -6]} intensity={1.2} color="#ff8c42" distance={25} decay={2}/>
      <spotLight position={[5, 8, 2]} intensity={0.8} angle={Math.PI / 6} penumbra={0.5} color="#ffffff" castShadow/>
    </>
  );
};