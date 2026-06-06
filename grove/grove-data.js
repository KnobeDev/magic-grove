/* ===================================================================
   grove-data.js — the grove layout + all KNOBE station content.
   Stations are great marked sequoias along a trail through the clearing.
   Each holds 1-2 reflective questions mapped to a sequoia layer.
   Walk-up order (counter-clockwise spiral, enter south → end at center):
     Threshold → Visitor → Naming → Bark → Mother of the Forest →
     Sapwood → Heartwood → Roots → Cone → Parting → Seed  (11 layers)
   =================================================================== */
window.GROVE = window.GROVE || {};

window.GROVE.CONFIG = {
  play: 120,            // walkable half-extent guidance (clamp ±play/2)
  ground: 300,
  startPos: { x: 0, z: 50 },
  startHeading: Math.PI, // face -Z (north, into the grove)
  proximity: 7.5,       // how close to a station marker before it opens / prompts
};

/* The KNOBE seed schema field order. */
window.GROVE.FIELDS = [
  'project_description', 'prior_knowledge', 'breakpoint',
  'invisible_labor', 'dependencies', 'collaborators', 'authorship',
  'preservation', 'release_conditions', 'resource_needs', 'closing_vision',
];
/* fields folded into the SHA-256 seal (sealed when authorship is filled) */
window.GROVE.CLAIM_FIELDS = [
  'project_description', 'prior_knowledge', 'breakpoint',
  'invisible_labor', 'dependencies', 'collaborators', 'authorship',
];

