const fetch = require('node-fetch');

const timeStampGen = (timestamp = new Date(), timezone = 'America/Chicago') => {
  return new Intl.DateTimeFormat('en-US', {
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: timezone
  }).format(timestamp);
  //return `${timestamp.toLocaleString('en-US', { timeZone: timezone })} ${timezone}`
}

const hoursAndMinutesDiff = (scheduled, actual) => {
  const scheduledParsed = new Date(scheduled).valueOf();
  const predictedParsed = new Date(actual).valueOf();

  let minutesDiff = Math.abs(Math.round((scheduledParsed - predictedParsed) / (1000 * 60)));
  let hoursDiff = Math.floor(minutesDiff / 60);

  //adjusting the minutes diff to not include the hours
  minutesDiff -= (hoursDiff * 60);

  // no difference
  if (hoursDiff == 0 && minutesDiff == 0) return ('On Time');

  let res = '';

  //only add hours if we have them
  if (hoursDiff > 0) res += `${hoursDiff}h`;

  //always add minutes
  res += `${minutesDiff}m`;

  //early
  if (scheduledParsed > predictedParsed) res += " Early";

  //late
  if (scheduledParsed < predictedParsed) res += " Late";

  return res;
}

const streamToString = async (stream) => {
  // lets have a ReadableStream as a stream variable
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf-8");
}

const buildResponse = async (trainNum) => {
  const onlyTrainNum = trainNum.split('-')[0];

  const res = await fetch(`https://api-v3.amtraker.com/v3/trains/${trainNum}`);
  const data = await res.json();

  // train doesnt exist
  if (Array.isArray(data)) return `Unknown Train\nTrain ${trainNum} does not exist.\n${timeStampGen()}`

  const realData = data[onlyTrainNum];

  // shouldn't happen, accounting for edge cases
  if (realData.length === 0) return `Unknown Train\nTrain ${trainNum} does not exist.\n${timeStampGen()}`

  // need user to choose
  if (realData.length > 1) {
    return `${realData[0].routeName} Train\nThere is more than one ${trainNum} operating currently. Please pick one from those below:\n- ${realData.map(n => n.trainID).join('\n- ')}\n${timeStampGen()}`
  }

  // no predictions
  if (realData[0].stations.length === 0) return `${realData[0].routeName}Train \nTrain ${trainNum} has no predictions available. Please try again later.\n${timeStampGen()}`;

  // building a successful response
  const filteredStations = realData[0].stations.filter((s) => s.status === 'Enroute');
  const stationsOut = filteredStations.map((station) => {
    return `${station.code} - ${station.arr ? timeStampGen(new Date(station.arr), station.tz) : timeStampGen(new Date(station.schArr), station.tz)} (${station.arr ? hoursAndMinutesDiff(station.schArr, station.arr) : "Scheduled, No ETA"})`
  });

  return `${realData[0].routeName} Train\n${stationsOut.join('\n')}\n${timeStampGen(new Date(), filteredStations[0].tz)}`;
}

exports.timeStampGen = timeStampGen;
exports.streamToString = streamToString;
exports.buildResponse = buildResponse;