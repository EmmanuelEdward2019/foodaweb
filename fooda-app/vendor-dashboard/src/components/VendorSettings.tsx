import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Vendor } from '../types/database';

const VendorSettings: React.FC = () => {
    const { vendor, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        email: '',
        phone: '',
        street: '',
        city: '',
        state: '',
        postal_code: '',
        country: '',
        is_active: true
    });

    const [businessHours, setBusinessHours] = useState({
        monday: { open: '09:00', close: '22:00', closed: false },
        tuesday: { open: '09:00', close: '22:00', closed: false },
        wednesday: { open: '09:00', close: '22:00', closed: false },
        thursday: { open: '09:00', close: '22:00', closed: false },
        friday: { open: '09:00', close: '23:00', closed: false },
        saturday: { open: '10:00', close: '23:00', closed: false },
        sunday: { open: '10:00', close: '21:00', closed: false }
    });

    useEffect(() => {
        if (vendor) {
            setFormData({
                name: vendor.name || '',
                description: vendor.description || '',
                email: vendor.email || '',
                phone: vendor.phone || '',
                street: vendor.address?.street || '',
                city: vendor.address?.city || '',
                state: vendor.address?.state || '',
                postal_code: vendor.address?.postal_code || '',
                country: vendor.address?.country || '',
                is_active: vendor.is_active
            });
            if (vendor.business_hours) {
                setBusinessHours(vendor.business_hours as typeof businessHours);
            }
        }
    }, [vendor]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vendor) return;
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const { error: updateError } = await supabase
                .from('vendors')
                .update({
                    name: formData.name,
                    description: formData.description,
                    email: formData.email,
                    phone: formData.phone,
                    address: {
                        street: formData.street,
                        city: formData.city,
                        state: formData.state,
                        postal_code: formData.postal_code,
                        country: formData.country
                    },
                    business_hours: businessHours,
                    is_active: formData.is_active
                })
                .eq('id', vendor.id);

            if (updateError) throw updateError;
            setSuccess('Settings saved successfully!');
        } catch (err: any) {
            setError(err.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const toggleOpen = async () => {
        if (!vendor) return;
        setSaving(true);

        try {
            await supabase
                .from('vendors')
                .update({ is_active: !formData.is_active })
                .eq('id', vendor.id);

            setFormData({ ...formData, is_active: !formData.is_active });
            setSuccess(formData.is_active ? 'Restaurant is now closed' : 'Restaurant is now open');
        } catch (err: any) {
            setError(err.message || 'Failed to update status');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>

            {success && (
                <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded">
                    {success}
                </div>
            )}
            {error && (
                <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
                    {error}
                </div>
            )}

            {/* Quick Toggle */}
            <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800">Restaurant Status</h2>
                        <p className="text-sm text-gray-500">Toggle to open or close your restaurant for orders</p>
                    </div>
                    <button
                        onClick={toggleOpen}
                        disabled={saving}
                        className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors duration-200 ${formData.is_active ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                    >
                        <span
                            className={`inline-block h-8 w-8 transform rounded-full bg-white transition-transform duration-200 ${formData.is_active ? 'translate-x-11' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>
                <p className={`mt-2 font-medium ${formData.is_active ? 'text-green-600' : 'text-red-600'}`}>
                    {formData.is_active ? '🟢 Open for orders' : '🔴 Closed'}
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                {/* Restaurant Info */}
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Restaurant Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Address */}
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Address</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                            <input
                                type="text"
                                value={formData.street}
                                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                            <input
                                type="text"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                            <input
                                type="text"
                                value={formData.state}
                                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                            <input
                                type="text"
                                value={formData.postal_code}
                                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                            <input
                                type="text"
                                value={formData.country}
                                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Business Hours */}
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Business Hours</h2>
                    <div className="space-y-4">
                        {Object.entries(businessHours).map(([day, hours]) => (
                            <div key={day} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                                <div className="flex items-center space-x-4">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={!hours.closed}
                                            onChange={(e) => setBusinessHours({
                                                ...businessHours,
                                                [day]: { ...hours, closed: !e.target.checked }
                                            })}
                                            className="rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                                        />
                                    </label>
                                    <span className={`w-24 font-medium capitalize ${hours.closed ? 'text-gray-400' : 'text-gray-700'}`}>
                                        {day}
                                    </span>
                                </div>
                                {!hours.closed ? (
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="time"
                                            value={hours.open}
                                            onChange={(e) => setBusinessHours({
                                                ...businessHours,
                                                [day]: { ...hours, open: e.target.value }
                                            })}
                                            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                                        />
                                        <span className="text-gray-500">to</span>
                                        <input
                                            type="time"
                                            value={hours.close}
                                            onChange={(e) => setBusinessHours({
                                                ...businessHours,
                                                [day]: { ...hours, close: e.target.value }
                                            })}
                                            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                ) : (
                                    <span className="text-gray-400">Closed</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white font-semibold rounded-lg shadow-lg hover:from-green-600 hover:to-teal-600 disabled:opacity-50 transition duration-200"
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default VendorSettings;
