// Pre-evaluation questions (Joshua 2026-09-14, from "Evaluation Questions.pages"; meeting 2026-09-12
// [0:47:30-0:55:56]). The client answers them AFTER booking, from the confirmation text's link
// (/book/<trainer>?lead=<id>&step=questions). They set up the sale: the trainer reads them before the visit.
// Practice copy only (the booking routes answer 404 on live, rule 71). DO-NOT-BREAK rule 81.
//
// Section 1's name / breed / age / sex / spayed / vaccinations were already asked at booking (Rachel's
// 11 Alpha fields), so they are never asked twice: section 1 only adds the two new questions per dog.
// Few questions are required on purpose ("keep this extremely easy, the goal is completion momentum").
const YES_NO = ["Yes", "No"];

const SECTIONS = [
  {
    key: "dog", title: "Meet your dog", hint: "Two quick ones about each dog you booked.", perDog: true,
    fields: [
      { key: "time_with_family", label: "How long has {dog} been part of your family?", type: "text", placeholder: "e.g. 2 years" },
      { key: "where_from", label: "Where did you get {dog}?", type: "radio", choices: ["Breeder", "Rescue", "Shelter", "Rehomed", "Other"] }
    ]
  },
  {
    key: "why", title: "What made you reach out to us?",
    fields: [
      { key: "top_behavior", label: "What is the #1 behavior you want help with?", type: "textarea", required: true },
      { key: "behaviors", label: "Which behaviors are you seeing now? Pick all that apply.", type: "checks", choices: ["House training", "Pulling on leash", "Jumping", "Excessive barking", "Chewing/destructive behavior", "Running away/poor recall", "Not listening to commands", "Reactivity toward dogs", "Reactivity toward people", "Biting/nipping", "Resource guarding", "Separation-related behavior", "Fear/anxiety", "Digging", "Eating inappropriate objects", "Eating stool", "Other"] },
      { key: "when", label: "When does it happen most often? Pick all that apply.", type: "checks", choices: ["At home", "On walks", "Around visitors", "Around children", "Around other dogs", "In public", "When left alone", "During feeding", "Other"] },
      { key: "how_often", label: "How often does the problem happen?", type: "radio", choices: ["Multiple times a day", "Daily", "Several times a week", "Occasionally"] },
      { key: "disruption", label: "How much does it disrupt your household?", type: "scale", choices: ["1", "2", "3", "4", "5"], low: "Minor inconvenience", high: "It really affects our daily life" },
      { key: "stopped_doing", label: "What has this behavior stopped you from doing with your dog?", type: "textarea", hint: "For example: walking together, having guests over, taking your dog places, relaxing at home, traveling, letting your children play freely." }
    ]
  },
  {
    key: "tried", title: "What you have tried",
    fields: [
      { key: "tried", label: "What have you already tried? Pick all that apply.", type: "checks", choices: ["Previous professional trainer", "Group classes", "Online/video training", "Training collar/device", "Treat/reward training", "Correcting the behavior myself", "Nothing yet", "Other"] },
      { key: "tried_result", label: "What happened?", type: "radio", choices: ["Solved it", "Helped for a while", "Helped somewhat", "No real improvement", "Made the problem worse"] },
      { key: "why_hard", label: "What do you think has made this hard to solve so far?", type: "textarea" }
    ]
  },
  {
    key: "goals", title: "If training works exactly the way you hope",
    fields: [
      { key: "goals", label: "What does life with your dog look like? Pick all that apply.", type: "checks", choices: ["Walk calmly without pulling", "Come reliably when called", "Follow commands the first time", "Stay calm around guests", "Behave well around other dogs", "Behave well in public", "Stop jumping", "Stop destructive behavior", "Better house training", "Trustworthy off leash", "More confidence, less fear", "Better communication between us", "Other"] },
      { key: "one_result", label: "Of everything you picked, which ONE result matters most to you?", type: "text" },
      { key: "why_now", label: "Why is it important to solve this now?", type: "textarea" }
    ]
  },
  {
    key: "safety", title: "Help us prepare for your evaluation", hint: "These keep you, your dog and your trainer safe.",
    fields: [
      { key: "bite_history", label: "Has your dog ever bitten a person?", type: "radio", required: true, choices: ["No", "Attempted bite", "Bite without broken skin", "Bite that broke skin", "Bite that needed medical treatment"] },
      { key: "bite_details", label: "Please briefly describe what happened and what set it off.", type: "textarea", showIf: { key: "bite_history", not: "No" } },
      { key: "injured_animal", label: "Has your dog ever seriously injured another animal?", type: "radio", choices: YES_NO },
      { key: "guarding", label: "Does your dog guard food, toys, furniture, people or other things?", type: "radio", choices: YES_NO },
      { key: "strangers", label: "Does your dog get fearful, reactive or aggressive when strangers come into the home?", type: "radio", choices: YES_NO },
      { key: "escaped", label: "Has your dog ever escaped or tried to escape the home or yard?", type: "radio", choices: YES_NO },
      { key: "children", household: true, label: "Are there children in the household?", type: "radio", required: true, choices: YES_NO },
      { key: "other_animals", household: true, label: "Are there other animals in the household?", type: "radio", required: true, choices: YES_NO },
      { key: "before_entering", household: true, label: "Is there anything the trainer should know BEFORE coming into your home?", type: "textarea" }
    ]
  },
  {
    key: "health", title: "Health",
    fields: [
      { key: "medical", label: "Does your dog have a medical condition, injury, allergy or physical limit that could affect training?", type: "radio", choices: YES_NO },
      { key: "medical_details", label: "What is it?", type: "textarea", showIf: { key: "medical", is: "Yes" } },
      { key: "medication", label: "Does your dog take any medication now?", type: "radio", choices: YES_NO },
      { key: "medication_details", label: "Which medication, and what is it for?", type: "text", showIf: { key: "medication", is: "Yes" } },
      { key: "vet_name", household: true, label: "Primary veterinarian", type: "text" },
      { key: "vet_phone", household: true, label: "Veterinarian phone", type: "tel" },
      { key: "food", label: "Current food", type: "text" },
      { key: "diet", label: "Any dietary restrictions or allergies?", type: "text" }
    ]
  },
  {
    key: "life", title: "Daily life",
    fields: [
      { key: "responsible", household: true, label: "Who is mainly responsible for the dog's training and care?", type: "text" },
      { key: "others", household: true, label: "Who else spends time with the dog regularly? Pick all that apply.", type: "checks", choices: ["Adults", "Children", "Other household members", "Pet sitter or dog walker"] },
      { key: "exercise", label: "About how much exercise does your dog get each day?", type: "text", placeholder: "e.g. two 20-minute walks" },
      { key: "day_spot", label: "Where does your dog spend most of the day?", type: "radio", choices: ["Loose inside", "Crate", "Designated room", "Yard", "Daycare", "Combination"] },
      { key: "sleeps", label: "Where does your dog sleep?", type: "text" },
      { key: "commands", label: "Which commands does your dog reliably know today? Pick all that apply.", type: "checks", choices: ["Sit", "Down", "Stay", "Come", "Heel", "Place", "Leave it", "Drop it", "None reliably", "Other"] }
    ]
  }
];

