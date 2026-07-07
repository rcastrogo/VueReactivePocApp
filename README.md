# HTML + JavaScript + Tailwind + Vue Reactivity (CDN)

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
