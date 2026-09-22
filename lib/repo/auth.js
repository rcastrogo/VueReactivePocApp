import { sql } from '../db.js';

export const authRepository = {
	getSessionUser: (sessionToken) =>
		sql`
			SELECT
				u.id,
				u.email,
				u.name,
				u.picture,
				s.expires_at
			FROM app_session s
			JOIN app_user u ON s.user_id = u.id
			WHERE s.id = ${sessionToken}
				AND s.expires_at > NOW()
		`,
	saveGoogleUser: ({ id, email, name, picture }) =>
		sql`
			INSERT INTO app_user (google_id, email, name, picture)
			VALUES (${id}, ${email}, ${name}, ${picture})
			ON CONFLICT (google_id)
			DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, picture = EXCLUDED.picture
			RETURNING id
		`,
	createSession: ({ sessionId, userId, expiresAt }) =>
		sql`
			INSERT INTO app_session (id, user_id, expires_at)
			VALUES (${sessionId}, ${userId}, ${expiresAt})
			RETURNING id, user_id, expires_at
		`,
	deleteSession: (sessionToken) =>
		sql`
			DELETE FROM app_session
			WHERE id = ${sessionToken}
			RETURNING id
		`
}

// CREATE TABLE app_user (
//   id SERIAL PRIMARY KEY,
//   google_id VARCHAR(255) UNIQUE NOT NULL,
//   email VARCHAR(255) UNIQUE NOT NULL,
//   name VARCHAR(255),
//   picture TEXT,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );

// CREATE TABLE app_session (
//   id UUID PRIMARY KEY,
//   user_id INT REFERENCES app_user(id) ON DELETE CASCADE,
//   expires_at TIMESTAMP NOT NULL,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );