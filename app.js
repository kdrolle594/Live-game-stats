class NBAApp {
    constructor() {
        this.currentDate = new Date();
        this.games = [];
        this.refreshIntervalId = null;

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
        // Use CDN for today's live data
        const response = await fetch('https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        // Defensive: data.scoreboard.games might be nested or named differently
        const games = (data && (data.scoreboard?.games || data.games || [])) || [];
        return this.normalizeLiveGames(games);
    }

    async fetchHistoricalScoreboard(dateStr) {
        // Date format for stats API: MM/DD/YYYY
        const [year, month, day] = dateStr.split('-');
        const formattedDate = `${month}/${day}/${year}`;
        const encodedDate = encodeURIComponent(formattedDate);

        // Using a CORS proxy to bypass browser restrictions
        const targetUrl = `https://stats.nba.com/stats/scoreboardv2?DayOffset=0&LeagueID=00&gameDate=${encodedDate}`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Failed to fetch historical data');
        const data = await response.json();
        return this.normalizeHistoricalGames(data);
    }

    normalizeLiveGames(games) {
        return (games || []).map(game => {
            // safe access for period and clock
            const period = (game.period && (game.period.current ?? game.period)) ?? game.period ?? '';
            const clock = game.gameClock ?? game.clock ?? '';

            // Team objects may be under different keys depending on source
            const home = game.homeTeam ?? game.hTeam ?? game.home ?? {};
            const away = game.awayTeam ?? game.vTeam ?? game.away ?? {};

            const leaders = game.gameLeaders ?? game.leaders ?? null;

            const statusVal = Number(game.gameStatus ?? game.status ?? 1);

            return {
                id: game.gameId ?? game.game_id ?? String(game.gameCode || ''),
                status: game.gameStatusText ?? game.statusText ?? '',
                statusCode: statusVal, // 1: Not Started, 2: Live, 3: Final
                clock: statusVal === 2 ? `Q${period} ${clock}` : (game.gameStatusText ?? game.statusText ?? ''),
                isLive: statusVal === 2,
                home: {
                    id: home.teamId ?? home.team_id ?? home.teamId ?? null,
                    tricode: home.teamTricode ?? home.tricode ?? home.triCode ?? null,
                    name: home.teamName ?? home.nickname ?? home.fullName ?? '',
                    score: Number(home.score ?? home.points ?? 0),
                    wins: home.wins ?? home.win ?? null,
                    losses: home.losses ?? home.loss ?? null
                },
                away: {
                    id: away.teamId ?? away.team_id ?? away.teamId ?? null,
                    tricode: away.teamTricode ?? away.tricode ?? away.triCode ?? null,
                    name: away.teamName ?? away.nickname ?? away.fullName ?? '',
                    score: Number(away.score ?? away.points ?? 0),
                    wins: away.wins ?? away.win ?? null,
                    losses: away.losses ?? away.loss ?? null
                },
                leaders: leaders ? {
                    home: this.formatLeader(leaders.homeLeaders ?? leaders.home ?? leaders.homeLeader ?? null),
                    away: this.formatLeader(leaders.awayLeaders ?? leaders.away ?? leaders.awayLeader ?? null)
                } : null
            };
        });
    }

    normalizeHistoricalGames(data) {
        // Defensive checks
        if (!data || !Array.isArray(data.resultSets)) return [];

        // Find sets by name where possible
        const getResultSet = (nameGuess, fallbackIndex) => {
            const found = data.resultSets.find(rs => (rs.name && rs.name.toLowerCase().includes(nameGuess.toLowerCase())));
            return found || data.resultSets[fallbackIndex] || null;
        };

        const headerSet = getResultSet('GameHeader', 0);
        const lineScoreSet = getResultSet('LineScore', 1);

        if (!headerSet || !Array.isArray(headerSet.rowSet)) return [];

        const headers = headerSet.headers || [];
        const headerRows = headerSet.rowSet || [];
        const lineHeaders = (lineScoreSet && (lineScoreSet.headers || [])) || [];
        const lineRows = (lineScoreSet && lineScoreSet.rowSet) || [];

        // helper to find column index by name (case-insensitive)
        const idx = (name) => {
            const i = headers.findIndex(h => String(h).toLowerCase() === name.toLowerCase());
            return i >= 0 ? i : -1;
        };

        const lhIdx = (name) => {
            const i = lineHeaders.findIndex(h => String(h).toLowerCase() === name.toLowerCase());
            return i >= 0 ? i : -1;
        };

        const gameIdIdx = idx('GAME_ID') >= 0 ? idx('GAME_ID') : 2; // fallback
        const statusIdx = idx('GAME_STATUS_TEXT') >= 0 ? idx('GAME_STATUS_TEXT') : 4;
        const homeIdIdx = idx('HOME_TEAM_ID') >= 0 ? idx('HOME_TEAM_ID') : 6;
        const awayIdIdx = idx('VISITOR_TEAM_ID') >= 0 ? idx('VISITOR_TEAM_ID') : 7;
        const homeRecIdx = idx('HOME_TEAM_WINS_LOSSES') >= 0 ? idx('HOME_TEAM_WINS_LOSSES') : 8;
        const awayRecIdx = idx('VISITOR_TEAM_WINS_LOSSES') >= 0 ? idx('VISITOR_TEAM_WINS_LOSSES') : 9;

        const ptsIdxLine = lhIdx('PTS') >= 0 ? lhIdx('PTS') : 22; // common fallback

        // parse record like "20-10" -> {wins, losses}
        const parseRecord = (rec) => {
            if (!rec) return { wins: null, losses: null };
            if (typeof rec === 'string' && rec.includes('-')) {
                const [w, l] = rec.split('-').map(s => parseInt(s, 10));
                return { wins: isNaN(w) ? null : w, losses: isNaN(l) ? null : l };
            }
            return { wins: null, losses: null };
        };

        return headerRows.map(row => {
            const gameId = row[gameIdIdx];
            const statusText = row[statusIdx] || '';
            const homeTeamId = row[homeIdIdx];
            const awayTeamId = row[awayIdIdx];

            // find corresponding line rows using loose equality
            const homeLine = lineRows.find(l => String(l[2]) === String(gameId) && String(l[3]) === String(homeTeamId)) || [];
            const awayLine = lineRows.find(l => String(l[2]) === String(gameId) && String(l[3]) === String(awayTeamId)) || [];

            const homeRec = parseRecord(row[homeRecIdx]);
            const awayRec = parseRecord(row[awayRecIdx]);

            return {
                id: String(gameId),
                status: statusText,
                statusCode: (String(statusText).toLowerCase().includes('final') ? 3 : 1),
                clock: statusText,
                isLive: false,
                home: {
                    id: homeTeamId,
                    tricode: this.getTeamTricode(homeTeamId),
                    name: '', // fill if you add a team metadata map
                    score: Number(homeLine[ptsIdxLine] ?? 0),
                    wins: homeRec.wins,
                    losses: homeRec.losses
                },
                away: {
                    id: awayTeamId,
                    tricode: this.getTeamTricode(awayTeamId),
                    name: '',
                    score: Number(awayLine[ptsIdxLine] ?? 0),
                    wins: awayRec.wins,
                    losses: awayRec.losses
                },
                leaders: null
            };
        });
    }

    formatLeader(leader) {
        if (!leader) return null;

        // leader could be:
        // - an object with { name, points }
        // - { firstName, lastName, points }
        // - { playerName, pts } etc.
        // - could be an array (mock)
        if (Array.isArray(leader)) {
            leader = leader[0] || null;
            if (!leader) return null;
        }

        const name =
            leader.name ||
            ((leader.firstName || leader.lastName) ? `${leader.firstName || ''} ${leader.lastName || ''}`.trim() : null) ||
            leader.playerName ||
            leader.personFullName ||
            leader.player ||
            '';

        const pts = leader.points ?? leader.pts ?? leader.PTS ?? leader.pointsScored ?? null;

        const stat = pts != null ? `${pts} PTS` : (
            (typeof leader.stat === 'string' ? leader.stat : (Array.isArray(leader.stat) ? leader.stat.join(', ') : ''))
        );

        return {
            name: name || '',
            stat: stat || ''
        };
    }

    // Small team mapping for historical fallback - extend as needed.
    getTeamTricode(id) {
        const map = {
            // common examples (extend this map for completeness)
            1610612747: 'LAL',
            1610612738: 'BOS',
            1610612744: 'GSW',
            1610612756: 'PHX',
            1610612746: 'BKN',
            1610612741: 'CHI',
            1610612760: 'SAC'
        };

        // Some APIs return string ids — normalize to number where possible
        const parsed = Number(id);
        return map[parsed] || map[id] || 'NBA';
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
        if (logoEl) {
            // Use team.id to build a CDN logo url when present
            if (team?.id) {
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