const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  phone: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: "Donor" },
  address: String,
  gender: String,
  photo: String,
  otp: String,
  verified: {
    type: Boolean,
    default: false
  },
  followers: [{ type: String }],
  following: [{ type: String }],
  favorites: [{ type: String }],
  profileMessages: [{
    fromPhone: String,
    fromName: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
  }],
  ratings: [{
    fromPhone: String,
    fromName: String,
    stars: Number,
    comment: String,
    timestamp: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model("User", userSchema);