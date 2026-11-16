type Language = "en" | "bn";
type Text = Readonly<Record<Language, string>>;
export type ScienceNote = Readonly<{
  id: string;
  title: Text;
  category: Text;
  image: string;
  alt: Text;
  paragraphs: readonly Text[];
}>;
export const scienceNotes: readonly ScienceNote[] = [
  {
    id: "first-experiment",
    title: {
      en: "Turn a curious question into your first experiment",
      bn: "কৌতূহলী প্রশ্ন থেকেই শুরু হোক প্রথম পরীক্ষা",
    },
    category: { en: "Science notes", bn: "বিজ্ঞানের পাঠ" },
    image: "/images/activities/workshop-bd.jpg",
    alt: {
      en: "Students collaborating at a creative workshop at Dhaka University, Bangladesh",
      bn: "বাংলাদেশের ঢাকা বিশ্ববিদ্যালয়ে সৃজনশীল কর্মশালায় একসাথে কাজ করছে শিক্ষার্থীরা",
    },
    paragraphs: [
      {
        en: "Start with a question you can investigate safely. For example: does a paper helicopter fall differently when its blades are longer? Write down what you expect to happen and why.",
        bn: "নিরাপদে অনুসন্ধান করা যায় এমন প্রশ্ন দিয়ে শুরু করো। যেমন: কাগজের হেলিকপ্টারের পাখা বড় হলে কি পতনের ধরন বদলায়? কী ঘটবে বলে মনে হয় এবং কেন, তা লিখে রাখো।",
      },
      {
        en: "Change one factor at a time. Keep the paper, release height, and release method the same while comparing blade lengths. Repeat each trial, record the results, and look for a pattern instead of choosing only the result you expected.",
        bn: "একবারে একটি বিষয় বদলাও। পাখার দৈর্ঘ্য তুলনার সময় কাগজ, ছাড়ার উচ্চতা ও পদ্ধতি একই রাখো। প্রতিটি পরীক্ষা কয়েকবার করো, ফল লিখে রাখো এবং শুধু প্রত্যাশিত ফল বেছে না নিয়ে ছন্দ খুঁজে দেখো।",
      },
      {
        en: "Share both your results and the limits of your method. A result that surprises you is a reason to ask a better question. Use simple, safe materials and ask a teacher before trying unfamiliar equipment or substances.",
        bn: "ফলাফলের পাশাপাশি পদ্ধতির সীমাবদ্ধতাও জানাও। অপ্রত্যাশিত ফল আরও ভালো প্রশ্ন করার সুযোগ। সহজ ও নিরাপদ উপকরণ ব্যবহার করো; অপরিচিত যন্ত্র বা পদার্থ ব্যবহারের আগে শিক্ষকের পরামর্শ নাও।",
      },
    ],
  },
  {
    id: "everyday-physics",
    title: {
      en: "Find the extraordinary physics in everyday life",
      bn: "দৈনন্দিন জীবনেই খুঁজে নাও অসাধারণ পদার্থবিজ্ঞান",
    },
    category: { en: "Physics", bn: "পদার্থবিজ্ঞান" },
    image: "/images/activities/innovation-bd.jpg",
    alt: {
      en: "Students showing electronics and robotics projects at a STEM fair in Dhaka, Bangladesh",
      bn: "বাংলাদেশের ঢাকায় স্টেম মেলায় ইলেকট্রনিক্স ও রোবোটিক্স প্রকল্প দেখাচ্ছে শিক্ষার্থীরা",
    },
    paragraphs: [
      {
        en: "Physics begins with noticing. A bicycle slowing down, a shadow moving, and a spoon looking bent in water are everyday invitations to investigate motion, light, and energy.",
        bn: "পদার্থবিজ্ঞানের শুরু পর্যবেক্ষণ থেকে। সাইকেলের গতি কমা, ছায়ার অবস্থান বদলানো বা পানিতে চামচ বাঁকা দেখানো—এসব গতি, আলো ও শক্তিকে জানার সুযোগ।",
      },
      {
        en: "Try observing a pencil through the side of a clear glass of water. The pencil can appear displaced at the water surface because light changes direction when it travels between water and air. This bending is called refraction.",
        bn: "পানিভরা স্বচ্ছ গ্লাসের পাশ থেকে একটি পেনসিল দেখো। পানি ও বাতাসের মধ্যে চলার সময় আলো দিক বদলায় বলে পানির তলে পেনসিলের অংশটি সরে গেছে বলে মনে হতে পারে। এই দিক বদলকে প্রতিসরণ বলে।",
      },
      {
        en: "Sketch what you see before searching for an explanation. Compare your observations from different angles and discuss them with a classmate or teacher. Clear observations make scientific explanations easier to test.",
        bn: "ব্যাখ্যা খোঁজার আগে যা দেখছ তার ছবি আঁকো। বিভিন্ন কোণ থেকে পর্যবেক্ষণ করো এবং সহপাঠী বা শিক্ষকের সঙ্গে আলোচনা করো। স্পষ্ট পর্যবেক্ষণ বৈজ্ঞানিক ব্যাখ্যা যাচাই করতে সাহায্য করে।",
      },
    ],
  },
  {
    id: "campus-biodiversity",
    title: {
      en: "A closer look at the biodiversity around us",
      bn: "চারপাশের জীববৈচিত্র্যকে দেখো আরও কাছ থেকে",
    },
    category: { en: "Environment", bn: "পরিবেশ" },
    image: "/images/activities/conservation-bd.jpg",
    alt: {
      en: "College students joining a tree-planting awareness rally in Mymensingh, Bangladesh",
      bn: "বাংলাদেশের ময়মনসিংহে বৃক্ষরোপণ সচেতনতা র‍্যালিতে কলেজের শিক্ষার্থীরা",
    },
    paragraphs: [
      {
        en: "A small patch of green can hold many different forms of life. Plants, insects, birds, and fungi interact with one another and with their surroundings. Observing these connections is a useful first step in learning about biodiversity.",
        bn: "ছোট্ট সবুজ জায়গাতেও নানা ধরনের জীব থাকতে পারে। গাছপালা, পোকামাকড়, পাখি ও ছত্রাক একে অন্যের সঙ্গে এবং পরিবেশের সঙ্গে যুক্ত। এই সম্পর্ক পর্যবেক্ষণ জীববৈচিত্র্য শেখার প্রথম ধাপ।",
      },
      {
        en: "Choose a safe observation spot and make a nature journal. Record the date, weather, and what you notice. Sketch or photograph organisms without disturbing nests, picking plants, or handling unfamiliar animals.",
        bn: "পর্যবেক্ষণের জন্য নিরাপদ জায়গা বেছে নিয়ে প্রকৃতির দিনলিপি তৈরি করো। তারিখ, আবহাওয়া ও দেখা বিষয়গুলো লিখে রাখো। বাসা নষ্ট না করে, গাছ না ছিঁড়ে এবং অপরিচিত প্রাণী না ধরে ছবি আঁকো বা তোলো।",
      },
      {
        en: "Return to the same spot at different times and compare your notes. Keep the area free of litter and talk with a teacher about responsible conservation activities. Careful observation and small, consistent actions can support a healthier shared environment.",
        bn: "বিভিন্ন সময়ে একই জায়গায় ফিরে দিনলিপি তুলনা করো। জায়গাটি আবর্জনামুক্ত রাখো এবং দায়িত্বশীল সংরক্ষণ কার্যক্রম নিয়ে শিক্ষকের সঙ্গে কথা বলো। যত্নশীল পর্যবেক্ষণ ও নিয়মিত ছোট উদ্যোগ পরিবেশের সুস্থতায় ভূমিকা রাখতে পারে।",
      },
    ],
  },
];
