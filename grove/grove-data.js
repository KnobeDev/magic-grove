/* ===================================================================
   grove-data.js — the grove layout + all KNOBE station content.
   Campground-map layout: two clearings joined by a forest path.

     Visitor's Center (south circle):
       Threshold (Q1) · First Impressions (Q2) · Naming (lore)
     Forest path north, past the Bark sequoia (Q3):
       The Grove (north circle) is built around the Mother stump:
       Mother story · Sapwood (Q5/Q5b) · Heartwood (Q6/Q7) — all
       read while standing on the walkable 33-ft stump.
       Roots (Q8) glow out from the stump; the Cone (Q9/Q10) waits
       a little way off. The Parting sends you back to the
       Visitor's Center, where the Seed (Q11) appears to be sealed.
   Coordinates are ~1 world unit per foot. +Z is south (toward the
   visitor on entry); the grove lies to the north (−Z).
   =================================================================== */
window.GROVE = window.GROVE || {};

window.GROVE.CONFIG = {
  play: 200,            // walkable half-extent guidance (clamp ±play/2)
  ground: 360,
  startPos: { x: 0, z: 74 },
  startHeading: Math.PI, // face -Z (north, into the visitor's center)
  proximity: 7.5,        // how close to a marker before it opens / prompts

  // The visitor's center clearing (south) — entry book + 3 whiteboards.
  visitorCenter: { x: 0, z: 64, r: 18 },
  // The grove clearing (north) — built around the Mother stump.
  groveCenter: { x: 0, z: -66, r: 30 },
  // The walkable Mother-of-the-Forest stump. Players climb its sloped
  // edge and walk across the top, reading the layer stations up there.
  //   r    : flat top radius
  //   top  : height of the flat top above ground (≈ 4 ft)
  //   edge : width of the sloped ramp from ground up to the top
  stump: { x: 0, z: -66, r: 16.5, top: 4.2, edge: 5 },
  // The fallen cone, off to the east of the grove.
  cone: { x: 42, z: -44 },
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

/* terrainHeight(x,z) — the walkable ground height at a point.
   0 everywhere except on/around the Mother stump, where it rises to a
   flat top via a sloped ramp so the player can simply walk up onto it. */
window.GROVE.terrainHeight = function (x, z) {
  var s = window.GROVE.CONFIG.stump;
  var d = Math.hypot(x - s.x, z - s.z);
  if (d <= s.r) return s.top;
  if (d <= s.r + s.edge) {
    var f = (d - s.r) / s.edge;      // 0 at top edge → 1 at ground edge
    return s.top * (1 - f);
  }
  return 0;
};

window.GROVE.STATIONS = [
  {
    id: 'threshold', num: '01', layer: 'Threshold', title: 'The Threshold',
    subtitle: 'What you carry in',
    pos: { x: -12, z: 70 },
    marker: 'sign',
    region: 'visitor',
    intro: [
      "The first whiteboard in the visitor's center. You have signed the entry book; now the grove is curious about you.",
      "The trees here are older than your country. They predate the printing press; they were already ancient when the settlers named the continent. They remember everything.",
      "Do you?",
      "The grove is curious about what you are carrying. Before you go any further, it asks what you carry in — not a summary written for a grade, but something true about what you are actually trying to make.",
      "Once you write it down, the grove knows you. Everything that follows will be in conversation with what you set here.",
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
    pos: { x: 12, z: 64 },
    marker: 'sign',
    region: 'visitor',
    intro: [
      "A weathered bronze plaque on the second whiteboard stand.",
      "Welcome. Before you enter the grove, we would like to know what you already carry about us — what you believe about the sequoias, and whether you know where the name you humans call us came from.",
      "Hold onto whatever you write here. By the time you leave the grove, you may see it differently.",
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
    pos: { x: 0, z: 52 },
    marker: 'sign',
    region: 'visitor',
    intro: [
      "The third whiteboard, at the mouth of the path leading north into the grove. Before we go in, read this.",
      "These trees carry the name Sequoia. It was given around 1847 by Stephan Endlicher, an Austrian botanist and linguist who never saw a living specimen. He left no published rationale: no letter, no footnote, no explanation of the choice. For a man trained in both botany and linguistics, the silence is conspicuous.",
      "Around the same time, the world was learning about Sequoyah, a Cherokee man who could neither read nor write in the settlers' language but who accomplished something extraordinary.",
      "Sequoyah watched the settlers and recognized that their power wasn't intelligence. It was encoding. They could capture knowledge in a portable format that traveled without them, survived their absence, and could be read by anyone who learned the system.",
      "So he built his own. An entire syllabary — eighty-five characters, designed from nothing for how Cherokee actually sounds. Within a few years, Cherokee literacy surpassed the settlers around them. A newspaper, the Cherokee Phoenix, published in both languages. The syllabary became infrastructure: for preservation, for legal resistance, for survival.",
      "Consider what other botanists of the era did with their naming rights. Wellingtonia, named for the Duke of Wellington with elaborate written tribute. Washingtonia, named for George Washington with lengthy published justification. When a great man deserved a great tree, the naturalists of the 1840s made sure posterity knew exactly why.",
      "Endlicher left nothing. The Cherokee were being removed from their lands at gunpoint while he was writing. Perhaps a Cherokee name on the world's largest organism was statement enough without explanation. Perhaps he assumed the connection was obvious. Perhaps the attribution is coincidence; some etymologists trace the word to the Latin sequi, meaning to follow.",
      "We cannot know. The man who invented writing to preserve what the powerful would erase is himself preserved in a name that cannot be proven to honor him.",
      "The tree keeps better records than the humans who named it. Yours will too. That is why you are here.",
      "This is the first lesson of the grove: knowledge needs encoding to travel. An idea without a structure is a fire without a cone. It burns, it warms, it is gone.",
    ],
    questions: [],
    key: 'The Naming — the founding principle: knowledge must be encoded to travel and survive.',
  },
  {
    id: 'bark', num: '04', layer: 'The Bark', title: 'The Bark',
    subtitle: 'Protection',
    pos: { x: -7, z: 10 },
    marker: 'barktree',
    region: 'path',
    intro: [
      "Halfway up the path, a single towering sequoia stands alone. This is the first thing you see. The first thing you touch.",
      "It is dead tissue. Every cell in the outer bark died to become what it is. It does not think. It does not carry nutrients. It does not record. It is the product of everything living beneath it, pushed outward until it hardens.",
      "But it does one thing nothing else in the forest can do.",
      "Fire is not our enemy. We evolved with it. The bark, two to three feet thick at the base of the oldest trees, contains almost no resin. It does not burn. It chars. It turns the flame. While other trees fall, we stand. Fire clears the competition, opens the cones, feeds the soil. Our protection was not built to prevent fire. It was built to survive it, and to use it.",
      "Every scar on this bark is a record of what was tested and held.",
      "Before we go deeper into the living layers beneath, the bark asks you something about the work you described.",
    ],
    questions: [
      {
        id: 'q3', field: 'breakpoint', label: 'Q3',
        text: "Where do you imagine this work as planned could be vulnerable to an honest challenge? Where is the bark thinnest?",
        placeholder: "Every living thing has a place where the bark is thinner. The grove is not judging.",
        knobe: 'Breakpoint / Acknowledged Vulnerability',
      },
    ],
    outro: [
      "That honesty is itself a form of protection. A system that can name its own limits is harder to break than one that cannot.",
      "The bark seals what lies beneath. In a moment, you will see what it protects. But first, a warning about what happens when it is taken away.",
    ],
    key: 'Bark — the SHA-256 verification seal that proves this file, in this form, at this moment, has not been altered.',
  },
  {
    id: 'mother', num: '05', layer: 'Mother of the Forest', title: 'Mother of the Forest',
    subtitle: 'What a record becomes without its bark',
    pos: { x: 0, z: -44 },
    marker: 'stumpstory',
    region: 'grove',
    intro: [
      "There is a tree near here we do not speak of lightly.",
      "She was called the Mother of the Forest. She stood for over two thousand years. She survived every fire. Every drought. Every season of granite and wind.",
      "In 1854, men came with tools. They did not cut her down. What they did was slower.",
      "They stripped her bark. Section by section. Numbered each piece. Two feet deep around the entire circumference. They loaded the bark onto wagons, carried it out of these mountains, and shipped it across an ocean to the Crystal Palace Exhibition in London.",
      "There, they reassembled it. Visitors walked through a hollow cylinder of bark and were told they were seeing a tree.",
      "They were seeing a shell.",
      "The Mother stood here, exposed. Her sapwood, the living layer, was open to the air. Her heartwood, the record of two thousand years, was unprotected. Without the bark, the living layer dried. Without the living layer, the record became meaningless. She declined over years, then decades, then fell. What they shipped to London was not a specimen. It was proof that something could be made to appear to exist for an audience that would never visit it.",
      "We did not fully understand, until we watched her die, how much depended on the layer we had taken for granted.",
      "When you strip the verification layer from a knowledge system and ship it somewhere else for exhibition, you have not preserved it. You have hollowed it.",
      "This is what happens to knowledge without a bark. Screenshots. Decontextualized quotes. AI outputs with no record of what prompted them, who shaped them, or what they were claimed to mean. Portable in form. Empty of integrity.",
      "Climb up onto her and read the rings.",
    ],
    questions: [],
    key: 'Mother of the Forest — proof that a record without its verifying layer is only a shell.',
  },
  {
    id: 'sapwood', num: '06', layer: 'The Sapwood', title: 'The Sapwood',
    subtitle: 'Process — the only living wood',
    pos: { x: -10, z: -76 },
    marker: 'stumplayer',
    region: 'stump',
    intro: [
      "You are standing on the pale outer ring of the great stump. Now look past the bark.",
      "Between the bark and the heartwood lies the sapwood, a living sleeve no thicker than your hand, and the only part of the trunk that is truly alive. Every nutrient this tree has ever absorbed moves through here. Water pulled upward by the sky, pushed from below by the roots, moving against gravity through channels thinner than a hair. It never stops while the tree lives.",
      "This is the layer you can never see from outside the tree. And yet without it, nothing outside exists.",
      "The sap carries water, sugars, minerals, hormones, and signals from the fungal networks below, a conversation the tree has been having with itself and its neighbors for centuries. It is not a pipeline. It is a language. And it does not originate its own content: it moves what the roots absorb and what the leaves produce into a form the whole system can use.",
      "This is what your human-readable content layer does. Not the structured schema beneath it. Not the verification seal outside it. The living middle, your words, your reasoning, your framing, moving meaning through the system so it can be absorbed.",
      "The grove wants to understand your invisible flow.",
    ],
    questions: [
      {
        id: 'q5', field: 'invisible_labor', label: 'Q5',
        text: "What is the invisible labor in your work that others won't see in the final artifact, the things you must do to make it happen that are unique to you?",
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
    outro: [
      "The sapwood does not improvise alone. The rhythm of flow responds to signals from above and below, the canopy reading light, the roots reading soil. It is structured improvisation: a living system with rules and responsiveness, neither rigid nor random. You will hear more about this when we reach the Parting.",
    ],
    key: 'Sapwood — the human-readable content layer: living prose, reasoning, and framing.',
  },
  {
    id: 'heartwood', num: '07', layer: 'The Heartwood', title: 'The Heartwood',
    subtitle: 'The Record',
    pos: { x: 3, z: -63 },
    marker: 'stumplayer',
    region: 'stump',
    intro: [
      "Toward the center the rings darken into heartwood. Deeper now. The sapwood hardens here. What was flowing becomes structure. What was alive becomes a record.",
      "Every year of our lives becomes a ring. Drought years are thin. Good years are thick. Fire years leave scars. We do not choose what the rings record. They record everything, faithfully, whether we wish it or not.",
      "This is the schema layer, the underlying structure that makes the living prose readable across time, across tools, across minds that have never met you.",
      "And here is what the rings would ask about collaboration: you think with others now. Machines that do not leave rings of their own. A prompt disappears. A session closes. The exchange is gone unless you build the structure that holds it.",
    ],
    questions: [
      {
        id: 'q6', field: 'collaborators', label: 'Q6',
        text: "Who or what is helping you carry or co-create this work? Key human supporters and collaborators, or machine tools such as productivity apps or AI models?",
        placeholder: "Human and machine collaborators…",
        knobe: 'Collaborators / Tools',
      },
      {
        id: 'q7', field: 'authorship', label: 'Q7',
        text: "What came from you that makes it yours: your core vision, your decisions, your research, or simply an imaginative hunch about what would be cool or useful?",
        placeholder: "What is distinctly yours…",
        knobe: 'Authorship / Claimed Contribution — hash sealed at submission',
        seals: true,
      },
    ],
    outro: [
      "The rings record. The record holds. What flows becomes what stands.",
    ],
    key: 'Heartwood — the JSON schema: the structured record that makes the content durable.',
  },
  {
    id: 'roots', num: '08', layer: 'The Roots', title: 'The Roots',
    subtitle: 'The Hidden Network',
    pos: { x: 25, z: -66 },
    marker: 'roots',
    region: 'grove',
    intro: [
      "At the stump's edge, glowing root-threads fan out beneath the forest floor toward every other tree. One last secret. We are the largest living things on this Earth. And yet our roots are shallow.",
      "No taproot. No single anchor driven deep into the granite. We would fall in the first storm if we stood alone.",
      "Instead, we connect. Our roots spread outward and join the mycorrhizal networks, fungal threads finer than hair that link our root systems to every other sequoia in the grove. Through these threads we share nutrients, signal drought, distribute the load of a heavy snowpack. No single point of failure. No single source of truth. What no individual tree can hold, the grove holds together.",
      "This is not metaphor. The wood wide web is documented biology. A tree under attack sends chemical signals through the fungal network, and neighbors begin producing defensive compounds before they are touched. The grove responds as a system.",
      "Before we ask you about networks, the grove wants to ask you about loss.",
    ],
    questions: [
      {
        id: 'q8', field: 'preservation', label: 'Q8',
        text: "Think of something you made that lived in a course or was posted on a platform you no longer control. What happened to it? Would you want this work, the project you described, preserved as the creative breadcrumbs you control, perhaps for years or decades?",
        placeholder: "What have you lost to platforms? What do you want to keep?",
        knobe: 'Trust Network / Preservation Intent',
      },
    ],
    outro: [
      "A network that holds your record in common, that checks each node against the others, that has no single throat to cut, is the answer to the platform problem. That is what the roots do. That is what KNOBE is building.",
    ],
    key: 'Roots — the distributed verification network that holds the record in common.',
  },
  {
    id: 'cone', num: '09', layer: 'The Cone', title: 'The Cone',
    subtitle: 'The Dispersal',
    pos: { x: 42, z: -44 },
    marker: 'cone',
    region: 'grove',
    intro: [
      "A little way off the path, roots glow toward a single cone resting on the forest floor. What you are looking at is called a serotinous cone. It has been waiting.",
      "Not for rain. Not for wind. For fire.",
      "This cone may stay sealed for twenty years. For thirty. The resin holds it shut against every season, every ordinary day. It will not open until the heat of a specific fire causes the resin to release. The same fire that clears the competition, that chars the bark without killing the tree. That fire is what the cone has been waiting for.",
      "And when it opens: seeds. Each seed weighs six thousandths of a gram. You could hold two hundred in your palm and barely feel them. They carry, in that almost-nothing, the complete instructions for the largest living organism on Earth.",
      "The seed is self-contained. It does not require the platform that produced it. It does not expire when the server changes. The cone does not care whether the forest looks the same as it did when the seed was formed. The seed carries everything it needs to begin again.",
      "Your _Magic_Grove_Journey.knobe.md file is the same. Plain text. Any tool, any platform, any mind can read it. You take it when you leave.",
    ],
    questions: [
      {
        id: 'q9', field: 'release_conditions', label: 'Q9',
        text: "What conditions have to happen in your life and in the world for this work to travel and take root? What is the fire it is waiting for?",
        placeholder: "What conditions does the world need…",
        knobe: 'Release Conditions / Dispersal Strategy',
      },
      {
        id: 'q10', field: 'resource_needs', label: 'Q10',
        text: "What do you need that you don't yet have, whether an internal state, a social connection, an inspiration, or a resource?",
        placeholder: "What you need that you don't yet have…",
        knobe: 'Resource Needs / Personal Readiness',
      },
    ],
    outro: [
      "The cone knows what it carries. Now it knows what it is waiting for.",
    ],
    key: 'Cone / Seed — the portable .knobe.md file that carries everything and opens anywhere.',
  },
  {
    id: 'parting', num: '10', layer: 'The Parting', title: 'The Parting',
    subtitle: 'The seed is the structure; you are the musician',
    pos: { x: 42, z: -32 },
    marker: 'parting',
    region: 'grove',
    intro: [
      "You have walked every layer now — protection, flow, record, network, seed. Before you leave us, there is one more thing.",
      "We are not trees. That is your word. Your taxonomy. Your way of making us manageable. We are living systems, companions on this spinning rock, responding to the same forces you respond to. The bark, the sapwood, the heartwood, the roots, the cone: these are not poetic devices. They are solutions. We solved structure. We solved durability. We solved the record. We solved the network. It took two thousand years.",
      "But we cannot move. We cannot improvise. We cannot do what you do.",
      "You noticed, in the sapwood, that we called it structured improvisation, a living system with rules and responsiveness. That is the closest we can come to describing what you are capable of. You can improvise in real time. You can collaborate with someone you have never met, toward a goal that neither of you could have defined alone. You can play a note, hear a response, and redirect in the same breath.",
      "We know this because we feel vibrations. Not the way you do, but sound moves through soil, through fungal networks, through the wood itself. And what you humans do with sound astonishes us. You use it to synchronize, to grieve, to celebrate, to remember, to resist. You call it music. We call it the thing we cannot do.",
      "The KNOBE seed you are carrying is the structure. The bark, the sapwood, the heartwood, the roots: all of it is architecture, built so something can grow. But you are the musician. The seed does not play itself. It waits for someone mobile, improvising, alive, to take it somewhere and begin.",
      "That is you. Return now to the visitor's center, where your seed will be sealed.",
    ],
    questions: [],
    key: 'The Parting — the structure is built; the living act of carrying it forward is yours.',
    returnsTo: 'seed',   // completing this reveals the Seed back at the visitor's center
  },
  {
    id: 'seed', num: '11', layer: 'The Seed', title: 'The Seed',
    subtitle: 'Departure — take what you made',
    pos: { x: 0, z: 64 },
    marker: 'altar',
    region: 'visitor',
    hiddenUntilReturn: true, // only appears once The Parting is complete
    intro: [
      "Back at the visitor's center, a single cone now rests on a low stone altar. The Giant Sequoia seed is the smallest part of the largest living thing.",
      "It weighs six thousandths of a gram. You could hold a hundred in your palm and barely feel them. And yet it contains the complete instructions for everything you just experienced: the bark, the sapwood, the heartwood, the roots, the cone.",
      "Your seed is the same. It does not look like much. It is a small file. Plain text. A few kilobytes. But it contains the record of everything you brought here and everything you made.",
    ],
    questions: [
      {
        id: 'q11', field: 'closing_vision', label: 'Q11',
        text: "Visualize this as completed and shared beyond any assignment. What form does it take, and how will that feel?",
        placeholder: "Imagine the finished work, out in the world…",
        knobe: 'Appended to Project Description — closing vision',
      },
    ],
    outro: [
      "You were building this the entire time you walked.",
    ],
    key: 'Seed — _Magic_Grove_Journey.knobe.md, the self-contained record you carry out.',
    isSeed: true,
  },
];
