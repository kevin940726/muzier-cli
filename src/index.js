import path from 'path';
import prog from 'caporal';
import inquirer from 'inquirer';
import Config from 'conf';
import updateNotifier from 'update-notifier';
import pkg from '../package.json';
import { download } from './core';

updateNotifier({ pkg }).notify();

const config = new Config();

const getConfig = name => process.env[name] || config.get(name);

const questions = [
  {
    type: 'output',
    name: 'OUTPUT_DIRECTORY',
    message: 'Please specify the output directory',
    default: getConfig('OUTPUT_DIRECTORY'),
    validate: Boolean,
  },
  {
    type: 'input',
    name: 'YOUTUBE_API_KEY',
    message: 'Please set youtube API key',
    default: getConfig('YOUTUBE_API_KEY'),
    validate: Boolean,
  },
  {
    type: 'input',
    name: 'YOUTUBE_PLAYLIST_ID',
    message: 'Please enter youtube playlist ID',
    default: getConfig('YOUTUBE_PLAYLIST_ID'),
    validate: Boolean,
  },
];

prog
  .version(pkg.version)
  .description(pkg.description)
  .option('-y', 'yes to all', prog.BOOL)
  .option('-dry', 'dry run', prog.BOOL)
  .action(async (args, options) => {
    let prompts = questions;

    if (options.y) {
      prompts = questions.filter(q => !q.default);
    }

    const answers = await inquirer.prompt(prompts);

    Object.entries(answers).forEach(([name, value]) => {
      if (name === 'OUTPUT_DIRECTORY') {
        config.set(name, path.resolve(process.cwd(), value));
      } else {
        config.set(name, value);
      }
    });

    await download(options);
  });

prog.parse(process.argv);
