const SMTPServer = require("smtp-server").SMTPServer;
const fs = require('fs');

const server = new SMTPServer({
  secure: false,
  //key: fs.readFileSync("/home/linuxuser/certs/privkey.pem"),
  //cert: fs.readFileSync("/home/linuxuser/certs/fullchain.pem"),
  name: 'mail.amtraker.com',
  banner: 'amogus???',
  authMethods: [],
  disabledCommands: ['AUTH', 'STARTTLS'],
  logger: true,
  onAuth(auth, session, callback) {
    console.log(auth)
    console.log(session)
    return callback(null, { user: 'testuser' })
  },
  onConnect(session, callback) {
    console.log(session)
    return callback();
  },
  onSecure(socket, session, callback) {
    console.log(socket)
    console.log(session)
    return callback();
  },
  onData(stream, session, callback) {
    stream.pipe(process.stdout); // print message to console
    stream.on("end", callback);
  },
});

server.on('error', (e) => console.error(e))

server.listen(4650, undefined, () => {
  console.log('listening')
});