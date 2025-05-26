const mongoose = require('mongoose');

const OrganizationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  theme: { type: String, default: 'default' }, // optional
  createdAt: { type: Date, default: Date.now },
});

OrganizationSchema.set('collection', 'organization');

module.exports = mongoose.model('Organization', OrganizationSchema);
