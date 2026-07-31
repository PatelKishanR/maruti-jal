import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { ExpenseCategory } from "@/lib/db/entities";

/**
 * Every query that touches the `expense_categories` table lives here and
 * nowhere else.
 *
 * "How many expenses are filed under this category?" belongs to
 * ExpenseRepository — a repository queries its own table only.
 * See .claude/ARCHITECTURE.md §4.1 rule 4
 */
class ExpenseCategoryRepository extends BaseRepository<ExpenseCategory> {
  protected readonly target: EntityTarget<ExpenseCategory> = ExpenseCategory;
  protected readonly alias = "ec";

  /**
   * The whole list, including inactive ones — this table stays in the low tens
   * of rows, so paginating it would cost more code than it saves queries.
   */
  async findAllOrdered(em?: EntityManager): Promise<ExpenseCategory[]> {
    const qb = await this.qb(em);
    return qb
      .where("ec.deletedAt IS NULL")
      .orderBy("ec.sortOrder", "ASC")
      .addOrderBy("ec.name", "ASC")
      .addOrderBy("ec.id", "ASC")
      .getMany();
  }

  /** The expense-form dropdown. Retired categories must not be selectable. */
  async findActive(em?: EntityManager): Promise<ExpenseCategory[]> {
    const qb = await this.qb(em);
    return qb
      .where("ec.deletedAt IS NULL")
      .andWhere("ec.isActive = true")
      .orderBy("ec.sortOrder", "ASC")
      .addOrderBy("ec.name", "ASC")
      .addOrderBy("ec.id", "ASC")
      .getMany();
  }

  /**
   * Case-insensitive: "Diesel" and "diesel" are the same bucket to the owner,
   * and two of them makes every expense report wrong.
   */
  async isNameTaken(
    name: string,
    excludeCategoryId?: string,
    em?: EntityManager,
  ): Promise<boolean> {
    const qb = await this.qb(em);
    qb.where("lower(ec.name) = lower(:name)", { name: name.trim() }).andWhere(
      "ec.deletedAt IS NULL",
    );
    if (excludeCategoryId) {
      qb.andWhere("ec.id != :excludeCategoryId", { excludeCategoryId });
    }
    return qb.getExists();
  }

  async findByName(
    name: string,
    em?: EntityManager,
  ): Promise<ExpenseCategory | null> {
    const qb = await this.qb(em);
    return qb
      .where("lower(ec.name) = lower(:name)", { name: name.trim() })
      .andWhere("ec.deletedAt IS NULL")
      .getOne();
  }
}

export const expenseCategoryRepository = new ExpenseCategoryRepository();
