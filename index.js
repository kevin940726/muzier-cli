'use strict';
const fs = require('fs');
const path = require('path');
const prog = require('caporal');
const Youtube = require('youtube-api');
const inquirer = require('inquirer');
const nyanProgress = require('nyan-progress');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const chalk = require('chalk');
const leftPad = require('left-pad');
const Conf = require('conf');
const format = require('format-duration');
const updateNotifier = require('update-notifier');
const pkg = require('./package.json');
const SoundCloud = require('./soundcloud-dl');

const config = new Conf();

const SC = new SoundCloud();

updateNotifier({ pkg }).notify();

const bindNodeCallback = (resolve, reject) => (err, res) => err ? reject(err) : resolve(res);
const getYoutubePlaylistApi = (options = {}) =>
  new Promise((resolve, reject) =>
    Youtube.playlistItems.list(options, bindNodeCallback(resolve, reject)));

const getYoutubePlaylist = async (url, pageToken = '') => {
  const isUrl = /list=(\w+)/g.exec(url);
  const playlistId = isUrl ? isUrl[1] : url;

  const playlistRes = await getYoutubePlaylistApi({
    part: 'snippet',
    maxResults: 10,
    playlistId,
    pageToken,
    fields: 'items(snippet(position,resourceId/videoId,thumbnails/default,title)),nextPageToken,prevPageToken',
  });

  const prevPageToken = playlistRes.prevPageToken;
  const nextPageToken = playlistRes.nextPageToken;

  const makePageChoice = (name, pageToken) =>
    pageToken && {
      name,
      value: pageToken,
    };

  const playlistItems = playlistRes.items
    .map(item => ({
      index: Number(item.snippet.position) + 1,
      id: item.snippet.resourceId.videoId,
      thumbnail: item.snippet.thumbnails.default.url,
      title: item.snippet.title,
      url: `http://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
    }))
    .map(item => ({
      name: `${chalk.bold(leftPad(item.index.toString(), 2))} ${chalk.green(item.title)} - ${chalk.dim(item.id)}`,
      value: item,
      short: item.index,
    }));

  return {
    prev: makePageChoice('<< prev page', prevPageToken),
    playlist: playlistItems,
    next: makePageChoice('>> next page', nextPageToken),
  };
};

const getSoundCloudPlaylist = async url => {
  const res = await SC.resolve(url);

  const playlist = res
    .map((item, index) => ({
      index: index + 1,
      id: item.id,
      thumbnail: item.artwork_url,
      title: item.title,
      url: item.stream_url,
      duration: item.duration,
    }))
    .map(item => ({
      name: `${chalk.bold(leftPad(item.index.toString(), 2))} ${chalk.green(item.title)} - ${chalk.dim(format(item.duration))}`,
      value: item,
      short: item.index,
    }));

  return playlist;
};

const downloadYoutubeItem = outDir => item =>
  new Promise(resolve => {
    const output = fs.createWriteStream(path.join(outDir, `${item.title}.mp3`));

    const video = ytdl(item.url);

    video.on('response', resolve);

    const converter = ffmpeg(video).format('mp3').audioQuality(0).output(output);

    converter.run();
  });

const downloadSoundCloudItem = outDir => async item => {
  const output = fs.createWriteStream(path.join(outDir, `${item.title}.mp3`));

  const stream = await SC.download(item.url);

  stream.pipe(output);

  return stream;
};

const promptCall = async (youtubeUrl, pageToken = '', selected = {}) => {
  const { prev, next, playlist } = await getYoutubePlaylist(youtubeUrl, pageToken);

  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      message: 'Select Youtube playlist items',
      name: 'playlistItems',
      choices: playlist.map(item =>
        Object.assign({}, item, {
          checked: Boolean(selected[item.value.id]),
        })),
      pageSize: playlist.length,
    },
    {
      type: 'list',
      message: 'Continue selecting?',
      name: 'continue',
      choices: [
        prev,
        {
          name: 'No',
          value: 'No',
        },
        next,
      ].filter(Boolean),
      default: 'No',
    },
  ]);

  const selectedItems = Object.assign(
    {},
    selected,
    answers.playlistItems.reduce(
      (map, cur) =>
        Object.assign({}, map, {
          [cur.id]: cur,
        }),
      {}
    )
  );
  const nextPage = answers.continue;

  if (nextPage !== 'No') {
    return promptCall(youtubeUrl, nextPage, selectedItems);
  }

  return Object.values(selectedItems);
};

const downloadProgress = async (res, logger = console) => {
  const totalSize = res
    .map(track => Number(track.headers['content-length']))
    .reduce((prev, cur) => prev + cur);

  const progress = nyanProgress();

  // start downloading and animate progress
  Promise.all(
    res.map(
      track =>
        new Promise((resolve, reject) => {
          track.on('data', chunk => {
            progress.tick(chunk.length);
          });
          track.on('end', resolve);
          track.on('error', reject);
        })
    )
  ).then(() => progress.tick(Number.MAX_SAFE_INTEGER)); // sometimes the ticking never end, come back here later

  await progress.start({ total: totalSize });

  logger.info('Download Completed!');
};

const defaultYoutubePlaylist = config.get('youtubePlaylist');
const defaultSoundCloudPlaylist = config.get('soundCloudPlaylist');

prog
  .version(pkg.version)
  .command('setup', 'setup youtube and soundcloud api key')
  .argument('<type>', 'type of api key', /^youtube|soundcloud$/g)
  .argument('<key>', 'the api key', /^\w+$/g)
  .action((args, options, logger) => {
    const { type, key } = args;

    config.set(`${type}Key`, key);
  });

prog
  .version(pkg.version)
  .argument('<type>', 'type of playlist', /^youtube|soundcloud$/g)
  .argument('[url]', 'playlist URL or ID')
  .option('--set-default', 'set the current playlist as default')
  .option('--out <dir>', 'path to the output directory')
  .action(async (args, options, logger) => {
    const { type } = args;
    const outDir = options.out || process.cwd();

    let res;

    if (type === 'youtube') { // youtube
      if (!config.has('youtubeKey')) {
        logger.error('Please set youtube api key first!');
        logger.error('muzier set youtube <key>');
        return;
      }
      Youtube.authenticate({
        type: 'key',
        key: config.get('youtubeKey')
      });

      const url = args.url || defaultYoutubePlaylist;

      if (options.setDefault && url) {
        config.set('youtubePlaylist', url);
      }

      const answers = await promptCall(url);

      res = await Promise.all(answers.map(downloadYoutubeItem(outDir)));
    } else { // soundcloud
      if (!config.has('soundcloudKey')) {
        logger.error('Please set soundcloud client id first!');
        logger.error('muzier set soundcloud <id>');
        return;
      }
      SC.init(config.get('soundcloudKey'));

      const url = args.url || defaultSoundCloudPlaylist;

      if (options.setDefault && url) {
        config.set('soundCloudPlaylist', url);
      }

      const playlist = await getSoundCloudPlaylist(url);

      const answers = await inquirer.prompt([
        {
          type: 'checkbox',
          message: 'Select SoundCloud playlist items',
          name: 'playlistItems',
          choices: playlist,
          pageSize: 10,
        },
      ]);

      res = await Promise.all(answers.playlistItems.map(downloadSoundCloudItem(outDir)));
    }

    await downloadProgress(res, logger);
  });

prog.parse(process.argv);

module.exports = {
  getYoutubePlaylist,
  getSoundCloudPlaylist,
  downloadYoutubeItem,
  downloadSoundCloudItem,
};
