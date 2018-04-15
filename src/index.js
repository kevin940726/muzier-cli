import path from 'path';
import prog from 'caporal';
import Config from 'conf';
import updateNotifier from 'update-notifier';
import pkg from '../package.json';
import {
  getYoutubePlaylist,
  getLastDownloadTrack,
  getDownloadRange,
} from './core';
import youtube from './services/youtube';

updateNotifier({ pkg }).notify();

const config = new Config();

const { YOUTUBE_PLAYLIST_ID } = process.env;

(async () => {
  const outputDirectory = path.resolve(process.cwd(), 'downloads');

  const lastDownloadTrack = await getLastDownloadTrack(outputDirectory);

  const downloadRange = await getDownloadRange(
    YOUTUBE_PLAYLIST_ID,
    lastDownloadTrack
  );

  return downloadRange.reduce(
    (chain, track) => chain.then(() => youtube(track, outputDirectory)),
    Promise.resolve()
  );
})();
