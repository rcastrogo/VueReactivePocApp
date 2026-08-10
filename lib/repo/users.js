
import { sql } from '../db.js';

export const userRepository = {
  getAll: () => 
    sql`SELECT id, nif, nombre, descripcion, fecha_de_alta, fecha_de_baja FROM usuario ORDER BY id`,
  getById: (id) => 
    sql`SELECT id, nif, nombre, descripcion, fecha_de_alta, fecha_de_baja FROM usuario WHERE id = ${id}`,
  create: ({ nif, nombre, descripcion }) => 
    sql`
      INSERT INTO usuario (nif, nombre, descripcion) 
      VALUES (${nif}, ${nombre}, ${descripcion || null}) 
      RETURNING id, nif, nombre, descripcion, fecha_de_alta, fecha_de_baja
    `,
  update: (id, { nif, nombre, descripcion }) => 
    sql`
      UPDATE usuario 
      SET nif = ${nif}, nombre = ${nombre}, descripcion = ${descripcion || null} 
      WHERE id = ${id} 
      RETURNING id, nif, nombre, descripcion, fecha_de_alta, fecha_de_baja
    `,
  delete: (id) => 
    sql`DELETE FROM usuario WHERE id = ${id} RETURNING id`,
  deactivate: (id) => 
    sql`
      UPDATE usuario 
      SET fecha_de_baja = CURRENT_TIMESTAMP 
      WHERE id = ${id} AND fecha_de_baja IS NULL
      RETURNING id, nif, nombre, fecha_de_alta, fecha_de_baja
    `,
  activate: (id) =>
    sql`
      UPDATE usuario
      SET fecha_de_baja = NULL
      WHERE id = ${id} AND fecha_de_baja IS NOT NULL
      RETURNING id, nif, nombre, fecha_de_alta, fecha_de_baja
    `
};