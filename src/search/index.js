"use strict";

// Libraries imports

const Promise = require('bluebird');
const searchIndex = Promise.promisify(require('search-index')); // Promisify search-index
const stopwords = require('term-vector').getStopwords('fr').sort(); // Get the french stopwords
const da = require('distribute-array'); // Used to make indexation batches

// Local imports

const initDatabase = require('../database').init;
const getAllMovies = require('../database').getAllMovies;
const getAllPersons = require('../database').getAllPersons;

// Local references

let movieSearchIndex;
let personSearchIndex;

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

const personIndexOptions = {
    indexPath: 'storage/search-persons',
    fieldsToStore: [
        'code',
        'fullName',
        'biography',
        'sex',
        'photoURL',
        'birthDate',
        'birthPlace',
        'activity',
        'movies'
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

const personBatchOptions = {
    fieldOptions: [
        {
            fieldName: 'code',
            searchable: false
        },
        {
            fieldName: 'activity',
            filter: true
        },
        {
            fieldName: 'fullName',
            filter: true
        },
        {
            fieldName: 'sex',
            filter: true
        }
    ]
}

const BATCH_SIZE = 50;

// Pure functions

const initSearchIndex = (searchIndex, options) => searchIndex(options);

const promisifySearchIndex = si => ['add', 'close', 'get', 'del', 'flush', 'match', 'replicate', 'search', 'snapShot', 'tellMeAboutMySearchIndex'].reduce((acc, method) => {
    acc[method] = Promise.promisify(si[method]);
    return acc;
}, {});

const checkIsIndexEmpty = si => si.tellMeAboutMySearchIndex()
.then(infos => infos.totalDocs === 0);

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

const getPersons = () => getAllPersons()
.then(persons => persons.map(person => ({
    code: person.code,
    fullName: [person.fullName],
    biography: person.biography,
    sex: [person.sex],
    photoUrl: person.photoUrl,
    birthDate: person.birthDate,
    birthPlace: person.birthPlace,
    activity: person.activity.split(', '),
    movies: person.movies
})));

const batchify = (array, batchSize) => da(array, Math.ceil(array.length / batchSize));

const sequencify = (batches, func) => Promise.each(batches, func);

const indexBatch = (si, batch, batchOptions, batchIndex, totalBatches) => {
    console.log(`Indexing batch ${batchIndex + 1}/${totalBatches}`);
    return si.add(batch, batchOptions);
}

const fillMovieIndex = (si, batchOptions, batchSize) => initDatabase
.then(() => getMovies())
.then(movies => batchify(movies, batchSize))
.then(batches => sequencify(batches, (batch, batchIndex) => indexBatch(si, batch, batchOptions, batchIndex, batches.length)))

const fillPersonIndex = (si, batchOptions, batchSize) => initDatabase
.then(() => getPersons())
.then(persons => batchify(persons, batchSize))
.then(batches => sequencify(batches, (batch, batchIndex) => indexBatch(si, batch, batchOptions, batchIndex, batches.length)))

const treatSearchResults = results => {
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
}

// Stateful functions

const init = Promise.mapSeries([movieIndexOptions, personIndexOptions], indexOptions => initSearchIndex(searchIndex, indexOptions)
.then(promisifySearchIndex))
.then(searchIndexes => {
    movieSearchIndex = searchIndexes[0];
    personSearchIndex = searchIndexes[1];
    return Promise.resolve();
});

const checkIsMovieIndexEmpty = () => init.then(() => checkIsIndexEmpty(movieSearchIndex));

const checkIsPersonIndexEmpty = () => init.then(() => checkIsIndexEmpty(personSearchIndex));

const populateMovieIndex = () => init
.then(() => fillMovieIndex(movieSearchIndex, movieBatchOptions, BATCH_SIZE))

const populatePersonIndex = () => init
.then(() => fillPersonIndex(personSearchIndex, personBatchOptions, BATCH_SIZE))

const searchMovieIndex = text => init.then(() => {
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
    return movieSearchIndex.search(query)
    .then(treatSearchResults)
});

const searchPersonIndex = text => init.then(() => {
    const query = {
        query: {'*': [text]}
    }
    return personSearchIndex.search(query)
    .then(treatSearchResults)
});

// Exports

module.exports = {
    movies: {
        populate: populateMovieIndex,
        isEmpty: checkIsMovieIndexEmpty,
        search: searchMovieIndex
    },
    persons: {
        populate: populatePersonIndex,
        isEmpty: checkIsPersonIndexEmpty,
        search: searchPersonIndex
    },
    init
};
