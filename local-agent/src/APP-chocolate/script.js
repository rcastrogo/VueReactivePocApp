document.addEventListener('DOMContentLoaded', () => {
    // Manejo de botones de compra / añadir al carrito
    const buyButtons = document.querySelectorAll('.btn-primary');
    buyButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            const title = card ? card.querySelector('.card-title').innerText : 'Chocolate';
            alert(`¡Has añadido "${title}" al carrito! Gracias por elegir La onza feliz.`);
        });
    });

    // Interactividad para acordeón de FAQs (si existe en faqs.html)
    const faqItems = document.querySelectorAll('.accordion-item');
    faqItems.forEach(item => {
        const header = item.querySelector('.accordion-header');
        if (header) {
            header.addEventListener('click', () => {
                item.classList.toggle('active');
            });
        }
    });
});
