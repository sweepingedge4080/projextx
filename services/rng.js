const crypto = require('crypto');

function generateSeed() {
  return crypto.randomBytes(32).toString('hex');
}

function commitHash(seed, ticketCodes) {
  const sorted = [...ticketCodes].sort().join(',');
  return crypto.createHash('sha256').update(seed + '|' + sorted).digest('hex');
}

function pickWinnerIndex(seed, ticketCodes) {
  if (!ticketCodes.length) throw new Error('No tickets to pick from');

  const sorted = [...ticketCodes].sort();
  const hash = crypto.createHash('sha256').update(seed + '|' + sorted.join(',')).digest();
  const bigInt = hash.readUIntBE(0, 6);
  const winnerSortedIndex = bigInt % sorted.length;
  const winningCode = sorted[winnerSortedIndex];

  return ticketCodes.indexOf(winningCode);
}

module.exports = { generateSeed, commitHash, pickWinnerIndex };
