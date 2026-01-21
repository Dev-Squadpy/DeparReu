import React, { createContext, useContext, useState, useEffect } from 'react';
import { USERS } from './constants';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Comentamos la carga automática para que siempre pida seleccionar perfil al inicio
    /*
    useEffect(() => {
        const savedUser = localStorage.getItem('app_user');
        if (savedUser) {
            const userData = USERS.find(u => u.name === savedUser);
            if (userData) setUser(userData);
        }
        setLoading(false);
    }, []);
    */

    useEffect(() => {
        // Solo quitamos el loading, no cargamos el usuario automáticamente
        setLoading(false);
    }, []);

    const login = (name) => {
        const userData = USERS.find(u => u.name === name);
        if (userData) {
            setUser(userData);
            localStorage.setItem('app_user', name);
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('app_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
