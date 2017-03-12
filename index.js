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
const CREDENTIALS = require('./credentials.json');
const pkg = require('./package.json');

Youtube.authenticate({
  type: 'key',
  key: CREDENTIALS.youtubeApiKey, // replace your api key here
});

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

const downloadYoutubeItem = item =>
  new Promise(resolve => {
    const output = fs.createWriteStream(path.join(process.cwd(), 'downloads', `${item.title}.mp3`));

    const video = ytdl(item.url);

    video.on('response', resolve);

    const converter = ffmpeg(video).format('mp3').audioQuality(0).output(output);

    converter.run();
  });

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

prog
  .version(pkg.version)
  .argument('<youtubeUrl>', 'youtube playlist url')
  .action(async (args, options, logger) => {
    const { youtubeUrl } = args;

    const answers = await promptCall(youtubeUrl);

    const res = await Promise.all(answers.map(downloadYoutubeItem));

    const totalSize = res
      .map(video => Number(video.headers['content-length']))
      .reduce((prev, cur) => prev + cur);

    const progress = nyanProgress();

    // start downloading and animate progress
    Promise.all(
      res.map(
        video =>
          new Promise((resolve, reject) => {
            video.on('data', chunk => {
              progress.tick(chunk.length);
            });
            video.on('end', resolve);
            video.on('error', reject);
          })
      )
    ).then(() => progress.tick(Number.MAX_SAFE_INTEGER)); // sometimes the ticking never end, come back here later

    await progress.start({ total: totalSize });

    logger.info('Download Completed!');
  });

prog.parse(process.argv);
