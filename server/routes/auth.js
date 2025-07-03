const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Login route
router.post('/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Get user from database
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Get user's assigned locations if manager
    let assignedLocations = [];
    if (user.role === 'manager') {
      const [locations] = await pool.execute(
        `SELECT l.* FROM locations l 
         INNER JOIN user_locations ul ON l.id = ul.location_id 
         WHERE ul.user_id = ? AND l.is_active = TRUE`,
        [user.id]
      );
      assignedLocations = locations;
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      },
      assignedLocations
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// TEMPORARY: Admin registration (no authentication required)
// REMOVE THIS ROUTE AFTER CREATING ADMIN USER
router.post('/register-admin', [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, firstName, lastName } = req.body;

    // Check if username or email already exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert new admin user
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, passwordHash, firstName, lastName, 'admin']
    );

    const userId = result.insertId;

    res.status(201).json({
      message: 'Admin user created successfully',
      userId,
      username,
      email,
      firstName,
      lastName,
      role: 'admin'
    });

  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Register new user (admin only)
router.post('/register', [
  verifyToken,
  requireAdmin,
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('role').isIn(['admin', 'manager']).withMessage('Role must be admin or manager')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, firstName, lastName, role, locationIds } = req.body;

    // Check if username or email already exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, passwordHash, firstName, lastName, role]
    );

    const userId = result.insertId;

    // Assign locations if manager and locations provided
    if (role === 'manager' && locationIds && locationIds.length > 0) {
      for (const locationId of locationIds) {
        await pool.execute(
          'INSERT INTO user_locations (user_id, location_id) VALUES (?, ?)',
          [userId, locationId]
        );
      }
    }

    res.status(201).json({
      message: 'User created successfully',
      userId
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get current user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, username, email, first_name, last_name, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    // Get assigned locations if manager
    let assignedLocations = [];
    if (user.role === 'manager') {
      const [locations] = await pool.execute(
        `SELECT l.* FROM locations l 
         INNER JOIN user_locations ul ON l.id = ul.location_id 
         WHERE ul.user_id = ? AND l.is_active = TRUE`,
        [user.id]
      );
      assignedLocations = locations;
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        createdAt: user.created_at
      },
      assignedLocations
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all users (admin only)
router.get('/users', [verifyToken, requireAdmin], async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.role, u.is_active, u.created_at,
              GROUP_CONCAT(l.name) as assigned_locations
       FROM users u
       LEFT JOIN user_locations ul ON u.id = ul.user_id
       LEFT JOIN locations l ON ul.location_id = l.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );

    res.json({ users });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user (admin only)
router.put('/users/:id', [
  verifyToken,
  requireAdmin,
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('role').isIn(['admin', 'manager']).withMessage('Role must be admin or manager')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { firstName, lastName, role, isActive, locationIds } = req.body;

    // Update user
    await pool.execute(
      'UPDATE users SET first_name = ?, last_name = ?, role = ?, is_active = ? WHERE id = ?',
      [firstName, lastName, role, isActive, id]
    );

    // Update location assignments if manager
    if (role === 'manager') {
      // Remove existing assignments
      await pool.execute('DELETE FROM user_locations WHERE user_id = ?', [id]);
      
      // Add new assignments
      if (locationIds && locationIds.length > 0) {
        for (const locationId of locationIds) {
          await pool.execute(
            'INSERT INTO user_locations (user_id, location_id) VALUES (?, ?)',
            [id, locationId]
          );
        }
      }
    } else {
      // Remove location assignments for admin
      await pool.execute('DELETE FROM user_locations WHERE user_id = ?', [id]);
    }

    res.json({ message: 'User updated successfully' });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Change password
router.put('/change-password', [
  verifyToken,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Get current user
    const [users] = await pool.execute(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, req.user.id]
    );

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 