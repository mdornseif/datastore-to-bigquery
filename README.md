[![version](https://img.shields.io/npm/v/datastore-to-bigquery.svg?style=flat-square)](https://npmjs.org/datastore-to-bigquery)
[![license](https://img.shields.io/npm/l/datastore-to-bigquery?color=%23007a1f&style=flat-square)](https://github.com/mdornseif/datastore-to-bigquery/blob/master/LICENSE)
[![downloads](https://img.shields.io/npm/dm/datastore-to-bigquery?style=flat-square&color=%23007a1f)](https://npmcharts.com/compare/datastore-to-bigquery)

# datastore-to-bigquery

The missing Data Transfer Tool: Dump Google Cloud Datastore contents and load them into BigQuery.

![Sample Output](https://raw.githubusercontent.com/mdornseif/datastore-to-bigquery/main/README.svg)

You can run it with [npx](https://www.npmjs.com/package/npx):

```
% npx datastore-to-bigquery --help
usage: datastore-to-bigquery [-h] [-b BUCKET] [-d BACKUPDIR] [-n BACKUPNAME] [-s NAMESPACE] [-p BQPROJECTID]
                             [--datasetName DATASETNAME]
                             projectId

Copy datastore Contents to BigQuery.

positional arguments:
  projectId             Datastore project ID

optional arguments:
  -h, --help            show this help message and exit
  -b BUCKET, --bucket BUCKET
                        GCS bucket to store backup. Needs to be in the same Region as datastore. (default:
                        projectId.appspot.com
  -d BACKUPDIR, --backupDir BACKUPDIR
                        prefix/dir within bucket
  -n BACKUPNAME, --backupName BACKUPNAME
                        name of backup (default: autogenerated)
  -s NAMESPACE, --namespace NAMESPACE
                        datastore namespace
  -p BQPROJECTID, --bqProjectId BQPROJECTID
                        BigQuery project ID. (default: same as datastore)
  --datasetName DATASETNAME
                        Name of BigQuery Dataset to write to. Needs to be in the same Region as GCS bucket. (default:
                        same as projectId)

Please provide `GOOGLE_APPLICATION_CREDENTIALS` via the Environment!
```

## Loading into BigQuery

This loads Datastore Data dumped by [datastore-backup](https://www.npmjs.com/package/datastore-backup) or other means into BigQuery. For this you have to make sure that the bucket containing the Data to be loaded and the BigQuery Dataset are in the same location/Region.

The BigQuery Dataset will be created if this does not exist.

### CLI Usage

CLI Usage is simple. You have to provide the bucket and path to read from and the name of the BigQuery Project and dataset to write to:

```
% npx -p datastore-to-bigquery bigqueryLoad --help
usage: bigqueryLoad.ts [-h] bucket pathPrefix projectId datasetName

Load Datastore Backup into BigQuery.

positional arguments:
  bucket       GCS bucket to read backup.
  pathPrefix   Backup dir & name of backup in GCS bucket.
  projectId    BigQuery project ID.
  datasetName  Name of BigQuery Dataset to write to. Needs to be in the same Region as GCS bucket.

optional arguments:
  -h, --help   show this help message and exit

Please provide `GOOGLE_APPLICATION_CREDENTIALS` via the Environment!
```

Loading takes a few seconds per kind:

```
% yarn ts-node src/bin/bigqueryLoad.ts samplebucket-tmp bak/20211223T085120-sampleproj sampleproj test_EU
ℹ bucket samplebucket-tmp is in EU
✔  BigQuery Dataset test_EU exists
ℹ dataset sampleproj:test_EU is in unknown location
ℹ Reading samplebucket-tmp/bak/20211223T085120-sampleproj*
✔ Loading NumberingAncestor done in 1.33s
✔ Loading NumberingItem done in 4.231s
```

#### Moving the dataset

In case you need the dataset in an different BigQuery location / region for reading you can use bigquery transfer service which is blazing fast:

```
bq --location=US mk --dataset sampleproj:test_US
bq mk --transfer_config --data_source=cross_region_copy --display_name='Copy Dataset' \
      --project_id=sampleproj --target_dataset=test_US
      --params='{"source_dataset_id":"test_US","source_project_id":"sampleproj"}'
```

### Programmatic Usage

Basically the same as command line usage:

```js
import { BigQuery } from '@google-cloud/bigquery';
import {loadAllKindsFromPrefix} from '../lib/load-into-to-bigquery';

const bigquery = ;
await loadAllKindsFromPrefix(
  new BigQuery({ projectId }),
  args.datasetName,
  args.bucket,
  args.pathPrefix,
);
```

## Full Dump-Load Cycle

You can do it all at once with a single command:

```
% npx datastore-to-bigquery <datastoreProject> -n <production> -b <bucket-tmp> -p <bigqueryProject>
```

# Hints

Permissions are a a little tricky to set up: [Permissions for Datastore Export](https://cloud.google.com/datastore/docs/export-import-entities#before_you_begin) must exist in the Source and also for writing to the Bucket. [Permissions for BigQuery-Load](https://cloud.google.com/bigquery/docs/batch-loading-data) must exist on BigQuery. Permission for listing and reading [must exist on GCS](https://cloud.google.com/bigquery/docs/batch-loading-data#permissions-load-data-from-cloud-storage).

Locations / Regions are also tricky to setup. Basically the Datastore, the Bucket and the Dataset should have the same region, e.g. `EU`. If your need to do BigQuery from a different region, see "Moving the dataset".

Beware of namespaces! Dumping different Namespaces and loading them into the same BigQuery Dataset will result in incomplete Data in BigQuery.

# See also:

- [datastore-backup](https://www.npmjs.com/package/datastore-backup)
