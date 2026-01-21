import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { databases, client, Query, ID } from './lib/appwrite';
import { USERS, ASSIGNMENTS } from './constants';
import { Calendar, Users, MessageSquare, LogOut, Plus, Check, X, Play, Square, Trash2, AlertCircle } from 'lucide-react';
import Chat from './Chat';
import { compressAssignments, decompressAssignments } from './utils/compression';

const Dashboard = () => {
    const { user, logout } = useAuth();
    const [meetings, setMeetings] = useState([]);
    const [showAddMeeting, setShowAddMeeting] = useState(false);
    const [activeMeeting, setActiveMeeting] = useState(null);

    // Persistence Helpers
    const isConfigured =
        (import.meta.env.VITE_APPWRITE_DATABASE_ID && import.meta.env.VITE_APPWRITE_DATABASE_ID !== 'YOUR_DATABASE_ID') &&
        (import.meta.env.VITE_APPWRITE_MEETINGS_COLLECTION_ID && import.meta.env.VITE_APPWRITE_MEETINGS_COLLECTION_ID !== 'YOUR_MEETINGS_COLLECTION_ID') &&
        (import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID && import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID !== 'YOUR_MESSAGES_COLLECTION_ID');

    const getLocalMeetings = () => JSON.parse(localStorage.getItem('local_meetings') || '[]');
    const saveLocalMeetings = (data) => localStorage.setItem('local_meetings', JSON.stringify(data));

    // Form state
    const [newDate, setNewDate] = useState('');
    const [newType, setNewType] = useState('Miércoles');

    useEffect(() => {
        const fetchMeetings = async () => {
            try {
                if (!isConfigured) {
                    console.warn("Appwrite IDs not configured. Using mock/local data.");
                    const local = getLocalMeetings();
                    if (local.length === 0) {
                        const defaultMeetings = [
                            { id: '1', date: '2026-01-20', type: 'Miércoles', status: 'scheduled', assignments: JSON.stringify({}) },
                            { id: '2', date: '2026-01-24', type: 'Sábado', status: 'scheduled', assignments: JSON.stringify({}) }
                        ];
                        saveLocalMeetings(defaultMeetings);
                        setMeetings(defaultMeetings);
                    } else {
                        setMeetings(local);
                    }
                    const active = local.find(m => m.status === 'in-progress');
                    setActiveMeeting(active || null);
                    return;
                }

                const response = await databases.listDocuments(
                    import.meta.env.VITE_APPWRITE_DATABASE_ID,
                    import.meta.env.VITE_APPWRITE_MEETINGS_COLLECTION_ID,
                    [Query.orderDesc('date')]
                );
                setMeetings(response.documents.map(doc => ({ id: doc.$id, ...doc })));

                const active = response.documents.find(m => m.status === 'in-progress');
                setActiveMeeting(active ? { id: active.$id, ...active } : null);
            } catch (error) {
                console.error("Error fetching meetings:", error);
                setMeetings([]);
            }
        };

        fetchMeetings();

        if (isConfigured) {
            const unsubscribe = client.subscribe(
                `databases.${import.meta.env.VITE_APPWRITE_DATABASE_ID}.collections.${import.meta.env.VITE_APPWRITE_MEETINGS_COLLECTION_ID}.documents`,
                (response) => {
                    if (response.events.includes('databases.*.collections.*.documents.*.update') ||
                        response.events.includes('databases.*.collections.*.documents.*.create') ||
                        response.events.includes('databases.*.collections.*.documents.*.delete')) {
                        fetchMeetings();
                    }
                }
            );
            return () => unsubscribe();
        }
    }, [isConfigured]);

    const handleCreateMeeting = async () => {
        if (!newDate) return;
        try {
            if (!isConfigured) {
                const newMeeting = {
                    id: Date.now().toString(),
                    date: newDate,
                    type: newType,
                    status: 'scheduled',
                    assignments: JSON.stringify({})
                };
                const updated = [newMeeting, ...meetings];
                setMeetings(updated);
                saveLocalMeetings(updated);
                setShowAddMeeting(false);
                return;
            }

            const response = await databases.createDocument(
                import.meta.env.VITE_APPWRITE_DATABASE_ID,
                import.meta.env.VITE_APPWRITE_MEETINGS_COLLECTION_ID,
                ID.unique(),
                {
                    date: newDate,
                    type: newType,
                    status: 'scheduled',
                    assignments: JSON.stringify({})
                }
            );

            // Immediate UI update
            const newDoc = { id: response.$id, ...response };
            setMeetings([newDoc, ...meetings]);
            setShowAddMeeting(false);
            setNewDate('');
        } catch (error) {
            console.error("Error creating meeting:", error);
        }
    };

    const handleAssignment = async (meetingId, position, brotherName) => {
        try {
            const meeting = meetings.find(m => m.id === meetingId);
            const assignments = decompressAssignments(meeting.assignments);

            assignments[position] = {
                name: brotherName,
                confirmed: null
            };

            const compressed = compressAssignments(assignments);

            if (!isConfigured) {
                const updated = meetings.map(m =>
                    m.id === meetingId ? { ...m, assignments: compressed } : m
                );
                setMeetings(updated);
                saveLocalMeetings(updated);
                return;
            }

            await databases.updateDocument(
                import.meta.env.VITE_APPWRITE_DATABASE_ID,
                import.meta.env.VITE_APPWRITE_MEETINGS_COLLECTION_ID,
                meetingId,
                { assignments: compressed }
            );

            // Immediate UI update
            setMeetings(meetings.map(m =>
                m.id === meetingId ? { ...m, assignments: compressed } : m
            ));
        } catch (error) {
            console.error("Error handling assignment:", error);
        }
    };

    const setMeetingStatus = async (meetingId, status) => {
        try {
            if (!isConfigured) {
                const updated = meetings.map(m => m.id === meetingId ? { ...m, status } : m);
                setMeetings(updated);
                saveLocalMeetings(updated);
                setActiveMeeting(updated.find(m => m.status === 'in-progress') || null);
                return;
            }

            await databases.updateDocument(
                import.meta.env.VITE_APPWRITE_DATABASE_ID,
                import.meta.env.VITE_APPWRITE_MEETINGS_COLLECTION_ID,
                meetingId,
                { status }
            );
        } catch (error) {
            console.error("Error setting meeting status:", error);
        }
    };

    const handleConfirmation = async (meetingId, position, confirmed) => {
        try {
            const meeting = meetings.find(m => m.id === meetingId);
            const assignments = decompressAssignments(meeting.assignments);

            if (assignments[position]) {
                assignments[position].confirmed = confirmed;
            }

            const compressed = compressAssignments(assignments);

            if (!isConfigured) {
                const updated = meetings.map(m =>
                    m.id === meetingId ? { ...m, assignments: compressed } : m
                );
                setMeetings(updated);
                saveLocalMeetings(updated);
                return;
            }

            await databases.updateDocument(
                import.meta.env.VITE_APPWRITE_DATABASE_ID,
                import.meta.env.VITE_APPWRITE_MEETINGS_COLLECTION_ID,
                meetingId,
                { assignments: compressed }
            );

            // Immediate UI update
            setMeetings(meetings.map(m =>
                m.id === meetingId ? { ...m, assignments: compressed } : m
            ));
        } catch (error) {
            console.error("Error handling confirmation:", error);
        }
    };

    const handleDeleteMeeting = async (meetingId) => {
        if (!window.confirm('¿Estás seguro de eliminar esta reunión?')) return;
        console.log("Deleting meeting:", meetingId);
        try {
            if (!isConfigured) {
                const updated = meetings.filter(m => m.id !== meetingId);
                setMeetings(updated);
                saveLocalMeetings(updated);
                if (activeMeeting?.id === meetingId) setActiveMeeting(null);
                return;
            }

            await databases.deleteDocument(
                import.meta.env.VITE_APPWRITE_DATABASE_ID,
                import.meta.env.VITE_APPWRITE_MEETINGS_COLLECTION_ID,
                meetingId
            );
            // Optimization: Update local state immediately for better UX
            const updated = meetings.filter(m => m.id !== meetingId);
            setMeetings(updated);
            if (activeMeeting?.id === meetingId) setActiveMeeting(null);
        } catch (error) {
            console.error("Error deleting meeting:", error);
            alert("Error al eliminar la reunión. Verifica tu conexión o permisos.");
        }
    };

    const handleDeleteAll = async () => {
        if (!confirm('⚠️ ¡ATENCIÓN! Se eliminarán TODAS las reuniones. ¿Continuar?')) return;
        try {
            if (!isConfigured) {
                setMeetings([]);
                saveLocalMeetings([]);
                setActiveMeeting(null);
                return;
            }

            for (const meeting of meetings) {
                await databases.deleteDocument(
                    import.meta.env.VITE_APPWRITE_DATABASE_ID,
                    import.meta.env.VITE_APPWRITE_MEETINGS_COLLECTION_ID,
                    meeting.id
                );
            }
        } catch (error) {
            console.error("Error deleting all meetings:", error);
        }
    };

    return (
        <div className="dashboard-layout">
            <header className="glass-card header">
                <div className="header-left">
                    <div className="logo-badge">DR</div>
                    <h2 className="title-gradient">Departamentos Reucha</h2>
                </div>
                <div className="header-right">
                    <div className="user-info">
                        <span className="user-name">{user.name}</span>
                        <span className={`role-tag ${user.role}`}>{user.role}</span>
                    </div>
                    <button className="logout-btn" onClick={logout}><LogOut size={18} /></button>
                </div>
            </header>

            <main className="main-content">
                {(import.meta.env.VITE_APPWRITE_DATABASE_ID === 'YOUR_DATABASE_ID' || !import.meta.env.VITE_APPWRITE_DATABASE_ID) && (
                    <div className="config-warning">
                        <AlertCircle size={20} />
                        <div>
                            <strong>Configuración pendiente:</strong>
                            Por favor, actualiza los IDs de Appwrite en tu archivo <code>.env</code> para ver los datos.
                        </div>
                    </div>
                )}
                {activeMeeting && (
                    <section className="active-section">
                        <div className="glass-card active-card">
                            <div className="active-header">
                                <h3><Play size={18} fill="currentColor" /> Reunión en Curso ({activeMeeting.type})</h3>
                                {user.role === 'admin' && (
                                    <button className="btn-stop" onClick={() => setMeetingStatus(activeMeeting.id, 'completed')}>
                                        Finalizar <Square size={14} fill="currentColor" />
                                    </button>
                                )}
                            </div>
                            <Chat meeting={activeMeeting} />
                        </div>
                    </section>
                )}

                <div className="content-grid">
                    <div className="meetings-column">
                        <div className="section-header">
                            <h3><Calendar size={20} /> Reuniones</h3>
                            {user.role === 'admin' && (
                                <div className="admin-actions">
                                    <button className="delete-all-btn" onClick={handleDeleteAll} title="Eliminar todo">
                                        <Trash2 size={18} />
                                    </button>
                                    <button className="add-btn" onClick={() => setShowAddMeeting(!showAddMeeting)}>
                                        <Plus size={20} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {showAddMeeting && (
                            <div className="glass-card add-meeting-form">
                                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
                                <select value={newType} onChange={e => setNewType(e.target.value)}>
                                    <option>Miércoles</option>
                                    <option>Sábado</option>
                                </select>
                                <button className="btn-primary" onClick={handleCreateMeeting}>Crear</button>
                            </div>
                        )}

                        <div className="meetings-list">
                            {meetings.map(meeting => (
                                <div key={meeting.id} className="glass-card meeting-card">
                                    <div className="meeting-main">
                                        <div className="meeting-info">
                                            <span className="meeting-date">{meeting.date}</span>
                                            <span className="meeting-type">{meeting.type}</span>
                                        </div>
                                        <div className="meeting-actions">
                                            {user.role === 'admin' && (
                                                <button className="btn-delete" onClick={() => handleDeleteMeeting(meeting.id)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                            {user.role === 'admin' && meeting.status === 'scheduled' && (
                                                <button className="btn-start" onClick={() => setMeetingStatus(meeting.id, 'in-progress')}>
                                                    Iniciar <Play size={14} fill="currentColor" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="assignments-mini-grid">
                                        {ASSIGNMENTS.map(pos => {
                                            const assignments = decompressAssignments(meeting.assignments);
                                            const assign = assignments[pos];
                                            return (
                                                <div key={pos} className="mini-assign">
                                                    <label>{pos}:</label>
                                                    {user.role === 'admin' ? (
                                                        <select
                                                            value={assign?.name || ''}
                                                            onChange={(e) => handleAssignment(meeting.id, pos, e.target.value)}
                                                        >
                                                            <option value="">--</option>
                                                            {USERS.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
                                                        </select>
                                                    ) : (
                                                        <span className={`assigned-name ${assign?.confirmed === true ? 'confirmed' : assign?.confirmed === false ? 'rejected' : ''}`}>
                                                            {assign?.name || '---'}
                                                            {assign?.name === user.name && assign.confirmed === null && (
                                                                <div className="confirm-actions">
                                                                    <button onClick={() => handleConfirmation(meeting.id, pos, true)}><Check size={14} /></button>
                                                                    <button onClick={() => handleConfirmation(meeting.id, pos, false)}><X size={14} /></button>
                                                                </div>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

        </div>
    );
};

export default Dashboard;
