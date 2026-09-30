/*
  QUIZ DATA — drop new quizzes into this list and they show up in the Quizzes tab.
  (You can also paste quizzes in the site itself under "Add quiz".)

  Each quiz:
    id          unique text id, e.g. "bio-ch3"   (keep it stable, scores are saved by id)
    title       name shown on the card
    emoji       one emoji for the card (optional)
    description short blurb (optional)
    tags        list of tags for filtering (optional)
    difficulty  "easy" | "medium" | "hard" (optional)
    timeLimit   whole-quiz timer in seconds (optional, leave out for no timer)
    questions   list of questions (see below)

  Question types (the site figures out the type from "answer"):
    single choice   { q, options: [...], answer: 1 }            // index of the right option, 0 = first
    multi select    { q, options: [...], answer: [0, 2] }       // every right index
    true / false    { q, answer: true }
    type-in answer  { q, answer: "mitochondria" }               // or a list: ["h2o", "water"]
  Every question can also have:
    explanation     shown after answering / in the review
    hint            shown when the player taps "hint"
*/
window.QUIZ_DATA = [
  {
    id: "sample-general",
    title: "General Knowledge Warm-Up",
    emoji: "🌍",
    description: "Sample quiz to test the vibes. Geography, science and a bit of everything.",
    tags: ["sample", "general"],
    difficulty: "easy",
    sample: true,
    questions: [
      { q: "What is the capital of Australia?", options: ["Sydney", "Melbourne", "Canberra", "Perth"], answer: 2, explanation: "Canberra was purpose-built as the capital as a compromise between Sydney and Melbourne.", hint: "It's not the biggest city." },
      { q: "Which planet has the most confirmed moons?", options: ["Jupiter", "Saturn", "Uranus", "Neptune"], answer: 1, explanation: "Saturn passed Jupiter in 2023 and now has over 140 confirmed moons." },
      { q: "Water boils at 100 °C at sea level.", answer: true, explanation: "At standard atmospheric pressure (1 atm), yes." },
      { q: "What gas do plants absorb from the air for photosynthesis?", answer: ["carbon dioxide", "co2"], explanation: "Plants take in CO₂ and release O₂." },
      { q: "Which of these are primary colors of light?", options: ["Red", "Yellow", "Green", "Blue"], answer: [0, 2, 3], explanation: "Light uses RGB: red, green and blue. Yellow is a primary for paint, not light." },
      { q: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], answer: 1 },
      { q: "The Great Wall of China is visible from the Moon with the naked eye.", answer: false, explanation: "Classic myth. It's far too narrow to see from the Moon." },
      { q: "Which ocean is the largest?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: 3, explanation: "The Pacific covers about a third of Earth's surface." }
    ]
  },
  {
    id: "sample-js",
    title: "JavaScript Basics",
    emoji: "⚡",
    description: "Sample quiz. Types, arrays and the classic JS gotchas.",
    tags: ["sample", "coding"],
    difficulty: "medium",
    timeLimit: 240,
    sample: true,
    questions: [
      { q: "What does `typeof null` return?", options: ["\"null\"", "\"object\"", "\"undefined\"", "\"number\""], answer: 1, explanation: "A historic bug in JS that can never be fixed: `typeof null === \"object\"`." },
      { q: "Which keyword declares a block-scoped variable that can be reassigned?", options: ["var", "let", "const", "static"], answer: 1 },
      { q: "`[1, 2, 3].map(x => x * 2)` returns?", options: ["[2, 4, 6]", "[1, 2, 3]", "12", "undefined"], answer: 0 },
      { q: "`0.1 + 0.2 === 0.3` is true in JavaScript.", answer: false, explanation: "Floating point! It's 0.30000000000000004." },
      { q: "Which of these are falsy?", options: ["0", "\"\"", "[]", "null"], answer: [0, 1, 3], explanation: "An empty array is truthy. 0, empty string and null are falsy.", hint: "Objects (including arrays) are always truthy." },
      { q: "What array method adds an item to the end?", answer: ["push", "push()", ".push", ".push()"], explanation: "`arr.push(x)` adds to the end; `unshift` adds to the start." },
      { q: "What does `===` check that `==` doesn't?", options: ["Value only", "Type as well as value", "Memory address only", "Nothing, they're the same"], answer: 1 }
    ]
  },
  {
    id: "sample-slang",
    title: "Brainrot Vocab Check",
    emoji: "💀",
    description: "Sample quiz. Are you fluent or are you cooked?",
    tags: ["sample", "fun"],
    difficulty: "hard",
    sample: true,
    questions: [
      { q: "If something is \"mid\", it is…", options: ["Amazing", "Average or disappointing", "In the middle of the room", "Expensive"], answer: 1 },
      { q: "\"No cap\" means…", options: ["No hat allowed", "No limit", "No lie, for real", "No thanks"], answer: 2 },
      { q: "Being \"cooked\" is a good thing.", answer: false, explanation: "Cooked = done for, it's over." },
      { q: "Someone with a lot of charm has a lot of what? (one word)", answer: ["rizz"], hint: "Short for charisma." },
      { q: "Which ones are compliments?", options: ["You ate", "It's giving", "Slay", "Ratio"], answer: [0, 2], explanation: "\"It's giving\" depends on what follows, and \"ratio\" is a dunk." },
      { q: "\"Delulu\" is short for…", options: ["Deluxe", "Delusional", "Delicious", "Delete"], answer: 1 }
    ]
  }
];
