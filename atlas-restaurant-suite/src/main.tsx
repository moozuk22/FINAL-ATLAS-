import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for offline support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Only register in production, skip in development
  const registerServiceWorker = () => {
    // Check if document is in a valid state
    if (document.readyState === 'loading' || document.readyState === 'uninitialized') {
      return;
    }

    try {
    navigator.serviceWorker.register('/sw.js', { 
      updateViaCache: 'none',
      scope: '/' 
    })
      .then((registration) => {
        console.log('Service Worker registered:', registration);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available, prompt user to reload
                console.log('New service worker available');
                // Don't auto-reload, let user decide
              }
            });
          }
        });
      })
      .catch((error) => {
        console.warn('Service Worker registration failed:', error);
          // Silently fail - don't unregister as it might cause issues
      });
    
      // Clean up old service workers (with error handling)
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => {
      registrations.forEach((registration) => {
        if (!registration.active?.scriptURL.includes('sw.js')) {
          registration.unregister().catch((err) => {
                // Silently fail
          });
        }
      });
        })
        .catch(() => {
          // Silently fail if getRegistrations fails
    });
    } catch (error) {
      // Silently handle any registration errors
      console.warn('Service Worker registration error:', error);
    }
  };

  if (document.readyState === 'complete') {
    registerServiceWorker();
  } else {
    window.addEventListener('load', registerServiceWorker);
  }
} else if ('serviceWorker' in navigator && import.meta.env.DEV) {
  // Unregister service worker in development
  try {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => {
    registrations.forEach((reg) => {
          reg.unregister().catch(() => {
            // Silently fail
      });
    });
      })
      .catch(() => {
        // Silently fail
  });
  } catch (error) {
    // Silently handle errors
  }
}

createRoot(document.getElementById("root")!).render(<App />);
