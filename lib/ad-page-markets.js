// Ad landing page source data — the single source of truth for every paid-ad
// market page. scripts/generate-market-pages.mjs writes the static pages from
// it, and Page Studio (trainer-backoffice/page-studio.js via api/ad-pages.js)
// starts every new page from the same records, so a generated page always
// matches the format of the ones already live.
//
// CommonJS on purpose: the API routes are CommonJS and the build script (ESM)
// can import it too. Nothing here touches Node built-ins, so the browser can
// load it as well.
(function (root, factory) {
  const mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  else root.LDTT_AD_PAGE_MARKETS = mod;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
/* "39 years" and "since 1988" were both on the Cleveland page, in the same
   sentence. 1988 to 2026 is 38, so one of them was wrong. Derive the number from
   the founding year so the two can never disagree again, and so it stays right
   next year without anyone remembering to bump it.
   NOTE: 1988 is taken from the site's own "since 1988" line — worth confirming. */
const FOUNDED_YEAR = 1988;
const YEARS_IN_BUSINESS = new Date().getFullYear() - FOUNDED_YEAR;

const markets = [
  {
    slug: "dog-training-cleveland-oh",
    photoPos: "center 58%",
    photo2: "assets/ldtt-team-hq-exterior.jpg", photo2Alt: "The Lorenzo's team and their dogs outside the Cleveland headquarters",
    heroVideo: "assets/video/ldtt-hq-campus.mp4", heroPoster: "assets/video/ldtt-hq-campus-poster.jpg",
    photo: "assets/facility-exterior-main.jpg", photoName: "Your dog trains where every Lorenzo's trainer gets certified", photoCaption: "Next door to our 17,000 sq ft Cleveland headquarters", word: "THE HQ", issues: "Aggression|Leash pulling|New puppy|Board & train", proofValue: "17,000", proofLabel: "Sq ft HQ facility", benefits: "Free evaluation|Same-day callback|90-day guarantee", priceMode: "quiet",
    arch: "hq", mk1: "#152569", mk2: "#C8102E",
    
    
      
    tint: "21,37,105",
    tint2: "200,16,46",
    hook: "This is where it all starts. Train your dog at the same facility where Lorenzo's professional trainers come to learn, train, and earn their certification — next door to our 17,000 sq ft Cleveland headquarters.",
    title: "Cleveland & Akron Dog Training",
    h1: "Aggression, Leash Pulling, or a New Puppy? Cleveland Training Where the Trainers Get Certified.",
    market: "Cleveland / Akron, OH",
    city: "Cleveland",
    state: "OH",
    area: "Cleveland, Akron, Garfield Heights, Cleveland Heights, Streetsboro, and Northeast Ohio",
    trainers: "Harley McGrew and Brady DeRemer",
    proof: "Local Northeast Ohio support, with every inquiry personally coordinated through Lorenzo's Cleveland office.",
    nearby: ["Cleveland Heights", "Garfield Heights", "Akron", "Streetsboro", "Northeast Ohio"],
    checks: ["Aggression and reactivity help from trainers certified at our national HQ", "Board & train at headquarters — your dog lives and learns on campus", "New puppy? Potty, crate, and socialization handled early", "Free evaluation backed by the 17,000 sq ft Cleveland campus"],
    care: {"eyebrow": "The home team", "h2": "Your Dog Trains Where Every Lorenzo's Trainer Gets Certified.", "p": "Cleveland isn't just another location — it's where Lorenzo's began. Your dog trains at the same facility where our trainers from across the country come to learn and earn their certification. It's also home to our Board & Train program, where dogs live, learn, and train on-site — all right next door to our 17,000 sq. ft. Cleveland headquarters.", "t": "Why Northeast Ohio starts here."},
    testis: [{"h": "Evaluated at the source", "p": "Free evaluations backed by the national headquarters — not a satellite office."}, {"h": `${YEARS_IN_BUSINESS} years of dogs like yours`, "p": `Aggression, reactivity, puppies, rescues — since ${FOUNDED_YEAR}, Northeast Ohio families have started here.`}, {"h": "Board & train advantage", "p": "Your dog trains daily with professionals and comes home with real skills — owner handoff lessons included."}],
    zipCodes: ["44118", "44241"]
  },
  {
    slug: "dog-training-columbus-oh",
    // Bill's photo, sent by Rachel 2026-08-19 for the "Two dogs. One house." section.
    // It is 16:9 and this figure crops to 4:3, so the subjects are pulled left of
    // centre — a plain centre crop pushes them into the corner and fills the frame
    // with empty floor.
    photo2: "assets/ldtt-dog-mark.png", photo2Alt: "Lorenzo's Dog Training Team", photo2Pos: "30% center",
    photo: "assets/columbus-two-dogs.jpg", photoName: "Two dogs. One calm house.", photoCaption: "Multi-dog peace is the outcome we train for", word: "AGGRESSION", issues: "Dogs fighting at home|Jumping|Potty training|Barking", proofValue: "Same week", proofLabel: "Aggression assessments", benefits: "Free evaluation|Multi-dog specialists|90-day guarantee", priceMode: "forward",
    arch: "portrait", mk1: "#7A1E2C", mk2: "#EFE7DA",
    
    
      
    tint: "21,37,105",
    tint2: "120,20,60",
    hook: "Dogs fighting in the same house? We specialize in resolving multi-dog conflict. Ask about a same-week assessment.",
    title: "Columbus Dog Training",
    h1: "Dogs Fighting at Home? Get Help with Aggression & Behavior Training in Columbus.",
    market: "Columbus / Reynoldsburg, OH",
    city: "Columbus",
    state: "OH",
    area: "Columbus, Reynoldsburg, and Central Ohio communities",
    trainers: "Shannon Paskins",
    proof: "Central Ohio families get local obedience and behavior help, personally coordinated through Lorenzo's office.",
    nearby: ["Columbus", "Reynoldsburg", "Central Ohio", "Franklin County", "Licking County"],
    checks: ["Dogs fighting in the same house — assessment, safety plan, reintroduction", "Jumping, barking, and door-crashing brought under control", "Potty training and puppy foundations", "Owner coaching so the peace holds after we leave"],
    care: {"eyebrow": "Multi-dog households", "h2": "Two dogs. One house. It can work again.", "p": "When dogs in the same home start fighting, waiting can make the problem worse. We help Columbus families address these conflicts by assessing both dogs, establishing safety and structure in the home, and rebuilding the relationship step by step.", "t": "How we handle dogs in conflict."},
    testis: [{"h": "Assess first", "p": "A professional reads both dogs — triggers, resource guarding, body language — before anyone talks plans."}, {"h": "Make home safe now", "p": "You get an immediate management plan so nobody gets hurt while training happens."}, {"h": "Reintroduce With Confidence", "p": "Structured reintroduction with owner coaching, so calm is the new normal after we leave."}],
    zipCodes: ["43068"]
  },
  {
    slug: "dog-training-atlanta-ga",
    photo2: "assets/alison1.png", photo2Alt: "A handler in a wheelchair with her trained service dog",
    photo: "assets/utility-retrieval.png", photoName: "Dogs with jobs", photoCaption: "Service, task work and specialty training — Atlanta's open lane", word: "SERVICE", issues: "Service dog training|Aggression|Task work|Obedience", proofValue: "3", proofLabel: "Certified Atlanta trainers", benefits: "Free suitability assessment|Service-dog specialists|90-day guarantee", priceMode: "quiet",
    arch: "specialty", mk1: "#14101F", mk2: "#C9A227",
    
    
      
    tint: "30,25,90",
    tint2: "190,60,30",
    hook: "Specialty & Service Dog Training in Atlanta — starting with a free assessment.",
    title: "Atlanta Dog Training",
    h1: "Service Dog Training in Atlanta — Plus Aggression Help & Real-World Obedience.",
    market: "Atlanta, GA",
    city: "Atlanta",
    state: "GA",
    area: "Atlanta, Loganville, Dallas, and surrounding Georgia communities",
    trainers: "Aryson Whorley, Christopher Almonte, and Chloe Chisolm",
    proof: "Georgia families start with one request and are matched to the right program by Lorenzo's office.",
    nearby: ["Atlanta", "Loganville", "Dallas", "North Georgia", "Metro Atlanta"],
    checks: ["Service dog training with an honest suitability assessment first", "Task work, scent work, retrieval, and advanced control", "Aggression and behavior modification handled professionally", "Real-world obedience for everyday Atlanta life"],
    care: {"eyebrow": "Specialty programs", "h2": "Training You Won't Find Just Anywhere in Atlanta.", "p": "Service and specialty dog training starts with finding the right fit. Our free suitability assessment helps determine your dog's potential for advanced training and the program best suited to your goals.", "t": "What specialty training really involves."},
    testis: [{"h": "Suitability first", "p": "A free assessment tells you honestly whether your dog is a candidate — before you spend anything."}, {"h": "Realistic timelines", "p": "Task training is measured in months of structured work. We map it out clearly up front."}, {"h": "Beyond service dogs", "p": "Protection, scent, utility, and retrieval work for owners who want a dog with a job."}],
    zipCodes: ["30052", "30324", "30157"]
  },
  {
    slug: "dog-training-san-diego-ca",
    photo2: "assets/market-photos/san-diego-client-dog.jpg", photo2Alt: "Real Lorenzo's clients with their trained golden retriever",
    photo: "assets/facility-purpose-aerial-clean.png", photoName: "Nothing to hide", photoCaption: "Real campus, real programs, published prices", word: "HONEST", issues: "New puppy|Leash pulling|Barking|Recall", proofValue: "$1,250", proofLabel: "Transparent starting price", benefits: "Free evaluation|Published pricing|Military discount available|90-day guarantee", priceMode: "forward",
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
    photo: "assets/market-photos/san-antonio-field-work.jpg", heroPhoto: "assets/market-photos/san-antonio-field-work.jpg", photo2: "assets/market-photos/san-antonio-handler-dog.jpg", photoName: "Real training, real San Antonio dogs", photoCaption: "Our trainers working in the field", word: "BILINGÜE", issues: "Aggression|Puppy training|Obedience|Spanish-speaking trainers", proofValue: "2", proofLabel: "Spanish-speaking trainers", benefits: "Free evaluation|Military discount available|90-day guarantee", priceMode: "quiet",
    arch: "mission", mk1: "#7E1F1F", mk2: "#D9A441",
    
    
      
    tint: "90,30,30",
    tint2: "200,120,30",
    hook: "Military family? Your training follows you — Lorenzo's has certified trainers in cities nationwide, so a PCS move never means starting over.",
    title: "San Antonio Dog Training",
    h1: "Aggression, Puppy Training & Obedience in San Antonio — Spanish-Speaking Trainers.",
    market: "San Antonio, TX",
    city: "San Antonio",
    state: "TX",
    area: "San Antonio, Castroville, Bear Creek, and surrounding Texas communities",
    trainers: "Giovanni Gutierrez and Carolina Perez",
    spanish: true,
    proof: "Texas dog owners can request a fast follow-up for obedience, behavior modification, and advanced training needs.",
    nearby: ["San Antonio", "Castroville", "Bear Creek", "Bexar County", "Medina County"],
    checks: ["Aggression, obedience, and puppy training for San Antonio families", "Military families: your training follows you nationwide", "Spanish-speaking trainers — your sessions can be in Spanish", "In-home and private options across the San Antonio area"],
    care: {"eyebrow": "Military & bilingual", "h2": "PCS orders don't restart your dog's training.", "p": "San Antonio is a military town — and Lorenzo's has certified trainers in cities nationwide. If you're stationed somewhere new tomorrow, your dog's program continues. Our San Antonio trainers speak Spanish, so your training sessions can be run in Spanish.", "t": "Built for San Antonio families."},
    testis: [{"h": "Training that transfers", "p": "A nationwide trainer network means a military move never means starting over."}, {"h": "Entrenadores que hablan español", "p": "Nuestros entrenadores en San Antonio hablan español — sus sesiones de entrenamiento pueden ser en español."}, {"h": "Same programs, either language", "p": "Same programs, same prices, same guarantee — with a Spanish-speaking trainer."}],
    zipCodes: ["78245", "78009"]
  },
  {
    slug: "dog-training-chicago-il",
    photoPos: "center 15%",
    photo2: "assets/market-photos/chicago-training-hall.jpg", photo2Alt: "A Chicago family with their trained dog at home",
    photo: "assets/ldtt-team-cover.jpg", photoName: "50+ trainers. No waitlist.", photoCaption: "Our team keeps evaluation slots open every week", word: "THIS WEEK", issues: "Reactivity|Leash pulling|New puppy|Barking", proofValue: "No waitlist", proofLabel: "Start this week", benefits: "Free evaluation|No waitlist|90-day guarantee", priceMode: "quiet",
    arch: "metro", mk1: "#0B1B3F", mk2: "#D64545",
    
    
      
    tint: "10,30,80",
    tint2: "200,16,46",
    hook: "No waitlist. Evaluations available this week across Chicago.",
    title: "Chicago Dog Training",
    h1: "Reactive Dog? New Puppy? Chicago Dog Training With No Waitlist.",
    market: "Chicago, IL",
    city: "Chicago",
    state: "IL",
    area: "Chicago, Northwest Indiana, Gary, and surrounding communities",
    trainers: "Jasmine Bland",
    proof: "Professional dog training for Chicago families, combining local service with the experience, standards, and support of the Lorenzo's Dog Training Team network.",
    nearby: ["Chicago", "Northwest Indiana", "Gary", "South Suburbs", "Chicago Metro"],
    checks: ["Reactivity on busy streets — lunging, barking, pulling toward dogs", "Evaluations available this week across Chicago", "New puppy foundations before bad habits set", "In-home and private training options"],
    care: {"eyebrow": "No waitlist", "h2": "Why wait months to fix this week's problem?", "p": "Professional dog training shouldn't come with a long wait. Chicago families can connect with our team, schedule an evaluation, and often begin the process within the same week.", "t": "Built for city dogs."},
    testis: [{"h": "Start this week", "p": "No waitlist. Your evaluation gets scheduled now, while the problem is fresh."}, {"h": "Reactivity is our daily work", "p": "Lunging and barking at dogs, bikes, and strangers — trainable, with a clear plan."}, {"h": "Real-life proofing", "p": "Training that holds on crowded sidewalks and busy streets, not just a quiet backyard."}],
    zipCodes: ["60618"]
  },
  {
    slug: "dog-training-tallahassee-fl",
    photo2: "assets/market-photos/tallahassee-second.jpg", photo2Alt: "A dog carrying out a trained retrieval task with focus",
    // Was matthew-behavior-dog.jpg: a muzzled dog on two dead-taut leads, letterboxed
    // video still with a burned-in watermark. On a page whose own chips say "Leash
    // pulling" that picture sells the problem, not the result. This one is real
    // photography in a real Lorenzo's room — two dogs sitting, lead in a slack loop.
    photo: "assets/market-photos/tallahassee-lead.jpg", photoName: "The tough cases", photoCaption: "Reactive and stubborn dogs — sitting calm on a loose lead", word: "REACTIVE", issues: "Won't listen|Reactivity|Sound sensitivity|Leash pulling", proofValue: "Reactive dogs", proofLabel: "Our specialty", benefits: "Free evaluation|Reactivity specialists|90-day guarantee", priceMode: "forward",
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
    photo2: "assets/market-photos/miramar-second.jpg", photo2Alt: "Calm, trained dogs relaxing outside the house",
    photo: "assets/market-photos/miramar-beach-dog.jpg", photoName: "Vacation-ready", photoCaption: "Calm on the sand, welcome in the rental", word: "BEACH", issues: "Beach recall|Rental manners|Barking|Board & train", proofValue: "Fall slots", proofLabel: "Holiday board & train", benefits: "Free evaluation|Vacation-ready training|90-day guarantee", priceMode: "quiet",
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
    zipCodes: ["32550"]
  },
  {
    slug: "dog-training-panama-city-beach-fl",
    photo2: "assets/market-photos/lorenzo-pack-down-stay.jpg", photo2Alt: "Lorenzo Miller surrounded by more than twenty trained dogs, every one of them holding a calm down-stay on the grass",
    photo: "assets/market-photos/panama-city-beach-dog.jpg", photoName: "Ready for the Gulf", photoCaption: "Calm at the condo, steady on the sand", word: "OBEDIENCE", issues: "Beach recall|Condo manners|Barking|Board & train", proofValue: "Fall slots", proofLabel: "Holiday board & train", benefits: "Free evaluation|Vacation-ready training|90-day guarantee", priceMode: "quiet",
    arch: "resort", mk1: "#12758F", mk2: "#F4EADA",
    tint: "12,80,110",
    tint2: "21,37,105",
    hook: "Gulf-ready: beach recall, condo manners, and a dog your building will welcome back.",
    title: "Panama City Beach Dog Training",
    h1: "Beach Recall, Condo Manners & Board and Train \u2014 Panama City Beach Dog Training.",
    market: "Panama City Beach, FL",
    city: "Panama City Beach",
    state: "FL",
    area: "Panama City Beach, Panama City, Lynn Haven, Callaway, Bay County, and nearby Gulf Coast communities",
    trainers: "Tabatha Shelley",
    proof: "Bay County families can request obedience, behavior modification, puppy training, and specialty support through Lorenzo's office.",
    nearby: ["Panama City Beach", "Panama City", "Lynn Haven", "Callaway", "Bay County"],
    checks: ["Recall you can trust on the sand and off the balcony", "Condo and HOA manners: no barking complaints, no chewed furniture", "Holiday board & train \u2014 slots fill 6\u20138 weeks ahead", "Puppy and obedience foundations year-round"],
    care: {"eyebrow": "Gulf-ready", "h2": "The Gulf is better with a dog who listens.", "p": "Panama City Beach life is condos, boardwalks, and wide open sand. We train the skills that make it easy \u2014 rock-solid recall, calm greetings, and manners your building and neighbors will thank you for.", "t": "Trained for coast life."},
    testis: [{"h": "Beach recall", "p": "Coming when called even with birds, waves, and other dogs in play."}, {"h": "Condo-proof manners", "p": "Quiet in the hallway, calm in the elevator, welcome back next season."}, {"h": "Holiday board & train", "p": "Drop off before the holidays, come home to a transformed dog. Book 6\u20138 weeks ahead."}],
    zipCodes: ["32407", "32408", "32413"]
  },
  {
    slug: "dog-training-pensacola-fl",
    photo: "assets/market-photos/lorenzo-pack-down-stay.jpg", photoName: "Real results", photoCaption: "Twenty-plus dogs, one calm down-stay", word: "BEHAVIOR", issues: "Barking|Leash pulling|Jumping|Anxiety after a move", proofValue: "3 trainers", proofLabel: "Living in the area", benefits: "Free evaluation|Published pricing|90-day guarantee", priceMode: "forward",
    arch: "coast", mk1: "#14337A", mk2: "#E8EFF9",
    tint: "20,51,122",
    tint2: "21,37,105",
    hook: "Three Lorenzo's trainers live right here \u2014 Pensacola, Navarre, and Crestview. Published pricing, a free evaluation, and a 90-day guarantee.",
    title: "Pensacola Dog Training",
    h1: "Barking, Pulling, Ignoring You? Pensacola Dog Behavior & Obedience Training.",
    market: "Pensacola, FL",
    city: "Pensacola",
    state: "FL",
    area: "Pensacola, Navarre, Gulf Breeze, Milton, Pace, Perdido Key, Crestview, Escambia and Santa Rosa County, and nearby Northwest Florida communities",
    trainers: "Clark Patton, Michael King, Daniel Bainbridge",
    proof: "Three Lorenzo's trainers live in the Pensacola area, across Escambia and Santa Rosa County, so obedience, behavior modification, puppy training, and specialty requests get a local answer through Lorenzo's office.",
    nearby: ["Pensacola", "Navarre", "Gulf Breeze", "Milton", "Pace"],
    checks: ["Barking, pulling, jumping, and flat-out ignoring you", "Leash manners that hold \u2014 Pensacola Beach is leash-only, even in the water", "New base housing or a PCS move? Moving sets dogs back. We fix the fallout.", "Three trainers living in Escambia and Santa Rosa County"],
    care: {"eyebrow": "Behavior first", "h2": "Barking, pulling, ignoring you \u2014 that is behavior, not stubbornness.", "p": "Most Pensacola owners do not need a new command. They need the dog to actually do the one it already knows. We fix the behavior underneath it, then build obedience that holds at the door, on the leash, and around other dogs \u2014 which matters here, because the Pensacola Beach dog beaches are leash-only, even in the water.", "t": "What behavior training covers."},
    testis: [{"h": "A leash you can hold", "p": "Escambia County requires a leash under 8 feet at the dog beach, in the water included. We train for the walk you would actually take again."}, {"h": "Quiet at the door", "p": "Barking at the mail, the neighbor, and the doorbell handled with a plan, not a shout."}, {"h": "Settled after a move", "p": "A PCS move or new housing throws a dog off \u2014 anxiety, barking, backsliding. We rebuild the routine."}],
    zipCodes: ["32501", "32566", "32536"]
  },
  {
    slug: "dog-training-lexington-ky",
    photo: "assets/market-photos/lexington-class-group.jpg", photo2: "assets/market-photos/lexington-trainer-candid.jpg", photoName: "Room to run", photoCaption: "Recall that holds on open acreage", word: "FARM", issues: "Farm recall|Livestock manners|Leash pulling|Puppy", proofValue: "Open acreage", proofLabel: "Recall that holds", benefits: "Free evaluation|Farm & property dogs|90-day guarantee", priceMode: "quiet",
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
    care: {"eyebrow": "Farm & property dogs", "h2": "Town manners. Field reliability.", "p": "A farm dog needs more than sit and stay — recall across acreage, calm behavior around livestock, and boundaries without fences. Our training is built around how Central Kentucky actually lives.", "t": "What farm-dog training covers."},
    testis: [{"h": "Distance recall", "p": "Reliable return from real distances, past real distractions."}, {"h": "Livestock neutrality", "p": "No chasing, no herding the horses, no drama at the barn."}, {"h": "Working boundaries", "p": "Your property line, respected — even when a rabbit crosses it."}],
    zipCodes: ["40330"]
  },
  // ── Office 2026-09-26: four NEW city pages for the Meta campaigns (DO-NOT-BREAK rule 121). They are built by the
  // same generator and the same renderAdPage as every city above (same form, same flow, same tracking), plus the
  // 2.0 sections from lib/ad-page-v2-extras.js (the `v2` record). Joshua 2026-09-26: NO trainer names or trainer
  // photos on these pages; the words carry the local search terms people use (title, description, H1/H2, cards,
  // area, FAQ + FAQPage JSON-LD, areaServed), in Lorenzo's own language. v2.areaKey is the area name
  // lib/pipeline.js AREA_AD_PAGE uses for the re-engage link.
  {
    slug: "dog-training-navarre-fl",
    description: "Dog training in Navarre, FL: puppy training, obedience, leash pulling and aggressive or reactive dog training, in-home, from Lorenzo's. FREE evaluation. Serving Gulf Breeze, Holley & Navarre Beach.",
    photo: "assets/market-photos/miramar-beach-dog.jpg", photoName: "Calm on the sand, calm at home", photoCaption: "Real results for Gulf Coast dogs", word: "NAVARRE", issues: "Aggressive dogs|Leash pulling|Puppy training|Barking", proofValue: "FREE", proofLabel: "In-home evaluation", benefits: "FREE evaluation|In-home dog training|90-day guarantee", priceMode: "quiet",
    arch: "hq", mk1: "#001f42", mk2: "#d10f2d",
    tint: "0,31,66",
    tint2: "209,15,45",
    hook: "Serious Training. Serious Results. In-home dog training for Navarre, Navarre Beach, Gulf Breeze and Holley families, backed by Lorenzo's proven method and 40+ years of real results.",
    title: "Dog Training in Navarre, FL | Dog Trainer Near You",
    h1: "Dog Training in Navarre, FL: Puppy Training, Obedience & Aggressive Dog Help.",
    market: "Navarre, FL",
    city: "Navarre",
    state: "FL",
    area: "Navarre, Navarre Beach, Holley, Gulf Breeze, Midway, Mary Esther, Fort Walton Beach, and Santa Rosa County",
    trainers: "Lorenzo's certified trainers",
    proof: "Navarre families get in-home dog training backed by Lorenzo's office and the method used by trainers in 12 states.",
    nearby: ["Navarre", "Navarre Beach", "Gulf Breeze", "Holley", "Midway", "Mary Esther", "Fort Walton Beach", "Santa Rosa County"],
    checks: ["Aggressive and reactive dog training with a clear, safe plan", "Leash pulling fixed for the beach path and the neighborhood walk", "Puppy training: potty, crate, manners and socialization", "A FREE in-home evaluation to start"],
    care: { eyebrow: "In-home dog training", h2: "A calm, confident dog in Navarre.", p: "Lorenzo's proven method, built over 40+ years and used by trainers in 12 states, brought to your home in Navarre and Santa Rosa County.", t: "Why Navarre families start here." },
    testis: [{ h: "Evaluated at home", p: "A trainer sees your dog where the problems happen, then tells you what it will take." }, { h: "Built for base life", p: "PCS moves and new housing throw dogs off. We rebuild the routine." }, { h: "Guaranteed in writing", p: "Every program carries the 90-day Limited Training Guarantee." }],
    zipCodes: ["32566", "32563"],
    v2: {
      areaKey: "navarre",
      top: "FREE In-Home Dog Training Evaluations in Navarre, Navarre Beach, Gulf Breeze & Holley",
      svcIntro: "Looking for a dog trainer near you in Navarre, FL? Lorenzo's brings in-home dog training to Navarre, Navarre Beach, Holley, Gulf Breeze and Midway: puppy training, obedience training, leash pulling, aggressive and reactive dog training, board and train, and service dog training.",
      svc: ["Puppy training in Navarre: potty, crate, manners", "Obedience that holds on the beach path", "Aggressive or reactive dog? A clear plan", "Board and train with owner handoff lessons", "Service dog training after a suitability check", "Off-leash control around real distractions"],
      svcAlt: "in Navarre, FL",
      founder: "In Navarre and across Santa Rosa County, your request is coordinated by Lorenzo's office and matched with a trainer who uses the method Lorenzo Miller built over 40+ years in Cleveland, the same one used by professional trainers across 12 states. Serious Training. Serious Results.",
      areaHeading: "Dog Training in Navarre, Gulf Breeze & Santa Rosa County",
      areaText: "In-home dog training means your dog learns where the problems really happen: at the front door, on the walk to the beach, and around the neighbors' dogs.\n\nWe serve Navarre, Navarre Beach, Holley, Gulf Breeze, Midway, Mary Esther and Fort Walton Beach. Not sure if you're in range? Send the form with your ZIP and Lorenzo's office will tell you.",
      places: ["Navarre", "Navarre Beach", "Holley", "Gulf Breeze", "Midway", "Mary Esther", "Fort Walton Beach"],
      faqs: [
        { q: "Is the dog training evaluation in Navarre really FREE?", a: "Yes. A trainer meets you and your dog, sees what is going on, and tells you what it will take. There is no cost and no obligation." },
        { q: "Do you offer in-home dog training in Navarre, Gulf Breeze and Holley?", a: "Yes. Training happens in your home and neighborhood, where your dog actually lives and walks. Board and train is also available; ask about it during your FREE evaluation." },
        { q: "Can you help an aggressive or reactive dog?", a: "Yes. Aggression, reactivity, barking and fear are behavior solutions we work on every day, with a clear, safe plan that starts at the evaluation." },
        { q: "We just moved to Navarre on PCS orders. Can you help our dog settle in?", a: "Yes. A move often brings new barking, pulling or anxiety. We help your dog settle into the new house and the new routine." },
        { q: "How soon can we start?", a: "Send the form and Lorenzo's office follows up quickly, usually the same day, to set up your FREE evaluation." },
        { q: "Do you offer a guarantee?", a: "Every program is backed by the 90-day Limited Training Guarantee, in writing." }
      ]
    }
  },
  {
    slug: "dog-training-dallas-tx",
    description: "Dog training in Dallas, TX and Fort Worth: puppy training, obedience, leash pulling, aggressive and reactive dog training, board and train. FREE in-home evaluation from Lorenzo's. Serving the DFW Metroplex.",
    photo: "assets/ldtt-team-cover.jpg", photoPos: "center 40%", photoName: "50+ professional trainers. One standard.", photoCaption: "Lorenzo's proven method in 12 states", word: "DFW", issues: "Aggressive dogs|Leash pulling|Puppy training|Rescue dogs", proofValue: "FREE", proofLabel: "In-home evaluation", benefits: "FREE evaluation|In-home dog training|90-day guarantee", priceMode: "quiet",
    arch: "hq", mk1: "#001f42", mk2: "#d10f2d",
    tint: "0,31,66",
    tint2: "209,15,45",
    hook: "Serious Training. Serious Results. In-home dog training across Dallas, Fort Worth, Arlington, Irving and Plano, backed by Lorenzo's proven method and 40+ years of real results.",
    title: "Dog Training in Dallas, TX | Dog Trainer Near You in DFW",
    h1: "Dog Training in Dallas & Fort Worth: Puppy Training, Obedience & Aggressive Dog Help.",
    market: "Dallas, TX",
    city: "Dallas",
    state: "TX",
    area: "Dallas, Fort Worth, Arlington, Irving, Plano, Garland, Grand Prairie, Mesquite, and the Dallas-Fort Worth Metroplex",
    trainers: "Lorenzo's certified trainers",
    proof: "Dallas-Fort Worth families get in-home dog training backed by Lorenzo's office and the method used by trainers in 12 states.",
    nearby: ["Dallas", "Fort Worth", "Arlington", "Irving", "Plano", "Garland", "Grand Prairie", "Mesquite"],
    checks: ["Aggressive and reactive dog training with a plan that makes sense", "Leash pulling fixed on busy DFW sidewalks", "Puppy training and rescue dogs that won't settle", "A FREE in-home evaluation to start"],
    care: { eyebrow: "In-home dog training", h2: "A calm, confident dog in Dallas-Fort Worth.", p: "Lorenzo's proven method, built over 40+ years and used by trainers in 12 states, brought to your home anywhere in the Metroplex.", t: "Why DFW families start here." },
    testis: [{ h: "Evaluated at home", p: "A trainer sees your dog where the problems happen, then tells you what it will take." }, { h: "Rescues welcome", p: "Fear, reactivity or no manners at all: we start where your dog is." }, { h: "Guaranteed in writing", p: "Every program carries the 90-day Limited Training Guarantee." }],
    zipCodes: ["75201", "76102"],
    v2: {
      areaKey: "dallas",
      top: "FREE In-Home Dog Training Evaluations in Dallas, Fort Worth, Arlington, Irving & Plano",
      svcIntro: "Looking for a dog trainer near you in Dallas or Fort Worth? Lorenzo's brings in-home dog training across the DFW Metroplex: puppy training, obedience classes and private lessons, leash pulling, aggressive and reactive dog training, board and train, and service dog training.",
      svc: ["Puppy training in Dallas: habits started right", "Obedience on busy DFW sidewalks", "Aggressive or reactive dog? A clear plan", "Board and train with owner handoff lessons", "Service dog training after a suitability check", "Control that holds around real distractions"],
      svcAlt: "in Dallas-Fort Worth, TX",
      founder: "In Dallas, Fort Worth and across the Metroplex, your request is coordinated by Lorenzo's office and matched with a trainer who uses the method Lorenzo Miller built over 40+ years in Cleveland, the same one used by professional trainers across 12 states. Serious Training. Serious Results.",
      areaHeading: "Dog Training in Dallas, Fort Worth & the DFW Metroplex",
      areaText: "In-home dog training means your dog learns where the problems really happen: at the door, on the leash, and around the dogs next door.\n\nWe serve Dallas, Fort Worth, Arlington, Irving, Plano, Garland, Grand Prairie and Mesquite. Not sure if you're in range? Send the form with your ZIP and Lorenzo's office will tell you.",
      places: ["Dallas", "Fort Worth", "Arlington", "Irving", "Plano", "Garland", "Grand Prairie", "Mesquite"],
      faqs: [
        { q: "Is the dog training evaluation in Dallas really FREE?", a: "Yes. A trainer meets you and your dog, sees what is going on, and tells you what it will take. There is no cost and no obligation." },
        { q: "Do you train dogs in Fort Worth, Arlington, Irving and Plano too?", a: "Yes. We serve the Dallas-Fort Worth Metroplex. Send your ZIP and Lorenzo's office confirms your area right away." },
        { q: "Can you help an aggressive or reactive dog?", a: "Yes. Aggression, reactivity, barking and fear are behavior solutions we work on every day, with a clear, safe plan that starts at the evaluation." },
        { q: "Can you help a rescue dog?", a: "Yes. Rescues with fear, reactivity or no manners at all are some of the dogs we help most. The FREE evaluation tells you where to start." },
        { q: "How soon can we start?", a: "Send the form and Lorenzo's office follows up quickly, usually the same day, to set up your FREE evaluation." },
        { q: "Do you offer a guarantee?", a: "Every program is backed by the 90-day Limited Training Guarantee, in writing." }
      ]
    }
  },
  {
    slug: "dog-training-durham-nh",
    description: "Dog training in Durham, NH and the Seacoast: puppy training, obedience, leash pulling, aggressive and reactive dog training. FREE in-home evaluation from Lorenzo's. Serving Dover, Portsmouth & Newmarket.",
    photo: "assets/market-photos/lexington-class-group.jpg", photoName: "Real training. Real results.", photoCaption: "Calm, confident dogs and the families who trained them", word: "SEACOAST", issues: "Aggressive dogs|Leash pulling|Puppy training|Reactive dogs", proofValue: "FREE", proofLabel: "In-home evaluation", benefits: "FREE evaluation|In-home dog training|90-day guarantee", priceMode: "quiet",
    arch: "hq", mk1: "#001f42", mk2: "#d10f2d",
    tint: "0,31,66",
    tint2: "209,15,45",
    hook: "Serious Training. Serious Results. In-home dog training for Durham, Dover, Portsmouth, Newmarket and the New Hampshire Seacoast, backed by Lorenzo's proven method and 40+ years of real results.",
    title: "Dog Training in Durham, NH | Seacoast Dog Trainer Near You",
    h1: "Dog Training in Durham, NH & the Seacoast: Puppy Training, Obedience & Reactive Dog Help.",
    market: "Durham, NH",
    city: "Durham",
    state: "NH",
    area: "Durham, Dover, Portsmouth, Newmarket, Lee, Madbury, Exeter, and the New Hampshire Seacoast",
    trainers: "Lorenzo's certified trainers",
    proof: "Seacoast families get in-home dog training backed by Lorenzo's office and the method used by trainers in 12 states.",
    nearby: ["Durham", "Dover", "Portsmouth", "Newmarket", "Lee", "Madbury", "Exeter", "NH Seacoast"],
    checks: ["Aggressive and reactive dog training on trails and downtown", "Leash pulling fixed for everyday walks", "Puppy training and shelter or rescue dogs given a real start", "A FREE in-home evaluation to start"],
    care: { eyebrow: "In-home dog training", h2: "A calm, confident dog on the Seacoast.", p: "Lorenzo's proven method, built over 40+ years and used by trainers in 12 states, brought to your home in Durham and across the Seacoast.", t: "Why Seacoast families start here." },
    testis: [{ h: "Evaluated at home", p: "A trainer sees your dog where the problems happen, then tells you what it will take." }, { h: "Every dog deserves a chance", p: "Shelter and rescue dogs are some of the dogs we help most." }, { h: "Guaranteed in writing", p: "Every program carries the 90-day Limited Training Guarantee." }],
    zipCodes: ["03824"],
    v2: {
      areaKey: "durham",
      top: "FREE In-Home Dog Training Evaluations in Durham, Dover, Portsmouth & the NH Seacoast",
      svcIntro: "Looking for a dog trainer near you in Durham, NH? Lorenzo's brings in-home dog training to Durham, Dover, Portsmouth, Newmarket, Lee and Madbury: puppy training, obedience training, leash pulling, aggressive and reactive dog training, board and train, and service dog training.",
      svc: ["Puppy training in Durham: habits started right", "Obedience on trails and downtown sidewalks", "Aggressive or reactive dog? A clear plan", "Board and train with owner handoff lessons", "Service dog training after a suitability check", "Off-leash control around real distractions"],
      svcAlt: "in Durham, NH",
      founder: "In Durham and across the New Hampshire Seacoast, your request is coordinated by Lorenzo's office and matched with a trainer who uses the method Lorenzo Miller built over 40+ years in Cleveland, the same one used by professional trainers across 12 states. Serious Training. Serious Results.",
      areaHeading: "Dog Training in Durham, Dover, Portsmouth & the Seacoast",
      areaText: "In-home dog training means your dog learns where the problems really happen: at the door, on the trail, and downtown.\n\nWe serve Durham, Dover, Portsmouth, Newmarket, Lee, Madbury and Exeter. Not sure if you're in range? Send the form with your ZIP and Lorenzo's office will tell you.",
      places: ["Durham", "Dover", "Portsmouth", "Newmarket", "Lee", "Madbury", "Exeter"],
      faqs: [
        { q: "Is the dog training evaluation in Durham, NH really FREE?", a: "Yes. A trainer meets you and your dog, sees what is going on, and tells you what it will take. There is no cost and no obligation." },
        { q: "Do you offer in-home dog training in Dover, Portsmouth and Newmarket?", a: "Yes. Training happens in your home and neighborhood across the Seacoast. Board and train is also available; ask about it during your FREE evaluation." },
        { q: "Can you help an aggressive or reactive dog?", a: "Yes. Aggression, reactivity, barking and fear are behavior solutions we work on every day, with a clear, safe plan that starts at the evaluation." },
        { q: "Can you help a shelter or rescue dog?", a: "Yes. Shelter and rescue dogs are some of the dogs we help most. The FREE evaluation tells you where to start." },
        { q: "How soon can we start?", a: "Send the form and Lorenzo's office follows up quickly, usually the same day, to set up your FREE evaluation." },
        { q: "Do you offer a guarantee?", a: "Every program is backed by the 90-day Limited Training Guarantee, in writing." }
      ]
    }
  },
  {
    slug: "dog-training-flushing-ny",
    description: "Dog training in Flushing, Queens: puppy training, obedience, leash pulling, barking, aggressive and reactive dog training. FREE evaluation from Lorenzo's. Serving Bayside, Whitestone & Forest Hills.",
    photo: "assets/market-photos/chicago-training-hall.jpg", photoPos: "center 30%", photoName: "Real training, real city dogs", photoCaption: "Calm on a loose leash, ready for city life", word: "QUEENS", issues: "Leash pulling|Barking|Reactive dogs|Puppy training", proofValue: "FREE", proofLabel: "Dog training evaluation", benefits: "FREE evaluation|Queens dog training|90-day guarantee", priceMode: "quiet",
    arch: "hq", mk1: "#001f42", mk2: "#d10f2d",
    tint: "0,31,66",
    tint2: "209,15,45",
    hook: "Serious Training. Serious Results. Dog training for Flushing, Bayside, Whitestone and all of Queens: calm on the sidewalk, quiet in the apartment, polite in the elevator.",
    title: "Dog Training in Flushing, Queens NY | Dog Trainer Near You",
    h1: "Dog Training in Flushing & Queens: Puppy Training, Leash Pulling & Reactive Dog Help.",
    market: "Flushing, NY",
    city: "Flushing",
    state: "NY",
    area: "Flushing, Bayside, Whitestone, College Point, Fresh Meadows, Forest Hills, Jamaica, and Queens",
    trainers: "Lorenzo's certified trainers",
    proof: "Queens families get dog training backed by Lorenzo's office and the method used by trainers in 12 states.",
    nearby: ["Flushing", "Bayside", "Whitestone", "College Point", "Fresh Meadows", "Forest Hills", "Jamaica", "Queens"],
    checks: ["Leash pulling fixed on crowded sidewalks", "Quiet in the apartment: barking at doors, hallways and neighbors", "Aggressive and reactive dog training around dogs, people and traffic", "A FREE evaluation to start, with no obligation"],
    care: { eyebrow: "City dogs", h2: "Built for Queens life.", p: "City dogs deal with crowds, traffic, elevators and shared walls every day. We train for exactly that, so walks get easier and home gets quieter.", t: "Why Queens families start here." },
    testis: [{ h: "Evaluated first", p: "A trainer sees your dog and tells you what it will take before anyone talks plans." }, { h: "City-proof skills", p: "Sidewalks, elevators, doormen and dog runs, handled calmly." }, { h: "Guaranteed in writing", p: "Every program carries the 90-day Limited Training Guarantee." }],
    zipCodes: ["11355", "11354", "11358"],
    v2: {
      areaKey: "flushing",
      top: "FREE Dog Training Evaluations in Flushing, Bayside, Whitestone & Queens",
      svcIntro: "Looking for a dog trainer near you in Flushing, Queens? Lorenzo's dog training covers Flushing, Bayside, Whitestone, College Point, Fresh Meadows and Forest Hills: puppy training, obedience training, leash pulling, barking, aggressive and reactive dog training, board and train, and service dog training.",
      svc: ["Puppy training in Queens: apartment potty plans", "Obedience on crowded Flushing sidewalks", "Aggressive or reactive dog? A clear plan", "Board and train with owner handoff lessons", "Service dog training after a suitability check", "Control that holds around city distractions"],
      svcAlt: "in Flushing, Queens, NY",
      founder: "In Flushing and across Queens, your request is coordinated by Lorenzo's office, which calls you to set up your FREE evaluation with a trainer who uses the method Lorenzo Miller built over 40+ years in Cleveland, the same one used by professional trainers across 12 states. Serious Training. Serious Results.",
      areaHeading: "Dog Training in Flushing, Bayside, Whitestone & Queens",
      areaText: "We train where your dog lives: in the apartment, in the hallway, on the sidewalk and at the dog run.\n\nWe serve Flushing, Bayside, Whitestone, College Point, Fresh Meadows, Forest Hills and Jamaica. Not sure if you're in range? Send the form with your ZIP and Lorenzo's office will tell you.",
      places: ["Flushing", "Bayside", "Whitestone", "College Point", "Fresh Meadows", "Forest Hills", "Jamaica"],
      faqs: [
        { q: "Is the dog training evaluation in Flushing really FREE?", a: "Yes. A trainer meets you and your dog, sees what is going on, and tells you what it will take. There is no cost and no obligation." },
        { q: "Can you train an apartment dog in Queens?", a: "Yes. Barking at the door, pulling in the hallway and chaos in the elevator are everyday city problems, and we train for them." },
        { q: "Can you help an aggressive or reactive dog?", a: "Yes. Aggression, reactivity, barking and fear are behavior solutions we work on every day, with a clear, safe plan that starts at the evaluation." },
        { q: "How do I book dog training in Flushing?", a: "Send the form with your ZIP. Lorenzo's office calls you to set up your FREE evaluation at a time that works for you." },
        { q: "How soon can we start?", a: "The office follows up quickly, usually the same day you send the form." },
        { q: "Do you offer a guarantee?", a: "Every program is backed by the 90-day Limited Training Guarantee, in writing." }
      ]
    }
  }
];

// Office 2026-09-26 (DO-NOT-BREAK rule 122): Ann Arbor is OFF the ad campaign. /dog-training-ann-arbor-mi 308s to
// /contact (vercel.json) so links in emails already sent still land somewhere useful. Its record is kept here, out
// of `markets` (no page is generated, no sitemap entry, no Page Studio/office list, no re-engage link), ONLY so old
// leads that came from it keep their labels ("Ad page: Ann Arbor, MI", paid-ad pool) in lib/pipeline.js and
// lib/email-campaign.js. Dylan Atkinson's trainer page and bio page are untouched.
const retiredMarkets = [
  {
    slug: "dog-training-ann-arbor-mi",
    photo: "assets/market-photos/ann-arbor-third.jpg", heroPhoto: "assets/market-photos/ann-arbor-third.jpg", photo2: "assets/market-photos/ann-arbor-second.jpg", photoName: "Start them right", photoCaption: "New puppy, new rescue — the habits that last a lifetime", word: "PUPPY", issues: "Apartment barking|Potty training|Crate training|Leash skills", proofValue: "Apartment", proofLabel: "Friendly training plans", benefits: "Free evaluation|Small-space plans|90-day guarantee", priceMode: "forward",
    arch: "campus", mk1: "#1E3A8A", mk2: "#F0C93B",
    
    
      
    tint: "40,40,100",
    tint2: "200,16,46",
    hook: "Apartment-friendly puppy training — built for small spaces, shared walls, and busy schedules.",
    title: "Ann Arbor Dog Training",
    h1: "Puppy Accidents? Nonstop Barking? Ann Arbor Apartment & Condo Puppy Training.",
    market: "Ann Arbor, MI",
    city: "Ann Arbor",
    state: "MI",
    area: "Ann Arbor, Ypsilanti, Washtenaw County, and surrounding Southeast Michigan communities",
    trainers: "Dylan Atkinson",
    proof: "Michigan dog owners can turn to Lorenzo's for professional obedience training, behavior modification, and real-world training designed for everyday life.",
    nearby: ["Ann Arbor", "Ypsilanti", "Washtenaw County", "Southeast Michigan", "Canton"],
    checks: ["Accidents on the floor? Potty training on a schedule that works", "Barking through thin walls handled early", "Crate training without the crying", "Leash skills for busy sidewalks"],
    care: {"eyebrow": "Small spaces, big results", "h2": "Apartment life with a puppy can be calm.", "p": "Raising a puppy in an apartment comes with its own challenges. Shared walls, limited outdoor space, and busy schedules make good routines even more important. We'll help you build the skills that matter — from potty training and crate training to calm greetings, less barking, and better leash manners.", "t": "The first months, done right."},
    testis: [{"h": "Potty, solved", "p": "A schedule-based system that works without a backyard."}, {"h": "Neighbor-proof", "p": "Demand barking and door alarms quieted before they become habit."}, {"h": "Sidewalk skills", "p": "Loose-leash walking and calm greetings for a city full of people and dogs."}],
    zipCodes: ["48103", "48104", "48105", "48108", "48109"]
  }
];

const FLOWS = {
  "dog-training-san-diego-ca": ["pricing", "proof", "path", "care", "testi", "guide", "cta"],
  "dog-training-columbus-oh": ["care", "pricing", "proof", "path", "testi", "guide", "cta"],
  "dog-training-chicago-il": ["care", "path", "proof", "pricing", "testi", "cta"],
  "dog-training-tallahassee-fl": ["care", "pricing", "proof", "path", "testi", "guide", "cta"],
  "dog-training-atlanta-ga": ["path", "care", "proof", "pricing", "testi", "guide", "cta"],
  "dog-training-miramar-beach-fl": ["care", "path", "pricing", "proof", "testi", "guide", "cta"],
  "dog-training-panama-city-beach-fl": ["care", "path", "pricing", "proof", "testi", "guide", "cta"],
  "dog-training-pensacola-fl": ["care", "pricing", "proof", "path", "testi", "guide", "cta"],
  "dog-training-ann-arbor-mi": ["care", "pricing", "path", "proof", "testi", "cta"],
  // The 2.0 city pages (rule 121): the proof band (market-landing.js needs it), then the 2.0 sections, then these.
  "dog-training-navarre-fl": ["proof", "pricing", "guide", "cta"],
  "dog-training-dallas-tx": ["proof", "pricing", "guide", "cta"],
  "dog-training-durham-nh": ["proof", "pricing", "guide", "cta"],
  "dog-training-flushing-ny": ["proof", "pricing", "guide", "cta"],
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
          <span class="case-kicker">Spanish-speaking trainers</span>
          <p class="case-big" lang="es">Hablamos español.</p>
          <p class="case-note" lang="es">Nuestros entrenadores en San Antonio hablan español — sus sesiones pueden ser en español.</p>
          <p class="case-note">Same programs, same prices, same guarantee — with a Spanish-speaking trainer.</p>
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

  return { FOUNDED_YEAR, YEARS_IN_BUSINESS, markets, retiredMarkets, FLOWS, casePanels };
});
