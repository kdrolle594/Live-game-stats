// Stat categories shown as leaders, in display order
const LEADER_CATS = [
    { key: 'PTS', label: 'Points' },
    { key: 'REB', label: 'Rebounds' },
    { key: 'AST', label: 'Assists' },
    { key: 'STL', label: 'Steals' },
    { key: 'BLK', label: 'Blocks' }
];

// Team stats compared in the box score dialog (ESPN stat name -> label)
const TEAM_STATS = [
    { name: 'fieldGoalPct', label: 'Field goal %' },
    { name: 'threePointFieldGoalPct', label: '3-point %' },
    { name: 'freeThrowPct', label: 'Free throw %' },
    { name: 'totalRebounds', label: 'Rebounds' },
    { name: 'assists', label: 'Assists' },
    { name: 'steals', label: 'Steals' },
    { name: 'blocks', label: 'Blocks' },
    { name: 'turnovers', label: 'Turnovers', lowerIsBetter: true },
    { name: 'pointsInPaint', label: 'Points in paint' },
    { name: 'fastBreakPoints', label: 'Fast break points' }
];

const ESPN_BASE = 'http://site.api.espn.com/apis/site/v2/sports/basketball/nba';
// Same athlete API on two hosts; site.api is the one the scoreboard already uses
const ESPN_ATHLETE_HOSTS = [
    'https://site.api.espn.com/apis/common/v3/sports/basketball/nba/athletes',
    'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes'
];

// Season table columns: label shown -> ESPN stat labels to look for
const SEASON_COLS = [
    { label: 'GP', keys: ['GP'] },
    { label: 'MIN', keys: ['MIN'] },
    { label: 'PTS', keys: ['PTS'] },
    { label: 'REB', keys: ['REB'] },
    { label: 'AST', keys: ['AST'] },
    { label: 'STL', keys: ['STL'] },
    { label: 'BLK', keys: ['BLK'] },
    { label: 'FG%', keys: ['FG%'] },
    { label: '3P%', keys: ['3P%', '3PT%'] },
    { label: 'FT%', keys: ['FT%'] }
];

// NBA champion per season (season end year -> ESPN team id).
// ESPN team ids follow the franchise through moves (e.g. Seattle -> OKC is 25).
// Add a line each June after the Finals.
const CHAMPIONS = {
    1950: 13, 1951: 23, 1952: 13, 1953: 13, 1954: 13, 1955: 20, 1956: 9, 1957: 2, 1958: 1, 1959: 2,
    1960: 2, 1961: 2, 1962: 2, 1963: 2, 1964: 2, 1965: 2, 1966: 2, 1967: 20, 1968: 2, 1969: 2,
    1970: 18, 1971: 15, 1972: 13, 1973: 18, 1974: 2, 1975: 9, 1976: 2, 1977: 22, 1978: 27, 1979: 25,
    1980: 13, 1981: 2, 1982: 13, 1983: 20, 1984: 2, 1985: 13, 1986: 2, 1987: 13, 1988: 13, 1989: 8,
    1990: 8, 1991: 4, 1992: 4, 1993: 4, 1994: 10, 1995: 10, 1996: 4, 1997: 4, 1998: 4, 1999: 24,
    2000: 13, 2001: 13, 2002: 13, 2003: 24, 2004: 8, 2005: 24, 2006: 14, 2007: 24, 2008: 2, 2009: 13,
    2010: 13, 2011: 6, 2012: 14, 2013: 14, 2014: 24, 2015: 9, 2016: 5, 2017: 9, 2018: 9, 2019: 28,
    2020: 13, 2021: 15, 2022: 9, 2023: 7, 2024: 2, 2025: 25, 2026: 18
};

// Awards shown on the player card, most prestigious first.
// Matched against ESPN award names; anything unmatched is dropped.
const AWARDS = [
    { label: 'MVP', test: /^(nba )?(most valuable player|mvp)$/i },
    { label: 'Champion', test: /^(nba )?champion/i },
    { label: 'Finals MVP', test: /^(nba )?finals mvp$/i },
    { label: 'DPOY', test: /defensive player of the year/i },
    { label: 'All-NBA 1st', test: /all-nba (1st|first)/i },
    { label: 'All-NBA 2nd', test: /all-nba (2nd|second)/i },
    { label: 'All-NBA 3rd', test: /all-nba (3rd|third)/i },
    { label: 'All-NBA', test: /^all-nba/i },
    { label: 'All-Defensive 1st', test: /all-defensive (1st|first)/i },
    { label: 'All-Defensive 2nd', test: /all-defensive (2nd|second)/i },
    { label: 'All-Defensive', test: /^all-defensive/i },
    { label: 'All-Star', test: /^(nba )?all-star( selection)?$/i },
    { label: 'Rookie of the Year', test: /rookie of the year/i },
    { label: 'Most Improved', test: /most improved/i },
    { label: 'Sixth Man', test: /sixth man/i },
    { label: 'Clutch Player', test: /clutch player/i },
    { label: 'All-Star MVP', test: /all-star (game )?mvp/i },
    { label: 'Conf. Finals MVP', test: /conference finals mvp/i },
    { label: 'All-Rookie 1st', test: /all-rookie (1st|first)/i },
    { label: 'All-Rookie 2nd', test: /all-rookie (2nd|second)/i }
];

