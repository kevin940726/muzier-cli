const https = require('https');
const fetch = require('node-fetch');
const queryString = require('query-string');
const { soundcloudClientId } = require('./credentials.json');
const BASE = 'https://api.soundcloud.com';

function SoundCloud(clientId) {
  this.clientId = clientId;

  const api = async (endpoint, query = {}) => {
    try {
      const res = await fetch(
        `${BASE}/${endpoint}?${queryString.stringify(Object.assign({}, { client_id: this.clientId }, query))}`
      );
      return res.json();
    } catch (err) {
      throw err;
    }
  };

  return {
    resolve: url => api('resolve', { url }),
    download: url =>
      new Promise((resolve, reject) => {
        https.get(`${url}?client_id=${this.clientId}`, res => {
          https.get(res.headers.location, res => {
            resolve(res);
          });
        });
      }),
    resolveDownload: function(url) {
      return this.resolve(url).then(res => this.download(res.stream_url));
    },
  };
}

const SC = SoundCloud(soundcloudClientId);

module.exports = SC;
exports.default = SC;

// SC.resolve('https://soundcloud.com/kevin940726/likes')
//   .then(console.log);
