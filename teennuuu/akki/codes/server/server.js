require("dotenv").config({ path: __dirname + "/.env" });
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const connectDB = require("./config/db");
const Donation = require("./models/donation");
const User = require("./models/user");
const Message = require("./models/message");
const Notification = require("./models/notification");
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: "*" }
});

const userSockets = {}; // Map phone -> socketId

io.on('connection', (socket) => {
  socket.on('register', (phone) => {
    userSockets[phone] = socket.id;
    console.log(`Socket registered for ${phone}: ${socket.id}`);
  });

  socket.on('disconnect', () => {
    for (const phone in userSockets) {
      if (userSockets[phone] === socket.id) {
        delete userSockets[phone];
        break;
      }
    }
  });
});

function sendRealTimeNotification(phone, notif) {
  const socketId = userSockets[phone];
  if (socketId) {
    io.to(socketId).emit('notification', notif);
  }
}

console.log(process.cwd());
console.log(process.env.MONGO_URI);
// Connect MongoDB
connectDB();

/* ======================
   MIDDLEWARE
====================== */
const cors = require("cors");
app.use(cors());
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
app.use(express.json({ limit: '100mb' }));

app.use(express.static(path.join(__dirname, "../public")));
app.use(express.static(path.join(__dirname, "../views")));


/* ======================
   HOME PAGE
====================== */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/FOOOD.html"));
});
//test
app.get("/test", (req, res) => {
  res.send("working");
});
app.get("/donations", async (req, res) => {
  const donations = await Donation.find();
  res.json(donations);
});


/* ======================
   USER AUTH
====================== */

app.post("/api/register", async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already registered" });
    }
    user = new User({ name: username, email, phone, password });
    await user.save();
    res.status(201).json({ message: "Registration Successful", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
      password: password
    });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials or user not registered." });
    }
    res.json({ message: "Login Successful", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/forgot", async (req, res) => {
  try {
    const { identifier, newPassword } = req.body;
    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }]
    });

    if (!user) {
      return res.status(404).json({ message: "No account found matching that email or phone number." });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: "Password securely updated." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error updating password" });
  }
});

/* ======================
   USER PROFILE
====================== */

app.get("/api/profile/:phone", async (req, res) => {
  try {
    const user = await User.findOne({ phone: req.params.phone });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/profile/:phone", async (req, res) => {
  try {
    const updatedUser = await User.findOneAndUpdate(
      { phone: req.params.phone },
      { $set: req.body },
      { new: true }
    );
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: "Server error updating profile" });
  }
});

app.get("/api/user/donations/:phone", async (req, res) => {
  try {
    const donations = await Donation.find({ phone: req.params.phone });
    res.json(donations);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================
   DONATE FOOD
====================== */

app.post("/donate", async (req, res) => {
  try {
    const donation = new Donation({
      name: req.body.name,
      food: req.body.food,
      foodName: req.body.foodName || req.body.food, // fallback
      quantity: req.body.quantity,
      address: req.body.address,
      pickupDate: req.body.pickupDate,
      expiryTime: req.body.expiryTime,
      phone: req.body.phone,
      phone: req.body.phone,
      photo: req.body.photo || "",
      photos: req.body.photos || [],
      foodLabel: req.body.foodLabel || "",
      additionalInfo: req.body.additionalInfo || "",
      lat: req.body.lat || "",
      lng: req.body.lng || ""
    });
    await donation.save();
    res.json({ message: "Donation Request Sent Successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error saving donation");
  }
});

/* ======================
   GET ALL DONATIONS (API)
====================== */
app.get("/api/donations", async (req, res) => {
  try {
    const donations = await Donation.find();
    res.json(donations);
  } catch (error) {
    res.status(500).json({ message: "Error fetching donations" });
  }
});


/* ======================
   ACCEPT / DELETE DONATION API
====================== */

app.put("/api/donations/:id/accept", async (req, res) => {
  try {
    const acceptedBy = req.body.acceptedBy || "someone";
    const newStatus = req.body.status || "Accepted";
    const donation = await Donation.findByIdAndUpdate(req.params.id, {
      status: newStatus,
      acceptedBy: acceptedBy,
      isNotified: false
    }, { new: true });

    // Create a notification for the donor
    const notif = new Notification({
      recipientPhone: donation.phone,
      senderPhone: "NGO", // System indicator
      senderName: acceptedBy,
      type: "donation_accepted",
      text: `🎉 Great news! Your donation of ${donation.quantity} ${donation.foodName || donation.food} was just accepted by ${acceptedBy}!`,
      data: { donationId: donation._id }
    });
    await notif.save();

    sendRealTimeNotification(donation.phone, notif);

    res.json({ message: "Donation Accepted" });
  } catch (error) {
    res.status(500).json({ message: "Error updating status" });
  }
});

/* ======================
   NOTIFICATIONS API
====================== */

app.get("/api/notifications/:phone", async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientPhone: req.params.phone }).sort({ timestamp: -1 });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Error fetching notifications" });
  }
});

