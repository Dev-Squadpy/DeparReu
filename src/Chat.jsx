import React, { useState, useEffect, useRef } from 'react';
import { databases, client, Query, ID } from './lib/appwrite';
import { useAuth } from './AuthContext';
import { PREDEFINED_PHRASES } from './constants';
import { decompressAssignments } from './utils/compression';
import { Send, AlertCircle } from 'lucide-react';

const Chat = ({ meeting }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [inputText, setInputText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState(null);
    const scrollRef = useRef();

    // Persistence Helpers
    const isConfigured =
        (import.meta.env.VITE_APPWRITE_DATABASE_ID && import.meta.env.VITE_APPWRITE_DATABASE_ID !== 'YOUR_DATABASE_ID') &&
        (import.meta.env.VITE_APPWRITE_MEETINGS_COLLECTION_ID && import.meta.env.VITE_APPWRITE_MEETINGS_COLLECTION_ID !== 'YOUR_MEETINGS_COLLECTION_ID') &&
        (import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID && import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID !== 'YOUR_MESSAGES_COLLECTION_ID');

    const getLocalMessages = () => JSON.parse(localStorage.getItem(`local_messages_${meeting.id}`) || '[]');
    const saveLocalMessages = (data) => localStorage.setItem(`local_messages_${meeting.id}`, JSON.stringify(data));

    useEffect(() => {
        // Authorization: Admins + all assigned users for this meeting
        let assignedUserNames = [];
        try {
            const assignments = decompressAssignments(meeting.assignments);
            assignedUserNames = Object.values(assignments).map(a => a.name).filter(Boolean);
        } catch (e) {
            console.error("Error parsing assignments in Chat:", e);
        }

        // Admin always has access, or if user is assigned to any position
        const isUserAuthorized = user.role === 'admin' || assignedUserNames.includes(user.name);
        setIsAuthorized(isUserAuthorized);

        console.log('Chat Authorization:', {
            user: user.name,
            role: user.role,
            assignedUsers: assignedUserNames,
            isAuthorized: isUserAuthorized
        });

        if (isUserAuthorized) {
            const fetchMessages = async () => {
                setError(null);
                try {
                    if (!isConfigured) {
                        const local = getLocalMessages();
                        setMessages(local.length ? local : [{ id: 'm1', sender: 'Sistema', text: 'Chat local habilitado', timestamp: new Date().toISOString() }]);
                        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                        return;
                    }

                    const response = await databases.listDocuments(
                        import.meta.env.VITE_APPWRITE_DATABASE_ID,
                        import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID,
                        [
                            Query.equal('meetingId', meeting.id),
                            Query.orderAsc('timestamp'),
                            Query.limit(50)
                        ]
                    );
                    setMessages(response.documents.map(doc => ({ id: doc.$id, ...doc })));
                    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                } catch (err) {
                    console.error("Error fetching messages:", err);
                    if (err.message?.includes('index')) {
                        setError("Error: Falta crear un índice en Appwrite para 'meetingId' y 'timestamp'.");
                    } else {
                        setError("Error al cargar mensajes. Verifica los IDs en Appwrite.");
                    }
                }
            };

            fetchMessages();

            if (isConfigured) {
                const unsubscribe = client.subscribe(
                    `databases.${import.meta.env.VITE_APPWRITE_DATABASE_ID}.collections.${import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID}.documents`,
                    (response) => {
                        if (response.events.includes('databases.*.collections.*.documents.*.create')) {
                            if (response.payload.meetingId === meeting.id) {
                                fetchMessages();
                            }
                        }
                    }
                );
                return () => unsubscribe();
            }
        }
    }, [meeting.id, meeting.assignments, user.name, user.role, isConfigured]);

    const sendMessage = async (text) => {
        if (!text?.trim()) return;
        setIsSending(true);
        setError(null);
        try {
            if (!isConfigured) {
                const newMessage = {
                    id: Date.now().toString(),
                    meetingId: meeting.id,
                    text: text.trim(),
                    sender: user.name,
                    timestamp: new Date().toISOString(),
                    type: 'text'
                };
                const updated = [...messages, newMessage];
                setMessages(updated);
                saveLocalMessages(updated);
                setInputText('');
                setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                return;
            }

            await databases.createDocument(
                import.meta.env.VITE_APPWRITE_DATABASE_ID,
                import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID,
                ID.unique(),
                {
                    meetingId: meeting.id,
                    text: text.trim(),
                    sender: user.name,
                    timestamp: new Date().toISOString(),
                    type: 'text'
                }
            );
            setInputText('');
        } catch (err) {
            console.error("Error sending message:", err);
            setError("Error al enviar el mensaje.");
        } finally {
            setIsSending(false);
        }
    };

    if (!isAuthorized) {
        return (
            <div className="unauthorized-message">
                <AlertCircle size={40} />
                <p>No tienes asignación para esta reunión hoy.</p>
                <span>El chat solo está disponible para los hermanos asignados y encargados.</span>
            </div>
        );
    }

    return (
        <div className="chat-container">
            {error && <div className="chat-error"><AlertCircle size={14} /> {error}</div>}

            <div className="messages-list">
                {messages.length === 0 && !error && <div className="no-messages">No hay mensajes aún.</div>}
                {messages.map((msg) => (
                    <div key={msg.id} className={`message-item ${msg.sender === user.name ? 'own' : ''}`}>
                        <span className="msg-sender">{msg.sender}</span>
                        <div className="msg-bubble">{msg.text}</div>
                    </div>
                ))}
                <div ref={scrollRef} />
            </div>

            <div className="chat-input-area">
                <input
                    type="text"
                    placeholder="Escribe un mensaje..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage(inputText)}
                    disabled={isSending}
                />
                <button
                    className="send-btn"
                    onClick={() => sendMessage(inputText)}
                    disabled={isSending || !inputText.trim()}
                >
                    <Send size={18} />
                </button>
            </div>

            <div className="quick-actions">
                <div className="phrase-grid">
                    {PREDEFINED_PHRASES.map((phrase) => (
                        <button
                            key={phrase}
                            className="phrase-btn"
                            onClick={() => sendMessage(phrase)}
                            disabled={isSending}
                        >
                            {phrase}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Chat;
