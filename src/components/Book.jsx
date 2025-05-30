// src/components/Book.jsx
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useAtom, useSetAtom } from "jotai";
import { easing } from "maath";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bone, BoxGeometry, Color, Float32BufferAttribute, MathUtils,
  MeshStandardMaterial, Skeleton, SkinnedMesh, SRGBColorSpace,
  Uint16BufferAttribute, Vector3, Matrix3,
  FrontSide,
} from "three";
import { pageAtom, pages as appPages, bookFloatingAtom } from "./UI";
import {
  cameraFocusAtom,
  isMusicPlayingAtom,
  showInitialFlightEffectAtom,
  hasInitialFlightOccurredAtom,
  isBoostingAtom,
  boostActivationTimeAtom,
  audioAnalyserAtom,
  bookWingFlapIntensityAtom,
} from "./atoms";
import { InitialFlightLines } from "./InitialFlightLines";

// --- CONSTANTS ---
const PAGE_GEOMETRY_THICKNESS = 0.0015; // Keep original thin value
const PAGE_STACK_OFFSET = 0.0055; // Keep original value

const NEW_PAGE_ANIM_EASING_FACTOR = 0.55; 
const NEW_PAGE_FOLD_EASING_FACTOR = 0.35; 
const PAGE_CURL_EFFECT_DURATION = 450;    

const insideCurveStrength = 0.18;
const outsideCurveStrength = 0.05;
const turningCurveStrength = 0.05; // Keep original value
const PAGE_WIDTH = 1.28;
const PAGE_HEIGHT = 1.71;
const PAGE_SEGMENTS = 30;
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS;

const EDGE_CURL_REDUCTION_FACTOR = 0.5; 
const EDGE_CURL_REDUCTION_START_SEGMENT = PAGE_SEGMENTS - 5; 

const BOOST_FLAP_FREQUENCY = 1.2;
const BOOST_FLAP_MAX_ANGLE_OFFSET = MathUtils.degToRad(80);
const BOOST_FLAP_Y_EASING = 0.18;
const BOOST_FLAP_X_EASING = 0.22;
const PAGE_BOOST_DURATION = 2000;

const TEXT_DODGE_FLAP_FREQUENCY = 0.25;
const TEXT_DODGE_FLAP_MAX_ANGLE = MathUtils.degToRad(40);
const TEXT_DODGE_FLAP_EASING = 0.08;

const PAGE_FLUTTER_BASE_STRENGTH = 0.0015;
const PAGE_FLUTTER_MUSIC_MULTIPLIER = 1.5;
const PAGE_FLUTTER_BOOST_MULTIPLIER = 3.0;
const PAGE_FLUTTER_FREQUENCY = 8.0;
const PAGE_FLUTTER_EDGE_BIAS = 2.5;

