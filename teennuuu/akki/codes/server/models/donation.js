const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  food: {
    type: String,
    required: true
  },

  foodName: {
    type: String,
    required: true
  },

  quantity: {
    type: String,
    required: true
  },

  address: {
    type: String,
    required: true
  },

  pickupDate: {
    type: String,
    required: true
  },

  expiryTime: {
    type: String,
    required: true
  },

  phone: {
    type: String,
    required: true
  },

  status: {
    type: String,
    default: "Pending"
  },

  photo: {
    type: String,
    default: ""
  },
  photos: {
    type: [String],
    default: []
  },
  additionalInfo: {
    type: String,
    default: ""
  },
  foodLabel: {
    type: String,
    default: ""
  },
  lat: {
    type: String,
    default: ""
  },
  lng: {
    type: String,
    default: ""
  },

  acceptedBy: {
    type: String,
    default: ""
  },

  isNotified: {
    type: Boolean,
    default: false
  },

  likes: [{ type: String }],
  comments: [{
    userPhone: String,
    userName: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
  }],
  ratings: [{
    userPhone: String,
    rating: Number,
    feedback: String,
    timestamp: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model("Donation", donationSchema);