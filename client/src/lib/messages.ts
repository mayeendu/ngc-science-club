export type Locale = "en" | "bn";

export const messages = {
  en: {
    college: "Narsingdi Government College",
    title: "NGC Science Club",
    eyebrow: "Curiosity brings us together",
    heading: "Explore science. Discover together.",
    description:
      "A home for curious minds, shared ideas, and the joy of scientific discovery.",
    foundation: "Our club platform is taking shape",
    foundationDescription:
      "Member profiles, club applications, and online science quizzes are coming in future milestones.",
    connection: "Platform connection",
    checking: "Checking the connection…",
    connected: "Connected — the club API is online.",
    failed: "We could not reach the club API. Please try again shortly.",
    retry: "Check again",
    footer: "Built for learning, collaboration, and discovery.",
  },
  bn: {
    college: "নরসিংদী সরকারি কলেজ",
    title: "এনজিসি সায়েন্স ক্লাব",
    eyebrow: "কৌতূহল আমাদের এক করে",
    heading: "বিজ্ঞানকে জানি। একসাথে আবিষ্কার করি।",
    description:
      "কৌতূহলী মন, নতুন ভাবনা এবং বিজ্ঞান আবিষ্কারের আনন্দের একটি ঠিকানা।",
    foundation: "আমাদের ক্লাবের প্ল্যাটফর্ম তৈরি হচ্ছে",
    foundationDescription:
      "পরবর্তী ধাপে সদস্যদের প্রোফাইল, সদস্যপদের আবেদন এবং অনলাইন বিজ্ঞান কুইজ যুক্ত হবে।",
    connection: "প্ল্যাটফর্মের সংযোগ",
    checking: "সংযোগ পরীক্ষা করা হচ্ছে…",
    connected: "সংযোগ সফল — ক্লাবের এপিআই সচল আছে।",
    failed:
      "ক্লাবের এপিআইয়ের সাথে সংযোগ করা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।",
    retry: "আবার পরীক্ষা করুন",
    footer: "শেখা, সহযোগিতা এবং আবিষ্কারের জন্য।",
  },
} as const;
