const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendVerificationEmail(to, code) {
  await transporter.sendMail({
    from: `"Mon App" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Vérifie ton adresse email',
    html: `<p>Ton code de vérification est : <b>${code}</b></p>`,
  });
}

module.exports = { sendVerificationEmail };
