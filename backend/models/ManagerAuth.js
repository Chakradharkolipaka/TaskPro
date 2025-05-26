const mongoose = require('mongoose');

const ManagerAuthSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  createdAt: { type: Date, default: Date.now },
});
ManagerAuthSchema.set('collection', 'managerAuth');

module.exports = mongoose.model('ManagerAuth', ManagerAuthSchema);
