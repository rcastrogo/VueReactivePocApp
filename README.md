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

## Notas
- `@vue/reactivity` se carga por CDN desde `public/js/main.js`.
- BrowserSync sirve la carpeta `public` en `http://localhost:3000`.
- Los cambios en HTML, CSS y JS recargan automaticamente el navegador.