app.put("/api/notifications/:id/read", async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ message: "Marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Error updating notification" });
  }
});

// Old polling for backward compatibility in FOOOD.html if still used
app.get("/api/notifications/old/:phone", async (req, res) => {
  try {
    const notifications = await Donation.find({
      phone: req.params.phone,
      status: "Accepted",
      isNotified: false
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Error fetching notifications" });
  }
});

app.put("/api/donations/:id/notified", async (req, res) => {
  try {
    await Donation.findByIdAndUpdate(req.params.id, { isNotified: true });
    res.json({ message: "Marked as notified" });
  } catch (error) {
    res.status(500).json({ message: "Error marking notified" });
  }
});

app.delete("/api/donations/:id", async (req, res) => {
  try {
    await Donation.findByIdAndDelete(req.params.id);
    res.json({ message: "Donation Deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting donation" });
  }
});

app.put("/api/donations/:id/edit", async (req, res) => {
  try {
    const updatedDonation = await Donation.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    res.json({ message: "Donation Updated", updatedDonation });
  } catch (error) {
    res.status(500).json({ message: "Error updating donation" });
  }
});

/* ======================
   SOCIAL FEATURES API
====================== */

// Toggle follow
app.put("/api/profile/:phone/follow", async (req, res) => {
  try {
    const targetPhone = req.params.phone; 
    const currentUserPhone = req.body.currentUserPhone; // passing from frontend
    
    if (targetPhone === currentUserPhone) return res.status(400).json({ message: "Cannot follow yourself" });

    const targetUser = await User.findOne({ phone: targetPhone });
    const currentUser = await User.findOne({ phone: currentUserPhone });

    if (!targetUser || !currentUser) return res.status(404).json({ message: "User not found" });

    let isFollowing = currentUser.following.includes(targetPhone);

    if (isFollowing) {
      // Unfollow
      currentUser.following = currentUser.following.filter(p => p !== targetPhone);
      targetUser.followers = targetUser.followers.filter(p => p !== currentUserPhone);
    } else {
      // Follow
      currentUser.following.push(targetPhone);
      targetUser.followers.push(currentUserPhone);
    }

    await currentUser.save();
    await targetUser.save();

    // Trigger Notification on Follow
    if (!isFollowing) {
      const followNotif = new Notification({
        recipientPhone: targetPhone,
        senderPhone: currentUserPhone,
        senderName: currentUser.name,
        type: "follow",
        text: `👤 ${currentUser.name} started following you!`,
        data: { followerPhone: currentUserPhone }
      });
      await followNotif.save();
      sendRealTimeNotification(targetPhone, followNotif);
    }

    res.json({ message: isFollowing ? "Unfollowed" : "Followed", following: !isFollowing });
  } catch (error) {
    res.status(500).json({ message: "Error toggling follow" });
  }
});

// Add profile message
app.post("/api/profile/:phone/message", async (req, res) => {
  try {
    const targetPhone = req.params.phone;
    const { fromPhone, fromName, text } = req.body;

    const user = await User.findOne({ phone: targetPhone });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.profileMessages.push({ fromPhone, fromName, text });
    await user.save();

    res.json({ message: "Message added", messages: user.profileMessages });
  } catch (error) {
    res.status(500).json({ message: "Error adding message" });
  }
});

// Toggle Donation Like
app.put("/api/donations/:id/like", async (req, res) => {
  try {
    const { userPhone } = req.body;
    const donation = await Donation.findById(req.params.id);
    if (!donation) return res.status(404).json({ message: "Donation not found" });

    let isLiked = donation.likes.includes(userPhone);

    if (isLiked) {
      donation.likes = donation.likes.filter(p => p !== userPhone);
    } else {
      donation.likes.push(userPhone);
    }

    await donation.save();

    // Toggle Favorite simultaneously
    const user = await User.findOne({ phone: userPhone });
    let favorites = [];
    if (user) {
      if (isLiked) {
        user.favorites = user.favorites.filter(id => id.toString() !== req.params.id);
      } else {
        if (!user.favorites.includes(req.params.id)) {
          user.favorites.push(req.params.id);
        }
      }
      await user.save();
      favorites = user.favorites;
    }

    res.json({ message: isLiked ? "Unliked" : "Liked", likes: donation.likes, favorites: favorites });

    if (!isLiked) {
      const likeNotif = new Notification({
        recipientPhone: donation.phone,
        senderPhone: userPhone,
        senderName: user ? user.name : "Someone",
        type: "like",
        text: `❤️ ${user ? user.name : "Someone"} liked your donation post: ${donation.foodName || donation.food}`,
        data: { donationId: donation._id }
      });
      await likeNotif.save();
      sendRealTimeNotification(donation.phone, likeNotif);
    }
  } catch (error) {
    res.status(500).json({ message: "Error toggling like" });
  }
});

// Add Donation Comment
app.post("/api/donations/:id/comment", async (req, res) => {
  try {
    const { userPhone, userName, text } = req.body;
    const donation = await Donation.findById(req.params.id);
    if (!donation) return res.status(404).json({ message: "Donation not found" });

    donation.comments.push({ userPhone, userName, text });
    await donation.save();

    res.json({ message: "Comment added", comments: donation.comments });

    const commentNotif = new Notification({
      recipientPhone: donation.phone,
      senderPhone: userPhone,
      senderName: userName,
      type: "comment",
      text: `💬 ${userName} commented on your donation: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`,
      data: { donationId: donation._id }
    });
    await commentNotif.save();
    sendRealTimeNotification(donation.phone, commentNotif);
  } catch (error) {
    res.status(500).json({ message: "Error adding comment" });
  }
});

// Toggle User Favorite Donation
app.put("/api/user/:phone/favorite/:donationId", async (req, res) => {
  try {
    const { phone, donationId } = req.params;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });

    let isFavorited = user.favorites.includes(donationId);

    if (isFavorited) {
      user.favorites = user.favorites.filter(id => id !== donationId);
    } else {
      user.favorites.push(donationId);
    }

    await user.save();
    res.json({ message: isFavorited ? "Removed from favorites" : "Added to favorites", favorites: user.favorites });
  } catch (error) {
    res.status(500).json({ message: "Error toggling favorite" });
  }
});

