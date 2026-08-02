const jwt = require('jsonwebtoken');

// Used for routes that work for guests AND logged-in users
// (e.g. planning a route), but behave slightly differently when
// a user is authenticated (e.g. saving journey history).
module.exports = function optionalAuth(req, res, next) {
  const header = req.headers.authorization;

  if (header && header.startsWith('Bearer ')) {
    const token = header.split(' ')[1];
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // Invalid token on an optional route - just proceed as a guest
      req.user = null;
    }
  } else {
    req.user = null;
  }

  next();
};
