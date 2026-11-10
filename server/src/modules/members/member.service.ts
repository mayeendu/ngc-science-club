import { countMembers } from "./member.repository.js";

export async function getMemberCount(): Promise<number> {
  return countMembers();
}