const LIMITS = { text: 300, tel: 40, textarea: 2000 };
const MAX_DOGS = 6;
const scrub = value => String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();

function shown(field, answers) {
  if (!field.showIf) return true;
  const other = answers[field.showIf.key];
  if (field.showIf.is !== undefined) return other === field.showIf.is;
  return Boolean(other) && other !== field.showIf.not;
}

function cleanField(field, raw) {
  if (field.type === "checks") {
    const picked = Array.isArray(raw) ? raw.map(scrub) : [];
    return field.choices.filter(choice => picked.includes(choice));
  }
  const text = scrub(raw);
  if (["radio", "scale"].includes(field.type)) return field.choices.includes(text) ? text : "";
  return text.slice(0, LIMITS[field.type] || LIMITS.text);
}

// Office 2026-10-03: with two or more dogs every dog question (all but the household ones and section 1,
// which is already per dog) is asked again for each extra dog. Dog 1 keeps the top-level keys (old answers
// read the same); dog 2.. live in answers.more_dogs[i - 1]. Household questions are asked once.
const dogField = (section, field) => !section.perDog && !field.household;

// Keeps only known questions, only listed choices, capped lengths, no control characters. A follow-up box
// whose trigger is not met is dropped. Required questions answer 400 when empty.
function cleanAnswers(body = {}, dogNames = []) {
  const input = body && typeof body === "object" ? body : {};
  const answers = {};
  const errors = [];
  const count = Math.max(1, Math.min(MAX_DOGS, dogNames.length || 1));
  for (const section of SECTIONS) {
    if (section.perDog) {
      const rawDogs = Array.isArray(input.dogs) ? input.dogs : [];
      answers.dogs = Array.from({ length: count }, (_, i) => {
        const src = rawDogs[i] && typeof rawDogs[i] === "object" ? rawDogs[i] : {};
        return Object.fromEntries(section.fields.map(field => [field.key, cleanField(field, src[field.key])]));
      });
      continue;
    }
    for (const field of section.fields) answers[field.key] = cleanField(field, input[field.key]);
  }
  const rawMore = Array.isArray(input.more_dogs) ? input.more_dogs : [];
  answers.more_dogs = Array.from({ length: count - 1 }, (_, i) => {
    const src = rawMore[i] && typeof rawMore[i] === "object" ? rawMore[i] : {};
    const one = {};
    for (const section of SECTIONS) for (const field of section.fields) if (dogField(section, field)) one[field.key] = cleanField(field, src[field.key]);
    return one;
  });
  const check = (section, field, store, who) => {
    if (!shown(field, store)) { store[field.key] = field.type === "checks" ? [] : ""; return; }
    const empty = Array.isArray(store[field.key]) ? !store[field.key].length : !store[field.key];
    if (field.required && empty) errors.push(`Please answer${who ? ` for ${who}` : ""}: ${field.label}`);
  };
  for (const section of SECTIONS.filter(s => !s.perDog)) {
    for (const field of section.fields) check(section, field, answers, count > 1 && !field.household ? dogNames[0] || "dog 1" : "");
  }
  answers.more_dogs.forEach((one, i) => {
    for (const section of SECTIONS) for (const field of section.fields) if (dogField(section, field)) check(section, field, one, dogNames[i + 1] || `dog ${i + 2}`);
  });
  return { answers, errors };
}

