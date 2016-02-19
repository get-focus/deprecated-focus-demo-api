// Libraries imports

const Promise = require('bluebird');
const searchIndex = Promise.promisify(require('search-index')); // Promisify search-index
const stopwords = require('term-vector').getStopwords('fr').sort(); // Get the french stopwords
const da = require('distribute-array'); // Used to make indexation batches

// Local imports

const Movie = require('../database').Movie;
const sequelize = require('../database').sequelize;
const getDb = require('../database').get;

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

const fillIndex = (si, batchOptions, batchSize, Movie) => getDb
.then(() => getMovies(Movie))
.then(movies => batchify(movies, batchSize))
.then(batches => sequencify(batches, (batch, batchIndex) => indexBatch(si, batch, batchOptions, batchIndex, batches.length)))
.then(() => si)

const search = (si, text) => {
    const query = {
        query: {'*': [text]},
        facets: {
            title: {
                ranges: [
                    ['', 'A'],
                    ['A', 'G'],
                    ['H', 'N'],
                    ['O', 'T'],
                    ['U', 'Z'],
                    ['Z', '']
                ]
            },
            movieType: {},
            productionYear: {
                ranges: [
                    ['', '1930'],
                    ['1931', '1940'],
                    ['1941', '1950'],
                    ['1951', '1960'],
                    ['1961', '1970'],
                    ['1971', '1980'],
                    ['1981', '1990'],
                    ['1991', '2000'],
                    ['2001', '2010'],
                    ['2011', '']
                ]
            }
        }
    }
    return si.search(query)
    .then(results => {
        const facets = results.facets.reduce((acc, facet) => {
            acc[facet.key] = facet.value.reduce((facetAcc, facetValue) => {
                facetAcc[facetValue.key] = facetValue.value;
                return facetAcc;
            }, {})
            return acc;
        }, {});
        const totalCount = results.totalHits;
        const list = results.hits.map(hit => hit.document);
        return {
            facets,
            totalCount,
            list
        };
    })
}

// Stateful functions

const get = initSearchIndex(searchIndex, indexOptions)
.then(promisifySearchIndex)

const populate = si => fillIndex(si, batchOptions, BATCH_SIZE, Movie)

// Exports

module.exports = {
    get: get,
    populate,
    isEmpty: checkIsIndexEmpty,
    search
};
