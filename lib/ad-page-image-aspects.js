// Pixel aspect ratios of the photos ad pages can use, read from the real
// files by scripts/build-image-aspects (node -e in the Page Studio commit).
// api/ad-page.js uses this on Vercel, where the asset files are not inside the
// function bundle; the static generator still reads the files directly.
(function (root, factory) {
  const mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  else root.LDTT_AD_PAGE_IMAGE_ASPECTS = mod;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return {
    "assets/facility-exterior-main.jpg": "1920/1080",
    "assets/ldtt-team-hq-exterior.jpg": "3000/2000",
    "assets/video/ldtt-hq-campus-poster.jpg": "1280/720",
    "assets/columbus-two-dogs.jpg": "1600/900",
    "assets/ldtt-dog-mark.png": "443/258",
    "assets/utility-retrieval.png": "1254/1254",
    "assets/alison1.png": "1254/1254",
    "assets/facility-purpose-aerial-clean.png": "1672/941",
    "assets/market-photos/san-diego-client-dog.jpg": "1000/800",
    "assets/market-photos/san-antonio-field-work.jpg": "2000/1333",
    "assets/market-photos/san-antonio-handler-dog.jpg": "1000/800",
    "assets/ldtt-team-cover.jpg": "2048/1365",
    "assets/market-photos/chicago-training-hall.jpg": "2000/1333",
    "assets/market-photos/tallahassee-lead.jpg": "2000/1500",
    "assets/market-photos/tallahassee-second.jpg": "2000/1333",
    "assets/market-photos/miramar-beach-dog.jpg": "1000/800",
    "assets/market-photos/miramar-second.jpg": "2000/1333",
    "assets/market-photos/panama-city-beach-dog.jpg": "1000/800",
    "assets/market-photos/lorenzo-pack-down-stay.jpg": "1792/736",
    "assets/market-photos/lexington-class-group.jpg": "1000/800",
    "assets/market-photos/lexington-trainer-candid.jpg": "2000/1333",
    "assets/market-photos/ann-arbor-third.jpg": "1080/1080",
    "assets/market-photos/ann-arbor-second.jpg": "1000/800",
    "assets/market-photos/ann-arbor-lead.jpg": "1000/800",
    "assets/market-photos/lexington-trainer-working-dog.jpg": "2000/1429",
    "assets/market-photos/miramar-fourth.jpg": "1000/800",
    "assets/market-photos/miramar-third.jpg": "1000/800",
    "assets/market-photos/panama-city-beach-second.jpg": "1000/800",
    "assets/market-photos/san-antonio-fourth.jpg": "1600/1067",
    "assets/market-photos/san-antonio-obedience.jpg": "1000/800",
    "assets/market-photos/san-antonio-third.jpg": "1600/1067"
  };
});
