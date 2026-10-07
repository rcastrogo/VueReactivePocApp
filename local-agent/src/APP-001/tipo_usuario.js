import { sql } from '@neondatabase/serverless';

// CRUD operations for tipo_usuario

export async function createTipoUsuario({ id, codigo, descripcion, activo }) {
  const result = await sql`
    INSERT INTO tipo_usuario (id, codigo, descripcion, activo)
    VALUES (${id}, ${codigo}, ${descripcion}, ${activo})
    RETURNING *;
  `;
  return result[0];
}

export async function getTipoUsuarioById(id) {
  const result = await sql`
    SELECT * FROM tipo_usuario WHERE id = ${id};
  `;
  return result[0] || null;
}

export async function getAllTiposUsuario() {
  const result = await sql`
    SELECT * FROM tipo_usuario;
  `;
  return result;
}

export async function updateTipoUsuario(id, { codigo, descripcion, activo }) {
  const result = await sql`
    UPDATE tipo_usuario
    SET codigo = ${codigo}, descripcion = ${descripcion}, activo = ${activo}
    WHERE id = ${id}
    RETURNING *;
  `;
  return result[0] || null;
}

export async function deleteTipoUsuario(id) {
  const result = await sql`
    DELETE FROM tipo_usuario WHERE id = ${id} RETURNING *;
  `;
  return result[0] || null;
}
