#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('util');

// 1. Utilidades para mapeo de tipos
function mapCSharpType(dbType) {
  const types = {
    'string': 'string',
    'DateTime': 'string',
    'Date': 'string',
    'int': 'int',
    'double': 'double',
    'decimal': 'decimal',
    'short': 'short',
    'boolean': 'bool',
    'long': 'long'
  };
  return types[dbType] || dbType;
}

function getBuilderCondition(prop) {
  const type = prop.dbType.toLowerCase();
  if (type === 'string') return `.And("${prop.dbName}", "${prop.dbName}")`;
  if (type === 'date' || type === 'datetime') return `.AndDate("${prop.dbName}")`;
  if (type === 'int') return `.And("${prop.dbName}")`;
  return `// ${prop.dbName} .And ${prop.dbType}`;
}

// 2. Generadores C#
function generateEntityItem(entity) {
  const properties = entity.properties.map(p => {
    const csharpType = mapCSharpType(p.dbType);
    const modifier = p.isId ? 'override ' : '';
    const privateVar = `_${p.name.charAt(0).toLowerCase() + p.name.slice(1)}`;

    let setter = `set { ${privateVar} = value; }`;
    if (p.dbType === 'Date' || p.dbType === 'DateTime') {
      setter = `set { \n        try { ${privateVar} = DateTime.Parse(value).ToString("dd/MM/yyyy"); }\n        catch { ${privateVar} = ""; }\n      }`;
    }
    if (p.readOnly) setter = '';

    return `
    private ${csharpType} ${privateVar};
    public ${modifier}${csharpType} ${p.name} {
      get { return ${privateVar}; }
      ${setter}
    }`;
  }).join('\n');

  const insertCallParams = entity.properties.filter(p => !p.isId && !p.omitDal).map(p => p.name).join(', ');
  const updateCallParams = entity.properties.filter(p => !p.omitDal).map(p => p.name).join(', ');

  return `
// ========================================================
// Negocio.${entity.itemName}.cs
// ========================================================
namespace Negocio.Entities${entity.namespace || ''} {
  using Dal.Core;
  using Dal.Repositories${entity.namespace || ''};
  using Negocio.Core;
  using System;

  [Serializable()]
  public class ${entity.itemName} : Entity {
    public ${entity.itemName}() { }
    public ${entity.itemName}(DbContext context) : base(context) { }

    public ${entity.itemName} Load() {
      return Load(Id);
    }
    
    public ${entity.itemName} Load(long id) {    
      using (${entity.collectionName}Repository repo = new ${entity.collectionName}Repository(DataContext)) {
        return repo.LoadOne<${entity.itemName}>(this, repo.GetItem(id));
      }   
    }

    public ${entity.itemName} Save() {
      using (${entity.collectionName}Repository repo = new ${entity.collectionName}Repository(DataContext)) {
        if (_id == 0) {
          _id = repo.Insert(${insertCallParams});
        } else {
          repo.Update(${updateCallParams});
        }
        return this;
      }
    }
            
    public void Delete() {
      using (${entity.collectionName}Repository repo = new ${entity.collectionName}Repository(DataContext)) {
        repo.Delete(_id);
      }
    }
${properties}
  }
}`;
}

function generateRepository(entity) {
  const propsForBuilder = entity.properties.filter(p => !p.isId && !p.omitDal);
  const propsForUpdate = entity.properties.filter(p => !p.omitDal);

  const builderLines = propsForBuilder.map(p => `              ${getBuilderCondition(p)}`).join('\n');
  const insertParams = propsForBuilder.map(p => `${mapCSharpType(p.dbType)} ${p.name}`).join(', ');
  const insertBag = propsForBuilder.map(p => `                          .Use("${p.dbName}", ${p.name})`).join('\n');
  const updateParams = propsForUpdate.map(p => `${mapCSharpType(p.dbType)} ${p.name}`).join(', ');
  const updateBag = propsForUpdate.map(p => `                          .Use("${p.dbName}", ${p.name})`).join('\n');

  return `
// ========================================================      
// ${entity.collectionName}Repository.cs
// ========================================================
namespace Dal.Repositories${entity.namespace || ''} {
  using Dal.Core;
  using Dal.Core.Loader;
  using Dal.Core.Queries;
  using System.Collections.Generic;
  using System.Data;

  [RepoName("Dal.Repositories${entity.namespace || ''}.${entity.collectionName}Repository")]
  public class ${entity.collectionName}Repository : RepositoryBase {
  
    public ${entity.collectionName}Repository(DbContext context) : base(context) { }
        
    public IDataReader GetItems(ParameterBag bag){
      var __builder = new SqlWhereClauseBuilder(bag)
${builderLines}
            .AndListOf<long>("Ids", "id"); 
      return GetItems(__builder);
    }
    
    public long Insert(${insertParams}) { 
      return Insert(new ParameterBag()
${insertBag});                
    }
  
    public int Update(${updateParams}) {
      return Update(new ParameterBag()
${updateBag});            
    }
  }
}`;
}

