# Query and index review — Milestone 16

This plan does not execute migrations. Inspect existing index names/options and run `explain("executionStats")` on fictional staging data before approving any index writes. Natural `_id` uniqueness already protects membership-per-account, attempts-per-quiz/account, event registration and certificate-per-registration; never replace these invariants with a non-unique index.

| Collection             | Candidate index                                                                                    | Query supported                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| membershipApplications | `{submittedAt:1}`, `{status:1, reviewedAt:1}`                                                      | Report submission cohorts; approved directory/statistics |
| quizzes                | `{createdAt:1}`, `{createdBy:1, createdAt:-1, _id:1}`                                              | Report cohorts; owned quiz pagination                    |
| events                 | `{startsAt:1}`, `{createdBy:1, startsAt:1, _id:1}`                                                 | Event-date reports; owned event lists                    |
| eventRegistrations     | `{registeredAt:1, status:1}`, `{eventId:1, status:1, _id:1}`, `{userId:1, registeredAt:-1, _id:1}` | Registration cohorts, participant lists and own history  |
| feedbackThreads        | `{createdAt:1}`, `{userId:1, updatedAt:-1, _id:1}`, `{assignedTeacherId:1, updatedAt:-1, _id:1}`   | Report cohorts and private inboxes                       |
| learningResources      | `{status:1, deletedAt:1, updatedAt:-1, _id:1}`, `{createdBy:1, updatedAt:-1, _id:1}`               | Published resource library and staff management          |
| certificates           | `{userId:1, issuedAt:-1, _id:1}`, `{ownerId:1, issuedAt:-1, _id:1}`                                | Own and staff certificate pagination                     |

These are candidates, not measured performance guarantees. Check the exact filters and sort order in each repository before application; avoid overlapping indexes and account for write overhead. The two-day/731-day range limits and pagination bound output, not the number of database records examined. Substring regex searches are escaped/length-bounded but generally cannot use a normal text-field B-tree efficiently; consider an approved search index when measured traffic justifies it.

Existing analytics aggregation timeouts remain 10 seconds. New reporting uses date matches before facets and a 10-second timeout per aggregation. Certificates now use one paginated certificate query plus two batched `_id` validity reads rather than two reads per row. Tests check projection and query count. Driver configuration bounds the pool to 50 connections, idle time to 60 seconds and pool waiting to 10 seconds. Private APIs remain uncached so session revocation, membership/attendance changes and permissions are checked freshly. Public image URLs render client-side with lazy Next Image defaults and no image proxy allowlist expansion; arbitrary user URLs are not fetched by the server image optimizer.

No Atlas index creation, query benchmark, GridFS write or production tuning was performed. Review deployment topology, database measurements and load before changing pool/limiter thresholds.
