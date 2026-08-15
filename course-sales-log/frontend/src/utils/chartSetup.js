import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler
);

ChartJS.defaults.font.family = "'DM Sans', system-ui, sans-serif";
ChartJS.defaults.font.size = 12;
ChartJS.defaults.plugins.legend.display = false;
ChartJS.defaults.plugins.tooltip.borderWidth = 1;
ChartJS.defaults.plugins.tooltip.cornerRadius = 6;
ChartJS.defaults.plugins.tooltip.padding = 10;
ChartJS.defaults.plugins.tooltip.titleFont = { family: "'DM Mono', monospace", size: 12 };
ChartJS.defaults.plugins.tooltip.bodyFont = { family: "'DM Sans', sans-serif", size: 12 };
ChartJS.defaults.responsive = true;
ChartJS.defaults.maintainAspectRatio = false;

/**
 * A canvas cannot resolve `var(--c-x)` — Chart.js writes the string straight
 * into a 2D context, which silently paints nothing. So the palette has to be
 * READ from the document and handed over as literals, and re-read whenever
 * data-theme flips.
 */
export function cssVar(name, fallback = '') {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v.trim() || fallback;
}

/** Push the current palette into Chart.js' global defaults. */
export function applyChartTheme() {
  ChartJS.defaults.color = cssVar('--c-t5', '#737373');
  ChartJS.defaults.borderColor = cssVar('--c-border', '#E5E5E0');
  ChartJS.defaults.plugins.tooltip.backgroundColor = cssVar('--c-toastBg', '#111111');
  ChartJS.defaults.plugins.tooltip.titleColor = cssVar('--c-toastText', '#ffffff');
  ChartJS.defaults.plugins.tooltip.bodyColor = cssVar('--c-toastText', '#ffffff');
  ChartJS.defaults.plugins.tooltip.borderColor = cssVar('--c-borderStrong', '#D5D5D0');
}

export default ChartJS;
