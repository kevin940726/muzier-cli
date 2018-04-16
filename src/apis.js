import Youtube from 'youtube-api';
import Config from 'conf';

const config = new Config();

Youtube.authenticate({
  type: 'key',
  key: config.get('YOUTUBE_API_KEY'),
});

export const getYoutubePlaylistAPI = (playlistID, options = {}) =>
  new Promise((resolve, reject) => {
    Youtube.playlistItems.list(
      {
        part: 'snippet',
        playlistId: playlistID,
        fields:
          'items(snippet(position,resourceId/videoId,thumbnails/default,title)),nextPageToken,prevPageToken',
        ...options,
      },
      (err, res) => {
        if (err) {
          return reject(err);
        }

        return resolve(res);
      }
    );
  });
