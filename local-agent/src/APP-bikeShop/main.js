document.addEventListener('DOMContentLoaded', () => {
  console.log('BikeShop loaded successfully');

  // Interactive FAQ toggle if accordion is used
  const accordionItems = document.querySelectorAll('.accordion-item');
  accordionItems.forEach(item => {
    const header = item.querySelector('.accordion-header');
    if (header) {
      header.addEventListener('click', () => {
        item.classList.toggle('active');
      });
    }
  });

  // Contact form or newsletter simulation
  const newsletterForm = document.querySelector('form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      alert('¡Gracias por suscribirte a APP-bikeShop! Pronto recibirás nuestras novedades.');
      newsletterForm.reset();
    });
  }
});
