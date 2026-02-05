import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import VendorLayout from './components/VendorLayout';
import VendorDashboard from './components/VendorDashboard';
import VendorOrders from './components/VendorOrders';
import MenuManagement from './components/MenuManagement';
import VendorSettings from './components/VendorSettings';
import Login from './components/Login';

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={<Login />} />

                    {/* Protected Routes */}
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <VendorLayout>
                                    <VendorDashboard />
                                </VendorLayout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/orders"
                        element={
                            <ProtectedRoute>
                                <VendorLayout>
                                    <VendorOrders />
                                </VendorLayout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/menu"
                        element={
                            <ProtectedRoute>
                                <VendorLayout>
                                    <MenuManagement />
                                </VendorLayout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/settings"
                        element={
                            <ProtectedRoute>
                                <VendorLayout>
                                    <VendorSettings />
                                </VendorLayout>
                            </ProtectedRoute>
                        }
                    />

                    {/* Catch all - redirect to dashboard */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;