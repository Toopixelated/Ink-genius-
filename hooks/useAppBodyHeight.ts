import { useState, useLayoutEffect } from 'react';

/**
 * Calculates the available height for the main app body, excluding the header.
 * This is useful for absolutely positioned elements that need to fill the remaining space.
 * @returns {number} The height in pixels.
 */
export function useAppBodyHeight() {
  const [height, setHeight] = useState(0); 

  useLayoutEffect(() => {
    const measure = () => {
      const header = document.querySelector("header");
      // A reasonable fallback if the header isn't rendered yet.
      const headerHeight = header ? header.getBoundingClientRect().height : 56; 
      setHeight(window.innerHeight - headerHeight);
    };

    measure();
    // Recalculate on resize
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return height;
}
