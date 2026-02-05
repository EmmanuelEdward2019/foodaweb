// Supabase Configuration - Update with your actual credentials
const SUPABASE_URL = 'https://dukvrgupgtymxxbqpctq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1a3ZyZ3VwZ3R5bXh4YnFwY3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NjY1MTQsImV4cCI6MjA4MDQ0MjUxNH0._WUj92bMmPakzdA7dltor8ADGUhOlHExSKB4DRvugcg';

// Dashboard URLs
const ADMIN_DASHBOARD_URL = '/fooda-app/admin-dashboard/';
const VENDOR_DASHBOARD_URL = '/fooda-app/vendor-dashboard/';

// DOM Elements
const tabs = document.querySelectorAll('.tab-btn');
const vendorForm = document.getElementById('vendorLoginForm');
const adminForm = document.getElementById('adminLoginForm');
const vendorFormElement = document.getElementById('vendorLogin');
const adminFormElement = document.getElementById('adminLogin');
const registerForm = document.getElementById('vendorRegisterForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const loginForms = document.getElementById('loginForms');
const registerFormContainer = document.getElementById('registerForm');

// Tab switching
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const tabType = tab.dataset.tab;
        if (tabType === 'vendor') {
            vendorForm.classList.remove('hidden');
            adminForm.classList.add('hidden');
        } else {
            adminForm.classList.remove('hidden');
            vendorForm.classList.add('hidden');
        }
    });
});

// Toggle Register/Login forms
if (showRegisterLink) {
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForms.classList.add('hidden');
        registerFormContainer.classList.remove('hidden');
    });
}

if (showLoginLink) {
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerFormContainer.classList.add('hidden');
        loginForms.classList.remove('hidden');
    });
}

// Show loading state
function setLoading(form, isLoading) {
    const button = form.querySelector('button[type="submit"]');
    const inputs = form.querySelectorAll('input');

    if (isLoading) {
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span> Please wait...';
        inputs.forEach(input => input.disabled = true);
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalText || 'Sign In';
        inputs.forEach(input => input.disabled = false);
    }
}

// Show error message
function showError(form, message) {
    let errorDiv = form.querySelector('.error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        form.insertBefore(errorDiv, form.firstChild);
    }
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Show success message
function showSuccess(form, message) {
    let successDiv = form.querySelector('.success-message');
    if (!successDiv) {
        successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        form.insertBefore(successDiv, form.firstChild);
    }
    successDiv.textContent = message;
    successDiv.style.display = 'block';
}

// Supabase Auth Functions
async function signIn(email, password) {
    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error_description || data.msg || 'Login failed');
        }

        return { data, error: null };
    } catch (error) {
        return { data: null, error };
    }
}

async function signUp(email, password, userData) {
    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
                email,
                password,
                data: userData
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error_description || data.msg || 'Registration failed');
        }

        return { data, error: null };
    } catch (error) {
        return { data: null, error };
    }
}

