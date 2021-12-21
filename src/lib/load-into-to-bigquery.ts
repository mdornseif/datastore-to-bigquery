/*
 * load datastore backups from GCS into bigquery
 *
 * Created by Dr. Maximillian Dornseif 2021-12-20 in datastore-backup 1.0.0
 * Copyright (c) 2021 Dr. Maximillian Dornseif
 */

import path from 'path';

import { BigQuery, Dataset, JobResponse } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';
import ora from 'ora';

/** Based on a bucket and path prefix in GCS load all datastore backup into BigQuery */
export async function loadAllKindsFromPrefix(
  bigquery: BigQuery,
  datasetName: string,
  backupBucketName: string,
  pathPrefix: string,
  spinner?: ora.Ora
): Promise<string[]> {
  const dir = `${backupBucketName}/${pathPrefix}*`;
  spinner.start().text = `Reading ${dir}`;
  // we now have to search the actual kind data which is one meta file per kind
  // .../kind_NumberingAncestor/namespace_production_kind_NumberingAncestor.export_metadata
  const storage = new Storage();
  const kindFiles = (
    await storage.bucket(backupBucketName).getFiles({
      prefix: pathPrefix,
    })
  )[0]
    .map((x) => x.name)
    .filter((x) => x.endsWith('.export_metadata'));

  spinner.info().text = `Loading ${
    kindFiles.length
  } files into BigQuery ${await bigquery.getProjectId()}:${datasetName}`;
  for (const exportMetadataFname of kindFiles) {
    const metadataUrl = `gs://${path.join(
      backupBucketName,
      exportMetadataFname
    )}`;
    await loadOneKind(bigquery, datasetName, metadataUrl, spinner);
  }
  return kindFiles;
}

/** Load a single kind from a datastore backup in GCS into BigQuery. */
export async function loadOneKind(
  bigquery: BigQuery,
  datasetName: string,
  metadataUrl: string,
  spinner?: ora.Ora
) {
  const newKindName = metadataUrl.match(/_kind_(.+)\.export_metadata$/)[1];
  spinner.start().text = `Loading ${newKindName}`;
  const projectId = await bigquery.getProjectId();
  // Limitations
  // You are subject to the following limitations when you load data into
  // BigQuery from a Cloud Storage bucket:
  //
  // If your dataset's location is set to a value other than US, the regional
  // or multi-regional Cloud Storage bucket must be in the same region as the dataset.
  //
  // For a Datastore export to load correctly, entities in the export data must share a
  // consistent schema with fewer than 10,000 unique property names.
  //
  // Data exported without specifying an entity filter cannot be loaded into BigQuery.
  // The export request must include one or more kind names in the entity filter.
  //
  // The maximum field size for Datastore exports is 64 KB. When you load a Datastore export,
  // any field larger than 64 KB is truncated.
  const jobOptions = {
    configuration: {
      jobType: 'LOAD',
      load: {
        // in the format gs://[BUCKET]/[OBJECT].
        // The file (object) name must end in [KIND_NAME].export_metadata.
        // Only one URI is allowed for Datastore exports, and you cannot use a wildcard.
        sourceUris: [metadataUrl],
        destinationTable: {
          projectId,
          datasetId: datasetName,
          tableId: newKindName,
        },
        autodetect: true,
        ignoreUnknownValues: false,
        maxBadRecords: 0,
        // Specify the data format by setting the configuration.load.sourceFormat property to DATASTORE_BACKUP.
        sourceFormat: 'DATASTORE_BACKUP',
        // You cannot append Datastore export data to an existing table with a defined schema.
        // Specify the write disposition by setting the configuration.load.writeDisposition property to WRITE_TRUNCATE.
        writeDisposition: 'WRITE_TRUNCATE',
      },
    },
    jobReference: {
      projectId,
      jobId: `import-${newKindName}-${datasetName}-${new Date().getTime()}`,
    },
  };
  try {
    const response: JobResponse = await bigquery.createJob(jobOptions);
    const job = response[0];
    const r2 = await job.promise();
    const timeUsed =
      (r2[0].statistics.endTime - r2[0].statistics.startTime) / 1000;
    spinner.succeed(`Loading ${newKindName} done in ${timeUsed}s`);
  } catch (error) {
    spinner.fail(error.message);
    throw error;
  }
}

/** Ensure that a BigQuery Dataset exists */
export async function ensureDataset(
  bigquery: BigQuery,
  datasetName: string,
  spinner?,
  newDatasetLocation = 'US'
): Promise<Dataset> {
  let dataset: Dataset;
  spinner = spinner || ora({ isSilent: true });
  spinner.text = `checking BigQuery Dataset ${bigquery.projectId}${datasetName}`;
  try {
    dataset = bigquery.dataset(datasetName);
    await dataset.getTables();
    spinner.succeed(` BigQuery Dataset ${datasetName} exists`);
  } catch (error) {
    if (!error.message.startsWith('Not found: Dataset ')) {
      throw error;
    }
    // Create the dataset
    const [dataset] = await bigquery.createDataset(datasetName, {
      location: newDatasetLocation,
    });
    spinner.warn(` BigQuery Dataset ${dataset.id} created`);
  }
  return dataset;
}
