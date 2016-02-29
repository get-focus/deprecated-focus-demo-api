"use strict";

// Libraries imports

const Promise = require('bluebird');
const searchIndex = Promise.promisify(require('search-index')); // Promisify search-index
const stopwords = require('term-vector').getStopwords('fr').sort(); // Get the french stopwords
const da = require('distribute-array'); // Used to make indexation batches
const _ = require('lodash');

// Local imports

const initDatabase = require('../database').init;
const getAllPersons = require('../database').getAllPersons;
const batchify = require('./common').batchify;
const sequencify = require('./common').sequencify;
const indexBatch = require('./common').indexBatch;
const initSearchIndex = require('./common').initSearchIndex;
const checkIsIndexEmpty = require('./common').checkIsIndexEmpty;
const promisifySearchIndex = require('./common').promisifySearchIndex;
const treatSearchResults = require('./common').treatSearchResults;
const groupedSearch = require('./common').groupedSearch;

// Local references

let personSearchIndex;

// Configuration

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

const fillPersonIndex = (si, batchOptions, batchSize) => initDatabase
.then(() => getPersons())
.then(persons => batchify(persons, batchSize))
.then(batches => sequencify(batches, (batch, batchIndex) => indexBatch(si, batch, batchOptions, batchIndex, batches.length)))

// Stateful functions

const init = initSearchIndex(searchIndex, personIndexOptions)
.then(promisifySearchIndex)
.then(si => {
    personSearchIndex = si;
    return Promise.resolve();
});

const checkIsPersonIndexEmpty = () => init.then(() => checkIsIndexEmpty(personSearchIndex));

const populate = () => init
.then(() => fillPersonIndex(personSearchIndex, personBatchOptions, BATCH_SIZE))

const search = text => init.then(() => {
    const query = {
        query: {'*': [text]},
        facets: {
            activity: {},
            fullName: {
                ranges: [
                    ['', '9'],
                    ['A', 'G'],
                    ['H', 'N'],
                    ['O', 'T'],
                    ['U', 'Z']
                ]
            },
            sex: {}
        }
    }
    return personSearchIndex.search(query)
    .then(treatSearchResults);
});

module.exports = {
    init,
    search,
    checkIsIndexEmpty: checkIsPersonIndexEmpty,
    populate
}
