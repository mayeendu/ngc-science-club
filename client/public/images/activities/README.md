# Activity and blog photography

The homepage Activity and News & Blog sections, and the shared Blog page, use photos whose sources document Bangladesh locations and student activities. Active filenames end in `-bd.jpg`. They show Olympiad participants in Dhaka, a robotics fair in Dhaka, a student group in Barishal, a creative workshop at Dhaka University, and a college tree-planting rally in Mymensingh. These are contextual photographs, not claimed to depict NGC Science Club members or its own events. The older international stock photos and SVG placeholders remain unused.

The Bangladesh photos were downloaded on 2026-11-16 from Wikimedia Commons, Unsplash and Pexels at up to 1280px width. Full titles, creators, original source pages, context, license URLs and modification notices are in [bangladesh-credits.txt](bangladesh-credits.txt), visibly linked below both sections. Licenses include CC BY-SA 3.0/4.0, public domain, Unsplash License and Pexels License. CC BY-SA photos and their resized/cropped versions retain the stated licenses. Original source pages identify the context; nationality was not inferred from appearance. Images are served locally through `next/image` with responsive sizes and descriptive bilingual alt text.

## Previous international photos (no longer displayed)

| Local photo | Photographer | Source |
| --- | --- | --- |
| `quiz.jpg` | Norma Mortenson | <https://www.pexels.com/photo/students-studying-together-8457292/> |
| `olympiad.jpg` | cottonbro studio | <https://www.pexels.com/photo/students-doing-a-research-6208726/> |
| `study-tour.jpg` | Keira Burton | <https://www.pexels.com/photo/multiethnic-students-studying-together-in-park-6146960/> |
| `innovation.jpg` | Vanessa Loring | <https://www.pexels.com/photo/young-students-doing-robotics-together-7869041/> |
| `workshop.jpg` | cottonbro studio | <https://www.pexels.com/photo/students-inside-a-science-laboratory-6208709/> |
| `conservation.jpg` | Thirdman | <https://www.pexels.com/photo/a-man-and-a-woman-doing-planting-on-green-grass-field-7656727/> |

The section uses the existing language store for English/Bangla text. Event-related cards link to `/events`. Quiz and innovation cards remain semantic articles without links because no matching public quiz or project listing exists. Protected dashboard routes are not used as public activity destinations.

Placement: the homepage now contains the hero, activities, and News & Blog section, followed by the shared public footer in `src/components/layout/footer.tsx`. That footer uses the existing app routes and bilingual language store, and is omitted on dashboard routes. Its four-column dark design follows the supplied footer reference; no external contact details, social accounts, or mobile app links are invented. The historical footer in `foundation.tsx` is preserved.

News & Blog (`src/components/home/news-blog.tsx`) reuses the Bangladesh innovation, workshop and conservation photographs as contextual editorial imagery. It displays up to three existing published announcements with their actual update dates. Remaining slots contain original bilingual educational notes from `src/lib/science-notes.ts`. Every Read more link opens `/blog/[id]`: readable note slugs, member post IDs, or `news-` prefixed announcement IDs. Article pages have matching header photographs and a Back to all blogs link. Notes have no invented publication dates. Loading/failure/retry states preserve access to notes. News articles still use the existing announcements API; member publishing uses the blog API. Shared cover selection in `src/lib/blog-covers.ts` keeps news card and header images consistent; member articles select a Bangladesh photo by science category. Source/license credits remain linked on article pages.

The public `/blog` page is available from the Blog navbar link for guests and all account roles. It reuses this component in standalone mode, with its own page heading and metadata, and always includes all three science notes alongside any published announcements. It also lists real member posts from the blog API and provides Write Blog linking to `/blog/write`. Approved students and teacher/admin staff can publish plain-text articles; `/blog/[id]` provides public reading pages. The menu and writing form follow the shared BN/EN setting; dashboard navigation is unchanged. See the repository API/database design documents for the new `blogPosts` collection and permission rules.
