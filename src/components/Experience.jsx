// src/components/Experience.jsx
import { Environment, Float, OrbitControls } from "@react-three/drei";
import { useAtom, useSetAtom } from "jotai";
import { Book } from "./Book";
import { bookFloatingAtom, pageAtom } from "./UI";
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
import { pages as appPages } from "./UI";
import { AnimatedBackground } from "./AnimatedBackground";

const INITIAL_CAMERA_POSITION = new THREE.Vector3(0, 0.5, 2.8);
const INITIAL_TARGET_POSITION = new THREE.Vector3(0, 0.05, 0);

// Boost constants
const BOOST_DURATION = 2000; // milliseconds (2 seconds)
// The book's origin is roughly at Z=0. The camera is at Z=2.8.
// Negative Z for the book means moving further away from the camera, deeper into the scene.
const BOOST_Z_DISPLACEMENT_AWAY = -0.45; // How much further the book moves away from camera during boost. Adjusted for more noticeable effect.
const BASE_FLOAT_SPEED = 0.5;
const BASE_FLOAT_INTENSITY = 0.05;

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
  
  const bookGroupRef = useRef();
  const dataArray = useRef(null);

  const bookZPositionMusic = useRef(0);
  const bookRotationMusic = useRef(0);
  const bookYPositionMusic = useRef(0);
  const boostZOffset = useRef(0);

  // ... (useEffect for OrbitControls setup - unchanged)
    useEffect(() => {
    if (initialControlsInstance) {
      controlsRef.current = initialControlsInstance;
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
    // Part 1: Calculate music-driven targets (Unchanged)
    let targetMusicZ = 0;
    let targetMusicRotationY = 0;
    let targetMusicPositionY = 0;
    let currentBassIntensity = 0;

    if (isMusicPlayingValue && analyser && bookGroupRef.current) {
        if (!dataArray.current) {
            dataArray.current = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(dataArray.current);

        let bassSum = 0;
        const bassRange = Math.floor(dataArray.current.length * 0.1);
        for (let i = 0; i < bassRange; i++) { bassSum += dataArray.current[i]; }
        currentBassIntensity = bassSum / bassRange / 255;

        let sum = 0;
        for (let i = 0; i < dataArray.current.length; i++) { sum += dataArray.current[i]; }
        const musicIntensity = sum / dataArray.current.length / 255;

        // Music makes the book move slightly towards camera (positive Z offset)
        targetMusicZ = currentBassIntensity * 0.3; 
        targetMusicRotationY = Math.sin(state.clock.elapsedTime * 2) * musicIntensity * 0.05;
        targetMusicPositionY = Math.sin(state.clock.elapsedTime * 3) * currentBassIntensity * 0.02;
    }

    bookZPositionMusic.current = THREE.MathUtils.lerp(bookZPositionMusic.current, targetMusicZ, 0.1);
    bookRotationMusic.current = THREE.MathUtils.lerp(bookRotationMusic.current, targetMusicRotationY, 0.1);
    bookYPositionMusic.current = THREE.MathUtils.lerp(bookYPositionMusic.current, targetMusicPositionY, 0.1);

    // Part 2: Calculate boost-driven Z offset
    let currentBoostZTarget = 0; // Default to 0 offset (no boost effect)
    if (isBoosting) {
        const timeSinceBoost = Date.now() - boostActivationTime;
        if (timeSinceBoost < BOOST_DURATION) {
            const progress = timeSinceBoost / BOOST_DURATION; // 0 to 1
            
            // Move progressively away from the camera (negative Z)
            // Using an easeOutCubic function for a smooth acceleration towards the max displacement.
            // easeOutCubic(t) = 1 - pow(1 - t, 3)
            const easeOutCubicProgress = 1 - Math.pow(1 - progress, 3);
            currentBoostZTarget = BOOST_Z_DISPLACEMENT_AWAY * easeOutCubicProgress;
            
        } else {
            setIsBoosting(false); // End boost automatically
            // currentBoostZTarget will be 0 in the next frame's lerp as isBoosting will be false
        }
    }
    
    // Lerp boost offset. When isBoosting becomes false, currentBoostZTarget becomes 0 (implicitly in the logic above for the next frame),
    // so boostZOffset.current will smoothly lerp back to 0, returning the book to its music-driven Z position.
    boostZOffset.current = THREE.MathUtils.lerp(boostZOffset.current, currentBoostZTarget, 0.15);

    // Part 3: Apply combined transformations to bookGroupRef
    if (bookGroupRef.current) {
        // The book's final Z position is its music-driven base + the temporary boost offset.
        bookGroupRef.current.position.z = bookZPositionMusic.current + boostZOffset.current;
        bookGroupRef.current.rotation.y = bookRotationMusic.current;
        bookGroupRef.current.position.y = bookYPositionMusic.current;
    }
  });
  
  // ... (useEffect for camera focus transitions - unchanged)
  useEffect(() => {
    const controls = controlsRef.current; if (!controls || !camera) return;
    if (focus) {
      if (!previousCameraState.current) { previousCameraState.current = { position: camera.position.clone(), target: controls.target.clone() }; }
      controls.enabled = false;
      gsap.to(controls.target, { x:focus.target.x, y:focus.target.y, z:focus.target.z, duration: 0.8, ease: "power2.inOut", onUpdate: () => controls.update() });
      gsap.to(camera.position, { x:focus.position.x, y:focus.position.y, z:focus.position.z, duration: 0.8, ease: "power2.inOut", onUpdate: () => camera.lookAt(controls.target), onComplete: () => { controls.enabled = true; controls.update(); } });
    } else if (previousCameraState.current) {
      controls.enabled = false;
      gsap.to(controls.target, { x:previousCameraState.current.target.x, y:previousCameraState.current.target.y, z:previousCameraState.current.target.z, duration: 0.8, ease: "power2.inOut", onUpdate: () => controls.update() });
      gsap.to(camera.position, { x:previousCameraState.current.position.x, y:previousCameraState.current.position.y, z:previousCameraState.current.position.z, duration: 0.8, ease: "power2.inOut", onUpdate: () => camera.lookAt(controls.target), onComplete: () => { previousCameraState.current = null; controls.enabled = true; controls.update(); } });
    }
  }, [focus, camera]);

  // ... (useEffect for camera reset - unchanged)
  useEffect(() => {
    if (triggerReset > 0) {
      const controls = controlsRef.current; if (!controls || !camera) return;
      setCameraFocus(null);
      const fromPosition = previousCameraState.current ? previousCameraState.current.position : camera.position.clone();
      const fromTarget = previousCameraState.current ? previousCameraState.current.target : controls.target.clone();
      if (previousCameraState.current) previousCameraState.current = null;
      controls.enabled = false;
      gsap.to(fromTarget, { x:INITIAL_TARGET_POSITION.x, y:INITIAL_TARGET_POSITION.y, z:INITIAL_TARGET_POSITION.z, duration: 1, ease: "power2.inOut", onUpdate: () => { controls.target.copy(fromTarget); controls.update(); } });
      gsap.to(fromPosition, { x:INITIAL_CAMERA_POSITION.x, y:INITIAL_CAMERA_POSITION.y, z:INITIAL_CAMERA_POSITION.z, duration: 1, ease: "power2.inOut", onUpdate: () => { camera.position.copy(fromPosition); camera.lookAt(controls.target); }, onComplete: () => { controls.target.copy(INITIAL_TARGET_POSITION); camera.position.copy(INITIAL_CAMERA_POSITION); camera.lookAt(controls.target); controls.enabled = true; controls.update(); } });
    }
  }, [triggerReset, camera, setCameraFocus]);


  const isBookOpenForLines = currentPage > 0 && currentPage < appPages.length;

  let finalSpeed = actualFloating ? BASE_FLOAT_SPEED : 0;
  let finalFloatIntensity = actualFloating ? BASE_FLOAT_INTENSITY : 0;
  let finalRotationIntensity = actualFloating ? BASE_FLOAT_INTENSITY : 0;

  if (isBoosting) {
      finalSpeed = Math.max(finalSpeed, BASE_FLOAT_SPEED * 0.3) * 5;
      finalFloatIntensity = Math.max(finalFloatIntensity, BASE_FLOAT_INTENSITY * 0.3) * 3;
      finalRotationIntensity = Math.max(finalRotationIntensity, BASE_FLOAT_INTENSITY * 0.3) * 3;
  }

  return (
    <>
      <AnimatedBackground />
      <AudioVisualizer />
      <group ref={bookGroupRef}>
        <Float 
          rotation-x={-Math.PI / 4.5} 
          floatIntensity={finalFloatIntensity} 
          speed={finalSpeed} 
          rotationIntensity={finalRotationIntensity}
        >
          <Book isBookOpen={isBookOpenForLines} isBookFocused={!!focus} />
        </Float>
      </group>
      <OrbitControls ref={controls => { if (controls) controlsRef.current = controls; }} enablePan={true} minDistance={0.3} maxDistance={8} />
      <Environment preset="sunset" />
      <directionalLight position={[2, 4, 2]} intensity={1.0} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0001}/>
      <ambientLight intensity={0.4} />
      <mesh position-y={-1.5} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <shadowMaterial transparent opacity={0.1} />
      </mesh>
    </>
  );
};