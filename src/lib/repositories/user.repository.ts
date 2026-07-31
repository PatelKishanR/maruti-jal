import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { User } from "@/lib/db/entities";

/**
 * Every query that touches the `users` table lives here and nowhere else.
 *
 * If a service needs users AND staff, it calls two repositories — a repository
 * never reaches into another entity's table.
 */
class UserRepository extends BaseRepository<User> {
  protected readonly target: EntityTarget<User> = User;
  protected readonly alias = "u";

  /**
   * Find by email INCLUDING the password hash.
   *
   * `passwordHash` is `select: false` on the entity, so it never loads by
   * accident. Only the sign-in and change-password paths should call this.
   */
  async findByEmailWithPassword(
    email: string,
    em?: EntityManager,
  ): Promise<User | null> {
    const qb = await this.qb(em);
    return qb
      .addSelect("u.passwordHash")
      .where("u.email = :email", { email: email.toLowerCase() })
      .andWhere("u.deletedAt IS NULL")
      .getOne();
  }

  async findByIdWithPasswordForUpdate(
    id: string,
    em: EntityManager,
  ): Promise<User | null> {
    return em
      .getRepository(User)
      .createQueryBuilder("u")
      .addSelect("u.passwordHash")
      .setLock("pessimistic_write")
      .where("u.id = :id", { id })
      .getOne();
  }

  async findActiveByEmail(email: string, em?: EntityManager): Promise<User | null> {
    const qb = await this.qb(em);
    return qb
      .where("u.email = :email", { email: email.toLowerCase() })
      .andWhere("u.isActive = true")
      .andWhere("u.deletedAt IS NULL")
      .getOne();
  }

  /** Is this email taken by a DIFFERENT, non-deleted account? */
  async isEmailTakenByOther(
    email: string,
    excludeUserId: string,
    em?: EntityManager,
  ): Promise<boolean> {
    const qb = await this.qb(em);
    return qb
      .where("u.email = :email", { email: email.toLowerCase() })
      .andWhere("u.id != :excludeUserId", { excludeUserId })
      .andWhere("u.deletedAt IS NULL")
      .getExists();
  }

  /** Minimal projection for the per-request session check — no wasted columns. */
  async findSessionState(
    id: string,
    em?: EntityManager,
  ): Promise<Pick<User, "id" | "sessionVersion" | "isActive"> | null> {
    const repo = await this.repo(em);
    return repo.findOne({
      where: { id },
      select: { id: true, sessionVersion: true, isActive: true },
    });
  }

  async touchLastLogin(id: string, em?: EntityManager): Promise<void> {
    await this.updateById(id, { lastLoginAt: new Date() }, em);
  }

  async countActive(em?: EntityManager): Promise<number> {
    const repo = await this.repo(em);
    return repo.count({ where: { isActive: true } });
  }
}

export const userRepository = new UserRepository();
