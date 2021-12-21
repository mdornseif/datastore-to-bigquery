/*
 * bigqueryLoad.ts
 *
 * Created by Dr. Maximillian Dornseif 2021-12-23 in datastore-to-bigquery 1.0.0
 * Copyright (c) 2021 Dr. Maximillian Dornseif
 */

import { BigQuery } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';
import { ArgumentParser } from 'argparse';
import ora from 'ora';

import {
  ensureDataset,
  loadAllKindsFromPrefix,
} from '../lib/load-into-to-bigquery';

async function main() {
  const parser = new ArgumentParser({
    description: 'Load Datastore Backup into BigQuery.',
    epilog:
      'Please provide `GOOGLE_APPLICATION_CREDENTIALS` via the Environment!',
    add_help: true,
  });

  parser.add_argument('bucket', { help: 'GCS bucket to read backup.' });
  parser.add_argument('pathPrefix', {
    help: 'Backup dir & name of backup in GCS bucket.',
  });
  parser.add_argument('projectId', { help: 'BigQuery project ID.' });
  parser.add_argument('datasetName', {
    help: 'Name of BigQuery Dataset to write to. Needs to be in the same Region as GCS bucket.',
  });

  const args = parser.parse_args();
  const bigquery = new BigQuery({ projectId: args.projectId });
  const spinner = ora().start('🌈 Unicorns! ✨🌈');

  spinner.text = 'getting bucket location';
  const storage = new Storage();
  const bucket = storage.bucket(args.bucket);
  const [meta] = await bucket.getMetadata();
  spinner.info(`bucket ${args.bucket} is in ${meta.location}`);

  spinner.text = 'getting dataset';
  // create Dataset if needed.
  const dataset = await ensureDataset(
    bigquery,
    args.datasetName,
    spinner,
    meta.location
  );
  spinner
    .info(
      `dataset ${args.projectId}:${args.datasetName} is in ${
        dataset.location || 'unknown location'
      }`
    )
    .start();
  if (dataset.location && dataset.location != meta.location) {
    spinner
      .warn(
        `Dataset and bucket locations do not match. This might load to difficulties.`
      )
      .start();
  }

  await loadAllKindsFromPrefix(
    bigquery,
    args.datasetName,
    args.bucket,
    args.pathPrefix,
    spinner
  );

  return '';
}

main().then(console.log).catch(console.error);
