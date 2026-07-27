# HTML + JavaScript + Tailwind + Vue Reactivity (CDN)

## enlace

- https://vue-reactive-poc-app.vercel.app/

## otros enlaces

- https://rcg-vanillajs-lib.vercel.app/
- https://rcg-framework.vercel.app/
- https://rafael-castro.vercel.app/
- https://rafael-castro-angular2026.vercel.app/
- https://rcastrogo.github.io/ReactApp2026/
- https://rcastrogo.github.io/React2025/
- https://webapivanillajs2026-axhxdzg8h5fub7hj.canadacentral-01.azurewebsites.net/


## Requisitos
- Node.js 18+

## Instalacion
```bash
npm install
```

## Desarrollo
- Ejecutar Tailwind en watch y servidor local con live reload:
```bash
npm run dev
```

- Compilar CSS minificado para produccion:
```bash
npm run css:build
```

## Generador de codigo
El repositorio incluye un generador en `scripts/code.cjs` con dos formas de uso.

### 1. Ejecutarlo con npm y un JSON de ejemplo
Genera los ficheros de una entidad de ejemplo desde `scripts/examples/usuario.json`:
```bash
npm run codegen:example
```

Si quieres usar otro JSON, ejecuta el script base y pasa tu archivo y salida:
```bash
npm run codegen -- -i ./ruta/a/tu-entidad.json -o ./src/_code
```

### 2. Usarlo directamente desde codigo o IA
La funcion `generateAllFiles` esta exportada y acepta una entidad o un array de entidades. Devuelve los ficheros en memoria, sin necesidad de archivos temporales.

```js
const { generateAllFiles, writeGeneratedFiles } = require('./scripts/code.cjs');

const files = generateAllFiles({
	itemName: 'Usuario',
	collectionName: 'Usuarios',
	tableName: 'TBL_USUARIOS',
	namespace: '.Seguridad',
	properties: [
		{ name: 'Id', dbName: 'ID_USUARIO', dbType: 'long', isId: true, omitDal: false, readOnly: true },
		{ name: 'Nombre', dbName: 'NOMBRE', dbType: 'string', isId: false, omitDal: false, readOnly: false }
	]
});

writeGeneratedFiles(files, './src/_code');
```

## Notas
- `@vue/reactivity` se carga por CDN desde `public/js/main.js`.
- BrowserSync sirve la carpeta `public` en `http://localhost:3000`.
- Los cambios en HTML, CSS y JS recargan automaticamente el navegador.
