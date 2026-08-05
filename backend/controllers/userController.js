import bcrypt from 'bcryptjs';
import prisma from '../prisma.js';

// 1. Fetch all Users
export const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        branch: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error('🔥 Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
};

// 2. Create a new User (Sales, Admin, QC)
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, branch } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please fill in the name, email, and password' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'This email is already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        fullName: name,
        email,
        password: hashedPassword,
        role: role || 'SALES',
        branch: role === 'ADMIN' ? null : (branch || 'HQ'),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        branch: true,
      },
    });

    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (error) {
    console.error('🔥 Error creating user:', error);
    res.status(500).json({ message: 'Failed to create user', error: error.message });
  }
};

// 3. Delete User (id is a String/UUID)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params; // id waa String (UUID)
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('🔥 Error deleting user:', error);
    res.status(500).json({ message: 'An error occurred while deleting the user', error: error.message });
  }
};