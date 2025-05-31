// src/components/Experience.jsx
import { Environment, Float, OrbitControls } from "@react-three/drei";
import { useAtom, useSetAtom } from "jotai";
import { Book } from "./Book";
import { bookFloatingAtom, pageAtom, pages as appPages } from "./UI"; // `appPages` from UI.jsx
import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import {
  cameraFocusAtom,
  triggerCameraResetAtom,
  audioAnalyserAtom,
  isMusicPlayingAtom,
  isBoostingAtom,
  boostActivationTimeAtom
} from "./atoms";
import { gsap } from "gsap";
import * as THREE from "three";
import { AudioVisualizer } from "./AudioVisualizer";
import { AnimatedBackground } from "./AnimatedBackground";
import { DistantNebula } from "./DistantNebula";
import { NarrativeManager } from "./NarrativeManager"; // <<< Ensure this is imported

const INITIAL_CAMERA_POSITION = new THREE.Vector3(0, 0.5, 2.8);
const INITIAL_TARGET_POSITION = new THREE.Vector3(0, 0.05, 0);
const BOOST_DURATION = 2000; 
const BOOST_Z_DISPLACEMENT_AWAY = -2; 
const BASE_FLOAT_SPEED = 0.5;
const BASE_FLOAT_INTENSITY = 0.05;
const BOOST_MAX_SPEED_MULTIPLIER = 12; 
const BOOST_MAX_INTENSITY_MULTIPLIER = 6; 