window.GROVE.STATIONS = [
  {
    id: 'threshold', num: '01', layer: 'Threshold', title: 'The Threshold',
    subtitle: 'What you carry in',
    pos: { x: 0, z: 34 },
    marker: 'arch',
    intro: [
      "Two great sequoias lean toward one another, forming a gate of living wood.",
      "Before the grove shares anything, it is curious about you — about the work you are actually trying to make.",
    ],
    questions: [
      {
        id: 'q1', field: 'project_description', label: 'Q1',
        text: "What significant project are you working on right now — something you are creating? What is it, what question is it trying to answer, and why does it matter to you?",
        placeholder: "Describe your project honestly…",
        knobe: 'Title / Project Description',
      },
    ],
    key: 'Threshold — the living prose you bring in, the seed of everything that follows.',
  },
  {
    id: 'visitor', num: '02', layer: 'First Impressions', title: 'The Visitor Plaque',
    subtitle: 'The assumptions you carry',
    pos: { x: -28, z: 18 },
    marker: 'plaque',
    intro: [
      "A weathered bronze plaque stands at the trailhead.",
      "Before you go deeper, the grove wants to know what you already believe about us, the sequoias.",
    ],
    questions: [
      {
        id: 'q2', field: 'prior_knowledge', label: 'Q2 · Optional',
        text: "What do you know about us, the sequoias? And do you know where we got the name you humans call us?",
        placeholder: "Even a guess is welcome.",
        knobe: 'Prior Knowledge / Incoming Assumptions',
      },
    ],
    key: 'First Impressions — your incoming assumptions, recorded before the grove answers them.',
  },
  {
    id: 'naming', num: '03', layer: 'The Naming', title: 'The Naming',
    subtitle: 'Knowledge needs encoding to travel',
    pos: { x: -46, z: -2 },
    marker: 'glyph',
    intro: [
      "The name you call us — Sequoia — was set down around 1847 by a botanist who never wrote down his reason.",
      "Most believe it honors Sequoyah, a Cherokee man who could not read the settlers' words, yet built a writing system for his own people from nothing: eighty-five characters, each a sound. Knowledge, encoded so it could travel and endure. That is the principle beneath everything you are doing here.",
    ],
    questions: [],
    key: 'The Naming — the founding principle: knowledge must be encoded to travel and survive.',
  },
  {
    id: 'bark', num: '04', layer: 'The Bark', title: 'The Bark',
    subtitle: 'Protection',
    pos: { x: -46, z: -28 },
    marker: 'scar',
    intro: [
      "Run your hand along the bark — two to three feet thick, soft and fibrous, and almost impossible to burn.",
      "It does not fear fire. It chars, turns the flame, and keeps the living tree alive. Every scar is a record of what was tested and held.",
    ],
    questions: [
      {
        id: 'q3', field: 'breakpoint', label: 'Q3',
        text: "Where do you imagine this work, as planned, could be vulnerable to an honest challenge? Where is the bark thinnest?",
        placeholder: "Every living thing has a place where the bark is thinner. The grove is not judging.",
        knobe: 'Breakpoint / Acknowledged Vulnerability',
      },
    ],
    key: 'Bark — the verification seal (SHA-256) that proves the record has not been altered.',
  },
  {
    id: 'mother', num: '05', layer: 'Mother of the Forest', title: 'Mother of the Forest',
    subtitle: 'What a record becomes without its bark',
    pos: { x: -26, z: -46 },
    marker: 'shell',
    intro: [
      "In 1854, men stripped the bark from a tree that had stood for two thousand years — peeling it in numbered sections to be reassembled in a London exhibition hall.",
      "Visitors walked through a hollow cylinder of bark and were told they were seeing a tree. They were seeing a shell. Without her living, protective layer, the Mother died. This is what a record becomes when its verification is stripped away — portable, impressive, and empty.",
    ],
    questions: [],
    key: 'Mother of the Forest — proof that a record without its verifying layer is only a shell.',
  },
  {
    id: 'sapwood', num: '06', layer: 'The Sapwood', title: 'The Sapwood',
    subtitle: 'Process — the only living wood',
    pos: { x: -2, z: -52 },
    marker: 'flow',
    intro: [
      "Just beneath the bark is the sapwood — the only living part of the trunk.",
      "It lifts water and signals through channels finer than a hair: structured improvisation, a living system with rules and responsiveness. This is the invisible labor that moves meaning.",
    ],
    questions: [
      {
        id: 'q5', field: 'invisible_labor', label: 'Q5',
        text: "What is the invisible labor in your work — the things you must do to make it happen that others won't see in the final artifact, that are unique to you?",
        placeholder: "The work beneath the surface…",
        knobe: 'Process / Invisible Labor',
      },
      {
        id: 'q5b', field: 'dependencies', label: 'Q5b',
        text: "What does that labor depend on? What would help it flow, and what would stop it?",
        placeholder: "What feeds the flow, and what blocks it…",
        knobe: 'Dependencies / Flow Conditions',
      },
    ],
    key: 'Sapwood — the human-readable content layer: living prose, reasoning, and framing.',
  },
  {
    id: 'heartwood', num: '07', layer: 'The Heartwood', title: 'The Heartwood',
    subtitle: 'The Record',
    pos: { x: 24, z: -44 },
    marker: 'rings',
    intro: [
      "Deeper still, the sapwood hardens into heartwood. What was flowing becomes structure; what was alive becomes a record.",
      "Every year is a ring. Drought years thin, good years thick, fire years scarred. The rings record everything, faithfully — the schema that makes thinking readable across time and minds that never met you.",
    ],
    questions: [
      {
        id: 'q6', field: 'collaborators', label: 'Q6',
        text: "Who or what is helping you carry or co-create this work — key human supporters and collaborators, or machine tools such as productivity apps or AI models?",
        placeholder: "Human and machine collaborators…",
        knobe: 'Collaborators / Tools',
      },
      {
        id: 'q7', field: 'authorship', label: 'Q7',
        text: "What came from you that makes it yours — your core vision, your decisions, your research, or an imaginative hunch about what would be cool or useful?",
        placeholder: "What is distinctly yours…",
        knobe: 'Authorship / Claimed Contribution — hash sealed at submission',
        seals: true,
      },
    ],
    key: 'Heartwood — the JSON schema: the structured record that makes the content durable.',
  },
  {
    id: 'roots', num: '08', layer: 'The Roots', title: 'The Roots',
    subtitle: 'The Hidden Network',
    pos: { x: 46, z: -16 },
    marker: 'network',
    intro: [
      "We are the largest living things on Earth, and yet our roots are shallow — no taproot, no single anchor.",
      "We would fall in the first storm if we stood alone. Instead we connect: mycorrhizal threads link every sequoia in the grove. No single point of failure. What no tree can hold, the grove holds together.",
    ],
    questions: [
      {
        id: 'q8', field: 'preservation', label: 'Q8',
        text: "Think of something you made that lived in a course or on a platform you no longer control. What happened to it? Would you want this work preserved as creative breadcrumbs you control, for years or decades?",
        placeholder: "What have you lost to platforms? What do you want to keep?",
        knobe: 'Trust Network / Preservation Intent',
      },
    ],
    key: 'Roots — the distributed verification network that holds the record in common.',
  },
  {
    id: 'cone', num: '09', layer: 'The Cone', title: 'The Cone',
    subtitle: 'The Dispersal',
    pos: { x: 42, z: 12 },
    marker: 'cone',
    intro: [
      "A serotinous cone hangs sealed above you. It has been waiting — not for rain, not for wind, but for fire.",
      "It may stay shut for thirty years until the right heat releases the resin. Then: seeds, each six-thousandths of a gram, carrying the complete instructions for the largest living thing on Earth. Self-contained. It does not need the platform that produced it.",
    ],
    questions: [
      {
        id: 'q9', field: 'release_conditions', label: 'Q9',
        text: "What conditions have to happen — in your life and in the world — for this work to travel and take root? What is the fire it is waiting for?",
        placeholder: "What conditions does the world need…",
        knobe: 'Release Conditions / Dispersal Strategy',
      },
      {
        id: 'q10', field: 'resource_needs', label: 'Q10',
        text: "What do you need that you don't yet have — an internal state, a social connection, an inspiration, or a resource?",
        placeholder: "What you need that you don't yet have…",
        knobe: 'Resource Needs / Personal Readiness',
      },
    ],
    key: 'Cone / Seed — the portable .knobe.md file that carries everything and opens anywhere.',
  },
  {
    id: 'parting', num: '10', layer: 'The Parting', title: 'The Parting',
    subtitle: 'The seed is the structure; you are the musician',
    pos: { x: 20, z: 28 },
    marker: 'song',
    intro: [
      "You have walked every layer now — protection, flow, record, network, seed. The grove has given you all it knows.",
      "But we cannot move. We cannot improvise. We cannot do what you do. The KNOBE seed you carry is the structure — the architecture, built so something can grow. You are the musician who plays it. What grows now depends on you.",
    ],
    questions: [],
    key: 'The Parting — the structure is built; the living act of carrying it forward is yours.',
  },
  {
    id: 'seed', num: '11', layer: 'The Seed', title: 'The Seed',
    subtitle: 'Departure — take what you made',
    pos: { x: 0, z: 0 },
    marker: 'altar',
    intro: [
      "At the heart of the grove rests a single cone on a low stone altar — the smallest part of the largest living thing.",
      "You were building your seed the entire time you walked. Plain text. A few kilobytes. Any tool, any platform, any mind can read it. You take it when you leave.",
    ],
    questions: [
      {
        id: 'q11', field: 'closing_vision', label: 'Q11',
        text: "Visualize this work as completed and shared beyond any assignment. What form does it take, and how will that feel?",
        placeholder: "Imagine the finished work, out in the world…",
        knobe: 'Appended to Project Description — closing vision',
      },
    ],
    key: 'Seed — _Magic_Grove_Journey.knobe.md, the self-contained record you carry out.',
    isSeed: true,
  },
];
