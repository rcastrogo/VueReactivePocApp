import { sql } from '@neondatabase/serverless';

// CRUD operations for app_user

export async function createAppUser({ id, googleId, email, name, picture }) {
  const result = await sql`
    INSERT INTO app_user (id, google_id, email, name, picture, created_at)
    VALUES (${id}, ${googleId}, ${email}, ${name}, ${picture}, NOW())
    RETURNING *;
  `;
  return result[0];
}

export async function getAppUserById(id) {
  const result = await sql`
    SELECT * FROM app_user WHERE id = ${id};
  `;
  return result[0] || null;
}

export async function getAppUserByGoogleId(googleId) {
  const result = await sql`
    SELECT * FROM app_user WHERE google_id = ${googleId};
  `;
  return result[0] || null;
}

export async function getAllAppUsers() {
  const result = await sql`
    SELECT * FROM app_user;
  `;
  return result;
}

export async function updateAppUser(id, { googleId, email, name, picture }) {
  const result = await sql`
    UPDATE app_user
    SET google_id = ${googleId}, email = ${email}, name = ${name}, picture = ${picture}
    WHERE id = ${id}
    RETURNING *;
  `;
  return result[0] || null;
}

export async function deleteAppUser(id) {
  const result = await sql`
    DELETE FROM app_user WHERE id = ${id} RETURNING *;
  `;
  return result[0] || null;
}
