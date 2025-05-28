// src/components/Book.jsx
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useAtom, useSetAtom } from "jotai";
import { easing } from "maath";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bone, BoxGeometry, Color, Float32BufferAttribute, MathUtils,
  MeshStandardMaterial, Skeleton, SkinnedMesh, SRGBColorSpace,
  Uint16BufferAttribute, Vector3, Matrix3
} from "three";
import { pageAtom, pages as appPages, bookFloatingAtom } from "./UI";
import { 
  cameraFocusAtom, 
  isMusicPlayingAtom,
  showInitialFlightEffectAtom,
  hasInitialFlightOccurredAtom,
  isBoostingAtom,
  boostActivationTimeAtom,
  audioAnalyserAtom
} from "./atoms";
import { InitialFlightLines } from "./InitialFlightLines";

// Constants
const easingFactor = 0.5;       
const easingFactorFold = 0.3;   

const insideCurveStrength = 0.18;
const outsideCurveStrength = 0.05;
const turningCurveStrength = 0.09;
const PAGE_WIDTH = 1.28;
const PAGE_HEIGHT = 1.71;
const PAGE_DEPTH = 0.003;
const PAGE_SEGMENTS = 30;
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS;

// Enhanced Eagle-like Flight Constants for better aesthetics
const BOOST_FLAP_FREQUENCY = 1.2; // Slightly faster for more dynamic feel
const BOOST_FLAP_MAX_ANGLE_OFFSET = MathUtils.degToRad(80); // More dramatic
const BOOST_FLAP_Y_EASING = 0.18; // Faster response for smoother feel
const BOOST_FLAP_X_EASING = 0.22; // Balanced curl response
const BOOST_DURATION = 2000;

// Geometry and Skinning
const pageGeometry = new BoxGeometry(PAGE_WIDTH, PAGE_HEIGHT, PAGE_DEPTH, PAGE_SEGMENTS, 2);
pageGeometry.translate(PAGE_WIDTH / 2, 0, 0);
const position = pageGeometry.attributes.position;
const vertex = new Vector3();
const skinIndexes = [];
const skinWeights = [];
for (let i = 0; i < position.count; i++) {
  vertex.fromBufferAttribute(position, i);
  const x = vertex.x;
  const skinIndex = Math.max(0, Math.floor(x / SEGMENT_WIDTH));
  let skinWeight = (x % SEGMENT_WIDTH) / SEGMENT_WIDTH;
  skinIndexes.push(skinIndex, skinIndex + 1, 0, 0);
  skinWeights.push(1 - skinWeight, skinWeight, 0, 0);
}
pageGeometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndexes, 4));
pageGeometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));

const whiteColor = new Color("white");
const emissiveColorBase = new Color("black");
const emissiveColorZoomHover = new Color(0x77aaff);
const emissiveColorTurnHover = new Color(0xffcc66);

const pageMaterialsBase = [
  new MeshStandardMaterial({ color: whiteColor }), 
  new MeshStandardMaterial({ color: "#111" }),    
  new MeshStandardMaterial({ color: whiteColor }), 
  new MeshStandardMaterial({ color: whiteColor }), 
];

appPages.forEach((p) => {
  useTexture.preload(`/textures/${p.front}.jpg`);
  useTexture.preload(`/textures/${p.back}.jpg`);
  if (p.front !== "book-cover") useTexture.preload(`/textures/${p.front}_roughness.jpg`);
  if (p.back !== "book-back") useTexture.preload(`/textures/${p.back}_roughness.jpg`);
});
useTexture.preload(`/textures/book-cover-roughness.jpg`);