const pageGeometry = new BoxGeometry(PAGE_WIDTH, PAGE_HEIGHT, PAGE_GEOMETRY_THICKNESS, PAGE_SEGMENTS, 2);
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
  new MeshStandardMaterial({ color: whiteColor, side: FrontSide }),
  new MeshStandardMaterial({ color: "#111", side: FrontSide }),
  new MeshStandardMaterial({ color: whiteColor, side: FrontSide }),
  new MeshStandardMaterial({ color: whiteColor, side: FrontSide }),
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
  const isThisPageAnimatingTurn = useRef(false);

  const [isBoostingGlobal] = useAtom(isBoostingAtom);
  const [boostActivationTimeGlobal] = useAtom(boostActivationTimeAtom);
  const [wingFlapIntensity] = useAtom(bookWingFlapIntensityAtom);
  const [analyser] = useAtom(audioAnalyserAtom);
  const [isMusicPlayingValue] = useAtom(isMusicPlayingAtom);

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
      color: whiteColor, 
      map: pictureFront, 
      roughnessMap: effectiveFrontRoughnessMap,
      roughness: effectiveFrontRoughnessMap ? 1.0 : 0.2, 
      emissive: emissiveColorBase.clone(),
      emissiveIntensity: 0, 
      depthWrite: true,
      depthTest: true,
      side: FrontSide,
    };
    const backMatProps = {
      color: whiteColor, 
      map: pictureBack, 
      roughnessMap: effectiveBackRoughnessMap,
      roughness: effectiveBackRoughnessMap ? 1.0 : 0.2, 
      emissive: emissiveColorBase.clone(),
      emissiveIntensity: 0, 
      depthWrite: true,
      depthTest: true,
      side: FrontSide,
    };
    return [...pageMaterialsBase, new MeshStandardMaterial(frontMatProps), new MeshStandardMaterial(backMatProps)];
  }, [pictureFront, pictureBack, effectiveFrontRoughnessMap, effectiveBackRoughnessMap]);

  const manualSkinnedMesh = useMemo(() => {
    const bones = [];
    for (let i = 0; i <= PAGE_SEGMENTS; i++) {
      let bone = new Bone(); 
      bones.push(bone);
      bone.position.x = i === 0 ? 0 : SEGMENT_WIDTH;
      if (i > 0) bones[i - 1].add(bone);
    }
    const skeleton = new Skeleton(bones);
    const mesh = new SkinnedMesh(pageGeometry, pageSpecificMaterials);
    mesh.castShadow = true; 
    mesh.receiveShadow = true; 
    mesh.frustumCulled = false;
    mesh.add(skeleton.bones[0]); 
    mesh.bind(skeleton);
    return mesh;
  }, [pageSpecificMaterials]);

  const [currentGlobalPage, setGlobalPageAtom] = useAtom(pageAtom);
  const setIsBookFloating = useSetAtom(bookFloatingAtom);
  const setFocus = useSetAtom(cameraFocusAtom);
  const setIsMusicPlaying = useSetAtom(isMusicPlayingAtom);
  const [isMusicCurrentlyPlayingLocal] = useAtom(isMusicPlayingAtom);
  const setShowFlightEffect = useSetAtom(showInitialFlightEffectAtom);
  const [hasFlightOccurred, setHasFlightOccurred] = useAtom(hasInitialFlightOccurredAtom);

  useFrame(() => {
    if (!skinnedMeshRef.current?.material[4] || !skinnedMeshRef.current?.material[5]) return;
    let targetEmissiveColor = emissiveColorBase;
    let targetEmissiveIntensity = musicIntensity.current * 0.008;
    if (hoverRegion === 'zoom') {
      targetEmissiveColor = emissiveColorZoomHover;
      targetEmissiveIntensity = 0.08 + musicIntensity.current * 0.01;
    } else if (hoverRegion === 'turn') {
      targetEmissiveColor = emissiveColorTurnHover;
      targetEmissiveIntensity = 0.08 + musicIntensity.current * 0.01;
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

    let currentMusicIntensityValue = 0;
    if (isMusicPlayingValue && analyser) {
      if (!dataArray.current) dataArray.current = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray.current);
      let sum = 0; 
      for (let i = 0; i < dataArray.current.length; i++) sum += dataArray.current[i];
      currentMusicIntensityValue = sum / dataArray.current.length / 255;
    }
    musicIntensity.current = MathUtils.lerp(musicIntensity.current, currentMusicIntensityValue, 0.08);
    if (musicIntensity.current < 0.12) musicIntensity.current = 0;

    let targetBoostIntensity = 0;
    if (isBoostingGlobal) {
      const timeSinceBoost = Date.now() - boostActivationTimeGlobal;
      if (timeSinceBoost < PAGE_BOOST_DURATION) {
        const progress = timeSinceBoost / PAGE_BOOST_DURATION;
        const fastStart = Math.exp(-progress * 5);
        const slowDecay = Math.pow(1 - progress, 1.5);
        targetBoostIntensity = (fastStart * 0.8 + slowDecay * 0.2);
      }
    }
    currentBoostIntensity.current = MathUtils.lerp(currentBoostIntensity.current, targetBoostIntensity, isBoostingGlobal ? 0.25 : 0.15);

    let tTime_turn;
    let baseTRot;
    let currentEasingFactorY = NEW_PAGE_ANIM_EASING_FACTOR;
    let currentEasingFactorX = NEW_PAGE_FOLD_EASING_FACTOR;
    let turnProgressForCurl = 0;

    if (lastOpened.current !== opened && !isBoostingGlobal) {
      turnedAt.current = +new Date();
      lastOpened.current = opened;
      isThisPageAnimatingTurn.current = true;
    }
    const timeSinceTurnStart = Date.now() - turnedAt.current;
    tTime_turn = Math.min(PAGE_CURL_EFFECT_DURATION, timeSinceTurnStart) / PAGE_CURL_EFFECT_DURATION;
    tTime_turn = Math.sin(tTime_turn * Math.PI);
    turnProgressForCurl = tTime_turn;

    baseTRot = opened ? -Math.PI / 2 : Math.PI / 2;
    if (!bookClosed) baseTRot += MathUtils.degToRad(number * 0.8);

    if (isBoostingGlobal || currentBoostIntensity.current > 0.01) {
      currentEasingFactorY = BOOST_FLAP_Y_EASING;
      currentEasingFactorX = BOOST_FLAP_X_EASING;
      const flapFreq = BOOST_FLAP_FREQUENCY + musicIntensity.current * 0.3;
      const flapCycleRaw = Math.sin(time * Math.PI * flapFreq);
      const easedFlap = flapCycleRaw > 0 ? Math.pow(flapCycleRaw, 0.7) : -Math.pow(-flapCycleRaw, 1.2);
      const flapCycleEased = (easedFlap + 1) / 2;
      let flapOffset = flapCycleEased * BOOST_FLAP_MAX_ANGLE_OFFSET * currentBoostIntensity.current;
      turnProgressForCurl = Math.max(turnProgressForCurl, flapCycleEased * 0.5 * currentBoostIntensity.current);
      if (opened) baseTRot += flapOffset; 
      else baseTRot -= flapOffset;
    } else if (wingFlapIntensity > 0.01) {
      currentEasingFactorY = TEXT_DODGE_FLAP_EASING;
      currentEasingFactorX = TEXT_DODGE_FLAP_EASING;
      const textDodgeFlapFreq = TEXT_DODGE_FLAP_FREQUENCY;
      const unflapCycle = Math.sin(time * Math.PI * textDodgeFlapFreq);
      const gracefulUnflap = Math.max(0, unflapCycle) * wingFlapIntensity;
      const easedUnflap = Math.pow(gracefulUnflap, 0.6);
      const unflapOffset = easedUnflap * TEXT_DODGE_FLAP_MAX_ANGLE;
      turnProgressForCurl = Math.max(0, turnProgressForCurl - easedUnflap * 0.8);
      if (opened) baseTRot += unflapOffset;
      else baseTRot -= unflapOffset;
    } else if (isMusicPlayingValue && musicIntensity.current > 0.15) {
      const musicFlutter = Math.sin(time * 2.0 + number * 1.2) * musicIntensity.current;
      baseTRot += musicFlutter * MathUtils.degToRad(1.5);
      turnProgressForCurl += musicIntensity.current * 0.03;
    }
    turnProgressForCurl = MathUtils.clamp(turnProgressForCurl, 0, 1);

    for (let i = 0; i < bones.length; i++) {
      const targetBone = i === 0 ? group.current : bones[i];
      if (!targetBone) continue;
      const inCrvI = i < 8 ? Math.sin(i * 0.2 + 0.25) : 0;
      const outCrvI = i >= 8 ? Math.cos(i * 0.3 + 0.09) : 0;
      
      let currentActiveTurningCurveStrength = turningCurveStrength;
      if (i >= EDGE_CURL_REDUCTION_START_SEGMENT) {
          const progressIntoReduction = (i - EDGE_CURL_REDUCTION_START_SEGMENT) / (PAGE_SEGMENTS - EDGE_CURL_REDUCTION_START_SEGMENT);
          currentActiveTurningCurveStrength = MathUtils.lerp(turningCurveStrength, turningCurveStrength * EDGE_CURL_REDUCTION_FACTOR, progressIntoReduction);
      }
      const turnEffect = Math.sin(i * Math.PI * (1 / bones.length)) * currentActiveTurningCurveStrength * turnProgressForCurl;
      let targetRotY = (insideCurveStrength * inCrvI - outsideCurveStrength * outCrvI + turnEffect) * baseTRot;
      
      let targetRotX_Fold = MathUtils.degToRad(Math.sign(baseTRot) * 2);
      
      if (isMusicPlayingValue && musicIntensity.current > 0.15) {
        const microMovement = Math.sin(time * 4.0 + i * 0.6) * musicIntensity.current * 0.008;
        targetRotY += microMovement;
      }
      let flutterZ = 0; 
      let flutterX = 0;
      if (!bookClosed && (opened || number === 0 || (number === appPages.length - 1 && !opened))) {
        const normalizedBoneIndex = i / (bones.length - 1);
        const edgeFactor = Math.pow(normalizedBoneIndex, PAGE_FLUTTER_EDGE_BIAS);
        let flutterStrength = PAGE_FLUTTER_BASE_STRENGTH;
        flutterStrength += musicIntensity.current * PAGE_FLUTTER_MUSIC_MULTIPLIER * PAGE_FLUTTER_BASE_STRENGTH;
        flutterStrength += currentBoostIntensity.current * PAGE_FLUTTER_BOOST_MULTIPLIER * PAGE_FLUTTER_BASE_STRENGTH;
        flutterStrength += wingFlapIntensity * 0.8 * PAGE_FLUTTER_BASE_STRENGTH;
        const flutterDirection = opened ? 1 : -1;
        flutterZ = Math.sin(time * PAGE_FLUTTER_FREQUENCY + i * 0.5 + number * 0.2) * flutterStrength * edgeFactor * flutterDirection;
        flutterX = Math.cos(time * PAGE_FLUTTER_FREQUENCY * 0.7 + i * 0.8 + number * 0.2) * flutterStrength * edgeFactor * 0.3 * flutterDirection;
      }
      targetRotY = MathUtils.clamp(targetRotY, -Math.PI, Math.PI);
      targetRotX_Fold = MathUtils.clamp(targetRotX_Fold, -MathUtils.degToRad(15), MathUtils.degToRad(15));
      if (bookClosed) {
        if (i === 0) { 
          targetRotY = baseTRot; 
          targetRotX_Fold = 0; 
        }
        else { 
          targetRotY = 0; 
          targetRotX_Fold = 0; 
        }
        flutterX = 0; 
        flutterZ = 0;
      }
      
      easing.dampAngle(targetBone.rotation, "y", targetRotY, currentEasingFactorY, delta);
      const foldIntensity = i > 8 ? Math.sin(i * Math.PI * (1 / bones.length) - 0.5) * turnProgressForCurl : 0;
      easing.dampAngle(targetBone.rotation, "x", targetRotX_Fold * foldIntensity + flutterX, currentEasingFactorX, delta);
      easing.dampAngle(targetBone.rotation, "z", flutterZ, currentEasingFactorX, delta);
    }

    // Simplified render order logic
    if (skinnedMeshRef.current) {
      const mesh = skinnedMeshRef.current;
      const isTurnAnimationActive = isThisPageAnimatingTurn.current && (timeSinceTurnStart < PAGE_CURL_EFFECT_DURATION + 50);
      
      // Only the actively turning page gets a higher render order
      if (isTurnAnimationActive) {
        mesh.renderOrder = 1000; // High value to ensure it renders on top
      } else {
        mesh.renderOrder = 0; // All non-turning pages at base level
      }
      
      // Reset animation flag when done
      if (!isTurnAnimationActive && isThisPageAnimatingTurn.current) {
        isThisPageAnimatingTurn.current = false;
      }
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
    if (isBoostingGlobal) return;
    const isOpeningCoverInitially = currentGlobalPage === 0 && number === 0 && !opened;
    if (isOpeningCoverInitially) {
      if (!isMusicCurrentlyPlayingLocal) setIsMusicPlaying(true);
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
      }
      else if (nextPage !== 0) { 
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
        position-z={-number * PAGE_STACK_OFFSET + page * PAGE_STACK_OFFSET}
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

  const SINGLE_PAGE_TRANSITION_DELAY = 80;
  const MULTI_PAGE_TRANSITION_DELAY = 40;

  useEffect(() => {
    let timeout;
    const goToPage = () => {
      setDelayedPage((currentDelayed) => {
        if (pageVal === currentDelayed) return currentDelayed;
        
        const isSingleTurn = Math.abs(pageVal - currentDelayed) === 1;
        const delay = isSingleTurn ? SINGLE_PAGE_TRANSITION_DELAY : MULTI_PAGE_TRANSITION_DELAY;
        
        timeout = setTimeout(() => goToPage(), delay);
        
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