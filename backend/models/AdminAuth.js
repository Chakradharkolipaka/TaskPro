const mongoose = require('mongoose');

const AdminAuthSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  createdAt: { type: Date, default: Date.now },
});
AdminAuthSchema.set('collection', 'adminAuth');

module.exports = mongoose.model('AdminAuth', AdminAuthSchema);
