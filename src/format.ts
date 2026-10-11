export function formatOffset(offsetInMinutes: number): string {
  const sign = offsetInMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetInMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

export function formatTimeZone(
  offsetInMinutes: number,
  alternativeName: string,
  mainCities: string[],
): string {
  return `${formatOffset(offsetInMinutes)} ${alternativeName} - ${mainCities.join(", ")}`;
}
