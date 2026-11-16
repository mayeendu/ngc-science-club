export type BlogCover = Readonly<{
  image: string;
  alt: Readonly<{ en: string; bn: string }>;
}>;
const workshop: BlogCover = {
  image: "/images/activities/workshop-bd.jpg",
  alt: {
    en: "Students at a creative workshop at Dhaka University, Bangladesh",
    bn: "বাংলাদেশের ঢাকা বিশ্ববিদ্যালয়ে সৃজনশীল কর্মশালায় শিক্ষার্থীরা",
  },
};
const robotics: BlogCover = {
  image: "/images/activities/innovation-bd.jpg",
  alt: {
    en: "Students presenting robotics projects at a STEM fair in Dhaka, Bangladesh",
    bn: "বাংলাদেশের ঢাকায় স্টেম মেলায় রোবোটিক্স প্রকল্প উপস্থাপন করছে শিক্ষার্থীরা",
  },
};
const nature: BlogCover = {
  image: "/images/activities/conservation-bd.jpg",
  alt: {
    en: "College students joining a tree-planting awareness rally in Mymensingh, Bangladesh",
    bn: "বাংলাদেশের ময়মনসিংহে বৃক্ষরোপণ সচেতনতা র‍্যালিতে কলেজের শিক্ষার্থীরা",
  },
};
const mathematics: BlogCover = {
  image: "/images/activities/olympiad-bd.jpg",
  alt: {
    en: "Students attending the National Mathematics Olympiad in Dhaka, Bangladesh",
    bn: "বাংলাদেশের ঢাকায় জাতীয় গণিত অলিম্পিয়াডে অংশগ্রহণকারী শিক্ষার্থীরা",
  },
};
export function blogCover(category: string): BlogCover {
  if (category === "Physics" || category === "Chemistry") return robotics;
  if (category === "Biology" || category === "Environment") return nature;
  if (category === "Mathematics") return mathematics;
  return workshop;
}
export function announcementCover(id: string): BlogCover {
  const index =
    Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
  return [workshop, robotics, nature][index];
}
