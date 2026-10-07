document.addEventListener('DOMContentLoaded', () => {
  // Datos del menú del bar
  const menuItems = [
    { id: 1, name: 'Hamburguesa Clásica Artesanal', category: 'comida', price: '12.50 €', desc: 'Carne 100% vacuno, queso cheddar fundido, lechuga, tomate y salsa especial de la casa.', img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80' },
    { id: 2, name: 'Alitas de Pollo Picantes', category: 'comida', price: '9.00 €', desc: 'Crujientes alitas bañadas en salsa buffalo secreta, acompañadas de bastones de apio y salsa ranchera.', img: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=600&q=80' },
    { id: 3, name: 'Nachos Supreme', category: 'comida', price: '10.50 €', desc: 'Totopos de maíz crujientes con queso fundido, jalapeños, guacamole, pico de gallo y frijoles negros.', img: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=600&q=80' },
    { id: 4, name: 'Mojito Tradicional', category: 'bebidas', price: '7.50 €', desc: 'Ron blanco, menta fresca, lima exprimida, azúcar de caña y soda con hielo picado.', img: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=600&q=80' },
    { id: 5, name: 'Cerveza Artesanal IPA', category: 'bebidas', price: '5.00 €', desc: 'Cerveza rubia de doble lúpulo con notas cítricas y refrescantes. 33cl.', img: 'https://images.unsplash.com/photo-1608270105741-f7e999cf3182?auto=format&fit=crop&w=600&q=80' },
    { id: 6, name: 'Tarta de Queso Casera', category: 'postres', price: '6.00 €', desc: 'Cremosa tarta de queso horneada al estilo vasco con mermelada de frutos rojos casera.', img: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80' }
  ];

  const menuContainer = document.getElementById('menu-items-container');
  const filterButtons = document.querySelectorAll('.menu-filter');

  // Renderizar menú
  function renderMenu(category = 'todos') {
    if (!menuContainer) return;
    menuContainer.innerHTML = '';
    
    const filtered = category === 'todos' 
      ? menuItems 
      : menuItems.filter(item => item.category === category);

    filtered.forEach(item => {
      const col = document.createElement('div');
      col.className = 'col-sm-6 col-lg-4';
      col.innerHTML = `
        <div class="card h-100 shadow-sm border-0">
          <div class="img-responsive img-responsive-21by9 card-img-top" style="background-image: url('${item.img}')"></div>
          <div class="card-body d-flex flex-column">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <h3 class="card-title mb-0 text-white">${item.name}</h3>
              <span class="badge bg-primary-lt fs-5">${item.price}</span>
            </div>
            <p class="text-secondary mb-3 flex-grow-1">${item.desc}</p>
            <button class="btn btn-outline-primary w-100 add-to-order" data-name="${item.name}" data-price="${item.price}">
              Añadir a mi comanda
            </button>
          </div>
        </div>
      `;
      menuContainer.appendChild(col);
    });

    // Eventos para los botones del menú
    document.querySelectorAll('.add-to-order').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.target.getAttribute('data-name');
        const price = e.target.getAttribute('data-price');
        showAlert(`¡"${name}" (${price}) añadido a tu comanda provisional!`, 'success');
      });
    });
  }

  // Filtrado del menú
  filterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const category = e.target.getAttribute('data-filter');
      renderMenu(category);
    });
  });

  // Inicializar menú
  renderMenu('todos');

  // Gestión del formulario de Reservas
  const reservationForm = document.getElementById('reservation-form');
  if (reservationForm) {
    reservationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('res-name').value;
      const date = document.getElementById('res-date').value;
      const time = document.getElementById('res-time').value;
      const guests = document.getElementById('res-guests').value;

      showAlert(`¡Reserva confirmada para ${name}! Te esperamos el ${date} a las ${time} para ${guests} personas.`, 'success');
      reservationForm.reset();
    });
  }

  // Gestión del formulario de Contacto
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('contact-name').value;
      showAlert(`¡Gracias ${name}! Hemos recibido tu mensaje y te responderemos muy pronto.`, 'info');
      contactForm.reset();
    });
  }

  // Función auxiliar para mostrar alertas dinámicas tipo Toast/Alert en pantalla
  function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) {
      alert(message);
      return;
    }

    const alertEl = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-success text-white' : 'bg-info text-white';
    alertEl.className = `alert ${bgClass} alert-dismissible fade show shadow-lg mb-3`;
    alertEl.setAttribute('role', 'alert');
    alertEl.innerHTML = `
      <div class="d-flex align-items-center">
        <div class="text-truncate">${message}</div>
      </div>
      <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    alertContainer.appendChild(alertEl);

    setTimeout(() => {
      if (alertEl.parentNode) {
        alertEl.classList.remove('show');
        setTimeout(() => alertEl.remove(), 300);
      }
    }, 5000);
  }
});
