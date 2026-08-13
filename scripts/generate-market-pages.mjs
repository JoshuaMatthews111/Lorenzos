import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const markets = [
  {
    slug: "dog-training-cleveland-oh",
    photoPos: "center 65%",
    photo2: "assets/facility-grounds-wide.jpg", photo2Alt: "Open training grounds at the Cleveland headquarters campus",
    photo: "assets/facility-exterior-main.jpg", photoName: "The 17,000 sq ft headquarters", photoCaption: "Where every Lorenzo's trainer is certified", word: "THE HQ", issues: "Aggression|Leash pulling|New puppy|Board & train", proofValue: "17,000", proofLabel: "Sq ft HQ facility", benefits: "Free evaluation|Same-day callback|90-day guarantee", priceMode: "quiet",
    arch: "hq", mk1: "#152569", mk2: "#C8102E",
    
    
      
    tint: "21,37,105",
    tint2: "200,16,46",
    hook: "See where it started: a free evaluation backed by our 17,000 sq ft Cleveland headquarters — the facility where every Lorenzo's trainer is certified.",
    title: "Cleveland & Akron Dog Training",
    h1: "Aggression, Leash Pulling, or a New Puppy? Cleveland's Dog Trainers Start Here.",
    market: "Cleveland / Akron, OH",
    city: "Cleveland",
    state: "OH",
    area: "Cleveland, Akron, Garfield Heights, Cleveland Heights, Streetsboro, and Northeast Ohio",
    trainers: "Harley McGrew and Brady DeRemer",
    proof: "Local Northeast Ohio support backed by Lorenzo's office-routed training system.",
    nearby: ["Cleveland Heights", "Garfield Heights", "Akron", "Streetsboro", "Northeast Ohio"],
    checks: ["Aggression and reactivity help from trainers certified at our national HQ", "Board & train at headquarters — your dog lives and learns on campus", "New puppy? Potty, crate, and socialization handled early", "Free evaluation backed by the 17,000 sq ft Cleveland campus"],
    care: {"eyebrow": "The home team", "h2": "Trained where every Lorenzo's trainer is certified.", "p": "Cleveland isn't just a market to us — it's headquarters. Your evaluation is backed by the 17,000 sq ft campus where every trainer in the network earns certification, and board & train dogs live and learn on-site.", "t": "Why Northeast Ohio starts here."},
    testis: [{"h": "Evaluated at the source", "p": "Free evaluations backed by the national headquarters — not a satellite office."}, {"h": "39 years of dogs like yours", "p": "Aggression, reactivity, puppies, rescues — since 1988, Northeast Ohio families have started here."}, {"h": "Board & train advantage", "p": "Your dog trains daily with professionals and comes home with real skills — owner handoff lessons included."}],
    zipCodes: ["44118", "44241"]
  },
  {
    slug: "dog-training-columbus-oh",
    photo2Pos: "center 15%", photo2: "assets/emilio-yoyo.jpg", photo2Alt: "A professional safely handling a reactive dog during behavior work",
    photo: "assets/get-started-premium-hero.jpg", photoName: "Two dogs. One calm house.", photoCaption: "Multi-dog peace is the outcome we train for", word: "AGGRESSION", issues: "Dogs fighting at home|Jumping|Potty training|Barking", proofValue: "Same week", proofLabel: "Aggression assessments", benefits: "Free evaluation|Multi-dog specialists|90-day guarantee", priceMode: "forward",
    arch: "portrait", mk1: "#7A1E2C", mk2: "#EFE7DA",
    
    
      
    tint: "21,37,105",
    tint2: "120,20,60",
    hook: "Dogs fighting in the same house? Multi-dog conflict is exactly what we fix — ask about a same-week assessment.",
    title: "Columbus Dog Training",
    h1: "Dogs Fighting at Home? Columbus Aggression & Behavior Training Starts Here.",
    market: "Columbus / Reynoldsburg, OH",
    city: "Columbus",
    state: "OH",
    area: "Columbus, Reynoldsburg, and Central Ohio communities",
    trainers: "Shannon Paskins",
    proof: "Central Ohio dog owners can request obedience and behavior modification help through Lorenzo's office.",
    nearby: ["Columbus", "Reynoldsburg", "Central Ohio", "Franklin County", "Licking County"],
    checks: ["Dogs fighting in the same house — assessment, safety plan, reintroduction", "Jumping, barking, and door-crashing brought under control", "Potty training and puppy foundations", "Owner coaching so the peace holds after we leave"],
    care: {"eyebrow": "Multi-dog households", "h2": "Two dogs. One house. It can work again.", "p": "When dogs in the same home start fighting, waiting makes it worse. Columbus families bring us exactly this — we assess both dogs, make the household safe immediately, and rebuild the relationship step by step.", "t": "How we handle dogs in conflict."},
    testis: [{"h": "Assess first", "p": "A professional reads both dogs — triggers, resource guarding, body language — before anyone talks plans."}, {"h": "Make home safe now", "p": "You get an immediate management plan so nobody gets hurt while training happens."}, {"h": "Reintroduce for keeps", "p": "Structured reintroduction with owner coaching, so calm is the new normal after we leave."}],
    zipCodes: ["43068"]
  },
  {
    slug: "dog-training-atlanta-ga",
    photo2: "assets/matthew-behavior-dog.jpg", photo2Alt: "A behavior-case dog working calmly with a professional",
    photo: "assets/utility-retrieval.png", photoName: "Dogs with jobs", photoCaption: "Service, task work and specialty training — Atlanta's open lane", word: "SERVICE", issues: "Service dog training|Aggression|Task work|Obedience", proofValue: "3", proofLabel: "Certified Atlanta trainers", benefits: "Free suitability assessment|Service-dog specialists|90-day guarantee", priceMode: "quiet",
    arch: "specialty", mk1: "#14101F", mk2: "#C9A227",
    
    
      
    tint: "30,25,90",
    tint2: "190,60,30",
    hook: "Specialty & service dog training few in Atlanta offer — ask about a free suitability assessment for your dog.",
    title: "Atlanta Dog Training",
    h1: "Service Dog Training in Atlanta — Plus Aggression Help & Real-World Obedience.",
    market: "Atlanta, GA",
    city: "Atlanta",
    state: "GA",
    area: "Atlanta, Loganville, Dallas, and surrounding Georgia communities",
    trainers: "Aryson Whorley, Christopher Almonte, and Chloe Chisolm",
    proof: "Georgia dog owners can start with one office-routed request and be matched to the right next step.",
    nearby: ["Atlanta", "Loganville", "Dallas", "North Georgia", "Metro Atlanta"],
    checks: ["Service dog training with an honest suitability assessment first", "Task work, scent work, retrieval, and advanced control", "Aggression and behavior modification handled professionally", "Real-world obedience for everyday Atlanta life"],
    care: {"eyebrow": "Specialty programs", "h2": "The training few in Atlanta offer.", "p": "Service dog and specialty training take more than obedience classes. We start with an honest suitability assessment — not every dog is a service-dog candidate, and you deserve the truth before you invest.", "t": "What specialty training really involves."},
    testis: [{"h": "Suitability first", "p": "A free assessment tells you honestly whether your dog is a candidate — before you spend anything."}, {"h": "Realistic timelines", "p": "Task training is measured in months of structured work. We map it out clearly up front."}, {"h": "Beyond service dogs", "p": "Protection, scent, utility, and retrieval work for owners who want a dog with a job."}],
    zipCodes: ["30052", "30324", "30157"]
  },
  {
    slug: "dog-training-san-diego-ca",
    photo2: "assets/ad-testimonial-take-1-cover.png", photo2Alt: "Real Lorenzo's clients with their trained golden retriever",
    photo: "assets/facility-purpose-aerial-clean.png", photoName: "Nothing to hide", photoCaption: "Real campus, real programs, published prices", word: "HONEST", issues: "New puppy|Leash pulling|Barking|Recall", proofValue: "$1,250", proofLabel: "Transparent starting price", benefits: "Free evaluation|Published pricing|90-day guarantee", priceMode: "forward",
    arch: "coast", mk1: "#0E5E8A", mk2: "#EAF4F9",
    
    
      
    tint: "15,60,110",
    tint2: "200,16,46",
    hook: "Transparent pricing: professional dog training from $1,250 — no mystery quotes.",
    title: "San Diego Dog Training",
    h1: "San Diego Dog Training From $1,250 — Obedience, Puppy & Behavior Help.",
    market: "San Diego, CA",
    city: "San Diego",
    state: "CA",
    area: "San Diego, North Park, nearby beach communities, and surrounding San Diego County",
    trainers: "Genevieve Twilla, Karemela Sefferin, and Fred Harris",
    proof: "San Diego families can request obedience, behavior modification, service, and specialty training support.",
    nearby: ["San Diego", "North Park", "Chula Vista", "Mission Valley", "San Diego County"],
    checks: ["Published prices: training from $1,250, board & train from $2,500", "Obedience, puppy, and behavior help across San Diego County", "Free evaluation — not a sales appointment", "The 90-day guarantee, in writing"],
    care: {"eyebrow": "Straight answers", "h2": "You shouldn't need three phone calls to learn a price.", "p": "In San Diego, many training companies quote thousands — but only after a consultation. Our prices are published: professional training from $1,250, board & train from $2,500. The evaluation is free, and it's an evaluation, not a pitch.", "t": "Transparent from the first click."},
    testis: [{"h": "Published pricing", "p": "From $1,250 — on the page, before you ever talk to anyone."}, {"h": "A real evaluation", "p": "We assess your dog and tell you what it takes. If it's not a fit, we say so."}, {"h": "Guaranteed in writing", "p": "The 90-day Limited Training Guarantee comes standard with every program."}],
    zipCodes: ["92105", "92106"]
  },
  {
    slug: "dog-training-san-antonio-tx",
    photo: "assets/trainer-bio-photos/trainers.jpg", photoName: "One team, two languages", photoCaption: "English & Spanish — su solicitud es bienvenida en español", word: "BILINGÜE", issues: "Aggression|Puppy training|Obedience|Se habla español", proofValue: "2", proofLabel: "Trainers — English & Spanish", benefits: "Free evaluation|Military families welcome|90-day guarantee", priceMode: "quiet",
    arch: "mission", mk1: "#7E1F1F", mk2: "#D9A441",
    
    
      
    tint: "90,30,30",
    tint2: "200,120,30",
    hook: "Military family? Your training follows you — Lorenzo's has certified trainers in cities nationwide, so a PCS move never means starting over.",
    title: "San Antonio Dog Training",
    h1: "Aggression, Puppy Training & Obedience in San Antonio — Hablamos Español.",
    market: "San Antonio, TX",
    city: "San Antonio",
    state: "TX",
    area: "San Antonio, Castroville, Bear Creek, and surrounding Texas communities",
    trainers: "Giovanni Gutierrez and Carolina Perez",
    spanish: true,
    proof: "Texas dog owners can request a fast follow-up for obedience, behavior modification, and advanced training needs.",
    nearby: ["San Antonio", "Castroville", "Bear Creek", "Bexar County", "Medina County"],
    checks: ["Aggression, obedience, and puppy training — in English or Spanish", "Military families: your training follows you nationwide", "Se habla español — envíe su solicitud en español", "In-home and private options across the San Antonio area"],
    care: {"eyebrow": "Military & bilingual", "h2": "PCS orders don't restart your dog's training.", "p": "San Antonio is a military town — and Lorenzo's has certified trainers in cities nationwide. If you're stationed somewhere new tomorrow, your dog's program continues. And your whole request can happen in Spanish, from first form to final lesson.", "t": "Built for San Antonio families."},
    testis: [{"h": "Training that transfers", "p": "A nationwide trainer network means a military move never means starting over."}, {"h": "En español, de verdad", "p": "Envíe el formulario en español — un entrenador que habla español le da seguimiento."}, {"h": "One team, both languages", "p": "Same programs, same prices, same guarantee — in English or Spanish."}],
    zipCodes: ["78245", "78009"]
  },
  {
    slug: "dog-training-chicago-il",
    photoPos: "center 15%",
    photo2: "assets/get-started-premium-hero.jpg", photo2Alt: "Two dogs sitting calmly with their owner \u2014 the outcome of training",
    photo: "assets/emilio-yoyo.jpg", photoName: "Reactivity, handled safely", photoCaption: "Professional behavior work — this is the job", word: "THIS WEEK", issues: "Reactivity|Leash pulling|New puppy|Barking", proofValue: "No waitlist", proofLabel: "Start this week", benefits: "Free evaluation|No waitlist|90-day guarantee", priceMode: "quiet",
    arch: "metro", mk1: "#0B1B3F", mk2: "#D64545",
    
    
      
    tint: "10,30,80",
    tint2: "200,16,46",
    hook: "No waitlist. Evaluations available this week across Chicagoland.",
    title: "Chicago Dog Training",
    h1: "Reactive Dog? New Puppy? Chicago Dog Training With No Waitlist.",
    market: "Chicago, IL",
    city: "Chicago",
    state: "IL",
    area: "Chicago, Northwest Indiana, Gary, and surrounding communities",
    trainers: "Jasmine Bland",
    proof: "A Chicago-market page lets the office route leads from stronger ad territory while preserving trainer attribution.",
    nearby: ["Chicago", "Northwest Indiana", "Gary", "South Suburbs", "Chicagoland"],
    checks: ["Reactivity on busy streets — lunging, barking, pulling toward dogs", "Evaluations available this week across Chicagoland", "New puppy foundations before bad habits set", "In-home and private training options"],
    care: {"eyebrow": "No waitlist", "h2": "Why wait months to fix this week's problem?", "p": "Around Chicagoland, good trainers often book out for weeks. We keep evaluation slots open — tell us what's happening today and start this week, not next season.", "t": "Built for city dogs."},
    testis: [{"h": "Start this week", "p": "No waitlist. Your evaluation gets scheduled now, while the problem is fresh."}, {"h": "Reactivity is our daily work", "p": "Lunging and barking at dogs, bikes, and strangers — trainable, with a clear plan."}, {"h": "Real-life proofing", "p": "Training that holds on crowded sidewalks and busy streets, not just a quiet backyard."}],
    zipCodes: ["46409"]
  },
  {
    slug: "dog-training-tallahassee-fl",
    photo2: "assets/utility-retrieval.png", photo2Alt: "A dog carrying out a trained retrieval task with focus",
    photo: "assets/matthew-behavior-dog.jpg", photoName: "The tough cases", photoCaption: "Reactive and stubborn dogs are our specialty", word: "REACTIVE", issues: "Won't listen|Reactivity|Sound sensitivity|Leash pulling", proofValue: "Reactive dogs", proofLabel: "Our specialty", benefits: "Free evaluation|Reactivity specialists|90-day guarantee", priceMode: "forward",
    arch: "portrait2", mk1: "#A63D2F", mk2: "#1E4D45",
    
    
      
    tint: "110,45,20",
    tint2: "21,37,105",
    hook: "He knows the commands — he just won't listen. Reactivity and reliability are what we fix.",
    title: "Tallahassee Dog Training",
    h1: "Knows the Commands but Won't Listen? Tallahassee Reactive Dog Training.",
    market: "Tallahassee, FL",
    city: "Tallahassee",
    state: "FL",
    area: "Tallahassee, Leon County, North Florida, and surrounding communities",
    trainers: "Victoria Bayleigh Morris",
    proof: "Tallahassee is Victoria's active ad market for dog owners who need a clearer next step now.",
    nearby: ["Tallahassee", "Leon County", "North Florida", "Capital Region", "Thomasville Area"],
    checks: ["Knows the commands but won't listen? That's our specialty", "Reactivity, sound sensitivity, and leash pulling", "Obedience that holds around real distractions", "Free evaluation with a local trainer"],
    care: {"eyebrow": "Follow-through", "h2": "Commands aren't the problem. Follow-through is.", "p": "“He knows it — he just won't do it.” That's the most common thing Tallahassee owners tell us. Knowing a command and obeying it around distractions are two different skills, and the second one is what we train.", "t": "From knowing to doing."},
    testis: [{"h": "Proof it everywhere", "p": "Sit means sit in the yard, at the park, and with squirrels around — not just in the kitchen."}, {"h": "Reactivity work", "p": "Barking, lunging, and sound sensitivity addressed with a structured plan."}, {"h": "Reliability by design", "p": "Clear rules, consistent practice, owner coaching — reliability isn't luck."}],
    zipCodes: ["32504"]
  },
  {
    slug: "dog-training-miramar-beach-fl",
    photo2: "assets/get-started-premium-hero.jpg", photo2Alt: "Calm, trained dogs relaxing outside the house",
    photo: "assets/ad-testimonial-take-1-cover.png", photoName: "Vacation-ready", photoCaption: "Calm on the sand, welcome in the rental", word: "BEACH", issues: "Beach recall|Rental manners|Barking|Board & train", proofValue: "Fall slots", proofLabel: "Holiday board & train", benefits: "Free evaluation|Vacation-ready training|90-day guarantee", priceMode: "quiet",
    arch: "resort", mk1: "#0F8A9D", mk2: "#F2E9D8",
    
    
      
    tint: "10,90,120",
    tint2: "21,37,105",
    hook: "Vacation-ready: beach recall, restaurant manners, and a dog your rental will welcome back.",
    title: "Miramar Beach Dog Training",
    h1: "Beach Recall, Rental Manners & Board and Train — Emerald Coast Dog Training.",
    market: "Miramar Beach, FL",
    city: "Miramar Beach",
    state: "FL",
    area: "Miramar Beach, Destin, Santa Rosa Beach, 30A, Walton County, and nearby Emerald Coast communities",
    trainers: "Tabatha Shelley",
    proof: "Emerald Coast families can request obedience, behavior modification, puppy training, and specialty support through Lorenzo's office.",
    nearby: ["Miramar Beach", "Destin", "Santa Rosa Beach", "30A", "Walton County"],
    checks: ["Recall you can trust off the porch and on the sand", "Rental manners: no barking complaints, no chewed furniture", "Holiday board & train — slots fill 6–8 weeks ahead", "Puppy and obedience foundations year-round"],
    care: {"eyebrow": "Vacation-ready", "h2": "The beach is better with a dog who listens.", "p": "Emerald Coast life is patios, rentals, and open sand. We train the skills that make it easy — rock-solid recall, calm greetings, and manners your rental host will thank you for.", "t": "Trained for coast life."},
    testis: [{"h": "Beach recall", "p": "Coming when called even with birds, waves, and other dogs in play."}, {"h": "Rental-proof manners", "p": "Quiet, calm, and welcome back next season."}, {"h": "Holiday board & train", "p": "Drop off before the holidays, come home to a transformed dog. Book 6–8 weeks ahead."}],
    zipCodes: ["32405"]
  },
  {
    slug: "dog-training-lexington-ky",
    photo: "assets/facility-grounds-wide.jpg", photoName: "Room to run", photoCaption: "Recall that holds on open acreage", word: "FARM", issues: "Farm recall|Livestock manners|Leash pulling|Puppy", proofValue: "Open acreage", proofLabel: "Recall that holds", benefits: "Free evaluation|Farm & property dogs|90-day guarantee", priceMode: "quiet",
    arch: "heritage", mk1: "#234D32", mk2: "#B08A57",
    
    
      
    tint: "25,70,45",
    tint2: "21,37,105",
    hook: "Farm & property dogs: recall that holds on open acreage, and manners around horses and livestock.",
    title: "Lexington Dog Training",
    h1: "Recall That Fails in the Field? Chasing Horses? Lexington Farm & Property Dog Training.",
    market: "Lexington / Harrodsburg, KY",
    city: "Lexington",
    state: "KY",
    area: "Lexington, Harrodsburg, Mercer County, and Central Kentucky communities",
    trainers: "Bailey Brown",
    proof: "Kentucky dog owners can start with a simple request and let Lorenzo's office guide the follow-up.",
    nearby: ["Lexington", "Harrodsburg", "Mercer County", "Central Kentucky", "Bluegrass Region"],
    checks: ["Recall that holds across open acreage", "Calm, safe manners around horses and livestock", "Property boundaries without a fence line", "Puppy and obedience foundations for farm life"],
    care: {"eyebrow": "Farm & property dogs", "h2": "Town manners. Field reliability.", "p": "A farm dog needs more than sit and stay — recall across acreage, indifference to horses and livestock, and boundaries without fences. Bailey grew up with horses; this is training built around how Central Kentucky actually lives.", "t": "What farm-dog training covers."},
    testis: [{"h": "Distance recall", "p": "Reliable return from real distances, past real distractions."}, {"h": "Livestock neutrality", "p": "No chasing, no herding the horses, no drama at the barn."}, {"h": "Working boundaries", "p": "Your property line, respected — even when a rabbit crosses it."}],
    zipCodes: ["40330"]
  },
  {
    slug: "dog-training-ann-arbor-mi",
    photo: "assets/get-started-premium-hero.jpg", photoName: "Start them right", photoCaption: "New puppy, new rescue — the habits that last a lifetime", word: "PUPPY", issues: "Apartment barking|Potty training|Crate training|Leash skills", proofValue: "Apartment", proofLabel: "Friendly training plans", benefits: "Free evaluation|Small-space plans|90-day guarantee", priceMode: "forward",
    arch: "campus", mk1: "#1E3A8A", mk2: "#F0C93B",
    
    
      
    tint: "40,40,100",
    tint2: "200,16,46",
    hook: "Apartment-friendly puppy training — built for small spaces, shared walls, and busy schedules.",
    title: "Ann Arbor Dog Training",
    h1: "Puppy Peeing on the Floor? Barking Through the Walls? Ann Arbor Apartment Puppy Training.",
    market: "Ann Arbor, MI",
    city: "Ann Arbor",
    state: "MI",
    area: "Ann Arbor, Ypsilanti, Washtenaw County, and surrounding Southeast Michigan communities",
    trainers: "Dylan Atkinson",
    proof: "Michigan dog owners can request obedience, behavior modification, and real-world training help through Lorenzo's office-routed system.",
    nearby: ["Ann Arbor", "Ypsilanti", "Washtenaw County", "Southeast Michigan", "Canton"],
    checks: ["Accidents on the floor? Potty training on a schedule that works", "Barking through thin walls handled early", "Crate training without the crying", "Leash skills for busy sidewalks"],
    care: {"eyebrow": "Small spaces, big results", "h2": "Apartment life with a puppy can be calm.", "p": "Shared walls, no yard, a busy schedule — apartment puppy raising is its own skill. We build the routines that matter: potty on schedule, crate peace, quiet greetings, and leash skills for sidewalk life.", "t": "The first months, done right."},
    testis: [{"h": "Potty, solved", "p": "A schedule-based system that works without a backyard."}, {"h": "Neighbor-proof", "p": "Demand barking and door alarms quieted before they become habit."}, {"h": "Sidewalk skills", "p": "Loose-leash walking and calm greetings for a city full of people and dogs."}],
    zipCodes: ["48103", "48104", "48105", "48108", "48109"]
  }
];

