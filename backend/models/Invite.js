const mongoose = require('mongoose');

const InviteSchema = new mongoose.Schema({
  email: { type: String, required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  role: { type: String, enum: ['Admin', 'Manager', 'Member'], default: 'Member' },
  token: { type: String, required: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => Date.now() + 1000 * 60 * 60 * 24 }, // 24 hours
  accepted: { type: Boolean, default: false },
});

InviteSchema.set('collection', 'invite');

module.exports = mongoose.model('Invite', InviteSchema);
