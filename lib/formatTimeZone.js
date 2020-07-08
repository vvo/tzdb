import { DateTime, Duration } from "luxon";

export default function format(
  {
    name: timeZoneName,
    alternativeName: alternativeTimeZoneName,
    mainCities,
    rawOffsetInMinutes,
  },
  { useCurrentOffset = false } = {},
) {
  const currentDate = DateTime.fromObject({
    locale: "en-US",
    zone: timeZoneName,
  });

  const offsetInHours = useCurrentOffset
    ? currentDate.toFormat("ZZ") // We could use something like https://github.com/mobz/get-timezone-offset to get the time zone offset so that we do not require luxon, but this seems like an abandonned project so for now we will rely on luxon
    : getRawOffsetString(rawOffsetInMinutes);

  return `${offsetInHours.padStart(
    6,
    "+",
  )} ${alternativeTimeZoneName} - ${mainCities.join(", ")}`;
}

function getRawOffsetString(rawOffsetInMinutes) {
  const signedDurationInHours = Duration.fromObject({
    minutes: rawOffsetInMinutes,
  }).toFormat("hh:mm");

  const unsignedDuration = signedDurationInHours.split("-").pop();
  return signedDurationInHours.replace(
    unsignedDuration,
    unsignedDuration.padStart(5, "0"),
  );
}
