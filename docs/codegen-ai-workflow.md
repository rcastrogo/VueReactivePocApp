# Codegen workflow for AI agents

This project supports two generation modes:

1. CLI mode from input file (good for reproducible local runs).
2. In-memory mode (recommended for AI chat flows).

## In-memory mode (no temp JSON files)

Use the exported symbol `generateAllFiles` directly with an object or array in memory.

```js
const path = require('path');
const { generateAllFiles, writeGeneratedFiles } = require('./scripts/code.cjs');

const entities = [
  {
    itemName: 'Moneda',
    collectionName: 'Monedas',
    tableName: 'TBL_MONEDAS',
    namespace: '',
    properties: [
      { name: 'Id', dbName: 'ID_MONEDA', dbType: 'int', isId: true, omitDal: false, readOnly: true },
      { name: 'Descripcion', dbName: 'DESCRIPCION', dbType: 'string', isId: false, omitDal: false, readOnly: false }
    ]
  },
  {
    itemName: 'Tipo',
    collectionName: 'Tipos',
    tableName: 'TBL_TIPOS',
    namespace: '',
    properties: [
      { name: 'Id', dbName: 'ID_TIPO', dbType: 'int', isId: true, omitDal: false, readOnly: true },
      { name: 'Descripcion', dbName: 'DESCRIPCION', dbType: 'string', isId: false, omitDal: false, readOnly: false }
    ]
  }
];

const files = generateAllFiles(entities);
writeGeneratedFiles(files, path.resolve('./src/generated'));
```

## Chat agent rule

When an AI agent needs code generation:

- Prefer in-memory generation.
- Do not create temp JSON files.
- Build the entity payload in memory.
- Call `generateAllFiles(payload)`.
- Persist output only with `writeGeneratedFiles(files, outDir)`.

## When to use CLI mode

Use CLI mode only when the user explicitly asks for file-driven generation or reproducible command-line runs.
