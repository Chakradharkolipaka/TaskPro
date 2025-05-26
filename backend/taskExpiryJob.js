const cron = require('node-cron');
const Task = require('./models/Task');

// Runs every hour
cron.schedule('0 * * * *', async () => {
  try {
    const now = new Date();
    const expired = await Task.updateMany(
      { dueDate: { $lt: now }, status: { $in: ['Todo', 'In Progress'] } },
      { status: 'Expired' }
    );
    if (expired.modifiedCount > 0) {
      console.log(`Expired ${expired.modifiedCount} tasks`);
    }
  } catch (err) {
    console.error('Error expiring tasks:', err);
  }
});
