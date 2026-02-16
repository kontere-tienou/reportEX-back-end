// /services/jobQueue.js

const Bull = require("bull");
const notificationQueue = new Bull("notificationQueue");

// Job to send email notifications for resolved tickets
notificationQueue.process(async (job) => {
  const { ticketId, email } = job.data;
  await sendTicketResolvedEmail(ticketId, email);
});

// Add job to the queue when a ticket is resolved
const addTicketNotificationJob = (ticketId, email) => {
  notificationQueue.add({ ticketId, email });
};

module.exports = { addTicketNotificationJob };
