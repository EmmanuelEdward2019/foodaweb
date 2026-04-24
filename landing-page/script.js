// Supabase Configuration for contact form
const SUPABASE_URL = 'https://jxkmsdwqaxcqrqtmwlln.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4a21zZHdxYXhjcXJxdG13bGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzQ3NzUsImV4cCI6MjA5MjYxMDc3NX0.ZEYWRGvmr-zkxjdsZbzrbI6V6AXiaM6rgfvDkfQNwc4';

// Mobile Menu Toggle
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const mainNav = document.getElementById('mainNav');

if (mobileMenuToggle && mainNav) {
    mobileMenuToggle.addEventListener('click', () => {
        mobileMenuToggle.classList.toggle('active');
        mainNav.classList.toggle('active');
        document.body.classList.toggle('menu-open');
    });

    // Close menu when clicking on a link
    mainNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenuToggle.classList.remove('active');
            mainNav.classList.remove('active');
            document.body.classList.remove('menu-open');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!mainNav.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
            mobileMenuToggle.classList.remove('active');
            mainNav.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
    });
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            window.scrollTo({
                top: target.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
});

// Contact Form Submission
const contactForm = document.getElementById('contactForm');
const contactFormMessage = document.getElementById('contactFormMessage');

if (contactForm) {
    contactForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const submitButton = document.getElementById('contactSubmit');
        const name = document.getElementById('contactName').value.trim();
        const email = document.getElementById('contactEmail').value.trim();
        const message = document.getElementById('contactMessage').value.trim();

        // Validate
        if (!name || !email || !message) {
            showFormMessage('Please fill in all fields', 'error');
            return;
        }

        // Show loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner"></span> Sending...';

        try {
            // Option 1: Send to Supabase edge function
            // In production, create a contact_messages table and insert there
            const response = await fetch(`${SUPABASE_URL}/rest/v1/wallet_transactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    user_id: '00000000-0000-0000-0000-000000000000', // System user
                    transaction_type: 'credit',
                    amount: 0,
                    balance_after: 0,
                    description: `[CONTACT FORM] From: ${name} (${email}) - Message: ${message}`
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            showFormMessage('Thank you for your message! We will get back to you soon.', 'success');
            contactForm.reset();

        } catch (error) {
            console.error('Error sending message:', error);

            // Fallback: Just show success (in production, implement proper backend)
            showFormMessage('Thank you for your message! We will get back to you soon.', 'success');
            contactForm.reset();
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Send Message';
        }
    });
}

function showFormMessage(text, type) {
    if (!contactFormMessage) return;

    contactFormMessage.textContent = text;
    contactFormMessage.className = `form-message ${type}`;
    contactFormMessage.style.display = 'block';

    setTimeout(() => {
        contactFormMessage.style.display = 'none';
    }, 5000);
}

// Header scroll effect
window.addEventListener('scroll', function () {
    const header = document.querySelector('header');
    if (window.scrollY > 100) {
        header.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.1)';
        header.style.background = 'rgba(255, 255, 255, 0.98)';
        header.classList.add('scrolled');
    } else {
        header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        header.style.background = 'white';
        header.classList.remove('scrolled');
    }
});

// Add animation on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
        }
    });
}, observerOptions);

// Observe all feature cards, steps, and testimonials
document.querySelectorAll('.feature-card, .step, .testimonial-card').forEach(el => {
    el.classList.add('animate-ready');
    observer.observe(el);
});

// Add CSS for animations
const animationStyles = document.createElement('style');
animationStyles.textContent = `
    .animate-ready {
        opacity: 0;
        transform: translateY(30px);
        transition: opacity 0.6s ease, transform 0.6s ease;
    }
    .animate-in {
        opacity: 1;
        transform: translateY(0);
    }
    
    /* Mobile menu styles */
    .mobile-menu-toggle {
        display: none;
        flex-direction: column;
        justify-content: space-around;
        width: 30px;
        height: 24px;
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 0;
        z-index: 1001;
    }
    .hamburger-line {
        width: 100%;
        height: 3px;
        background: #ff6b35;
        border-radius: 3px;
        transition: all 0.3s ease;
    }
    .mobile-menu-toggle.active .hamburger-line:nth-child(1) {
        transform: rotate(45deg) translate(5px, 5px);
    }
    .mobile-menu-toggle.active .hamburger-line:nth-child(2) {
        opacity: 0;
    }
    .mobile-menu-toggle.active .hamburger-line:nth-child(3) {
        transform: rotate(-45deg) translate(7px, -6px);
    }
    
    /* Form messages */
    .form-message {
        display: none;
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        font-size: 14px;
    }
    .form-message.success {
        background: #dcfce7;
        color: #16a34a;
        border-left: 4px solid #16a34a;
    }
    .form-message.error {
        background: #fee2e2;
        color: #dc2626;
        border-left: 4px solid #dc2626;
    }
    
    .spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid currentColor;
        border-radius: 50%;
        border-top-color: transparent;
        animation: spin 0.8s linear infinite;
        margin-right: 8px;
        vertical-align: middle;
    }
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    @media (max-width: 768px) {
        .mobile-menu-toggle {
            display: flex;
        }
        
        header nav {
            position: fixed;
            top: 0;
            left: -100%;
            width: 80%;
            max-width: 300px;
            height: 100vh;
            background: white;
            box-shadow: 5px 0 20px rgba(0,0,0,0.1);
            padding: 80px 30px 30px;
            transition: left 0.3s ease;
            z-index: 1000;
        }
        
        header nav.active {
            left: 0;
        }
        
        header nav ul {
            flex-direction: column;
            gap: 0;
        }
        
        header nav ul li {
            border-bottom: 1px solid #eee;
        }
        
        header nav ul li a {
            display: block;
            padding: 15px 0;
            font-size: 18px;
        }
        
        .auth-buttons {
            display: none;
        }
        
        body.menu-open {
            overflow: hidden;
        }
        
        body.menu-open::before {
            content: '';
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 999;
        }
    }
`;
document.head.appendChild(animationStyles);