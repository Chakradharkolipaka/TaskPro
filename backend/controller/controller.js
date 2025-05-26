// controller.js - All controller functions for user, organization, task, invite, dashboard, and member management
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Invite = require('../models/Invite');
const Task = require('../models/Task');
const AdminAuth = require('../models/AdminAuth');
const MemberAuth = require('../models/MemberAuth');
const ManagerAuth = require('../models/ManagerAuth');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// ===================== AUTH & USER =====================
// Register (create org or join via invite)
exports.register = async (req, res) => {
  const { name, email, password, organizationName, inviteToken } = req.body;
  try {
    let organization;
    if (inviteToken) {
      // Join via invite
      const invite = await Invite.findOne({ token: inviteToken, expiresAt: { $gt: Date.now() }, accepted: false });
      if (!invite) return res.status(400).json({ message: 'Invalid or expired invite' });
      organization = invite.organization;
      invite.accepted = true;
      await invite.save();
    } else {
      // Create new org
      if (!organizationName) return res.status(400).json({ message: 'Organization name required' });
      organization = await Organization.create({ name: organizationName });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      organization,
      role: inviteToken ? invite.role : 'Admin',
    });
    const token = jwt.sign({ id: user._id, organization: user.organization, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, organization: user.organization, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Invite user (Admin/Manager)
exports.invite = async (req, res) => {
  const { email, role } = req.body;
  try {
    const inviteToken = crypto.randomBytes(20).toString('hex');
    const invite = await Invite.create({
      email,
      organization: req.user.organization,
      role,
      token: inviteToken,
      invitedBy: req.user.id,
    });
    // Generate invite link
    let inviteLink = `/register?inviteToken=${inviteToken}`;
    if (role === 'Manager') {
      inviteLink = `/register/manager?inviteToken=${inviteToken}`;
    }
    // Send email to the receiver
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'your_ethereal_user',
        pass: process.env.SMTP_PASS || 'your_ethereal_pass',
      },
    });
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@taskpro.com',
      to: email,
      subject: `TaskPro Invitation (${role})`,
      text: `You have been invited to join TaskPro as a ${role} for your organization.\n\nClick the link below to register:\n${process.env.FRONTEND_URL || 'http://localhost:3000'}${inviteLink}\n\nIf you did not expect this invitation, you can ignore this email.`,
    };
    // Send the email (do not block response on error)
    transporter.sendMail(mailOptions, function(err, info) {
      if (err) {
        console.error('Invite email failed:', err);
      } else {
        console.log('Invite email sent:', info && info.response);
      }
    });
    res.json({ inviteLink });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin Registration
exports.registerAdmin = async (req, res) => {
  const { name, email, password, organizationName } = req.body;
  try {
    if (!organizationName) return res.status(400).json({ message: 'Organization name required' });
    // Check if org exists, else create
    let organization = await Organization.findOne({ name: organizationName });
    if (!organization) organization = await Organization.create({ name: organizationName });
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create admin in AdminAuth
    let admin = await AdminAuth.findOne({ email, organization });
    if (!admin) {
      admin = await AdminAuth.create({
        name,
        email,
        password: hashedPassword,
        organization,
      });
    }
    const token = jwt.sign({ id: admin._id, organization: admin.organization, role: 'Admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    // Return admin info (omit password)
    const adminObj = admin.toObject();
    delete adminObj.password;
    res.json({ token, user: { ...adminObj, role: 'Admin' } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Member Registration
exports.registerMember = async (req, res) => {
  const { name, email, password, organizationName } = req.body;
  try {
    if (!organizationName) return res.status(400).json({ message: 'Organization name required' });
    const organization = await Organization.findOne({ name: organizationName });
    if (!organization) return res.status(400).json({ message: 'Organization not found' });
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create in MemberAuth
    const member = await MemberAuth.create({
      name,
      email,
      password: hashedPassword,
      organization,
    });
    const token = jwt.sign({ id: member._id, organization: member.organization, role: 'Member' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    // Return member info (omit password)
    const memberObj = member.toObject();
    delete memberObj.password;
    res.json({ token, user: { ...memberObj, role: 'Member' } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Manager Registration
exports.registerManager = async (req, res) => {
  const { name, email, password, organizationName, inviteToken } = req.body;
  try {
    // Require inviteToken for manager registration
    if (!inviteToken) return res.status(400).json({ message: 'Invite token required for manager registration' });
    // Validate invite (accept both /register and /register/manager flows)
    const invite = await Invite.findOne({ token: inviteToken, expiresAt: { $gt: Date.now() }, accepted: false });
    if (!invite || invite.role !== 'Manager') return res.status(400).json({ message: 'Invalid or expired invite' });
    // Use org from invite
    const organization = invite.organization;
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create in ManagerAuth
    const manager = await ManagerAuth.create({
      name,
      email,
      password: hashedPassword,
      organization,
    });
    // Mark invite as accepted
    invite.accepted = true;
    await invite.save();
    const token = jwt.sign({ id: manager._id, organization: manager.organization, role: 'Manager' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    // Return manager info (omit password)
    const managerObj = manager.toObject();
    delete managerObj.password;
    res.json({ token, user: { ...managerObj, role: 'Manager' } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin Login
exports.loginAdmin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await AdminAuth.findOne({ email });
    if (!admin) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: admin._id, organization: admin.organization, role: 'Admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    // Return admin info (omit password)
    const adminObj = admin.toObject();
    delete adminObj.password;
    res.json({ token, user: { ...adminObj, role: 'Admin' } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Member Login
exports.loginMember = async (req, res) => {
  const { email, password } = req.body;
  try {
    const member = await MemberAuth.findOne({ email });
    if (!member) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, member.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: member._id, organization: member.organization, role: 'Member' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    // Return member info (omit password)
    const memberObj = member.toObject();
    delete memberObj.password;
    res.json({ token, user: { ...memberObj, role: 'Member' } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Manager Login
exports.loginManager = async (req, res) => {
  const { email, password } = req.body;
  try {
    const manager = await ManagerAuth.findOne({ email });
    if (!manager) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, manager.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: manager._id, organization: manager.organization, role: 'Manager' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    // Return manager info (omit password)
    const managerObj = manager.toObject();
    delete managerObj.password;
    res.json({ token, user: { ...managerObj, role: 'Manager' } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ===================== TASKS =====================
// Create Task (Manager/Admin)
exports.createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, category, priority, dueDate } = req.body;
    const task = await Task.create({
      title,
      description,
      organization: req.user.organization,
      assignedTo,
      category,
      priority,
      dueDate,
      createdBy: req.user.id,
    });
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// Get all tasks for org (Member+)
exports.getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ organization: req.user.organization });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// Update Task (Manager/Admin)
exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      req.body,
      { new: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// Delete Task (Manager/Admin)
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, organization: req.user.organization });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// Update status (Member, only assigned tasks)
exports.updateTaskStatus = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, organization: req.user.organization });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (req.user.role === 'Member' && String(task.assignedTo) !== req.user.id) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    task.status = req.body.status;
    await task.save();
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ===================== MEMBERS =====================
// Get all users in org (Admin/Manager)
exports.getMembers = async (req, res) => {
  try {
    const users = await User.find({ organization: req.user.organization }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// Remove user (Admin)
exports.removeMember = async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id, organization: req.user.organization });
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Remove from MemberAuth or ManagerAuth as well
    if (user.role === 'Member') {
      await MemberAuth.findOneAndDelete({ email: user.email, organization: req.user.organization });
    } else if (user.role === 'Manager') {
      await ManagerAuth.findOneAndDelete({ email: user.email, organization: req.user.organization });
    }
    res.json({ message: 'User removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// Update user role (Admin)
exports.updateMemberRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { role },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// Update member details (Admin)
exports.updateMember = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const update = { name, email };
    if (password) {
      update.password = await bcrypt.hash(password, 10);
    }
    // Update in User collection
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      update,
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Also update in MemberAuth or ManagerAuth if exists
    if (user.role === 'Member') {
      await MemberAuth.findOneAndUpdate(
        { email: user.email, organization: req.user.organization },
        update
      );
    } else if (user.role === 'Manager') {
      await ManagerAuth.findOneAndUpdate(
        { email: user.email, organization: req.user.organization },
        update
      );
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ===================== DASHBOARD =====================
// Dashboard stats for org (Admin/Manager)
exports.getDashboardStats = async (req, res) => {
  try {
    const org = req.user.organization;
    const total = await Task.countDocuments({ organization: org });
    const overdue = await Task.countDocuments({ organization: org, status: 'Expired' });
    const completed = await Task.countDocuments({ organization: org, status: 'Completed' });
    const byCategory = await Task.aggregate([
      { $match: { organization: org } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    const byPriority = await Task.aggregate([
      { $match: { organization: org } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);
    res.json({ total, overdue, completed, byCategory, byPriority });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ===================== ORGANIZATION =====================
// Get current user's organization info
exports.getOrganization = async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organization);
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.json(org);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create organization (Admin only)
exports.createOrganization = async (req, res) => {
  try {
    const { name, theme } = req.body;
    if (!name) return res.status(400).json({ message: 'Organization name required' });
    // Only allow one org per admin user
    const existing = await Organization.findOne({ name });
    if (existing) return res.status(400).json({ message: 'Organization already exists' });
    const org = await Organization.create({ name, theme });
    // Update admin's organization reference
    await User.findByIdAndUpdate(req.user.id, { organization: org._id });
    res.status(201).json(org);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Edit organization (Admin only)
exports.editOrganization = async (req, res) => {
  try {
    const { name, theme } = req.body;
    const org = await Organization.findByIdAndUpdate(
      req.user.organization,
      { name, theme },
      { new: true }
    );
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.json(org);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete organization (Admin only)
exports.deleteOrganization = async (req, res) => {
  try {
    const org = await Organization.findByIdAndDelete(req.user.organization);
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    // Optionally, remove all users, tasks, etc. in this org
    await User.deleteMany({ organization: org._id });
    await Task.deleteMany({ organization: org._id });
    res.json({ message: 'Organization and related data deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