function generateEntityList(entity) {
  return `
// ========================================================
// Negocio.${entity.collectionName}.cs
// ========================================================    
namespace Negocio.Entities${entity.namespace || ''} {
  using Dal.Core;
  using Dal.Repositories${entity.namespace || ''};
  using Negocio.Core;
  using System.Collections.Generic;
  using Dal.Core.Queries;
  using System.Linq;

  [System.Xml.Serialization.XmlRoot("${entity.collectionName}")]
  public class ${entity.collectionName} : EntityList<${entity.itemName}> {
    public ${entity.collectionName}() { }
    public ${entity.collectionName}(DbContext context) : base(context) { }
        
    public ${entity.collectionName}(IEnumerable<${entity.itemName}> values) : base() {
      values.ToList().ForEach( u => Add(u));
    }

    public ${entity.collectionName} Load() {
      using (${entity.collectionName}Repository repo = new ${entity.collectionName}Repository(base.DataContext)) {
        return (${entity.collectionName})repo.Load<${entity.itemName}>(this, repo.GetItems());
      }
    }
  }
}`;
}

function generateEndpoints(entity) {
  const ns = entity.namespace || '';
  const itemLower = entity.itemName.charAt(0).toLowerCase() + entity.itemName.slice(1);
  const namespacePath = ns
    .replace(/^\./, '')
    .split('.')
    .filter(Boolean)
    .map(part => part.toLowerCase())
    .join('/');
  const routeSegments = ['api'];
  if (namespacePath) routeSegments.push(namespacePath);
  routeSegments.push(entity.collectionName.toLowerCase());
  const routePath = `/${routeSegments.join('/')}`;
  const nonIdProps = entity.properties.filter(p => !p.isId && p.name.toLowerCase() !== 'id');

  return `
// ========================================================
// Api.Endpoints.${entity.itemName}Endpoints.cs
// ========================================================
namespace Api.Endpoints${ns} {

  using Microsoft.AspNetCore.Builder;
  using Microsoft.AspNetCore.Http;
  using Microsoft.AspNetCore.Routing;
  using Negocio.Entities${ns};
  using Dal.Core;

  public static class ${entity.itemName}Endpoints {

    public static void Map${entity.itemName}Endpoints(this IEndpointRouteBuilder app) {
      var group = app.MapGroup("${routePath}").WithTags("${entity.collectionName}");

      group.MapGet("/", () => {
        var lista = new ${entity.collectionName}();
        return Results.Ok(lista.Load());
      });

      group.MapGet("/{id:long}", (long id) => {
        var item = new ${entity.itemName}().Load(id);
        if (item == null) return Results.NotFound();
        return Results.Ok(item);
      });

      group.MapPost("/", (${entity.itemName} ${itemLower}) => {
        var item = new ${entity.itemName}() {
${nonIdProps.map(p => `          ${p.name} = ${itemLower}.${p.name}`).join(',\n')}
        };
        item.Save();
        return Results.Created($"${routePath}/{item.Id}", item);
      });

      group.MapPut("/{id:long}", (long id, ${entity.itemName} ${itemLower}) => {
        var item = new ${entity.itemName}().Load(id);
        if (item == null) return Results.NotFound();
${nonIdProps.map(p => `        item.${p.name} = ${itemLower}.${p.name};`).join('\n')}
        item.Save();
        return Results.Ok(item);
      });

      group.MapDelete("/{id:long}", (long id) => {
        var item = new ${entity.itemName}().Load(id);
        if (item == null) return Results.NotFound();
        item.Delete();
        return Results.NoContent();
      });
    }
  }
}`;
}

function mapBinderType(dbType) {
  const types = {
    'long': 'Integer', 'int': 'Integer', 'short': 'Integer',
    'double': 'Double', 'decimal': 'Decimal', 'boolean': 'Boolean',
    'DateTime': 'DateTime', 'Date': 'DateTime'
  };
  return types[dbType] || '';
}

function generateBinders(entities) {
  return entities.map(entity => {
    const ns = entity.namespace ? `.${entity.namespace.replace(/^\./, '')}` : '';
    const header = `; ===========================================================\n; Negocio.Entities${ns}.${entity.itemName}\n; ===========================================================`;
    const className = `#Negocio.Entities${ns}.${entity.itemName}`;
    const lines = entity.properties.map((p, index) => {
      const varName = `_${p.name.charAt(0).toLowerCase()}${p.name.slice(1)}`;
      const binderType = mapBinderType(p.dbType);
      const paddedVar = varName.padEnd(30);
      return binderType
        ? ` ${index}, ${paddedVar}, ${binderType}`
        : ` ${index}, ${paddedVar}`;
    });
    return `${header}\n${className}\n${lines.join('\n')}`;
  }).join('\n\n');
}

