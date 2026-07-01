import jwt from 'jsonwebtoken';

export const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, error: 'Token de autenticação ausente' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Token inválido ou expirado' });
  }
};
