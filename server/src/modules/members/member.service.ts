import { countMembers } from "./member.repository.js";
import type { MemberRepository } from "./member.repository.js";
import { memberIdSchema, memberQuerySchema } from "./member.schema.js";
import { AppError } from "../../utils/app-error.js";

export function createMemberService(repository: MemberRepository) {
  return {
    list(query: unknown) {
      const parsed = memberQuerySchema.safeParse(query);
      if (!parsed.success)
        throw new AppError(400, "Invalid member search, filters or page.");
      return repository.list(parsed.data);
    },
    async profile(id: unknown) {
      const parsed = memberIdSchema.safeParse(id);
      if (!parsed.success) throw new AppError(400, "Invalid member ID.");
      const member = await repository.profile(parsed.data);
      if (!member) throw new AppError(404, "Member not found.");
      return member;
    },
    count() {
      return repository.count();
    },
    stats() {
      return repository.stats();
    },
  };
}

export async function getMemberCount(): Promise<number> {
  return countMembers();
}
