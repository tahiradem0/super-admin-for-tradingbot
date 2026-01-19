/**
 * Super Admin Server
 * Main entry point for the admin backend
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'super_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check against env credentials (simple approach for single admin)
        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
            const token = jwt.sign(
                { email, role: 'super_admin' },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );
            return res.json({
                success: true,
                token,
                admin: { email, role: 'super_admin' }
            });
        }

        return res.status(401).json({ error: 'Invalid credentials' });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/auth/verify', authenticateAdmin, (req, res) => {
    res.json({ valid: true, admin: req.admin });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Get all users with their settings and trade stats
app.get('/api/users', authenticateAdmin, async (req, res) => {
    try {
        const result = await db.query(`
      SELECT 
        u.id,
        u.email,
        u.username,
        u.is_active,
        u.created_at,
        us.hfm_terminal_path,
        us.equiti_terminal_path,
        us.lot_per_base,
        us.max_lot,
        us.min_entry_gap,
        us.max_spread,
        COALESCE(stats.total_trades, 0) as total_trades,
        COALESCE(stats.total_profit, 0) as total_profit,
        COALESCE(stats.open_trades, 0) as open_trades
      FROM users u
      LEFT JOIN user_settings us ON u.id = us.user_id
      LEFT JOIN (
        SELECT 
          user_id,
          COUNT(*) as total_trades,
          SUM(net_profit) as total_profit,
          SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as open_trades
        FROM trade_history
        GROUP BY user_id
      ) stats ON u.id = stats.user_id
      ORDER BY u.created_at DESC
    `);

        res.json({ users: result.rows });
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get single user details
app.get('/api/users/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const userResult = await db.query(`
      SELECT u.*, us.*
      FROM users u
      LEFT JOIN user_settings us ON u.id = us.user_id
      WHERE u.id = $1
    `, [id]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const tradesResult = await db.query(`
      SELECT * FROM trade_history
      WHERE user_id = $1
      ORDER BY entry_time DESC
      LIMIT 50
    `, [id]);

        res.json({
            user: userResult.rows[0],
            trades: tradesResult.rows
        });
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Toggle user active status (Ban/Unban)
app.patch('/api/users/:id/status', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        await db.query(
            'UPDATE users SET is_active = $1 WHERE id = $2',
            [is_active, id]
        );

        res.json({ success: true, message: is_active ? 'User activated' : 'User banned' });
    } catch (err) {
        console.error('Toggle status error:', err);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

// Update user settings (Remote Control)
app.patch('/api/users/:id/settings', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const settings = req.body;

        // Build dynamic update query
        const allowedFields = [
            'lot_per_base', 'lot_base_amount', 'max_lot', 'min_entry_gap',
            'max_spread', 'exit_reversal_gap', 'min_hold_time', 'slippage',
            'hfm_terminal_path', 'equiti_terminal_path', 'hfm_symbol', 'equiti_symbol'
        ];

        const updates = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(settings)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        values.push(id);
        await db.query(
            `UPDATE user_settings SET ${updates.join(', ')}, updated_at = NOW() WHERE user_id = $${paramIndex}`,
            values
        );

        res.json({ success: true, message: 'Settings updated' });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Delete user
app.delete('/api/users/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Delete in order (foreign keys)
        await db.query('DELETE FROM bot_logs WHERE user_id = $1', [id]);
        await db.query('DELETE FROM blocked_times WHERE user_id = $1', [id]);
        await db.query('DELETE FROM trade_history WHERE user_id = $1', [id]);
        await db.query('DELETE FROM user_settings WHERE user_id = $1', [id]);
        await db.query('DELETE FROM users WHERE id = $1', [id]);

        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL ANALYTICS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/analytics/overview', authenticateAdmin, async (req, res) => {
    try {
        // Total users
        const usersResult = await db.query('SELECT COUNT(*) as count FROM users');

        // Active users (is_active = true)
        const activeResult = await db.query('SELECT COUNT(*) as count FROM users WHERE is_active = true');

        // Total trades and profit
        const tradesResult = await db.query(`
      SELECT 
        COUNT(*) as total_trades,
        COALESCE(SUM(net_profit), 0) as total_profit,
        COALESCE(SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END), 0) as open_trades
      FROM trade_history
    `);

        // Today's trades
        const todayResult = await db.query(`
      SELECT 
        COUNT(*) as today_trades,
        COALESCE(SUM(net_profit), 0) as today_profit
      FROM trade_history
      WHERE DATE(entry_time) = CURRENT_DATE
    `);

        // Get system settings
        const systemResult = await db.query('SELECT * FROM system_settings WHERE id = 1');

        res.json({
            totalUsers: parseInt(usersResult.rows[0].count),
            activeUsers: parseInt(activeResult.rows[0].count),
            totalTrades: parseInt(tradesResult.rows[0].total_trades),
            totalProfit: parseFloat(tradesResult.rows[0].total_profit),
            openTrades: parseInt(tradesResult.rows[0].open_trades),
            todayTrades: parseInt(todayResult.rows[0].today_trades),
            todayProfit: parseFloat(todayResult.rows[0].today_profit),
            systemSettings: systemResult.rows[0] || { global_kill_switch: false }
        });
    } catch (err) {
        console.error('Analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Get profit history for charts
app.get('/api/analytics/profit-history', authenticateAdmin, async (req, res) => {
    try {
        const result = await db.query(`
      SELECT 
        DATE(entry_time) as date,
        SUM(net_profit) as profit,
        COUNT(*) as trades
      FROM trade_history
      WHERE entry_time >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(entry_time)
      ORDER BY date ASC
    `);

        res.json({ history: result.rows });
    } catch (err) {
        console.error('Profit history error:', err);
        res.status(500).json({ error: 'Failed to fetch profit history' });
    }
});

// Get active bots (users with OPEN trades)
app.get('/api/analytics/active-bots', authenticateAdmin, async (req, res) => {
    try {
        const result = await db.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        th.opportunity_type,
        th.lot_size,
        th.hfm_entry_price,
        th.equiti_entry_price,
        th.entry_time,
        th.entry_gap
      FROM users u
      INNER JOIN trade_history th ON u.id = th.user_id
      WHERE th.status = 'OPEN'
      ORDER BY th.entry_time DESC
    `);

        res.json({ activeBots: result.rows });
    } catch (err) {
        console.error('Active bots error:', err);
        res.status(500).json({ error: 'Failed to fetch active bots' });
    }
});

// Get recent completed trades (Live PnL Feed)
app.get('/api/analytics/live-pnl', authenticateAdmin, async (req, res) => {
    try {
        const result = await db.query(`
      SELECT 
        th.id,
        u.username,
        u.email,
        th.opportunity_type,
        th.lot_size,
        th.net_profit,
        th.hold_duration,
        th.exit_time,
        th.entry_gap,
        th.exit_gap
      FROM trade_history th
      INNER JOIN users u ON th.user_id = u.id
      WHERE th.status = 'CLOSED' AND th.exit_time IS NOT NULL
      ORDER BY th.exit_time DESC
      LIMIT 50
    `);

        res.json({ trades: result.rows });
    } catch (err) {
        console.error('Live PnL error:', err);
        res.status(500).json({ error: 'Failed to fetch live PnL' });
    }
});

// Get detailed trade analysis
app.get('/api/analytics/trades', authenticateAdmin, async (req, res) => {
    try {
        const { period, startDate, endDate } = req.query; // 'day', 'week', 'month', or dates

        let dateFilter = '';
        const params = [];

        if (startDate && endDate) {
            dateFilter = 'AND th.entry_time >= $1 AND th.entry_time <= $2';
            params.push(startDate, endDate);
        } else if (period === 'day') {
            dateFilter = 'AND th.entry_time >= CURRENT_DATE';
        } else if (period === 'week') {
            dateFilter = "AND th.entry_time >= NOW() - INTERVAL '7 days'";
        } else if (period === 'month') {
            dateFilter = "AND th.entry_time >= NOW() - INTERVAL '30 days'";
        }

        const query = `
            SELECT 
                th.id,
                th.entry_time,
                th.exit_time,
                th.opportunity_type,
                th.lot_size,
                th.hfm_entry_price,
                th.equiti_entry_price,
                th.hfm_exit_price,
                th.equiti_exit_price,
                th.net_profit,
                th.entry_gap,
                th.exit_gap,
                th.status,
                u.username,
                us.hfm_symbol,
                us.equiti_symbol
            FROM trade_history th
            INNER JOIN users u ON th.user_id = u.id
            LEFT JOIN user_settings us ON th.user_id = us.user_id
            WHERE 1=1 ${dateFilter}
            ORDER BY th.entry_time DESC
            LIMIT 1000
        `;

        const result = await db.query(query, params);
        res.json({ trades: result.rows });

    } catch (err) {
        console.error('Detailed trades error:', err);
        res.status(500).json({ error: 'Failed to fetch trades' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM CONTROL ROUTES (Kill Switch, Blocked Times)
// ═══════════════════════════════════════════════════════════════════════════════

// Initialize system settings table if not exists
const initSystemSettings = async () => {
    try {
        await db.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        global_kill_switch BOOLEAN DEFAULT FALSE,
        blocked_times TEXT DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // Insert default row if not exists
        await db.query(`
      INSERT INTO system_settings (id, global_kill_switch, blocked_times)
      VALUES (1, FALSE, '[]')
      ON CONFLICT (id) DO NOTHING
    `);

        console.log('✅ [DB] System settings table ready');
    } catch (err) {
        console.error('System settings init error:', err);
    }
};

// Toggle Global Kill Switch
app.post('/api/system/kill-switch', authenticateAdmin, async (req, res) => {
    try {
        const { enabled } = req.body;

        await db.query(
            'UPDATE system_settings SET global_kill_switch = $1, updated_at = NOW() WHERE id = 1',
            [enabled]
        );

        res.json({
            success: true,
            message: enabled ? '🔴 KILL SWITCH ACTIVATED - All bots will stop' : '🟢 Kill switch deactivated'
        });
    } catch (err) {
        console.error('Kill switch error:', err);
        res.status(500).json({ error: 'Failed to toggle kill switch' });
    }
});

// Get system settings
app.get('/api/system/settings', authenticateAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM system_settings WHERE id = 1');
        res.json({ settings: result.rows[0] || { global_kill_switch: false, blocked_times: '[]' } });
    } catch (err) {
        console.error('Get system settings error:', err);
        res.status(500).json({ error: 'Failed to fetch system settings' });
    }
});

// Update blocked times
app.post('/api/system/blocked-times', authenticateAdmin, async (req, res) => {
    try {
        const { blockedTimes } = req.body;

        await db.query(
            'UPDATE system_settings SET blocked_times = $1, updated_at = NOW() WHERE id = 1',
            [JSON.stringify(blockedTimes)]
        );

        res.json({ success: true, message: 'Blocked times updated' });
    } catch (err) {
        console.error('Update blocked times error:', err);
        res.status(500).json({ error: 'Failed to update blocked times' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// IMPERSONATION ROUTE
// ═══════════════════════════════════════════════════════════════════════════════

app.post('/api/users/:id/impersonate', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const userResult = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        // Generate a token for the user (same as their normal login would)
        const token = jwt.sign(
            { id: user.id, email: user.email, role: 'user' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({
            success: true,
            impersonationToken: token,
            user: { id: user.id, email: user.email, username: user.username }
        });
    } catch (err) {
        console.error('Impersonate error:', err);
        res.status(500).json({ error: 'Failed to impersonate user' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════════

app.listen(PORT, async () => {
    console.log(`\n🚀 Super Admin Server running on http://localhost:${PORT}`);
    console.log('═══════════════════════════════════════════════════════════════');

    // Initialize system settings
    await initSystemSettings();
});
