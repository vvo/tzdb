import { Duration } from "luxon";

export default function format(
  {
    alternativeName,
    mainCities,
    rawOffsetInMinutes,
    currentTimeOffsetInMinutes,
  },
  { useCurrentOffset = false } = {},
) {
  const offsetInHours = useCurrentOffset
    ? getOffsetString(currentTimeOffsetInMinutes)
    : getOffsetString(rawOffsetInMinutes);

  return `${offsetInHours.padStart(
    6,
    "+",
  )} ${alternativeName} - ${mainCities.join(", ")}`;
}

function getOffsetString(offsetInMinutes) {
  const durationInHoursMinutes = Duration.fromObject({
    minutes: Math.abs(offsetInMinutes),
  }).toFormat("hh:mm");

  return `${offsetInMinutes >= 0 ? "+" : "-"}${durationInHoursMinutes}`;
}
