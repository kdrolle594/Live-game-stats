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

class NBAApp {
    constructor() {
        this.currentDate = new Date();
        this.games = [];
        this.openGameId = null;
        this.refreshIntervalId = null;
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
            dialogBody: document.getElementById('dialog-body')
        };

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
            this.showToast('Couldn’t reach the score service. Showing sample games.');
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
                <th scope="row"><span class="pname">${this.escape(p.shortName || p.name)}</span><span class="ppos">${this.escape(p.position)}</span></th>
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

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('role', 'status');
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
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

// Start App
document.addEventListener('DOMContentLoaded', () => {
    try {
        new NBAApp();
    } catch (err) {
        console.error('Failed to start NBAApp', err);
    }
});
