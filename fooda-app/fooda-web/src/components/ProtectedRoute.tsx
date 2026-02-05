import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
    allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
    const { user, role, loading } = useAuth();

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/auth" replace />;
    }

    if (allowedRoles && role && !allowedRoles.includes(role)) {
        // Redirect based on actual role to avoid infinite loops if configured wrong
        if (role === 'admin') return <Navigate to="/admin" replace />;
        if (role === 'vendor') return <Navigate to="/vendor" replace />;
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
