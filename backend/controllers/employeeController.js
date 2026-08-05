import prisma from "../prisma.js";

// 1. Fetch Employees (Admin: all/filterable; SALES/QC: their own branch only)
export const getEmployees = async (req, res) => {
  try {
    const { branch, department } = req.query;
    const where = {};

    if (req.user.role === "ADMIN") {
      if (branch && branch !== "All") where.branch = branch;
    } else {
      where.branch = req.user.branch;
    }

    if (department && department !== "All") where.department = department;

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { name: "asc" },
    });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: "Error fetching employees", error: error.message });
  }
};

// 2. Create a new Employee (Admin only)
export const createEmployee = async (req, res) => {
  try {
    const { name, branch, department, rate } = req.body;

    if (!name || !branch || !department || rate === undefined) {
      return res.status(400).json({ message: "Please fill in the name, branch, department, and rate" });
    }

    const employee = await prisma.employee.create({
      data: {
        name,
        branch,
        department,
        rate: Number(rate),
      },
    });

    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ message: "Failed to create employee", error: error.message });
  }
};

// 3. Update Employee (rate, status, etc.) — Admin only
export const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, branch, department, rate, status } = req.body;

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(branch !== undefined && { branch }),
        ...(department !== undefined && { department }),
        ...(rate !== undefined && { rate: Number(rate) }),
        ...(status !== undefined && { status }),
      },
    });

    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: "Failed to update employee", error: error.message });
  }
};

// 4. Delete Employee — Admin only
export const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.employee.delete({ where: { id } });
    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete employee", error: error.message });
  }
};
