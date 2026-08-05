import prisma from "../prisma.js";

// 1. Fetch Registrars (Admin: all/filterable; SALES/QC: their own branch only)
export const getRegistrars = async (req, res) => {
  try {
    const { branch, role } = req.query;
    const where = {};

    if (req.user.role === "ADMIN") {
      if (branch && branch !== "All") where.branch = branch;
    } else {
      where.branch = req.user.branch;
      where.role = req.user.role;
    }

    if (role && req.user.role === "ADMIN") where.role = role;

    const registrars = await prisma.registrar.findMany({
      where,
      orderBy: { name: "asc" },
    });
    res.json(registrars);
  } catch (error) {
    res.status(500).json({ message: "Error fetching registrars", error: error.message });
  }
};

// 2. Create a new Registrar (Admin only)
export const createRegistrar = async (req, res) => {
  try {
    const { name, branch, role } = req.body;

    if (!name || !branch || !role) {
      return res.status(400).json({ message: "Please fill in the name, branch, and role" });
    }
    if (!["SALES", "QUALITY_CONTROL"].includes(role)) {
      return res.status(400).json({ message: "Role must be SALES or QUALITY_CONTROL" });
    }

    const registrar = await prisma.registrar.create({
      data: { name, branch, role },
    });

    res.status(201).json(registrar);
  } catch (error) {
    res.status(500).json({ message: "Failed to create registrar", error: error.message });
  }
};

// 3. Update Registrar — Admin only
export const updateRegistrar = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, branch, role, status } = req.body;

    const registrar = await prisma.registrar.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(branch !== undefined && { branch }),
        ...(role !== undefined && { role }),
        ...(status !== undefined && { status }),
      },
    });

    res.json(registrar);
  } catch (error) {
    res.status(500).json({ message: "Failed to update registrar", error: error.message });
  }
};

// 4. Delete Registrar — Admin only
export const deleteRegistrar = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.registrar.delete({ where: { id } });
    res.json({ message: "Registrar deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete registrar", error: error.message });
  }
};