const cacheVersion = "20260812marketoffers1";
const googleEndpoint = "https://docs.google.com/forms/d/e/1FAIpQLSdV1-0yBlRusq9tkjymZKm_BfXfpmMKDDrcyqfP3KbEq-Qd_g/formResponse";
const googleAdsId = "AW-11463464040";
const consultationConversion = "AW-11463464040/kLPdCPzSo4oaEOiomtoq";
const pdfConversion = "AW-11463464040/EkfvCK6B8o8ZEOiomtoq";
const attributionFields = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "landing_url"];

const escapeHtml = value => String(value || "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[char]));

const attributionInputs = () => attributionFields
  .map(name => `<input type="hidden" name="${name}" value="">`)
  .join("\n              ");

const googleAdsHead = () => `<script async src="https://www.googletagmanager.com/gtag/js?id=${googleAdsId}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${googleAdsId}');
  </script>`;

const conversionAndAttributionScript = () => `<script>
    (function(){
      const conversions = {
        consultation: '${consultationConversion}',
        pdf: '${pdfConversion}'
      };
      const sendConversion = function(sendTo, value){
        if (typeof window.gtag !== 'function') return;
        window.gtag('event', 'conversion', {
          send_to: sendTo,
          value: value,
          currency: 'USD'
        });
      };
      document.addEventListener('submit', function(event){
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (form.classList.contains('contact-intake')) sendConversion(conversions.consultation, 250);
        if (form.classList.contains('pdf-optin')) sendConversion(conversions.pdf, 25);
      }, true);
      document.addEventListener('DOMContentLoaded', function(){
        const params = new URLSearchParams(window.location.search);
        const values = {
          utm_source: params.get('utm_source') || '',
          utm_medium: params.get('utm_medium') || '',
          utm_campaign: params.get('utm_campaign') || '',
          utm_content: params.get('utm_content') || '',
          utm_term: params.get('utm_term') || '',
          gclid: params.get('gclid') || '',
          landing_url: window.location.href
        };
        Object.entries(values).forEach(function(entry){
          document.querySelectorAll('input[name="' + entry[0] + '"]').forEach(function(input){
            input.value = entry[1];
          });
        });
      });
    })();
  </script>`;

const FLOWS = {
  "dog-training-san-diego-ca": ["pricing", "proof", "path", "care", "testi", "guide", "cta"],
  "dog-training-columbus-oh": ["care", "proof", "path", "pricing", "testi", "guide", "cta"],
  "dog-training-chicago-il": ["care", "path", "proof", "pricing", "testi", "cta"],
  "dog-training-tallahassee-fl": ["care", "proof", "path", "pricing", "testi", "guide", "cta"],
  "dog-training-atlanta-ga": ["path", "care", "proof", "pricing", "testi", "guide", "cta"],
  "dog-training-miramar-beach-fl": ["care", "path", "pricing", "proof", "testi", "guide", "cta"],
  "dog-training-ann-arbor-mi": ["care", "path", "proof", "pricing", "testi", "cta"],
  default: ["proof", "path", "pricing", "care", "testi", "guide", "cta"]
};

const casePanels = {
  "dog-training-san-diego-ca": `<div class="market-hero-media market-case-panel case-price">
          <span class="case-kicker">Published pricing</span>
          <div class="case-price-row"><span class="case-price-big"><sup>$</sup>1,250</span><span class="case-price-label">Professional training<br>starting at</span></div>
          <div class="case-price-row"><span class="case-price-big"><sup>$</sup>2,500</span><span class="case-price-label">Board &amp; train<br>starting at</span></div>
          <p class="case-note">No mystery quotes. No sales appointment. A free evaluation and a price you already know.</p>
          <a class="btn market-primary-cta" href="#consultation">Book the Free Evaluation</a>
        </div>`,
  "dog-training-san-antonio-tx": `<div class="market-hero-media market-case-panel case-bilingual">
          <span class="case-kicker">Se habla español</span>
          <p class="case-big" lang="es">Hablamos español.</p>
          <p class="case-note" lang="es">Envíe su solicitud en español — un entrenador que habla español le da seguimiento.</p>
          <p class="case-note">Same programs, same prices, same guarantee — in English or Spanish.</p>
          <div class="case-divider" aria-hidden="true"></div>
          <span class="case-kicker">Military families</span>
          <p class="case-note"><b>PCS orders?</b> Lorenzo&rsquo;s has certified trainers in cities nationwide — your dog&rsquo;s training follows you.</p>
        </div>`,
  "dog-training-ann-arbor-mi": `<div class="market-hero-media market-case-panel case-puppy">
          <span class="case-kicker">The apartment puppy plan</span>
          <ul class="case-list">
            <li>Potty on a schedule — no yard needed</li>
            <li>Crate calm, without the crying</li>
            <li>Quiet through shared walls</li>
            <li>Loose leash on busy sidewalks</li>
          </ul>
          <p class="case-note">Built for small spaces and real schedules.</p>
          <a class="btn market-primary-cta" href="#consultation">Start With a Free Evaluation</a>
        </div>`
};

const page = market => {
  const metaDescription = `Request ${market.market} dog training from Lorenzo's Dog Training Team. Obedience training, puppy training, dog behavior modification, and advanced programs with office-routed follow-up.`;
  const nearby = market.nearby.map(place => `<span>${escapeHtml(place)}</span>`).join("");
  const zipCodes = market.zipCodes.map(zip => `<span>${escapeHtml(zip)}</span>`).join("");
  const SEC = {
    proof: `    <section class="ad-proof-band-v2">
      <div class="container ad-proof-grid-v2">
        <div><strong>39</strong><span>Years of experience</span></div>
        <div><strong>100,000+</strong><span>Dogs trained of all breeds</span></div>
        <div><strong>50+</strong><span>Professional trainers nationwide</span></div>
        <div><strong>${escapeHtml(market.proofValue)}</strong><span>${escapeHtml(market.proofLabel)}</span></div>
      </div>
    </section>`,
    path: `    <section id="market-services" class="section market-path-section">
      <div class="container market-section-grid">
        <div>
          <span class="eyebrow">Training built for real life</span>
          <h2>One request. A clearer path for your dog.</h2>
          <p>${escapeHtml(market.proof)}</p>
          <div class="market-nearby">${nearby}</div>
        </div>
        <div class="ad-service-grid-v2 market-service-grid">
          <article>
            <span>01</span>
            <h3>Dog Obedience Training</h3>
            <p>Practical obedience that helps your dog listen in the moments that matter: at home, on walks, around people, and around distractions. In-home and private dog training options available.${market.priceMode === "forward" ? " From $1,250." : ""}</p>
          </article>
          <article>
            <span>02</span>
            <h3>Behavior Modification</h3>
            <p>Balanced training support for aggression, reactivity, barking, pulling, jumping, anxiety, and house-soiling with owner guidance built in.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Specialty & Service Dog Training</h3>
            <p>Outcome-based support for protection, service and assistance needs, scent work, utility training, retrieval, and advanced control.</p>
          </article>
          <article>
            <span>04</span>
            <h3>Board &amp; Train</h3>
            <p>Your dog trains with a professional and comes home with real skills — with owner handoff lessons included.${market.priceMode === "forward" ? " From $2,500." : ""} Fall and holiday slots fill 6–8 weeks ahead.</p>
          </article>
        </div>
      </div>
    </section>`,
    pricing: market.priceMode === "forward" ? `
    <section class="section market-pricing price-forward">
      <div class="container">
        <p class="price-kicker">Most trainers make you call for a quote.</p>
        <h2 class="price-punch">We&rsquo;ll just tell you.</h2>
        <div class="price-row">
          <div class="price-block">
            <span class="price-label">Professional training</span>
            <span class="price-big"><sup>$</sup>1,250</span>
            <span class="price-sub">starting at &middot; obedience, behavior &amp; puppy programs</span>
          </div>
          <div class="price-divider" aria-hidden="true"></div>
          <div class="price-block">
            <span class="price-label">Training + boarding</span>
            <span class="price-big"><sup>$</sup>2,500</span>
            <span class="price-sub">starting at &middot; trains with a pro, comes home transformed</span>
          </div>
        </div>
        <div class="gpanel">
          <div class="g90" aria-hidden="true"><span class="g90-num">90</span><span class="g90-day">DAY</span></div>
          <div class="gcopy">
            <span class="g-eyebrow">The LDTT Limited Training Guarantee</span>
            <h2>We stand behind our training.</h2>
            <p>Every LDTT program includes our Limited Training Guarantee. If your dog is not demonstrating the behaviors addressed in your training program within 90 days of completing it, contact us &mdash; when you&rsquo;ve followed your trainer&rsquo;s instructions and practice plan, we provide corrective instruction or follow-up training at <b>no additional training fee</b>.</p>
            <p class="g-commit">Our commitment is simple: we do our part, and we show you how to do yours.</p>
          </div>
          <a class="gcta" href="#consultation">Get My Free Evaluation <span aria-hidden="true">&rarr;</span></a>
        </div>
      </div>
    </section>` : `
    <section class="section market-pricing price-quiet">
      <div class="container">
        <div class="gpanel gpanel-lead">
          <div class="g90" aria-hidden="true"><span class="g90-num">90</span><span class="g90-day">DAY</span></div>
          <div class="gcopy">
            <span class="g-eyebrow">The LDTT Limited Training Guarantee</span>
            <h2>We stand behind our training &mdash; in writing.</h2>
            <p>Every LDTT program includes our Limited Training Guarantee. If your dog is not demonstrating the behaviors addressed in your training program within 90 days of completing it, contact us &mdash; when you&rsquo;ve followed your trainer&rsquo;s instructions and practice plan, we provide corrective instruction or follow-up training at <b>no additional training fee</b>.</p>
            <p class="g-commit">Our commitment is simple: we do our part, and we show you how to do yours.</p>
          </div>
          <a class="gcta" href="#consultation">Get My Free Evaluation <span aria-hidden="true">&rarr;</span></a>
        </div>
      </div>
    </section>`,
    care: `    <section class="market-care-section section">
      <div class="container market-care-grid">
        <div>
          <span class="eyebrow">${escapeHtml(market.care.eyebrow)}</span>
          <h2>${escapeHtml(market.care.h2)}</h2>
        </div>
        <div class="market-care-copy">
          <p>${escapeHtml(market.care.p)}</p>
          <a class="btn btn-secondary" href="#consultation">Book My Consultation</a>
        </div>
        ${market.photo2 ? `<figure class="market-care-photo"><img src="${escapeHtml(market.photo2)}" alt="${escapeHtml(market.photo2Alt)}" style="object-position:${market.photo2Pos || "center"}" loading="lazy" decoding="async"></figure>` : ""}
      </div>
    </section>`,
    testi: `    <section class="market-testimonial-section section">
      <div class="container">
        <div class="market-section-heading">
          <span class="eyebrow">Trusted by dog owners</span>
          <h2>${escapeHtml(market.care.t)}</h2>
        </div>
        <div class="market-testimonial-grid">
          ${market.testis.map((t, i) => `<article><div class="market-proof-icon" aria-hidden="true">0${i + 1}</div><h3>${escapeHtml(t.h)}</h3><p>${escapeHtml(t.p)}</p></article>`).join("\n          ")}
        </div>
      </div>
    </section>`,
    guide: `    <section id="free-ebook" class="market-guide-section market-guide-strip section">
      <div class="container market-guide-card market-guide-mini">
        <div>
          <span class="eyebrow">Free PDF Guide</span>
          <h2>Not ready to talk yet? Get the free guide.</h2>
          <p><strong>The 5-Step Calm Dog Blueprint</strong> gives owners a simple daily foundation for focus, obedience, and calmer behavior before problems get worse.</p>
        </div>
        <form class="market-guide-form pdf-optin" novalidate>
          <label><span>First name</span><input name="first_name" autocomplete="given-name" placeholder="First name" required></label>
          <label><span>Email address</span><input type="email" name="email" autocomplete="email" placeholder="you@example.com" required></label>
          <label class="consent-row sms-opt-in"><input type="checkbox" name="sms_consent" value="yes"><span>By checking this box, I agree to receive recurring promotional and informational text messages from Lorenzo&rsquo;s Dog Training Team about dog training tips, consultation scheduling, follow-up, and offers. Messages may be sent via autodialer. Consent is not a condition of any purchase or services. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe and HELP for help. I also agree to the <a href="/terms.html">Terms of Service</a> and <a href="/privacy-policy.html">Privacy Policy</a>.</span></label>
          <a class="market-guide-download" href="assets/calm-dog-blueprint-final.pdf" download aria-hidden="true" tabindex="-1">Download the Free Guide</a>
          <button class="btn" type="submit">Download the Free Guide</button>
          <p class="market-guide-status" role="status" aria-live="polite"></p>
        </form>
      </div>
    </section>`,
    cta: `    <section class="section tight">
      <div class="container">
        <div class="cta-band ad-cta-v2">
          <div>
            <h2>Need dog training in ${escapeHtml(market.market)}?</h2>
            <p>Submit the quick request and let Lorenzo's office help with the next step.</p>
          </div>
          <a class="btn btn-red" href="#consultation">Book My Consultation</a>
        </div>
      </div>
    </section>`
  };
  const flow = FLOWS[market.slug] || FLOWS.default;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(market.title)} | Lorenzo's Dog Training Team</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">
  <link rel="canonical" href="https://www.lorenzosdogtrainingteam.com/${escapeHtml(market.slug)}">
  <link rel="icon" type="image/png" href="assets/ldtt-favicon.png">
  <link rel="apple-touch-icon" href="assets/ldtt-favicon.png">
  <link rel="stylesheet" href="styles.css?v=${cacheVersion}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(market.title)} | Lorenzo's Dog Training Team">
  <meta property="og:description" content="${escapeHtml(metaDescription)}">
  <meta property="og:url" content="https://www.lorenzosdogtrainingteam.com/${escapeHtml(market.slug)}">
  <meta property="og:image" content="https://www.lorenzosdogtrainingteam.com/assets/get-started-premium-hero.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: `Lorenzo's Dog Training Team — ${market.market}`,
    url: `https://www.lorenzosdogtrainingteam.com/${market.slug}`,
    telephone: "+1-866-436-4959",
    priceRange: "$1,250+",
    address: { "@type": "PostalAddress", addressLocality: market.city, addressRegion: market.state, addressCountry: "US" },
    areaServed: market.nearby,
    description: metaDescription
  })}</script>
  ${googleAdsHead()}
  <style>
    .market-copy .ad-lead.market-hook{border-left:4px solid #c8102e;background:rgba(200,16,46,.07);padding:10px 14px;border-radius:0 10px 10px 0;font-size:1.02em}
    .market-spanish{border-left:4px solid #152569;background:rgba(21,37,105,.06);padding:10px 14px;border-radius:0 10px 10px 0}
    .market-pricing h2{margin-top:6px}
    .market-pricing .market-service-grid article{border-top:4px solid #c8102e}
    .market-pricing .market-service-grid article span{color:#c8102e;font-weight:800}
    /* The hero grid stacks very tall on mobile; the bg photo was stretching to
       fill it (2,400px+ from a 945px asset) and the tint darkened the whole
       column including the form. Cap both to the top, fade them out, and let
       each archetype's solid background carry the rest. */
    .market-hero{isolation:isolate}
    .market-hero-bg,.market-tint{top:0;bottom:auto;height:720px;max-height:100%;
      -webkit-mask-image:linear-gradient(180deg,#000 55%,transparent);
      mask-image:linear-gradient(180deg,#000 55%,transparent)}
    .market-hero-bg{object-fit:cover;object-position:center top}
    .market-tint{position:absolute;inset:0 0 auto 0;pointer-events:none;mix-blend-mode:multiply}
    /* rhythm: consistent gaps between hook / spanish / lead strips */
    .market-copy .ad-lead{margin:14px 0 0}
    .market-copy h1{margin-bottom:4px}
    .market-pricing{padding-top:34px;padding-bottom:10px}
    .market-pricing .cta-band{margin-top:20px}
    .market-trainer-media img{width:100%;height:100%;min-height:280px;object-fit:cover;object-position:top center;display:block}
    .market-trainer-media figcaption strong{display:block}

    /* ═══ per-market design archetypes ═══ */
    /* HQ — Cleveland: navy ground, the facility as a full-width banner */
    .arch-hq .market-hero{background:var(--mk1)}
    .arch-hq .market-hero-bg{opacity:.14}
    .arch-hq .market-copy h1,.arch-hq .market-copy .ad-lead{color:#fff}
    .arch-hq .market-copy .ad-lead.market-hook{background:rgba(255,255,255,.1);color:#fff;border-left-color:var(--mk2)}
    .arch-hq .market-trainer-media{min-height:0;height:300px;overflow:hidden;border:6px solid #fff;border-radius:16px;box-shadow:0 24px 56px rgba(0,0,0,.4)}
    .arch-hq .ad-checks-v2 li{color:#dfe4f5}

    /* PORTRAIT — Columbus: warm parchment, wine accents, framed trainer */
    .arch-portrait .market-hero{background:linear-gradient(180deg,#FBF8F2,var(--mk2))}
    .arch-portrait .market-copy h1{color:var(--mk1);text-transform:none;letter-spacing:0}
    .arch-portrait .market-trainer-media{border:1px solid var(--mk1);border-radius:16px;overflow:hidden;box-shadow:12px 12px 0 var(--mk1)}
    .arch-portrait .market-hook{border-left-color:var(--mk1);background:#fff}
    .arch-portrait .ad-proof-band-v2{background:var(--mk1)}

    /* METRO — Chicago: midnight panel, giant type, tilted polaroid */
    .arch-metro .market-hero{background:linear-gradient(120deg,var(--mk1) 0%,#122a55 70%)}
    .arch-metro .market-hero-bg{opacity:.1}
    .arch-metro .market-copy h1{color:#fff;font-size:clamp(34px,5vw,54px);letter-spacing:-.03em}
    .arch-metro .market-copy .ad-lead{color:#c9d4ef}
    .arch-metro .market-copy .ad-lead.market-hook{background:var(--mk2);color:#fff;border-left-color:#fff}
    .arch-metro .market-trainer-media{transform:rotate(-2deg);border:10px solid #fff;box-shadow:0 22px 45px rgba(0,0,0,.45)}
    .arch-metro .ad-checks-v2 li{color:#dfe6f8}

    /* SPECIALTY — Atlanta: near-black, gold detailing, premium quiet */
    .arch-specialty .market-hero{background:var(--mk1)}
    .arch-specialty .market-hero-bg{opacity:.08}
    .arch-specialty .market-copy h1{color:#fff;letter-spacing:.02em}
    .arch-specialty .market-copy .ad-lead{color:#cfc9de}
    .arch-specialty .market-copy .ad-lead.market-hook{background:transparent;border:1px solid var(--mk2);border-left:4px solid var(--mk2);color:var(--mk2)}
    .arch-specialty .ad-rating-row span{color:var(--mk2)}
    .arch-specialty .market-trainer-media{border:1px solid var(--mk2);padding:8px;background:var(--mk1)}
    .arch-specialty .ad-checks-v2 li{color:#d8d3e6}

    /* COAST — San Diego: white air, ocean blue, soft pill geometry */
    .arch-coast .market-hero{background:linear-gradient(180deg,#fff,var(--mk2))}
    .arch-coast .market-copy h1{color:var(--mk1);text-transform:none}
    .arch-coast .market-trainer-media{border-radius:28px;overflow:hidden;border:4px solid #fff;box-shadow:0 16px 36px rgba(14,94,138,.25)}
    .arch-coast .market-hook{border-radius:999px;border-left:none;border:2px solid var(--mk1);background:#fff;padding:12px 20px}
    .arch-coast .ad-benefit-row span{border-radius:999px;background:var(--mk1);color:#fff;padding:4px 12px}

    /* MISSION — San Antonio: deep red + gold, bilingual up front */
    .arch-mission .market-hero{background:linear-gradient(135deg,var(--mk1),#4d1414)}
    .arch-mission .market-hero-bg{opacity:.12}
    .arch-mission .market-copy h1,.arch-mission .market-copy .ad-lead{color:#fff}
    .arch-mission .market-copy .ad-lead.market-hook{background:rgba(217,164,65,.15);border-left-color:var(--mk2);color:#ffe9c4}
    .arch-mission .market-spanish{background:var(--mk2);border-left-color:#fff;color:var(--mk1);font-weight:700}
    .arch-mission .market-trainer-media{border:6px double var(--mk2)}
    .arch-mission .ad-checks-v2 li{color:#f4dfd0}

    /* HERITAGE — Lexington: hunter green + saddle tan, farm-plate frame */
    .arch-heritage .market-hero{background:linear-gradient(180deg,#F7F4EC,#EDE6D6)}
    .arch-heritage .market-copy h1{color:var(--mk1);text-transform:none;letter-spacing:0}
    .arch-heritage .market-hook{border-left-color:var(--mk1);background:#fff}
    .arch-heritage .market-trainer-media{border:4px solid var(--mk1);outline:2px solid var(--mk2);outline-offset:5px}
    .arch-heritage .ad-proof-band-v2{background:var(--mk1)}
    .arch-heritage .visit,.arch-heritage .btn-red{background:var(--mk1)}

    /* PORTRAIT² — Tallahassee: coral + palm, mirrored composition */
    .arch-portrait2 .market-hero{background:linear-gradient(180deg,#FDF6F1,#F6E7DF)}
    .arch-portrait2 .market-trainer-media{border-radius:0 60px 0 60px;overflow:hidden;border:3px solid var(--mk2)}
    .arch-portrait2 .market-copy h1{color:var(--mk2);text-transform:none}
    .arch-portrait2 .market-hook{border-left-color:var(--mk1);background:#fff}

    /* RESORT — Miramar: aqua band over sand, holiday postcard */
    .arch-resort .market-hero{background:linear-gradient(180deg,var(--mk1) 0 46%,var(--mk2) 46%)}
    .arch-resort .market-hero-bg{opacity:.1}
    .arch-resort .market-copy h1{color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.25)}
    .arch-resort .market-copy .ad-lead{color:#eafcff}
    .arch-resort .market-copy .ad-lead.market-hook{background:#fff;color:var(--mk1);border-left-color:var(--mk1)}
    .arch-resort .market-trainer-media{border:8px solid #fff;border-bottom-width:30px;box-shadow:0 16px 34px rgba(0,0,0,.28);transform:rotate(1.5deg)}

    /* CAMPUS — Ann Arbor: clean white, blue + maize underline energy */
    .arch-campus .market-hero{background:#fff}
    .arch-campus .market-copy h1{color:var(--mk1);text-transform:none}
    .arch-campus .market-copy h1::after{content:"";display:block;width:110px;height:8px;background:var(--mk2);margin-top:10px}
    .arch-campus .market-hook{border-left-color:var(--mk1);background:#F6F8FE}
    .arch-campus .market-trainer-media{border-radius:12px;overflow:hidden;border:3px solid var(--mk1)}
    .arch-campus .ad-proof-band-v2{background:var(--mk1)}

    /* Light archetypes are truly light now: no dark hero photo, no tint.
       Ink floors for every element that styles.css designed for dark grounds. */
    .arch-portrait .market-hero-bg,.arch-portrait .market-tint,
    .arch-heritage .market-hero-bg,.arch-heritage .market-tint,
    .arch-coast .market-hero-bg,.arch-coast .market-tint,
    .arch-campus .market-hero-bg,.arch-campus .market-tint,
    .arch-portrait2 .market-hero-bg,.arch-portrait2 .market-tint{display:none}
    .arch-portrait .market-hero::before,.arch-portrait .market-hero::after,
    .arch-heritage .market-hero::before,.arch-heritage .market-hero::after,
    .arch-coast .market-hero::before,.arch-coast .market-hero::after,
    .arch-campus .market-hero::before,.arch-campus .market-hero::after,
    .arch-portrait2 .market-hero::before,.arch-portrait2 .market-hero::after{display:none !important}
    .arch-portrait .market-copy .ad-lead,.arch-heritage .market-copy .ad-lead,
    .arch-coast .market-copy .ad-lead,.arch-campus .market-copy .ad-lead,
    .arch-portrait2 .market-copy .ad-lead{color:#3c4258}
    .arch-portrait .ad-checks-v2 li,.arch-heritage .ad-checks-v2 li,
    .arch-coast .ad-checks-v2 li,.arch-campus .ad-checks-v2 li,
    .arch-portrait2 .ad-checks-v2 li{color:#3c4258}
    .arch-portrait .ad-rating-row,.arch-heritage .ad-rating-row,.arch-coast .ad-rating-row,
    .arch-campus .ad-rating-row,.arch-portrait2 .ad-rating-row{
      background:rgba(19,26,51,.06);border-color:rgba(19,26,51,.14);box-shadow:none}
    .arch-portrait .ad-rating-row strong,.arch-heritage .ad-rating-row strong,
    .arch-coast .ad-rating-row strong,.arch-campus .ad-rating-row strong,
    .arch-portrait2 .ad-rating-row strong{color:#131a33}
    .arch-portrait .ad-issue-strip span,.arch-heritage .ad-issue-strip span,
    .arch-coast .ad-issue-strip span,.arch-campus .ad-issue-strip span,
    .arch-portrait2 .ad-issue-strip span{
      background:rgba(19,26,51,.05);border:1px solid rgba(19,26,51,.16);color:#131a33}
    .arch-portrait .market-text-link,.arch-heritage .market-text-link,
    .arch-coast .market-text-link,.arch-campus .market-text-link,
    .arch-portrait2 .market-text-link{color:var(--mk1)}

    /* ═══ pricing + guarantee, premium treatment ═══ */
    .market-pricing{padding:64px 0 46px}
    .price-kicker{margin:0;font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:#8a90a4;font-weight:700}
    .price-punch{margin:4px 0 34px;font-size:clamp(34px,5vw,56px);font-weight:900;letter-spacing:-.025em;color:var(--mk1)}
    .price-row{display:flex;align-items:stretch;gap:clamp(20px,5vw,56px);flex-wrap:wrap;margin-bottom:40px}
    .price-block{flex:1;min-width:240px}
    .price-divider{width:1px;background:linear-gradient(180deg,transparent,var(--mk1) 30% 70%,transparent);align-self:stretch}
    .price-label{display:block;font-size:12.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--mk1);
      border-top:4px solid var(--mk1);padding-top:14px}
    .price-big{display:block;font-size:clamp(56px,9vw,96px);font-weight:900;letter-spacing:-.04em;line-height:1.02;
      color:#141826;font-variant-numeric:tabular-nums}
    .price-big sup{font-size:.45em;font-weight:800;vertical-align:super;color:var(--mk1);margin-right:2px}
    .price-sub{display:block;font-size:14px;color:#5c6275;max-width:34ch}

    /* the guarantee: one confident panel, giant 90, no clip-art badge */
    .gpanel{position:relative;display:flex;align-items:center;gap:clamp(20px,4vw,44px);flex-wrap:wrap;
      background:radial-gradient(120% 160% at 8% 0%,rgba(255,255,255,.10),transparent 46%),
                 linear-gradient(135deg,var(--mk1),#0e1430 88%);
      padding:clamp(26px,4vw,44px);outline:1px solid rgba(255,255,255,.22);outline-offset:-10px}
    .g90{flex:none;display:flex;flex-direction:column;align-items:center;line-height:.85;padding-right:6px}
    .g90-num{font-size:clamp(84px,10vw,132px);font-weight:900;letter-spacing:-.05em;color:#fff}
    .g90-day{font-size:clamp(15px,1.8vw,20px);font-weight:900;letter-spacing:.5em;color:var(--mk2,#c8102e);
      margin-top:6px;text-indent:.5em}
    .gcopy{flex:1;min-width:280px}
    .g-eyebrow{display:block;font-size:12px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.65);margin-bottom:8px}
    .gpanel h2{margin:0 0 12px;color:#fff;font-size:clamp(24px,3.2vw,34px);font-weight:900;letter-spacing:-.02em;line-height:1.12;text-wrap:balance}
    .gpanel p{margin:0;color:#d9def0;font-size:15.5px;line-height:1.62;max-width:60ch}
    .gpanel p b{color:#fff}
    .g-commit{margin-top:12px !important;font-style:italic;color:#c3cae6 !important;font-size:14px !important}
    .g-price-line{margin-top:14px !important;font-size:13.5px !important;color:#aab3d6 !important;
      border-top:1px solid rgba(255,255,255,.18);padding-top:14px}
    .gcta{flex:none;align-self:center;background:#fff;color:#141826;text-decoration:none;font-weight:800;
      font-size:16px;padding:16px 28px;letter-spacing:.01em;box-shadow:0 14px 34px rgba(0,0,0,.35);
      transition:transform .18s ease,box-shadow .18s ease}
    .gcta:hover{transform:translateY(-2px);box-shadow:0 20px 44px rgba(0,0,0,.4)}
    .gcta:focus-visible{outline:3px solid var(--mk2,#c8102e);outline-offset:3px}
    .gcta span{color:var(--mk2,#c8102e)}
    @media(max-width:760px){
      .price-divider{display:none}
      .gpanel{outline-offset:-7px}
      .g90{flex-direction:row;align-items:baseline;gap:10px}
      .g90-day{margin-top:0}
      .gcta{width:100%;text-align:center}
    }

    /* ═══ per-archetype LAYOUT — composition differs, not just color ═══ */
    /* HQ: facility banner on top, then copy | form; proof as 2x2 plaque grid */
    .arch-hq .ad-proof-grid-v2{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#c8102e}
    .arch-hq .ad-proof-grid-v2 > div{background:var(--mk1);padding:22px}
    .arch-hq .market-service-grid{grid-template-columns:repeat(4,1fr)}

    /* PORTRAIT twins: services become a vertical numbered timeline */
    .arch-portrait .market-service-grid,.arch-portrait2 .market-service-grid{display:block;border-left:3px solid var(--mk1);padding-left:22px}
    .arch-portrait .market-service-grid article,.arch-portrait2 .market-service-grid article{
      position:relative;margin:0 0 26px;background:transparent;border:none;box-shadow:none;padding:0}
    .arch-portrait .market-service-grid article span,.arch-portrait2 .market-service-grid article span{
      position:absolute;left:-38px;top:0;background:var(--mk1);color:#fff;width:30px;height:30px;
      display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:13px;font-weight:800}

    /* METRO: form moves LEFT of the copy on desktop; proof is one dark ticker row */
    .arch-metro .ad-proof-band-v2{background:#070f24}
    .arch-metro .ad-proof-grid-v2{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
    .arch-metro .ad-proof-grid-v2 > div{display:flex;align-items:baseline;gap:8px;padding:14px 8px}
    .arch-metro .ad-proof-grid-v2 strong{font-size:30px}

    /* SPECIALTY: editorial single-column services, centered, gold rules */
    .arch-specialty .market-service-grid{display:block;max-width:640px;margin:0 auto}
    .arch-specialty .market-service-grid article{background:transparent;border:none;border-bottom:1px solid var(--mk2);
      border-radius:0;text-align:center;padding:26px 8px}
    .arch-specialty .market-service-grid article span{color:var(--mk2);letter-spacing:.3em}
    .arch-specialty .ad-proof-band-v2{background:#0d0a16;border-block:1px solid var(--mk2)}

    /* COAST + RESORT: proof stats as floating pills, services rounded */
    .arch-coast .ad-proof-band-v2,.arch-resort .ad-proof-band-v2{background:transparent}
    .arch-coast .ad-proof-grid-v2 > div,.arch-resort .ad-proof-grid-v2 > div{
      background:var(--mk1);color:#fff;border-radius:999px;padding:14px 22px;text-align:center}
    .arch-coast .ad-proof-grid-v2,.arch-resort .ad-proof-grid-v2{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
    .arch-coast .ad-proof-grid-v2 strong,.arch-resort .ad-proof-grid-v2 strong{color:#fff}
    .arch-coast .market-service-grid article,.arch-resort .market-service-grid article{border-radius:22px}

    /* MISSION: proof plaque framed in gold; issue chips gold */
    .arch-mission .ad-proof-band-v2{background:var(--mk1);border-block:3px double var(--mk2)}
    .arch-mission .ad-issue-strip span{background:rgba(217,164,65,.18);border:1px solid var(--mk2)}

    /* HERITAGE: services as a stable-plate list, tan rules */
    .arch-heritage .market-service-grid{display:block}
    .arch-heritage .market-service-grid article{background:#fff;border:none;border-left:6px solid var(--mk1);
      border-bottom:1px solid var(--mk2);border-radius:0;margin-bottom:14px}

    /* CAMPUS: form LEFT like metro, services 2-col checklist */
    .arch-campus .market-service-grid{grid-template-columns:1fr 1fr}
    .arch-campus .market-service-grid article{border:none;border-top:4px solid var(--mk2);background:#F7F9FF}

    /* giant market word — personality, not decoration: names the page's mission */
    .market-copy{position:relative}
    .market-word{position:absolute;top:-18px;left:-6px;font-size:clamp(64px,11vw,150px);font-weight:900;
      letter-spacing:-.04em;line-height:1;color:transparent;-webkit-text-stroke:2px rgba(255,255,255,.16);
      pointer-events:none;user-select:none;white-space:nowrap;z-index:0}
    .market-copy > *:not(.market-word){position:relative;z-index:1}

    /* red-on-red repair: red-family markets get contrast CTAs */
    .arch-mission .btn-red,.arch-mission .price-cta,.arch-mission .market-primary-cta{background:#D9A441 !important;color:#3a2408 !important}
    .arch-portrait .btn-red,.arch-portrait .price-cta,.arch-portrait .market-primary-cta{background:#152569 !important;color:#fff !important}
    .arch-portrait2 .btn-red,.arch-portrait2 .price-cta,.arch-portrait2 .market-primary-cta{background:#1E4D45 !important;color:#fff !important}
    .arch-mission .market-hook{color:#ffe9c4}

    /* ═══ READABILITY FLOOR — wins over every other layer, including runtime CSS ═══ */
    /* 1) The consultation form is sacred: always a white card with ink text,
       whatever the page theme or injected styles say. */
    .market-consult-panel{background:#fff !important;border-radius:14px;box-shadow:0 18px 48px rgba(10,16,40,.25)}
    .market-consult-panel .ad-consult-header{background:none !important;background-image:none !important}
    .market-consult-panel .ad-consult-header span{color:#c8102e !important}
    .market-consult-panel .ad-consult-header h2{color:#131a33 !important}
    .market-consult-panel .ad-consult-header p,
    .market-consult-panel label,
    .market-consult-panel .consent-row span,
    .market-consult-panel .form-disclaimer,
    .market-consult-panel form small{color:#3c4258 !important}
    .market-consult-panel input,.market-consult-panel select,.market-consult-panel textarea{
      background:#fff !important;color:#131a33 !important;border:1px solid #c9cede !important}
    .market-consult-panel button[type="submit"]{color:#fff !important}

    /* 2) Sections injected below the fold were designed for a dark page.
       Give them that dark ground on every archetype — in the market's own navy. */
    .market-care-section,.market-testimonial-section,.market-guide-section{
      background:linear-gradient(170deg,var(--mk1) 0%,#10182e 100%) !important}
    .market-care-section h2,.market-care-section h3,.market-care-section p,
    .market-testimonial-section h2,.market-testimonial-section h3,.market-testimonial-section p,
    .market-guide-section h2,.market-guide-section p{color:#fff}
    .market-care-section p,.market-testimonial-section p,.market-guide-section p{color:#dfe4f5}
    .market-guide-section .market-guide-form,.market-guide-form{background:#fff !important;border-radius:12px;padding:18px}
    .market-guide-form label,.market-guide-form span{color:#3c4258 !important}
    .market-guide-form input{background:#fff !important;color:#131a33 !important;border:1px solid #c9cede !important}

    /* 3b) Closing CTA band: always the market navy, never washed out. */
    .market-landing .cta-band{background:linear-gradient(135deg,var(--mk1),#0e1430) !important;border-radius:16px}
    .market-landing .cta-band h2,.market-landing .cta-band p{color:#fff !important}
    .market-landing .cta-band p{color:#d9def0 !important}

    /* 3) The guarantee band must always be dark — solid color first, gradient second. */
    .guarantee-band{background-color:var(--mk1) !important}
    .guarantee-band h2,.guarantee-band p,.guarantee-band b{color:#fff !important}
    .guarantee-band .price-quiet-line{color:#d9def2 !important}

    /* 4) Responsive floors: nothing crushes on small screens. */
    .arch-hq .market-service-grid{grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}
    .arch-campus .market-service-grid{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
    @media(max-width:700px){
      .market-word{font-size:clamp(44px,15vw,80px);top:-8px}
      .price-big{font-size:clamp(40px,12vw,56px)}
      .guarantee-band{padding:20px 18px}
      .g-badge{width:80px;height:80px;font-size:13px}
    }

    /* 5) The market word must be visible on light heroes too. */
    .arch-portrait .market-word,.arch-heritage .market-word,.arch-coast .market-word,
    .arch-campus .market-word,.arch-portrait2 .market-word{-webkit-text-stroke:2px rgba(19,26,51,.14)}

    /* ═══ hero video card — static, self-contained (styles.css only styles it
       under funnel-redesign scopes that market pages never carry) ═══ */
    .market-landing .ad-hero-video-card{min-height:0;border:0;border-radius:16px;background:#fff;
      padding:10px 10px 14px;box-shadow:0 20px 50px rgba(10,16,40,.32);align-self:start}
    .market-landing .ad-hero-video-card .ad-video-frame{position:relative;border-radius:10px;overflow:hidden;background:#071a34}
    .market-landing .ad-hero-video-card video{width:100%;display:block;aspect-ratio:16/9;object-fit:cover;background:#000}
    .market-landing .ad-hero-video-card .ad-video-cover{position:absolute;inset:0;z-index:2;display:block;width:100%;
      border:0;padding:0;margin:0;background:none;cursor:pointer}
    .market-landing .ad-hero-video-card .ad-video-cover img{width:100%;height:100%;object-fit:cover;display:block}
    .market-landing .ad-hero-video-card .ad-video-frame.is-playing .ad-video-cover{display:none}
    .market-landing .ad-hero-video-card .video-bubble{position:absolute;left:12px;top:12px;background:#c8102e;
      color:#fff;font-weight:800;font-size:12.5px;padding:6px 12px;border-radius:999px;letter-spacing:.04em}
    .market-landing .ad-hero-video-card .video-play-mark{position:absolute;left:50%;top:50%;
      transform:translate(-50%,-50%);width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.94);
      color:#131a33;display:flex;align-items:center;justify-content:center;font-size:20px;padding-left:4px;
      box-shadow:0 12px 32px rgba(0,0,0,.35);transition:transform .18s ease}
    .market-landing .ad-hero-video-card .ad-video-cover:hover .video-play-mark{transform:translate(-50%,-50%) scale(1.08)}
    .market-landing .ad-hero-video-card figcaption{padding:10px 6px 0}
    .market-landing .ad-hero-video-card figcaption strong{display:block;color:#131a33}
    .market-landing .ad-hero-video-card figcaption span{color:#5c6275;font-size:13.5px}

    /* ═══ Cleveland flagship (arch-hq): banner, display type, video under copy ═══ */
    .arch-hq .market-copy h1{font-size:clamp(34px,4.6vw,56px);letter-spacing:-.03em;line-height:1.06}
    .arch-hq .ad-hero-video-card{max-width:560px}
    .arch-hq .market-trainer-media img{object-position:center 70%}

    /* ═══ case panels — designed media for pages where a photo would mislead ═══ */
    .market-case-panel{min-height:0;border:0;border-radius:16px;background:#fff;
      box-shadow:0 20px 50px rgba(10,16,40,.28);padding:26px;display:flex;flex-direction:column;gap:12px;align-self:start}
    /* floor: styles.css styles spans/text inside hero-media figures pale+small — the panel must win */
    .market-landing .market-case-panel span,.market-landing .market-case-panel p,
    .market-landing .market-case-panel li,.market-landing .market-case-panel b{color:#131a33}
    .market-landing .market-case-panel .case-kicker{font-size:12px !important;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--mk1) !important}
    .market-landing .market-case-panel .case-price-big{font-size:clamp(42px,6vw,62px) !important;color:#141826 !important}
    .market-landing .market-case-panel .case-price-big sup{color:var(--mk1) !important;font-size:.5em !important}
    .market-landing .market-case-panel .case-price-label{font-size:13px !important;color:#5c6275 !important}
    .market-landing .market-case-panel .case-note{font-size:14px !important;color:#3c4258 !important}
    .market-landing .market-case-panel .case-big{color:var(--mk1) !important}
    .market-landing .market-case-panel .case-list li{font-size:14.5px !important;color:#131a33 !important}
    .case-kicker{font-size:12px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--mk1)}
    .case-price-row{display:flex;align-items:center;gap:16px}
    .case-price-big{font-size:clamp(40px,6vw,62px);font-weight:900;letter-spacing:-.04em;color:#141826;line-height:1;font-variant-numeric:tabular-nums}
    .case-price-big sup{font-size:.5em;color:var(--mk1);font-weight:800}
    .case-price-label{font-size:13px;font-weight:700;color:#5c6275;line-height:1.35}
    .case-note{margin:0;font-size:14px;color:#3c4258;line-height:1.55}
    .case-big{margin:0;font-size:clamp(32px,4.6vw,46px);font-weight:900;letter-spacing:-.02em;line-height:1.05;color:var(--mk1)}
    .case-divider{height:1px;background:#e3e6f0;margin:4px 0}
    .case-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px}
    .case-list li{padding-left:26px;position:relative;font-size:14.5px;color:#131a33;font-weight:600;line-height:1.4}
    .case-list li:before{content:"✓";position:absolute;left:0;top:0;color:var(--mk1);font-weight:900}
    .case-bilingual{background:linear-gradient(160deg,#fff 55%,#fdf3e3)}
    .market-case-panel .btn{align-self:flex-start}

    /* below-fold market photo in the care section */
    .market-care-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:26px;align-items:center}
    .market-care-photo{margin:0;border-radius:14px;overflow:hidden;box-shadow:0 18px 44px rgba(0,0,0,.35)}
    .market-care-photo img{width:100%;height:100%;min-height:220px;max-height:320px;object-fit:cover;display:block}

    /* ═══ HERO GRID CONTRACT — explicit named areas. Legacy auto-placement put
       the headline 2,000px down and floated the video first on desktop. ═══ */
    .market-landing .market-hero-grid{display:grid;gap:26px;align-items:start;
      grid-template-columns:minmax(0,1fr);grid-template-areas:"copy" "media" "video" "form";
      grid-template-rows:auto}
    .market-landing .market-copy{grid-area:copy}
    .market-landing .market-trainer-media,.market-landing .market-case-panel{grid-area:media;transform:none}
    .market-landing .ad-hero-video-card{grid-area:video}
    .market-landing .market-consult-panel{grid-area:form;position:static !important;top:auto !important;margin:0}
    .arch-hq .market-hero-grid{grid-template-areas:"media" "copy" "video" "form"}
    @media(min-width:960px){
      .market-landing .market-hero-grid{grid-template-columns:minmax(0,1.3fr) minmax(380px,470px);
        gap:30px 48px;grid-template-areas:"copy form" "media form"}
      .arch-hq .market-hero-grid{grid-template-areas:"media media" "copy form" "video form"}
      .arch-metro .market-hero-grid,.arch-campus .market-hero-grid{
        grid-template-columns:minmax(380px,470px) minmax(0,1.3fr);
        grid-template-areas:"form copy" "form media"}
      .arch-portrait2 .market-hero-grid{grid-template-areas:"media form" "copy form"}
      .arch-metro .market-trainer-media{transform:rotate(-2deg)}
    }
    /* media never crops the subject into mystery meat */
    .market-landing .market-trainer-media{min-height:0;align-self:start}
    .market-landing .market-trainer-media img{aspect-ratio:4/3;width:100%;height:auto;
      min-height:0;max-height:440px;object-fit:cover;object-position:center}
    .arch-hq .market-trainer-media img{aspect-ratio:auto;height:100%;object-position:center 65%}
    .market-landing .market-care-photo img{aspect-ratio:16/10;height:auto}

    /* 6) Proof-band floor: strong numbers always readable on their band. */
    .ad-proof-band-v2 strong{color:#fff}
    .ad-proof-band-v2 span{color:#c9d2ec}
    .arch-coast .ad-proof-grid-v2 span,.arch-resort .ad-proof-grid-v2 span{color:#e6f3f8}
  </style>
</head>
<body id="top" class="market-landing ad-landing ad-landing-v2 arch-${market.arch}" style="--mk1:${market.mk1};--mk2:${market.mk2}" data-self-designed="1" data-market="${escapeHtml(market.market)}" data-hero-title="${escapeHtml(market.h1)}" data-issues="${escapeHtml(market.issues)}">
  <header class="ad-header ad-header-v2 market-header">
    <div class="container ad-nav ad-nav-v2">
      <a class="ad-brand-v2" href="#top" aria-label="Back to top">
        <img class="logo" src="assets/lorenzo-logo-white.png" alt="Lorenzo's Dog Training Team">
        <span>Serious Training. Serious Results.</span>
      </a>
      <div class="ad-header-actions">
        <a class="btn btn-ghost-light" href="#consultation">Book My Consultation</a>
        <a class="btn btn-red" href="tel:+18664364959"><span class="desktop-call">Call (866) 436-4959</span><span class="mobile-call">Call Now</span></a>
      </div>
    </div>
  </header>

  <main>
    <section class="market-hero">
      <img class="market-hero-bg" src="assets/get-started-premium-hero.jpg" alt="" width="1680" height="945" decoding="async" aria-hidden="true">
      <div class="market-tint" aria-hidden="true" style="background:linear-gradient(135deg, rgba(${market.tint},.55), rgba(${market.tint2},.28))"></div>
      <div class="container market-hero-grid">
        <div class="market-copy">
          <span class="market-word" aria-hidden="true">${escapeHtml(market.word)}</span>
          <span class="ad-rating-row"><span>★★★★★</span>
            <strong>600+ Google reviews · ${escapeHtml(market.market)} request</strong>
          </span>
          <h1>${escapeHtml(market.h1)}</h1>
          <p class="ad-lead market-hook"><strong>${escapeHtml(market.hook)}</strong></p>
          <p class="ad-lead">Tell us what's going on with your dog. A certified ${escapeHtml(market.city)} dog trainer calls you back — usually the same day — and the evaluation is free.</p>
          ${market.spanish ? `<p class="ad-lead market-spanish" lang="es"><strong>Hablamos español.</strong> Entrenamiento profesional de perros en ${escapeHtml(market.city)} — puede enviar su solicitud en español y un entrenador que habla español le llamará.</p>` : ""}
          <div class="ad-benefit-row">
            ${market.benefits.split("|").map(b => `<span>${escapeHtml(b)}</span>`).join("\n            ")}
          </div>
          <div class="ad-issue-strip" aria-label="Common dog training problems">
            ${market.issues.split("|").map(i => `<span>${escapeHtml(i)}</span>`).join("")}
          </div>
          <ul class="ad-checks ad-checks-v2">
            ${market.checks.map(c => `<li>${escapeHtml(c)}</li>`).join("\n            ")}
          </ul>
          <div class="market-hero-actions">
            <a class="btn market-primary-cta" href="#consultation">Book My Consultation</a>
            <a class="market-text-link" href="#market-services">Explore training options <span aria-hidden="true">&darr;</span></a>
          </div>
        </div>

        ${casePanels[market.slug] || `<figure class="market-hero-media market-trainer-media">
          <img src="${escapeHtml(market.photo)}" alt="${escapeHtml(market.photoName)} — ${escapeHtml(market.market)}" style="object-position:${market.photoPos || "center"}" loading="lazy" decoding="async">
          <figcaption>
            <strong>${escapeHtml(market.photoName)}</strong>
            <span>${escapeHtml(market.photoCaption)}</span>
          </figcaption>
        </figure>`}

        ${market.slug === "dog-training-cleveland-oh" ? `<figure class="market-hero-media ad-hero-video-card">
          <div class="ad-video-frame">
            <button class="ad-video-cover" type="button" data-video-cover aria-label="Play real client results video">
              <img src="assets/ad-testimonial-take-1-cover.png" alt="Real client results video cover" loading="lazy" decoding="async">
              <span class="video-bubble">Real Client Results</span>
              <span class="video-play-mark" aria-hidden="true">&#9654;</span>
            </button>
            <video controls preload="metadata" poster="assets/ad-testimonial-take-1-cover.png" playsinline>
              <source src="assets/ad-testimonial-take-1.mp4" type="video/mp4">
            </video>
          </div>
          <figcaption>
            <strong>See the result. Book the right next step.</strong>
            <span>Real family. Real client results.</span>
          </figcaption>
        </figure>` : ""}

        <aside id="consultation" class="ad-consult-panel market-consult-panel">
          <div class="ad-consult-header">
            <span>${escapeHtml(market.market)}</span>
            <h2>Book your free, no-obligation evaluation.</h2>
            <p>Tell us what is going on with your dog. A local trainer calls you back &mdash; usually the same day.</p>
          </div>
          <form class="ad-form-card ad-form-card-v2 contact-intake"
            action="https://formsubmit.co/production@lorenzosdogtrainingteam.com"
            method="POST"
            data-google-form-endpoint="${googleEndpoint}"
            data-office-email="production@lorenzosdogtrainingteam.com"
            data-email-endpoint="https://formsubmit.co/ajax/production@lorenzosdogtrainingteam.com"
            data-form-type="market-ad-form"
            data-conversion-event="ldtt_market_ad_lead_submit">
            <div class="form-grid-two">
              <label>First Name<input required name="first_name" autocomplete="given-name"></label>
              <label>Last Name<input required name="last_name" autocomplete="family-name"></label>
            </div>
            <label>Phone Number<input required name="phone" autocomplete="tel" inputmode="tel"></label>
            <label>Email Address<input required type="email" name="email" autocomplete="email"></label>
            <label>ZIP Code<input required name="zip" autocomplete="postal-code" inputmode="numeric"></label>
            <label>What do you need help with?
              <select required name="i_want_to">
                <option value="">Select one</option>
                <option>Schedule an in person evaluation with a trainer in my area</option>
                <option>Schedule an online consultation</option>
                <option>Dog obedience training</option>
                <option>Dog behavior modification</option>
                <option>Puppy training</option>
                <option>Specialty, service, or protection training</option>
                <option>Not sure yet</option>
              </select>
            </label>
            <label class="wide">What is happening with your dog?
              <textarea name="comments" rows="3" placeholder="${market.spanish ? "English or español — example: pulling on leash, barking, jumping / jala la correa, ladridos, ansiedad..." : "Example: pulling on leash, barking, jumping, potty training, aggression, anxiety..."}"></textarea>
            </label>
            <label class="consent-row">
              <input type="checkbox" name="sms_consent" value="yes">
              <span>By checking this box, I agree to receive recurring promotional and informational text messages from Lorenzo's Dog Training Team about dog training, consultation scheduling, follow-up, and offers. Messages may be sent via autodialer. Consent is not a condition of any purchase or services. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe and HELP for help. I also agree to the <a href="terms.html">Terms of Service</a> and <a href="privacy-policy.html">Privacy Policy</a>.</span>
            </label>
            <p class="form-disclaimer">Phone is required so Lorenzo's office can call about your request. SMS consent is optional and separate from submitting this form.</p>

            <input type="hidden" name="trainer_name" value="${escapeHtml(market.trainers)}">
            <input type="hidden" name="assigned_trainer" value="${escapeHtml(market.trainers)}">
            <input type="hidden" name="trainer_market" value="${escapeHtml(market.market)}">
            <input type="hidden" name="ad_market" value="${escapeHtml(market.market)}">
            <input type="hidden" name="market_city" value="${escapeHtml(market.city)}">
            <input type="hidden" name="market_state" value="${escapeHtml(market.state)}">
            <input type="hidden" name="market_trainers" value="${escapeHtml(market.trainers)}">
            <input type="hidden" name="landing_page_type" value="Paid ads market page">
            <input type="hidden" name="address_line_1" value="Short ad form - office to collect">
            <input type="hidden" name="address_line_2" value="">
            <input type="hidden" name="city" value="${escapeHtml(market.city)}">
            <input type="hidden" name="state" value="${escapeHtml(market.state)}">
            <input type="hidden" name="heard_about_us" value="Paid Advertising">
            <input type="hidden" name="vet_or_previous_client" value="Market ad landing page">
            <input type="hidden" name="internal_route_note" value="Market ad landing page lead for ${escapeHtml(market.market)}. Office to confirm full address and evaluation preference during follow-up. Nearby trainer group: ${escapeHtml(market.trainers)}.${market.spanish ? " SPANISH MARKET: lead may arrive in Spanish - Spanish-speaking trainer available in this market; office should translate before routing." : ""}">
            ${market.spanish ? `<input type="hidden" name="spanish_market" value="yes">` : ""}
            <input type="hidden" name="source_page" value="${escapeHtml(market.slug)}">
            ${attributionInputs()}
            <input type="hidden" name="timestamp" value="">
            <div class="form-status" role="status" aria-live="polite"></div>
            <button class="btn btn-red" type="submit">Book My Consultation</button>
            <small>Free and no obligation. No full address needed to start.</small>
          </form>
        </aside>
      </div>
    </section>

    ${flow.map(k => SEC[k]).join("\n\n")}
  </main>

  <footer class="footer ad-footer">
    <div class="container subfooter">&copy; Lorenzo's Dog Training Team. Serious Training. Serious Results. | <a href="tel:+18664364959">(866) 436-4959</a></div>
  </footer>

  ${conversionAndAttributionScript()}
  <script src="supabase-config.js"></script>
  <script src="script.js?v=${cacheVersion}"></script>
  <script src="market-landing.js?v=${cacheVersion}"></script>
  <script src="ad-funnel.js?v=${cacheVersion}"></script>
</body>
</html>`;
};

for (const market of markets) {
  writeFileSync(resolve(`${market.slug}.html`), page(market));
  console.log(`generated ${market.slug}.html`);
}
