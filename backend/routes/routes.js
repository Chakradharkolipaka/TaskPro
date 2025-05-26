const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const controller = require('../controller/controller');

const router = express.Router();

// ===================== AUTH & USER =====================
// Register (create org or join via invite)
router.post('/register', controller.register);
// Register Admin
router.post('/register/admin', controller.registerAdmin);
// Register Manager
router.post('/register/manager', controller.registerManager);
// Register Member
router.post('/register/member', controller.registerMember);
// Login
router.post('/login', controller.login);
// Invite user (Admin/Manager)
router.post('/invite', auth, authorize('Admin', 'Manager'), controller.invite);
// Admin Login
router.post('/login/admin', controller.loginAdmin);
// Member Login
router.post('/login/member', controller.loginMember);
// Manager Login
router.post('/login/manager', controller.loginManager);

// ===================== TASKS =====================
// Create Task (Manager/Admin)
router.post('/tasks', auth, authorize('Admin', 'Manager'), controller.createTask);
// Get all tasks for org (Member+)
router.get('/tasks', auth, controller.getTasks);
// Update Task (Manager/Admin)
router.put('/tasks/:id', auth, authorize('Admin', 'Manager'), controller.updateTask);
// Delete Task (Manager/Admin)
router.delete('/tasks/:id', auth, authorize('Admin', 'Manager'), controller.deleteTask);
// Update status (Member, only assigned tasks)
router.patch('/tasks/:id/status', auth, authorize('Member', 'Manager', 'Admin'), controller.updateTaskStatus);

// ===================== MEMBERS =====================
// Get all users in org (Admin/Manager)
router.get('/members', auth, authorize('Admin', 'Manager'), controller.getMembers);
// Remove user (Admin)
router.delete('/members/:id', auth, authorize('Admin'), controller.removeMember);
// Update user role (Admin)
router.patch('/members/:id/role', auth, authorize('Admin'), controller.updateMemberRole);
// Update member details (Admin)
router.put('/members/:id', auth, authorize('Admin'), controller.updateMember);

// ===================== DASHBOARD =====================
// Dashboard stats for org (Admin/Manager)
router.get('/dashboard/stats', auth, controller.getDashboardStats);

// ===================== ORGANIZATION =====================
// Get current user's organization info
router.get('/org', auth, controller.getOrganization);
// Create organization (Admin only)
router.post('/org', auth, authorize('Admin'), controller.createOrganization);
// Edit organization (Admin only)
router.put('/org', auth, authorize('Admin'), controller.editOrganization);
// Delete organization (Admin only)
router.delete('/org', auth, authorize('Admin'), controller.deleteOrganization);

module.exports = router;
