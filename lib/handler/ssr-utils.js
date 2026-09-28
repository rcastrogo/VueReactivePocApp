// @ts-nocheck

export const renderEntityHtml = (entity) => `
  <div class="row row-cards g-3">
    ${Object.entries(entity)
      .map(([key, value]) => `
        <div class="col-sm-6 col-md-4 col-xl-3">
          <div class="datagrid-item p-2">
            <div class="datagrid-title">${key}</div> 
            <div class="datagrid-content">${value}</div>
          </div>
        </div>
      `).join('')
    }
  </div>
`;

export const renderEntityList = (entities = []) => {
  if (!entities?.length) { 
    return `
      <div class="empty">
        <div class="empty-icon">
          <i class="ti ti-database-off"></i>
        </div>
        <p class="empty-title">No hay datos</p>
        <p class="empty-subtitle text-secondary">
          No se encontraron registros.
        </p>
      </div>
    `; 
  }

  const columns = Object.keys(entities[0]); 

  return `
    <div class="table-responsive">
      <table class="table table-vcenter">
        <thead>
          <tr>
            ${columns.map(column => `<th>${column}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${entities.map(entity => `
            <tr>
              ${columns.map(column => `
                <td>${entity[column] ?? ''}</td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
};

export const renderHtml = (data) => `
  <!DOCTYPE html> 
  <html lang="es" data-bs-theme="light"> 
    <head> 
      <meta charset="UTF-8"> 
      <meta name="viewport" content="width=device-width, initial-scale=1"> 
      <title>${data.title || 'Mi aplicación - SSR Page'}</title> 
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/core@latest/dist/css/tabler.min.css" > 
    </head> 
    <body> 
    <div class="page"> 
      <header class="navbar navbar-expand-md"> 
        <div class="container-xl">
          <div class="navbar-brand"> 
            <span class="navbar-brand-text">${data.title || 'Mi aplicación'}</span> 
          </div>
          <button id="theme-toggle" class="btn btn-icon" type="button" title="Cambiar tema" aria-label="Cambiar tema" >
            <svg id="theme-icon-sun" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" 
              class="icon icon-tabler icons-tabler-outline icon-tabler-sun">
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
              <path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" />
            </svg>
            <svg id="theme-icon-moon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              class="icon icon-tabler icons-tabler-outline icon-tabler-moon">
              <path d="M12 3c.132 0 .263 0 .393 .007a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" />
            </svg>
          </button>
        </div> 
      </header> 
      <main class="page-wrapper">
        <div class="container-xl py-4">
          <div class="row row-cards">
            <div class="col-12">
              <div class="card">
                <div class="card-header">
                  <h3 class="card-title">${data.subtitle || 'Información'}</h3> 
                </div> 
                ${data.html}  
              </div> 
            </div>
          </div> 
        </div> 
      </main> 
    </div>

    <script>
      const html = document.documentElement; 
      const button = document.getElementById('theme-toggle'); 
      const icon_sun = document.getElementById('theme-icon-sun'); 
      const icon_moon = document.getElementById('theme-icon-moon'); 
      const savedTheme = localStorage.getItem('theme') || html.getAttribute('data-bs-theme') || 'light'; 
      html.setAttribute('data-bs-theme', savedTheme); 

      const updateIcons = (theme) => {
        if (theme === 'dark') {
          icon_sun.style.display = 'block';
          icon_moon.style.display = 'none';
        } else {
          icon_sun.style.display = 'none';
          icon_moon.style.display = 'block';
        }
      };
      updateIcons(savedTheme);

      button.addEventListener('click', () => { 
        const currentTheme = html.getAttribute('data-bs-theme'); 
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark'; 
        html.setAttribute( 'data-bs-theme', newTheme ); 
        localStorage.setItem( 'theme', newTheme );
        updateIcons(newTheme);
      }); 
    </script>

    </body>
  </html>
`; 