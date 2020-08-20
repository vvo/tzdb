import sortOn from "sort-on";
import { DateTime } from "luxon";

import rawTimeZones from "../raw-time-zones.json";

import formatTimeZone from "./formatTimeZone.js";

export default function getTimeZones() {
  return sortOn(
    rawTimeZones.reduce(function (acc, timeZone) {
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
    }, []),
    ["currentTimeOffsetInMinutes", "alternativeName", "mainCities[0]"],
  );
}