class NBAApp {
    constructor() {
        this.currentDate = new Date();
        this.games = [];
        this.openGameId = null;
        this.refreshIntervalId = null;
        this.openPlayerId = null;
        this.playerCache = new Map();
        this.liveProxyBase = 'https://winter-sky-692e.kdrolle594.workers.dev/?url=';

        this.dom = {
            grid: document.getElementById('games-grid'),
            gamesCount: document.getElementById('games-count'),
            topSection: document.getElementById('top-performers'),
            topList: document.getElementById('top-list'),
            dateDisplay: document.getElementById('current-date'),
            datePicker: document.getElementById('date-picker'),
            prevBtn: document.getElementById('prev-day'),
            nextBtn: document.getElementById('next-day'),
            todayBtn: document.getElementById('today-btn'),
            refreshBtn: document.getElementById('refresh-btn'),
            template: document.getElementById('game-card-template'),
            dialog: document.getElementById('game-dialog'),
            dialogTitle: document.getElementById('dialog-title'),
            dialogBody: document.getElementById('dialog-body'),
            playerDialog: document.getElementById('player-dialog'),
            playerBody: document.getElementById('player-body')
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupInstall();
        this.loadGames();

        // Auto-refresh every 30s if viewing today
        this.refreshIntervalId = setInterval(() => {
            if (this.isToday(this.currentDate)) {
                this.loadGames(true); // silent refresh
            }
        }, 30000);
    }

    setupEventListeners() {
        const { prevBtn, nextBtn, todayBtn, refreshBtn, datePicker, dialog, grid } = this.dom;

        prevBtn?.addEventListener('click', () => this.changeDate(-1));
        nextBtn?.addEventListener('click', () => this.changeDate(1));
        todayBtn?.addEventListener('click', () => {
            this.currentDate = new Date();
            this.loadGames();
        });

        refreshBtn?.addEventListener('click', () => {
            refreshBtn.classList.add('spinning');
            this.loadGames().finally(() => {
                setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
            });
        });

        datePicker?.addEventListener('change', (e) => {
            if (e.target.value) {
                // Noon avoids timezone shifts moving the date
                this.currentDate = new Date(e.target.value + 'T12:00:00');
                this.loadGames();
            }
        });

        grid?.addEventListener('click', (e) => {
            const btn = e.target.closest('.card-open');
            if (btn) this.openGame(btn.dataset.gameId);
        });

        dialog?.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
        // Close when clicking the backdrop
        dialog?.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.close();
        });
        dialog?.addEventListener('close', () => { this.openGameId = null; });

        // Player names in the box score open the player card
        this.dom.dialogBody?.addEventListener('click', (e) => {
            const btn = e.target.closest('.pname-btn');
            if (btn) this.openPlayerCard(btn.dataset.playerId, this.openGameId, btn.dataset.side);
        });

