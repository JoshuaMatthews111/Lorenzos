// Trainer 2.0 landing pages (paid add-on, 2026-10-05). DO-NOT-BREAK rule 169.
//
// A trainer who pays for the add-on gets their OWN 2.0 page at /trainer/<slug>. Their own Meta / Google ads point at it,
// and every lead it captures belongs to that trainer only (api/trainer2-lead.js fixes the trainer on the server).
// This file is the list of those pages: one entry per trainer, keyed by the trainer's slug (public.trainers.slug).
// Only entries with `published: true` are served; anything else answers 404. The page itself is drawn by
// lib/trainer2-page-template.js from the entry below. Nothing here changes any other page.
//
// Every word, number, photo and video below is already real and published by Lorenzo's Dog Training Team:
// the bio (trainers / trainer_pages), the brand facts (40+ years, 600+ Google reviews, 866.436.4959, the 17,000 sq ft
// Cleveland HQ), the training center address (booking_trainers settings), the FAQ answers (lib/ad-page-markets.js),
// the program words (office "Text for Thumbnail" document, rule 160) and the Google review screenshots
// (assets/reviews). Do not add facts, prices, stats, guarantees or testimonials that are not already real.
//
// CommonJS only (the page is rendered on the server).
"use strict";

const SITE_ORIGIN = "https://www.lorenzosdogtrainingteam.com";
const PATH_PREFIX = "/trainer/";

