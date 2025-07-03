const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Check if user is manager or admin
const requireManagerOrAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Manager or admin access required' });
  }
  next();
};

// Check if user has access to specific location
const checkLocationAccess = async (req, res, next) => {
  try {
    const { locationId } = req.params;
    
    if (req.user.role === 'admin') {
      return next(); // Admins have access to all locations
    }

    // Check if manager has access to this location
    const [rows] = await pool.execute(
      'SELECT * FROM user_locations WHERE user_id = ? AND location_id = ?',
      [req.user.id, locationId]
    );

    if (rows.length === 0) {
      return res.status(403).json({ message: 'Access denied to this location' });
    }

    next();
  } catch (error) {
    console.error('Location access check error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Activity logging middleware
const logActivity = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log activity after response is sent
    setTimeout(async () => {
      try {
        const { method, originalUrl, body, params, query } = req;
        const action = `${method} ${originalUrl}`;
        
        let tableName = null;
        let recordId = null;
        let oldValues = null;
        let newValues = null;

        // Determine table name and record ID based on route
        if (originalUrl.includes('/products')) {
          tableName = 'products';
          recordId = params.id || body.id;
        } else if (originalUrl.includes('/inventory')) {
          tableName = 'inventory';
          recordId = params.id || body.id;
        } else if (originalUrl.includes('/sales')) {
          tableName = 'sales';
          recordId = params.id || body.id;
        } else if (originalUrl.includes('/locations')) {
          tableName = 'locations';
          recordId = params.id || body.id;
        }

        if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
          newValues = JSON.stringify(body);
        }

        await pool.execute(
          'INSERT INTO activity_logs (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            req.user.id,
            action,
            tableName,
            recordId,
            oldValues,
            newValues,
            req.ip,
            req.get('User-Agent')
          ]
        );
      } catch (error) {
        console.error('Activity logging error:', error);
      }
    }, 100);

    originalSend.call(this, data);
  };

  next();
};

module.exports = {
  verifyToken,
  requireAdmin,
  requireManagerOrAdmin,
  checkLocationAccess,
  logActivity
}; 