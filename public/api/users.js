import {neon} from '@neondatabase/serverless';

/**
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default async function handler(req, res) {
  console.log(req.method || 'GET');
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL no está definida en las variables de entorno.');
    }
    const sql = neon(process.env.DATABASE_URL);
    if (req.method === 'GET') {
      const users = await sql`SELECT id, nif, nombre, descripcion, fecha_de_alta, fecha_de_baja FROM usuario LIMIT 100`;
      return res.status(200).json(users);
    }

    // if (req.method === 'POST') {
    //   const { name, email } = req.body || {};
      
    //   if (!name || !email) {
    //     return res.status(400).json({ error: 'Faltan campos requeridos' });
    //   }

    //   const [newUser] = await sql`
    //     INSERT INTO users (name, email)
    //     VALUES (${name}, ${email})
    //     RETURNING id, name, email
    //   `;

    //   return res.status(201).json(newUser);
    // }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Error en base de datos:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}