document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Mouse Tracking Effect on Glass Cards
    const cards = document.querySelectorAll('.app-card');
    
    cards.forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            // Calculate mouse coordinates relative to the card
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Set custom properties to update gradient glow position
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });

    // 2. Animated Sticky Header on Scroll
    const header = document.querySelector('.glass-header');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 80) {
            header.style.padding = '0.8rem 5%';
            header.style.background = 'rgba(5, 5, 5, 0.7)';
            header.style.boxShadow = '0 5px 25px rgba(0,0,0,0.5)';
        } else {
            header.style.padding = '1.2rem 5%';
            header.style.background = 'rgba(255, 255, 255, 0.03)';
            header.style.boxShadow = 'none';
        }
    });

    // 3. Smooth Anchor Scrolling & Active Link State
    const navLinks = document.querySelectorAll('nav a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Remove active class from all
            navLinks.forEach(l => l.classList.remove('active'));
            // Add to clicked
            this.classList.add('active');
            
            // If it's hash link, let it scroll but smooth
            const href = this.getAttribute('href');
            if (href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    window.scrollTo({
                        top: targetElement.offsetTop - 100,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
});
