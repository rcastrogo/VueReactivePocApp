import { sql } from '../db.js';

export const appSessionRepository = {
  getAll: () =>
    sql`SELECT id, user_id, expires_at, created_at FROM app_session ORDER BY created_at DESC`,
  getById: (id) =>
    sql`SELECT id, user_id, expires_at, created_at FROM app_session WHERE id = ${id}`,
  getByUserId: (userId) =>
    sql`SELECT id, user_id, expires_at, created_at FROM app_session WHERE user_id = ${userId} ORDER BY created_at DESC`,
  getValidByUserId: (userId) =>
    sql`SELECT id, user_id, expires_at, created_at FROM app_session WHERE user_id = ${userId} AND expires_at > NOW() ORDER BY expires_at DESC`,
  create: ({ id, user_id, expires_at }) =>
    sql`
      INSERT INTO app_session (id, user_id, expires_at)
      VALUES (${id}, ${user_id}, ${expires_at})
      RETURNING id, user_id, expires_at, created_at
    `,
  update: (id, { user_id, expires_at }) =>
    sql`
      UPDATE app_session
      SET user_id = ${user_id}, expires_at = ${expires_at}
      WHERE id = ${id}
      RETURNING id, user_id, expires_at, created_at
    `,
  delete: (id) =>
    sql`DELETE FROM app_session WHERE id = ${id} RETURNING id`
};