function generateQueries(entities) {
  return entities.map(entity => {
    const ns = entity.namespace ? `.${entity.namespace.replace(/^\./, '')}` : '';
    const repoName = `Dal.Repositories${ns}.${entity.collectionName}Repository`;
    const header = `; ===========================================================\n; ${repoName}\n; ===========================================================`;

    const allDbNames = entity.properties.map(p => p.dbName);
    const nonIdProps = entity.properties.filter(p => !p.isId && p.name.toLowerCase() !== 'id');

    const selectCols = allDbNames.join(', ');
    const insertCols = nonIdProps.map(p => p.dbName).join(', ');
    const insertPlaceholders = nonIdProps.map(p => `@${p.dbName}`).join(', ');
    const updateSets = nonIdProps.map(p => `${p.dbName} = @${p.dbName}`).join(', ');

    const lines = [
      `#${repoName}.OrderBy%Id ASC`,
      `#${repoName}.Delete%DELETE FROM ${entity.tableName} WHERE Id=@Id`,
      `#${repoName}.Select%SELECT ${selectCols} FROM ${entity.tableName}`,
      `#${repoName}.Insert%INSERT INTO ${entity.tableName} (${insertCols}) VALUES(${insertPlaceholders}); SELECT CAST(SCOPE_IDENTITY() AS BIGINT);`,
      `#${repoName}.Update%UPDATE ${entity.tableName} SET ${updateSets} WHERE Id=@Id`
    ];

    return `${header}\n${lines.join('\n')}`;
  }).join('\n\n\n');
}

function generateAllFiles(entities) {
  const normalizedEntities = Array.isArray(entities) ? entities : [entities];
  const files = [];

  normalizedEntities.forEach(entity => {
    const namespaceParts = (entity.namespace || '')
      .replace(/^\./, '')
      .split('.')
      .filter(Boolean);
    const entityFolder = path.join(...namespaceParts, entity.collectionName);

    files.push({ fileName: path.join(entityFolder, `${entity.collectionName}Repository.cs`), content: generateRepository(entity).trim() });
    files.push({ fileName: path.join(entityFolder, `${entity.collectionName}.cs`), content: generateEntityList(entity).trim() });
    files.push({ fileName: path.join(entityFolder, `${entity.itemName}.cs`), content: generateEntityItem(entity).trim() });
    files.push({ fileName: path.join(entityFolder, `${entity.itemName}Endpoints.cs`), content: generateEndpoints(entity).trim() });
  });

  files.push({ fileName: 'entities.binders.txt', content: generateBinders(normalizedEntities) });
  files.push({ fileName: 'entities.queries.txt', content: generateQueries(normalizedEntities) });

  return files;
}

function writeGeneratedFiles(files, outDir) {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  files.forEach(file => {
    const filePath = path.join(outDir, file.fileName);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, file.content, 'utf-8');
    console.log(`[✔] Generado: ${file.fileName}`);
  });
}

function normalizeEntitiesInput(parsedData) {
  return Array.isArray(parsedData) ? parsedData : [parsedData];
}

// 3. Lógica del CLI
function runCLI() {
  const options = {
    input: { type: 'string', short: 'i' },
    output: { type: 'string', short: 'o', default: './src/_code' },
    help: { type: 'boolean', short: 'h' },
  };

  const { values } = parseArgs({ options, allowPositionals: true });

  if (values.help || !values.input) {
    console.log(`
Uso: node codegen.js -i <archivo.json> [-o <directorio_salida>]

Opciones:
  -i, --input    Ruta al archivo JSON de entrada (Requerido)
  -o, --output   Directorio donde se generarán los archivos (Por defecto: ./src/_code)
  -h, --help     Muestra esta ayuda

Estructura de JSON esperada (puede ser un único objeto o un array de objetos):
[
  {
    "itemName": "Usuario",
    "collectionName": "Usuarios",
    "tableName": "TBL_USUARIOS",
    "namespace": ".Seguridad",
    "properties": [
      { 
        "name": "Id", 
        "dbName": "ID_USUARIO", 
        "dbType": "long", 
        "isId": true, 
        "omitDal": false, 
        "readOnly": true 
      },
      { 
        "name": "Nombre", 
        "dbName": "NOMBRE", 
        "dbType": "string", 
        "isId": false, 
        "omitDal": false, 
        "readOnly": false 
      }
    ]
  }
]
    `);
    process.exit(0);
  }

  try {
    // 1. Leer el archivo JSON
    const rawData = fs.readFileSync(path.resolve(values.input), 'utf-8');

    // 2. Parsear el JSON
    const parsedData = JSON.parse(rawData);

    // 3. Normalizar la entrada: si es un objeto único, convertirlo a un array
    const entities = normalizeEntitiesInput(parsedData);

    // 4. Generar los archivos en memoria
    const files = generateAllFiles(entities);

    // 5. Crear directorio de salida si no existe
    const outDir = path.resolve(values.output);

    // 6. Escribir los archivos en disco
    writeGeneratedFiles(files, outDir);

    console.log(`\nProceso completado exitosamente en: ${outDir}`);

  } catch (error) {
    console.error(`\n[✖] Error ejecutando el generador: ${error.message}`);
    process.exit(1);
  }
}

// Ejecutar si es llamado desde consola
if (require.main === module) {
  runCLI();
}

// Exportar la función base por si se usa como módulo
module.exports = { generateAllFiles, writeGeneratedFiles, normalizeEntitiesInput };