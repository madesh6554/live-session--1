import { useState, useEffect } from 'react';

/**
 * Inline styles cannot carry a media query, so responsive branches are decided
 * in JS instead. One listener per query, and the initial value is read
 * synchronously so the first paint is already correct.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

export const useIsNarrow = () => useMediaQuery('(max-width: 640px)');
