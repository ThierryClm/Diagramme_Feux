import React, { useEffect, useState, useRef } from 'react';
import { subscribeToasts } from '../utils/toast';
import './ToastContainer.css';

const DURATIONS = {
    success: 2500,
    error: 4000,
    info: 3000
};

const ICONS = {
    success: '✓',
    error: '✗',
    info: 'i'
};

const ToastContainer = () => {
    const [toasts, setToasts] = useState([]);
    const timersRef = useRef(new Map());

    useEffect(() => {
        const unsubscribe = subscribeToasts(t => {
            setToasts(prev => [...prev, t]);
            const duration = DURATIONS[t.type] || 3000;
            const timer = setTimeout(() => {
                // Trigger slide-out animation by marking as leaving
                setToasts(prev => prev.map(x => x.id === t.id ? { ...x, leaving: true } : x));
                // Remove after animation
                setTimeout(() => {
                    setToasts(prev => prev.filter(x => x.id !== t.id));
                    timersRef.current.delete(t.id);
                }, 250);
            }, duration);
            timersRef.current.set(t.id, timer);
        });

        return () => {
            unsubscribe();
            timersRef.current.forEach(clearTimeout);
            timersRef.current.clear();
        };
    }, []);

    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast toast-${t.type}${t.leaving ? ' toast-leaving' : ''}`}>
                    <span className="toast-icon">{ICONS[t.type]}</span>
                    <span className="toast-msg">{t.message}</span>
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;
