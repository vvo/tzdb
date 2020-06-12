# cities-timezone-db [![GitHub license](https://img.shields.io/github/license/vvo/cities-timezone-db?style=flat)](https://github.com/vvo/cities-timezone-db/blob/master/LICENSE)

This is a list of major cities (population > 45,000) and their associated time zones.

## cities.json

You can either directly use the [cities.json](./cities.json?raw=true) output in your system.

## Algolia

You can also store it on a search engine like [Algolia](http://algolia.com/). There's a `yarn build` command you can use if you clone this repository to create your own Algolia index. The expected environment variables are:

```
ALGOLIA_APPLICATION_ID=... ALGOLIA_ADMIN_API_KEY=... ALGOLIA_INDEX_NAME=... yarn build
```

Here's a demo of the index:

![Demo](./demo.gif)
