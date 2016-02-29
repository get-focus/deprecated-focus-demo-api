"use strict";

// Libraries imports

const Promise = require('bluebird');
const searchIndex = Promise.promisify(require('search-index')); // Promisify search-index
const stopwords = require('term-vector').getStopwords('fr').sort(); // Get the french stopwords
const da = require('distribute-array'); // Used to make indexation batches
const _ = require('lodash');

// Local imports

const initDatabase = require('../database').init;
const getAllMovies = require('../database').getAllMovies;
const batchify = require('./common').batchify;
const sequencify = require('./common').sequencify;
const indexBatch = require('./common').indexBatch;
const initSearchIndex = require('./common').initSearchIndex;
const checkIsIndexEmpty = require('./common').checkIsIndexEmpty;
const promisifySearchIndex = require('./common').promisifySearchIndex;
const treatSearchResults = require('./common').treatSearchResults;
const groupedSearch = require('./common').groupedSearch;
const buildSearchQuery = require('./common').buildSearchQuery;

// Local references

let movieSearchIndex;

// Configuration

const movieIndexOptions = {
    indexPath: 'storage/search-movies',
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

const movieBatchOptions = {
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

const movieFacetsToFieldName = {
    FCT_MOVIE_TYPE: 'movieType',
    FCT_MOVIE_TITLE: 'title',
    FCT_MOVIE_YEAR: 'productionYear'
}

const movieFacets = {
    FCT_MOVIE_TITLE: {
        fieldName: 'title',
        ranges: [
            {
                code: 'R1',
                value: ['', '9'],
                label: '#'
            },
            {
                code: 'R2',
                value: ['A', 'G'],
                label: 'A-G'
            },
            {
                code: 'R3',
                value: ['H', 'N'],
                label: 'H-N'
            },
            {
                code: 'R4',
                value: ['O', 'T'],
                label: 'O-T'
            },
            {
                code: 'R5',
                value: ['U', 'Z'],
                label: 'U-Z'
            }
        ]
    },
    FCT_MOVIE_TYPE: {
        fieldName: 'movieType'
    },
    FCT_MOVIE_YEAR: {
        fieldName: 'productionYear',
        ranges: [
            {
                code: 'R1',
                value: ['', '1930'],
                label: 'Avant 1930'
            },
            {
                code: 'R2',
                value: ['1931', '1940'],
                label: 'Années 30'
            },
            {
                code: 'R3',
                value: ['1941', '1950'],
                label: 'Années 40'
            },
            {
                code: 'R4',
                value: ['1951', '1960'],
                label: 'Années 50'
            },
            {
                code: 'R5',
                value: ['1961', '1970'],
                label: 'Années 60'
            },
            {
                code: 'R6',
                value: ['1971', '1980'],
                label: 'Années 70'
            },
            {
                code: 'R7',
                value: ['1981', '1990'],
                label: 'Années 80'
            },
            {
                code: 'R8',
                value: ['1991', '2000'],
                label: 'Années 90'
            },
            {
                code: 'R9',
                value: ['2001', '2010'],
                label: 'Années 2000'
            },
            {
                code: 'R10',
                value: ['2011', Number.MAX_SAFE_INTEGER.toString()],
                label: 'Après 2010'
            }
        ]
    }
}

const BATCH_SIZE = 50;

// Pure functions

const getMovies = () => getAllMovies()
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

const fillMovieIndex = (si, batchOptions, batchSize) => initDatabase
.then(() => getMovies())
.then(movies => batchify(movies, batchSize))
.then(batches => sequencify(batches, (batch, batchIndex) => indexBatch(si, batch, batchOptions, batchIndex, batches.length)))

// Stateful functions

const init = initSearchIndex(searchIndex, movieIndexOptions)
.then(promisifySearchIndex)
.then(si => {
    movieSearchIndex = si;
    return Promise.resolve();
});

const checkIsMovieIndexEmpty = () => init
.then(() => checkIsIndexEmpty(movieSearchIndex));

const populate = () => init
.then(() => fillMovieIndex(movieSearchIndex, movieBatchOptions, BATCH_SIZE))

const search = (text, selectedFacets, group, sortFieldName, sortDesc, top, skip, groupTop) => init
.then(() => {
    const query = buildSearchQuery(text, movieFacets, selectedFacets, skip, top);
    if (group) {
        const groupedField = movieFacetsToFieldName[group];
        return groupedSearch(movieSearchIndex, query, groupedField, groupTop);
    } else {
        return movieSearchIndex.search(query)
        .then(treatSearchResults(sortFieldName, sortDesc, movieFacets))
    }
})
.catch(error => console.log(error));

module.exports = {
    init,
    search,
    checkIsIndexEmpty: checkIsMovieIndexEmpty,
    populate
}
