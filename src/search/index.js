// Libraries imports

const Promise = require('bluebird');
const searchIndex = Promise.promisify(require('search-index')); // Promisify search-index
const stopwords = require('term-vector').getStopwords('fr').sort(); // Get the french stopwords
const da = require('distribute-array'); // Used to make indexation batches

// Local imports

const Movie = require('../database').Movie;
const sequelize = require('../database').sequelize;
const prepareDb = require('../database').init;

// Configuration

const indexOptions = {
    indexPath: 'src/search/search-index',
    fieldsToStore: [
        'code',
        'title',
        'originalTitle',
        'synopsis',
        'shortSynopsis',
        'keywords',
        'poster',
        'runtime',
        'movieType',
        'productionYear',
        'userRating',
        'pressRating'
    ],
    deletable: false,
    stopwords
};

const batchOptions = {
    fieldOptions: [
        {
            fieldName: 'code',
            searchable: false
        },
        {
            fieldName: 'title',
            filter: true
        },
        {
            fieldName: 'movieType',
            filter: true
        },
        {
            fieldName: 'productionYear',
            filter: true
        }
    ]
};

const BATCH_SIZE = 50;

// Pure functions

const initSearchIndex = (searchIndex, options) => searchIndex(options);

const promisifySearchIndex = si => ['add', 'close', 'get', 'del', 'flush', 'match', 'replicate', 'search', 'snapShot', 'tellMeAboutMySearchIndex'].reduce((acc, method) => {
    acc[method] = Promise.promisify(si[method]);
    return acc;
}, {});

const checkIsIndexEmpty = si => si.tellMeAboutMySearchIndex()
.then(infos => infos.totalDocs === 0);

const getMovies = Movie => Movie.findAll()
.then(movies => movies.map(movie => movie.get({plain: true})))
.then(movies => movies.map(movie => ({
    code: movie.code,
    title: [movie.title],
    originalTitle: movie.originalTitle,
    synopsis: movie.synopsis,
    shortSynopsis: movie.shortSynopsis,
    keywords: movie.keywords,
    poster: movie.poster,
    runtime: movie.runtime,
    movieType: [movie.movieType],
    productionYear: [movie.productionYear],
    userRating: movie.userRating,
    pressRating: movie.pressRating
})));

const batchify = (array, batchSize) => da(array, Math.ceil(array.length / batchSize));

const sequencify = (batches, func) => Promise.each(batches, func);

const indexBatch = (si, batch, batchOptions, batchIndex, totalBatches) => {
    console.log(`Indexing batch ${batchIndex + 1}/${totalBatches}`);
    return si.add(batch, batchOptions);
}

const fillIndex = (si, batchOptions, batchSize, Movie) => prepareDb()
.then(() => getMovies(Movie))
.then(movies => batchify(movies, batchSize))
.then(batches => sequencify(batches, (batch, batchIndex) => indexBatch(si, batch, batchOptions, batchIndex, batches.length)))
.then(() => si)

const getAndFillIndex = (searchIndex, indexOptions, batchOptions, batchSize, Movie) => initSearchIndex(searchIndex, indexOptions)
.then(promisifySearchIndex)
.then(si => {
    return checkIsIndexEmpty(si)
    .then(empty => {
        if (empty) {
            return fillIndex(si, batchOptions, batchSize, Movie);
        } else {
            return si;
        }
    });
});

// Functions

getAndFillIndex(searchIndex, indexOptions, batchOptions, BATCH_SIZE, Movie)
.then(si => si.search({query: {'*': ['john']}, facets: {movieType: {}}}))
.then(results => console.log(results.facets[0].value))
