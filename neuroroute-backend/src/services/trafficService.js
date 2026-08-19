const axios = require('axios');

async function getTrafficAt(lat, lng) {
  const url = 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json';
  const res = await axios.get(url, {
    params: { key: process.env.TOMTOM_API_KEY, point: `${lat},${lng}` },
    timeout: 5000,
  });

  const { currentSpeed, freeFlowSpeed } = res.data.flowSegmentData;
  const congestion = freeFlowSpeed > 0 ? 1 - currentSpeed / freeFlowSpeed : 0.5;

  return {
    lat,
    lng,
    currentSpeed,
    freeFlowSpeed,
    congestion: Math.max(0, Math.min(1, congestion)), // 0 = free flowing, 1 = jammed
  };
}

module.exports = { getTrafficAt };
