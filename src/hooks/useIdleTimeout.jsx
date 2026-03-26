import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function useIdleTimeout(timeoutMinutes = 5) {
  const { signOut, user } = useAuth();

  useEffect(() => {
    // If there is no active user, we don't need to monitor inactivity
    if (!user) return;

    let timeoutId;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        // Log user out upon expiration due to 5 mins of inactivity
        alert('Sua sessão expirou por inatividade. Por segurança, você foi desconectado da sua conta financeira.');
        await signOut();
      }, timeoutMinutes * 60 * 1000);
    };

    // Typical user interaction events signifying activity
    const events = ['mousemove', 'keydown', 'wheel', 'touchstart', 'click'];
    
    // Start the timer initially
    resetTimeout();

    // Attach listeners
    events.forEach(event => window.addEventListener(event, resetTimeout));

    // Cleanup phase
    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimeout));
    };
  }, [user, signOut, timeoutMinutes]);
}
