// src/components/UI.jsx
import { atom, useAtom } from "jotai";
import { useEffect, useState } from "react";
import { CameraControlsUI } from "./CameraControlsUI";
import { cameraFocusAtom, isMusicPlayingAtom } from "./atoms";

const pictures = [
  "DSC00680", "DSC00933", "DSC00966", "DSC00983", "DSC01011", "DSC01040",
  "DSC01064", "DSC01071", "DSC01103", "DSC01145", "DSC01420", "DSC01461",
  "DSC01489", "DSC02031", "DSC02064", "DSC02069",
];
export const pageAtom = atom(0);
export const bookFloatingAtom = atom(true);

export const pages = [ { front: "book-cover", back: pictures[0] } ];
for (let i = 1; i < pictures.length - 1; i += 2) {
  pages.push({
    front: pictures[i % pictures.length],
    back: pictures[(i + 1) % pictures.length],
  });
}
pages.push({ front: pictures[pictures.length - 1], back: "book-back" });

export const UI = () => {
  const [page, setPage] = useAtom(pageAtom);
  const [isCameraFocused] = useAtom(cameraFocusAtom);
  const [isMusicPlaying, setIsMusicPlaying] = useAtom(isMusicPlayingAtom);
  const [isNavExpanded, setIsNavExpanded] = useState(false);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const pageFlipAudio = new Audio("/audios/page-flip-01a.mp3");
    pageFlipAudio.play().catch(error => console.warn("Page flip audio playback failed:", error));
  }, [page]);

  const getPageButtonClasses = (isActive) =>
    `border-transparent hover:border-gray-400 transition-all duration-300 px-2 py-1 sm:px-3 sm:py-2 rounded-md text-xs sm:text-sm uppercase shrink-0 border ${
      isActive ? "bg-gray-700/80 text-white" : "bg-black/30 text-gray-300"
    }`;

  const marqueeAnimationClass = isCameraFocused ? "[animation-play-state:paused]" : "[animation-play-state:running]";

  const toggleMusic = () => {
    setIsMusicPlaying(!isMusicPlaying);
  };

  const musicButtonBaseClasses = "fixed z-50 p-2 sm:p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors pointer-events-auto focus:outline-none focus:ring-2 focus:ring-white/50";
  const musicButtonPositionClass = isCameraFocused ? "top-[3.5rem] sm:top-[4.25rem] right-2 sm:right-4" : "top-2 sm:top-4 right-2 sm:right-4";

  // Pagination logic for mobile
  const PAGES_PER_VIEW_MOBILE = 5;
  const currentGroup = Math.floor(page / PAGES_PER_VIEW_MOBILE);
  const startPage = currentGroup * PAGES_PER_VIEW_MOBILE;
  const endPage = Math.min(startPage + PAGES_PER_VIEW_MOBILE, pages.length);

  return (
    <>
      <a className="pointer-events-auto fixed top-2 left-2 sm:top-4 sm:left-4 z-50 transition-opacity hover:opacity-80" href="https://dasha.bio" title="Wawa Sensei Courses">
        <img className="w-12 sm:w-16 md:w-20" src="/images/wawasensei-white.png" alt="Dasha" />
      </a>
      
      {/* Desktop navigation */}
      <div className="hidden sm:flex fixed top-0 left-0 right-0 pt-3 pb-2 z-40 justify-center pointer-events-none">
        <div className="overflow-x-auto overflow-y-hidden flex items-center gap-2 lg:gap-3 px-4 py-2 bg-black/10 backdrop-blur-sm rounded-lg shadow-md pointer-events-auto max-w-[85vw] md:max-w-[75vw] lg:max-w-[65vw]">
          {pages.map((_, index) => (
            <button key={`page-nav-${index}`} className={getPageButtonClasses(index === page)} onClick={() => setPage(index)} title={index === 0 ? "Cover" : `Go to Page ${index}`}>
              {index === 0 ? "Cover" : `${index}`}
            </button>
          ))}
          <button key="page-nav-back-cover" className={getPageButtonClasses(page === pages.length)} onClick={() => setPage(pages.length)} title="Go to Back Cover">End</button>
        </div>
      </div>

      {/* Mobile navigation with pagination */}
      <div className="flex sm:hidden fixed top-0 left-0 right-0 pt-2 pb-2 z-40 justify-center pointer-events-none">
        <div className="flex flex-col items-center gap-2 bg-black/20 backdrop-blur-sm rounded-lg shadow-md pointer-events-auto mx-2 px-3 py-2">
          <div className="flex items-center gap-1">
            {/* Previous group button */}
            {currentGroup > 0 && (
              <button 
                className="p-1 text-white/70 hover:text-white"
                onClick={() => setPage(startPage - 1)}
                title="Previous pages"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            
            {/* Page buttons */}
            <div className="flex items-center gap-1">
              {Array.from({ length: endPage - startPage }, (_, i) => {
                const pageIndex = startPage + i;
                return (
                  <button 
                    key={`page-nav-mobile-${pageIndex}`} 
                    className={getPageButtonClasses(pageIndex === page)} 
                    onClick={() => setPage(pageIndex)} 
                    title={pageIndex === 0 ? "Cover" : `Page ${pageIndex}`}
                  >
                    {pageIndex === 0 ? "C" : `${pageIndex}`}
                  </button>
                );
              })}
              
              {/* End button if in last group */}
              {endPage === pages.length && (
                <button 
                  key="page-nav-mobile-end" 
                  className={getPageButtonClasses(page === pages.length)} 
                  onClick={() => setPage(pages.length)} 
                  title="Back Cover"
                >
                  E
                </button>
              )}
            </div>
            
            {/* Next group button */}
            {endPage < pages.length && (
              <button 
                className="p-1 text-white/70 hover:text-white"
                onClick={() => setPage(endPage)}
                title="Next pages"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
          
          {/* Page indicator */}
          <div className="text-[10px] text-white/60">
            Page {page + 1} of {pages.length + 1}
          </div>
        </div>
      </div>

      <CameraControlsUI />

      <button
        onClick={toggleMusic}
        title={isMusicPlaying ? "Pause Music" : "Play Music"}
        className={`${musicButtonBaseClasses} ${musicButtonPositionClass}`}
      >
        {isMusicPlaying ? (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.25v13.5l13.5-6.75L5.25 5.25Z" />
          </svg>
        )}
      </button>

      {/* Responsive background text */}
      <div className={`fixed inset-0 flex items-center -rotate-3 select-none -z-10 opacity-30 sm:opacity-40 md:opacity-30 transition-opacity duration-500 ${isCameraFocused ? 'opacity-5 sm:opacity-10 md:opacity-5' : ''}`}>
        <div className="relative"> 
          <div className={`bg-transparent flex items-center gap-6 sm:gap-8 md:gap-12 w-max px-6 sm:px-8 md:px-12 animate-horizontal-scroll ${marqueeAnimationClass}`} style={{ animationDuration: '70s' }}>
            <h1 className="shrink-0 text-white/80 text-5xl sm:text-7xl md:text-8xl lg:text-10xl font-black">The girl</h1>
            <h2 className="shrink-0 text-white/70 text-3xl sm:text-5xl md:text-6xl lg:text-8xl italic font-light">I met</h2>
            <h2 className="shrink-0 text-white/80 text-6xl sm:text-8xl md:text-9xl lg:text-12xl font-bold">at Kingston</h2>
            <h2 className="shrink-0 text-transparent text-6xl sm:text-8xl md:text-9xl lg:text-12xl font-bold italic outline-text">who</h2>
            <h2 className="shrink-0 text-white/80 text-4xl sm:text-6xl md:text-7xl lg:text-9xl font-medium">debugged</h2>
            <h2 className="shrink-0 text-white/70 text-4xl sm:text-6xl md:text-7xl lg:text-9xl font-extralight italic">my</h2>
            <h2 className="shrink-0 text-white/80 text-7xl sm:text-9xl md:text-10xl lg:text-13xl font-bold">May</h2>
            <h2 className="shrink-0 text-transparent text-7xl sm:text-9xl md:text-10xl lg:text-13xl font-bold outline-text italic">2025</h2>
          </div>
          <div 
            className={`absolute top-0 left-0 bg-transparent flex items-center gap-6 sm:gap-8 md:gap-12 w-max px-6 sm:px-8 md:px-12 animate-horizontal-scroll-2 ${marqueeAnimationClass}`} 
            style={{ animationDuration: '60s', transform: 'translateY(20px) translateX(5%)' }} 
          >
            <h1 className="shrink-0 text-white/60 text-5xl sm:text-7xl md:text-8xl lg:text-10xl font-black">The girl</h1>
            <h2 className="shrink-0 text-white/50 text-3xl sm:text-5xl md:text-6xl lg:text-8xl italic font-light">I met</h2>
            <h2 className="shrink-0 text-white/60 text-6xl sm:text-8xl md:text-9xl lg:text-12xl font-bold">at Kingston</h2>
            <h2 className="shrink-0 text-transparent text-6xl sm:text-8xl md:text-9xl lg:text-12xl font-bold italic outline-text">who</h2>
            <h2 className="shrink-0 text-white/60 text-4xl sm:text-6xl md:text-7xl lg:text-9xl font-medium">debugged</h2>
            <h2 className="shrink-0 text-white/50 text-4xl sm:text-6xl md:text-7xl lg:text-9xl font-extralight italic">my</h2>
            <h2 className="shrink-0 text-white/60 text-7xl sm:text-9xl md:text-10xl lg:text-13xl font-bold">May</h2>
            <h2 className="shrink-0 text-transparent text-7xl sm:text-9xl md:text-10xl lg:text-13xl font-bold outline-text italic">2025</h2>
          </div>
        </div>
      </div>
    </>
  );
};