import { Session } from "../entities/session.entity";

export interface SessionRepository {
  create(session: Session): Promise<void>;
  findUniqueByToken(token: string): Promise<Session | null>;
  updateUniqueToRenew(session: Session): Promise<void>;
  updateUniqueToRevoke(session: Session): Promise<void>;
}
