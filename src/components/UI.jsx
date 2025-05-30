// src/components/UI.jsx
import { atom, useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { CameraControlsUI } from "./CameraControlsUI"; // This component will now be always visible
import { cameraFocusAtom, isMusicPlayingAtom } from "./atoms";

const pictures = [
  "DSC00680", "DSC00933", "DSC00966", "DSC00983", "DSC01011", "DSC01040",
  "DSC01064", "DSC01071", "DSC01103", "DSC01145", "DSC01420", "DSC01461",
  "DSC01489", "DSC02031", "DSC02064", "DSC02069",
];
export const pageAtom = atom(0);
export const bookFloatingAtom = atom(true);

export const pages = [];
pages.push({
  front: "book-cover", back: pictures[0], 
  floatingTexts: ["The Chronos Enigma:\nA Stellaris Expedition", "Log Entry: Cycle 74.3", "Captain's Log:\nWe've encountered a peculiar\nspatio-temporal distortion...", "...its gravitational pull is unlike\nanything previously recorded."]
});
for (let i = 0; i < pictures.length - 1; i++) {
    pages.push({
        front: pictures[i], back: pictures[i+1], 
        floatingTexts: [`Field Report: Sector ${i + 1}-Alpha.\nImage Ref: ${pictures[i]}`, "Unusual energy signatures detected,\nreadings are off the charts.", `Visual confirmation from ${pictures[i+1]}.\nThe structure appears organic.`, "Proceeding with extreme caution."]
    });
}
pages.push({
  front: pictures[pictures.length - 1], back: "book-back",
  floatingTexts: ["Final Log Entry:\nThe source remains an enigma.", "Further investigation is paramount.\nReturning to Starbase for analysis.", "End transmission."]
});

export const UI = ({}) => {
  const [page, setPage] = useAtom(pageAtom);
  const [isCameraFocused] = useAtom(cameraFocusAtom); // Used to conditionally disable zoom-out
  const [isMusicPlaying, setIsMusicPlaying] = useAtom(isMusicPlayingAtom);
  const pageButtonRefs = useRef([]);
  // No longer need showCameraControls or controlsMenuRef as it's always visible

  useEffect(() => {
    if (page > 0 && page < pages.length) { 
        const pageFlipAudio = new Audio("/audios/page-flip-01a.mp3");
        pageFlipAudio.volume = 0.7;
        pageFlipAudio.play().catch(error => console.warn("Page flip audio playback failed:", error));
    }
  }, [page]);

  useEffect(() => {
    if (pageButtonRefs.current[page]) {
      pageButtonRefs.current[page].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (page === pages.length && pageButtonRefs.current[pages.length]) {
       pageButtonRefs.current[pages.length].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [page]);

  const getPageButtonClasses = (isActive) =>
    `w-full text-left border-transparent hover:border-gray-400/50 transition-all duration-300 
     px-3 py-1.5 text-xs sm:text-sm rounded-md border whitespace-nowrap overflow-hidden text-ellipsis ${
      isActive ? "bg-gray-600/80 text-white" : "bg-black/30 text-gray-300 hover:bg-black/50"
    }`;
  
  const musicIconButtonClass = "p-1.5 bg-black/30 text-white rounded-full hover:bg-black/50 transition-colors focus:outline-none focus:ring-1 focus:ring-white/40";

  const marqueeAnimationClass = isCameraFocused ? "[animation-play-state:paused]" : "[animation-play-state:running]";

  const toggleMusic = () => setIsMusicPlaying(!isMusicPlaying);
  
  return (
    <>
      {/* Main Logo - Fixed top-left */}
      <a 
        className="pointer-events-auto fixed top-2 left-2 sm:top-4 sm:left-4 z-50 transition-opacity hover:opacity-80" 
        href="https://dasha.bio" 
        title="Dasha.bio - Home"
      >
        <img className="w-12 sm:w-16 md:w-20" src="/images/wawasensei-white.png" alt="Dasha Bio" />
      </a>
      
      <div className="fixed top-0 right-0 h-screen py-2 sm:py-3 md:py-4 pr-2 sm:pr-3 md:pr-4 pl-1 sm:pl-1.5 md:pl-2 z-40 flex pointer-events-none">
        <div className="w-auto max-w-[100px] sm:max-w-[120px] md:max-w-[150px] h-full flex flex-col items-stretch bg-black/25 backdrop-blur-md rounded-lg shadow-xl p-1.5 sm:p-2 md:p-3 pointer-events-auto overflow-hidden">
          
          {/* Top Control: Music Button Only */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0 py-1">
            <button 
              onClick={toggleMusic} 
              title={isMusicPlaying ? "Pause Music" : "Play Music"} 
              className={musicIconButtonClass}
            >
              {isMusicPlaying 
                ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" /></svg> 
                : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.25v13.5l13.5-6.75L5.25 5.25Z" /></svg>
              }
            </button>
          </div>

          {/* Vertical Page Navigation */}
          <div className="flex-grow overflow-y-auto min-h-0 flex flex-col gap-1.5 pr-1 scrollbar-thin scrollbar-thumb-gray-500/50 scrollbar-track-transparent scrollbar-thumb-rounded my-1">
            {pages.map((_, index) => ( 
              <button 
                key={`page-nav-v-${index}`} 
                ref={el => pageButtonRefs.current[index] = el}
                className={getPageButtonClasses(index === page)} 
                onClick={() => setPage(index)} 
                title={index === 0 ? "Cover" : `Page ${index + 1}`}
              >
                {index === 0 ? "Cvr" : `${index + 1}`}
              </button>
            ))}
            <button 
              key="page-nav-v-end" 
              ref={el => pageButtonRefs.current[pages.length] = el}
              className={getPageButtonClasses(page === pages.length)} 
              onClick={() => setPage(pages.length)} 
              title="Close Book (View Back Cover)"
            >
              End
            </button>
          </div>
          
          {/* Bottom Section: Camera Controls (always visible) */}
          <div className="flex-shrink-0 pt-2"> 
            {/* Pass isCameraFocused to CameraControlsUI so it can disable zoom-out button */}
            <CameraControlsUI isZoomedIn={isCameraFocused} /> 
          </div>
        </div>
      </div>

      {/* Background Marquee Text */}
      <div className={`fixed inset-0 flex items-center -rotate-3 select-none -z-10 opacity-30 sm:opacity-40 md:opacity-30 transition-opacity duration-500 ${isCameraFocused ? 'opacity-5 sm:opacity-10 md:opacity-5' : ''}`}>
        <div className="relative"> 
          <div className={`bg-transparent flex items-center gap-6 sm:gap-8 md:gap-12 w-max px-6 sm:px-8 md:px-12 animate-horizontal-scroll ${marqueeAnimationClass}`} style={{ animationDuration: '70s' }}>
            <h1 className="shrink-0 text-white/80 text-5xl sm:text-7xl md:text-8xl lg:text-10xl font-black">The girl</h1><h2 className="shrink-0 text-white/70 text-3xl sm:text-5xl md:text-6xl lg:text-8xl italic font-light">I met</h2><h2 className="shrink-0 text-white/80 text-6xl sm:text-8xl md:text-9xl lg:text-12xl font-bold">at Kingston</h2><h2 className="shrink-0 text-transparent text-6xl sm:text-8xl md:text-9xl lg:text-12xl font-bold italic outline-text">who</h2><h2 className="shrink-0 text-white/80 text-4xl sm:text-6xl md:text-7xl lg:text-9xl font-medium">debugged</h2><h2 className="shrink-0 text-white/70 text-4xl sm:text-6xl md:text-7xl lg:text-9xl font-extralight italic">my</h2><h2 className="shrink-0 text-white/80 text-7xl sm:text-9xl md:text-10xl lg:text-13xl font-bold">May</h2><h2 className="shrink-0 text-transparent text-7xl sm:text-9xl md:text-10xl lg:text-13xl font-bold outline-text italic">2025</h2>
          </div>
          <div className={`absolute top-0 left-0 bg-transparent flex items-center gap-6 sm:gap-8 md:gap-12 w-max px-6 sm:px-8 md:px-12 animate-horizontal-scroll-2 ${marqueeAnimationClass}`} style={{ animationDuration: '60s', transform: 'translateY(20px) translateX(5%)' }} >
            <h1 className="shrink-0 text-white/60 text-5xl sm:text-7xl md:text-8xl lg:text-10xl font-black">The girl</h1><h2 className="shrink-0 text-white/50 text-3xl sm:text-5xl md:text-6xl lg:text-8xl italic font-light">I met</h2><h2 className="shrink-0 text-white/60 text-6xl sm:text-8xl md:text-9xl lg:text-12xl font-bold">at Kingston</h2><h2 className="shrink-0 text-transparent text-6xl sm:text-8xl md:text-9xl lg:text-12xl font-bold italic outline-text">who</h2><h2 className="shrink-0 text-white/60 text-4xl sm:text-6xl md:text-7xl lg:text-9xl font-medium">debugged</h2><h2 className="shrink-0 text-white/50 text-4xl sm:text-6xl md:text-7xl lg:text-9xl font-extralight italic">my</h2><h2 className="shrink-0 text-white/60 text-7xl sm:text-9xl md:text-10xl lg:text-13xl font-bold">May</h2><h2 className="shrink-0 text-transparent text-7xl sm:text-9xl md:text-10xl lg:text-13xl font-bold outline-text italic">2025</h2>
          </div>
        </div>
      </div>
    </>
  );
};