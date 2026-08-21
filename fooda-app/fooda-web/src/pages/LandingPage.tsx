import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ShoppingCart, Plus, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

interface FeaturedMeal {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    vendor_id: string;
    vendor_name: string;
}

const FeaturedMealsCarousel = () => {
    const navigate = useNavigate();
    const { addItem, items, vendorId } = useCart();
    const toast = useToast();
    const [meals, setMeals] = useState<FeaturedMeal[]>([]);
    const [loading, setLoading] = useState(true);
    const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
    const scrollerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        supabase
            .from('menu_items')
            .select('id, name, description, price, image_url, vendor_id, vendors!menu_items_vendor_id_fkey(id, name, is_active)')
            .eq('is_available', true)
            .limit(16)
            .then(({ data }) => {
                const list = (data ?? [])
                    .filter((m: any) => {
                        const v = Array.isArray(m.vendors) ? m.vendors[0] : m.vendors;
                        return v?.is_active;
                    })
                    .map((m: any) => {
                        const v = Array.isArray(m.vendors) ? m.vendors[0] : m.vendors;
                        return {
                            id: m.id,
                            name: m.name,
                            description: m.description,
                            price: Number(m.price),
                            image_url: m.image_url,
                            vendor_id: m.vendor_id,
                            vendor_name: v?.name ?? 'Restaurant',
                        };
                    });
                setMeals(list);
                setLoading(false);
            });
    }, []);

    const scrollBy = (dir: 1 | -1) => {
        const el = scrollerRef.current;
        if (!el) return;
        el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.7), behavior: 'smooth' });
    };

    const handleAdd = (meal: FeaturedMeal) => {
        // Cart only supports one vendor at a time; switching vendors replaces it.
        if (vendorId && vendorId !== meal.vendor_id && items.length > 0) {
            const ok = window.confirm(
                `Your cart has items from another restaurant. Replace it with ${meal.vendor_name}'s items?`,
            );
            if (!ok) return;
        }
        addItem(meal.vendor_id, meal.vendor_name, {
            menuItemId: meal.id,
            name: meal.name,
            price: meal.price,
            imageUrl: meal.image_url ?? undefined,
        }, 1);
        toast.success(`Added ${meal.name} to cart`);
        setRecentlyAdded(prev => new Set(prev).add(meal.id));
        setTimeout(() => {
            setRecentlyAdded(prev => {
                const next = new Set(prev);
                next.delete(meal.id);
                return next;
            });
        }, 1800);
    };

    const cartCount = items.reduce((s, i) => s + i.quantity, 0);

    if (loading) {
        return (
            <section style={{ padding: '60px 24px', background: '#fafafa' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <h2 style={{ fontSize: 28, fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Featured Meals</h2>
                    <p style={{ color: '#666', marginBottom: 24 }}>Loading delicious picks…</p>
                </div>
            </section>
        );
    }

    if (meals.length === 0) return null;

    return (
        <section style={{ padding: '60px 0 30px', background: '#fafafa', position: 'relative' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
                    <div>
                        <h2 style={{ fontSize: 30, fontWeight: 800, color: '#1a1a1a', margin: 0, letterSpacing: '-0.5px' }}>Featured Meals</h2>
                        <p style={{ color: '#666', margin: '6px 0 0', fontSize: 15 }}>Add to cart now — sign up when you're ready to check out.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={() => scrollBy(-1)}
                            aria-label="Scroll left"
                            style={carouselArrowStyle}
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={() => scrollBy(1)}
                            aria-label="Scroll right"
                            style={carouselArrowStyle}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            <div
                ref={scrollerRef}
                style={{
                    display: 'flex', gap: 18,
                    overflowX: 'auto', overflowY: 'hidden',
                    scrollSnapType: 'x mandatory',
                    padding: '4px 24px 24px',
                    scrollbarWidth: 'none',
                }}
                className="fooda-hide-scrollbar"
            >
                {meals.map(meal => {
                    const just = recentlyAdded.has(meal.id);
                    return (
                        <article
                            key={meal.id}
                            style={{
                                flex: '0 0 270px',
                                background: '#fff',
                                borderRadius: 18,
                                overflow: 'hidden',
                                boxShadow: '0 2px 14px rgba(0,0,0,0.07)',
                                scrollSnapAlign: 'start',
                                display: 'flex', flexDirection: 'column',
                            }}
                        >
                            <div
                                style={{
                                    height: 170,
                                    background: meal.image_url
                                        ? `url(${meal.image_url}) center/cover`
                                        : 'linear-gradient(135deg, #ff6b35, #f7931e)',
                                    position: 'relative',
                                    cursor: 'pointer',
                                }}
                                onClick={() => navigate(`/restaurants/${meal.vendor_id}`)}
                            >
                                <span style={{
                                    position: 'absolute', bottom: 10, left: 10,
                                    background: 'rgba(0,0,0,0.55)', color: '#fff',
                                    padding: '4px 10px', borderRadius: 14,
                                    fontSize: 11, fontWeight: 600,
                                }}>
                                    {meal.vendor_name}
                                </span>
                            </div>
                            <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {meal.name}
                                </h3>
                                {meal.description && (
                                    <p style={{ margin: '0 0 12px', fontSize: 13, color: '#777', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>
                                        {meal.description}
                                    </p>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', gap: 10 }}>
                                    <span style={{ fontSize: 18, fontWeight: 800, color: '#ff6b35' }}>
                                        ₦{meal.price.toLocaleString()}
                                    </span>
                                    <button
                                        onClick={() => handleAdd(meal)}
                                        disabled={just}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            background: just ? '#16a34a' : '#ff6b35', color: '#fff',
                                            border: 'none', borderRadius: 10,
                                            padding: '8px 14px', cursor: just ? 'default' : 'pointer',
                                            fontSize: 13, fontWeight: 700,
                                            transition: 'background 0.15s',
                                        }}
                                    >
                                        {just ? <><Check size={14} /> Added</> : <><Plus size={14} /> Add</>}
                                    </button>
                                </div>
                            </div>
                        </article>
                    );
                })}
                {/* Trailing CTA card */}
                <article
                    style={{
                        flex: '0 0 220px',
                        background: 'linear-gradient(135deg, #ff6b35, #f7931e)',
                        color: '#fff',
                        borderRadius: 18,
                        padding: 22,
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                        scrollSnapAlign: 'start',
                    }}
                >
                    <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, lineHeight: 1.25 }}>
                        Hungry for more?
                    </h3>
                    <p style={{ margin: '8px 0 16px', fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>
                        Browse every restaurant on Fooda and discover your new favourite.
                    </p>
                    <Link
                        to="/restaurants"
                        style={{
                            display: 'inline-block', textAlign: 'center',
                            background: '#fff', color: '#ff6b35',
                            borderRadius: 10, padding: '10px 14px',
                            textDecoration: 'none', fontWeight: 700, fontSize: 14,
                        }}
                    >
                        Explore →
                    </Link>
                </article>
            </div>

            {cartCount > 0 && vendorId && (
                <div style={{
                    position: 'fixed', bottom: 20, right: 20, zIndex: 60,
                    background: '#1a1a1a', color: '#fff',
                    borderRadius: 14, padding: '12px 18px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                }}>
                    <ShoppingCart size={18} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{cartCount} item{cartCount !== 1 ? 's' : ''} in cart</span>
                    <button
                        onClick={() => navigate(`/restaurants/${vendorId}/checkout`)}
                        style={{
                            background: '#ff6b35', color: '#fff',
                            border: 'none', borderRadius: 8,
                            padding: '7px 14px', cursor: 'pointer',
                            fontSize: 13, fontWeight: 700,
                        }}
                    >
                        Checkout →
                    </button>
                </div>
            )}

            <style>{`
                .fooda-hide-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
        </section>
    );
};

const carouselArrowStyle: React.CSSProperties = {
    width: 40, height: 40,
    borderRadius: '50%',
    background: '#fff',
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#555',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};

const LandingPage = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
                        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                            <h2><i className="fas fa-utensils"></i> Fooda</h2>
                        </Link>
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
                            <li><Link to="/restaurants" onClick={() => setMobileMenuOpen(false)}>Restaurants</Link></li>
                            <li><a href="#testimonials" onClick={(e) => { e.preventDefault(); handleNavClick('testimonials'); }}>Testimonials</a></li>
                            <li><a href="#contact" onClick={(e) => { e.preventDefault(); handleNavClick('contact'); }}>Contact</a></li>
                        </ul>
                        {/* Shown only inside the mobile slide-out panel */}
                        <div className="nav-auth-buttons">
                            <Link to="/restaurants" className="btn btn-outline" onClick={() => setMobileMenuOpen(false)}>Order Now</Link>
                            <Link to="/auth" className="btn btn-primary" onClick={() => setMobileMenuOpen(false)}>Login</Link>
                        </div>
                    </nav>
                    {/* Shown only on desktop */}
                    <div className="auth-buttons">
                        <Link to="/restaurants" className="btn btn-outline" style={{ marginRight: 8 }}>Order Now</Link>
                        <Link to="/auth" className="btn btn-primary">Login</Link>
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
                            <Link to="/restaurants" className="btn btn-primary">Order Now</Link>
                            <a href="#download" onClick={(e) => { e.preventDefault(); handleNavClick('download'); }} className="btn btn-outline">Download App</a>
                            <Link to="/auth?role=vendor" className="btn btn-outline">Join as Vendor</Link>
                        </div>
                    </div>
                    <div className="hero-image">
                        <img src="https://images.unsplash.com/photo-1513104890138-7c749659a591?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80" alt="Delicious Pizza" />
                    </div>
                </div>
            </section>

            <FeaturedMealsCarousel />

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
                                    <p>+2348062609302</p>
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
                                <li><Link to="/restaurants">Browse Restaurants</Link></li>
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
