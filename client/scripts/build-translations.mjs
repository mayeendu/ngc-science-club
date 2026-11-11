import fs from "node:fs";
const dictionary = Object.fromEntries(
  fs
    .readFileSync("src/lib/i18n/bn.tsv", "utf8")
    .trimEnd()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf("\t");
      if (index < 1) throw new Error(`Invalid translation row: ${line}`);
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
const entities = {
  activities: "কার্যক্রম",
  analytics: "বিশ্লেষণ",
  announcements: "ঘোষণা",
  announcement: "ঘোষণা",
  "application status": "আবেদনের অবস্থা",
  applications: "আবেদন",
  "available quizzes": "অংশগ্রহণযোগ্য কুইজ",
  event: "অনুষ্ঠান",
  events: "অনুষ্ঠান",
  "faculty profile": "শিক্ষক প্রোফাইল",
  faculty: "শিক্ষক",
  feedback: "মতামত",
  "member profile": "সদস্য প্রোফাইল",
  members: "সদস্যবৃন্দ",
  "membership analytics": "সদস্যপদের বিশ্লেষণ",
  notifications: "বিজ্ঞপ্তি",
  participants: "অংশগ্রহণকারী",
  performance: "অগ্রগতি",
  "quiz results": "কুইজের ফলাফল",
  quiz: "কুইজ",
  quizzes: "কুইজ",
  report: "প্রতিবেদন",
  results: "ফলাফল",
  profile: "প্রোফাইল",
  "membership status": "সদস্যপদের অবস্থা",
  result: "ফলাফল",
  directory: "তালিকা",
  management: "ব্যবস্থাপনা",
  "my events": "আমার অনুষ্ঠান",
};
const keys = [
  ...new Set([
    ...JSON.parse(fs.readFileSync("src/lib/i18n/keys.json", "utf8")),
    ...JSON.parse(fs.readFileSync("src/lib/i18n/inventory.json", "utf8")),
  ]),
];
for (const key of keys) {
  if (dictionary[key]) continue;
  const loading = key.match(/^Loading (.+?)(?:\.{3}|…)?$/);
  const refresh = key.match(/^Refresh (.+)$/);
  const retry = key.match(/^Retry (.+)$/);
  const pages = key.match(/^(.+) (pages|pagination)$/);
  if (loading && entities[loading[1]])
    dictionary[key] = entities[loading[1]] + " লোড হচ্ছে…";
  else if (refresh && entities[refresh[1]])
    dictionary[key] = entities[refresh[1]] + " হালনাগাদ করুন";
  else if (retry && entities[retry[1]])
    dictionary[key] = entities[retry[1]] + " আবার লোড করুন";
  else if (pages)
    dictionary[key] =
      (entities[
        pages[1]
          .toLowerCase()
          .replace(/^managed /, "")
          .replace(/^assigned activity$/, "activities")
          .replace(/^my event$/, "events")
          .replace(/^participant$/, "participants")
          .replace(/^ranking$/, "results")
          .replace(/^attempt history$/, "results")
          .replace(/^notification$/, "notifications")
          .replace(/^announcement$/, "announcements")
          .replace(/^event$/, "events")
          .replace(/^quiz$/, "quizzes")
          .replace(/^member$/, "members")
      ] ?? "তালিকা") + " পৃষ্ঠা";
  else if (
    /^Unable to |^.+API is not configured\.|^.+service is not configured\.|^Missing API configuration$|^Session check failed\.|^Unexpected response$|^Sign out failed$/.test(
      key,
    )
  )
    dictionary[key] =
      "সেবাটি ব্যবহার করা যায়নি। তথ্য ও সংযোগ যাচাই করে আবার চেষ্টা করুন।";
  else if (key.endsWith(":") && dictionary[key.slice(0, -1)])
    dictionary[key] = dictionary[key.slice(0, -1)] + ":";
}
fs.writeFileSync(
  "src/lib/i18n/bn.json",
  JSON.stringify(dictionary, null, 2) + "\n",
);
const missing = JSON.parse(
  fs.readFileSync("src/lib/i18n/keys.json", "utf8"),
).filter((key) => !dictionary[key]);
process.stdout.write(JSON.stringify(missing, null, 2) + "\n");
