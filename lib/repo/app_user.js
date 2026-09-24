import { sql } from '../db.js';

export const appUserRepository = {
  getAll: () =>
    sql`SELECT id, google_id, email, name, picture, created_at FROM app_user ORDER BY id`,
  getById: (id) =>
    sql`SELECT id, google_id, email, name, picture, created_at FROM app_user WHERE id = ${id}`,
  getByGoogleId: (googleId) =>
    sql`SELECT id, google_id, email, name, picture, created_at FROM app_user WHERE google_id = ${googleId}`, 
  getByEmail: (email) =>
    sql`SELECT id, google_id, email, name, picture, created_at FROM app_user WHERE email = ${email}`,
  create: ({ google_id, email, name, picture }) =>
    sql`
      INSERT INTO app_user (google_id, email, name, picture)
      VALUES (${google_id}, ${email}, ${name || null}, ${picture || null})
      RETURNING id, google_id, email, name, picture, created_at
    `,
  update: (id, { google_id, email, name, picture }) =>
    sql`
      UPDATE app_user
      SET google_id = ${google_id}, email = ${email}, name = ${name || null}, picture = ${picture || null}
      WHERE id = ${id}
      RETURNING id, google_id, email, name, picture, created_at
    `,
  delete: (id) =>
    sql`DELETE FROM app_user WHERE id = ${id} RETURNING id`,
  deleteExpired: () =>
    sql`DELETE FROM app_session WHERE expires_at <= NOW() RETURNING id`
};