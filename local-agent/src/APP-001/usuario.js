import { sql } from '@neondatabase/serverless';

// CRUD operations for usuario

export async function createUsuario({ id, nif, nombre, descripcion, fechaDeAlta, fechaDeBaja }) {
  const result = await sql`
    INSERT INTO usuario (id, nif, nombre, descripcion, fecha_de_alta, fecha_de_baja)
    VALUES (${id}, ${nif}, ${nombre}, ${descripcion}, ${fechaDeAlta}, ${fechaDeBaja})
    RETURNING *;
  `;
  return result[0];
}

export async function getUsuarioById(id) {
  const result = await sql`
    SELECT * FROM usuario WHERE id = ${id};
  `;
  return result[0] || null;
}

export async function getAllUsuarios() {
  const result = await sql`
    SELECT * FROM usuario;
  `;
  return result;
}

export async function updateUsuario(id, { nif, nombre, descripcion, fechaDeAlta, fechaDeBaja }) {
  const result = await sql`
    UPDATE usuario
    SET nif = ${nif}, nombre = ${nombre}, descripcion = ${descripcion}, fecha_de_alta = ${fechaDeAlta}, fecha_de_baja = ${fechaDeBaja}
    WHERE id = ${id}
    RETURNING *;
  `;
  return result[0] || null;
}

export async function deleteUsuario(id) {
  const result = await sql`
    DELETE FROM usuario WHERE id = ${id} RETURNING *;
  `;
  return result[0] || null;
}
