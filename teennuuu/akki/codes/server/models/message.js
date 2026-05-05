const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  participants: [{ type: String }],
  messages: [{
    senderPhone: String,
    senderName: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model("Message", messageSchema);
