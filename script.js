document.addEventListener('DOMContentLoaded', () => {
    // Scroll animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Fade-in animations are handled by CSS mostly, but logic kept here

    // Contact Overlay Logic
    const openContactBtn = document.getElementById('openContact');
    const closeContactBtn = document.getElementById('closeContact');
    const contactOverlay = document.getElementById('contactOverlay');

    if (openContactBtn && closeContactBtn && contactOverlay) {
        openContactBtn.addEventListener('click', (e) => {
            e.preventDefault();
            contactOverlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        });

        closeContactBtn.addEventListener('click', () => {
            contactOverlay.classList.remove('active');
            document.body.style.overflow = ''; // Restore scrolling
        });

        // Close on clicking outside content
        contactOverlay.addEventListener('click', (e) => {
            if (e.target === contactOverlay) {
                contactOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // Strava Grid Generation
    const gridContainer = document.getElementById('stravaGrid');

    // Strava Configuration
    const CLIENT_ID = '193366';
    const CLIENT_SECRET = '74e31af6c87e20dfb442fc4ebe72dc4be2f931d7';
    const REFRESH_TOKEN = 'cfdb357c6ea5242a286b59f51592a69237da9881';
    const REFRESH_URL = 'https://www.strava.com/oauth/token';
    const ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities';

    async function getAccessToken() {
        try {
            const response = await fetch(REFRESH_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    refresh_token: REFRESH_TOKEN,
                    grant_type: 'refresh_token'
                })
            });
            const data = await response.json();
            return data.access_token;
        } catch (error) {
            console.error('Error refreshing token:', error);
            return null;
        }
    }

    async function fetchStravaData() {
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) return [];

            // Fetch activities from 1 year ago to now
            const oneYearAgo = Math.floor(Date.now() / 1000) - 31536000;
            const response = await fetch(`${ACTIVITIES_URL}?after=${oneYearAgo}&per_page=200`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                console.warn('Strava fetch failed', response.status);
                return [];
            }
            const activities = await response.json();
            return activities;
        } catch (error) {
            console.error("Error fetching Strava data:", error);
            return [];
        }
    }

    // Helper to format date as YYYY-MM-DD for easy comparison
    function getDayKey(date) {
        return date.toISOString().split('T')[0];
    }

    if (gridContainer) {
        // Clear previous generic grid if any (or just overwrite)
        gridContainer.innerHTML = '';

        // 1. Calculate Start Date (52 weeks ago, aligned to Sunday)
        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setDate(today.getDate() - 364);

        // Align to previous Sunday
        const dayOfWeek = oneYearAgo.getDay(); // 0 is Sunday
        const startDate = new Date(oneYearAgo);
        startDate.setDate(oneYearAgo.getDate() - dayOfWeek);

        // 2. Fetch Data
        fetchStravaData().then(activities => {
            // Create a map of date -> activity count/intensity
            const activityMap = {};
            activities.forEach(act => {
                // start_date_local: "2024-05-21T10:00:00Z"
                const dateKey = act.start_date_local.split('T')[0];
                if (!activityMap[dateKey]) activityMap[dateKey] = 0;
                activityMap[dateKey]++; // Count activities per day
                // Could also sum distance/time for intensity
            });

            // 3. Render Grid
            const totalDays = 53 * 7; // Slightly more than a year to fill grid

            for (let i = 0; i < totalDays; i++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + i);

                // Stop if we go past today? Optional, GitHub shows future as empty.
                if (currentDate > today) {
                    // Render empty or stop? GitHub renders full rows.
                }

                const dateKey = getDayKey(currentDate);
                const count = activityMap[dateKey] || 0;

                const cell = document.createElement('div');
                cell.classList.add('strava-cell');

                // Assign level based on count
                if (count > 0) {
                    // Simple logic: 1 activity = level 2, 2+ = level 3/4
                    let level = 1;
                    if (count >= 1) level = 2;
                    if (count >= 2) level = 3;
                    if (count >= 3) level = 4; // high activity

                    cell.classList.add(`level-${level}`);
                    cell.title = `${count} activities on ${dateKey}`;
                } else {
                    cell.title = `No activity on ${dateKey}`;
                }

                gridContainer.appendChild(cell);
            }
        });
    }
});
