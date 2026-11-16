# Activity artwork

The six SVGs in this folder are local illustrated placeholders, not photographs of NGC Science Club events. No suitable activity photographs were available when the section was created.

Missing photo assets: science quiz, Olympiad, educational study tour, science project/innovation, workshop/seminar, and environment/conservation. Replace each illustration with a cleared local photograph when available, then update `image` and bilingual `alt` fields in `src/components/home/science-activities.tsx`. Keep a 16:10 crop; suggested source size is 1200 × 750 or larger.

The section uses the existing language store for English/Bangla text. Event-related cards link to `/events`. Quiz and innovation cards remain semantic articles without links because no matching public quiz or project listing exists. Protected dashboard routes are not used as public activity destinations.

Placement: the section is the last child of the homepage main element, immediately before the shared public footer in `src/components/layout/footer.tsx`. That footer uses the existing app routes and bilingual language store, and is omitted on dashboard routes. Its four-column dark design follows the supplied footer reference; no external contact details, social accounts, or mobile app links are invented. The historical footer in `foundation.tsx` is preserved.
