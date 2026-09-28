const MAX_DISPLAYED_COUNT = 99;
const BADGE_COLOR = '#e5484d';
const LABEL_COLOR = '#ffffff';
const SHORT_LABEL_FONT_SIZE = 40;
const LONG_LABEL_FONT_SIZE = 26;
const SHORT_LABEL_MAX_LENGTH = 2;

export function createUnreadFaviconHref(count: number) {
  const label = count > MAX_DISPLAYED_COUNT ? `${String(MAX_DISPLAYED_COUNT)}+` : String(count);
  const fontSize =
    label.length > SHORT_LABEL_MAX_LENGTH ? LONG_LABEL_FONT_SIZE : SHORT_LABEL_FONT_SIZE;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${BADGE_COLOR}"/><text x="32" y="32" dominant-baseline="central" fill="${LABEL_COLOR}" font-family="Arial, sans-serif" font-size="${String(fontSize)}" font-weight="700" text-anchor="middle">${label}</text></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
