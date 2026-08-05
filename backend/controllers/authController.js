import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';

// 1. REGISTER FUNCTION
export const register = async (req, res) => {
  const { fullName, email, password, role, branch } = req.body;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'This email is already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        role: role || 'SALES',
        branch: branch || 'HQ',
        status: 'ACTIVE',
      },
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        branch: user.branch,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to register the user', error: error.message });
  }
};

// 2. LOGIN FUNCTION
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: 'User does not exist' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'This account has been disabled' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, branch: user.branch, fullName: user.fullName },
      process.env.JWT_SECRET || 'supersecretkey',
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        branch: user.branch,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred during login', error: error.message });
  }
};