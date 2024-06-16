const nodemailer = require('nodemailer');

require('dotenv').config();

const transport = nodemailer.createTransport({
  pool: true,
  host: "mail.amtraker.com",
  port: 465,
  secure: true, // use TLS
  auth: {
    user: "status@amtraker.com",
    pass: process.env.EMAIL_PASS,
  },
  dkim: {
    domainName: "amtraker.com",
    keySelector: "mail",
    privateKey: process.env.DKIM_PRIV
  }
});

const mailData = {
  from: 'status@amtraker.com',
  to: "+16783582271@tmomail.net",
  subject: "Subject",
  text: "Plaintext\nNewlinetext",
}

const toArr = ['pieromaddaleni03@gmail.com', 'pier@piemadd.com', '+16783582271@tmomail.net']

toArr.forEach((email) => {
  transport.sendMail({
    ...mailData,
    to: email,
  }, (err) => {
    console.log('done!')
    if (err) console.log(err)
  })
})

