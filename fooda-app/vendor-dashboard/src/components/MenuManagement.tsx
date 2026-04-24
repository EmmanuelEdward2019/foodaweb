import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { MenuItem, MenuCategory } from '../types/database';

const MenuManagement: React.FC = () => {
    const { vendor } = useAuth();
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: 0,
        category_id: '',
        is_available: true,
        is_vegetarian: false,
        is_vegan: false,
        prep_time: 15
    });

    const [categoryFormData, setCategoryFormData] = useState({
        name: '',
        description: ''
    });

    useEffect(() => {
        if (vendor) {
            fetchData();
        }
    }, [vendor]);

    const fetchData = async () => {
        if (!vendor) return;

        try {
            setLoading(true);

            const [itemsResult, categoriesResult] = await Promise.all([
                supabase
                    .from('menu_items')
                    .select('*, category:menu_categories(*)')
                    .eq('vendor_id', vendor.id)
                    .order('sort_order', { ascending: true }),
                supabase
                    .from('menu_categories')
                    .select('*')
                    .eq('vendor_id', vendor.id)
                    .order('sort_order', { ascending: true })
            ]);

            setMenuItems(itemsResult.data || []);
            setCategories(categoriesResult.data || []);
        } catch (err) {
            console.error('Error fetching menu data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vendor) return;
        setSubmitting(true);

        try {
            const itemData = {
                vendor_id: vendor.id,
                name: formData.name,
                description: formData.description,
                price: formData.price,
                category_id: formData.category_id || null,
                is_available: formData.is_available,
                is_vegetarian: formData.is_vegetarian,
                is_vegan: formData.is_vegan,
                prep_time: formData.prep_time
            };

            if (editingItem) {
                await supabase
                    .from('menu_items')
                    .update(itemData)
                    .eq('id', editingItem.id);
            } else {
                await supabase
                    .from('menu_items')
                    .insert(itemData);
            }

            resetForm();
            fetchData();
        } catch (err) {
            console.error('Error saving menu item:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCategorySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vendor) return;
        setSubmitting(true);

        try {
            await supabase
                .from('menu_categories')
                .insert({
                    vendor_id: vendor.id,
                    name: categoryFormData.name,
                    description: categoryFormData.description,
                    is_active: true
                });

            setCategoryFormData({ name: '', description: '' });
            setShowCategoryForm(false);
            fetchData();
        } catch (err) {
            console.error('Error saving category:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const toggleAvailability = async (item: MenuItem) => {
        try {
            await supabase
                .from('menu_items')
                .update({ is_available: !item.is_available })
                .eq('id', item.id);
            fetchData();
        } catch (err) {
            console.error('Error updating availability:', err);
        }
    };

    const deleteItem = async (itemId: string) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;

        try {
            await supabase
                .from('menu_items')
                .delete()
                .eq('id', itemId);
            fetchData();
        } catch (err) {
            console.error('Error deleting item:', err);
        }
    };

    const deleteCategory = async (categoryId: string) => {
        if (!window.confirm('Delete this category? Items in this category will become uncategorized.')) return;

        try {
            await supabase
                .from('menu_categories')
                .delete()
                .eq('id', categoryId);
            fetchData();
        } catch (err) {
            console.error('Error deleting category:', err);
        }
    };

    const editItem = (item: MenuItem) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            description: item.description || '',
            price: item.price,
            category_id: item.category_id || '',
            is_available: item.is_available,
            is_vegetarian: item.is_vegetarian,
            is_vegan: item.is_vegan,
            prep_time: item.prep_time || 15
        });
        setShowAddForm(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            price: 0,
            category_id: '',
            is_available: true,
            is_vegetarian: false,
            is_vegan: false,
            prep_time: 15
        });
        setEditingItem(null);
        setShowAddForm(false);
    };

    const filteredItems = menuItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || item.category_id === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
                    <div className="grid grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="bg-white rounded-xl p-4">
                                <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Menu Management</h1>
                <div className="flex space-x-3">
                    <button
                        onClick={() => setShowCategoryForm(true)}
                        className="px-4 py-2 border border-teal-500 text-teal-500 rounded-lg hover:bg-teal-50 transition duration-200"
                    >
                        + Add Category
                    </button>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition duration-200"
                    >
                        + Add Item
                    </button>
                </div>
            </div>

            {/* Categories */}
            <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
                <h2 className="font-semibold text-gray-700 mb-3">Categories</h2>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setCategoryFilter('all')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition duration-200 ${categoryFilter === 'all' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        All Items ({menuItems.length})
                    </button>
                    {categories.map((cat) => (
                        <div key={cat.id} className="flex items-center">
                            <button
                                onClick={() => setCategoryFilter(cat.id)}
                                className={`px-4 py-2 rounded-l-full text-sm font-medium transition duration-200 ${categoryFilter === cat.id ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {cat.name} ({menuItems.filter(m => m.category_id === cat.id).length})
                            </button>
                            <button
                                onClick={() => deleteCategory(cat.id)}
                                className="px-2 py-2 bg-gray-100 rounded-r-full text-red-500 hover:bg-red-100"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Search */}
            <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
                <div className="relative">
                    <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search menu items..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Add/Edit Item Form */}
            {showAddForm && (
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
                    <h2 className="text-xl font-semibold mb-4">{editingItem ? 'Edit Item' : 'Add New Item'}</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                <select
                                    value={formData.category_id}
                                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="">Uncategorized</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Prep Time (mins)</label>
                                <input
                                    type="number"
                                    value={formData.prep_time}
                                    onChange={(e) => setFormData({ ...formData, prep_time: parseInt(e.target.value) || 15 })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                            <div className="md:col-span-2 flex space-x-6">
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_available}
                                        onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                                        className="rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Available</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_vegetarian}
                                        onChange={(e) => setFormData({ ...formData, is_vegetarian: e.target.checked })}
                                        className="rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">🥬 Vegetarian</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_vegan}
                                        onChange={(e) => setFormData({ ...formData, is_vegan: e.target.checked })}
                                        className="rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">🌱 Vegan</span>
                                </label>
                            </div>
                        </div>
                        <div className="flex justify-end mt-4 space-x-3">
                            <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                                Cancel
                            </button>
                            <button type="submit" disabled={submitting} className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50">
                                {submitting ? 'Saving...' : (editingItem ? 'Update Item' : 'Add Item')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Add Category Form */}
            {showCategoryForm && (
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
                    <h2 className="text-xl font-semibold mb-4">Add Category</h2>
                    <form onSubmit={handleCategorySubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
                                <input
                                    type="text"
                                    value={categoryFormData.name}
                                    onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <input
                                    type="text"
                                    value={categoryFormData.description}
                                    onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end mt-4 space-x-3">
                            <button type="button" onClick={() => setShowCategoryForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                                Cancel
                            </button>
                            <button type="submit" disabled={submitting} className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50">
                                {submitting ? 'Saving...' : 'Add Category'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Menu Items Grid */}
            {filteredItems.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                    <span className="text-6xl mb-4 block">🍽️</span>
                    <p className="text-gray-500">No menu items yet</p>
                    <button onClick={() => setShowAddForm(true)} className="mt-4 text-teal-500 hover:text-teal-600 font-medium">
                        Add your first menu item
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredItems.map((item) => (
                        <div key={item.id} className={`bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition duration-200 ${!item.is_available ? 'opacity-60' : ''}`}>
                            <div className={`h-2 ${item.is_available ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-semibold text-gray-800 text-lg">{item.name}</h3>
                                        <p className="text-sm text-gray-500">{item.category?.name || 'Uncategorized'}</p>
                                    </div>
                                    <p className="text-xl font-bold text-teal-600">${item.price.toFixed(2)}</p>
                                </div>
                                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description || 'No description'}</p>
                                <div className="flex items-center space-x-2 mb-3">
                                    {item.is_vegetarian && <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">🥬 Vegetarian</span>}
                                    {item.is_vegan && <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">🌱 Vegan</span>}
                                    {item.prep_time && <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">⏱️ {item.prep_time}min</span>}
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => toggleAvailability(item)}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition duration-200 ${item.is_available ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        {item.is_available ? 'Available' : 'Unavailable'}
                                    </button>
                                    <button onClick={() => editItem(item)} className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button onClick={() => deleteItem(item.id)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MenuManagement;