class NBAApp {
    constructor() {
        this.currentDate = new Date();
        this.games = [];
        this.dom = {
            grid: document.getElementById('games-grid'),
            dateDisplay: document.getElementById('current-date'),
            datePicker: document.getElementById('date-picker'),
            prevBtn: document.getElementById('prev-day'),
            nextBtn: document.getElementById('next-day'),
            refreshBtn: document.getElementById('refresh-btn'),
            template: document.getElementById('game-card-template')
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadGames();

        // Auto-refresh every 30s if today
        setInterval(() => {
            if (this.isToday(this.currentDate)) {
                this.loadGames(true); // Silent refresh
            }
        }, 30000);
    }

    setupEventListeners() {
        this.dom.prevBtn.addEventListener('click', () => this.changeDate(-1));
        this.dom.nextBtn.addEventListener('click', () => this.changeDate(1));

        this.dom.refreshBtn.addEventListener('click', () => {
            this.dom.refreshBtn.classList.add('spinning');
            this.loadGames().finally(() => {
                setTimeout(() => this.dom.refreshBtn.classList.remove('spinning'), 500);
            });
        });

        this.dom.datePicker.addEventListener('change', (e) => {
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
            this.dom.grid.innerHTML = `
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Loading games...</p>
                </div>`;
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
        const displayDate = this.getDisplayDate(this.currentDate);
        this.dom.dateDisplay.textContent = this.isToday(this.currentDate) ? `Today, ${displayDate}` : displayDate;
        this.dom.datePicker.value = this.formatDate(this.currentDate);
    }

    async fetchLiveScoreboard() {
        // Use CDN for today's live data
        const response = await fetch('https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return this.normalizeLiveGames(data.scoreboard.games);
    }

    async fetchHistoricalScoreboard(dateStr) {
        // Use stats.nba.com via proxy for history
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
        return games.map(game => ({
            id: game.gameId,
            status: game.gameStatusText,
            statusCode: game.gameStatus, // 1: Not Started, 2: Live, 3: Final
            clock: game.gameStatus === 2 ? `Q${game.period} ${game.gameClock}` : game.gameStatusText,
            isLive: game.gameStatus === 2,
            home: {
                id: game.homeTeam.teamId,
                tricode: game.homeTeam.teamTricode,
                name: game.homeTeam.teamName,
                score: game.homeTeam.score,
                wins: game.homeTeam.wins,
                losses: game.homeTeam.losses
            },
            away: {
                id: game.awayTeam.teamId,
                tricode: game.awayTeam.teamTricode,
                name: game.awayTeam.teamName,
                score: game.awayTeam.score,
                wins: game.awayTeam.wins,
                losses: game.awayTeam.losses
            },
            leaders: game.gameLeaders ? {
                home: this.formatLeader(game.gameLeaders.homeLeaders),
                away: this.formatLeader(game.gameLeaders.awayLeaders)
            } : null
        }));
    }

    normalizeHistoricalGames(data) {
        // ScoreboardV2 returns ResultSets. 
        // Index 0: GameHeader, Index 1: LineScore
        const headers = data.resultSets[0].rowSet;
        const lineScores = data.resultSets[1].rowSet;

        return headers.map(row => {
            const gameId = row[2];
            const homeTeamId = row[6];
            const awayTeamId = row[7];

            // Find scores in LineScore
            const homeLine = lineScores.find(l => l[2] === gameId && l[3] === homeTeamId) || {};
            const awayLine = lineScores.find(l => l[2] === gameId && l[3] === awayTeamId) || {};

            return {
                id: gameId,
                status: row[4], // Game Status Text
                statusCode: row[4].includes('Final') ? 3 : 1, // Rough approximation
                clock: row[4],
                isLive: false,
                home: {
                    id: homeTeamId,
                    tricode: this.getTeamTricode(homeTeamId), // Helper needed or just use ID
                    name: '', // Historical API is sparse on names in header, might need mapping
                    score: homeLine[22] || 0, // PTS column usually
                    wins: row[8] ? parseInt(row[8].split('-')[0]) : 0, // Standings might be in row[8] e.g. "20-10"
                    losses: row[8] ? parseInt(row[8].split('-')[1]) : 0
                },
                away: {
                    id: awayTeamId,
                    tricode: this.getTeamTricode(awayTeamId),
                    name: '',
                    score: awayLine[22] || 0,
                    wins: row[9] ? parseInt(row[9].split('-')[0]) : 0,
                    losses: row[9] ? parseInt(row[9].split('-')[1]) : 0
                },
                leaders: null // Historical leaders harder to get from just scoreboardv2
            };
        });
    }

    formatLeader(leader) {
        if (!leader) return null;
        return {
            name: leader.name,
            stat: `${leader.points} PTS`
        };
    }

    // Helper to map ID to Tricode for historical games if needed
    // Simplified map for common teams
    getTeamTricode(id) {
        // Just return a placeholder or try to infer. 
        // For now, we'll fetch logos by ID which works globally.
        // Names might be missing for historical, let's fix that in render.
        return 'NBA';
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
                    home: { name: 'L. James', stat: ['28 PTS', '9 REB', '6 AST'] },
                    away: { name: 'J. Tatum', stat: ['34 PTS', '9 REB', '6 AST'] }
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
                    home: { name: 'S. Curry', stat: ['30 PTS', '9 REB', '6 AST'] },
                    away: { name: 'K. Durant', stat: ['25 PTS', '9 REB', '6 AST'] }
                }
            }
        ];
    }

    render() {
        this.dom.grid.innerHTML = '';

        if (this.games.length === 0) {
            this.dom.grid.innerHTML = `
                <div class="loading-state">
                    <p>No games scheduled for this date.</p>
                </div>`;
            return;
        }

        this.games.forEach(game => {
            const clone = this.dom.template.content.cloneNode(true);
            const card = clone.querySelector('.game-card');

            // Status
            const statusBadge = card.querySelector('.status-badge');
            statusBadge.textContent = game.isLive ? 'LIVE' : game.status;
            if (game.isLive) statusBadge.classList.add('live');
            card.querySelector('.game-clock').textContent = game.clock;

            // Teams
            this.renderTeam(card, '.home', game.home);
            this.renderTeam(card, '.visitor', game.away);

            // Winner highlight (if final)
            if (game.statusCode === 3) {
                if (game.home.score > game.away.score) {
                    card.querySelector('.home-team').classList.add('winner');
                } else {
                    card.querySelector('.visitor-team').classList.add('winner');
                }
            }

            // Leaders
            if (game.leaders) {
                if (game.leaders.home) {
                    card.querySelector('.home-leader .leader-name').textContent = this.shortenName(game.leaders.home.name);
                    card.querySelector('.home-leader .leader-stat').textContent = game.leaders.home.stat;
                }
                if (game.leaders.away) {
                    card.querySelector('.visitor-leader .leader-name').textContent = this.shortenName(game.leaders.away.name);
                    card.querySelector('.visitor-leader .leader-stat').textContent = game.leaders.away.stat;
                }
            } else {
                card.querySelector('.leaders').style.display = 'none';
            }

            this.dom.grid.appendChild(clone);
        });
    }

    renderTeam(card, prefix, team) {
        // Logo
        const logoUrl = `https://cdn.nba.com/logos/nba/${team.id}/global/L/logo.svg`;
        card.querySelector(`${prefix}-logo`).src = logoUrl;

        // Name (fallback if empty)
        const nameEl = card.querySelector(`${prefix}-name`);
        nameEl.textContent = team.name || team.tricode || 'Team';

        // Record
        card.querySelector(`${prefix}-record`).textContent =
            (team.wins !== undefined && team.losses !== undefined) ? `${team.wins}-${team.losses}` : '';

        // Score
        card.querySelector(`${prefix}-score`).textContent = team.score;
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
    new NBAApp();
});
