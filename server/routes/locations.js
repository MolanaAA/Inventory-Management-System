const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { verifyToken, requireAdmin, logActivity } = require('../middleware/auth');

const router = express.Router();

// Get all locations
router.get('/', [verifyToken, requireAdmin], async (req, res) => {
  try {
    const { search, isActive, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM locations WHERE 1=1';
    const queryParams = [];

    if (search) {
      query += ' AND (name LIKE ? OR city LIKE ? OR state LIKE ?)';
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (isActive !== undefined) {
      query += ' AND is_active = ?';
      queryParams.push(isActive === 'true');
    }

    // Get total count
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // Get paginated results
    query += ' ORDER BY name LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), offset);

    const [locations] = await pool.execute(query, queryParams);

    res.json({
      locations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single location
router.get('/:id', [verifyToken, requireAdmin], async (req, res) => {
  try {
    const { id } = req.params;

    const [locations] = await pool.execute(
      'SELECT * FROM locations WHERE id = ?',
      [id]
    );

    if (locations.length === 0) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Get assigned managers
    const [managers] = await pool.execute(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.email, ul.assigned_at
       FROM users u
       INNER JOIN user_locations ul ON u.id = ul.user_id
       WHERE ul.location_id = ? AND u.role = 'manager' AND u.is_active = TRUE
       ORDER BY u.first_name, u.last_name`,
      [id]
    );

    // Get inventory summary
    const [inventorySummary] = await pool.execute(
      `SELECT COUNT(DISTINCT i.product_id) as total_products,
              SUM(i.quantity) as total_quantity,
              SUM(i.reserved_quantity) as total_reserved
       FROM inventory i
       WHERE i.location_id = ?`,
      [id]
    );

    const location = locations[0];
    location.managers = managers;
    location.inventorySummary = inventorySummary[0];

    res.json({ location });

  } catch (error) {
    console.error('Get location error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new location
router.post('/', [
  verifyToken,
  requireAdmin,
  body('name').notEmpty().withMessage('Location name is required'),
  body('address').optional().isLength({ max: 500 }).withMessage('Address too long'),
  body('city').optional().isLength({ max: 50 }).withMessage('City name too long'),
  body('state').optional().isLength({ max: 50 }).withMessage('State name too long'),
  body('country').optional().isLength({ max: 50 }).withMessage('Country name too long'),
  body('postalCode').optional().isLength({ max: 20 }).withMessage('Postal code too long'),
  body('phone').optional().isLength({ max: 20 }).withMessage('Phone number too long'),
  body('email').optional().isEmail().withMessage('Invalid email address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      address,
      city,
      state,
      country,
      postalCode,
      phone,
      email
    } = req.body;

    // Check if location name already exists
    const [existingLocations] = await pool.execute(
      'SELECT id FROM locations WHERE name = ?',
      [name]
    );

    if (existingLocations.length > 0) {
      return res.status(400).json({ message: 'Location name already exists' });
    }

    // Insert new location
    const [result] = await pool.execute(
      `INSERT INTO locations (name, address, city, state, country, postal_code, phone, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, address, city, state, country, postalCode, phone, email]
    );

    const locationId = result.insertId;

    // Get the created location
    const [locations] = await pool.execute(
      'SELECT * FROM locations WHERE id = ?',
      [locationId]
    );

    res.status(201).json({
      message: 'Location created successfully',
      location: locations[0]
    });

  } catch (error) {
    console.error('Create location error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update location
router.put('/:id', [
  verifyToken,
  requireAdmin,
  body('name').notEmpty().withMessage('Location name is required'),
  body('address').optional().isLength({ max: 500 }).withMessage('Address too long'),
  body('city').optional().isLength({ max: 50 }).withMessage('City name too long'),
  body('state').optional().isLength({ max: 50 }).withMessage('State name too long'),
  body('country').optional().isLength({ max: 50 }).withMessage('Country name too long'),
  body('postalCode').optional().isLength({ max: 20 }).withMessage('Postal code too long'),
  body('phone').optional().isLength({ max: 20 }).withMessage('Phone number too long'),
  body('email').optional().isEmail().withMessage('Invalid email address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      name,
      address,
      city,
      state,
      country,
      postalCode,
      phone,
      email,
      isActive
    } = req.body;

    // Check if location exists
    const [existingLocations] = await pool.execute(
      'SELECT id FROM locations WHERE id = ?',
      [id]
    );

    if (existingLocations.length === 0) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Check if location name already exists (excluding current location)
    const [duplicateLocations] = await pool.execute(
      'SELECT id FROM locations WHERE name = ? AND id != ?',
      [name, id]
    );

    if (duplicateLocations.length > 0) {
      return res.status(400).json({ message: 'Location name already exists' });
    }

    // Update location
    await pool.execute(
      `UPDATE locations 
       SET name = ?, address = ?, city = ?, state = ?, country = ?, 
           postal_code = ?, phone = ?, email = ?, is_active = ?
       WHERE id = ?`,
      [name, address, city, state, country, postalCode, phone, email, isActive, id]
    );

    // Get updated location
    const [locations] = await pool.execute(
      'SELECT * FROM locations WHERE id = ?',
      [id]
    );

    res.json({
      message: 'Location updated successfully',
      location: locations[0]
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete location (soft delete)
router.delete('/:id', [verifyToken, requireAdmin], async (req, res) => {
  try {
    const { id } = req.params;

    // Check if location exists
    const [existingLocations] = await pool.execute(
      'SELECT id FROM locations WHERE id = ?',
      [id]
    );

    if (existingLocations.length === 0) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Check if location has inventory
    const [inventory] = await pool.execute(
      'SELECT SUM(quantity) as total_quantity FROM inventory WHERE location_id = ?',
      [id]
    );

    if (inventory[0].total_quantity > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete location with existing inventory. Please remove all inventory first.' 
      });
    }

    // Check if location has assigned managers
    const [managers] = await pool.execute(
      'SELECT COUNT(*) as manager_count FROM user_locations WHERE location_id = ?',
      [id]
    );

    if (managers[0].manager_count > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete location with assigned managers. Please reassign managers first.' 
      });
    }

    // Soft delete location
    await pool.execute(
      'UPDATE locations SET is_active = FALSE WHERE id = ?',
      [id]
    );

    res.json({ message: 'Location deleted successfully' });

  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Assign manager to location
router.post('/:id/assign-manager', [
  verifyToken,
  requireAdmin,
  body('userId').isInt().withMessage('User ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id: locationId } = req.params;
    const { userId } = req.body;

    // Check if location exists and is active
    const [locations] = await pool.execute(
      'SELECT id FROM locations WHERE id = ? AND is_active = TRUE',
      [locationId]
    );

    if (locations.length === 0) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Check if user exists and is a manager
    const [users] = await pool.execute(
      'SELECT id, role FROM users WHERE id = ? AND role = "manager" AND is_active = TRUE',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'Manager not found' });
    }

    // Check if assignment already exists
    const [existingAssignments] = await pool.execute(
      'SELECT id FROM user_locations WHERE user_id = ? AND location_id = ?',
      [userId, locationId]
    );

    if (existingAssignments.length > 0) {
      return res.status(400).json({ message: 'Manager is already assigned to this location' });
    }

    // Create assignment
    await pool.execute(
      'INSERT INTO user_locations (user_id, location_id) VALUES (?, ?)',
      [userId, locationId]
    );

    res.json({ message: 'Manager assigned successfully' });

  } catch (error) {
    console.error('Assign manager error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Remove manager from location
router.delete('/:id/remove-manager/:userId', [verifyToken, requireAdmin], async (req, res) => {
  try {
    const { id: locationId, userId } = req.params;

    // Check if assignment exists
    const [assignments] = await pool.execute(
      'SELECT id FROM user_locations WHERE user_id = ? AND location_id = ?',
      [userId, locationId]
    );

    if (assignments.length === 0) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Remove assignment
    await pool.execute(
      'DELETE FROM user_locations WHERE user_id = ? AND location_id = ?',
      [userId, locationId]
    );

    res.json({ message: 'Manager removed successfully' });

  } catch (error) {
    console.error('Remove manager error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get location inventory
router.get('/:id/inventory', [verifyToken, requireAdmin], async (req, res) => {
  try {
    const { id } = req.params;
    const { lowStock, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT i.*, p.name as product_name, p.sku, p.category, p.brand, p.unit_price, p.reorder_level
      FROM inventory i
      INNER JOIN products p ON i.product_id = p.id
      WHERE i.location_id = ? AND p.is_active = TRUE
    `;

    const queryParams = [id];

    if (lowStock === 'true') {
      query += ' AND i.quantity <= p.reorder_level';
    }

    // Get total count
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // Get paginated results
    query += ' ORDER BY p.name LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), offset);

    const [inventory] = await pool.execute(query, queryParams);

    res.json({
      inventory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get location inventory error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 