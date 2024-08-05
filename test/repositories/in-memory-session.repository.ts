import {
  SESSION_DURATION_IN_MILLISECONDS,
  Session,
} from "@/domain/entities/session.entity";
import { SessionRepository } from "@/domain/repositories/session.repository";

export class InMemorySessionRepository implements SessionRepository {
  public items: Session[] = [];

  public async create(session: Session) {
    this.items.push(session);
  }

  public async findUniqueByToken(token: string) {
    const session = this.items.find(item => item.token === token);

    return session ?? null;
  }

  public async updateUniqueToRenew(session: Session) {
    session.update({
      expiresAt: new Date(Date.now() + SESSION_DURATION_IN_MILLISECONDS),
    });
  }

  public async updateUniqueToRevoke(session: Session) {
    session.update({
      expiresAt: new Date(),
    });
  }
}