        const playerDialog = this.dom.playerDialog;
        playerDialog?.querySelector('.dialog-close')?.addEventListener('click', () => playerDialog.close());
        playerDialog?.addEventListener('click', (e) => {
            if (e.target === playerDialog) playerDialog.close();
        });
        playerDialog?.addEventListener('close', () => { this.openPlayerId = null; });
    }

    changeDate(days) {
        this.currentDate.setDate(this.currentDate.getDate() + days);
        this.loadGames();
    }

    // Local YYYY-MM-DD (toISOString would use UTC and can shift the day)
    formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    getDisplayDate(date) {
        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    isToday(date) {
        return this.formatDate(date) === this.formatDate(new Date());
    }

    proxied(url) {
        return `${this.liveProxyBase}${encodeURIComponent(url)}`;
    }

    async loadGames(silent = false) {
        if (!silent) {
            this.updateDateDisplay();
            if (this.dom.grid) {
                this.dom.grid.innerHTML = `
                    <div class="loading-state">
                        <div class="spinner"></div>
                        <p>Loading games…</p>
                    </div>`;
            }
            if (this.dom.topSection) this.dom.topSection.hidden = true;
        }

        try {
            const games = await this.fetchScoreboard(this.formatDate(this.currentDate));
            await this.attachBoxScores(games, silent ? this.games : []);
            this.games = games;
        } catch (error) {
            console.error('Error loading games:', error);
            this.games = this.getMockData();
            this.showToast(navigator.onLine === false
                ? 'You’re offline. Showing sample games until you reconnect.'
                : 'Couldn’t reach the score service. Showing sample games.');
        }
        this.render();
    }

    updateDateDisplay() {
        if (!this.dom.dateDisplay || !this.dom.datePicker) return;
        const displayDate = this.getDisplayDate(this.currentDate);
        const today = this.isToday(this.currentDate);
        this.dom.dateDisplay.textContent = today ? `Today, ${displayDate}` : displayDate;
        this.dom.datePicker.value = this.formatDate(this.currentDate);
        if (this.dom.todayBtn) this.dom.todayBtn.hidden = today;
    }

    async fetchScoreboard(dateStr) {
        const url = `${ESPN_BASE}/scoreboard?dates=${dateStr.replace(/-/g, '')}`;
        const response = await fetch(this.proxied(url));
        if (!response.ok) throw new Error(`Scoreboard request failed (${response.status})`);
        return this.normalizeESPNGames(await response.json());
    }

    // Box scores give STL/BLK leaders, team stats and player lines.
    // On a silent refresh, finished games keep their previous box score.
    async attachBoxScores(games, previous) {
        const prevById = new Map(previous.map(g => [g.id, g]));
        await Promise.all(games.map(async game => {
            if (game.state === 'pre') return;
            const prev = prevById.get(game.id);
            if (prev?.box && game.state === 'post' && prev.state === 'post') {
                Object.assign(game, { box: prev.box, teamStats: prev.teamStats, leaders: prev.leaders });
                return;
            }
            try {
                const response = await fetch(this.proxied(`${ESPN_BASE}/summary?event=${game.id}`));
                if (!response.ok) throw new Error(`Summary request failed (${response.status})`);
                this.applySummary(game, await response.json());
            } catch (e) {
                console.warn(`Box score unavailable for game ${game.id}`, e);
            }
        }));
    }

    normalizeESPNGames(data) {
        if (!data || !Array.isArray(data.events)) return [];

        return data.events.map(event => {
            const comp = event.competitions[0];
            const home = comp.competitors.find(c => c.homeAway === 'home');
            const away = comp.competitors.find(c => c.homeAway === 'away');
            const status = event.status.type;

            return {
                id: event.id,
                state: status.state, // 'pre' | 'in' | 'post'
                statusText: status.shortDetail, // e.g. "Final", "Q4 2:30", "7:30 PM ET"
                isLive: status.state === 'in',
                startTime: event.date,
                home: this.normalizeTeam(home),
                away: this.normalizeTeam(away),
                // Scoreboard only has PTS/REB/AST; the box score replaces these when it loads
                leaders: this.scoreboardLeaders(home, away),
                teamStats: null,
                box: null
            };
        });
    }

    normalizeTeam(competitor) {
        const team = competitor.team;
        return {
            id: team.id,
            abbr: team.abbreviation,
            name: team.shortDisplayName || team.name,
            logo: team.logo || team.logos?.[0]?.href || '',
            color: team.color ? `#${team.color}` : null,
            record: competitor.records?.[0]?.summary || '',
            score: competitor.score !== undefined && competitor.score !== '' ? Number(competitor.score) : null
        };
    }

    scoreboardLeaders(home, away) {
        const map = { points: 'PTS', rebounds: 'REB', assists: 'AST' };
        const leaders = {};
        for (const side of ['home', 'away']) {
            const competitor = side === 'home' ? home : away;
            for (const cat of competitor.leaders || []) {
                const key = map[cat.name];
                const top = cat.leaders?.[0];
                if (!key || !top?.athlete) continue;
                leaders[key] = leaders[key] || {};
                leaders[key][side] = {
                    id: top.athlete.id,
                    name: top.athlete.shortName || top.athlete.displayName,
                    headshot: top.athlete.headshot,
                    value: Number(top.value ?? top.displayValue) || 0
                };
            }
        }
        return Object.keys(leaders).length ? leaders : null;
    }

    applySummary(game, summary) {
        const box = { home: [], away: [] };
        for (const teamBlock of summary?.boxscore?.players || []) {
            const side = teamBlock.team.id === game.home.id ? 'home' : 'away';
            const stats = teamBlock.statistics?.[0];
            if (!stats) continue;
            const labels = stats.labels || stats.names || [];
            box[side] = (stats.athletes || [])
                .filter(a => !a.didNotPlay && a.stats?.length)
                .map(a => {
                    const line = {};
                    labels.forEach((label, i) => { line[label] = a.stats[i]; });
                    return {
                        id: a.athlete.id,
                        name: a.athlete.displayName,
                        shortName: a.athlete.shortName,
                        position: a.athlete.position?.abbreviation || '',
                        jersey: a.athlete.jersey || '',
                        headshot: a.athlete.headshot?.href,
                        starter: !!a.starter,
                        line
                    };
                });
        }

        if (box.home.length || box.away.length) {
            game.box = box;
            game.leaders = this.boxLeaders(box);
        }

        const teamStats = { home: {}, away: {} };
        for (const teamBlock of summary?.boxscore?.teams || []) {
            const side = teamBlock.team.id === game.home.id ? 'home' : 'away';
            for (const s of teamBlock.statistics || []) teamStats[side][s.name] = s.displayValue;
        }
        if (Object.keys(teamStats.home).length) game.teamStats = teamStats;
    }

    boxLeaders(box) {
        const leaders = {};
        for (const { key } of LEADER_CATS) {
            leaders[key] = {};
            for (const side of ['home', 'away']) {
                let best = null;
                for (const p of box[side]) {
                    const value = Number(p.line[key]) || 0;
                    if (!best || value > best.value) {
                        best = { id: p.id, name: p.shortName || p.name, headshot: p.headshot, value };
                    }
                }
                if (best) leaders[key][side] = best;
            }
        }
        return leaders;
    }

    // Best single-game line per category across every game on the date
    nightlyTop() {
        return LEADER_CATS.map(cat => {
            let best = null;
            for (const game of this.games) {
                const row = game.leaders?.[cat.key];
                if (!row) continue;
                for (const side of ['home', 'away']) {
                    const p = row[side];
                    if (p && p.value > 0 && (!best || p.value > best.value)) {
                        best = { ...p, team: game[side] };
                    }
                }
            }
            return { ...cat, best };
        }).filter(c => c.best);
    }

    headshotUrl(player) {
        if (typeof player.headshot === 'string') return player.headshot;
        if (player.headshot?.href) return player.headshot.href;
        return player.id ? `https://a.espncdn.com/i/headshots/nba/players/full/${player.id}.png` : '';
    }

    render() {
        if (!this.dom.grid || !this.dom.template) return;

        this.renderTopPerformers();
        this.dom.grid.innerHTML = '';
        if (this.dom.gamesCount) {
            this.dom.gamesCount.textContent = this.games.length ? String(this.games.length) : '';
        }

        if (!Array.isArray(this.games) || this.games.length === 0) {
            this.dom.grid.innerHTML = `
                <div class="loading-state">
                    <p>No games on this date. Use the arrows to find the next game day.</p>
                </div>`;
            return;
        }

        // Live first, then upcoming, then finals
        const order = { in: 0, pre: 1, post: 2 };
        const sorted = [...this.games].sort((a, b) => order[a.state] - order[b.state]);
        sorted.forEach(game => this.dom.grid.appendChild(this.renderCard(game)));

        // Keep an open box score in sync with refreshed data
        if (this.openGameId && this.dom.dialog?.open) this.renderDialog(this.openGameId);
    }

    renderTopPerformers() {
        const { topSection, topList } = this.dom;
        if (!topSection || !topList) return;
        const top = this.nightlyTop();
        topSection.hidden = top.length === 0;
        topList.innerHTML = '';

        for (const cat of top) {
            const p = cat.best;
            const li = document.createElement('li');
            li.className = 'top-item';
            if (p.team.color) li.style.setProperty('--team', p.team.color);
            li.innerHTML = `
                <span class="top-value">${p.value}</span>
                <span class="top-cat">${cat.label}</span>
                <span class="top-player">
                    <img class="top-headshot" src="${this.headshotUrl(p)}" alt="" loading="lazy">
                    <span class="top-who">
                        <span class="top-name">${this.escape(p.name)}</span>
                        <span class="top-team">${this.escape(p.team.abbr || '')}</span>
                    </span>
                </span>`;
            this.hideBrokenImage(li.querySelector('img'));
            topList.appendChild(li);
        }
    }

    renderCard(game) {
        const clone = this.dom.template.content.cloneNode(true);
        const card = clone.querySelector('.game-card');

        card.classList.toggle('is-live', game.isLive);
        if (game.away.color) card.style.setProperty('--away', game.away.color);
        if (game.home.color) card.style.setProperty('--home', game.home.color);

        const badge = card.querySelector('.status-badge');
        badge.textContent = game.isLive ? 'Live' : (game.state === 'post' ? 'Final' : 'Upcoming');
        badge.classList.add(`state-${game.state}`);

        const clock = card.querySelector('.game-clock');
        clock.textContent = game.state === 'pre' ? this.tipTime(game) : (game.isLive ? game.statusText : '');

        this.renderTeam(card, 'home', game.home, game);
        this.renderTeam(card, 'away', game.away, game);
        this.renderLeaders(card.querySelector('.leaders'), game);

        const open = card.querySelector('.card-open');
        if (game.state === 'pre') {
            open.remove();
        } else {
            open.dataset.gameId = game.id;
            open.setAttribute('aria-label', `Box score: ${game.away.name} at ${game.home.name}`);
        }
        return clone;
    }

    tipTime(game) {
        if (!game.startTime) return game.statusText || '';
        return new Date(game.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    renderTeam(card, side, team, game) {
        const logoEl = card.querySelector(`.${side}-logo`);
        const nameEl = card.querySelector(`.${side}-name`);
        const recordEl = card.querySelector(`.${side}-record`);
        const scoreEl = card.querySelector(`.${side}-score`);
        const teamEl = card.querySelector(`.${side}-team`);

        if (team.logo) {
            logoEl.src = team.logo;
            this.hideBrokenImage(logoEl);
        } else {
            logoEl.remove();
        }
        nameEl.textContent = team.name || team.abbr || 'Team';
        recordEl.textContent = team.record || '';
        scoreEl.textContent = game.state !== 'pre' && team.score !== null ? String(team.score) : '';

        if (game.state !== 'pre') {
            const other = side === 'home' ? game.away : game.home;
            teamEl.classList.toggle('leading', (team.score || 0) > (other.score || 0));
        }
    }

    renderLeaders(container, game) {
        const cats = LEADER_CATS.filter(c => game.leaders?.[c.key]);
        if (!cats.length) {
            container.innerHTML = `<p class="leaders-empty">${game.state === 'pre'
                ? 'Leaders show up after tip-off.'
                : 'Leaders aren’t available for this game yet.'}</p>`;
            return;
        }

        container.innerHTML = cats.map(cat => {
            const row = game.leaders[cat.key];
            const a = row.away;
            const h = row.home;
            const aWins = a && (!h || a.value > h.value);
            const hWins = h && (!a || h.value > a.value);
            return `
                <div class="leader-row">
                    <span class="leader away-leader ${aWins ? 'tops' : ''}">
                        <span class="leader-name">${a ? this.escape(a.name) : '–'}</span>
                        <span class="leader-value">${a ? a.value : ''}</span>
                    </span>
                    <abbr class="leader-cat" title="${cat.label}">${cat.key}</abbr>
                    <span class="leader home-leader ${hWins ? 'tops' : ''}">
                        <span class="leader-value">${h ? h.value : ''}</span>
                        <span class="leader-name">${h ? this.escape(h.name) : '–'}</span>
                    </span>
                </div>`;
        }).join('');
    }

    openGame(id) {
        if (!this.dom.dialog) return;
        this.openGameId = id;
        this.renderDialog(id);
        if (!this.dom.dialog.open) this.dom.dialog.showModal();
    }

    renderDialog(id) {
        const game = this.games.find(g => g.id === id);
        if (!game) return;
        const { dialogTitle, dialogBody } = this.dom;

        dialogTitle.textContent = `${game.away.name} ${game.away.score ?? ''} – ${game.home.score ?? ''} ${game.home.name}`;

        const status = `<p class="dialog-status">${game.isLive ? `<span class="live-dot"></span>${this.escape(game.statusText)}` : this.escape(game.statusText || '')}</p>`;

        if (!game.box) {
            dialogBody.innerHTML = `${status}<p class="leaders-empty">The box score isn’t available yet. It updates every 30 seconds during live games.</p>`;
            return;
        }

        dialogBody.innerHTML = status + this.teamStatsHtml(game) + this.boxTableHtml(game, 'away') + this.boxTableHtml(game, 'home');
    }

    teamStatsHtml(game) {
        if (!game.teamStats) return '';
        const rows = TEAM_STATS.map(stat => {
            const a = game.teamStats.away[stat.name];
            const h = game.teamStats.home[stat.name];
            if (a === undefined || h === undefined) return '';
            const av = parseFloat(a) || 0;
            const hv = parseFloat(h) || 0;
            const total = av + hv || 1;
            const better = av === hv ? null : ((av > hv) !== !!stat.lowerIsBetter ? 'away' : 'home');
            return `
                <div class="tstat">
                    <span class="tstat-val ${better === 'away' ? 'tops' : ''}">${this.escape(a)}</span>
                    <span class="tstat-label">${stat.label}</span>
                    <span class="tstat-val ${better === 'home' ? 'tops' : ''}">${this.escape(h)}</span>
                    <span class="tstat-bar" aria-hidden="true">
                        <span class="bar-away" style="width:${(av / total) * 100}%"></span>
                        <span class="bar-home" style="width:${(hv / total) * 100}%"></span>
                    </span>
                </div>`;
        }).join('');
        if (!rows.trim()) return '';
        return `
            <section class="team-stats" style="${game.away.color ? `--away:${game.away.color};` : ''}${game.home.color ? `--home:${game.home.color};` : ''}">
                <h3 class="tstat-head"><span>${this.escape(game.away.abbr)}</span><span>Team stats</span><span>${this.escape(game.home.abbr)}</span></h3>
                ${rows}
            </section>`;
    }

    boxTableHtml(game, side) {
        const players = game.box[side];
        if (!players.length) return '';
        const cols = ['MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG', '3PT', 'FT', 'TO', '+/-'];
        const leaders = game.leaders || {};

        const body = players.map(p => `
            <tr class="${p.starter ? 'starter' : ''}">
                <th scope="row"><button type="button" class="pname pname-btn" data-player-id="${this.escape(p.id)}" data-side="${side}" aria-label="View ${this.escape(p.name)} stat card">${this.escape(p.shortName || p.name)}</button><span class="ppos">${this.escape(p.position)}</span></th>
                ${cols.map(c => {
                    const v = p.line[c] ?? '';
                    const lead = leaders[c]?.[side];
                    const isLead = lead && lead.id === p.id && lead.value > 0;
                    return `<td class="${isLead ? 'tops' : ''}">${this.escape(String(v))}</td>`;
                }).join('')}
            </tr>`).join('');

        return `
            <section class="box">
                <h3 class="box-title">${this.escape(game[side].name)}</h3>
                <div class="table-scroll" tabindex="0" aria-label="${this.escape(game[side].name)} box score">
                    <table>
                        <thead><tr><th scope="col">Player</th>${cols.map(c => `<th scope="col">${c}</th>`).join('')}</tr></thead>
                        <tbody>${body}</tbody>
                    </table>
                </div>
            </section>`;
    }

    // ---------- Player stat card ----------

    async openPlayerCard(playerId, gameId, side) {
        const game = this.games.find(g => g.id === gameId);
        const player = game?.box?.[side]?.find(p => String(p.id) === String(playerId));
        const { playerDialog, playerBody } = this.dom;
        if (!player || !playerDialog) return;

        const team = game[side];
        this.openPlayerId = player.id;
        playerDialog.style.setProperty('--team', team.color || 'var(--panel-2)');
        playerBody.innerHTML = this.playerCardHtml(player, team, null);
        this.hideBrokenImage(playerBody.querySelector('.pc-photo'));
        if (!playerDialog.open) playerDialog.showModal();

        const data = await this.loadPlayerData(player.id);
        // Ignore if the user closed or switched players while loading
        if (this.openPlayerId !== player.id) return;
        playerBody.innerHTML = this.playerCardHtml(player, team, data);
        this.hideBrokenImage(playerBody.querySelector('.pc-photo'));
    }

    // Stats and awards load separately so one failing doesn't block the other
    loadPlayerData(id) {
        if (!this.playerCache.has(id)) {
            const job = Promise.all([
                this.fetchPlayerStats(id).catch(err => { console.error('Player stats', err); return { error: err.message }; }),
                this.fetchPlayerAwards(id).catch(err => { console.error('Player awards', err); return { error: err.message }; })
            ]).then(([stats, awards]) => {
                // Don't cache failures, so reopening retries
                if (stats.error || awards.error) this.playerCache.delete(id);
                return { stats, awards };
            });
            this.playerCache.set(id, job);
        }
        return this.playerCache.get(id);
    }

    // Try the worker proxy first, then ESPN directly (these ESPN APIs allow
    // browser requests). Throws with both reasons if neither works.
    async fetchJson(url) {
        url = url.replace(/^http:\/\//, 'https://');
        const attempt = async (target, via) => {
            try {
                const res = await fetch(target);
                if (!res.ok) return { reason: `${via}: HTTP ${res.status}` };
                return { data: await res.json() };
            } catch (err) {
                return { reason: `${via}: ${err.message}` };
            }
        };
        const proxied = await attempt(this.proxied(url), 'proxy');
        if ('data' in proxied) return proxied.data;
        const direct = await attempt(url, 'direct');
        if ('data' in direct) return direct.data;
        throw new Error(`${proxied.reason}; ${direct.reason}`);
    }

    // Fetch an athlete path from the first ESPN host that answers
    async fetchAthlete(id, path) {
        const reasons = [];
        for (const host of ESPN_ATHLETE_HOSTS) {
            try {
                return await this.fetchJson(`${host}/${id}/${path}`);
            } catch (err) {
                reasons.push(err.message);
            }
        }
        throw new Error(reasons.join('; '));
    }

    async fetchPlayerStats(id) {
        return this.parseSeasons(await this.fetchAthlete(id, 'stats'));
    }

    // ESPN shape: categories[] with labels[] and statistics[] (one per season),
    // plus totals[] holding career values. We want the per-game "averages" category.
    parseSeasons(data) {
        const cats = data?.categories || [];
        const cat = cats.find(c => c.name === 'averages')
            || cats.find(c => /average/i.test(c.displayName || ''))
            || cats[0];
        if (!cat) return { seasons: [], career: null };

        const labels = cat.labels || cat.names || [];
        const teams = data.teams || {};
        const pick = (values) => {
            const row = {};
            for (const col of SEASON_COLS) {
                const i = labels.findIndex(l => col.keys.includes(l));
                row[col.label] = i >= 0 ? values?.[i] ?? '' : '';
            }
            return row;
        };

        // ESPN keys teams by slug (e.g. "golden-state-warriors"); match by slug or id
        const teamList = Object.values(teams);
        const seasons = (cat.statistics || []).map(s => {
            const t = teams[s.teamSlug] || teams[s.teamId]
                || teamList.find(x => String(x.id) === String(s.teamId)) || {};
            return {
                year: s.season?.year ?? 0,
                season: s.season?.displayName || String(s.season?.year || ''),
                team: t.abbreviation || '',
                stats: pick(s.stats)
            };
        }).sort((a, b) => b.year - a.year);

        const career = cat.totals?.length ? pick(cat.totals) : null;
        return { seasons, career };
    }

    // ESPN bio lists awards already counted: { name, league, displayCount: "5x", seasons: ["2025", ...] }
    // It often misses titles, so championships are also worked out from playoff stats.
    async fetchPlayerAwards(id) {
        const [bio, playoffs] = await Promise.all([
            this.fetchAthlete(id, 'bio'),
            this.fetchAthlete(id, 'stats?seasontype=3').catch(err => {
                console.error('Player playoff stats', err);
                return null;
            })
        ]);
        const isTitle = a => /^(nba )?champion/i.test(a.name || '');
        const awards = (bio?.awards || []).filter(a => !isTitle(a));
        const titleYears = new Set((bio?.awards || []).filter(isTitle).flatMap(a => (a.seasons || []).map(Number)));
        for (const year of this.championshipYears(playoffs)) titleYears.add(year);
        if (titleYears.size) {
            awards.push({ name: 'NBA Champion', league: 'nba', displayCount: `${titleYears.size}x`, seasons: [...titleYears] });
        }
        return this.groupAwards(awards);
    }

    // Seasons where the player appeared in the playoffs for that year's champion
    championshipYears(playoffs) {
        const years = [];
        for (const cat of playoffs?.categories || []) {
            for (const s of cat.statistics || []) {
                const year = s.season?.year;
                if (year && CHAMPIONS[year] === Number(s.teamId)) years.push(year);
            }
        }
        return [...new Set(years)];
    }

    // Group raw awards into { label, count, years } in prestige order
    groupAwards(awards) {
        const groups = new Map();
        for (const a of awards) {
            if (a.league && a.league !== 'nba') continue; // skip college awards
            const name = a.name || '';
            if (/runner-up|runner up|finalist/i.test(name)) continue;
            const match = AWARDS.find(def => def.test.test(name));
            if (!match) continue;
            const years = (a.seasons || []).map(Number).filter(Boolean);
            const count = parseInt(a.displayCount, 10) || years.length || 1;
            const g = groups.get(match.label) || { label: match.label, count: 0, years: [] };
            g.count += count;
            g.years.push(...years);
            groups.set(match.label, g);
        }
        const order = AWARDS.map(d => d.label);
        return [...groups.values()].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
    }

    // Season as "2025-26" from an end year
    seasonLabel(year) {
        return `${year - 1}-${String(year).slice(-2)}`;
    }

    playerCardHtml(player, team, data) {
        const photo = this.headshotUrl(player);
        const initials = (player.name || '').split(' ').map(w => w[0]).join('').slice(0, 2);
        const meta = [team.name, player.position, player.jersey ? `#${player.jersey}` : ''].filter(Boolean);

        const head = `
            <header class="pc-head">
                <div class="pc-photo-wrap" data-initials="${this.escape(initials)}">
                    ${photo ? `<img class="pc-photo" src="${this.escape(photo)}" alt="${this.escape(player.name)}">` : ''}
                </div>
                <div class="pc-id">
                    <h2 id="player-title" class="pc-name">${this.escape(player.name)}</h2>
                    <p class="pc-meta">${meta.map(m => `<span>${this.escape(m)}</span>`).join('')}</p>
                </div>
            </header>`;

        if (!data) {
            return `${head}
                <div class="pc-body" aria-busy="true">
                    <div class="pc-banners pc-skeleton">${'<span class="pc-banner"></span>'.repeat(4)}</div>
                    <div class="pc-skeleton pc-skel-table"></div>
                </div>`;
        }

        return `${head}
            <div class="pc-body">
                ${this.awardsHtml(data.awards)}
                ${this.seasonsHtml(data.stats)}
            </div>`;
    }

    awardsHtml(awards) {
        if (awards.error) {
            return `<p class="pc-error">Accolades didn’t load (${this.escape(awards.error)}). Close the card and open it again to retry.</p>`;
        }
        if (!awards.length) return '';
        const banners = awards.map(a => {
            const years = a.years.sort((x, y) => x - y).map(y => this.seasonLabel(y)).join(', ');
            return `
                <li class="pc-banner${a.label === 'MVP' || a.label === 'Champion' ? ' gold' : ''}" ${years ? `title="${this.escape(years)}"` : ''}>
                    <span class="pc-count">${a.count}×</span>
                    <span class="pc-award">${this.escape(a.label)}</span>
                </li>`;
        }).join('');
        return `
            <section aria-labelledby="pc-awards-title">
                <h3 id="pc-awards-title" class="pc-section">Accolades</h3>
                <ul class="pc-banners">${banners}</ul>
            </section>`;
    }

    seasonsHtml(stats) {
        if (stats.error) {
            return `<p class="pc-error">Season stats didn’t load (${this.escape(stats.error)}). Close the card and open it again to retry.</p>`;
        }
        if (!stats.seasons.length) {
            return `<p class="pc-error">No season stats yet for this player.</p>`;
        }
        const cell = (v) => `<td>${this.escape(String(v ?? ''))}</td>`;
        const rows = stats.seasons.map((s, i) => `
            <tr class="${i === 0 ? 'pc-current' : ''}">
                <th scope="row">${this.escape(s.season)}${s.team ? `<span class="ppos">${this.escape(s.team)}</span>` : ''}</th>
                ${SEASON_COLS.map(c => cell(s.stats[c.label])).join('')}
            </tr>`).join('');
        const career = stats.career ? `
            <tfoot><tr class="pc-career">
                <th scope="row">Career</th>
                ${SEASON_COLS.map(c => cell(stats.career[c.label])).join('')}
            </tr></tfoot>` : '';
        return `
            <section aria-labelledby="pc-seasons-title">
                <h3 id="pc-seasons-title" class="pc-section">Per-game averages</h3>
                <div class="table-scroll pc-table" tabindex="0" aria-label="Season averages">
                    <table>
                        <thead><tr><th scope="col">Season</th>${SEASON_COLS.map(c => `<th scope="col">${c.label}</th>`).join('')}</tr></thead>
                        <tbody>${rows}</tbody>
                        ${career}
                    </table>
                </div>
            </section>`;
    }

    // Install button: browsers don't reliably show their own install prompt
    // (iPhone never does), so offer one in the header.
    setupInstall() {
        const btn = document.getElementById('install-btn');
        if (!btn) return;

        const installed = window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
        if (installed) return;

        // iPhone/iPad Safari: no install API, show the manual steps instead
        const ua = navigator.userAgent;
        const isIOS = /iphone|ipad|ipod/i.test(ua)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (isIOS) {
            btn.hidden = false;
            btn.addEventListener('click', () => {
                this.showToast('To install: tap the Share button, then “Add to Home Screen”.', 'info', 8000);
            });
            return;
        }

        // Chrome, Edge, Android: use the browser's install dialog
        const show = () => { btn.hidden = !deferredInstallPrompt; };
        show();
        window.addEventListener('installpromptready', show);
        btn.addEventListener('click', async () => {
            if (!deferredInstallPrompt) return;
            deferredInstallPrompt.prompt();
            await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
            show();
        });
        window.addEventListener('appinstalled', () => {
            deferredInstallPrompt = null;
            show();
            this.showToast('Installed. Open NBA Live Hub from your home screen or apps.', 'info');
        });
    }

    showToast(message, tone = 'error', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = tone === 'info' ? 'toast info' : 'toast';
        toast.setAttribute('role', 'status');
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }

    hideBrokenImage(img) {
        img?.addEventListener('error', () => { img.style.visibility = 'hidden'; }, { once: true });
    }

    escape(str) {
        return String(str ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    // Sample data in the same shape as live data, used when the network is blocked
    getMockData() {
        const player = (id, name, shortName, position, starter, s) => ({
            id, name, shortName, position, starter, headshot: null,
            line: {
                MIN: s[0], PTS: s[1], REB: s[2], AST: s[3], STL: s[4], BLK: s[5],
                FG: s[6], '3PT': s[7], FT: s[8], TO: s[9], '+/-': s[10]
            }
        });
        const team = (id, abbr, name, color, record, score) => ({
            id, abbr, name, color, record, score,
            logo: `https://a.espncdn.com/i/teamlogos/nba/500/${abbr.toLowerCase()}.png`
        });
        const teamStats = (fg, three, ft, reb, ast, stl, blk, to, paint, fb) => ({
            fieldGoalPct: fg, threePointFieldGoalPct: three, freeThrowPct: ft, totalRebounds: reb,
            assists: ast, steals: stl, blocks: blk, turnovers: to, pointsInPaint: paint, fastBreakPoints: fb
        });

        const games = [
            {
                id: 'mock-1', state: 'post', statusText: 'Final', isLive: false, startTime: null,
                away: team('2', 'BOS', 'Celtics', '#007A33', '32-10', 109),
                home: team('13', 'LAL', 'Lakers', '#552583', '20-21', 112),
                teamStats: {
                    away: teamStats('45.1', '38.2', '81.0', '44', '24', '7', '5', '13', '42', '12'),
                    home: teamStats('49.4', '35.5', '76.9', '47', '27', '9', '6', '11', '56', '18')
                },
                box: {
                    away: [
                        player('4065648', 'Jayson Tatum', 'J. Tatum', 'SF', true, ['38', '34', '9', '6', '2', '1', '12-24', '4-10', '6-7', '3', '-2']),
                        player('3917376', 'Jaylen Brown', 'J. Brown', 'SG', true, ['36', '24', '6', '4', '1', '0', '9-19', '2-6', '4-5', '2', '-4']),
                        player('4066354', 'Derrick White', 'D. White', 'PG', true, ['34', '15', '4', '7', '3', '2', '5-11', '3-7', '2-2', '1', '+1']),
                        player('3102531', 'Kristaps Porzingis', 'K. Porzingis', 'C', true, ['30', '18', '11', '2', '0', '3', '7-14', '2-5', '2-2', '2', '-3']),
                        player('3213', 'Al Horford', 'A. Horford', 'PF', false, ['22', '8', '7', '3', '1', '1', '3-7', '2-5', '0-0', '0', '+2'])
                    ],
                    home: [
                        player('1966', 'LeBron James', 'L. James', 'SF', true, ['37', '28', '9', '11', '2', '1', '11-20', '2-6', '4-6', '4', '+5']),
                        player('6583', 'Anthony Davis', 'A. Davis', 'PF', true, ['36', '26', '14', '3', '1', '4', '10-17', '0-1', '6-8', '2', '+7']),
                        player('3945274', 'Luka Doncic', 'L. Doncic', 'PG', true, ['35', '24', '8', '9', '3', '0', '8-19', '3-9', '5-6', '4', '+2']),
                        player('4066457', 'Austin Reaves', 'A. Reaves', 'SG', true, ['32', '16', '3', '4', '1', '0', '5-10', '3-6', '3-3', '1', '-1']),
                        player('4278129', 'Rui Hachimura', 'R. Hachimura', 'F', false, ['24', '10', '5', '1', '0', '1', '4-8', '1-3', '1-2', '0', '+3'])
                    ]
                }
            },
            {
                id: 'mock-2', state: 'in', statusText: '4th 2:30', isLive: true, startTime: null,
                away: team('21', 'PHX', 'Suns', '#1D1160', '22-15', 101),
                home: team('9', 'GS', 'Warriors', '#1D428A', '18-20', 98),
                teamStats: {
                    away: teamStats('47.6', '36.4', '84.2', '41', '22', '6', '3', '12', '44', '9'),
                    home: teamStats('44.0', '40.0', '88.9', '39', '29', '10', '4', '15', '36', '15')
                },
                box: {
                    away: [
                        player('3202', 'Kevin Durant', 'K. Durant', 'SF', true, ['36', '29', '7', '5', '1', '2', '11-19', '2-4', '5-5', '3', '+4']),
                        player('3136193', 'Devin Booker', 'D. Booker', 'SG', true, ['35', '27', '4', '8', '2', '0', '10-22', '3-8', '4-4', '4', '+6']),
                        player('6580', 'Bradley Beal', 'B. Beal', 'SG', true, ['30', '14', '3', '4', '1', '0', '6-13', '1-4', '1-2', '2', '+1']),
                        player('4277848', 'Jusuf Nurkic', 'J. Nurkic', 'C', true, ['26', '10', '13', '3', '0', '1', '4-8', '0-0', '2-4', '2', '+2'])
                    ],
                    home: [
                        player('3975', 'Stephen Curry', 'S. Curry', 'PG', true, ['34', '31', '5', '7', '2', '0', '10-21', '6-13', '5-5', '3', '-2']),
                        player('6475', 'Draymond Green', 'D. Green', 'PF', true, ['32', '9', '10', '10', '3', '2', '4-8', '1-3', '0-0', '4', '-1']),
                        player('4432158', 'Jonathan Kuminga', 'J. Kuminga', 'F', true, ['28', '18', '6', '2', '1', '1', '7-13', '1-3', '3-4', '2', '-4']),
                        player('4433134', 'Brandin Podziemski', 'B. Podziemski', 'G', false, ['24', '11', '7', '4', '3', '0', '4-9', '2-5', '1-1', '1', '+3'])
                    ]
                }
            },
            {
                id: 'mock-3', state: 'pre', statusText: '10:00 PM ET', isLive: false,
                startTime: new Date(new Date().setHours(22, 0, 0, 0)).toISOString(),
                away: team('7', 'DEN', 'Nuggets', '#0E2240', '27-14', null),
                home: team('25', 'OKC', 'Thunder', '#007AC1', '31-9', null),
                teamStats: null, box: null, leaders: null
            }
        ];

        games.forEach(g => { if (g.box) g.leaders = this.boxLeaders(g.box); });
        return games;
    }
}

// Browsers fire this when the site can be installed; keep it for the Install button.
// Captured at load because it can fire before the app starts.
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    window.dispatchEvent(new Event('installpromptready'));
});

// Service worker makes the site installable and work offline
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.error('Service worker failed', err));
    });
}

// Start App
document.addEventListener('DOMContentLoaded', () => {
    try {
        new NBAApp();
    } catch (err) {
        console.error('Failed to start NBAApp', err);
    }
});
