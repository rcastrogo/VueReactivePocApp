import { sql } from '@neondatabase/serverless';

// CRUD operations for app_session

export async function createSession({ id, userId, expiresAt }) {
  const result = await sql`
    INSERT INTO app_session (id, user_id, expires_at, created_at)
    VALUES (${id}, ${userId}, ${expiresAt}, NOW())
    RETURNING *;
  `;
  return result[0];
}

export async function getSessionById(id) {
  const result = await sql`
    SELECT * FROM app_session WHERE id = ${id};
  `;
  return result[0] || null;
}

export async function getAllSessions() {
  const result = await sql`
    SELECT * FROM app_session;
  `;
  return result;
}

export async function updateSession(id, { userId, expiresAt }) {
  const result = await sql`
    UPDATE app_session
    SET user_id = ${userId}, expires_at = ${expiresAt}
    WHERE id = ${id}
    RETURNING *;
  `;
  return result[0] || null;
}

export async function deleteSession(id) {
  const result = await sql`
    DELETE FROM app_session WHERE id = ${id} RETURNING *;
  `;
  return result[0] || null;
}