export const Experience = () => {
  const [isFloatingActiveOriginal] = useAtom(bookFloatingAtom);
  const [focus] = useAtom(cameraFocusAtom);
  const setCameraFocus = useSetAtom(cameraFocusAtom);
  const [triggerReset] = useAtom(triggerCameraResetAtom);
  const [currentPage] = useAtom(pageAtom);
  const [analyser] = useAtom(audioAnalyserAtom);
  const [isMusicPlayingValue] = useAtom(isMusicPlayingAtom);
  const [isBoosting, setIsBoosting] = useAtom(isBoostingAtom);
  const [boostActivationTime] = useAtom(boostActivationTimeAtom);
  
  const { camera, controls: initialControlsInstance } = useThree();
  const controlsRef = useRef();
  const [isUserOrbiting, setIsUserOrbiting] = useState(false);
  const previousCameraState = useRef(null);
  
  const bookGroupRef = useRef(); // This ref will wrap the <Float> and <Book>
  
  const dataArray = useRef(null);
  const bookZPositionMusic = useRef(0);
  const bookRotationMusic = useRef(0);
  const bookYPositionMusic = useRef(0);
  const boostZOffset = useRef(0);
  const currentBoostIntensityRef = useRef(0); // Renamed to avoid conflict with hook
  const boostSpeedMultiplier = useRef(1);
  const boostIntensityMultiplier = useRef(1);

  useEffect(() => {
    if (initialControlsInstance) {
      controlsRef.current = initialControlsInstance;
      controlsRef.current.enableDamping = true;
      controlsRef.current.dampingFactor = 0.05;
      controlsRef.current.screenSpacePanning = false;
      controlsRef.current.minDistance = 0.5;
      controlsRef.current.maxDistance = 10;
      controlsRef.current.maxPolarAngle = Math.PI / 1.8; 
      controlsRef.current.minPolarAngle = Math.PI / 8; 
      controlsRef.current.zoomSpeed = 0.8;
      controlsRef.current.rotateSpeed = 0.6;
      controlsRef.current.panSpeed = 0.8;
      
      const handleStart = () => setIsUserOrbiting(true);
      const handleEnd = () => setIsUserOrbiting(false);
      controlsRef.current.addEventListener('start', handleStart);
      controlsRef.current.addEventListener('end', handleEnd);
      
      if (!focus && !previousCameraState.current && controlsRef.current.target.equals(new THREE.Vector3(0,0,0))) {
        camera.position.copy(INITIAL_CAMERA_POSITION);
        controlsRef.current.target.copy(INITIAL_TARGET_POSITION);
        controlsRef.current.update();
      }
      return () => {
        if (controlsRef.current) {
          controlsRef.current.removeEventListener('start', handleStart);
          controlsRef.current.removeEventListener('end', handleEnd);
        }
      };
    }
  }, [initialControlsInstance, camera, focus]);

  const actualFloating = isFloatingActiveOriginal && !focus && !isUserOrbiting;

  useFrame((state, delta) => {
    if (controlsRef.current && controlsRef.current.enableDamping) {
      controlsRef.current.update();
    }

    let targetMusicZ = 0;
    let targetMusicRotationY = 0;
    let targetMusicPositionY = 0;

    if (isMusicPlayingValue && analyser && bookGroupRef.current) {
      if (!dataArray.current) {
        dataArray.current = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteFrequencyData(dataArray.current);
      let bassSum = 0;
      const bassRange = Math.floor(dataArray.current.length * 0.1);
      for (let i = 0; i < bassRange; i++) { bassSum += dataArray.current[i]; }
      const currentBassIntensity = bassSum / bassRange / 255;
      let sum = 0;
      for (let i = 0; i < dataArray.current.length; i++) { sum += dataArray.current[i]; }
      const musicIntensity = sum / dataArray.current.length / 255;
      
      targetMusicZ = currentBassIntensity * 0.3; 
      targetMusicRotationY = Math.sin(state.clock.elapsedTime * 2) * musicIntensity * 0.05;
      targetMusicPositionY = Math.sin(state.clock.elapsedTime * 3) * currentBassIntensity * 0.02;
    }
    bookZPositionMusic.current = THREE.MathUtils.lerp(bookZPositionMusic.current, targetMusicZ, 0.1);
    bookRotationMusic.current = THREE.MathUtils.lerp(bookRotationMusic.current, targetMusicRotationY, 0.1);
    bookYPositionMusic.current = THREE.MathUtils.lerp(bookYPositionMusic.current, targetMusicPositionY, 0.1);

    let currentBoostZTarget = 0;
    let targetBoostSpeedMultiplier = 1;
    let targetBoostIntensityMultiplier = 1;
    let newBoostIntensity = 0; // Local variable for this frame

    if (isBoosting) {
      const timeSinceBoost = Date.now() - boostActivationTime;
      if (timeSinceBoost < BOOST_DURATION) {
        const progress = timeSinceBoost / BOOST_DURATION;
        const fastStart = Math.exp(-progress * 5); 
        const slowDecay = Math.pow(1 - progress, 1.5); 
        newBoostIntensity = (fastStart * 0.8 + slowDecay * 0.2);

        currentBoostZTarget = BOOST_Z_DISPLACEMENT_AWAY * newBoostIntensity;
        targetBoostSpeedMultiplier = 1 + (BOOST_MAX_SPEED_MULTIPLIER - 1) * newBoostIntensity;
        targetBoostIntensityMultiplier = 1 + (BOOST_MAX_INTENSITY_MULTIPLIER - 1) * newBoostIntensity;
      } else {
        setIsBoosting(false); 
      }
    }
    currentBoostIntensityRef.current = THREE.MathUtils.lerp(currentBoostIntensityRef.current, newBoostIntensity, 0.15); // Smoothly update the ref


    boostZOffset.current = THREE.MathUtils.lerp(boostZOffset.current, currentBoostZTarget, 0.15);
    boostSpeedMultiplier.current = THREE.MathUtils.lerp(boostSpeedMultiplier.current, targetBoostSpeedMultiplier, 0.2);
    boostIntensityMultiplier.current = THREE.MathUtils.lerp(boostIntensityMultiplier.current, targetBoostIntensityMultiplier, 0.2);

    if (bookGroupRef.current) {
      bookGroupRef.current.position.z = bookZPositionMusic.current + boostZOffset.current;
      const boostRotationExtra = Math.sin(state.clock.elapsedTime * 8) * currentBoostIntensityRef.current * 0.03;
      bookGroupRef.current.rotation.y = bookRotationMusic.current + boostRotationExtra;
      const boostYExtra = Math.sin(state.clock.elapsedTime * 6) * currentBoostIntensityRef.current * 0.08;
      bookGroupRef.current.position.y = bookYPositionMusic.current + boostYExtra;
    }
  });

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !camera) return;
    if (focus) {
      if (!previousCameraState.current) {
        previousCameraState.current = {
          position: camera.position.clone(),
          target: controls.target.clone()
        };
      }
      controls.enabled = false;
      gsap.to(controls.target, {
        x: focus.target.x, y: focus.target.y, z: focus.target.z,
        duration: 1.2, ease: "power2.inOut", onUpdate: () => controls.update()
      });
      gsap.to(camera.position, {
        x: focus.position.x, y: focus.position.y, z: focus.position.z,
        duration: 1.2, ease: "power2.inOut", onUpdate: () => camera.lookAt(controls.target),
        onComplete: () => { controls.enabled = true; controls.update(); }
      });
    } else if (previousCameraState.current) {
      controls.enabled = false;
      gsap.to(controls.target, {
        x: previousCameraState.current.target.x, y: previousCameraState.current.target.y, z: previousCameraState.current.target.z,
        duration: 1.2, ease: "power2.inOut", onUpdate: () => controls.update()
      });
      gsap.to(camera.position, {
        x: previousCameraState.current.position.x, y: previousCameraState.current.position.y, z: previousCameraState.current.position.z,
        duration: 1.2, ease: "power2.inOut", onUpdate: () => camera.lookAt(controls.target),
        onComplete: () => { previousCameraState.current = null; controls.enabled = true; controls.update(); }
      });
    }
  }, [focus, camera]);

  useEffect(() => {
    if (triggerReset > 0) {
      const controls = controlsRef.current;
      if (!controls || !camera) return;
      setCameraFocus(null);
      const fromPosition = previousCameraState.current ? previousCameraState.current.position : camera.position.clone();
      const fromTarget = previousCameraState.current ? previousCameraState.current.target : controls.target.clone();
      if (previousCameraState.current) previousCameraState.current = null;
      controls.enabled = false;
      gsap.to(fromTarget, {
        x: INITIAL_TARGET_POSITION.x, y: INITIAL_TARGET_POSITION.y, z: INITIAL_TARGET_POSITION.z,
        duration: 1.8, ease: "power3.inOut",
        onUpdate: () => { controls.target.copy(fromTarget); controls.update(); }
      });
      gsap.to(fromPosition, {
        x: INITIAL_CAMERA_POSITION.x, y: INITIAL_CAMERA_POSITION.y, z: INITIAL_CAMERA_POSITION.z,
        duration: 1.8, ease: "power3.inOut",
        onUpdate: () => { camera.position.copy(fromPosition); camera.lookAt(controls.target); },
        onComplete: () => {
          controls.target.copy(INITIAL_TARGET_POSITION);
          camera.position.copy(INITIAL_CAMERA_POSITION);
          camera.lookAt(controls.target);
          controls.enabled = true; controls.update();
        }
      });
    }
  }, [triggerReset, camera, setCameraFocus]);

  const isBookOpenForVisuals = currentPage > 0 && currentPage < appPages.length;

  let finalSpeed = actualFloating ? BASE_FLOAT_SPEED : 0;
  let finalFloatIntensity = actualFloating ? BASE_FLOAT_INTENSITY : 0;
  let finalRotationIntensity = actualFloating ? BASE_FLOAT_INTENSITY : 0;
  
  finalSpeed = Math.max(finalSpeed, BASE_FLOAT_SPEED * 0.3) * boostSpeedMultiplier.current;
  finalFloatIntensity = Math.max(finalFloatIntensity, BASE_FLOAT_INTENSITY * 0.3) * boostIntensityMultiplier.current;
  finalRotationIntensity = Math.max(finalRotationIntensity, BASE_FLOAT_INTENSITY * 0.3) * boostIntensityMultiplier.current;
  
  return (
    <>
      <AnimatedBackground />
      <DistantNebula />
      <AudioVisualizer />
      
      <group ref={bookGroupRef}> {/* Group to get world position for NarrativeManager */}
        <Float
          rotationIntensity={finalRotationIntensity} // Applied to the Float component itself
          floatIntensity={finalFloatIntensity}
          speed={finalSpeed}
        >
          {/* The Book's rotation is handled internally and by its Float's props.
              The group rotation.y is for music effects, Float rotation.x is for angle.
              Ensure these don't conflict in undesirable ways.
              The book itself is rotated -PI/2 on Y in its own component.
              The Float here adds the -PI/4.5 on X.
          */}
          <Book 
            isBookOpen={isBookOpenForVisuals} 
            isBookFocused={!!focus} 
            rotation-x={-Math.PI / 4.5} // Apply the tilt here
          />
        </Float>
      </group>

      <NarrativeManager bookGroupRef={bookGroupRef} /> {/* Pass the ref here */}

      <OrbitControls
        ref={controls => { if (controls) controlsRef.current = controls; }}
        enablePan={true}
        minDistance={0.5} maxDistance={10}
        maxPolarAngle={Math.PI / 1.8} minPolarAngle={Math.PI / 8}
        enableDamping={true} dampingFactor={0.05}
        zoomSpeed={0.8} rotateSpeed={0.6} panSpeed={0.8}
        screenSpacePanning={false}
      />
      <Environment preset="sunset" /> 
      
      {/* Lighting Setup for Space Theme with Emissive Text */}
      <ambientLight intensity={0.4} color="#303050" /> {/* Dark blue ambient for space */}
      
      {/* Main directional light (simulating a distant star) */}
      <directionalLight
        position={[3, 5, 5]} // Coming from a general direction
        intensity={1.0}
        color="#E0E8FF" // Cool white
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
      />
      
      {/* Fill light to soften shadows on the book */}
      <directionalLight
        position={[-2, 3, -3]}
        intensity={0.5}
        color="#506080" // Softer, cooler fill
      />

      {/* Optional: A subtle point light near the book for a bit of local illumination if needed */}
      {/* <pointLight position={[0, 0.5, 1]} intensity={0.3} distance={5} color="#FFCCAA" /> */}
    </>
  );
};