/* ======================
   POST RATING API
====================== */
app.post("/api/donations/:id/rate", async (req, res) => {
  try {
    const { userPhone, rating, feedback } = req.body;
    const donation = await Donation.findById(req.params.id);
    if (!donation) return res.status(404).json({ message: "Donation not found" });

    const existing = donation.ratings.findIndex(r => r.userPhone === userPhone);
    if (existing > -1) {
      donation.ratings[existing].rating = rating;
      donation.ratings[existing].feedback = feedback;
    } else {
      donation.ratings.push({ userPhone, rating, feedback });
    }
    
    await donation.save();
    res.json({ message: "Rated successfully", ratings: donation.ratings });
  } catch (error) {
    res.status(500).json({ message: "Error rating donation" });
  }
});

/* ======================
   USER RATING API
====================== */
app.post("/api/profile/:phone/rate", async (req, res) => {
  try {
    const { fromPhone, fromName, stars, comment } = req.body;
    const targetUser = await User.findOne({ phone: req.params.phone });
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    const existing = targetUser.ratings.findIndex(r => r.fromPhone === fromPhone);
    if (existing > -1) {
      targetUser.ratings[existing].stars = stars;
      targetUser.ratings[existing].comment = comment;
    } else {
      targetUser.ratings.push({ fromPhone, fromName, stars, comment });
    }

    await targetUser.save();

    // Notify user about new rating
    const ratingNotif = new Notification({
      recipientPhone: req.params.phone,
      senderPhone: fromPhone,
      senderName: fromName,
      type: "rating",
      text: `⭐ ${fromName} gave you a ${stars}-star rating!`,
      data: { fromPhone }
    });
    await ratingNotif.save();
    sendRealTimeNotification(req.params.phone, ratingNotif);

    res.json({ message: "Rating submitted", ratings: targetUser.ratings });
  } catch (error) {
    res.status(500).json({ message: "Error submitting rating" });
  }
});

/* ======================
   PRIVATE CHAT API
====================== */

// Specific routes first!
app.get("/api/chat/conversations/:phone", async (req, res) => {
  try {
    const phone = req.params.phone;
    // Find all message documents where the given phone is a participant
    const chats = await Message.find({ participants: phone });
    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: "Error fetching conversations" });
  }
});

// Dynamic routes last!
app.get("/api/chat/:phone1/:phone2", async (req, res) => {
  try {
    const { phone1, phone2 } = req.params;
    let chat = await Message.findOne({
      participants: { $all: [phone1, phone2], $size: 2 }
    });
    if (!chat) {
      chat = { messages: [] };
    }
    res.json(chat);
  } catch (error) {
    res.status(500).json({ message: "Error fetching chat" });
  }
});

app.post("/api/chat/:phone1/:phone2", async (req, res) => {
  try {
    const { phone1, phone2 } = req.params;
    const { senderPhone, senderName, text } = req.body;
    let chat = await Message.findOne({
      participants: { $all: [phone1, phone2], $size: 2 }
    });
    if (!chat) {
      chat = new Message({ participants: [phone1, phone2], messages: [] });
    }
    chat.messages.push({ senderPhone, senderName, text });
    await chat.save();

    // Create Notification for recipient
    const recipientPhone = phone1 === senderPhone ? phone2 : phone1;
    const msgNotif = new Notification({
      recipientPhone: recipientPhone,
      senderPhone: senderPhone,
      senderName: senderName,
      type: "message",
      text: `💬 New message from ${senderName}: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`,
      data: { senderPhone: senderPhone }
    });
    await msgNotif.save();

    res.json({ message: "Sent", messages: chat.messages });
  } catch (error) {
    res.status(500).json({ message: "Error sending message" });
  }
});

/* ======================
   START SERVER
====================== */

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {

  console.log(`Server running at http://localhost:${PORT}`);

});