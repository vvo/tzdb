import { DateTime } from "luxon";

import rawTimeZones from "../raw-time-zones.json";

import formatTimeZone from "./formatTimeZone.js";

export default function getTimeZones() {
  return rawTimeZones
    .reduce(function (acc, timeZone) {
      const currentDate = DateTime.fromObject({
        locale: "en-US",
        zone: timeZone.name,
      });

      // We build on the latest Node.js version, Node.js embed IANA databases
      // it might happen that the environment that will execute getTimeZones() will not know about some
      // timezones. So we ignore the timezone at runtim
      // See https://github.com/vvo/tzdb/issues/43
      if (currentDate.isValid === false) {
        return acc;
      }

      const timeZoneWithCurrentTimeData = {
        ...timeZone,
        currentTimeOffsetInMinutes: currentDate.offset,
      };

      acc.push({
        ...timeZoneWithCurrentTimeData,
        currentTimeFormat: formatTimeZone(timeZoneWithCurrentTimeData, {
          useCurrentOffset: true,
        }),
      });

      return acc;
    }, [])
    .sort((a, b) => {
      return (
        compareNumbers(a, b) ||
        compareStrings(a.alternativeName, b.alternativeName) ||
        compareStrings(a.mainCities[0], b.mainCities[0])
      );
    });
}

function compareNumbers(x, y) {
  return x.currentTimeOffsetInMinutes - y.currentTimeOffsetInMinutes;
}

function compareStrings(x, y) {
  if (typeof x === "string" && typeof y === "string") {
    return x.localeCompare(y);
  }
  return 0;
}
