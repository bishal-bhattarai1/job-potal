const Job = require("../models/Job");
const User = require("../models/User");
const Application = require("../models/Application");
const SavedJob = require("../models/SavedJob");
const { applicationStatusEmail } = require("../utils/emailTemplates");


//
// ---------------- JOB CONTROLLERS ----------------
//

// @desc    Create a new job (Employer only)e
exports.createJob = async (req, res) => {
  try {
    if (req.user.role !== "employer") {
      return res.status(403).json({ message: "Only employers can post jobs" });
    }

    const job = await Job.create({ ...req.body, company: req.user._id });
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get all jobs (with filters + saved/applied status if userId given)
exports.getJobs = async (req, res) => {
  const {
    keyword,
    location,
    category,
    type,
    minSalary,
    maxSalary,
    userId,
  } = req.query;

  const query = {
    isClosed: false,
    ...(keyword && { title: { $regex: keyword, $options: "i" } }),
    ...(location && { location: { $regex: location, $options: "i" } }),
    ...(category && { category }),
    ...(type && { type }),
  };

  if (minSalary || maxSalary) {
    query.$and = [];

    if (minSalary) query.$and.push({ salaryMax: { $gte: Number(minSalary) } });
    if (maxSalary) query.$and.push({ salaryMin: { $lte: Number(maxSalary) } });

    if (query.$and.length === 0) delete query.$and;
  }

  try {
    const jobs = await Job.find(query).populate(
      "company",
      "name companyName companyLogo"
    );

    let savedJobIds = [];
    let appliedJobStatusMap = {};

    if (userId) {
      // Saved jobs
      const savedJobs = await SavedJob.find({ jobseeker: userId }).select("job");
      savedJobIds = savedJobs.map((s) => String(s.job));

      // Applications
      const applications = await Application.find({ applicant: userId }).select(
        "job status"
      );
      applications.forEach((app) => {
        appliedJobStatusMap[String(app.job)] = app.status;
      });
    }

    const jobsWithExtras = jobs.map((job) => {
      const jobIdStr = String(job._id);
      return {
        ...job.toObject(),
        isSaved: savedJobIds.includes(jobIdStr),
        applicationStatus: appliedJobStatusMap[jobIdStr] || null,
      };
    });

    res.json(jobsWithExtras);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get employer's jobs with application counts
exports.getJobsEmployer = async (req, res) => {
  try {
    const userId = req.user._id;

    if (req.user.role !== "employer") {
      return res.status(403).json({ message: "Access denied" });
    }

    const jobs = await Job.find({ company: userId })
      .populate("company", "name companyName companyLogo")
      .lean();

    const jobsWithCounts = await Promise.all(
      jobs.map(async (job) => {
        const applicationCount = await Application.countDocuments({ job: job._id });
        return { ...job, applicationCount };
      })
    );

    res.json(jobsWithCounts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get single job by ID (with applicationStatus if userId given)
exports.getJobById = async (req, res) => {
  try {
    const { userId } = req.query;

    const job = await Job.findById(req.params.id).populate(
      "company",
      "name companyName companyLogo"
    );

    if (!job) return res.status(404).json({ message: "Job not found" });

    let applicationStatus = null;
    if (userId) {
      const application = await Application.findOne({
        job: job._id,
        applicant: userId,
      }).select("status");
      if (application) applicationStatus = application.status;
    }

    res.json({ ...job.toObject(), applicationStatus });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update job (Employer only)
exports.updateJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });

    if (job.company.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    Object.assign(job, req.body);
    const updated = await job.save();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Delete job (Employer only)
exports.deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });

    if (job.company.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await job.deleteOne();
    res.json({ message: "Job deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Toggle close status
exports.toggleCloseJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });

    if (job.company.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    job.isClosed = !job.isClosed;
    await job.save();
    res.json({ message: `Job ${job.isClosed ? "closed" : "reopened"}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//
// ---------------- APPLICATION CONTROLLERS ----------------
//

// @desc    Apply to a job
exports.applyJob = async (req, res) => {
  try {
    if (req.user.role !== "jobseeker") {
      return res.status(403).json({ message: "Only jobseekers can apply" });
    }

    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    const existing = await Application.findOne({
      job: job._id,
      applicant: req.user._id,
    });
    if (existing) return res.status(400).json({ message: "Already applied" });

    const application = await Application.create({
      job: job._id,
      applicant: req.user._id,
      status: "In Review",
    });

    res.status(201).json(application);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Withdraw application
exports.withdrawApplication = async (req, res) => {
  try {
    const app = await Application.findOne({
      _id: req.params.id,
      applicant: req.user._id,
    });
    if (!app) return res.status(404).json({ message: "Application not found" });

    await app.deleteOne();
    res.json({ message: "Application withdrawn" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update application status (Employer only) + send email
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const app = await Application.findById(req.params.id)
      .populate("job")
      .populate("applicant");

    if (!app) return res.status(404).json({ message: "Application not found" });

    if (String(app.job.company) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    app.status = status;
    await app.save();

    // Send email
    const html = applicationStatusEmail(
      app.applicant.name,
      app.job.title,
      status
    );
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: app.applicant.email,
      subject: `Your application for ${app.job.title} is ${status}`,
      html,
    });

    console.log("Email sent:", info.messageId);

    res.json(app);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//
// ---------------- SAVED JOB CONTROLLERS ----------------
//

// @desc    Save a job
exports.saveJob = async (req, res) => {
  try {
    if (req.user.role !== "jobseeker") {
      return res.status(403).json({ message: "Only jobseekers can save jobs" });
    }

    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    const existing = await SavedJob.findOne({
      job: job._id,
      jobseeker: req.user._id,
    });
    if (existing) return res.status(400).json({ message: "Already saved" });

    const saved = await SavedJob.create({
      job: job._id,
      jobseeker: req.user._id,
    });

    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Unsave a job
exports.unsaveJob = async (req, res) => {
  try {
    const saved = await SavedJob.findOne({
      job: req.params.jobId,
      jobseeker: req.user._id,
    });
    if (!saved) return res.status(404).json({ message: "Not saved" });

    await saved.deleteOne();
    res.json({ message: "Job unsaved" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
