// src/utils/audioUtils.js
export const playSound = (src, volume = 0.5) => {
    try {
      const audio = new Audio(src);
      audio.volume = volume;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name === 'NotAllowedError') {
            console.warn(`Audio playback for ${src} was not allowed. This often happens if the user hasn't interacted with the page yet.`);
          } else {
            console.warn(`Audio play failed for ${src}:`, error);
          }
        });
      }
      return audio;
    } catch (e) {
      console.error(`Failed to load audio ${src}. Ensure the file exists at the specified path (e.g., public/audio/${src.split('/').pop()}). Error:`, e);
      return null;
    }
  };