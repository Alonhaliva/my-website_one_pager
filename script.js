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
        // But grid MUST start on Sunday to align rows correctly (Row 1 = Sun, Row 2 = Mon...)
        const fixedStart = new Date('2025-04-01');
        const dayDiff = fixedStart.getDay(); // 0=Sun, 1=Mon, 2=Tue...
        const startDate = new Date(fixedStart);
        startDate.setDate(fixedStart.getDate() - dayDiff); // Backtrack to Sunday

        // Calculate days to render
        // 53 weeks * 7 = 371 days covering the range
        const totalDays = 371;

        // 2. Fetch Data
        // Need to ensure we get data starting from April 2025
        fetchStravaData().then(activities => {
            // Create a map of date -> activity count/intensity
            const activityMap = {};
            activities.forEach(act => {
                // start_date_local: "2024-05-21T10:00:00Z"
                const dateKey = act.start_date_local.split('T')[0];
                if (!activityMap[dateKey]) activityMap[dateKey] = 0;
                activityMap[dateKey]++;
            });

            // 3. Render Grid & Labels
            const monthsContainer = document.querySelector('.strava-months');
            if (monthsContainer) monthsContainer.innerHTML = '';
            monthsContainer.style.position = 'relative';
            monthsContainer.style.height = '20px'; // Ensure space for absolute labels

            let currentWeekIndex = 0;
            let lastMonth = -1;

            for (let i = 0; i < totalDays; i++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + i);

                // --- Month Label Logic ---
                // Check if this day is a Sunday (start of a grid column)
                if (currentDate.getDay() === 0) {
                    const month = currentDate.getMonth();
                    // If it's a new month (or the very first column), add label
                    if (month !== lastMonth) {
                        const monthName = currentDate.toLocaleString('default', { month: 'short' });

                        // Create label
                        const label = document.createElement('span');
                        label.innerText = monthName;
                        label.style.position = 'absolute';
                        // Column width is 10px cell + 3px gap = 13px
                        label.style.left = `${currentWeekIndex * 13}px`;
                        label.style.fontSize = '0.75rem';
                        label.style.color = '#999';

                        monthsContainer.appendChild(label);
                        lastMonth = month;
                    }
                    currentWeekIndex++;
                }
                // -------------------------

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
                const todayKey = getDayKey(new Date());
                if (dateKey === todayKey) {
                    cell.style.border = '1px solid #000'; // minimalist marker
                }

                gridContainer.appendChild(cell);
            }
        });
    }
});
