export function getCookiePath() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

  return basePath === '' ? '/' : basePath;
}
