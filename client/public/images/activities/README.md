# Activity and blog photography

The homepage Activity and News & Blog sections, and the shared Blog page, now use local photographs of real people from Pexels. These are illustrative stock photos, not photographs of NGC Science Club members, events, or news. The original SVG placeholders remain in the folder but are no longer used by either section.

Photos were downloaded on 2026-11-16 at 1200px width, with Pexels CDN compression. They are served locally through `next/image`, with responsive sizes and descriptive bilingual alt text. The Pexels license permits free personal/commercial use without required attribution; credits are retained here. License: <https://www.pexels.com/license/>. Terms: <https://www.pexels.com/terms-of-service/>.

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

News & Blog (`src/components/home/news-blog.tsx`) reuses the innovation, workshop and conservation photographs as stock editorial imagery. It displays up to three existing published announcements with their actual update dates and detail links. Remaining slots contain original bilingual educational notes, readable in a keyboard-accessible dialog. Notes have no invented publication dates. Loading/failure/retry states preserve access to notes. The final link opens the existing announcements page. No blog database, publishing workflow, or API changes were added.

The public `/blog` page is available from the Blog navbar link for guests and all account roles. It reuses this component in standalone mode, with its own page heading and metadata, and always includes all three science notes alongside any published announcements. The menu label follows the shared BN/EN setting; dashboard navigation is unchanged.