const Page = ({ number, front, back, page, opened, bookClosed, ...props }) => {
  const textures = useTexture([
    `/textures/${front}.jpg`, `/textures/${back}.jpg`,
    front === "book-cover" ? `/textures/book-cover-roughness.jpg` : `/textures/${front}_roughness.jpg`,
    back === "book-back" ? `/textures/book-cover-roughness.jpg` : `/textures/${back}_roughness.jpg`,
    `/textures/book-cover-roughness.jpg` 
  ]);
  const pictureFront = textures[0];
  const pictureBack = textures[1];
  const frontSpecificRoughness = textures[2];
  const backSpecificRoughness = textures[3];
  const defaultCoverRoughness = textures[4];

  if (pictureFront) pictureFront.colorSpace = SRGBColorSpace;
  if (pictureBack) pictureBack.colorSpace = SRGBColorSpace;

  const getEffectiveRoughness = (imageName, specificRoughnessMap) => {
    if (imageName === "book-cover" || imageName === "book-back") {
      return defaultCoverRoughness.image ? defaultCoverRoughness : null;
    }
    return specificRoughnessMap.image ? specificRoughnessMap : null;
  };
  const effectiveFrontRoughnessMap = getEffectiveRoughness(front, frontSpecificRoughness);
  const effectiveBackRoughnessMap = getEffectiveRoughness(back, backSpecificRoughness);

  const group = useRef();
  const turnedAt = useRef(0); 
  const lastOpened = useRef(opened); 
  const skinnedMeshRef = useRef();
  const [hoverRegion, setHoverRegion] = useState('none');

  const [isBoosting] = useAtom(isBoostingAtom);
  const [boostActivationTime] = useAtom(boostActivationTimeAtom);
  const [analyser] = useAtom(audioAnalyserAtom);
  const [isMusicPlaying] = useAtom(isMusicPlayingAtom);
  
  // Enhanced tracking for smooth effects
  const currentBoostIntensity = useRef(0);
  const musicIntensity = useRef(0);
  const dataArray = useRef(null);

  useEffect(() => {
    if (hoverRegion === 'zoom') document.body.style.cursor = 'zoom-in';
    else if (hoverRegion === 'turn') document.body.style.cursor = 'pointer';
    else document.body.style.cursor = 'auto';
    return () => { document.body.style.cursor = 'auto'; };
  }, [hoverRegion]);

  const pageSpecificMaterials = useMemo(() => {
    const frontMatProps = { 
        color: whiteColor, map: pictureFront, roughnessMap: effectiveFrontRoughnessMap, 
        roughness: effectiveFrontRoughnessMap ? 1.0 : 0.2, 
        emissive: emissiveColorBase.clone(), emissiveIntensity: 0 
    };
    const backMatProps = { 
        color: whiteColor, map: pictureBack, roughnessMap: effectiveBackRoughnessMap, 
        roughness: effectiveBackRoughnessMap ? 1.0 : 0.2, 
        emissive: emissiveColorBase.clone(), emissiveIntensity: 0 
    };
    return [ 
      ...pageMaterialsBase, 
      new MeshStandardMaterial(frontMatProps), 
      new MeshStandardMaterial(backMatProps)   
    ];
  }, [pictureFront, pictureBack, effectiveFrontRoughnessMap, effectiveBackRoughnessMap]);

  const manualSkinnedMesh = useMemo(() => {
    const bones = [];
    for (let i = 0; i <= PAGE_SEGMENTS; i++) { 
      let bone = new Bone(); bones.push(bone); 
      bone.position.x = i === 0 ? 0 : SEGMENT_WIDTH; 
      if (i > 0) bones[i - 1].add(bone); 
    }
    const skeleton = new Skeleton(bones); 
    const mesh = new SkinnedMesh(pageGeometry, pageSpecificMaterials);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; 
    mesh.add(skeleton.bones[0]); mesh.bind(skeleton);
    return mesh;
  }, [pageSpecificMaterials]);

  const [currentGlobalPage, setGlobalPageAtom] = useAtom(pageAtom); 
  const setIsBookFloating = useSetAtom(bookFloatingAtom);
  const setFocus = useSetAtom(cameraFocusAtom);
  const setIsMusicPlaying = useSetAtom(isMusicPlayingAtom);
  const [isMusicCurrentlyPlaying] = useAtom(isMusicPlayingAtom);
  const setShowFlightEffect = useSetAtom(showInitialFlightEffectAtom);
  const [hasFlightOccurred, setHasFlightOccurred] = useAtom(hasInitialFlightOccurredAtom);

  // Enhanced emissive hover effect with very subtle music glow
  useFrame(() => {
    if (!skinnedMeshRef.current?.material[4] || !skinnedMeshRef.current?.material[5]) return;
    let targetEmissiveColor = emissiveColorBase; 
    let targetEmissiveIntensity = musicIntensity.current * 0.008; // Reduced from 0.015
    
    if (hoverRegion === 'zoom') { 
      targetEmissiveColor = emissiveColorZoomHover; 
      targetEmissiveIntensity = 0.08 + musicIntensity.current * 0.01; // Reduced from 0.02
    } else if (hoverRegion === 'turn') { 
      targetEmissiveColor = emissiveColorTurnHover; 
      targetEmissiveIntensity = 0.08 + musicIntensity.current * 0.01; // Reduced from 0.02
    }
    
    for (let i = 4; i <= 5; i++) { 
      const mat = skinnedMeshRef.current.material[i];
      mat.emissive.lerp(targetEmissiveColor, 0.2);
      mat.emissiveIntensity = MathUtils.lerp(mat.emissiveIntensity, targetEmissiveIntensity, 0.2);
    }
  });

  useFrame((state, delta) => {
    if (!skinnedMeshRef.current || !group.current) return;

    const bones = skinnedMeshRef.current.skeleton.bones;
    const time = state.clock.elapsedTime;

    // Enhanced music analysis
    let currentMusicIntensity = 0;
    if (isMusicPlaying && analyser) {
      if (!dataArray.current) {
        dataArray.current = new Uint8Array(analyser.frequencyBinCount);
      }
      
      analyser.getByteFrequencyData(dataArray.current);
      let sum = 0;
      for (let i = 0; i < dataArray.current.length; i++) {
        sum += dataArray.current[i];
      }
      currentMusicIntensity = sum / dataArray.current.length / 255;
    }
    
    // Smooth music intensity with threshold to prevent noise
    musicIntensity.current = MathUtils.lerp(musicIntensity.current, currentMusicIntensity, 0.08);
    
    // Apply smoothing threshold to prevent micro-movements from noise
    if (musicIntensity.current < 0.12) {
        musicIntensity.current = 0;
    }

    // Calculate boost intensity with addictive curve
    let targetBoostIntensity = 0;
    if (isBoosting) {
        const timeSinceBoost = Date.now() - boostActivationTime;
        if (timeSinceBoost < BOOST_DURATION) {
            const progress = timeSinceBoost / BOOST_DURATION;
            // Fast start (80%) + gradual decay (20%) = addictive boost feel
            const fastStart = Math.exp(-progress * 5);
            const slowDecay = Math.pow(1 - progress, 1.5);
            targetBoostIntensity = (fastStart * 0.8 + slowDecay * 0.2);
        }
    }
    
    currentBoostIntensity.current = MathUtils.lerp(
        currentBoostIntensity.current,
        targetBoostIntensity,
        isBoosting ? 0.25 : 0.15
    );

    let tTime_turn;
    let baseTRot;
    let currentEasingFactorY = easingFactor;
    let currentEasingFactorX = easingFactorFold;
    let turnProgressForCurl = 0;

    if (lastOpened.current !== opened && !isBoosting) { 
        turnedAt.current = +new Date();
        lastOpened.current = opened;
    }
    tTime_turn = Math.min(400, new Date() - turnedAt.current) / 400;
    tTime_turn = Math.sin(tTime_turn * Math.PI); 
    turnProgressForCurl = tTime_turn;

    baseTRot = opened ? -Math.PI / 2 : Math.PI / 2;
    if (!bookClosed) baseTRot += MathUtils.degToRad(number * 0.8);

    // Enhanced boost effects
    if (isBoosting || currentBoostIntensity.current > 0.01) {
        currentEasingFactorY = BOOST_FLAP_Y_EASING;
        currentEasingFactorX = BOOST_FLAP_X_EASING;

        // Enhanced flap animation with better aesthetics
        const flapFreq = BOOST_FLAP_FREQUENCY + musicIntensity.current * 0.3;
        const flapCycleRaw = Math.sin(time * Math.PI * flapFreq);
        
        // More aesthetic easing - powerful downstroke, graceful upstroke
        const easedFlap = flapCycleRaw > 0 ? 
            Math.pow(flapCycleRaw, 0.7) : 
            -Math.pow(-flapCycleRaw, 1.2);
        
        const flapCycleEased = (easedFlap + 1) / 2;
        
        let flapOffset = flapCycleEased * BOOST_FLAP_MAX_ANGLE_OFFSET * currentBoostIntensity.current;
        
        // Enhanced curl with music reactivity - with bounds
        turnProgressForCurl = Math.max(
            turnProgressForCurl, 
            flapCycleEased * 0.5 * currentBoostIntensity.current // Reduced from 0.6 to 0.5
        );
        
        // Clamp curl progress to prevent over-bending
        turnProgressForCurl = MathUtils.clamp(turnProgressForCurl, 0, 1);

        if (opened) { 
            baseTRot += flapOffset; 
        } else { 
            baseTRot -= flapOffset; 
        }
    } else if (isMusicPlaying && musicIntensity.current > 0.15) {
        // Much more subtle music flutter when not boosting
        const musicFlutter = Math.sin(time * 2.0 + number * 1.2) * musicIntensity.current;
        baseTRot += musicFlutter * MathUtils.degToRad(1.5); // Reduced from 3 to 1.5
        
        turnProgressForCurl += musicIntensity.current * 0.03; // Reduced from 0.08 to 0.03
    }

    for (let i = 0; i < bones.length; i++) {
        const targetBone = i === 0 ? group.current : bones[i]; 
        if (!targetBone) continue;

        const inCrvI = i < 8 ? Math.sin(i * 0.2 + 0.25) : 0;
        const outCrvI = i >= 8 ? Math.cos(i * 0.3 + 0.09) : 0;
        const turnI = Math.sin(i * Math.PI * (1 / bones.length)) * turnProgressForCurl; 
        
        let targetRotY = insideCurveStrength * inCrvI * baseTRot - 
                       outsideCurveStrength * outCrvI * baseTRot + 
                       turningCurveStrength * turnI * baseTRot;

        let targetRotX_Fold = MathUtils.degToRad(Math.sign(baseTRot) * 2); 

        // Add very subtle music micro-movements with bounds
        if (isMusicPlaying && musicIntensity.current > 0.15) {
            const microMovement = Math.sin(time * 4.0 + i * 0.6) * musicIntensity.current * 0.008; // Reduced from 0.015
            targetRotY += microMovement;
        }

        // Clamp rotations to prevent extreme distortions
        targetRotY = MathUtils.clamp(targetRotY, -Math.PI, Math.PI);
        targetRotX_Fold = MathUtils.clamp(targetRotX_Fold, -MathUtils.degToRad(15), MathUtils.degToRad(15));

        if (bookClosed) {
            if (i === 0) { targetRotY = baseTRot; targetRotX_Fold = 0; } 
            else { targetRotY = 0; targetRotX_Fold = 0; }
        }

        easing.dampAngle(targetBone.rotation, "y", targetRotY, currentEasingFactorY, delta);
        
        const foldIntensity = i > 8 ? Math.sin(i * Math.PI * (1 / bones.length) - 0.5) * turnProgressForCurl : 0;
        easing.dampAngle(targetBone.rotation, "x", targetRotX_Fold * foldIntensity, currentEasingFactorX, delta);
    }
  });

  const handlePagePointerMove = (event) => { 
    event.stopPropagation();
    if (event.uv && event.object.geometry) {
      const uvY = event.uv.y; 
      const materialIndex = event.face?.materialIndex;
      let isContentPageFace = (materialIndex === 4 && front !== "book-cover") || (materialIndex === 5 && back !== "book-back");
      setHoverRegion(isContentPageFace && uvY > 0.55 ? 'zoom' : 'turn');
    } else { 
      setHoverRegion('turn'); 
    }
  };
  
  const handlePagePointerOut = (event) => { 
    event.stopPropagation(); 
    setHoverRegion('none'); 
  };

  const handlePageClick = (event) => {
    event.stopPropagation();

    if (isBoosting) {
        console.log("Book click ignored during boost.");
        return;
    }

    const isOpeningCoverInitially = currentGlobalPage === 0 && number === 0 && !opened;

    if (isOpeningCoverInitially) {
      if (!isMusicCurrentlyPlaying) {
        setIsMusicPlaying(true);
      }
      if (!hasFlightOccurred) {
        setIsBookFloating(false); 
        setShowFlightEffect(true); 
        setHasFlightOccurred(true); 
      }
    }

    const skinnedMesh = event.object; 
    const worldPoint = event.point; 
    const face = event.face;

    if (!skinnedMesh || !worldPoint || !face || !event.uv) { 
      setGlobalPageAtom(opened ? number : number + 1); 
      setHoverRegion('none'); 
      return;
    }

    const uvY = event.uv.y; 
    const materialIndex = face.materialIndex;
    let isHotspotEligible = (materialIndex === 4 && front !== "book-cover") || (materialIndex === 5 && back !== "book-back");
    
    if (isHotspotEligible && uvY > 0.55) { 
      const camTargetPos = worldPoint.clone();
      const worldNorm = new Vector3().copy(face.normal).applyMatrix3(new Matrix3().getNormalMatrix(skinnedMesh.matrixWorld)).normalize();
      const camNewPos = worldPoint.clone().add(worldNorm.multiplyScalar(1.2));
      setFocus({ target: camTargetPos, position: camNewPos });
    } else { 
      const nextPage = opened ? number : number + 1;
      if (nextPage === 0 && hasFlightOccurred) {
          setIsBookFloating(true);
      } else if (nextPage !== 0) {
          setIsBookFloating(false);
      }
      setGlobalPageAtom(nextPage);
    }
    setHoverRegion('none');
  };

  return (
    <group {...props} ref={group}>
      <primitive 
        object={manualSkinnedMesh} 
        ref={skinnedMeshRef} 
        position-z={-number * PAGE_DEPTH + page * PAGE_DEPTH}
        onClick={handlePageClick} 
        onPointerMove={handlePagePointerMove} 
        onPointerOut={handlePagePointerOut} 
      />
    </group>
  );
};

export const Book = ({ ...props }) => {
  const [pageVal] = useAtom(pageAtom); 
  const [delayedPage, setDelayedPage] = useState(pageVal);

  useEffect(() => {
    let timeout;
    const goToPage = () => {
      setDelayedPage((currentDelayed) => {
        if (pageVal === currentDelayed) return currentDelayed;
        timeout = setTimeout(() => goToPage(), Math.abs(pageVal - currentDelayed) > 2 ? 50 : 150);
        if (pageVal > currentDelayed) return currentDelayed + 1;
        if (pageVal < currentDelayed) return currentDelayed - 1;
        return currentDelayed;
      });
    };
    goToPage(); 
    return () => clearTimeout(timeout);
  }, [pageVal]);

  return (
    <group {...props} rotation-y={-Math.PI / 2}>
      {appPages.map((pageData, index) => (
        <Page 
          key={`bookpage-${index}`}
          page={delayedPage}  
          number={index}      
          opened={delayedPage > index} 
          bookClosed={delayedPage === 0 || (appPages.length > 0 && delayedPage === appPages.length)}
          {...pageData} 
        />
      ))}
      <InitialFlightLines />
    </group>
  );
};