const PAGES = {
  "lorenzo-miller": {
    published: true,
    slug: "lorenzo-miller",
    name: "Lorenzo Miller",
    firstName: "Lorenzo",
    role: "Founder, Lorenzo's Dog Training Team",
    jobTitle: "Founder",
    city: "Cleveland",
    state: "OH",
    market: "Cleveland, OH",
    zipExample: "44128",
    serviceArea: "Cleveland and surrounding Ohio communities",
    areas: ["Cleveland", "Garfield Heights", "Cleveland Heights", "Akron", "Streetsboro", "Northeast Ohio"],
    trainingCenter: { street: "4815 Orchard Rd", city: "Garfield Heights", state: "OH", zip: "44128" },
    seo: {
      title: "Dog Trainer in Cleveland, OH | Lorenzo Miller | Free In-Home Evaluation",
      description: "Train with Lorenzo Miller, founder of Lorenzo's Dog Training Team: 40+ years training dogs, 600+ Google reviews. Book a FREE in-home evaluation in Cleveland. 866.436.4959."
    },
    hero: {
      eyebrow: "Cleveland, OH · Founder of Lorenzo's Dog Training Team",
      kicker: "Dog training in Cleveland with Lorenzo Miller",
      title: ["Serious Training.", "Serious Results."],
      sub: "Train with the man who built the method: 40+ years training dogs, and the founder of Lorenzo's Dog Training Team. Start with a FREE in-home evaluation. No cost, no obligation.",
      cta: "Book My Free Evaluation"
    },
    photos: {
      hero: { src: "/assets/trainer2/lorenzo-miller/hero-1600.webp", small: "/assets/trainer2/lorenzo-miller/hero-800.webp", w: 1600, h: 837,
        mobile: "/assets/trainer2/lorenzo-miller/hero-m-720.webp", mw: 720, mh: 796, alt: "Lorenzo Miller kneeling with a German Shepherd puppy" },
      portrait: { src: "/assets/trainer2/lorenzo-miller/portrait-1200.webp", small: "/assets/trainer2/lorenzo-miller/portrait-700.webp", w: 1200, h: 628,
        alt: "Lorenzo Miller holding two German Shepherd puppies" },
      pack: { src: "/assets/trainer2/lorenzo-miller/pack-1280.webp", small: "/assets/trainer2/lorenzo-miller/pack-800.webp", w: 1280, h: 526,
        alt: "Lorenzo Miller with more than thirty trained dogs holding a down-stay on the grass" },
      center: { src: "/assets/trainer2/lorenzo-miller/hq-1200.webp", small: "/assets/trainer2/lorenzo-miller/hq-700.webp", w: 1200, h: 675,
        alt: "The Lorenzo's Dog Training Team headquarters in Cleveland" }
    },
    proof: [
      { value: "600+", label: "Google reviews" },
      { value: "40+", label: "Years training dogs" },
      { value: "1987", label: "Incorporated in Cleveland" },
      { value: "17,000", label: "Sq ft Cleveland HQ" }
    ],
    includes: ["Your dog seen at home or at the training center", "Talk through your daily routine", "A clear program and next steps", "A straight answer on fit"],
    // The trainer's own bio as published on his trainer page (trainer_pages.approved_bio).
    bio: [
      "Lorenzo’s love of dogs began at an early age. Growing up in the inner city at 6 years old, his heart went out to all the stray dogs in the neighborhood. He would see them knocking over garbage cans looking for food. He began to bring the dogs home but was not allowed to keep them. He smuggled them into his bedroom and trained them, knowing they had to be quiet in order to keep them hidden.",
      "Once his parents realized this was more than a phase, at age 10 they sent him off to train with various professional dog trainers. Lorenzo paid his way through college by providing in-home dog training. The Lorenzo’s training technique was developed after working with numerous dog trainers in the late 70’s and 80’s by studying different methods in various fields of training. Becoming frustrated with their weaknesses, Lorenzo took the best that each technique had to offer and developed his own style of training.",
      "Since its incorporation in 1987, Lorenzo’s Dog Training Team is responsible for the training of thousands of dogs and trainers in the Cleveland area. He is now placing trainers all over the world by recruiting, boarding, training, and hiring qualifying candidates to spread the Lorenzo’s technique and philosophy into the homes and businesses of dog owners around the world."
    ],
    motto: "Lorenzo’s motto has always been “Serious Training, Serious Results” with the main goal of keeping dogs in happy homes and out of shelters.",
    credentials: ["Founder of Lorenzo's Dog Training Team", "Owner / Senior Vice President", "Training under professional trainers from age 10", "40+ years training dogs"],
    // Real videos already on the site (assets/), all filmed for Lorenzo's Dog Training Team in Cleveland.
    videos: [
      { src: "/assets/olivers-dad-and-mom-review.mp4", poster: "/assets/trainer2/lorenzo-miller/olivers-dad-and-mom-review-poster.webp", w: 960, h: 540,
        title: "Oliver's family", text: "Oliver's family shares what changed after working through the Lorenzo's Dog Training Team process at the Cleveland national office." },
      { src: "/assets/ad-testimonial-take-1.mp4", poster: "/assets/trainer2/lorenzo-miller/ad-testimonial-take-1-poster.webp", w: 960, h: 541,
        title: "Real client results", text: "Families talk about life with their dog after training." },
      { src: "/assets/video/ldtt-hq-campus.mp4", poster: "/assets/trainer2/lorenzo-miller/ldtt-hq-campus-poster.webp", w: 960, h: 540,
        title: "Inside the Cleveland HQ", text: "Your dog trains where every Lorenzo's trainer gets certified." },
      { src: "/assets/video/ldtt-cleveland-ad-reel.mp4", poster: "/assets/trainer2/lorenzo-miller/ldtt-cleveland-ad-reel-poster.webp", w: 480, h: 787, vertical: true,
        title: "Trained where the trainers get certified", text: "Real Cleveland training, start to finish." }
    ],
    // Real Google review screenshots already published on the home page (assets/reviews/*.png, here as .webp copies).
    reviews: [
      { img: "/assets/trainer2/lorenzo-miller/reviews/rebecca-rottman-review.webp", w: 664, h: 395, name: "Rebecca Rottman" },
      { img: "/assets/trainer2/lorenzo-miller/reviews/stephanie-palmer-review.webp", w: 661, h: 481, name: "Stephanie Palmer" },
      { img: "/assets/trainer2/lorenzo-miller/reviews/becca-lynn-review.webp", w: 654, h: 306, name: "Becca Lynn" },
      { img: "/assets/trainer2/lorenzo-miller/reviews/jenn-studer-review.webp", w: 678, h: 331, name: "Jenn Studer" },
      { img: "/assets/trainer2/lorenzo-miller/reviews/ashlee-besselman-review.webp", w: 695, h: 312, name: "Ashlee Besselman" },
      { img: "/assets/trainer2/lorenzo-miller/reviews/ariel-kapela-review.webp", w: 673, h: 280, name: "Ariel Kapela" },
      { img: "/assets/trainer2/lorenzo-miller/reviews/rene-stephan-review.webp", w: 664, h: 275, name: "Rene Stephan" }
    ],
    googleReviewsUrl: "https://www.google.com/search?q=Lorenzo%27s+Dog+Training+Team+Google+reviews",
    // The FAQ answers the live ad pages already give (lib/ad-page-markets.js), said for this page.
    faqs: [
      { q: "Is the evaluation with Lorenzo really FREE?", a: "Yes. You and your dog meet with Lorenzo, he sees what is going on, and tells you what it will take. There is no cost and no obligation." },
      { q: "Do you come to my home in Cleveland?", a: "Yes. Training happens where your dog actually lives and walks. You can also meet at the Cleveland training center at 4815 Orchard Rd, Garfield Heights, OH 44128." },
      { q: "Can you help an aggressive or reactive dog?", a: "Yes. Aggression, reactivity, barking and fear are behavior solutions we work on every day, with a clear, safe plan that starts at the evaluation." },
      { q: "Do you offer Board & Train?", a: "Yes. Board & Train lives here: your dog can live, learn and train on campus, right next to the 17,000 sq ft Cleveland headquarters, and comes home with owner handoff lessons." },
      { q: "How soon can we start?", a: "Send the form and pick a time for your FREE evaluation on the next screen. Lorenzo's office follows up quickly, usually the same day." },
      { q: "Do you offer a guarantee?", a: "Every program is backed by the 90-day Limited Training Guarantee, in writing." }
    ]
  }
};

const safeSlug = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);

// The entry for a slug, or null. Unpublished entries are null unless { includeDrafts: true }.
function pageFor(slug, { includeDrafts = false } = {}) {
  const key = safeSlug(slug);
  if (!key || !Object.prototype.hasOwnProperty.call(PAGES, key)) return null;
  const page = PAGES[key];
  if (!page.published && !includeDrafts) return null;
  return page;
}

const publishedSlugs = () => Object.keys(PAGES).filter(slug => PAGES[slug].published === true);
const pagePath = slug => `${PATH_PREFIX}${safeSlug(slug)}`;
const canonicalUrl = slug => `${SITE_ORIGIN}${pagePath(slug)}`;
// The source_page every lead from this page carries. A full address, like the 2.0 ad pages send, so the office's
// pipeline checks (system alerts, sourceWords) treat it as a website lead, and the page is named exactly.
const sourcePage = slug => canonicalUrl(slug);
const leadEndpoint = slug => `/api/trainer2-lead?page=${encodeURIComponent(safeSlug(slug))}`;

module.exports = { SITE_ORIGIN, PATH_PREFIX, PAGES, safeSlug, pageFor, publishedSlugs, pagePath, canonicalUrl, sourcePage, leadEndpoint };
