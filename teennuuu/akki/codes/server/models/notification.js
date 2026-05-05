const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipientPhone: { type: String, required: true },
  senderPhone: { type: String, required: true },
  senderName: { type: String, required: true },
  type: { 
    type: String, 
    enum: ["message", "follow", "donation_accepted"], 
    required: true 
  },
  text: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed }, // e.g., donationId
  isRead: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notification", notificationSchema);
