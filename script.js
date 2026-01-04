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

            // Fetch activities from April 1, 2025
            const april2025Epoch = 1743465600;
            let allActivities = [];
            let page = 1;
            const perPage = 200;

            while (true) {
                const response = await fetch(`${ACTIVITIES_URL}?after=${april2025Epoch}&per_page=${perPage}&page=${page}`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (!response.ok) {
                    console.warn('Strava fetch failed', response.status);
                    break;
                }

                const activities = await response.json();
                if (activities.length === 0) break; // No more data

                allActivities = allActivities.concat(activities);

                if (activities.length < perPage) break; // Last page
                page++;
            }

            return allActivities;
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

        // Fixed Range: April 1, 2025 to April 1, 2026
        const startDate = new Date('2025-04-01');
        const endDate = new Date('2026-04-01'); // 1 year later

        // Calculate days to render
        // 52 weeks * 7 = 364 days, or just days between dates
        const totalDays = 371; // 53 weeks to be safe/full year view

        // 2. Fetch Data
        // Need to ensure we get data starting from April 2025
        fetchStravaData().then(activities => {
            const debugEl = document.getElementById('stravaDebug');
            if (debugEl) {
                debugEl.innerText = `Debug: Fetched ${activities.length} activities.`;
                if (activities.length > 0) {
                    const last = activities[activities.length - 1].start_date_local;
                    const first = activities[0].start_date_local;
                    debugEl.innerText += ` Range: ${last} to ${first}`;
                }
            }

            // Create a map of date -> activity count/intensity
            const activityMap = {};
            activities.forEach(act => {
                // start_date_local: "2024-05-21T10:00:00Z"
                const dateKey = act.start_date_local.split('T')[0];
                if (!activityMap[dateKey]) activityMap[dateKey] = 0;
                activityMap[dateKey]++;
            });

            // 3. Render Grid
            const today = new Date(); // To know where "future" starts if we want to visually distinguish, or just render empty

            for (let i = 0; i < totalDays; i++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + i);

                const dateKey = getDayKey(currentDate);
                const count = activityMap[dateKey] || 0;

                const cell = document.createElement('div');
                cell.classList.add('strava-cell');

                // Assign level based on count
                if (count > 0) {
                    let level = 1;
                    if (count >= 1) level = 2;
                    if (count >= 2) level = 3;
                    if (count >= 3) level = 4; // high activity
                    cell.classList.add(`level-${level}`);
                    cell.title = `${count} activities on ${dateKey}`;
                } else {
                    cell.title = `No activity on ${dateKey}`;
                }

                // Optional: visual marker for today? 
                if (getDayKey(currentDate) === getDayKey(today)) {
                    cell.style.border = '1px solid #000'; // minimalist marker
                }

                gridContainer.appendChild(cell);
            }
        });
    }
});
