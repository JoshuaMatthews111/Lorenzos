import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/* Frames used to be hard-coded to 4:3 while the actual files are 16:9 or square,
   so object-fit:cover quietly guillotined every photo — most visibly the square
   retrieval shot, which lost the dog's head. Read the real pixel dimensions at
   build time and let each frame take the shape of its own image. */
/* "39 years" and "since 1988" were both on the Cleveland page, in the same
   sentence. 1988 to 2026 is 38, so one of them was wrong. Derive the number from
   the founding year so the two can never disagree again, and so it stays right
   next year without anyone remembering to bump it.
   NOTE: 1988 is taken from the site's own "since 1988" line — worth confirming. */
const FOUNDED_YEAR = 1988;
const YEARS_IN_BUSINESS = new Date().getFullYear() - FOUNDED_YEAR;

function imageAspect(relPath) {
  try {
    const buf = readFileSync(resolve(process.cwd(), relPath));
    if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return `${buf.readUInt32BE(16)}/${buf.readUInt32BE(20)}`;      // PNG
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {                         // JPEG
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xc3) {
          return `${buf.readUInt16BE(i + 7)}/${buf.readUInt16BE(i + 5)}`;
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch { /* fall through to the default below */ }
  return null;
}

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
    photo: "assets/market-photos/lorenzo-pack-down-stay.jpg", photoName: "Real results", photoCaption: "Twenty-plus dogs, one calm down-stay", word: "BEHAVIOR", issues: "Barking|Leash pulling|Jumping|Won't listen", proofValue: "3 trainers", proofLabel: "Living in the area", benefits: "Free evaluation|Behavior specialists|90-day guarantee", priceMode: "quiet",
    arch: "coast", mk1: "#14337A", mk2: "#E8EFF9",
    tint: "20,51,122",
    tint2: "21,37,105",
    hook: "Three Lorenzo's trainers live right here \u2014 Pensacola, Navarre, and Crestview. Behavior help starts with a free local evaluation.",
    title: "Pensacola Dog Training",
    h1: "Barking, Pulling, Ignoring You? Pensacola Dog Behavior & Obedience Training.",
    market: "Pensacola, FL",
    city: "Pensacola",
    state: "FL",
    area: "Pensacola, Navarre, Gulf Breeze, Milton, Pace, Crestview, Escambia and Santa Rosa County, and nearby Northwest Florida communities",
    trainers: "Clark Patton, Michael King, Daniel Bainbridge",
    proof: "Three Lorenzo's trainers live in the Pensacola area, so obedience, behavior modification, puppy training, and specialty requests get a local answer through Lorenzo's office.",
    nearby: ["Pensacola", "Navarre", "Gulf Breeze", "Milton", "Pace"],
    checks: ["Barking, pulling, jumping, and flat-out ignoring you", "Obedience that holds around real distractions", "Three trainers living in Escambia and Santa Rosa County", "Free evaluation with a local trainer"],
    care: {"eyebrow": "Behavior first", "h2": "Barking, pulling, ignoring you \u2014 that is behavior, not stubbornness.", "p": "Most Pensacola owners do not need a new command. They need the dog to actually do the one it already knows. We fix the behavior underneath it, then build obedience that holds at the door, on the leash, and around other dogs.", "t": "What behavior training covers."},
    testis: [{"h": "Quiet at the door", "p": "Barking at the mail, the neighbor, and the doorbell handled with a plan, not a shout."}, {"h": "A leash you can hold", "p": "No dragging, no zig-zagging \u2014 a walk you would actually take again."}, {"h": "Listening under pressure", "p": "Commands that hold with people, dogs, and distractions in the mix."}],
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

const metaPixelId = '3790623554504010'

/* Meta pixel. Without it Meta cannot see which ads produced a lead, so it
   cannot learn who to show ads to, and visitors who read a page and left can
   never be retargeted. The form submit fires a Lead event so Meta optimises
   toward people who actually enquire rather than people who merely click. */
const metaPixelHead = () => `<script>
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${metaPixelId}');
    fbq('track', 'PageView');
    document.addEventListener('submit', function(e){
      var f = e.target;
      if (!(f instanceof HTMLFormElement) || typeof fbq !== 'function') return;
      if (f.classList.contains('contact-intake')) fbq('track', 'Lead', { value: 250, currency: 'USD' });
      if (f.classList.contains('pdf-optin')) fbq('track', 'CompleteRegistration', { value: 25, currency: 'USD' });
    }, true);
  </script>
  <noscript><img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1" alt=""></noscript>`

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
  "dog-training-columbus-oh": ["care", "pricing", "proof", "path", "testi", "guide", "cta"],
  "dog-training-chicago-il": ["care", "path", "proof", "pricing", "testi", "cta"],
  "dog-training-tallahassee-fl": ["care", "pricing", "proof", "path", "testi", "guide", "cta"],
  "dog-training-atlanta-ga": ["path", "care", "proof", "pricing", "testi", "guide", "cta"],
  "dog-training-miramar-beach-fl": ["care", "path", "pricing", "proof", "testi", "guide", "cta"],
  "dog-training-panama-city-beach-fl": ["care", "path", "pricing", "proof", "testi", "guide", "cta"],
  "dog-training-pensacola-fl": ["care", "path", "proof", "pricing", "testi", "guide", "cta"],
  "dog-training-ann-arbor-mi": ["care", "pricing", "path", "proof", "testi", "cta"],
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

const page = market => {
  const metaDescription = `Request ${market.market} dog training from Lorenzo's Dog Training Team. Obedience training, puppy training, dog behavior modification, and advanced programs with fast local follow-up.`;
  const nearby = market.nearby.map(place => `<span>${escapeHtml(place)}</span>`).join("");
  const zipCodes = market.zipCodes.map(zip => `<span>${escapeHtml(zip)}</span>`).join("");
  const SEC = {
    proof: `    <section class="ad-proof-band-v2">
      <div class="container ad-proof-grid-v2">
        <div><strong>${YEARS_IN_BUSINESS}</strong><span>Years of experience</span></div>
        <div><strong>100,000+</strong><span>Dogs trained of all breeds</span></div>
        <div><strong>50+</strong><span>Professional trainers nationwide</span></div>
        <div><strong>${escapeHtml(market.proofValue)}</strong><span>${escapeHtml(market.proofLabel)}</span></div>
      </div>
    </section>`,
    path: `    <section id="market-services" class="section market-path-section">
      <div class="container market-section-grid">
        <div>
          <span class="eyebrow">Training built for real life</span>
          <h2>A clearer path for your dog.</h2>
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
            <p>Every LDTT program is backed by our Limited Training Guarantee. If your dog isn&rsquo;t demonstrating the behaviors covered in your program within 90 days of completion, reach out to us. As long as you&rsquo;ve followed your trainer&rsquo;s instructions and recommended practice plan, we&rsquo;ll provide the corrective instruction or follow-up training needed &mdash; at <b>no additional training fee</b>.</p>
            <p class="g-commit">Our commitment is simple: we&rsquo;ll do our part, give you the tools to do yours, and stand behind the training we provide.</p>
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
            <p>Every LDTT program is backed by our Limited Training Guarantee. If your dog isn&rsquo;t demonstrating the behaviors covered in your program within 90 days of completion, reach out to us. As long as you&rsquo;ve followed your trainer&rsquo;s instructions and recommended practice plan, we&rsquo;ll provide the corrective instruction or follow-up training needed &mdash; at <b>no additional training fee</b>.</p>
            <p class="g-commit">Our commitment is simple: we&rsquo;ll do our part, give you the tools to do yours, and stand behind the training we provide.</p>
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
        ${market.photo2 ? `<figure class="market-care-photo"><img src="${escapeHtml(market.photo2)}" alt="${escapeHtml(market.photo2Alt)}" style="${imageAspect(market.photo2) ? `--ar:${imageAspect(market.photo2)};` : ""}object-position:${market.photo2Pos || "center"}" loading="lazy" decoding="async"></figure>` : ""}
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
        <!-- Reviews published to this city page from the staff portal render here.
             Hidden until the API returns at least one review for this destination. -->
        <section class="ad-city-reviews" data-approved-market-reviews data-review-destination="${market.slug}" hidden>
          <h2>What ${escapeHtml(market.city)} families say</h2>
          <div class="review-shot-grid ad-city-review-grid" data-approved-market-review-grid></div>
        </section>
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
    // Only ONE physical location exists — the Cleveland HQ, and it is in Garfield
    // Heights, not Cleveland. Every page used to publish a PostalAddress in its own
    // market city, which tells Google there is a branch in San Diego, Chicago and so
    // on. The other nine are service areas covered by trainers, so they carry
    // areaServed and no address. Omitting an address is valid; inventing one is not.
    "@type": market.slug === "dog-training-cleveland-oh" ? "LocalBusiness" : "ProfessionalService",
    name: `Lorenzo's Dog Training Team — ${market.market}`,
    url: `https://www.lorenzosdogtrainingteam.com/${market.slug}`,
    telephone: "+1-866-436-4959",
    priceRange: "$1,250+",
    ...(market.slug === "dog-training-cleveland-oh" ? { address: { "@type": "PostalAddress", streetAddress: "4805 Orchard Rd", addressLocality: "Garfield Heights", addressRegion: "OH", addressCountry: "US" } } : {}),
    areaServed: market.nearby,
    description: metaDescription
  })}</script>
  ${googleAdsHead()}
  ${metaPixelHead()}
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
    .market-trainer-media img{width:auto;max-width:100%;height:auto;min-height:0;aspect-ratio:var(--ar,16/9);object-fit:contain;margin-inline:auto;display:block}
    .market-trainer-media figcaption strong{display:block}

    /* ═══ per-market design archetypes ═══ */
    /* HQ — Cleveland: navy ground, the facility as a full-width banner */
    .arch-hq .market-hero{background:var(--mk1)}
    .arch-hq .market-hero-bg{opacity:.14}
    .arch-hq .market-copy h1,.arch-hq .market-copy .ad-lead{color:#fff}
    .arch-hq .market-copy .ad-lead.market-hook{background:rgba(255,255,255,.1);color:#fff;border-left-color:var(--mk2)}
    .arch-hq .market-trainer-media{min-height:0;height:auto;width:100%;max-width:860px;margin-inline:auto;overflow:hidden;border:6px solid #fff;border-radius:16px;box-shadow:0 24px 56px rgba(0,0,0,.4)}
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
    .arch-metro .market-trainer-media{border:10px solid #fff;box-shadow:0 22px 45px rgba(0,0,0,.45)}
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
    .arch-resort .market-trainer-media{border:8px solid #fff;border-bottom-width:30px;box-shadow:0 16px 34px rgba(0,0,0,.28)}

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
    /* These five archetypes run a LIGHT hero, but .market-copy still inherited the
       white text colour used by the dark ones. h1 and .ad-lead each carried their
       own override so they looked fine, and everything else — the "we also train"
       strip most visibly — rendered white on near-white and vanished. Colour the
       container itself so anything added later inherits something readable. */
    .arch-portrait .market-copy,.arch-heritage .market-copy,
    .arch-coast .market-copy,.arch-campus .market-copy,
    .arch-portrait2 .market-copy{color:#3c4258}
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
    .arch-portrait .ad-benefit-row span,.arch-heritage .ad-benefit-row span,
    .arch-campus .ad-benefit-row span,.arch-portrait2 .ad-benefit-row span{
      background:rgba(19,26,51,.07) !important;border:1px solid rgba(19,26,51,.18);color:#131a33 !important}

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
    /* Arrison, Chicago: flex + space-between sized each stat to its own text, so the four
       sat at uneven widths (224/367/356/290) and the longer labels wrapped below ~1100px.
       Four equal columns spread them across the full banner; nowrap + a fluid label size
       keeps every label on one line all the way down to the mobile breakpoint. */
    .arch-metro .ad-proof-grid-v2{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;align-items:center}
    .arch-metro .ad-proof-grid-v2 span{white-space:nowrap;font-size:clamp(.56rem,.86vw,.78rem)}
    .arch-metro .ad-proof-grid-v2 strong{white-space:nowrap}
    /* Below ~980px four equal columns get too narrow for "Professional trainers nationwide"
       (it overflowed its cell by 12px at 820px). Two columns give each label room to stay
       on one line and still read as a spread band rather than a wrapped list. */
    @media(max-width:980px){
      .arch-metro .ad-proof-grid-v2{grid-template-columns:repeat(2,minmax(0,1fr))}
      .arch-metro .ad-proof-grid-v2 span{font-size:clamp(.6rem,1.5vw,.78rem)}
    }
    @media(max-width:520px){
      .arch-metro .ad-proof-grid-v2{grid-template-columns:1fr}
      .arch-metro .ad-proof-grid-v2 span{font-size:.72rem}
    }
    .arch-metro .ad-proof-grid-v2 > div{display:flex;align-items:baseline;gap:8px;padding:14px 8px}
    .arch-metro .ad-proof-grid-v2 strong{font-size:30px}

    /* SPECIALTY: editorial single-column services, centered, gold rules */
    .arch-specialty .market-service-grid{display:block;max-width:640px;margin:0 auto}
    .arch-specialty .market-service-grid article{background:transparent;border:none;border-bottom:1px solid var(--mk2);
      border-radius:0;text-align:center;padding:26px 8px}
    .arch-specialty .market-service-grid article span{color:var(--mk2);letter-spacing:.3em}
    .arch-specialty .ad-proof-band-v2{background:#0d0a16;border-block:1px solid var(--mk2)}

    /* COAST + RESORT: proof stats as floating pills, services rounded */
        /* Was transparent on both. On these light pages the white numbers landed on a
       near-white ground at 1.05:1 — the 39 years / 100,000+ dogs credibility strip
       was effectively invisible. Rachel reported it on Tallahassee; it was here too. */
    .arch-coast .ad-proof-band-v2,.arch-resort .ad-proof-band-v2{background:var(--mk1)}
    .arch-coast .ad-proof-band-v2 strong,.arch-resort .ad-proof-band-v2 strong{color:#fff}
    .arch-coast .ad-proof-band-v2 span,.arch-resort .ad-proof-band-v2 span{color:#e6f3f8}
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

    /* Arrison: the "clearer path" block has exactly 4 items, so 2x2 always
       balances — auto-fit was leaving a 3+1 orphan row at some widths. */

    /* Arrison #5: the dog mark fills the dead white space behind this section.
       Watermark only — sits under the content and ignores the pointer. */
    .market-path-section{position:relative;overflow:hidden}
    .market-path-section::after{
      content:"";position:absolute;right:-40px;bottom:-30px;width:min(46vw,520px);
      aspect-ratio:443/258;background:url("assets/ldtt-dog-mark.png") no-repeat center/contain;
      opacity:.06;pointer-events:none;z-index:0}
    .market-path-section > *{position:relative;z-index:1}

    /* Arrison, Columbus #1: white on tan under the consultation button was unreadable. */
    .arch-resort .market-primary-cta + *,
    .arch-resort .market-cta-note,
    .market-landing .market-cta-note{color:#3c4258}

    /* City reviews published from the staff portal */
    .ad-city-reviews{margin:56px 0 8px}
    .ad-city-reviews h2{margin-bottom:18px}
    .ad-city-review-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));grid-auto-flow:row;gap:20px}
    .ad-city-review-grid .review-shot-card{background:#fff;border:1px solid rgba(9,30,66,.12);color:inherit}
    /* Footer reads as one line: '... Serious Results. | (866) 436-4959'.
       styles.css sets .footer a{display:block}, which was pushing the phone
       onto its own line no matter what white-space said. */
    .subfooter{white-space:nowrap}
    .subfooter a{display:inline;margin:0}
    .subfooter-tel{white-space:nowrap}
    @media (max-width:560px){.subfooter{white-space:normal}}

    /* giant market word — personality, not decoration: names the page's mission */
    .market-copy{position:relative;padding-top:calc(clamp(64px,11vw,150px) + 12px)}
    .market-word{position:absolute;top:0;left:-6px;font-size:clamp(64px,11vw,150px);font-weight:900;
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
    /* Rachel, Tallahassee: "either the banner or the data within it should be
       another color. They are both white so the data blends in." portrait2 had no
       band background at all, so white text landed on a white band. */
    .arch-portrait2 .ad-proof-band-v2{background:var(--mk1)}
    .arch-portrait2 .ad-proof-band-v2 strong{color:#fff}
    .arch-portrait2 .ad-proof-band-v2 span{color:#e2e7f5}

    /* A brand mark in the second media slot needs padding and a light ground,
       otherwise it reads as a broken photo. */
    .market-landing .market-care-photo img[src$="ldtt-dog-mark.png"]{
      max-height:190px;padding:34px 28px;background:#fff;border-radius:14px;
      box-shadow:0 10px 26px rgba(12,20,45,.10)}

    /* Arrison, Cleveland #3: "stretch the blue across the width of the site where
       the ticker is". arch-hq had no band background, so it rendered white. */
    .arch-hq .ad-proof-band-v2{background:var(--mk1)}
    .arch-hq .ad-proof-band-v2 strong{color:#fff}
    .arch-hq .ad-proof-band-v2 span{color:#d7e0f5}

    /* Hero video sits in the same frame as the hero image and follows the same
       rule: show all of it, never crop. */
    .market-landing .market-hero-video{aspect-ratio:16/9;width:auto;max-width:100%;
      height:auto;max-height:440px;display:block;object-fit:contain;background:#0b1220;
      margin-inline:auto;border-radius:10px}

    /* Arrison #4: exactly 4 items, so auto-fit kept leaving a 3+1 orphan row.
       2x2 is always balanced. Declared after the archetype overrides above,
       which is the only reason it wins — same specificity, later position. */
    .market-landing .market-service-grid{grid-template-columns:1fr 1fr}
    @media (max-width:760px){.market-landing .market-service-grid{grid-template-columns:1fr}}
    @media(max-width:700px){
      .market-copy{padding-top:calc(clamp(44px,15vw,80px) + 10px)}
      .market-word{font-size:clamp(44px,15vw,80px);top:0}
      .price-big{font-size:clamp(40px,12vw,56px)}
      .guarantee-band{padding:20px 18px}
      .g-badge{width:80px;height:80px;font-size:13px}
    }

    /* 5) The market word must be visible on light heroes too. */
    .arch-portrait .market-word,.arch-heritage .market-word,.arch-coast .market-word,
    .arch-campus .market-word,.arch-portrait2 .market-word{-webkit-text-stroke:2px rgba(19,26,51,.14)}

    /* ═══ hero video card — static, self-contained (styles.css only styles it
       under funnel-redesign scopes that market pages never carry) ═══ */
    /* styles.css:420 pins .ad-hero-video-card to aspect-ratio:16/9. The reel is 9:16,
       so the frame inside grew ~318px taller than this figure and the hero section's
       overflow:hidden sliced the bottom off behind the blue stats band. The figure
       must size to its contents, not to a fixed 16:9 box. */
    .market-landing .ad-hero-video-card{min-height:0;border:0;border-radius:16px;background:#fff;
      aspect-ratio:auto;height:auto;
      padding:10px 10px 14px;box-shadow:0 20px 50px rgba(10,16,40,.32);align-self:start}
    .market-landing .ad-hero-video-card .ad-video-frame{position:relative;border-radius:10px;overflow:hidden;background:#071a34}
    /* Arrison #2: bigger frame, and the ad-campaign reel is 9:16 — forcing it into
       a 16:9 box with cover was cropping it. Let the frame take the video's shape
       and constrain by height instead. */
    /* The reel is 9:16. Size the FRAME explicitly and let the video fill it —
       width:fit-content here collapsed the frame to 0px, because the only child
       sized itself from the parent it was supposed to be sizing. */
    .market-landing .ad-hero-video-card .ad-video-frame{
      position:relative;width:100%;max-width:340px;margin-inline:auto;
      aspect-ratio:720/1180;border-radius:12px;overflow:hidden;background:#000}
    .market-landing .ad-hero-video-card video,
    .market-landing .ad-hero-video-card .ad-video-cover,
    .market-landing .ad-hero-video-card .ad-video-cover img{
      width:100%;height:100%;display:block;object-fit:cover;border-radius:12px}
    .market-landing .ad-hero-video-card{max-width:340px;margin-inline:auto}
    /* caption sits under the video and is allowed to wrap instead of being clipped */
    .market-landing .ad-hero-video-card figcaption{padding:12px 6px 0;max-width:100%}
    .market-landing .ad-hero-video-card figcaption strong{display:block;white-space:normal;line-height:1.3}
    .market-landing .ad-hero-video-card figcaption span{display:block;white-space:normal;line-height:1.45}
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

    /* ═══ case panels — designed media for pages where a photo would mislead ═══ */
    /* Arrison: San Antonio and Ann Arbor showed NO photo at all, because a case panel
       replaces the hero figure entirely. Render the photo above the panel instead of
       choosing between them — the panel copy (Spanish/military, apartment puppy plan)
       is real conversion content and should not be traded away for an image. */
    /* one grid cell holding photo above panel — both carried .market-hero-media before,
       so they were assigned the same grid-area and stacked on top of each other. */
    .market-landing .market-hero-stack{display:flex;flex-direction:column;gap:14px;align-self:start}
    .market-landing .market-hero-stack .market-case-panel{width:100%}
    .market-landing .market-hero-photo-with-panel{margin:0;border-radius:16px;overflow:hidden;
      box-shadow:0 20px 50px rgba(10,16,40,.28);aspect-ratio:var(--ar,16/10)}
    .market-landing .market-hero-photo-with-panel img{width:100%;height:100%;object-fit:cover;display:block}
    .market-landing .market-hero-photo-with-panel::after{content:none !important}
    /* Arrison, San Diego: styles.css:416 lays a dark gradient (transparent 44% -> rgba(2,18,39,.88))
       over EVERY .market-hero-media. That exists to darken a photo behind white text — but a case
       panel is a white card, and the overlay was swallowing the price rows, the note, and the
       "Book the Free Evaluation" button underneath it. Kill it on case panels only. */
    .market-landing .market-case-panel::after{content:none !important;background:none !important}
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
    .market-care-photo img{width:auto;max-width:100%;height:auto;min-height:0;max-height:340px;aspect-ratio:var(--ar,16/9);object-fit:contain;margin-inline:auto;display:block}

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
    }
    /* media never crops the subject into mystery meat */
    .market-landing .market-trainer-media{min-height:0;align-self:start}
    /* ...and the frame hugs the image so a square photo does not leave a
       wide dark gutter beside it. */
    .market-landing .market-trainer-media,
    .market-landing .market-care-photo{width:fit-content;max-width:100%;margin-inline:auto}

    /* Frame takes the image's own shape, so cover has nothing left to crop.
       Height is the constraint and width follows, which keeps a square photo
       square instead of guillotining it into a letterbox. */
    .market-landing .market-trainer-media img{aspect-ratio:var(--ar,16/9);
      width:auto;max-width:100%;height:auto;min-height:0;max-height:440px;
      object-fit:contain;margin-inline:auto;display:block}
    .arch-hq .market-trainer-media img{aspect-ratio:var(--ar,16/9);width:auto;max-width:100%;height:auto;max-height:440px;object-fit:contain;margin-inline:auto}
    .market-landing .market-care-photo img{aspect-ratio:var(--ar,16/9);width:auto;max-width:100%;height:auto;min-height:0;max-height:340px;object-fit:contain;margin-inline:auto;display:block}

    /* price pill — the price is part of the offer on forward markets */
    .market-landing .ad-benefit-row .price-pill{background:#C8102E !important;color:#fff !important;
      border:none !important;font-weight:800;letter-spacing:.02em}

    /* The SMS consent box read as an error/required field in red, which the
       office believes was suppressing form completions. Calm blue + an explicit
       "optional" line above it. */
    .market-consult-panel .consent-optional{margin:14px 0 4px;font-size:13px;color:#1E3A8A !important}
    .market-consult-panel .consent-row{background:#eef4ff !important;border:1px solid #b9cdf0 !important;
      border-radius:10px;padding:12px !important}
    .market-consult-panel .consent-row span{color:#28324d !important}
    .market-consult-panel .consent-row a{color:#1E3A8A !important}

    /* Services strip — the office asked that visitors see we do more than the
       one service this page leads with, near the top. */
    .market-services-strip{margin:14px 0 0;font-size:13.5px;line-height:1.7}
    .market-services-strip b{display:block;font-size:12px;letter-spacing:.14em;
      text-transform:uppercase;margin-bottom:6px;opacity:.85}
    .market-services-strip a{color:inherit;text-decoration:none;border-bottom:1px solid currentColor;
      padding-bottom:1px;margin-right:4px;white-space:nowrap}
    .market-services-strip a:hover{opacity:.75}

    /* 6) Proof-band floor: numbers and labels always readable on their band. */
    .ad-proof-band-v2 strong,.ad-proof-grid-v2 strong{color:#fff !important}
    .ad-proof-band-v2 span,.ad-proof-grid-v2 span{color:#c9d2ec !important}
    .arch-coast .ad-proof-grid-v2 span,.arch-resort .ad-proof-grid-v2 span{color:#e6f3f8 !important}
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
          <a class="ad-rating-row" href="https://www.google.com/search?q=Lorenzo%27s+Dog+Training+Team+reviews" target="_blank" rel="noopener" aria-label="Read Lorenzo's Dog Training Team Google reviews">
            <span>★★★★★</span>
            <strong>600+ Google reviews · ${escapeHtml(market.market)}</strong>
          </a>
          <h1>${escapeHtml(market.h1)}</h1>
          <p class="ad-lead market-hook"><strong>${escapeHtml(market.hook)}</strong></p>
          <p class="ad-lead">Tell us what&rsquo;s going on with your dog. A member of our team will reach out to discuss your concerns and arrange your <b>free</b> evaluation.</p>
          ${market.spanish ? `<p class="ad-lead market-spanish"><strong>Spanish-speaking trainers.</strong> <span lang="es">Nuestros entrenadores en ${escapeHtml(market.city)} hablan español — sus sesiones de entrenamiento pueden ser en español.</span> Please send your request in English so our office can route it quickly.</p>` : ""}
          <div class="ad-benefit-row">
            ${market.priceMode === "forward" ? `<span class="price-pill">Training from $1,250</span>` : ""}
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
          <p class="market-services-strip">
            <b>We also train</b>
            <a href="#market-services">Obedience</a> &middot;
            <a href="#market-services">Puppy training</a> &middot;
            <a href="#market-services">Behavior &amp; aggression</a> &middot;
            <a href="#market-services">Board &amp; train</a> &middot;
            <a href="#market-services">Service &amp; specialty</a>
          </p>
        </div>

        ${casePanels[market.slug] ? (market.heroPhoto ? `<div class="market-hero-media market-hero-stack">
          <figure class="market-hero-photo-with-panel">
            <img src="${escapeHtml(market.heroPhoto)}" alt="${escapeHtml(market.photoName || market.market + " dog training")}"${imageAspect(market.heroPhoto)} loading="eager" decoding="async">
          </figure>
          ${casePanels[market.slug]}
        </div>` : casePanels[market.slug]) : `<figure class="market-hero-media market-trainer-media">
          ${market.heroVideo ? `<video class="market-hero-video" src="${escapeHtml(market.heroVideo)}" poster="${escapeHtml(market.heroPoster || "")}" autoplay muted loop playsinline preload="auto" aria-label="${escapeHtml(market.photoName)}"></video>
          <script>(function(){var v=document.currentScript.previousElementSibling;if(!v)return;
            var go=function(){var p=v.play();if(p&&p.catch)p.catch(function(){});};
            go();
            v.addEventListener("canplay",go,{once:true});
            document.addEventListener("visibilitychange",function(){if(!document.hidden)go();});
            /* Some browsers refuse muted autoplay until the visitor interacts at all.
               The poster covers that gap; this starts the loop the moment they do
               anything, so it is never a dead frame. */
            ["pointerdown","touchstart","scroll","keydown"].forEach(function(evt){
              document.addEventListener(evt,go,{once:true,passive:true});
            });
            /* Don't burn battery/bandwidth while it is off screen. */
            if(window.IntersectionObserver){new IntersectionObserver(function(es){
              es.forEach(function(e){e.isIntersecting?go():v.pause();});
            },{threshold:0.1}).observe(v);}
          })();<\/script>` : `<img src="${escapeHtml(market.photo)}" alt="${escapeHtml(market.photoName)} — ${escapeHtml(market.market)}" style="${imageAspect(market.photo) ? `--ar:${imageAspect(market.photo)};` : ""}object-position:${market.photoPos || "center"}" loading="eager" fetchpriority="high" decoding="async">`}
          <figcaption>
            <strong>${escapeHtml(market.photoName)}</strong>
            <span>${escapeHtml(market.photoCaption)}</span>
          </figcaption>
        </figure>`}

        ${market.slug === "dog-training-cleveland-oh" ? `<figure class="market-hero-media ad-hero-video-card">
          <div class="ad-video-frame">
            <button class="ad-video-cover" type="button" data-video-cover aria-label="Play real client results video">
              <img src="assets/video/ldtt-cleveland-ad-reel-poster.jpg" alt="Real client results video cover" loading="lazy" decoding="async">
              <span class="video-bubble">Real Client Results</span>
              <span class="video-play-mark" aria-hidden="true">&#9654;</span>
            </button>
            <video controls preload="metadata" poster="assets/video/ldtt-cleveland-ad-reel-poster.jpg" playsinline>
              <source src="assets/video/ldtt-cleveland-ad-reel.mp4" type="video/mp4">
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
            <p>Tell us what&rsquo;s going on with your dog. A member of our team will reach out to discuss your concerns and arrange your <b>free</b> evaluation.</p>
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
              <textarea name="comments" rows="3" placeholder="Example: pulling on leash, barking, jumping, potty training, aggression, anxiety..."></textarea>
            </label>
            <p class="consent-optional"><b>Optional &mdash; not required to book your evaluation.</b></p>
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
    <div class="container subfooter">&copy; Lorenzo's Dog Training Team. Serious Training. Serious Results.<span class="subfooter-tel"> | <a href="tel:+18664364959">(866) 436-4959</a></span></div>
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
