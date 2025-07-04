const express = require('express');
const { body, validationResult } = require('express-validator');

const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const { pool } = require('../config/database');
const { verifyToken, requireManagerOrAdmin, checkLocationAccess, logActivity } = require('../middleware/auth');

const router = express.Router();


// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});


// Get all sales
router.get('/', [verifyToken, requireManagerOrAdmin], async (req, res) => {
  try {
    const { locationId, productId, startDate, endDate, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT s.*, p.name as product_name, p.sku, l.name as location_name,
             u.first_name, u.last_name, u.username
      FROM sales s
      INNER JOIN products p ON s.product_id = p.id
      INNER JOIN locations l ON s.location_id = l.id
      INNER JOIN users u ON s.created_by = u.id
      WHERE 1=1
    `;

    const queryParams = [];

    // Filter by location access for managers
    if (req.user.role === 'manager') {
      query += ` AND s.location_id IN (
        SELECT location_id FROM user_locations WHERE user_id = ?
      )`;
      queryParams.push(req.user.id);
    }

    if (locationId) {
      query += ' AND s.location_id = ?';
      queryParams.push(locationId);
    }

    if (productId) {
      query += ' AND s.product_id = ?';
      queryParams.push(productId);
    }

    if (startDate) {
      query += ' AND DATE(s.sale_date) >= ?';
      queryParams.push(startDate);
    }

    if (endDate) {
      query += ' AND DATE(s.sale_date) <= ?';
      queryParams.push(endDate);
    }

    // Get total count

    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.execute(countQuery, queryParams);
    console.log('Count Query:', countQuery);
    console.log('Count Result:', countResult);
    const total = countResult[0]?.total ?? 0;
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.execute(countQuery, queryParams);
    const total = countResult[0].total;


    // Get paginated results
    query += ' ORDER BY s.sale_date DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), offset);

    const [sales] = await pool.execute(query, queryParams);

    res.json({
      sales,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single sale
router.get('/:id', [verifyToken, requireManagerOrAdmin], async (req, res) => {
  try {
    const { id } = req.params;

    const [sales] = await pool.execute(
      `SELECT s.*, p.name as product_name, p.sku, l.name as location_name,
              u.first_name, u.last_name, u.username
       FROM sales s
       INNER JOIN products p ON s.product_id = p.id
       INNER JOIN locations l ON s.location_id = l.id
       INNER JOIN users u ON s.created_by = u.id
       WHERE s.id = ?`,
      [id]
    );

    if (sales.length === 0) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const sale = sales[0];

    // Check location access for managers
    if (req.user.role === 'manager') {
      const [userLocations] = await pool.execute(
        'SELECT location_id FROM user_locations WHERE user_id = ? AND location_id = ?',
        [req.user.id, sale.location_id]
      );

      if (userLocations.length === 0) {
        return res.status(403).json({ message: 'Access denied to this sale' });
      }
    }

    res.json({ sale });

  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new sale
router.post('/', [
  verifyToken,
  requireManagerOrAdmin,
  body('productId').isInt().withMessage('Product ID is required'),
  body('locationId').isInt().withMessage('Location ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
  body('customerName').optional().isLength({ max: 100 }).withMessage('Customer name too long'),
  body('customerEmail').optional().isEmail().withMessage('Invalid customer email'),
  body('customerPhone').optional().isLength({ max: 20 }).withMessage('Customer phone too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      productId,
      locationId,
      quantity,
      unitPrice,
      customerName,
      customerEmail,
      customerPhone
    } = req.body;

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

    // Check if product exists and is active
    const [products] = await pool.execute(
      'SELECT * FROM products WHERE id = ? AND is_active = TRUE',
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if location exists and is active
    const [locations] = await pool.execute(
      'SELECT * FROM locations WHERE id = ? AND is_active = TRUE',
      [locationId]
    );

    if (locations.length === 0) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Check inventory availability
    const [inventory] = await pool.execute(
      'SELECT quantity FROM inventory WHERE product_id = ? AND location_id = ?',
      [productId, locationId]
    );

    if (inventory.length === 0) {
      return res.status(400).json({ message: 'No inventory found for this product at this location' });
    }

    if (inventory[0].quantity < quantity) {
      return res.status(400).json({ message: 'Insufficient stock for this sale' });
    }

    const totalAmount = quantity * unitPrice;

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Create sale record
      const [saleResult] = await connection.execute(
        `INSERT INTO sales (product_id, location_id, quantity, unit_price, total_amount, 
                           customer_name, customer_email, customer_phone, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, locationId, quantity, unitPrice, totalAmount, customerName, customerEmail, customerPhone, req.user.id]
      );

      const saleId = saleResult.insertId;

      // Update inventory
      const newQuantity = inventory[0].quantity - quantity;
      await connection.execute(
        'UPDATE inventory SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE product_id = ? AND location_id = ?',
        [newQuantity, productId, locationId]
      );

      // Log stock transaction
      await connection.execute(
        `INSERT INTO stock_transactions 
         (product_id, location_id, transaction_type, quantity, previous_quantity, new_quantity, reason, reference_number, created_by)
         VALUES (?, ?, 'out', ?, ?, ?, 'Sale transaction', ?, ?)`,
        [productId, locationId, quantity, inventory[0].quantity, newQuantity, `SALE-${saleId}`, req.user.id]
      );

      await connection.commit();

      // Get created sale
      const [sales] = await pool.execute(
        `SELECT s.*, p.name as product_name, p.sku, l.name as location_name,
                u.first_name, u.last_name, u.username
         FROM sales s
         INNER JOIN products p ON s.product_id = p.id
         INNER JOIN locations l ON s.location_id = l.id
         INNER JOIN users u ON s.created_by = u.id
         WHERE s.id = ?`,
        [saleId]
      );

      res.status(201).json({
        message: 'Sale created successfully',
        sale: sales[0]
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update sale
router.put('/:id', [
  verifyToken,
  requireManagerOrAdmin,
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('unitPrice').optional().isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
  body('customerName').optional().isLength({ max: 100 }).withMessage('Customer name too long'),
  body('customerEmail').optional().isEmail().withMessage('Invalid customer email'),
  body('customerPhone').optional().isLength({ max: 20 }).withMessage('Customer phone too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { quantity, unitPrice, customerName, customerEmail, customerPhone } = req.body;

    // Get current sale
    const [sales] = await pool.execute(
      `SELECT s.*, p.name as product_name, l.name as location_name
       FROM sales s
       INNER JOIN products p ON s.product_id = p.id
       INNER JOIN locations l ON s.location_id = l.id
       WHERE s.id = ?`,
      [id]
    );

    if (sales.length === 0) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const currentSale = sales[0];

    // Check location access for managers
    if (req.user.role === 'manager') {
      const [userLocations] = await pool.execute(
        'SELECT location_id FROM user_locations WHERE user_id = ? AND location_id = ?',
        [req.user.id, currentSale.location_id]
      );

      if (userLocations.length === 0) {
        return res.status(403).json({ message: 'Access denied to this sale' });
      }
    }

    // Check inventory if quantity is being updated
    if (quantity && quantity !== currentSale.quantity) {
      const [inventory] = await pool.execute(
        'SELECT quantity FROM inventory WHERE product_id = ? AND location_id = ?',
        [currentSale.product_id, currentSale.location_id]
      );

      const availableQuantity = inventory[0].quantity + currentSale.quantity; // Add back the original sale quantity
      if (quantity > availableQuantity) {
        return res.status(400).json({ message: 'Insufficient stock for this quantity' });
      }
    }

    // Calculate new total amount
    const newQuantity = quantity || currentSale.quantity;
    const newUnitPrice = unitPrice || currentSale.unit_price;
    const newTotalAmount = newQuantity * newUnitPrice;

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Update sale
      await connection.execute(
        `UPDATE sales 
         SET quantity = ?, unit_price = ?, total_amount = ?, 
             customer_name = ?, customer_email = ?, customer_phone = ?
         WHERE id = ?`,
        [newQuantity, newUnitPrice, newTotalAmount, customerName, customerEmail, customerPhone, id]
      );

      // Update inventory if quantity changed
      if (quantity && quantity !== currentSale.quantity) {
        const quantityDifference = currentSale.quantity - quantity;
        const [inventory] = await connection.execute(
          'SELECT quantity FROM inventory WHERE product_id = ? AND location_id = ?',
          [currentSale.product_id, currentSale.location_id]
        );

        const newInventoryQuantity = inventory[0].quantity + quantityDifference;
        await connection.execute(
          'UPDATE inventory SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE product_id = ? AND location_id = ?',
          [newInventoryQuantity, currentSale.product_id, currentSale.location_id]
        );

        // Log stock transaction
        await connection.execute(
          `INSERT INTO stock_transactions 
           (product_id, location_id, transaction_type, quantity, previous_quantity, new_quantity, reason, reference_number, created_by)
           VALUES (?, ?, 'adjustment', ?, ?, ?, 'Sale update', ?, ?)`,
          [currentSale.product_id, currentSale.location_id, quantityDifference, inventory[0].quantity, newInventoryQuantity, `SALE-UPDATE-${id}`, req.user.id]
        );
      }

      await connection.commit();

      // Get updated sale
      const [updatedSales] = await pool.execute(
        `SELECT s.*, p.name as product_name, p.sku, l.name as location_name,
                u.first_name, u.last_name, u.username
         FROM sales s
         INNER JOIN products p ON s.product_id = p.id
         INNER JOIN locations l ON s.location_id = l.id
         INNER JOIN users u ON s.created_by = u.id
         WHERE s.id = ?`,
        [id]
      );

      res.json({
        message: 'Sale updated successfully',
        sale: updatedSales[0]
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Update sale error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete sale
router.delete('/:id', [verifyToken, requireManagerOrAdmin], async (req, res) => {
  try {
    const { id } = req.params;

    // Get current sale
    const [sales] = await pool.execute(
      `SELECT s.*, p.name as product_name, l.name as location_name
       FROM sales s
       INNER JOIN products p ON s.product_id = p.id
       INNER JOIN locations l ON s.location_id = l.id
       WHERE s.id = ?`,
      [id]
    );

    if (sales.length === 0) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const currentSale = sales[0];

    // Check location access for managers
    if (req.user.role === 'manager') {
      const [userLocations] = await pool.execute(
        'SELECT location_id FROM user_locations WHERE user_id = ? AND location_id = ?',
        [req.user.id, currentSale.location_id]
      );

      if (userLocations.length === 0) {
        return res.status(403).json({ message: 'Access denied to this sale' });
      }
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Restore inventory
      const [inventory] = await connection.execute(
        'SELECT quantity FROM inventory WHERE product_id = ? AND location_id = ?',
        [currentSale.product_id, currentSale.location_id]
      );

      const newQuantity = inventory[0].quantity + currentSale.quantity;
      await connection.execute(
        'UPDATE inventory SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE product_id = ? AND location_id = ?',
        [newQuantity, currentSale.product_id, currentSale.location_id]
      );

      // Log stock transaction
      await connection.execute(
        `INSERT INTO stock_transactions 
         (product_id, location_id, transaction_type, quantity, previous_quantity, new_quantity, reason, reference_number, created_by)
         VALUES (?, ?, 'in', ?, ?, ?, 'Sale deletion', ?, ?)`,
        [currentSale.product_id, currentSale.location_id, currentSale.quantity, inventory[0].quantity, newQuantity, `SALE-DELETE-${id}`, req.user.id]
      );

      // Delete sale
      await connection.execute('DELETE FROM sales WHERE id = ?', [id]);

      await connection.commit();

      res.json({ message: 'Sale deleted successfully' });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Delete sale error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get sales summary/analytics
router.get('/analytics/summary', [verifyToken, requireManagerOrAdmin], async (req, res) => {
  try {
    const { locationId, startDate, endDate } = req.query;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    // Filter by location access for managers
    if (req.user.role === 'manager') {
      whereClause += ` AND s.location_id IN (
        SELECT location_id FROM user_locations WHERE user_id = ?
      )`;
      queryParams.push(req.user.id);
    }

    if (locationId) {
      whereClause += ' AND s.location_id = ?';
      queryParams.push(locationId);
    }

    if (startDate) {
      whereClause += ' AND DATE(s.sale_date) >= ?';
      queryParams.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND DATE(s.sale_date) <= ?';
      queryParams.push(endDate);
    }

    // Total sales
    const [totalSales] = await pool.execute(
      `SELECT COUNT(*) as total_sales, SUM(total_amount) as total_revenue
       FROM sales s ${whereClause}`,
      queryParams
    );

    // Sales by location
    const [salesByLocation] = await pool.execute(
      `SELECT l.name as location_name, COUNT(*) as sales_count, SUM(s.total_amount) as revenue
       FROM sales s
       INNER JOIN locations l ON s.location_id = l.id
       ${whereClause}
       GROUP BY l.id, l.name
       ORDER BY revenue DESC`,
      queryParams
    );

    // Top selling products
    const [topProducts] = await pool.execute(
      `SELECT p.name as product_name, p.sku, COUNT(*) as sales_count, SUM(s.quantity) as total_quantity, SUM(s.total_amount) as revenue
       FROM sales s
       INNER JOIN products p ON s.product_id = p.id
       ${whereClause}
       GROUP BY p.id, p.name, p.sku
       ORDER BY revenue DESC
       LIMIT 10`,
      queryParams
    );

    res.json({
      summary: totalSales[0],
      salesByLocation,
      topProducts
    });

  } catch (error) {
    console.error('Get sales analytics error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Bulk upload sales from CSV
router.post('/bulk-upload', [verifyToken, requireManagerOrAdmin, upload.single('file')], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const results = [];
    const salesData = [];

    // Parse CSV file
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (row) => {
        salesData.push(row);
      })
      .on('end', async () => {
        try {
          // Clean up uploaded file
          fs.unlinkSync(req.file.path);

          // Process each row
          for (let i = 0; i < salesData.length; i++) {
            const row = salesData[i];
            const rowNumber = i + 2; // +2 because index starts at 0 and we skip header

            try {
              // Validate required fields
              if (!row.product_sku || !row.location_name || !row.quantity || !row.unit_price) {
                results.push({
                  row: rowNumber,
                  success: false,
                  message: 'Missing required fields'
                });
                continue;
              }

              // Validate data types
              const quantity = parseInt(row.quantity);
              const unitPrice = parseFloat(row.unit_price);

              if (isNaN(quantity) || quantity <= 0) {
                results.push({
                  row: rowNumber,
                  success: false,
                  message: 'Invalid quantity'
                });
                continue;
              }

              if (isNaN(unitPrice) || unitPrice < 0) {
                results.push({
                  row: rowNumber,
                  success: false,
                  message: 'Invalid unit price'
                });
                continue;
              }

              // Find product by SKU
              const [products] = await pool.execute(
                'SELECT id, name, unit_price FROM products WHERE sku = ? AND is_active = TRUE',
                [row.product_sku]
              );

              if (products.length === 0) {
                results.push({
                  row: rowNumber,
                  success: false,
                  message: `Product with SKU "${row.product_sku}" not found`
                });
                continue;
              }

              const product = products[0];

              // Find location by name
              const [locations] = await pool.execute(
                'SELECT id, name FROM locations WHERE name = ? AND is_active = TRUE',
                [row.location_name]
              );

              if (locations.length === 0) {
                results.push({
                  row: rowNumber,
                  success: false,
                  message: `Location "${row.location_name}" not found`
                });
                continue;
              }

              const location = locations[0];

              // Check location access for managers
              if (req.user.role === 'manager') {
                const [userLocations] = await pool.execute(
                  'SELECT location_id FROM user_locations WHERE user_id = ? AND location_id = ?',
                  [req.user.id, location.id]
                );

                if (userLocations.length === 0) {
                  results.push({
                    row: rowNumber,
                    success: false,
                    message: 'Access denied to this location'
                  });
                  continue;
                }
              }

              // Check inventory availability
              const [inventory] = await pool.execute(
                'SELECT quantity FROM inventory WHERE product_id = ? AND location_id = ?',
                [product.id, location.id]
              );

              if (inventory.length === 0) {
                results.push({
                  row: rowNumber,
                  success: false,
                  message: 'No inventory found for this product at this location'
                });
                continue;
              }

              if (inventory[0].quantity < quantity) {
                results.push({
                  row: rowNumber,
                  success: false,
                  message: 'Insufficient stock for this sale'
                });
                continue;
              }

              const totalAmount = quantity * unitPrice;

              // Start transaction for this sale
              const connection = await pool.getConnection();
              await connection.beginTransaction();

              try {
                // Create sale record
                const [saleResult] = await connection.execute(
                  `INSERT INTO sales (product_id, location_id, quantity, unit_price, total_amount, 
                                     customer_name, customer_email, customer_phone, created_by)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    product.id,
                    location.id,
                    quantity,
                    unitPrice,
                    totalAmount,
                    row.customer_name || null,
                    row.customer_email || null,
                    row.customer_phone || null,
                    req.user.id
                  ]
                );

                const saleId = saleResult.insertId;

                // Update inventory
                const newQuantity = inventory[0].quantity - quantity;
                await connection.execute(
                  'UPDATE inventory SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE product_id = ? AND location_id = ?',
                  [newQuantity, product.id, location.id]
                );

                // Log stock transaction
                await connection.execute(
                  `INSERT INTO stock_transactions 
                   (product_id, location_id, transaction_type, quantity, previous_quantity, new_quantity, reason, reference_number, created_by)
                   VALUES (?, ?, 'out', ?, ?, ?, 'Bulk sale upload', ?, ?)`,
                  [product.id, location.id, quantity, inventory[0].quantity, newQuantity, `BULK-SALE-${saleId}`, req.user.id]
                );

                await connection.commit();

                results.push({
                  row: rowNumber,
                  success: true,
                  message: 'Sale created successfully',
                  saleId
                });

              } catch (error) {
                await connection.rollback();
                results.push({
                  row: rowNumber,
                  success: false,
                  message: error.message
                });
              } finally {
                connection.release();
              }

            } catch (error) {
              results.push({
                row: rowNumber,
                success: false,
                message: error.message
              });
            }
          }

          const successCount = results.filter(r => r.success).length;
          const errorCount = results.length - successCount;

          res.json({
            message: `Bulk upload completed. ${successCount} successful, ${errorCount} failed.`,
            results
          });

        } catch (error) {
          console.error('Bulk upload error:', error);
          res.status(500).json({ message: 'Internal server error' });
        }
      })
      .on('error', (error) => {
        console.error('CSV parsing error:', error);
        res.status(500).json({ message: 'Error parsing CSV file' });
      });

  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


module.exports = router; 