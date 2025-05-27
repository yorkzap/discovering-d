// src/components/pageContents.js

// Example structure:
// For pages that are just images without separate text to render in 3D, you can use null or empty strings.
export const pageTextData = [
    // Page 0 (Cover)
    {
      front: null, // No 3D text for the main cover image itself
      back: "Welcome to the adventure!\nTurn the page to begin.", // Text for the back of the cover (first readable page)
    },
    // Page 1 (Corresponds to pages[1] in UI.jsx)
    {
      front: "Chapter 1: The Journey Begins\n\nThis is the first paragraph on the front of page 1. It has some details.",
      back: "This is the back of page 1.\nMore story unfolds here.",
    },
    // Page 2
    {
      front: "Chapter 2: A New Discovery\n\nThe plot thickens on this page.",
      back: "Further details on the back of page 2.",
    },
    // ... add entries for all your pages. The length should match appPages.length
    // Example for a page that is mostly an image:
    {
      front: null, // If DSC00983.jpg (example) is full-bleed image
      back: "A brief caption for the image on the other side.",
    },
    // Make sure this array has an entry for each page object in `appPages` from UI.jsx
    // Fill with null if a side has no text or is a full image.
  ];
  
  // Ensure pageTextData has a length that matches the number of page objects in your book
  // For the last page object (e.g., picture[last] and book-back):
  if (typeof pageTextData[pageTextData.length-1] === 'undefined') {
      pageTextData.push({ front: "The final words of our story...", back: null });
  }