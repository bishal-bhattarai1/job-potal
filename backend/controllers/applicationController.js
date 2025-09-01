const Application = require("../models/Application");
const Job = require("../models/Job");
const getStatusEmailContent = require("../utils/emailTemplates");
const nodemailer = require("nodemailer");

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password
  },
  logger: true,
  debug: true,
});

// Verify transporter connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP connection failed:", error);
  } else {
    console.log("✅ SMTP server is ready to send emails");
  }
});

// @desc    Apply to a job
exports.applyToJob = async (req, res) => {
  try {
    if (req.user.role !== "jobseeker") {
      return res.status(403).json({ message: "Only job seekers can apply" });
    }

    const existing = await Application.findOne({
      job: req.params.jobId,
      applicant: req.user._id,
    });

    if (existing) {
      return res.status(400).json({ message: "Already applied to this job" });
    }

    const application = await Application.create({
      job: req.params.jobId,
      applicant: req.user._id,
      resume: req.user.resume,
    });

    res.status(201).json(application);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get logged-in user's applications
exports.getMyApplications = async (req, res) => {
  try {
    const apps = await Application.find({ applicant: req.user._id })
      .populate("job", "title company location type")
      .sort({ createdAt: -1 });

    res.json(apps);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get all applicants for a job (Employer)
exports.getApplicantsForJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);

    if (!job || job.company.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to view applicants" });
    }

    const applications = await Application.find({ job: req.params.jobId })
      .populate("job", "title location category type")
      .populate("applicant", "name email avatar resume");

    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get application by ID (Jobseeker or Employer)
exports.getApplicationById = async (req, res) => {
  try {
    const app = await Application.findById(req.params.id)
      .populate("job", "title company")
      .populate("applicant", "name email avatar resume");

    if (!app) return res.status(404).json({ message: "Application not found." });

    const isOwner =
      app.applicant._id.toString() === req.user._id.toString() ||
      app.job.company.toString() === req.user._id.toString();

    if (!isOwner) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this application" });
    }

    res.json(app);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update application status (Employer) and send email
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const app = await Application.findById(req.params.id)
      .populate("job")
      .populate("applicant");

    if (!app) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (app.job.company.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this application" });
    }

    // Update status
    app.status = status;
    await app.save();

    // Send email to applicant
    if (app.applicant?.email) {
      const emailContent = getStatusEmailContent(
        app.applicant.name,
        app.job.title,
        status
      );

      if (emailContent) {
        try {
          const info = await transporter.sendMail({
            from: process.env.EMAIL_USER, // keep consistent with Gmail login
            to: app.applicant.email,
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.text.replace(/\n/g, "<br>"),
          });

          console.log("✅ Email sent:", info.response);
        } catch (emailErr) {
          console.error("❌ Failed to send email:", emailErr);
        }
      }
    }

    res.json({
      message: "Application status updated and email sent (if possible)",
      status,
    });
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({ message: err.message });
  }
};
