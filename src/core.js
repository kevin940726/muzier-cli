import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import ffmpeg from 'fluent-ffmpeg';
import filenamify from 'filenamify';
import { getYoutubePlaylistAPI } from './apis';

const readdir = promisify(fs.readdir);
const readStat = promisify(fs.stat);

export const getYoutubePlaylist = async (url, pageToken = '') => {
  const isUrl = /list=(\w+)/g.exec(url);
  const playlistID = isUrl ? isUrl[1] : url;

  const { items, prevPageToken, nextPageToken } = await getYoutubePlaylistAPI(
    playlistID,
    {
      maxResults: 10,
      pageToken,
    }
  );

  return {
    tracks: items.map(({ snippet }) => ({
      source: 'youtube',
      id: snippet.resourceId.videoId,
      thumbnail: snippet.thumbnails && snippet.thumbnails.default.url,
      title: snippet.title,
      url: `http://youtube.com/watch?v=${snippet.resourceId.videoId}`,
    })),
    prevPageToken,
    nextPageToken,
  };
};

export const getLastDownloadTrack = async outputDirectory => {
  const files = (await readdir(outputDirectory)).filter(
    file => path.extname(file) === '.mp3'
  );

  const filesWithStats = await Promise.all(
    files.map(async file => {
      const stat = await readStat(path.resolve(outputDirectory, file));
      return {
        file,
        lastModifiedTime: stat.mtime,
      };
    })
  );

  const sorted = filesWithStats
    .sort((prev, cur) => cur.lastModifiedTime - prev.lastModifiedTime)
    .map(({ file }) => file);

  return sorted[0];
};

export const getDownloadRange = async (
  playlistID,
  lastDownloadTrack,
  totalTracks = [],
  pageToken = ''
) => {
  const { tracks, nextPageToken } = await getYoutubePlaylist(
    playlistID,
    pageToken
  );

  const lastIndex = tracks.findIndex(
    track =>
      `${track.title}.mp3` === lastDownloadTrack ||
      `${filenamify(track.title)}.mp3` === lastDownloadTrack
  );

  if (lastIndex > -1) {
    return [...totalTracks, ...tracks.slice(0, lastIndex)];
  }

  return getDownloadRange(
    playlistID,
    lastDownloadTrack,
    [...totalTracks, ...tracks],
    nextPageToken
  );
};
