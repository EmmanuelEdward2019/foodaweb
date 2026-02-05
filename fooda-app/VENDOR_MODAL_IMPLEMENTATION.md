Due to file size limitations, I'll create a comprehensive implementation plan document instead. The admin dashboard needs a vendor creation modal added before the export statement.

## Vendor Creation Modal Component

Add this before `export default AdminDashboard;`:

```typescript
const VendorModal = ({ onClose, onSave }: any) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        description: '',
        password: ''
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            // Create auth user for vendor
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: formData.email,
                password: formData.password,
                email_confirm: true,
                user_metadata: {
                    role: 'vendor',
                    business_name: formData.name,
                    full_name: formData.name
                }
            });

            if (authError) throw authError;

            if (authData.user) {
                // Create user record
                await supabase.from('users').insert({
                    id: authData.user.id,
                    email: formData.email,
                    role: 'vendor',
                    full_name: formData.name,
                    phone: formData.phone,
                    is_active: true
                });

                // Create vendor profile
                await supabase.from('vendors').insert({
                    owner_id: authData.user.id,
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    description: formData.description,
                    is_active: true
                });
            }

            onSave();
        } catch (error) {
            console.error('Error creating vendor:', error);
            alert('Failed to create vendor');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '90vh',
                overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ color: '#333' }}>Add New Vendor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: '24px' }}>×</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontWeight: '500' }}>
                            Business Name *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontWeight: '500' }}>
                            Email *
                        </label>
                        <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontWeight: '500' }}>
                            Password *
                        </label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontWeight: '500' }}>
                            Phone
                        </label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontWeight: '500' }}>
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', resize: 'vertical' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{ flex: 1, padding: '12px', backgroundColor: '#f3f4f6', color: '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            style={{ flex: 1, padding: '12px', backgroundColor: '#ff6b35', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '500', opacity: saving ? 0.7 : 1 }}
                        >
                            {saving ? 'Creating...' : 'Create Vendor'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
```

## Add Modal to Render

In the return statement, before the closing `</div>`, add:

```typescript
{showVendorModal && (
    <VendorModal
        onClose={() => setShowVendorModal(false)}
        onSave={() => {
            setShowVendorModal(false);
            fetchData();
        }}
    />
)}
```

## API Readiness for Mobile App

The current implementation already supports the following API endpoints via Supabase:

1. **Authentication**: `supabase.auth` methods
2. **Vendors**: `supabase.from('vendors')` CRUD
3. **Menu Items**: `supabase.from('menu_items')` CRUD
4. **Menu Categories**: `supabase.from('menu_categories')` CRUD
5. **Orders**: `supabase.from('orders')` CRUD
6. **Order Items**: `supabase.from('order_items')` CRUD
7. **User Profiles**: `supabase.from('users')` CRUD
8. **User Addresses**: `supabase.from('user_addresses')` CRUD

All these are accessible via Supabase's REST API and can be consumed by the mobile app using the Supabase client library for Flutter/React Native.
