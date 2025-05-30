// src/components/textContent.js

// Example content. You should replace this with your actual narrative.
// The structure is an array of objects, where each object corresponds to a page
// (index matching `pageAtom`) and contains an array of `lines` (strings).

export const chapterText = [
    { // Page 0 (Corresponds to pageAtom = 0, typically the Cover)
      lines: [
        "The Cosmic Codex",
        "An Interstellar Journey Begins...",
        "Click the background to BOOST!",
      ]
    },
    { // Page 1 (pageAtom = 1)
      lines: [
        "Chapter I: The Anomaly",
        "Deep space sensors registered a peculiar energy surge.",
        "Origin: The Ghost Nebula.",
        "A mission was hastily assembled.",
      ]
    },
    { // Page 2 (pageAtom = 2)
      lines: [
        "The starship 'Eventide' slipped into hyperspace.",
        "Its destination: a point of no return?",
        "Each light-year pulsed with anticipation.",
      ]
    },
    { // Page 3 (pageAtom = 3)
      lines: [
        "Stellar phenomena painted the void with breathtaking colors.",
        "Yet, an unnerving silence pervaded the comms.",
        "The Ghost Nebula loomed closer.",
      ]
    },
    { // Page 4 (pageAtom = 4)
      lines: [
        "First contact, or first warning?",
        "Ancient signals echoed through the ship's receivers.",
        "Fragments of a forgotten language.",
      ]
    },
    // Add more entries to match the number of pages defined in your UI.jsx `pages` array.
    // For example, if `pages.length` from UI.jsx is 9 (meaning pageAtom goes 0-8 for content pages),
    // you would ideally have chapterText[0] through chapterText[8].
    // For this example, let's add a few more placeholders:
    { lines: ["Page 5: The Nebula's Embrace"] },
    { lines: ["Page 6: Echoes of the Past"] },
    { lines: ["Page 7: A Choice Revealed"] },
    { lines: ["Page 8: The Codex Unveiled"] },
    // Optional: Text for when pageAtom === pages.length (book fully closed at back, "End" state in UI)
    // This text would typically only show if the user manually navigates to the "End" state.
    // {
    //   lines: ["The journey's end... or a new beginning?"]
    // }
  ];
  
  // Pad with placeholder content if chapterText is shorter than a typical book length.
  // This is mostly for robust example display. Ideally, your content matches your page count.
  const MIN_EXPECTED_PAGES = 10; // Adjust if your `pages` array in UI.jsx usually has more items.
  for (let i = chapterText.length; i < MIN_EXPECTED_PAGES; i++) {
    chapterText.push({
      lines: [`Placeholder text for page ${i}.`, "Please add more content in textContent.js"]
    });
  }