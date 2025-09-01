// backend/utils/emailTemplates.js
const getStatusEmailContent = (applicantName, jobTitle, status) => {
  let subject = "";
  let text = "";

  switch (status) {
    case "In Review":
      subject = `Your application for ${jobTitle} is in review`;
      text = `Hello ${applicantName},\n\nYour application for the position "${jobTitle}" is currently under review. We will get back to you soon.\n\nBest regards,\nCompany Team`;
      break;

    case "Accepted":
      subject = `Congratulations! Application accepted for ${jobTitle}`;
      text = `Hello ${applicantName},\n\nGood news! Your application for "${jobTitle}" has been accepted. You will be contacted for the next steps or interview.\n\nBest regards,\nCompany Team`;
      break;

    case "Rejected":
      subject = `Update on your application for ${jobTitle}`;
      text = `Hello ${applicantName},\n\nWe regret to inform you that your application for "${jobTitle}" has been rejected. Thank you for your interest, and we wish you the best for your future endeavors.\n\nBest regards,\nCompany Team`;
      break;

    default:
      return null;
  }

  return { subject, text };
};

module.exports = getStatusEmailContent;
