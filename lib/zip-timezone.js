// ZIP -> time zone (office 2026-09-15: "time zones EST, CST, PST and more, automatically when the eval is scheduled,
// based on the ZIP code, and they should also see that in the text"). DO-NOT-BREAK rule 86.
//
// The first three ZIP digits name the state (USPS prefixes). Each state has its main zone; the prefixes that sit in
// another zone are listed in SPLIT (Florida Panhandle, west Kentucky, most of Tennessee, NW + SW Indiana, west
// Texas, north Idaho and so on). Good to the prefix, which is what the office needs to type the time into Alpha.
// Answers an IANA name ("America/Chicago") or "" when the ZIP is unknown; the caller then keeps the trainer's zone.
// CommonJS + browser global (window.LDTT_ZIP_TIMEZONE). Data only, no outside call.
(function (root, factory) {
  const mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  else root.LDTT_ZIP_TIMEZONE = mod;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // [first prefix, last prefix, state]
  const RANGES = [
    [5, 5, "NY"], [6, 9, "PR"], [10, 27, "MA"], [28, 29, "RI"], [30, 38, "NH"], [39, 49, "ME"], [50, 54, "VT"], [55, 55, "MA"],
    [56, 59, "VT"], [60, 69, "CT"], [70, 89, "NJ"], [100, 149, "NY"], [150, 196, "PA"], [197, 199, "DE"], [200, 200, "DC"],
    [201, 201, "VA"], [202, 205, "DC"], [206, 219, "MD"], [220, 246, "VA"], [247, 268, "WV"], [270, 289, "NC"], [290, 299, "SC"],
    [300, 319, "GA"], [320, 349, "FL"], [350, 369, "AL"], [370, 385, "TN"], [386, 397, "MS"], [398, 399, "GA"], [400, 427, "KY"],
    [430, 459, "OH"], [460, 479, "IN"], [480, 499, "MI"], [500, 528, "IA"], [530, 549, "WI"], [550, 567, "MN"], [570, 577, "SD"],
    [580, 588, "ND"], [590, 599, "MT"], [600, 629, "IL"], [630, 658, "MO"], [660, 679, "KS"], [680, 693, "NE"], [700, 714, "LA"],
    [716, 729, "AR"], [730, 749, "OK"], [750, 799, "TX"], [800, 816, "CO"], [820, 831, "WY"], [832, 838, "ID"], [840, 847, "UT"],
    [850, 865, "AZ"], [870, 884, "NM"], [885, 885, "TX"], [889, 898, "NV"], [900, 961, "CA"], [967, 968, "HI"], [970, 979, "OR"],
    [980, 994, "WA"], [995, 999, "AK"]
  ];
  const E = "America/New_York", C = "America/Chicago", M = "America/Denver", P = "America/Los_Angeles";
  const STATE = {
    CT: E, DE: E, DC: E, FL: E, GA: E, IN: E, KY: E, ME: E, MD: E, MA: E, MI: E, NH: E, NJ: E, NY: E, NC: E, OH: E, PA: E, RI: E,
    SC: E, VT: E, VA: E, WV: E,
    AL: C, AR: C, IL: C, IA: C, KS: C, LA: C, MN: C, MS: C, MO: C, NE: C, ND: C, OK: C, SD: C, TN: C, TX: C, WI: C,
    CO: M, ID: M, MT: M, NM: M, UT: M, WY: M, AZ: "America/Phoenix",
    CA: P, NV: P, OR: P, WA: P, AK: "America/Anchorage", HI: "Pacific/Honolulu", PR: "America/Puerto_Rico"
  };
  // Prefixes in a different zone from their state.
  const SPLIT = {
    324: C, 325: C,                                   // Florida Panhandle: Panama City, Destin, Miramar Beach, Pensacola
    420: C, 421: C, 422: C, 423: C, 424: C,           // west Kentucky: Paducah, Bowling Green, Owensboro, Henderson
    463: C, 464: C, 476: C, 477: C,                   // Indiana: Gary/Hammond area, Evansville area
    373: E, 374: E, 376: E, 377: E, 378: E, 379: E,   // east Tennessee: Chattanooga, Knoxville, Johnson City
    586: M, 577: M, 693: M,                           // west North Dakota, Rapid City SD, west Nebraska
    798: M, 799: M, 885: M,                           // El Paso, Texas
    835: P, 838: P,                                   // north Idaho: Lewiston, Coeur d'Alene
    979: M                                            // Ontario, Oregon
  };

  function stateForZip(zip) {
    const digits = String(zip ?? "").replace(/\D/g, "");
    if (digits.length < 5) return "";
    const prefix = Number(digits.slice(0, 3));
    const hit = RANGES.find(([from, to]) => prefix >= from && prefix <= to);
    return hit ? hit[2] : "";
  }

  function timeZoneForZip(zip) {
    const state = stateForZip(zip);
    if (!state) return "";
    const prefix = Number(String(zip).replace(/\D/g, "").slice(0, 3));
    return SPLIT[prefix] || STATE[state] || "";
  }

  // "8:00 AM CDT" style zone name for a time in a zone ("CDT", "PST", "MST", "EDT"...).
  function zoneAbbr(value, timeZone) {
    try {
      const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(new Date(value)).find(p => p.type === "timeZoneName");
      return part ? part.value : "";
    } catch { return ""; }
  }

  return { timeZoneForZip, stateForZip, zoneAbbr };
});
