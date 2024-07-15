const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');
const fs = require('fs');
const { timeStampGen, streamToString, buildResponse } = require('./extras.js');

require('dotenv').config();

const inputRegex = /Amtrak[\n\r\s]+\d+(-\d+)?/;
const lastNumberRegex = /\d+(-\d+)?$/;

let globalLock = false;

const transport = nodemailer.createTransport({
  pool: true,
  host: "mx1.amtraker.com",
  port: 465,
  secure: true, // use TLS
  auth: {
    user: "status@amtraker.com",
    pass: process.env.EMAIL_PASS,
  },
  dkim: {
    domainName: "amtraker.com",
    keySelector: "mx1",
    privateKey: process.env.DKIM_PRIV
  }
});

const fetchAndProcessEmails = async () => {
  /*
  if (globalLock === true) {
    console.log('Update already in process, exiting')
    return; //cant update multiple times at once
  }
  */
  globalLock = true;

  //console.log('Checking for new emails');

  const imapClient = new ImapFlow({
    host: 'mx1.amtraker.com',
    port: 993,
    secure: true,
    auth: {
      user: 'status@amtraker.com',
      pass: process.env.EMAIL_PASS
    },
    logger: false
  });

  await imapClient.connect()

  imapClient.list().then((mailboxes) => {
    mailboxes.forEach((mailbox) => {
      imapClient.mailboxOpen(mailbox.path).then((openedMailbox) => {
        for await (let msg of imapClient.fetch('1:*', { uid: true, bodyStructure: true, envelope: true, source: false })) {
          
        }
      })
    })
  })

  return;

  //let mailboxLock = await imapClient.getMailboxLock('INBOX');
  const mailbox = await imapClient.mailboxOpen('INBOX');

  if (mailbox.exists <= 0) { // no email
    //console.log('No emails to check')
    globalLock = false;
    return;
  }

  try {
    //getting message IDs
    let messages = [];
    for await (let msg of imapClient.fetch('1:*', { uid: true, bodyStructure: true, envelope: true, source: false })) {

      let final = undefined;

      if (!msg.bodyStructure.childNodes) {
        //need to emulate it
        msg.bodyStructure.childNodes = [msg.bodyStructure];
      }

      //only need the first text/plain
      for await (let childNode of msg.bodyStructure.childNodes) {
        //we want the text/plain if possible, but we'll take some HTML if plaintext isn't there
        if (childNode.type === 'text/plain' || (childNode.type === 'text/html' && final === undefined)) {
          final = childNode.part;
        }
      }

      messages.push({
        uid: msg.uid,
        part: final,
        target: msg.envelope.from[0].address,
        subject: msg.envelope.subject,
      })
    }

    //console.log('New mail!!')

    //getting the actual messages
    for await (let message of messages) {
      const res = await imapClient.download(message.uid, message.part ?? '1', { uid: true })

      const messageStr = await streamToString(res.content);
      const messageMatches = inputRegex.exec(messageStr);
      const subjectMatches = inputRegex.exec(message.subject);

      const actualMatches = messageMatches ?? subjectMatches; //we need at least one to match

      if (actualMatches == null) { //message has no valid input, deleting it
        transport.sendMail({
          from: 'status@amtraker.com',
          to: message.target,
          subject: message.subject ?? `Amtrak Unkown Train Number`,
          text:`Unknown Train\nWe\'re sorry, your train input seems to be invalid. Please make sure your request is in the "Amtrak {Train Number}" format.\n${timeStampGen()}`,
        }, (err) => {
          console.log(`Sent message to ${message.target} about unknown train number`)
          if (err) console.log(err)
        })

        await imapClient.messageDelete(message.uid, { uid: true });
        continue;
      }

      const actualMatchesCleaned = lastNumberRegex.exec(actualMatches[0]);
      if (actualMatchesCleaned == null) continue; //this shouldnt happen, but who knows

      const trainNum = actualMatchesCleaned[0];
      //const trainNumAct = trainNum.split('-')[0];

      const builtMessage = await buildResponse(trainNum);

      transport.sendMail({
        from: 'status@amtraker.com',
        to: message.target,
        subject: message.subject ?? `Amtrak ${trainNum}`,
        text: builtMessage,
      }, (err) => {
        console.log(`Sent message to ${message.target} about ${trainNum}`)
        if (err) console.log(err)
      })

      await imapClient.messageDelete(message.uid, { uid: true });
    }
  } catch (e) {
    console.log(e)
    console.log('Error getting new email, probably no new mail:', e.toString())
  } finally {
    await imapClient.logout();
    globalLock = false;
  }
}

fetchAndProcessEmails().catch(err => console.error(err));