class NBAApp {
    constructor() {
        this.currentDate = new Date();
        this.games = [];
        this.refreshIntervalId = null;
        // inside constructor or before fetchLiveScoreboard is used
        this.liveProxyBase = 'https://winter-sky-692e.kdrolle594.workers.dev/?url=';

        // Grab DOM with defensive fallbacks
        this.dom = {
            grid: document.getElementById('games-grid'),
            dateDisplay: document.getElementById('current-date'),
            datePicker: document.getElementById('date-picker'),
            prevBtn: document.getElementById('prev-day'),
            nextBtn: document.getElementById('next-day'),
            refreshBtn: document.getElementById('refresh-btn'),
            template: document.getElementById('game-card-template')
        };

        // If essential DOM is missing, warn but continue (useful for testing)
        if (!this.dom.grid || !this.dom.template) {
            console.warn('Essential DOM elements missing:', {
                grid: !!this.dom.grid,
                template: !!this.dom.template
            });
        }

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadGames();

        // Auto-refresh every 30s if viewing today
        this.refreshIntervalId = setInterval(() => {
            if (this.isToday(this.currentDate)) {
                this.loadGames(true); // silent refresh
            }
        }, 30000);
    }

    setupEventListeners() {
        const { prevBtn, nextBtn, refreshBtn, datePicker } = this.dom;

        if (!prevBtn || !nextBtn || !refreshBtn || !datePicker) {
            console.warn('Some UI controls are missing — event listeners were not fully attached.', this.dom);
            // Attach listeners only for elements that exist
            if (prevBtn) prevBtn.addEventListener('click', () => this.changeDate(-1));
            if (nextBtn) nextBtn.addEventListener('click', () => this.changeDate(1));
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    refreshBtn.classList.add('spinning');
                    this.loadGames().finally(() => {
                        setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
                    });
                });
            }
            if (datePicker) {
                datePicker.addEventListener('change', (e) => {
                    if (e.target.value) {
                        this.currentDate = new Date(e.target.value + 'T12:00:00');
                        this.loadGames();
                    }
                });
            }
            return;
        }

        prevBtn.addEventListener('click', () => this.changeDate(-1));
        nextBtn.addEventListener('click', () => this.changeDate(1));

        refreshBtn.addEventListener('click', () => {
            refreshBtn.classList.add('spinning');
            this.loadGames().finally(() => {
                setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
            });
        });

        datePicker.addEventListener('change', (e) => {
            if (e.target.value) {
                // Adjust for timezone issues by appending T12:00:00
                this.currentDate = new Date(e.target.value + 'T12:00:00');
                this.loadGames();
            }
        });
    }

    changeDate(days) {
        this.currentDate.setDate(this.currentDate.getDate() + days);
        this.loadGames();
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    getDisplayDate(date) {
        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    }

    async loadGames(silent = false) {
        if (!silent) {
            this.updateDateDisplay();
            if (this.dom.grid) {
                this.dom.grid.innerHTML = `
                    <div class="loading-state">
                        <div class="spinner"></div>
                        <p>Loading games...</p>
                    </div>`;
            }
        }

        try {
            const dateStr = this.formatDate(this.currentDate);
            let gamesData = [];

            if (this.isToday(this.currentDate)) {
                gamesData = await this.fetchLiveScoreboard();
            } else {
                gamesData = await this.fetchHistoricalScoreboard(dateStr);
            }

            this.games = gamesData;
            this.render();
        } catch (error) {
            console.error('Error loading games:', error);

            // FALLBACK TO MOCK DATA FOR DEMONSTRATION
            console.log('Falling back to mock data...');
            this.games = this.getMockData();
            this.render();

            // Add a small notification
            const notification = document.createElement('div');
            notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: rgba(239, 68, 68, 0.9); padding: 10px 20px; border-radius: 8px; font-size: 0.8rem; z-index: 1000;';
            notification.textContent = 'Network blocked. Showing mock data.';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 5000);
        }
    }

    updateDateDisplay() {
        if (!this.dom.dateDisplay || !this.dom.datePicker) return;
        const displayDate = this.getDisplayDate(this.currentDate);
        this.dom.dateDisplay.textContent = this.isToday(this.currentDate) ? `Today, ${displayDate}` : displayDate;
        this.dom.datePicker.value = this.formatDate(this.currentDate);
    }

    async fetchLiveScoreboard() {
        console.log('Using ESPN Live Fetch Path');
        const targetUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
        // Note: ESPN 'live' endpoint is just the same scoreboard endpoint without specific dates (defaults to today)
        // However, to be safe and consistent with previous logic, we can explicitly pass today's date if needed.
        // But the user reported "current day no longer work". 
        // Let's stick to the explicit date construction for consistency.

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${day}`;

        const fullTargetUrl = `http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`;
        const proxyUrl = `${this.liveProxyBase}${encodeURIComponent(fullTargetUrl)}`;

        console.log('Fetching Live URL:', proxyUrl);

        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Failed to fetch live data from ESPN');
            const data = await response.json();
            console.log('ESPN Live Data:', data);
            return this.normalizeESPNGames(data);
        } catch (error) {
            console.error('ESPN Live Fetch failed', error);
            throw error;
        }
    }

    async fetchHistoricalScoreboard(dateStr) {
        // Date format: YYYY-MM-DD
        const formattedDate = dateStr.replace(/-/g, ''); // 20240201

        // ESPN API Endpoint
        const targetUrl = `http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${formattedDate}`;
        const proxyUrl = `${this.liveProxyBase}${encodeURIComponent(targetUrl)}`;

        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Failed to fetch historical data from ESPN');
        const data = await response.json();
        return this.normalizeESPNGames(data);
    }

    normalizeESPNGames(data) {
        // Defensive checks
        if (!data || !Array.isArray(data.events)) return [];

        return data.events.map(event => {
            const comp = event.competitions[0];
            const home = comp.competitors.find(c => c.homeAway === 'home');
            const away = comp.competitors.find(c => c.homeAway === 'away');
            const status = event.status.type;

            // Leaders parsing
            // ESPN structure: comp.leaders is array of categories (Points, Rebounds, Assists)
            // We want the "Points" category (usually index 0 or name="points")
            // Then inside, we find the leader for each team.
            let homeLeader = null;
            let awayLeader = null;

            try {
                if (comp.leaders) {
                    // Category can be "points" or "Points"
                    const pointsCat = comp.leaders.find(c => c.name.toLowerCase() === 'points' || c.shortDisplayName === 'Pts');
                    if (pointsCat && pointsCat.leaders) {
                        const homeLdrParams = pointsCat.leaders.find(l => l.team.id === home.team.id);
                        const awayLdrParams = pointsCat.leaders.find(l => l.team.id === away.team.id);

                        if (homeLdrParams && homeLdrParams.athlete) {
                            homeLeader = { name: homeLdrParams.athlete.shortName, stat: homeLdrParams.displayValue };
                        }
                        if (awayLdrParams && awayLdrParams.athlete) {
                            awayLeader = { name: awayLdrParams.athlete.shortName, stat: awayLdr.displayValue };
                        }
                    }
                }
            } catch (e) { console.warn('Leader parse error', e); }

            // Status code mapping
            // ESPN: STATUS_SCHEDULED, STATUS_IN_PROGRESS, STATUS_FINAL
            let statusCode = 1;
            if (status.state === 'in') statusCode = 2;
            if (status.state === 'post') statusCode = 3;

            return {
                id: event.id,
                status: status.shortDetail,
                statusCode: statusCode,
                clock: status.shortDetail, // e.g. "Final", "Q4 2:30"
                isLive: statusCode === 2,
                home: {
                    id: home.team.id,
                    tricode: home.team.abbreviation,
                    name: home.team.name, // e.g. "Lakers"
                    // ESPN logo is often nested in team.logo or team.logos[0].href
                    logo: home.team.logo || (home.team.logos && home.team.logos[0] && home.team.logos[0].href) || '',
                    score: Number(home.score),
                    wins: null,
                    losses: null
                },
                away: {
                    id: away.team.id,
                    tricode: away.team.abbreviation,
                    name: away.team.name,
                    logo: away.team.logo || (away.team.logos && away.team.logos[0] && away.team.logos[0].href) || '',
                    score: Number(away.score),
                    wins: null,
                    losses: null
                },
                leaders: {
                    home: homeLeader,
                    away: awayLeader
                }
            };
        });
    }

    getMockData() {
        return [
            {
                id: '1',
                status: 'Final',
                statusCode: 3,
                clock: 'Final',
                isLive: false,
                home: { id: 1610612747, tricode: 'LAL', name: 'Lakers', score: 112, wins: 20, losses: 21 },
                away: { id: 1610612738, tricode: 'BOS', name: 'Celtics', score: 109, wins: 32, losses: 10 },
                leaders: {
                    home: { name: 'L. James', stat: '28 PTS, 9 REB, 6 AST' },
                    away: { name: 'J. Tatum', stat: '34 PTS, 9 REB, 6 AST' }
                }
            },
            {
                id: '2',
                status: 'Q4 2:30',
                statusCode: 2,
                clock: 'Q4 2:30',
                isLive: true,
                home: { id: 1610612744, tricode: 'GSW', name: 'Warriors', score: 98, wins: 18, losses: 20 },
                away: { id: 1610612756, tricode: 'PHX', name: 'Suns', score: 101, wins: 22, losses: 15 },
                leaders: {
                    home: { name: 'S. Curry', stat: '30 PTS, 9 REB, 6 AST' },
                    away: { name: 'K. Durant', stat: '25 PTS, 9 REB, 6 AST' }
                }
            }
        ];
    }

    render() {
        if (!this.dom.grid || !this.dom.template) {
            console.warn('Missing grid or template — cannot render games.');
            return;
        }

        this.dom.grid.innerHTML = '';

        if (!Array.isArray(this.games) || this.games.length === 0) {
            this.dom.grid.innerHTML = `
                <div class="loading-state">
                    <p>No games scheduled for this date.</p>
                </div>`;
            return;
        }

        this.games.forEach(game => {
            const clone = this.dom.template.content.cloneNode(true);
            const card = clone.querySelector('.game-card');

            if (!card) return; // guard

            // Status
            const statusBadge = card.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.textContent = game.isLive ? 'LIVE' : (game.status || '');
                statusBadge.classList.toggle('live', !!game.isLive);
            }

            const clockEl = card.querySelector('.game-clock');
            if (clockEl) clockEl.textContent = game.clock || '';

            // Teams
            this.renderTeam(card, '.home', game.home);
            this.renderTeam(card, '.visitor', game.away);

            // Winner highlight (if final)
            const homeTeamEl = card.querySelector('.home-team');
            const visitorTeamEl = card.querySelector('.visitor-team');
            homeTeamEl?.classList.remove('winner');
            visitorTeamEl?.classList.remove('winner');
            if (game.statusCode === 3) {
                if ((game.home?.score || 0) > (game.away?.score || 0)) {
                    homeTeamEl?.classList.add('winner');
                } else {
                    visitorTeamEl?.classList.add('winner');
                }
            }

            // Leaders
            const leadersEl = card.querySelector('.leaders');
            if (game.leaders) {
                if (game.leaders.home) {
                    const hn = card.querySelector('.home-leader .leader-name');
                    const hs = card.querySelector('.home-leader .leader-stat');
                    if (hn) hn.textContent = this.shortenName(game.leaders.home.name || '');
                    if (hs) hs.textContent = String(game.leaders.home.stat || '');
                }
                if (game.leaders.away) {
                    const vn = card.querySelector('.visitor-leader .leader-name');
                    const vs = card.querySelector('.visitor-leader .leader-stat');
                    if (vn) vn.textContent = this.shortenName(game.leaders.away.name || '');
                    if (vs) vs.textContent = String(game.leaders.away.stat || '');
                }
                if (leadersEl) leadersEl.style.display = '';
            } else {
                if (leadersEl) leadersEl.style.display = 'none';
            }

            this.dom.grid.appendChild(clone);
        });
    }

    renderTeam(card, prefix, team) {
        if (!card) return;

        // prefix like '.home' or '.visitor' maps to classes like 'home-logo' etc.
        const logoEl = card.querySelector(`${prefix}-logo`);
        const nameEl = card.querySelector(`${prefix}-name`);
        const recordEl = card.querySelector(`${prefix}-record`);
        const scoreEl = card.querySelector(`${prefix}-score`);

        // Logo
        // Logo
        if (logoEl) {
            // Priority: URL provided in data (ESPN) > NBA CDN fallback
            if (team?.logo) {
                logoEl.src = team.logo;
                logoEl.alt = team.name || 'Team Logo';
            } else if (team?.id) {
                // Fallback for mock data or if ID is standard NBA ID
                logoEl.src = `https://cdn.nba.com/logos/nba/${team.id}/global/L/logo.svg`;
                logoEl.alt = team.name || team.tricode || 'Team Logo';
            } else {
                logoEl.src = '';
                logoEl.alt = 'Team Logo';
            }
        }

        // Name (fallbacks)
        if (nameEl) {
            nameEl.textContent = team?.name || team?.tricode || 'Team';
        }

        // Record
        if (recordEl) {
            recordEl.textContent =
                (team?.wins !== undefined && team?.losses !== undefined && team.wins !== null && team.losses !== null) ? `${team.wins}-${team.losses}` : '';
        }

        // Score
        if (scoreEl) {
            scoreEl.textContent = (team?.score !== undefined && team?.score !== null) ? String(team.score) : '';
        }
    }

    shortenName(name) {
        if (!name) return '';
        const parts = name.split(' ');
        if (parts.length > 1) {
            return `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}`;
        }
        return name;
    }
}

// Start App
document.addEventListener('DOMContentLoaded', () => {
    try {
        new NBAApp();
    } catch (err) {
        console.error('Failed to start NBAApp', err);
    }
});