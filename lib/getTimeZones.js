import sortOn from "sort-on";
import { DateTime } from "luxon";

import rawTimeZones from "../raw-time-zones.json";

import formatTimeZone from "./formatTimeZone.js";

export default function getTimeZones() {
  return sortOn(
    rawTimeZones.map(function (timeZone) {
      const currentDate = DateTime.fromObject({
        locale: "en-US",
        zone: timeZone.name,
      });

      const timeZoneWithCurrentTimeData = {
        ...timeZone,
        currentTimeOffsetInMinutes: currentDate.offset,
      };

      return {
        ...timeZoneWithCurrentTimeData,
        currentTimeFormat: formatTimeZone(timeZoneWithCurrentTimeData, {
          useCurrentOffset: true,
        }),
      };
    }),
    ["currentTimeOffsetInMinutes", "alternativeName", "mainCities[0]"],
  );
}
