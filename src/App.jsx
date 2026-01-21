import React from 'react';
import { useAuth } from './AuthContext';
import Login from './Login';
import Dashboard from './Dashboard';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <div className="app-main">
      {!user ? <Login /> : <Dashboard />}
    </div>
  );
}

export default App;
