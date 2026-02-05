import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'

const LandingPage = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const navigate = useNavigate();

    const toggleMenu = () => {
        setMobileMenuOpen(!mobileMenuOpen);
        document.body.classList.toggle('menu-open', !mobileMenuOpen);
    };

    const handleNavClick = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
        setMobileMenuOpen(false);
        document.body.classList.remove('menu-open');
    };

    return (
        <>
            {/* Header Section */}
            <header className={`landing-header ${mobileMenuOpen ? 'active' : ''}`}>
                <div className="container">
                    <div className="logo">
                        <h2><i className="fas fa-utensils"></i> Fooda</h2>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button
                        className={`mobile-menu-toggle ${mobileMenuOpen ? 'active' : ''}`}
                        id="mobileMenuToggle"
                        aria-label="Toggle menu"
                        onClick={toggleMenu}
                    >
                        <span className="hamburger-line"></span>
                        <span className="hamburger-line"></span>
                        <span className="hamburger-line"></span>
                    </button>

                    <nav id="mainNav" className={`landing-nav ${mobileMenuOpen ? 'active' : ''}`}>
                        <ul>
                            <li><a href="#home" onClick={(e) => { e.preventDefault(); handleNavClick('home'); }}>Home</a></li>
                            <li><a href="#features" onClick={(e) => { e.preventDefault(); handleNavClick('features'); }}>Features</a></li>
                            <li><a href="#how-it-works" onClick={(e) => { e.preventDefault(); handleNavClick('how-it-works'); }}>How It Works</a></li>
                            <li><a href="#testimonials" onClick={(e) => { e.preventDefault(); handleNavClick('testimonials'); }}>Testimonials</a></li>
                            <li><a href="#contact" onClick={(e) => { e.preventDefault(); handleNavClick('contact'); }}>Contact</a></li>
                        </ul>
                    </nav>
                    <div className="auth-buttons">
                        <Link to="/auth" className="btn btn-outline">Login</Link>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section id="home" className="hero">
                <div className="container">
                    <div className="hero-content">
                        <h1>Delicious Food Delivered to Your Doorstep</h1>
                        <p>Discover the best restaurants in your area and enjoy convenient food delivery with our multivendor platform.</p>
                        <div className="cta-buttons">
                            <a href="#download" onClick={(e) => { e.preventDefault(); handleNavClick('download'); }} className="btn btn-primary">Download App</a>
                            <Link to="/auth?role=vendor" className="btn btn-outline">Join as Vendor</Link>
                        </div>
                    </div>
                    <div className="hero-image">
                        <img src="https://images.unsplash.com/photo-1513104890138-7c749659a591?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80" alt="Delicious Pizza" />
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="features">
                <div className="container">
                    <div className="section-header">
                        <h2>Why Choose Fooda?</h2>
                        <p>Experience the best food delivery service with our innovative platform</p>
                    </div>
                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="icon">
                                <i className="fas fa-utensils"></i>
                            </div>
                            <h3>Wide Variety</h3>
                            <p>Choose from hundreds of restaurants and thousands of dishes</p>
                        </div>
                        <div className="feature-card">
                            <div className="icon">
                                <i className="fas fa-motorcycle"></i>
                            </div>
                            <h3>Fast Delivery</h3>
                            <p>Quick and reliable delivery with real-time tracking</p>
                        </div>
                        <div className="feature-card">
                            <div className="icon">
                                <i className="fas fa-tag"></i>
                            </div>
                            <h3>Great Deals</h3>
                            <p>Exclusive discounts and offers from top restaurants</p>
                        </div>
                        <div className="feature-card">
                            <div className="icon">
                                <i className="fas fa-shield-alt"></i>
                            </div>
                            <h3>Secure Payments</h3>
                            <p>Safe and secure payment options including Paystack</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="how-it-works">
                <div className="container">
                    <div className="section-header">
                        <h2>How Fooda Works</h2>
                        <p>Getting your favorite food has never been easier</p>
                    </div>
                    <div className="steps">
                        <div className="step">
                            <div className="step-number">1</div>
                            <h3>Browse Restaurants</h3>
                            <p>Explore a wide variety of restaurants and cuisines in your area</p>
                        </div>
                        <div className="step">
                            <div className="step-number">2</div>
                            <h3>Select Your Meal</h3>
                            <p>Choose your favorite dishes and customize your order</p>
                        </div>
                        <div className="step">
                            <div className="step-number">3</div>
                            <h3>Track Delivery</h3>
                            <p>Follow your order in real-time from preparation to delivery</p>
                        </div>
                        <div className="step">
                            <div className="step-number">4</div>
                            <h3>Enjoy Your Meal</h3>
                            <p>Receive your delicious meal and enjoy!</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Download Section */}
            <section id="download" className="download">
                <div className="container">
                    <div className="download-content">
                        <h2>Download Our App</h2>
                        <p>Get the Fooda app for the best food ordering experience on your mobile device</p>
                        <div className="app-badges">
                            <a href="#" className="app-badge">
                                <i className="fab fa-google-play"></i>
                                <div>
                                    <span>GET IT ON</span>
                                    <h4>Google Play</h4>
                                </div>
                            </a>
                            <a href="#" className="app-badge">
                                <i className="fab fa-apple"></i>
                                <div>
                                    <span>Download on the</span>
                                    <h4>App Store</h4>
                                </div>
                            </a>
                        </div>
                    </div>
                    <div className="download-image">
                        {/* 3D Rotating Phone Mockup */}
                        <div className="phone-mockup-3d">
                            <div className="phone-frame">
                                <div className="phone-screen">
                                    <div className="app-preview">
                                        {/* Status Bar */}
                                        <div className="status-bar">
                                            <span>9:41</span>
                                            <div className="status-icons">
                                                <i className="fas fa-signal"></i>
                                                <i className="fas fa-wifi"></i>
                                                <i className="fas fa-battery-full"></i>
                                            </div>
                                        </div>

                                        {/* App Header */}
                                        <div className="app-header">
                                            <h3><i className="fas fa-utensils"></i> Fooda</h3>
                                            <i className="fas fa-shopping-cart"></i>
                                        </div>

                                        {/* Search Bar */}
                                        <div className="search-bar">
                                            <i className="fas fa-search"></i>
                                            <span>Search for food...</span>
                                        </div>

                                        {/* Food Categories */}
                                        <div className="food-categories">
                                            <div className="category-chip active">
                                                <i className="fas fa-pizza-slice"></i> Pizza
                                            </div>
                                            <div className="category-chip">
                                                <i className="fas fa-hamburger"></i> Burgers
                                            </div>
                                            <div className="category-chip">
                                                <i className="fas fa-ice-cream"></i> Desserts
                                            </div>
                                        </div>

                                        {/* Featured Food Card */}
                                        <div className="food-card">
                                            <div className="food-image">
                                                <div className="food-img-placeholder">
                                                    <i className="fas fa-pizza-slice"></i>
                                                </div>
                                                <div className="food-badge">⭐ 4.8</div>
                                            </div>
                                            <div className="food-info">
                                                <h4>Margherita Pizza</h4>
                                                <p>Fresh mozzarella, tomatoes</p>
                                                <div className="food-footer">
                                                    <span className="price">₦2,500</span>
                                                    <button className="add-btn">+</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="phone-notch"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Vendors Section */}
            <section id="vendors" className="vendors">
                <div className="container">
                    <div className="vendors-content">
                        <h2>Join Our Network of Vendors</h2>
                        <p>Reach more customers and grow your business with Fooda</p>
                        <ul>
                            <li><i className="fas fa-check"></i> Access to thousands of potential customers</li>
                            <li><i className="fas fa-check"></i> Easy order management system</li>
                            <li><i className="fas fa-check"></i> Real-time analytics and reporting</li>
                            <li><i className="fas fa-check"></i> Secure and timely payments</li>
                        </ul>
                        <Link to="/auth?role=vendor" className="btn btn-primary">Register as Vendor</Link>
                    </div>
                    <div className="vendors-image">
                        <img src="https://images.unsplash.com/photo-1556911220-e15b29be8c8f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80" alt="Restaurant Kitchen" />
                    </div>
                </div>
            </section>

            {/* Testimonials Section */}
            <section id="testimonials" className="testimonials">
                <div className="container">
                    <div className="section-header">
                        <h2>What Our Users Say</h2>
                        <p>Hear from our satisfied customers, vendors, and delivery partners</p>
                    </div>
                    <div className="testimonial-grid">
                        <div className="testimonial-card">
                            <div className="rating">
                                <i className="fas fa-star"></i>
                                <i className="fas fa-star"></i>
                                <i className="fas fa-star"></i>
                                <i className="fas fa-star"></i>
                                <i className="fas fa-star"></i>
                            </div>
                            <p>"Fooda has transformed my dining experience. The app is so easy to use and the delivery is always on time!"</p>
                            <div className="user">
                                <div className="user-avatar">
                                    <i className="fas fa-user"></i>
                                </div>
                                <div className="user-info">
                                    <h4>Sarah Johnson</h4>
                                    <p>Regular Customer</p>
                                </div>
                            </div>
                        </div>
                        {/* More testimonials can be added here */}
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section id="contact" className="contact">
                <div className="container">
                    <div className="section-header">
                        <h2>Contact Us</h2>
                        <p>Have questions? We're here to help!</p>
                    </div>
                    <div className="contact-content">
                        <div className="contact-info">
                            <div className="contact-item">
                                <i className="fas fa-map-marker-alt"></i>
                                <div>
                                    <h4>Our Location</h4>
                                    <p>123 Food Street, Culinary City, FC 10001</p>
                                </div>
                            </div>
                            <div className="contact-item">
                                <i className="fas fa-phone"></i>
                                <div>
                                    <h4>Phone Number</h4>
                                    <p>+1 (555) 123-4567</p>
                                </div>
                            </div>
                            <div className="contact-item">
                                <i className="fas fa-envelope"></i>
                                <div>
                                    <h4>Email Address</h4>
                                    <p>support@fooda.com</p>
                                </div>
                            </div>
                        </div>
                        <div className="contact-form">
                            <form id="contactForm">
                                {/* Contact form logic to be added or kept simple as UI for now */}
                                <div className="form-group">
                                    <input type="text" id="contactName" placeholder="Your Name" required />
                                </div>
                                <div className="form-group">
                                    <input type="email" id="contactEmail" placeholder="Your Email" required />
                                </div>
                                <div className="form-group">
                                    <textarea id="contactMessage" placeholder="Your Message" rows={5} required></textarea>
                                </div>
                                <button type="submit" className="btn btn-primary" id="contactSubmit">Send Message</button>
                            </form>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="container">
                    <div className="footer-content">
                        <div className="footer-logo">
                            <h2><i className="fas fa-utensils"></i> Fooda</h2>
                            <p>Bringing delicious food to your doorstep</p>
                        </div>
                        <div className="footer-links">
                            <h4>Quick Links</h4>
                            <ul>
                                <li><a href="#home">Home</a></li>
                                <li><a href="#features">Features</a></li>
                                <li><a href="#how-it-works">How It Works</a></li>
                                <li><a href="#vendors">Join as Vendor</a></li>
                            </ul>
                        </div>
                        {/* ... */}
                    </div>
                    <div className="footer-bottom">
                        <p>&copy; 2025 Fooda. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </>
    );
};

export default LandingPage;
