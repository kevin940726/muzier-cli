import Youtube from 'youtube-api';

const { YOUTUBE_API_KEY } = process.env;

Youtube.authenticate({
  type: 'key',
  key: YOUTUBE_API_KEY,
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
