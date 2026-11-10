import { AppError } from "../../utils/app-error.js";
import {
  applicationSchema,
  applicationListSchema,
  applicationIdSchema,
  reviewSchema,
  memberProfilePatchSchema,
} from "./application.schema.js";
import type { ApplicationRepository } from "./application.repository.js";

export function createApplicationService(repository: ApplicationRepository) {
  return {
    ownProfile(userId: string) {
      return repository.ownProfile(userId);
    },
    updateOwnProfile(userId: string, body: unknown) {
      const input = memberProfilePatchSchema.safeParse(body);
      if (!input.success)
        throw new AppError(
          400,
          "Only valid name, phone, department and academic year updates are allowed.",
        );
      return repository.updateOwnProfile(userId, input.data);
    },
    submit(userId: string, body: unknown) {
      const result = applicationSchema.safeParse(body);
      if (!result.success)
        throw new AppError(
          400,
          "Invalid application details. Check all six fields.",
        );
      return repository.create(userId, result.data);
    },
    status(userId: string) {
      return repository.findForUser(userId);
    },
    list(query: unknown) {
      const input = applicationListSchema.safeParse(query);
      if (!input.success)
        throw new AppError(400, "Invalid application filter or page.");
      return repository.list(input.data);
    },
    review(id: unknown, reviewerId: string, body: unknown) {
      const target = applicationIdSchema.safeParse(id);
      const input = reviewSchema.safeParse(body);
      if (!target.success || !input.success)
        throw new AppError(
          400,
          "Invalid review. Rejection requires a reason of 5–1000 characters.",
        );
      return repository.review(target.data, reviewerId, input.data);
    },
  };
}
