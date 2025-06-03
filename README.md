# IATI Datastore Download Tool

This tool helps you download all the data you want from the IATA Datastore at https://datastore.iatistandard.org/

## Install

- Install Node.
- Checkout the git repositoryq
- Run "npm install"

## To Run

Run:

```
node src/index.js
```

Certain options must be specified; see below.

You will see progress messages and the files will appear in the output directory you specify.

## Options

### API Key (Required)

You must get an API key from https://developer.iatistandard.org/

```
--apikey KEY_HERE
```

### Filters File

You can go to https://datastore.iatistandard.org/ , open the advanced search and do whatever search you want. Then click "export" and export the filters. Save that file to your disk. Then pass it:

```
--filtersfile filename.json
```

### Core

```
--core activity
```

One of:

- `activity` - default
- `transaction`
- `budget`

### Format

```
--format solr
```

One of:

- `solr` - default
- `xml` - only available with the `activity` core.
- `csv`

### Output Dir (required)

You must specify an output directory. This is a directory, not a filename, because in some format modes multiple pages are got and each page is saved in a seperate file.

```
--outputdir out
```
