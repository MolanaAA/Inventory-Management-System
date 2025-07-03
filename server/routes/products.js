const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { verifyToken, requireManagerOrAdmin, logActivity } = require('../middleware/auth');

const router = express.Router();

// Get all products
router.get('/', [verifyToken, requireManagerOrAdmin], async (req, res) => {
  try {
    const { search, category, brand, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, 
             COALESCE(SUM(i.quantity), 0) as total_stock,
             COALESCE(SUM(i.reserved_quantity), 0) as total_reserved
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
    `;

    const whereConditions = ['p.is_active = TRUE'];
    const queryParams = [];

    if (search) {
      whereConditions.push('(p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (category) {
      whereConditions.push('p.category = ?');
      queryParams.push(category);
    }

    if (brand) {
      whereConditions.push('p.brand = ?');
      queryParams.push(brand);
    }

    query += ` WHERE ${whereConditions.join(' AND ')}`;
    query += ' GROUP BY p.id ORDER BY p.name';

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM products p
      WHERE ${whereConditions.join(' AND ')}
    `;
    const [countResult] = await pool.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // Get paginated results
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), offset);

    const [products] = await pool.execute(query, queryParams);

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single product
router.get('/:id', [verifyToken, requireManagerOrAdmin], async (req, res) => {
  try {
    const { id } = req.params;

    const [products] = await pool.execute(
      `SELECT p.*, 
              COALESCE(SUM(i.quantity), 0) as total_stock,
              COALESCE(SUM(i.reserved_quantity), 0) as total_reserved
       FROM products p
       LEFT JOIN inventory i ON p.id = i.product_id
       WHERE p.id = ? AND p.is_active = TRUE
       GROUP BY p.id`,
      [id]
    );

    if (products.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Get inventory by location
    const [inventory] = await pool.execute(
      `SELECT i.*, l.name as location_name, l.city, l.state
       FROM inventory i
       INNER JOIN locations l ON i.location_id = l.id
       WHERE i.product_id = ? AND l.is_active = TRUE
       ORDER BY l.name`,
      [id]
    );

    const product = products[0];
    product.inventory = inventory;

    res.json({ product });

  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new product
router.post('/', [
  verifyToken,
  requireManagerOrAdmin,
  body('name').notEmpty().withMessage('Product name is required'),
  body('sku').notEmpty().withMessage('SKU is required'),
  body('unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
  body('costPrice').optional().isFloat({ min: 0 }).withMessage('Cost price must be a positive number'),
  body('reorderLevel').optional().isInt({ min: 0 }).withMessage('Reorder level must be a non-negative integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      description,
      sku,
      category,
      brand,
      unitPrice,
      costPrice,
      reorderLevel
    } = req.body;

    // Check if SKU already exists
    const [existingProducts] = await pool.execute(
      'SELECT id FROM products WHERE sku = ?',
      [sku]
    );

    if (existingProducts.length > 0) {
      return res.status(400).json({ message: 'SKU already exists' });
    }

    // Insert new product
    const [result] = await pool.execute(
      `INSERT INTO products (name, description, sku, category, brand, unit_price, cost_price, reorder_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, sku, category, brand, unitPrice, costPrice, reorderLevel || 0]
    );

    const productId = result.insertId;

    // Get the created product
    const [products] = await pool.execute(
      'SELECT * FROM products WHERE id = ?',
      [productId]
    );

    res.status(201).json({
      message: 'Product created successfully',
      product: products[0]
    });

  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update product
router.put('/:id', [
  verifyToken,
  requireManagerOrAdmin,
  body('name').notEmpty().withMessage('Product name is required'),
  body('unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
  body('costPrice').optional().isFloat({ min: 0 }).withMessage('Cost price must be a positive number'),
  body('reorderLevel').optional().isInt({ min: 0 }).withMessage('Reorder level must be a non-negative integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      name,
      description,
      category,
      brand,
      unitPrice,
      costPrice,
      reorderLevel
    } = req.body;

    // Check if product exists
    const [existingProducts] = await pool.execute(
      'SELECT id FROM products WHERE id = ? AND is_active = TRUE',
      [id]
    );

    if (existingProducts.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Update product
    await pool.execute(
      `UPDATE products 
       SET name = ?, description = ?, category = ?, brand = ?, unit_price = ?, cost_price = ?, reorder_level = ?
       WHERE id = ?`,
      [name, description, category, brand, unitPrice, costPrice, reorderLevel || 0, id]
    );

    // Get updated product
    const [products] = await pool.execute(
      'SELECT * FROM products WHERE id = ?',
      [id]
    );

    res.json({
      message: 'Product updated successfully',
      product: products[0]
    });

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete product (soft delete)
router.delete('/:id', [verifyToken, requireManagerOrAdmin], async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product exists
    const [existingProducts] = await pool.execute(
      'SELECT id FROM products WHERE id = ? AND is_active = TRUE',
      [id]
    );

    if (existingProducts.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if product has inventory
    const [inventory] = await pool.execute(
      'SELECT SUM(quantity) as total_quantity FROM inventory WHERE product_id = ?',
      [id]
    );

    if (inventory[0].total_quantity > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete product with existing inventory. Please remove all inventory first.' 
      });
    }

    // Soft delete product
    await pool.execute(
      'UPDATE products SET is_active = FALSE WHERE id = ?',
      [id]
    );

    res.json({ message: 'Product deleted successfully' });

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get product categories
router.get('/categories/list', [verifyToken, requireManagerOrAdmin], async (req, res) => {
  try {
    const [categories] = await pool.execute(
      'SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != "" AND is_active = TRUE ORDER BY category'
    );

    res.json({ categories: categories.map(c => c.category) });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get product brands
router.get('/brands/list', [verifyToken, requireManagerOrAdmin], async (req, res) => {
  try {
    const [brands] = await pool.execute(
      'SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND brand != "" AND is_active = TRUE ORDER BY brand'
    );

    res.json({ brands: brands.map(b => b.brand) });

  } catch (error) {
    console.error('Get brands error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 