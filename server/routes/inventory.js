const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { verifyToken, requireManagerOrAdmin, checkLocationAccess, logActivity } = require('../middleware/auth');

const router = express.Router();


// Create new inventory record
router.post('/', [
  verifyToken,
  requireManagerOrAdmin,
  body('productId').isInt().withMessage('Product ID is required'),
  body('locationId').isInt().withMessage('Location ID is required'),
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('transactionType').isIn(['in', 'out', 'adjustment']).withMessage('Invalid transaction type'),
  body('reason').notEmpty().withMessage('Reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, locationId, quantity, transactionType, reason, referenceNumber } = req.body;

    // Check if product exists and is active
    const [products] = await pool.execute(
      'SELECT id, name, sku FROM products WHERE id = ? AND is_active = TRUE',
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({ message: 'Product not found or inactive' });
    }

    // Check if location exists and is active
    const [locations] = await pool.execute(
      'SELECT id, name FROM locations WHERE id = ? AND is_active = TRUE',
      [locationId]
    );

    if (locations.length === 0) {
      return res.status(404).json({ message: 'Location not found or inactive' });
    }

    // Check location access for managers
    if (req.user.role === 'manager') {
      const [userLocations] = await pool.execute(
        'SELECT location_id FROM user_locations WHERE user_id = ? AND location_id = ?',
        [req.user.id, locationId]
      );

      if (userLocations.length === 0) {
        return res.status(403).json({ message: 'Access denied to this location' });
      }
    }

    // Check if inventory record already exists for this product and location
    const [existingInventory] = await pool.execute(
      'SELECT id, quantity FROM inventory WHERE product_id = ? AND location_id = ?',
      [productId, locationId]
    );

    let inventoryId;
    let previousQuantity = 0;
    let newQuantity = quantity;

    if (existingInventory.length > 0) {
      // Update existing inventory
      const currentInventory = existingInventory[0];
      previousQuantity = currentInventory.quantity;
      inventoryId = currentInventory.id;

      // Calculate new quantity based on transaction type
      switch (transactionType) {
        case 'in':
          // Add to existing stock
          newQuantity = previousQuantity + parseInt(quantity, 10);
          break;
        case 'out':
          if (quantity > previousQuantity) {
            return res.status(400).json({ message: 'Insufficient stock' });
          }
          newQuantity = previousQuantity - parseInt(quantity, 10);
          break;
        case 'adjustment':
          // Set quantity directly
          newQuantity = parseInt(quantity, 10);
          break;
      }

      // Update inventory
      await pool.execute(
        'UPDATE inventory SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
        [newQuantity, inventoryId]
      );
    } else {
      // Create new inventory record
      const [result] = await pool.execute(
        'INSERT INTO inventory (product_id, location_id, quantity, created_at, last_updated) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [productId, locationId, quantity]
      );
      inventoryId = result.insertId;
      newQuantity = quantity;
    }

    // Log stock transaction
    await pool.execute(
      `INSERT INTO stock_transactions 
       (product_id, location_id, transaction_type, quantity, previous_quantity, new_quantity, reason, reference_number, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productId,
        locationId,
        transactionType,
        quantity,
        previousQuantity,
        newQuantity,
        reason,
        referenceNumber || null,
        req.user.id
      ]
    );

    // Get the created/updated inventory record
    const [inventory] = await pool.execute(
      `SELECT i.*, p.name as product_name, p.sku, p.category, p.brand, l.name as location_name
       FROM inventory i
       INNER JOIN products p ON i.product_id = p.id
       INNER JOIN locations l ON i.location_id = l.id
       WHERE i.id = ?`,
      [inventoryId]
    );

    res.status(201).json({
      message: 'Inventory record created successfully',
      inventory: inventory[0],
      transaction: {
        type: transactionType,
        quantity,
        previousQuantity,
        newQuantity,
        reason
      }
    });

  } catch (error) {
    console.error('Create inventory error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get inventory for all locations (admin) or assigned locations (manager)
router.get('/', [verifyToken, requireManagerOrAdmin], async (req, res) => {
  try {
    const { locationId, productId, lowStock, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT i.*, p.name as product_name, p.sku, p.category, p.brand, p.unit_price, p.reorder_level,
             l.name as location_name, l.city, l.state
      FROM inventory i
      INNER JOIN products p ON i.product_id = p.id
      INNER JOIN locations l ON i.location_id = l.id
      WHERE p.is_active = TRUE AND l.is_active = TRUE
    `;

    const queryParams = [];

    // Filter by location access
    if (req.user.role === 'manager') {
      query += ` AND l.id IN (
        SELECT location_id FROM user_locations WHERE user_id = ?
      )`;
      queryParams.push(req.user.id);
    }

    if (locationId) {
      query += ' AND i.location_id = ?';
      queryParams.push(locationId);
    }

    if (productId) {
      query += ' AND i.product_id = ?';
      queryParams.push(productId);
    }

    if (lowStock === 'true') {
      query += ' AND i.quantity <= p.reorder_level';
    }

    // Get total count
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // Get paginated results
    query += ' ORDER BY l.name, p.name LIMIT ? OFFSET ?';
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
    console.error('Get inventory error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get inventory for specific location
router.get('/location/:locationId', [verifyToken, requireManagerOrAdmin, checkLocationAccess], async (req, res) => {
  try {
    const { locationId } = req.params;
    const { lowStock } = req.query;

    let query = `
      SELECT i.*, p.name as product_name, p.sku, p.category, p.brand, p.unit_price, p.reorder_level
      FROM inventory i
      INNER JOIN products p ON i.product_id = p.id
      WHERE i.location_id = ? AND p.is_active = TRUE
    `;

    const queryParams = [locationId];

    if (lowStock === 'true') {
      query += ' AND i.quantity <= p.reorder_level';
    }

    query += ' ORDER BY p.name';

    const [inventory] = await pool.execute(query, queryParams);

    res.json({ inventory });

  } catch (error) {
    console.error('Get location inventory error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update inventory stock
router.put('/:id', [
  verifyToken,
  requireManagerOrAdmin,
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('reason').notEmpty().withMessage('Reason is required'),
  body('transactionType').isIn(['in', 'out', 'adjustment']).withMessage('Invalid transaction type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { quantity, reason, transactionType, referenceNumber } = req.body;

    // Get current inventory
    const [inventory] = await pool.execute(
      `SELECT i.*, p.name as product_name, l.name as location_name
       FROM inventory i
       INNER JOIN products p ON i.product_id = p.id
       INNER JOIN locations l ON i.location_id = l.id
       WHERE i.id = ?`,
      [id]
    );

    if (inventory.length === 0) {
      return res.status(404).json({ message: 'Inventory record not found' });
    }

    const currentInventory = inventory[0];

    // Check location access for managers
    if (req.user.role === 'manager') {
      const [userLocations] = await pool.execute(
        'SELECT location_id FROM user_locations WHERE user_id = ? AND location_id = ?',
        [req.user.id, currentInventory.location_id]
      );

      if (userLocations.length === 0) {
        return res.status(403).json({ message: 'Access denied to this location' });
      }
    }

    const previousQuantity = currentInventory.quantity;
    let newQuantity = previousQuantity;

    // Calculate new quantity based on transaction type
    switch (transactionType) {
      case 'in':
        newQuantity = previousQuantity + quantity;
        break;
      case 'out':
        if (quantity > previousQuantity) {
          return res.status(400).json({ message: 'Insufficient stock' });
        }
        newQuantity = previousQuantity - quantity;
        break;
      case 'adjustment':
        newQuantity = quantity;
        break;
    }

    // Update inventory
    await pool.execute(
      'UPDATE inventory SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
      [newQuantity, id]
    );

    // Log stock transaction
    await pool.execute(
      `INSERT INTO stock_transactions 
       (product_id, location_id, transaction_type, quantity, previous_quantity, new_quantity, reason, reference_number, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        currentInventory.product_id,
        currentInventory.location_id,
        transactionType,
        quantity,
        previousQuantity,
        newQuantity,
        reason,
        referenceNumber || null,
        req.user.id
      ]
    );

    // Get updated inventory
    const [updatedInventory] = await pool.execute(
      `SELECT i.*, p.name as product_name, l.name as location_name
       FROM inventory i
       INNER JOIN products p ON i.product_id = p.id
       INNER JOIN locations l ON i.location_id = l.id
       WHERE i.id = ?`,
      [id]
    );

    res.json({
      message: 'Inventory updated successfully',
      inventory: updatedInventory[0],
      transaction: {
        type: transactionType,
        quantity,
        previousQuantity,
        newQuantity,
        reason
      }
    });

  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Bulk update inventory
router.post('/bulk-update', [
  verifyToken,
  requireManagerOrAdmin,
  body('updates').isArray().withMessage('Updates must be an array'),
  body('updates.*.inventoryId').isInt().withMessage('Inventory ID is required'),
  body('updates.*.quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('updates.*.reason').notEmpty().withMessage('Reason is required'),
  body('updates.*.transactionType').isIn(['in', 'out', 'adjustment']).withMessage('Invalid transaction type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { updates } = req.body;
    const results = [];

    for (const update of updates) {
      try {
        const { inventoryId, quantity, reason, transactionType, referenceNumber } = update;

        // Get current inventory
        const [inventory] = await pool.execute(
          `SELECT i.*, p.name as product_name, l.name as location_name
           FROM inventory i
           INNER JOIN products p ON i.product_id = p.id
           INNER JOIN locations l ON i.location_id = l.id
           WHERE i.id = ?`,
          [inventoryId]
        );

        if (inventory.length === 0) {
          results.push({
            inventoryId,
            success: false,
            message: 'Inventory record not found'
          });
          continue;
        }

        const currentInventory = inventory[0];

        // Check location access for managers
        if (req.user.role === 'manager') {
          const [userLocations] = await pool.execute(
            'SELECT location_id FROM user_locations WHERE user_id = ? AND location_id = ?',
            [req.user.id, currentInventory.location_id]
          );

          if (userLocations.length === 0) {
            results.push({
              inventoryId,
              success: false,
              message: 'Access denied to this location'
            });
            continue;
          }
        }

        const previousQuantity = currentInventory.quantity;
        let newQuantity = previousQuantity;

        // Calculate new quantity
        switch (transactionType) {
          case 'in':
            newQuantity = previousQuantity + quantity;
            break;
          case 'out':
            if (quantity > previousQuantity) {
              results.push({
                inventoryId,
                success: false,
                message: 'Insufficient stock'
              });
              continue;
            }
            newQuantity = previousQuantity - quantity;
            break;
          case 'adjustment':
            newQuantity = quantity;
            break;
        }

        // Update inventory
        await pool.execute(
          'UPDATE inventory SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
          [newQuantity, inventoryId]
        );

        // Log stock transaction
        await pool.execute(
          `INSERT INTO stock_transactions 
           (product_id, location_id, transaction_type, quantity, previous_quantity, new_quantity, reason, reference_number, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            currentInventory.product_id,
            currentInventory.location_id,
            transactionType,
            quantity,
            previousQuantity,
            newQuantity,
            reason,
            referenceNumber || null,
            req.user.id
          ]
        );

        results.push({
          inventoryId,
          success: true,
          message: 'Updated successfully',
          previousQuantity,
          newQuantity
        });

      } catch (error) {
        results.push({
          inventoryId: update.inventoryId,
          success: false,
          message: error.message
        });
      }
    }

    res.json({
      message: 'Bulk update completed',
      results
    });

  } catch (error) {
    console.error('Bulk update inventory error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get stock transactions
router.get('/transactions', [verifyToken, requireManagerOrAdmin], async (req, res) => {
  try {
    const { locationId, productId, transactionType, startDate, endDate, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT st.*, p.name as product_name, p.sku, l.name as location_name,
             u.first_name, u.last_name, u.username
      FROM stock_transactions st
      INNER JOIN products p ON st.product_id = p.id
      INNER JOIN locations l ON st.location_id = l.id
      INNER JOIN users u ON st.created_by = u.id
      WHERE 1=1
    `;

    const queryParams = [];

    // Filter by location access for managers
    if (req.user.role === 'manager') {
      query += ` AND st.location_id IN (
        SELECT location_id FROM user_locations WHERE user_id = ?
      )`;
      queryParams.push(req.user.id);
    }

    if (locationId) {
      query += ' AND st.location_id = ?';
      queryParams.push(locationId);
    }

    if (productId) {
      query += ' AND st.product_id = ?';
      queryParams.push(productId);
    }

    if (transactionType) {
      query += ' AND st.transaction_type = ?';
      queryParams.push(transactionType);
    }

    if (startDate) {
      query += ' AND DATE(st.created_at) >= ?';
      queryParams.push(startDate);
    }

    if (endDate) {
      query += ' AND DATE(st.created_at) <= ?';
      queryParams.push(endDate);
    }

    // Get total count
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // Get paginated results
    query += ' ORDER BY st.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), offset);

    const [transactions] = await pool.execute(query, queryParams);

    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get low stock alerts
router.get('/low-stock', [verifyToken, requireManagerOrAdmin], async (req, res) => {
  try {
    let query = `
      SELECT i.*, p.name as product_name, p.sku, p.category, p.brand, p.reorder_level,
             l.name as location_name, l.city, l.state
      FROM inventory i
      INNER JOIN products p ON i.product_id = p.id
      INNER JOIN locations l ON i.location_id = l.id
      WHERE i.quantity <= p.reorder_level AND p.is_active = TRUE AND l.is_active = TRUE
    `;

    const queryParams = [];

    // Filter by location access for managers
    if (req.user.role === 'manager') {
      query += ` AND l.id IN (
        SELECT location_id FROM user_locations WHERE user_id = ?
      )`;
      queryParams.push(req.user.id);
    }

    query += ' ORDER BY l.name, p.name';

    const [lowStockItems] = await pool.execute(query, queryParams);

    res.json({ lowStockItems });

  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 