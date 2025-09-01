const express = require("express");
const {
  updateProfile,
  deleteResume,
  getPublicProfile,
} = require("../controllers/userController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

// Protected routes
router.put("/profile", protect, updateProfile);
router.post("/resume", protect, deleteResume);

// Public route
router.get("/:id", getPublicProfile);

module.exports = router;
