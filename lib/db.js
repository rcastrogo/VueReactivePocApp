import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida en las variables de entorno.');
}

export const sql = neon(process.env.DATABASE_URL);


export async function getDatabaseSchema() {

  const columns = await sql`
    SELECT 
      table_name, 
      column_name, 
      data_type, 
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `;

  const schema = columns.reduce((acc, col) => {
    if (!acc[col.table_name]) acc[col.table_name] = [];
    acc[col.table_name].push({
      column: col.column_name,
      type: col.data_type,
      nullable: col.is_nullable === 'YES',
      default: col.column_default,
    });
    return acc;
  }, {});

  return schema;
}

export function isSafeSelectQuery(sql) {

  const normalized = sql.trim().replace(/\s+/g, ' ');
  // 1. Debe empezar obligatoriamente por SELECT o WITH
  if (!/^(SELECT|WITH)\s/i.test(normalized)) {
    return false;
  }
  // 2. Blacklist de palabras de modificación de datos o estructura (DDL/DML/DCL)
  const forbiddenKeywords = [
    /\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i, /\bMERGE\b/i,
    /\bDROP\b/i, /\bALTER\b/i, /\bCREATE\b/i, /\bTRUNCATE\b/i,
    /\bGRANT\b/i, /\bREVOKE\b/i, /\bSECURITY\s+LABEL\b/i,
    /\bBEGIN\b/i, /\bSTART\s+TRANSACTION\b/i, /\bCOMMIT\b/i, /\bROLLBACK\b/i,
    /\bSAVEPOINT\b/i, /\bRELEASE\s+SAVEPOINT\b/i, /\bPREPARE\s+TRANSACTION\b/i,
    /\bEXECUTE\b/i, /\bCALL\b/i, /\bDO\b/i, /\bPREPARE\b/i,
    /\bDEALLOCATE\b/i, /\bCOPY\b/i, /\bLISTEN\b/i, /\bNOTIFY\b/i, /\bUNLISTEN\b/i,
    /\bVACUUM\b/i, /\bANALYZE\b/i, /\bREINDEX\b/i, /\bCLUSTER\b/i,
    /\bREFRESH\s+MATERIALIZED\s+VIEW\b/i, /\bLOCK\b/i,
    /\bSET\b/i, /\bRESET\b/i, /\bSHOW\b/i, /\bLOAD\b/i, /\bDISCARD\b/i,
    /\bCOMMENT\b/i, /\bEXPLAIN\s+ANALYZE\b/i, /\bINTO\b/i
  ];
  if (forbiddenKeywords.some(regex => regex.test(normalized))) {
    return false;
  }
  // 3. Evitar múltiples sentencias encadenadas mediante punto y coma (SQL Injection)
  // Permite un punto y coma únicamente si está al final del todo
  const cleaned = normalized.replace(/;$/, '');
  if (cleaned.includes(';')) {
    return false;
  }

  return true;
}

// -- 1. Crear rol para el agente
// CREATE ROLE mcp_readonly WITH LOGIN PASSWORD 'contrase~na_segura';
// -- 2. Conceder conexión a la base de datos
// GRANT CONNECT ON DATABASE tu_base_de_datos TO mcp_readonly;
// -- 3. Dar acceso al esquema público
// GRANT USAGE ON SCHEMA public TO mcp_readonly;
// -- 4. Dar permisos de solo lectura sobre todas las tablas existentes y futuras
// GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_readonly;
// ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON ALL TABLES TO mcp_readonly;