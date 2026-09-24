import { sql } from '../db.js';

export const tipoUsuarioRepository = {
  getAll: () =>
    sql`SELECT id, codigo, descripcion, activo FROM tipo_usuario ORDER BY id`,

  getAllActive: () =>
    sql`SELECT id, codigo, descripcion, activo FROM tipo_usuario WHERE activo = true ORDER BY id`,

  getById: (id) =>
    sql`SELECT id, codigo, descripcion, activo FROM tipo_usuario WHERE id = ${id}`,

  getByCodigo: (codigo) =>
    sql`SELECT id, codigo, descripcion, activo FROM tipo_usuario WHERE codigo = ${codigo}`,

  create: ({ codigo, descripcion, activo }) =>
    sql`
      INSERT INTO tipo_usuario (codigo, descripcion, activo)
      VALUES (${codigo}, ${descripcion}, ${activo ?? true})
      RETURNING id, codigo, descripcion, activo
    `,

  update: (id, { codigo, descripcion, activo }) =>
    sql`
      UPDATE tipo_usuario
      SET codigo = ${codigo}, descripcion = ${descripcion}, activo = ${activo ?? true}
      WHERE id = ${id}
      RETURNING id, codigo, descripcion, activo
    `,

  deactivate: (id) =>
    sql`
      UPDATE tipo_usuario
      SET activo = false
      WHERE id = ${id}
      RETURNING id, codigo, descripcion, activo
    `,

  delete: (id) =>
    sql`DELETE FROM tipo_usuario WHERE id = ${id} RETURNING id`
};