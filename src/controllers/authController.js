import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'E-mail e senha são obrigatórios' });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminEmail || !adminPasswordHash) {
      console.error('ADMIN_EMAIL / ADMIN_PASSWORD_HASH não configurados no ambiente');
      return res.status(500).json({ success: false, error: 'Autenticação não configurada no servidor' });
    }

    if (email !== adminEmail) {
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }

    const passwordMatches = await bcrypt.compare(password, adminPasswordHash);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { email, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    return res.json({
      success: true,
      data: {
        token,
        user: { email, name: 'Administrador' }
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
};
