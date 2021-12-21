# datastore-to-bigquery

Dump Google Cloud Datastore Contents and load them into BigQuery.

## Loading

This loads Datastore Data dumped by [datastore-backup](https://www.npmjs.com/package/datastore-backup) or other means into BigQuery. For this you have to make sure that the bucket containing the Data to be loaded and the BigQuery Dataset are in the same location/Region.

The BigQuery Dataset will be created if this does not exist.

### CLI Usage

CLI Usage is simple. You have to provide the bucket and path to read from and the name of the BigQuery Project and dataset to writo:

```
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

# See also:

- [datastore-backup](https://www.npmjs.com/package/datastore-backup)