// [label, value] rows in question order, for the lead panel and the trainer. Blank answers are left out.
// With two or more dogs each dog question is labeled "<dog name>: <question>" so the office knows which dog.
function answerRows(answers = {}, dogNames = []) {
  const rows = [];
  const more = Array.isArray(answers.more_dogs) ? answers.more_dogs : [];
  const many = more.length > 0;
  const nameOf = i => dogNames[i] || (i ? `dog ${i + 1}` : "your dog");
  const text = (field, value) => Array.isArray(value) ? value.join(", ") : field.type === "scale" && value ? `${value} of 5` : value;
  for (const section of SECTIONS) {
    if (section.perDog) {
      (answers.dogs || []).forEach((dog, i) => section.fields.forEach(field => {
        const value = dog?.[field.key];
        if (value) rows.push([field.label.replace("{dog}", nameOf(i)), value]);
      }));
      continue;
    }
    for (const field of section.fields) {
      if (field.household || !many) { const t = text(field, answers[field.key]); if (t) rows.push([field.label, t]); continue; }
      [answers, ...more].forEach((store, i) => { const t = text(field, store?.[field.key]); if (t) rows.push([`${nameOf(i)}: ${field.label}`, t]); });
    }
  }
  return rows;
}

// A bite, an injured animal or trouble with strangers is shown first to the trainer (per dog when there are several).
function safetyFlags(answers = {}, dogNames = []) {
  const more = Array.isArray(answers.more_dogs) ? answers.more_dogs : [];
  const flags = [];
  [answers, ...more].forEach((a, i) => {
    const who = more.length ? `${dogNames[i] || `Dog ${i + 1}`}: ` : "";
    if (a.bite_history && a.bite_history !== "No") flags.push(`${who}Bite history: ${a.bite_history}`);
    if (a.injured_animal === "Yes") flags.push(`${who}Has seriously injured another animal`);
    if (a.strangers === "Yes") flags.push(`${who}Reactive with strangers in the home`);
  });
  return flags;
}

module.exports = { SECTIONS, cleanAnswers, answerRows, safetyFlags, shown, MAX_DOGS };
