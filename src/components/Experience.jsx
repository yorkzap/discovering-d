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
import { DistantNebula } from "./DistantNebula";

const INITIAL_CAMERA_POSITION = new THREE.Vector3(0, 0.5, 2.8);
const INITIAL_TARGET_POSITION = new THREE.Vector3(0, 0.05, 0);

// Enhanced boost constants for Need for Speed feel
const BOOST_DURATION = 2000; // milliseconds (2 seconds)
const BOOST_Z_DISPLACEMENT_AWAY = -2; // Increased for more dramatic effect
const BASE_FLOAT_SPEED = 0.5;
const BASE_FLOAT_INTENSITY = 0.05;

// New boost physics constants
const BOOST_MAX_SPEED_MULTIPLIER = 12; // Higher peak speed
const BOOST_MAX_INTENSITY_MULTIPLIER = 6; // More dramatic floating

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

  // Enhanced boost animation refs
  const currentBoostIntensity = useRef(0);
  const boostSpeedMultiplier = useRef(1);
  const boostIntensityMultiplier = useRef(1);

  useEffect(() => {
    if (initialControlsInstance) {
      controlsRef.current = initialControlsInstance;
      
      // Enhanced OrbitControls settings for smoother experience
      controlsRef.current.enableDamping = true;
      controlsRef.current.dampingFactor = 0.05;
      controlsRef.current.screenSpacePanning = false;
      controlsRef.current.minDistance = 0.5;
      controlsRef.current.maxDistance = 10;
      controlsRef.current.maxPolarAngle = Math.PI / 1.8; // Prevent going too low
      controlsRef.current.minPolarAngle = Math.PI / 8; // Prevent going too high
      
      // Smoother zoom
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
    // Update OrbitControls damping
    if (controlsRef.current && controlsRef.current.enableDamping) {
      controlsRef.current.update();
    }

    // Part 1: Calculate music-driven targets (Enhanced)
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

        // Enhanced music effects
        targetMusicZ = currentBassIntensity * 0.3; 
        targetMusicRotationY = Math.sin(state.clock.elapsedTime * 2) * musicIntensity * 0.05;
        targetMusicPositionY = Math.sin(state.clock.elapsedTime * 3) * currentBassIntensity * 0.02;
    }

    bookZPositionMusic.current = THREE.MathUtils.lerp(bookZPositionMusic.current, targetMusicZ, 0.1);
    bookRotationMusic.current = THREE.MathUtils.lerp(bookRotationMusic.current, targetMusicRotationY, 0.1);
    bookYPositionMusic.current = THREE.MathUtils.lerp(bookYPositionMusic.current, targetMusicPositionY, 0.1);

    // Part 2: Enhanced boost calculations with Need for Speed physics
    let currentBoostZTarget = 0;
    let targetBoostSpeedMultiplier = 1;
    let targetBoostIntensityMultiplier = 1;
    
    if (isBoosting) {
        const timeSinceBoost = Date.now() - boostActivationTime;
        if (timeSinceBoost < BOOST_DURATION) {
            const progress = timeSinceBoost / BOOST_DURATION; // 0 to 1
            
            // Super fast initial acceleration that gradually slows (Need for Speed curve)
            const fastStart = Math.exp(-progress * 5); // Very fast initial burst
            const slowDecay = Math.pow(1 - progress, 1.5); // Gradual slowdown
            
            // Combine for realistic boost feel
            const boostCurve = (fastStart * 0.8 + slowDecay * 0.2);
            
            // Apply boost effects
            currentBoostZTarget = BOOST_Z_DISPLACEMENT_AWAY * boostCurve;
            targetBoostSpeedMultiplier = 1 + (BOOST_MAX_SPEED_MULTIPLIER - 1) * boostCurve;
            targetBoostIntensityMultiplier = 1 + (BOOST_MAX_INTENSITY_MULTIPLIER - 1) * boostCurve;
            
            currentBoostIntensity.current = boostCurve;
        } else {
            setIsBoosting(false); // End boost automatically
            currentBoostIntensity.current = 0;
        }
    }
    
    // Smooth boost transitions for aesthetic appeal
    boostZOffset.current = THREE.MathUtils.lerp(boostZOffset.current, currentBoostZTarget, 0.15);
    boostSpeedMultiplier.current = THREE.MathUtils.lerp(boostSpeedMultiplier.current, targetBoostSpeedMultiplier, 0.2);
    boostIntensityMultiplier.current = THREE.MathUtils.lerp(boostIntensityMultiplier.current, targetBoostIntensityMultiplier, 0.2);

    // Part 3: Apply combined transformations to bookGroupRef
    if (bookGroupRef.current) {
        // Enhanced Z position with smoother transitions
        bookGroupRef.current.position.z = bookZPositionMusic.current + boostZOffset.current;
        
        // Enhanced rotation with boost effects
        const boostRotationExtra = Math.sin(state.clock.elapsedTime * 8) * currentBoostIntensity.current * 0.03;
        bookGroupRef.current.rotation.y = bookRotationMusic.current + boostRotationExtra;
        
        // Enhanced Y position with boost effects
        const boostYExtra = Math.sin(state.clock.elapsedTime * 6) * currentBoostIntensity.current * 0.08;
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
      
      // Smoother focus animations with better easing
      gsap.to(controls.target, { 
        x: focus.target.x, 
        y: focus.target.y, 
        z: focus.target.z, 
        duration: 1.2, 
        ease: "power2.inOut", 
        onUpdate: () => controls.update() 
      });
      
      gsap.to(camera.position, { 
        x: focus.position.x, 
        y: focus.position.y, 
        z: focus.position.z, 
        duration: 1.2, 
        ease: "power2.inOut", 
        onUpdate: () => camera.lookAt(controls.target), 
        onComplete: () => { 
          controls.enabled = true; 
          controls.update(); 
        } 
      });
    } else if (previousCameraState.current) {
      controls.enabled = false;
      
      // Smoother return animations
      gsap.to(controls.target, { 
        x: previousCameraState.current.target.x, 
        y: previousCameraState.current.target.y, 
        z: previousCameraState.current.target.z, 
        duration: 1.2, 
        ease: "power2.inOut", 
        onUpdate: () => controls.update() 
      });
      
      gsap.to(camera.position, { 
        x: previousCameraState.current.position.x, 
        y: previousCameraState.current.position.y, 
        z: previousCameraState.current.position.z, 
        duration: 1.2, 
        ease: "power2.inOut", 
        onUpdate: () => camera.lookAt(controls.target), 
        onComplete: () => { 
          previousCameraState.current = null; 
          controls.enabled = true; 
          controls.update(); 
        } 
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
      
      // Much smoother reset animation with better easing and timing
      gsap.to(fromTarget, { 
        x: INITIAL_TARGET_POSITION.x, 
        y: INITIAL_TARGET_POSITION.y, 
        z: INITIAL_TARGET_POSITION.z, 
        duration: 1.8, 
        ease: "power3.inOut", 
        onUpdate: () => { 
          controls.target.copy(fromTarget); 
          controls.update(); 
        } 
      });
      
      gsap.to(fromPosition, { 
        x: INITIAL_CAMERA_POSITION.x, 
        y: INITIAL_CAMERA_POSITION.y, 
        z: INITIAL_CAMERA_POSITION.z, 
        duration: 1.8, 
        ease: "power3.inOut", 
        onUpdate: () => { 
          camera.position.copy(fromPosition); 
          camera.lookAt(controls.target); 
        }, 
        onComplete: () => { 
          controls.target.copy(INITIAL_TARGET_POSITION); 
          camera.position.copy(INITIAL_CAMERA_POSITION); 
          camera.lookAt(controls.target); 
          controls.enabled = true; 
          controls.update(); 
        } 
      });
    }
  }, [triggerReset, camera, setCameraFocus]);

  const isBookOpenForLines = currentPage > 0 && currentPage < appPages.length;

  // Enhanced floating parameters with boost
  let finalSpeed = actualFloating ? BASE_FLOAT_SPEED : 0;
  let finalFloatIntensity = actualFloating ? BASE_FLOAT_INTENSITY : 0;
  let finalRotationIntensity = actualFloating ? BASE_FLOAT_INTENSITY : 0;

  // Apply boost multipliers for smooth enhancement
  finalSpeed = Math.max(finalSpeed, BASE_FLOAT_SPEED * 0.3) * boostSpeedMultiplier.current;
  finalFloatIntensity = Math.max(finalFloatIntensity, BASE_FLOAT_INTENSITY * 0.3) * boostIntensityMultiplier.current;
  finalRotationIntensity = Math.max(finalRotationIntensity, BASE_FLOAT_INTENSITY * 0.3) * boostIntensityMultiplier.current;

  return (
    <>
      <AnimatedBackground />
      <DistantNebula />
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
      <OrbitControls 
        ref={controls => { if (controls) controlsRef.current = controls; }} 
        enablePan={true} 
        minDistance={0.5} 
        maxDistance={10}
        maxPolarAngle={Math.PI / 1.8}
        minPolarAngle={Math.PI / 8}
        enableDamping={true}
        dampingFactor={0.05}
        zoomSpeed={0.8}
        rotateSpeed={0.6}
        panSpeed={0.8}
        screenSpacePanning={false}
      />
      <Environment preset="sunset" />
      
      {/* Enhanced lighting for better book visibility */}
      <directionalLight 
        position={[2, 4, 2]} 
        intensity={1.2} 
        castShadow 
        shadow-mapSize={[2048, 2048]} 
        shadow-bias={-0.0001}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      
      {/* Brighter ambient light for space setting */}
      <ambientLight intensity={0.6} />
      
      {/* Additional fill lighting for the book */}
      <directionalLight 
        position={[-2, 2, 3]} 
        intensity={0.8} 
        color="#ffffff"
      />
      
      {/* Rim lighting for depth - brighter */}
      <directionalLight 
        position={[-2, 2, -2]} 
        intensity={0.4} 
        color="#4a2a66"
      />
      
      {/* Removed shadow plane - we're in space! No ground shadows needed */}
    </>
  );
};