async function getUserRole(userId, accessToken) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=role`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const data = await response.json();
        return data[0]?.role || null;
    } catch (error) {
        console.error('Error fetching user role:', error);
        return null;
    }
}

// Store session
function storeSession(session) {
    localStorage.setItem('fooda_session', JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user: session.user,
        expires_at: session.expires_at
    }));
}

// Check existing session
function checkSession() {
    const session = localStorage.getItem('fooda_session');
    if (session) {
        const parsed = JSON.parse(session);
        const now = Math.floor(Date.now() / 1000);

        if (parsed.expires_at && parsed.expires_at > now) {
            return parsed;
        } else {
            localStorage.removeItem('fooda_session');
        }
    }
    return null;
}

// Vendor Login
vendorFormElement?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('vendorEmail').value;
    const password = document.getElementById('vendorPassword').value;

    const button = vendorFormElement.querySelector('button[type="submit"]');
    button.dataset.originalText = button.textContent;
    setLoading(vendorFormElement, true);

    const { data, error } = await signIn(email, password);

    if (error) {
        setLoading(vendorFormElement, false);
        showError(vendorFormElement, error.message);
        return;
    }

    // Verify user is a vendor
    const role = await getUserRole(data.user.id, data.access_token);

    if (role !== 'vendor') {
        setLoading(vendorFormElement, false);
        showError(vendorFormElement, 'Access denied. This login is for vendors only.');
        return;
    }

    // Store session and redirect
    storeSession(data);
    showSuccess(vendorFormElement, 'Login successful! Redirecting...');

    setTimeout(() => {
        window.location.href = VENDOR_DASHBOARD_URL;
    }, 1000);
});

// Admin Login
adminFormElement?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;

    const button = adminFormElement.querySelector('button[type="submit"]');
    button.dataset.originalText = button.textContent;
    setLoading(adminFormElement, true);

    const { data, error } = await signIn(email, password);

    if (error) {
        setLoading(adminFormElement, false);
        showError(adminFormElement, error.message);
        return;
    }

    // Verify user is an admin
    const role = await getUserRole(data.user.id, data.access_token);

    if (role !== 'admin') {
        setLoading(adminFormElement, false);
        showError(adminFormElement, 'Access denied. This login is for administrators only.');
        return;
    }

    // Store session and redirect
    storeSession(data);
    showSuccess(adminFormElement, 'Login successful! Redirecting...');

    setTimeout(() => {
        window.location.href = ADMIN_DASHBOARD_URL;
    }, 1000);
});

// Vendor Registration
registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('registerName').value;
    const restaurantName = document.getElementById('registerRestaurant').value;
    const email = document.getElementById('registerEmail').value;
    const phone = document.getElementById('registerPhone').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    // Validate passwords
    if (password !== confirmPassword) {
        showError(registerForm, 'Passwords do not match');
        return;
    }

    if (password.length < 6) {
        showError(registerForm, 'Password must be at least 6 characters');
        return;
    }

    const button = registerForm.querySelector('button[type="submit"]');
    button.dataset.originalText = button.textContent;
    setLoading(registerForm, true);

    const { data, error } = await signUp(email, password, {
        full_name: name,
        role: 'vendor',
        restaurant_name: restaurantName,
        phone: phone
    });

    setLoading(registerForm, false);

    if (error) {
        showError(registerForm, error.message);
        return;
    }

    showSuccess(registerForm, 'Registration successful! Please check your email to verify your account.');

    // Clear form
    registerForm.reset();

    // Switch to login after 3 seconds
    setTimeout(() => {
        registerFormContainer.classList.add('hidden');
        loginForms.classList.remove('hidden');
    }, 3000);
});

// Forgot Password
document.querySelectorAll('.forgot-password').forEach(link => {
    link.addEventListener('click', async (e) => {
        e.preventDefault();

        const emailInput = e.target.closest('form').querySelector('input[type="email"]');
        const email = emailInput?.value;

        if (!email) {
            alert('Please enter your email address first');
            emailInput?.focus();
            return;
        }

        try {
            const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY
                },
                body: JSON.stringify({ email })
            });

            if (response.ok) {
                alert('Password reset email sent! Check your inbox.');
            } else {
                const data = await response.json();
                alert(data.error_description || 'Failed to send reset email');
            }
        } catch (error) {
            alert('An error occurred. Please try again.');
        }
    });
});

// Social Login Buttons
document.querySelectorAll('.google-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        try {
            // Redirect to Supabase Google OAuth
            const redirectTo = encodeURIComponent(window.location.origin + '/auth/callback');
            window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
        } catch (error) {
            alert('Google login is not configured. Please use email/password.');
        }
    });
});

document.querySelectorAll('.facebook-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        try {
            const redirectTo = encodeURIComponent(window.location.origin + '/auth/callback');
            window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=facebook&redirect_to=${redirectTo}`;
        } catch (error) {
            alert('Facebook login is not configured. Please use email/password.');
        }
    });
});

// Check for existing session on page load
document.addEventListener('DOMContentLoaded', () => {
    const session = checkSession();
    if (session && session.user) {
        // Redirect based on role
        getUserRole(session.user.id, session.access_token).then(role => {
            if (role === 'admin') {
                window.location.href = ADMIN_DASHBOARD_URL;
            } else if (role === 'vendor') {
                window.location.href = VENDOR_DASHBOARD_URL;
            }
        });
    }
});

// Add styles for error/success messages
const style = document.createElement('style');
style.textContent = `
    .error-message {
        background: #fee2e2;
        color: #dc2626;
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        font-size: 14px;
        border-left: 4px solid #dc2626;
    }
    .success-message {
        background: #dcfce7;
        color: #16a34a;
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        font-size: 14px;
        border-left: 4px solid #16a34a;
    }
    .spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid #ffffff;
        border-radius: 50%;
        border-top-color: transparent;
        animation: spin 0.8s linear infinite;
        margin-right: 8px;
        vertical-align: middle;
    }
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
`;
document.head.appendChild(style);