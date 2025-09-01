const express = require("express");
const {
  applyToJob,
  getMyApplications,
  getApplicantsForJob,
  getApplicationById,
  updateStatus,
} = require("../controllers/applicationController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

// Apply to a job (Jobseeker)
router.post("/:jobId", protect, applyToJob);

// Get logged-in user's applications (Jobseeker)
router.get("/my", protect, getMyApplications);

// Get all applicants for a specific job (Employer)
router.get("/job/:jobId", protect, getApplicantsForJob);

// Get a specific application by ID (Jobseeker or Employer)
router.get("/:id", protect, getApplicationById);

// Update application status and send email (Employer)
router.put("/:id/status", protect, updateStatus);

module.exports = router;
