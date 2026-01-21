import React from 'react';
import { useAuth } from './AuthContext';
import { USERS } from './constants';
import { User, ShieldCheck } from 'lucide-react';

const Login = () => {
    const { login } = useAuth();

    return (
        <div className="login-container">
            <div className="glass-card login-card">
                <h1 className="title-gradient">Bienvenido</h1>
                <p className="subtitle">Selecciona tu perfil para ingresar</p>

                <div className="profile-grid">
                    {USERS.map((profile) => (
                        <button
                            key={profile.name}
                            className="profile-item glass-card"
                            onClick={() => login(profile.name)}
                        >
                            <div className={`avatar-circle ${profile.role}`}>
                                {profile.role === 'admin' ? <ShieldCheck size={24} /> : <User size={24} />}
                            </div>
                            <span>{profile.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            <style jsx>{`
        .login-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
        }
        .login-card {
          width: 100%;
          max-width: 600px;
          padding: 40px;
          text-align: center;
        }
        .subtitle {
          color: var(--text-muted);
          margin-bottom: 30px;
          font-size: 1.1rem;
        }
        .profile-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 16px;
          margin-top: 20px;
        }
        .profile-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .profile-item:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--primary);
          transform: translateY(-4px);
        }
        .avatar-circle {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--glass-bg);
          color: var(--text-muted);
        }
        .avatar-circle.admin {
          background: rgba(99, 102, 241, 0.2);
          color: var(--primary);
        }
        span {
          font-weight: 600;
          font-size: 0.9rem;
        }
      `}</style>
        </div>
    );
};

export default Login;
